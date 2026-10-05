const fs = require('node:fs/promises');
const ExcelJS = require('exceljs');

const INPUT_PATH = 'All-Stock-Reviews-Combined.xlsx';
const OUTPUT_PATH = 'All-Stocks-Deduplicated-Sectorwise.xlsx';
const MATCH_CACHE_PATH = '.deduplicated-stock-profile-matches.json';
const PROFILE_CACHE_PATHS = ['.corporate-action-profiles.json', '.outlook-profile-cache.json'];
const INDmoney_OWNERSHIP_CACHE = '.combined-shareholding-fallback-cache.json';
const SCREENER_ORIGIN = 'https://www.screener.in';
const USER_AGENT = 'Mozilla/5.0 (compatible; ScreenerWorkbook/1.0)';
const SEARCH_CONCURRENCY = 2;
const REQUEST_DELAY_MS = 1100;
const TARGET_SHEETS = {
  under10: 'Under10 - All Stocks',
  indmoney: 'INDmoney - Stocks under 20Rs',
  focus: 'INDmoney - Focus Sectors',
  annual: 'Annual26 - Under ₹20',
  neutral: 'Annual26 - Neutral',
  optimistic: 'Annual26 - Optimistic',
  veryOptimistic: 'Annual26 - Very Optimistic',
  bonus: 'BonusSplit - Bonus',
  split: 'BonusSplit - Split'
};
const HEADERS = [
  'Sector', 'Company', 'Bonus', 'Split', 'Price ₹', 'Market Cap ₹ Cr',
  'Promoter %', 'Public %', 'ROCE %', 'ROE %', 'Pledged %', 'Debt/Equity',
  'Sales (₹ Cr)', 'Products / Applications', 'Where Used',
  'TTM Growth %', '3Y Growth %', 'Outlook', 'P/E', 'Sales Change',
  'Profit (₹ Cr)', 'Profit Change', 'ROCE Change', 'Debt (₹ Cr)',
  'Debt Change', 'Report Year', 'Annual Report PDF',
  'Screener Highlights', 'INDmoney Focus Group', 'INDmoney Metal Type'
];
const FIELDS = [
  'sector', 'price', 'marketCap', 'promoter', 'public', 'roce', 'roe', 'pledged',
  'debtToEquity', 'sales', 'products', 'whereUsed', 'ttmGrowth', 'threeYearGrowth',
  'outlook', 'pe', 'salesChange', 'profit', 'profitChange', 'roceChange',
  'debt', 'debtChange', 'reportYear', 'annualReport', 'screenerHighlights', 'screenerProfile',
  'indmoneyProfile', 'focusGroups', 'metalTypes'
];
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const cellText = value => value && typeof value === 'object' ? value.text || '' : String(value ?? '');
const cellUrl = value => value && typeof value === 'object' ? value.hyperlink || '' : '';

function normalizedName(value) {
  return String(value || '').toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\b(limited|ltd|company|co)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function canonicalScreenerUrl(value) {
  try {
    const url = new URL(value, SCREENER_ORIGIN);
    if (url.origin !== SCREENER_ORIGIN || !/^\/company\/[^/]+\/(?:consolidated\/)?$/.test(url.pathname)) return '';
    url.pathname = url.pathname.replace(/consolidated\/$/, '');
    url.search = '';
    url.hash = '';
    return url.href;
  } catch {
    return '';
  }
}

function numberValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const match = value.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : null;
  }
  return null;
}

function validPercent(value) {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}

async function readJson(path, optional = false) {
  try {
    return JSON.parse(await fs.readFile(path, 'utf8'));
  } catch (error) {
    if (optional && error.code === 'ENOENT') return {};
    if (error instanceof SyntaxError) throw new Error(`Invalid JSON in ${path}: ${error.message}`);
    throw error;
  }
}

function firstColumn(headers, patterns) {
  return headers.findIndex(header => patterns.some(pattern => pattern.test(header)));
}

