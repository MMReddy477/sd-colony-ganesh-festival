const fs = require('node:fs/promises');
const ExcelJS = require('exceljs');

const WORKBOOK_PATH = 'All-Stock-Reviews-Combined.xlsx';
const CACHE_PATH = '.combined-shareholding-fallback-cache.json';
const SCREENER_CACHES = [
  '.corporate-action-profiles.json',
  '.outlook-profile-cache.json',
  '.indmoney-focus-shareholding-cache.json'
];
const SCREENER_ORIGIN = 'https://www.screener.in';
const USER_AGENT = 'Mozilla/5.0 (compatible; ScreenerWorkbook/1.0)';
const REQUEST_DELAY_MS = 1100;
const CONCURRENCY = 2;
const CHECKPOINT_SIZE = 20;
const INDmoney_UNDER_20 = 'INDmoney - Stocks under 20Rs';
const FOCUS_SHEET = 'INDmoney - Focus Sectors';
const OWNERSHIP_HEADERS = ['Promoter %', 'Public %'];
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const cellText = value => value && typeof value === 'object' ? value.text || '' : String(value || '');
const cellUrl = value => value && typeof value === 'object' ? value.hyperlink || '' : '';

function normalizeName(value) {
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

function validPercent(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
}

function cleanHtml(value) {
  return String(value || '')
    .replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function latestIndmoneyHolding(html, target) {
  for (const [, table] of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)) {
    for (const [, row] of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)]
        .map(match => cleanHtml(match[1]));
      const label = (cells[0] || '').toLowerCase().trim();
      if (label !== target) continue;
      const values = cells.slice(1).map(value => {
        const match = value.replace(/,/g, '').match(/-?\d+(?:\.\d+)?\s*%?/);
        return match ? Number(match[0].replace('%', '').trim()) : null;
      }).filter(Number.isFinite);
      if (values.length) return values[values.length - 1];
    }
  }
  return null;
}

function parseIndmoneyOwnership(html) {
  const promoter = latestIndmoneyHolding(html, 'promoters');
  const publicHolding = latestIndmoneyHolding(html, 'public');
  return {
    promoter: validPercent(promoter) ? promoter : null,
    public: validPercent(publicHolding) ? publicHolding : null,
    error: ''
  };
}

async function readJson(path, optional = false) {
  try {
    return JSON.parse(await fs.readFile(path, 'utf8'));
  } catch (error) {
    if (optional && error.code === 'ENOENT') return {};
    if (error instanceof SyntaxError) throw new Error(`Invalid cache JSON in ${path}: ${error.message}`);
    throw error;
  }
}

async function request(url) {
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    await pause(REQUEST_DELAY_MS);
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
        signal: AbortSignal.timeout(30000)
      });
      if (response.status === 429) {
        const retryAfter = Number(response.headers.get('retry-after'));
        const cooldown = Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.max(60000, retryAfter * 1000)
          : Math.max(60000, attempt * 15000);
        console.warn(`INDmoney returned HTTP 429; retrying after ${cooldown / 1000}s: ${url}`);
        await pause(cooldown);
        continue;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < 5) await pause(attempt * 5000);
    }
  }
  throw lastError || new Error(`Request failed after retries: ${url}`);
}

async function runPool(items, worker) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next];
      next += 1;
      await worker(item);
    }
  }));
}

function companyLinkColumn(headers) {
  return headers.findIndex(header => /^(screener company|screener link|stock page link)$/i.test(header)) + 1;
}

function collectRows(sheet) {
  const headers = sheet.getRow(1).values.slice(1).map(cellText);
  const companyColumn = headers.findIndex(header => /^company$/i.test(header)) + 1;
  const promoterColumn = headers.indexOf('Promoter %') + 1;
  const publicColumn = headers.indexOf('Public %') + 1;
  if (!companyColumn || !promoterColumn || !publicColumn) return [];
  const linkColumn = companyLinkColumn(headers);
  const records = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    if (sheet.getCell(rowNumber, 1).isMerged) continue;
    const row = sheet.getRow(rowNumber);
    const company = cellText(row.getCell(companyColumn).value).trim();
    if (!company) continue;
    records.push({
      sheet,
      row,
      rowNumber,
      company,
      key: normalizeName(company),
      companyColumn,
      promoterColumn,
      publicColumn,
      sourceLink: linkColumn ? cellUrl(row.getCell(linkColumn).value) : ''
    });
  }
  return records;
}