function indexedColumns(sheet) {
  const headers = sheet.getRow(1).values.slice(1).map(cellText);
  return {
    headers,
    sector: firstColumn(headers, [/^sector$/i]),
    company: firstColumn(headers, [/^company$/i]),
    price: firstColumn(headers, [/^price(?:\s*\([^)]*\)|\s*₹|\s*\(₹\))?$/i]),
    marketCap: firstColumn(headers, [/^market cap/i]),
    promoter: firstColumn(headers, [/^promoter(?:s)?\s*(?:%|\(%\))$/i]),
    public: firstColumn(headers, [/^public\s*(?:%|\(%\))$/i]),
    roce: firstColumn(headers, [/^roce(?:\s*%|\s*\(%\))?$/i]),
    roe: firstColumn(headers, [/^roe(?:\s*%|\s*\(%\))?$/i]),
    pledged: firstColumn(headers, [/^pledged(?:\s*%|\s*\(%\))?$/i]),
    debtToEquity: firstColumn(headers, [/^debt\s*\/\s*equity$/i, /^debt\/equity$/i]),
    sales: firstColumn(headers, [/^sales\s*\(₹\s*cr\)$/i, /^sales\s*\(.*cr\)$/i]),
    products: firstColumn(headers, [/^products\s*\/\s*applications$/i, /^products\s*\/\s*applications\s*\/\s*where used/i]),
    whereUsed: firstColumn(headers, [/^where used(?:\s*\(screener about\))?$/i]),
    ttmGrowth: firstColumn(headers, [/^ttm growth\s*%$/i]),
    threeYearGrowth: firstColumn(headers, [/^3y growth\s*%$/i]),
    outlook: firstColumn(headers, [/^outlook$/i]),
    pe: firstColumn(headers, [/^p\/e$/i, /^stock p\/e$/i]),
    salesChange: firstColumn(headers, [/^sales change$/i]),
    profit: firstColumn(headers, [/^profit\s*\(₹\s*cr\)$/i]),
    profitChange: firstColumn(headers, [/^profit change$/i]),
    roceChange: firstColumn(headers, [/^roce change$/i]),
    debt: firstColumn(headers, [/^debt\s*\(₹\s*cr\)$/i]),
    debtChange: firstColumn(headers, [/^debt change$/i]),
    reportYear: firstColumn(headers, [/^report year$/i]),
    annualReport: firstColumn(headers, [/^annual report pdf$/i]),
    screenerHighlights: firstColumn(headers, [/^screener highlights$/i]),
    screener: firstColumn(headers, [/^(screener company|screener link|screener profile)$/i]),
    indmoney: firstColumn(headers, [/^stock page link$/i])
  };
}

function rowValue(row, index) {
  return index < 0 ? null : row.getCell(index + 1).value;
}

function scalarFromCell(row, index) {
  const value = rowValue(row, index);
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'object') return value.text || null;
  return value;
}

function parseDate(dateText) {
  const match = String(dateText || '').match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (!match) return new Date(0);
  const month = new Date(`${match[2]} 1, ${match[3]}`).getMonth();
  return new Date(Date.UTC(Number(match[3]), month, Number(match[1])));
}

async function requestScreenerSearch(companyName) {
  let lastError;
  const url = `${SCREENER_ORIGIN}/api/company/search/?q=${encodeURIComponent(companyName)}`;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    await delay(REQUEST_DELAY_MS);
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: AbortSignal.timeout(30000)
      });
      if (response.status === 429) {
        const retryAfter = Number(response.headers.get('retry-after'));
        const cooldown = Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.max(60000, retryAfter * 1000)
          : Math.max(60000, attempt * 15000);
        console.warn(`Screener search rate limited; retrying in ${cooldown / 1000}s.`);
        await delay(cooldown);
        continue;
      }
      if (!response.ok) throw new Error(`Screener search returned HTTP ${response.status}.`);
      const results = await response.json();
      const key = normalizedName(companyName);
      const exact = results.filter(item => normalizedName(item.name) === key);
      if (exact.length !== 1) {
        return {
          url: '',
          error: exact.length ? 'Multiple exact Screener matches.' : 'No exact Screener match.'
        };
      }
      return { url: canonicalScreenerUrl(exact[0].url), error: '' };
    } catch (error) {
      lastError = error;
      if (attempt < 5) await delay(attempt * 4000);
    }
  }
  return { url: '', error: String(lastError?.message || lastError || 'Search failed').slice(0, 250) };
}

async function resolveMissingIndmoneyCompanies(items, matchCache, nameToId) {
  const pending = items.filter(item => !nameToId.has(item.key) && !matchCache.has(item.key));
  console.log(`${items.length} unique INDmoney-listed stocks; ${pending.length} require exact Screener identity matching.`);
  let next = 0;
  let done = 0;
  await Promise.all(Array.from({ length: Math.min(SEARCH_CONCURRENCY, pending.length) }, async () => {
    while (next < pending.length) {
      const item = pending[next];
      next += 1;
      const match = await requestScreenerSearch(item.name);
      matchCache.set(item.key, match);
      if (match.url) nameToId.set(item.key, match.url);
      done += 1;
      if (done % 50 === 0 || done === pending.length) {
        await fs.writeFile(MATCH_CACHE_PATH, JSON.stringify(Object.fromEntries(matchCache)), 'utf8');
        console.log(`Exact Screener matches ${done}/${pending.length}.`);
      }
    }
  }));
  for (const item of items) {
    const match = matchCache.get(item.key);
    if (match?.url && !nameToId.has(item.key)) nameToId.set(item.key, match.url);
  }
}

function createCompany(id, companyName) {
  return {
    id,
    names: new Set(),
    sector: '',
    fieldPriorities: Object.fromEntries(FIELDS.map(field => [field, -Infinity])),
    values: Object.fromEntries(FIELDS.map(field => [field, null])),
    bonuses: new Map(),
    splits: new Map(),
    sourceRows: new Set()
  };
}

function getOrCreateCompany(companies, nameToId, id, companyName) {
  const key = normalizedName(companyName);
  let company = id ? companies.get(id) : null;
  let previousId = '';
  if (!company && nameToId.has(key)) {
    previousId = nameToId.get(key);
    company = companies.get(previousId);
  }
  if (!company) {
    const stableId = id || `name:${key}`;
    company = companies.get(stableId);
    if (!company) {
      company = createCompany(stableId, companyName);
      companies.set(stableId, company);
    }
    id = stableId;
  }
  if (
    id?.startsWith('https://www.screener.in/')
    && previousId
    && previousId.startsWith('https://www.indmoney.com/')
  ) {
    companies.delete(previousId);
    company.id = id;
  }
  if (key) {
    company.names.add(companyName);
    nameToId.set(key, company.id);
  }
  if (id && id.startsWith('https://www.screener.in/')) {
    nameToId.set(key, id);
    companies.set(id, company);
  } else {
    companies.set(company.id, company);
  }
  return company;
}

function addValue(company, field, value, priority) {
  if (value === null || value === undefined || value === '') return;
  if (['promoter', 'public', 'pledged'].includes(field)) {
    const numeric = numberValue(value);
    if (!validPercent(numeric)) return;
    value = numeric;
  } else if (['price', 'marketCap', 'roce', 'roe', 'debtToEquity', 'sales', 'ttmGrowth', 'threeYearGrowth', 'pe', 'profit', 'debt'].includes(field)) {
    value = numberValue(value);
    if (value === null) return;
  } else if (typeof value === 'string') {
    value = value.trim();
    if (!value) return;
  }

  if (priority >= company.fieldPriorities[field]) {
    company.values[field] = value;
    company.fieldPriorities[field] = priority;
  }
}