function addWorkbookNote(workbook, report) {
  const sheet = workbook.getWorksheet('Read Me');
  if (!sheet) return;
  const labels = new Set([
    'INDmoney Focus Sectors shareholding',
    'Shareholding fallback',
    'Shareholding pattern coverage'
  ]);
  let rowIndex = 0;
  for (let index = 1; index <= sheet.rowCount; index += 1) {
    if (labels.has(cellText(sheet.getRow(index).getCell(1).value))) {
      if (!rowIndex) rowIndex = index;
    }
  }
  if (!rowIndex) rowIndex = sheet.rowCount + 1;
  for (let index = sheet.rowCount; index > rowIndex; index -= 1) {
    if (labels.has(cellText(sheet.getRow(index).getCell(1).value))) sheet.spliceRows(index, 1);
  }
  const row = sheet.getRow(rowIndex);
  row.getCell(1).value = 'Shareholding pattern coverage';
  row.getCell(2).value = `Promoter/Public figures use valid Screener latest-quarter values first. Missing or invalid values are filled from the latest quarter shown on the linked INDmoney shareholding page. ${JSON.stringify(report)}`;
  row.height = 42;
  row.getCell(2).alignment = { vertical: 'top', wrapText: true };
}

async function saveCheckpoint(workbook, cache) {
  const temporaryPath = `${WORKBOOK_PATH}.tmp`;
  try {
    await workbook.xlsx.writeFile(temporaryPath);
    await fs.rename(temporaryPath, WORKBOOK_PATH);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true });
    throw error;
  }
  await fs.writeFile(CACHE_PATH, JSON.stringify(Object.fromEntries(cache)), 'utf8');
}

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(WORKBOOK_PATH);
  const indmoneySheet = workbook.getWorksheet(INDmoney_UNDER_20);
  const focusSheet = workbook.getWorksheet(FOCUS_SHEET);
  if (!indmoneySheet || !focusSheet) {
    throw new Error('The combined workbook must contain both INDmoney stock tabs.');
  }

  const screenerCache = new Map();
  for (const path of SCREENER_CACHES) {
    const cached = await readJson(path, true);
    for (const [sourceUrl, profile] of Object.entries(cached)) {
      const url = canonicalScreenerUrl(sourceUrl);
      if (!url) continue;
      screenerCache.set(url, {
        promoter: validPercent(profile.promoter) ? profile.promoter : null,
        public: validPercent(profile.public) ? profile.public : null
      });
    }
  }
  const indmoneyCache = new Map(Object.entries(await readJson(CACHE_PATH, true)));

  const sheetRows = new Map();
  for (const sheet of workbook.worksheets) {
    const rows = collectRows(sheet);
    if (rows.length) sheetRows.set(sheet.name, rows);
  }

  const indmoneyRows = sheetRows.get(INDmoney_UNDER_20) || [];
  const focusRows = sheetRows.get(FOCUS_SHEET) || [];
  const indmoneyByName = new Map();
  const requiredPages = new Map();
  for (const record of [...indmoneyRows, ...focusRows]) {
    const link = record.sourceLink;
    if (!/^https:\/\/www\.indmoney\.com\/stocks\/[^/?#]+/.test(link)) continue;
    const cached = indmoneyCache.get(link);
    const needsFallback = !cached || cached.error;
    if (needsFallback) requiredPages.set(link, record.company);
    const current = indmoneyByName.get(record.key);
    if (!current || current === link) indmoneyByName.set(record.key, link);
    else indmoneyByName.set(record.key, '');
  }

  console.log(`${requiredPages.size} linked INDmoney pages need shareholding data.`);
  let completed = 0;
  await runPool([...requiredPages.entries()], async ([url]) => {
    try {
      const response = await request(url);
      indmoneyCache.set(url, parseIndmoneyOwnership(await response.text()));
    } catch (error) {
      indmoneyCache.set(url, {
        promoter: null,
        public: null,
        error: String(error.message || error).slice(0, 300)
      });
    }
    completed += 1;
    if (completed % CHECKPOINT_SIZE === 0 || completed === requiredPages.size) {
      const interim = buildReport(sheetRows, screenerCache, indmoneyCache, indmoneyByName, true);
      addWorkbookNote(workbook, interim);
      await saveCheckpoint(workbook, indmoneyCache);
      console.log(`INDmoney checkpoint ${completed}/${requiredPages.size}; saved workbook progress.`);
    }
  });

  const report = buildReport(sheetRows, screenerCache, indmoneyCache, indmoneyByName, true);
  addWorkbookNote(workbook, report);
  await saveCheckpoint(workbook, indmoneyCache);
  console.log(JSON.stringify({ workbook: WORKBOOK_PATH, reports: report }, null, 2));
}

function buildReport(sheetRows, screenerCache, indmoneyCache, indmoneyByName, apply) {
  const report = {};
  for (const [sheetName, records] of sheetRows) {
    const stats = {
      rows: records.length,
      promoterFromScreener: 0,
      publicFromScreener: 0,
      promoterFallbackFromIndmoney: 0,
      publicFallbackFromIndmoney: 0,
      promoterBlank: 0,
      publicBlank: 0
    };
    for (const record of records) {
      const screenerUrl = canonicalScreenerUrl(record.sourceLink);
      const screener = screenerUrl ? screenerCache.get(screenerUrl) : null;
      const indmoneyUrl = /^https:\/\/www\.indmoney\.com\/stocks\//.test(record.sourceLink)
        ? record.sourceLink
        : indmoneyByName.get(record.key);
      const indmoney = indmoneyUrl ? indmoneyCache.get(indmoneyUrl) : null;
      const currentPromoter = record.row.getCell(record.promoterColumn).value;
      const currentPublic = record.row.getCell(record.publicColumn).value;
      let promoter = validPercent(currentPromoter) ? currentPromoter : null;
      let publicHolding = validPercent(currentPublic) ? currentPublic : null;
      let promoterSource = '';
      let publicSource = '';

      if (promoter === null && validPercent(screener?.promoter)) {
        promoter = screener.promoter;
        promoterSource = 'screener';
      } else if (promoter === null && validPercent(indmoney?.promoter)) {
        promoter = indmoney.promoter;
        promoterSource = 'indmoney';
      } else if (promoter !== null) {
        if (validPercent(screener?.promoter) && promoter === screener.promoter) promoterSource = 'screener';
        else if (validPercent(indmoney?.promoter) && promoter === indmoney.promoter) promoterSource = 'indmoney';
      }
      if (publicHolding === null && validPercent(screener?.public)) {
        publicHolding = screener.public;
        publicSource = 'screener';
      } else if (publicHolding === null && validPercent(indmoney?.public)) {
        publicHolding = indmoney.public;
        publicSource = 'indmoney';
      } else if (publicHolding !== null) {
        if (validPercent(screener?.public) && publicHolding === screener.public) publicSource = 'screener';
        else if (validPercent(indmoney?.public) && publicHolding === indmoney.public) publicSource = 'indmoney';
      }

      if (apply) {
        record.row.getCell(record.promoterColumn).value = promoter;
        record.row.getCell(record.publicColumn).value = publicHolding;
        record.row.getCell(record.promoterColumn).numFmt = '0.00';
        record.row.getCell(record.publicColumn).numFmt = '0.00';
      }
      if (promoterSource === 'screener') stats.promoterFromScreener += 1;
      if (promoterSource === 'indmoney') stats.promoterFallbackFromIndmoney += 1;
      if (publicSource === 'screener') stats.publicFromScreener += 1;
      if (publicSource === 'indmoney') stats.publicFallbackFromIndmoney += 1;
      if (promoter === null) stats.promoterBlank += 1;
      if (publicHolding === null) stats.publicBlank += 1;
    }
    report[sheetName] = stats;
  }
  return report;
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