function addUniqueText(company, field, value) {
  const text = String(value || '').trim();
  if (!text) return;
  const values = new Set(String(company.values[field] || '').split('\n').filter(Boolean));
  values.add(text);
  company.values[field] = [...values].join('\n');
}

function addSourceRecord(company, sheet, row, columns, sourceKey, priority) {
  const fieldMap = {
    sector: 'sector', price: 'price', marketCap: 'marketCap', promoter: 'promoter',
    public: 'public', roce: 'roce', roe: 'roe', pledged: 'pledged',
    debtToEquity: 'debtToEquity', sales: 'sales', products: 'products',
    whereUsed: 'whereUsed', ttmGrowth: 'ttmGrowth', threeYearGrowth: 'threeYearGrowth',
    outlook: 'outlook', pe: 'pe', salesChange: 'salesChange', profit: 'profit',
    profitChange: 'profitChange', roceChange: 'roceChange', debt: 'debt',
    debtChange: 'debtChange', reportYear: 'reportYear',
    screenerHighlights: 'screenerHighlights'
  };
  for (const [column, field] of Object.entries(fieldMap)) {
    const value = scalarFromCell(row, columns[column]);
    if (['products', 'whereUsed', 'screenerHighlights'].includes(field)) addUniqueText(company, field, value);
    else addValue(company, field, value, priority);
  }
  const report = rowValue(row, columns.annualReport);
  if (report) {
    const link = cellUrl(report);
    addValue(company, 'annualReport', link
      ? { text: cellText(report), hyperlink: link }
      : cellText(report), priority);
  }
  const screener = canonicalScreenerUrl(cellUrl(rowValue(row, columns.screener)))
    || canonicalScreenerUrl(cellUrl(rowValue(row, columns.company)));
  if (screener) addValue(company, 'screenerProfile', screener, 100);
  const indmoney = cellUrl(rowValue(row, columns.indmoney))
    || (/^https:\/\/www\.indmoney\.com\/stocks\//.test(cellUrl(rowValue(row, columns.company)))
      ? cellUrl(rowValue(row, columns.company))
      : '');
  if (indmoney) addValue(company, 'indmoneyProfile', indmoney, 50);

  if (sourceKey === 'focus') {
    const focusGroup = scalarFromCell(row, columns.headers.indexOf('Focus Group'));
    const metalType = scalarFromCell(row, columns.headers.indexOf('Metal Type'));
    if (focusGroup) addUniqueText(company, 'focusGroups', focusGroup);
    if (metalType) addUniqueText(company, 'metalTypes', metalType);
  }
}

function rowCompanyName(row, columns) {
  return cellText(rowValue(row, columns.company)).trim();
}

function normalizeAboutFields(companies) {
  for (const company of companies.values()) {
    const product = String(company.values.products || '').trim();
    const oldAbout = product;
    if (oldAbout && !company.values.whereUsed) {
      const matches = oldAbout.match(/[^.!?]+(?:[.!?]+|$)/g) || [oldAbout];
      const used = matches.map(sentence => sentence.trim()).filter(sentence => (
        /\b(?:used\s+(?:for|in|by|across)|for\s+use\s+(?:in|by)|applications?\s+(?:include|are|is)|(?:serves?|serving)\s+(?:the\s+)?(?:\w+\s+){0,2}(?:industry|industries|sector|sectors|market))\b/i.test(sentence)
      ));
      if (used.length) company.values.whereUsed = [...new Set(used)].join(' ');
    }
  }
}

function applyProfileCache(company, screenerUrl, profiles, indmoneyCache) {
  const profile = profiles.get(screenerUrl);
  if (profile) {
    for (const [sourceKey, field] of [
      ['sector', 'sector'], ['price', 'price'], ['marketCap', 'marketCap'],
      ['promoter', 'promoter'], ['public', 'public'], ['roce', 'roce'],
      ['roe', 'roe'], ['pledged', 'pledged'], ['debtToEquity', 'debtToEquity'],
      ['sales', 'sales'], ['about', 'products']
    ]) {
      const value = profile[sourceKey];
      if (field === 'products') addUniqueText(company, field, value);
      else addValue(company, field, value, 110);
    }
  }
  const indmoneyUrl = company.values.indmoneyProfile;
  const holding = indmoneyUrl ? indmoneyCache.get(indmoneyUrl) : null;
  if (holding) {
    if (!validPercent(company.values.promoter) && validPercent(holding.promoter)) addValue(company, 'promoter', holding.promoter, 80);
    if (!validPercent(company.values.public) && validPercent(holding.public)) addValue(company, 'public', holding.public, 80);
  }
}

function buildActions(companies, sheet, actionType, columns, nameToId) {
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const name = rowCompanyName(row, columns);
    if (!name) continue;
    const profileUrl = canonicalScreenerUrl(cellUrl(rowValue(row, columns.screener)))
      || canonicalScreenerUrl(cellUrl(rowValue(row, columns.company)));
    const id = profileUrl || nameToId.get(normalizedName(name)) || '';
    const company = getOrCreateCompany(companies, nameToId, id, name);
    const date = cellText(rowValue(row, columns.exDate));
    const ratio = cellText(rowValue(row, columns.ratio));
    const key = `${parseDate(date).toISOString()}|${ratio}`;
    const event = { date, ratio, sortDate: parseDate(date) };
    const target = actionType === 'Bonus' ? company.bonuses : company.splits;
    if (!target.has(key)) target.set(key, event);
    addSourceRecord(company, sheet, row, columns, actionType.toLowerCase(), 120);
  }
}

function dataRow(company) {
  const values = company.values;
  const names = [...company.names].sort((a, b) => b.length - a.length || a.localeCompare(b));
  const displayName = names[0] || '';
  const profileLink = values.screenerProfile || values.indmoneyProfile;
  const companyCell = profileLink ? { text: displayName, hyperlink: profileLink } : displayName;
  const annualReport = values.annualReport && typeof values.annualReport === 'object'
    ? values.annualReport
    : values.annualReport || '';
  const fixed = [
    values.sector || 'Unclassified',
    companyCell,
    company.bonuses.size ? 'Yes' : 'No',
    company.splits.size ? 'Yes' : 'No',
    values.price ?? null,
    values.marketCap ?? null,
    values.promoter ?? null,
    values.public ?? null,
    values.roce ?? null,
    values.roe ?? null,
    values.pledged ?? null,
    values.debtToEquity ?? null,
    values.sales ?? null,
    values.products || '',
    values.whereUsed || '',
    values.ttmGrowth ?? null,
    values.threeYearGrowth ?? null,
    values.outlook || '',
    values.pe ?? null,
    values.salesChange ?? null,
    values.profit ?? null,
    values.profitChange ?? null,
    values.roceChange ?? null,
    values.debt ?? null,
    values.debtChange ?? null,
    values.reportYear ?? null,
    annualReport,
    values.screenerHighlights || '',
    values.focusGroups || '',
    values.metalTypes || ''
  ];
  return fixed;
}

async function main() {
  const sourceWorkbook = new ExcelJS.Workbook();
  await sourceWorkbook.xlsx.readFile(INPUT_PATH);
  const profiles = new Map();
  for (const path of PROFILE_CACHE_PATHS) {
    const cache = await readJson(path, true);
    for (const [url, profile] of Object.entries(cache)) {
      const canonical = canonicalScreenerUrl(url);
      if (canonical && !profile.error) profiles.set(canonical, profile);
    }
  }
  const indmoneyOwnership = await readJson(INDmoney_OWNERSHIP_CACHE, true);
  const matchCacheObject = await readJson(MATCH_CACHE_PATH, true);
  const matchCache = new Map(Object.entries(matchCacheObject));
  const companies = new Map();
  const nameToId = new Map();
  const sourceCounts = {};

  for (const [key, sheetName] of Object.entries(TARGET_SHEETS)) {
    const sheet = sourceWorkbook.getWorksheet(sheetName);
    if (!sheet) throw new Error(`Missing source sheet: ${sheetName}`);
    if (['bonus', 'split', 'neutral', 'optimistic', 'veryOptimistic'].includes(key)) continue;
    const columns = indexedColumns(sheet);
    if (columns.company < 0) continue;
    const records = [];
    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
      if (sheet.getCell(rowNumber, 1).isMerged) continue;
      const row = sheet.getRow(rowNumber);
      const name = rowCompanyName(row, columns);
      if (!name) continue;
      const screenerUrl = canonicalScreenerUrl(cellUrl(rowValue(row, columns.screener)))
        || canonicalScreenerUrl(cellUrl(rowValue(row, columns.company)));
      const indmoneyUrl = cellUrl(rowValue(row, columns.indmoney))
        || (/^https:\/\/www\.indmoney\.com\/stocks\//.test(cellUrl(rowValue(row, columns.company)))
          ? cellUrl(rowValue(row, columns.company))
          : '');
      records.push({ name, key: normalizedName(name), screenerUrl, indmoneyUrl, rowNumber });
    }
    if (key === 'indmoney') {
      await resolveMissingIndmoneyCompanies(records, matchCache, nameToId);
      await fs.writeFile(MATCH_CACHE_PATH, JSON.stringify(Object.fromEntries(matchCache)), 'utf8');
    }
    for (const record of records) {
      let id = record.screenerUrl || nameToId.get(record.key) || '';
      if (!id && record.indmoneyUrl) id = record.indmoneyUrl;
      const company = getOrCreateCompany(companies, nameToId, id, record.name);
      const row = sheet.getRow(record.rowNumber);
      const priority = key === 'under10' ? 80 : key === 'annual' ? 70 : key === 'focus' ? 45 : 50;
      addSourceRecord(company, sheet, row, indexedColumns(sheet), key, priority);
      const finalId = record.screenerUrl || nameToId.get(record.key) || '';
      if (finalId.startsWith('https://www.screener.in/')) {
        addValue(company, 'screenerProfile', finalId, 100);
        applyProfileCache(company, finalId, profiles, new Map(Object.entries(indmoneyOwnership)));
      }
    }
    sourceCounts[key] = { sheet: sheetName, records: records.length };
  }

  for (const key of ['neutral', 'optimistic', 'veryOptimistic']) {
    const sheet = sourceWorkbook.getWorksheet(TARGET_SHEETS[key]);
    const columns = indexedColumns(sheet);
    let mapped = 0;
    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      const name = rowCompanyName(row, columns);
      const url = canonicalScreenerUrl(cellUrl(rowValue(row, columns.screener)))
        || canonicalScreenerUrl(cellUrl(rowValue(row, columns.company)));
      const id = url || nameToId.get(normalizedName(name));
      if (!id) continue;
      const company = getOrCreateCompany(companies, nameToId, id, name);
      addSourceRecord(company, sheet, row, columns, key, 75);
      mapped += 1;
    }
    sourceCounts[key] = { sheet: TARGET_SHEETS[key], records: sheet.rowCount - 1, mapped };
  }

  for (const action of ['bonus', 'split']) {
    const sheet = sourceWorkbook.getWorksheet(TARGET_SHEETS[action]);
    const columns = indexedColumns(sheet);
    columns.exDate = firstColumn(columns.headers, [/^ex-date$/i]);
    columns.ratio = firstColumn(columns.headers, [/^bonus ratio \/ split face value/i]);
    buildActions(companies, sheet, action === 'bonus' ? 'Bonus' : 'Split', columns, nameToId);
    sourceCounts[action] = { sheet: sheet.name, events: sheet.rowCount - 1 };
  }

  const uniqueCompanies = new Set();
  const mergedByName = new Map();
  const mergedByProfile = new Map();
  const mergeInto = (target, source) => {
    if (target === source) return target;
    for (const name of source.names) target.names.add(name);
    for (const field of FIELDS) {
      if (source.fieldPriorities[field] > target.fieldPriorities[field]) {
        target.values[field] = source.values[field];
        target.fieldPriorities[field] = source.fieldPriorities[field];
      }
    }
    for (const [eventKey, event] of source.bonuses) target.bonuses.set(eventKey, event);
    for (const [eventKey, event] of source.splits) target.splits.set(eventKey, event);
    uniqueCompanies.delete(source);
    for (const [name, value] of mergedByName) {
      if (value === source) mergedByName.set(name, target);
    }
    for (const [profileUrl, value] of mergedByProfile) {
      if (value === source) mergedByProfile.set(profileUrl, target);
    }
    return target;
  };
  for (const candidate of new Set(companies.values())) {
    const screenerUrl = candidate.values.screenerProfile;
    const nameKeys = [...candidate.names].map(normalizedName).filter(Boolean);
    const knownTargets = [
      ...(screenerUrl && mergedByProfile.has(screenerUrl) ? [mergedByProfile.get(screenerUrl)] : []),
      ...nameKeys.map(name => mergedByName.get(name)).filter(Boolean)
    ];
    let target = knownTargets[0];
    if (!target) target = createCompany(screenerUrl || candidate.id || `name:${nameKeys[0] || ''}`, [...candidate.names].sort()[0] || '');
    for (const other of new Set(knownTargets.slice(1))) target = mergeInto(target, other);
    for (const name of candidate.names) target.names.add(name);
    for (const field of FIELDS) {
      if (candidate.fieldPriorities[field] >= target.fieldPriorities[field]) {
        target.values[field] = candidate.values[field];
        target.fieldPriorities[field] = candidate.fieldPriorities[field];
      }
    }
    for (const [eventKey, event] of candidate.bonuses) target.bonuses.set(eventKey, event);
    for (const [eventKey, event] of candidate.splits) target.splits.set(eventKey, event);
    target.id = target.values.screenerProfile || candidate.id || target.id;
    uniqueCompanies.add(target);
    for (const name of target.names) mergedByName.set(normalizedName(name), target);
    if (target.values.screenerProfile) mergedByProfile.set(target.values.screenerProfile, target);
  }
  const uniqueCompanyMap = new Map([...uniqueCompanies].map(company => [company.id, company]));
  normalizeAboutFields(uniqueCompanyMap);
  for (const company of uniqueCompanyMap.values()) {
    const profileUrl = company.values.screenerProfile;
    if (profileUrl) applyProfileCache(company, profileUrl, profiles, new Map(Object.entries(indmoneyOwnership)));
  }

  const rows = [...uniqueCompanyMap.values()].sort((left, right) => (
    String(left.values.sector || 'Unclassified').localeCompare(String(right.values.sector || 'Unclassified'))
  ));
  const output = new ExcelJS.Workbook();
  output.creator = 'Deduplicated sector-wise stock review';
  output.subject = 'Unique stocks across available combined stock review sheets with bonus and split history';
  const sheet = output.addWorksheet('All Stocks', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.addRow(HEADERS);
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: HEADERS.length } };
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF174A3A' } };
  header.alignment = { vertical: 'middle', wrapText: true };
  header.height = 40;
  for (const company of rows) {
    const row = sheet.addRow(dataRow(company));
    row.alignment = { vertical: 'top', wrapText: true };
    row.getCell(2).font = company.values.screenerProfile || company.values.indmoneyProfile
      ? { color: { argb: 'FF0563C1' }, underline: true }
      : {};
    for (const column of [5, 6, 9, 10, 12, 13, 16, 17, 19, 21, 24]) row.getCell(column).numFmt = '#,##0.00';
    for (const column of [7, 8, 11]) row.getCell(column).numFmt = '0.00';
    for (const column of [14, 15]) row.getCell(column).alignment = { vertical: 'top', wrapText: true };
    row.height = Math.min(96, Math.max(24, Math.ceil(String(company.values.products || '').length / 90) * 18));
  }
  sheet.columns = [
    { width: 29 }, { width: 30 }, { width: 25 }, { width: 25 }, { width: 13 }, { width: 18 },
    { width: 13 }, { width: 13 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 14 },
    { width: 16 }, { width: 72 }, { width: 54 }, { width: 14 }, { width: 14 }, { width: 20 },
    { width: 12 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 14 }, { width: 16 },
    { width: 15 }, { width: 13 }, { width: 18 }, { width: 72 }, { width: 22 }, { width: 20 }
  ];

  const readMe = output.addWorksheet('Read Me');
  const unresolved = [...matchCache.entries()].filter(([, match]) => !match.url);
  const bonusCompanies = rows.filter(company => company.bonuses.size).length;
  const splitCompanies = rows.filter(company => company.splits.size).length;
  const duplicateKeys = rows.length - new Set(rows.map(company => company.id)).size;
  readMe.addRows([
    ['Source Workbook', INPUT_PATH],
    ['Coverage', `${rows.length} unique company records assembled from the listed stock sheets; duplicate source rows are merged by canonical Screener profile where available, otherwise by exact normalized company identity.`],
    ['Sector order', 'All Stocks is grouped by alphabetically sorted Sector only. Original company order is preserved within each sector; prices are not ranked or sorted.'],
    ['Bonus / Split', 'Bonus and Split columns contain Yes or No based on whether that unique company appears in the source event tabs. Ex-Dates and ratios are intentionally omitted so one company remains one row.'],
    ['Action source scope', 'The source Bonus/Split tabs contain completed action events that met the price filter when those tabs were built; this workbook does not infer events outside the source data.'],
    ['Source detail', JSON.stringify(sourceCounts)],
    ['Action coverage', `${bonusCompanies} unique companies have at least one listed Bonus event; ${splitCompanies} have at least one listed Split event.`],
    ['Unmatched INDmoney names', `${unresolved.length} exact company names did not resolve to a unique Screener profile; those records remain included and are not fuzzy-merged.`],
    ['Ownership fallback', 'Uses Screener profile values first, then the latest-quarter INDmoney shareholding values where an INDmoney profile is available. Blank values remain blank if no validated value is available.'],
    ['Company profile links', 'Company names link to the Screener profile where an exact profile match is available; unmatched records use the INDmoney stock page link. No separate profile-link columns are included.'],
    ['Conflicting fields', 'For duplicates, values are selected from the higher-priority source in this order: corporate-action profile, under-₹10 Screener sheet, 2026 Screener annual-report sheet, category tabs, Focus Sectors, INDmoney stock list. Missing values are filled from lower-priority sources.'],
    ['Excluded', 'Read Me and Outlook Summary sheets are not treated as stock rows. The explicitly excluded Turnaround-Stock-Review.xlsx and deleted source workbooks are not included.']
  ]);
  readMe.getColumn(1).width = 30;
  readMe.getColumn(2).width = 130;
  readMe.eachRow(row => {
    row.height = 38;
    row.getCell(2).alignment = { vertical: 'top', wrapText: true };
  });

  const tempPath = `${OUTPUT_PATH}.tmp`;
  try {
    await output.xlsx.writeFile(tempPath);
    await fs.rename(tempPath, OUTPUT_PATH);
  } catch (error) {
    await fs.rm(tempPath, { force: true });
    throw error;
  }
  console.log(JSON.stringify({
    output: OUTPUT_PATH,
    uniqueStocks: rows.length,
    sourceCounts,
    bonusCompanies,
    splitCompanies,
    unresolvedINDmoneyExactMatches: unresolved.length,
    duplicateKeys,
    sectorCount: new Set(rows.map(company => company.values.sector || 'Unclassified')).size
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
