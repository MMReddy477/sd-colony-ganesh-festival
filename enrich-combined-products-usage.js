const fs = require('node:fs/promises');
const ExcelJS = require('exceljs');

const WORKBOOK_PATH = 'All-Stock-Reviews-Combined.xlsx';
const CACHE_PATH = '.combined-company-about-cache.json';
const PROFILE_CACHES = ['.corporate-action-profiles.json', '.outlook-profile-cache.json'];
const SCREENER_ORIGIN = 'https://www.screener.in';
const USER_AGENT = 'Mozilla/5.0 (compatible; ScreenerWorkbook/1.0)';
const REQUEST_DELAY_MS = 1100;
const CONCURRENCY = 2;
const PRODUCTS_HEADER = 'Products / Applications';
const WHERE_USED_HEADER = 'Where Used (Screener About)';
const TARGET_SHEETS = [
  'Annual26 - Neutral',
  'Annual26 - Optimistic',
  'Annual26 - Very Optimistic',
  'INDmoney - Stocks under 20Rs',
  'Under10 - All Stocks'
];
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const cellText = value => value && typeof value === 'object' ? value.text || '' : String(value || '');
const cellUrl = value => value && typeof value === 'object' ? value.hyperlink || '' : '';

function normalizeName(value) {
  return String(value || '').toLowerCase()
    .replace(/\b(limited|ltd|company|co|industries|industry)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function canonicalProfileUrl(value) {
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

function clean(html) {
  return String(html || '')
    .replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)))
    .replace(/&#x([\da-f]+);/gi, (_, number) => String.fromCodePoint(parseInt(number, 16)))
    .replace(/\s+/g, ' ')
    .trim();
}

function latestProfileAbout(html) {
  return clean(html.match(/<div\b[^>]*class=['"][^'"]*\babout\b[^'"]*['"][^>]*>([\s\S]*?)<\/div>/i)?.[1] || '');
}

function explicitUsage(about) {
  if (!about) return '';
  const matches = about.match(/[^.!?]+(?:[.!?]+|$)/g) || [about];
  const usage = matches
    .map(sentence => sentence.trim())
    .filter(sentence => /\b(?:used\s+(?:for|in|by|across)|for\s+use\s+(?:in|by)|applications?\s+(?:include|include|are|is)|(?:serves?|serving)\s+(?:the\s+)?(?:\w+\s+){0,2}(?:industry|industries|sector|sectors|market)|(?:caters?|supplying|supplies|provides?)\s+.{0,45}\b(?:industry|industries|sector|sectors|market))\b/i.test(sentence));
  return [...new Set(usage)].join(' ').slice(0, 1200);
}

async function readJsonIfAvailable(path) {
  try {
    return JSON.parse(await fs.readFile(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    if (error instanceof SyntaxError) throw new Error(`Invalid JSON cache ${path}: ${error.message}`);
    throw error;
  }
}

async function fetchWithRetry(url, accept) {
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    await pause(REQUEST_DELAY_MS);
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: accept },
        signal: AbortSignal.timeout(30000)
      });
      if (response.status === 429) {
        const retryAfter = Number(response.headers.get('retry-after'));
        const cooldown = Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.max(60000, retryAfter * 1000)
          : Math.max(60000, attempt * 15000);
        console.warn(`Screener returned HTTP 429; retrying after ${cooldown / 1000}s: ${url}`);
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

async function searchCompany(name) {
  const url = `${SCREENER_ORIGIN}/api/company/search/?q=${encodeURIComponent(name)}`;
  const response = await fetchWithRetry(url, 'application/json');
  const results = await response.json();
  const key = normalizeName(name);
  const exact = results.filter(item => normalizeName(item.name) === key);
  if (exact.length !== 1) {
    return { url: '', error: exact.length > 1 ? `Ambiguous Screener matches for ${name}` : `No exact Screener match for ${name}` };
  }
  return { url: canonicalProfileUrl(exact[0].url), error: '' };
}

async function fetchAbout(url) {
  const response = await fetchWithRetry(url, 'text/html,application/xhtml+xml');
  const about = latestProfileAbout(await response.text());
  return { url, about, error: '' };
}

async function runPool(items, worker, concurrency) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next];
      next += 1;
      await worker(item);
    }
  }));
}

function findCompanyColumn(sheet, headers) {
  const exact = headers.findIndex(header => /^company$/i.test(header));
  if (exact >= 0) return exact + 1;
  throw new Error(`${sheet.name} is missing a Company column.`);
}

function findSourceUrl(sheet, rowNumber, headers, companyColumn) {
  const preferred = headers.findIndex(header => /^(screener company|screener link)$/i.test(header));
  if (preferred >= 0) {
    const url = canonicalProfileUrl(cellUrl(sheet.getRow(rowNumber).getCell(preferred + 1).value));
    if (url) return url;
  }
  const companyUrl = canonicalProfileUrl(cellUrl(sheet.getRow(rowNumber).getCell(companyColumn).value));
  if (companyUrl) return companyUrl;
  for (let column = 1; column <= sheet.columnCount; column += 1) {
    const url = canonicalProfileUrl(cellUrl(sheet.getRow(rowNumber).getCell(column).value));
    if (url) return url;
  }
  return '';
}

function styleColumn(sheet, columnNumber, referenceColumn, width) {
  const reference = sheet.getColumn(referenceColumn);
  const target = sheet.getColumn(columnNumber);
  target.width = width;
  if (reference.style) target.style = structuredClone(reference.style);
  const header = sheet.getRow(1).getCell(columnNumber);
  const existingHeader = sheet.getRow(1).getCell(referenceColumn);
  header.style = structuredClone(existingHeader.style);
  header.alignment = { vertical: 'middle', wrapText: true };
}

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(WORKBOOK_PATH);
  const profileCache = new Map();
  const nameToUrl = new Map();
  for (const path of PROFILE_CACHES) {
    const data = await readJsonIfAvailable(path);
    for (const [url, profile] of Object.entries(data)) {
      const canonical = canonicalProfileUrl(url);
      if (canonical && profile?.about) profileCache.set(canonical, { url: canonical, about: profile.about, error: '' });
    }
  }
  const cacheObject = await readJsonIfAvailable(CACHE_PATH);
  for (const [url, profile] of Object.entries(cacheObject)) {
    const canonical = canonicalProfileUrl(url);
    if (canonical) profileCache.set(canonical, profile);
  }

  for (const name of TARGET_SHEETS) {
    const sheet = workbook.getWorksheet(name);
    if (!sheet) throw new Error(`Missing requested sheet: ${name}`);
    const headers = sheet.getRow(1).values.slice(1).map(cellText);
    const companyColumn = findCompanyColumn(sheet, headers);
    const urlByRow = new Map();
    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      const companyName = cellText(row.getCell(companyColumn).value);
      const url = findSourceUrl(sheet, rowNumber, headers, companyColumn);
      if (url) {
        urlByRow.set(rowNumber, url);
        nameToUrl.set(normalizeName(companyName), url);
      }
    }

    const productsIndex = headers.findIndex(header => header === PRODUCTS_HEADER);
    const legacyAboutIndex = headers.findIndex(header => (
      /^(products \/ applications(?: \/ where used)?(?: \(screener about\))?|screener about|where used \(screener about\))$/i.test(header)
    ));
    let productsColumn = productsIndex >= 0 ? productsIndex + 1 : 0;
    let whereUsedColumn = headers.findIndex(header => header === WHERE_USED_HEADER) + 1;
    if (legacyAboutIndex >= 0 && legacyAboutIndex + 1 !== productsColumn) {
      productsColumn = legacyAboutIndex + 1;
    }
    if (!productsColumn) productsColumn = sheet.columnCount + 1;
    if (!whereUsedColumn) whereUsedColumn = Math.max(sheet.columnCount, productsColumn) + 1;

    sheet._legacyAboutColumn = legacyAboutIndex >= 0 ? legacyAboutIndex + 1 : productsColumn;
    sheet.getRow(1).getCell(productsColumn).value = PRODUCTS_HEADER;
    sheet.getRow(1).getCell(whereUsedColumn).value = WHERE_USED_HEADER;
    styleColumn(sheet, productsColumn, companyColumn, 72);
    styleColumn(sheet, whereUsedColumn, companyColumn, 60);
    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      row.getCell(productsColumn).alignment = { vertical: 'top', wrapText: true };
      row.getCell(whereUsedColumn).alignment = { vertical: 'top', wrapText: true };
    }
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: Math.max(sheet.columnCount, whereUsedColumn) }
    };
    console.log(`${name}: ${sheet.rowCount - 1} rows; Screener links ${urlByRow.size}.`);
  }

  const indmoneySheet = workbook.getWorksheet('INDmoney - Stocks under 20Rs');
  const indmoneyHeaders = indmoneySheet.getRow(1).values.slice(1).map(cellText);
  const indmoneyCompanyColumn = findCompanyColumn(indmoneySheet, indmoneyHeaders);
  const searchRows = [];
  for (let rowNumber = 2; rowNumber <= indmoneySheet.rowCount; rowNumber += 1) {
    const companyName = cellText(indmoneySheet.getRow(rowNumber).getCell(indmoneyCompanyColumn).value);
    const url = findSourceUrl(indmoneySheet, rowNumber, indmoneyHeaders, indmoneyCompanyColumn)
      || nameToUrl.get(normalizeName(companyName))
      || '';
    if (url) {
      nameToUrl.set(normalizeName(companyName), url);
      continue;
    }
    searchRows.push({ rowNumber, companyName });
  }
  console.log(`Looking up ${searchRows.length} INDmoney companies without a known Screener profile.`);
  let completedSearches = 0;
  await runPool(searchRows, async item => {
    try {
      const result = await searchCompany(item.companyName);
      if (result.url) {
        nameToUrl.set(normalizeName(item.companyName), result.url);
        item.url = result.url;
        if (profileCache.has(result.url)) item.about = profileCache.get(result.url).about;
      } else {
        item.error = result.error;
      }
    } catch (error) {
      item.error = String(error.message || error).slice(0, 300);
    }
    completedSearches += 1;
    if (completedSearches % 50 === 0 || completedSearches === searchRows.length) {
      console.log(`Screener company lookup ${completedSearches}/${searchRows.length}.`);
    }
  }, CONCURRENCY);

  const allRequiredUrls = new Set(nameToUrl.values());
  for (const name of TARGET_SHEETS) {
    const sheet = workbook.getWorksheet(name);
    const headers = sheet.getRow(1).values.slice(1).map(cellText);
    const companyColumn = findCompanyColumn(sheet, headers);
    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const companyName = cellText(sheet.getRow(rowNumber).getCell(companyColumn).value);
      const url = findSourceUrl(sheet, rowNumber, headers, companyColumn) || nameToUrl.get(normalizeName(companyName));
      if (url) allRequiredUrls.add(url);
    }
  }
  const pendingProfiles = [...allRequiredUrls].filter(url => !profileCache.get(url)?.about);
  console.log(`${allRequiredUrls.size} Screener profiles required; ${pendingProfiles.length} profile descriptions to fetch.`);
  let completedProfiles = 0;
  await runPool(pendingProfiles, async url => {
    try {
      profileCache.set(url, await fetchAbout(url));
    } catch (error) {
      profileCache.set(url, { url, about: '', error: String(error.message || error).slice(0, 300) });
    }
    completedProfiles += 1;
    if (completedProfiles % 25 === 0 || completedProfiles === pendingProfiles.length) {
      await fs.writeFile(CACHE_PATH, JSON.stringify(Object.fromEntries(profileCache)), 'utf8');
      console.log(`Screener profile fetch ${completedProfiles}/${pendingProfiles.length}; saved cache checkpoint.`);
    }
  }, CONCURRENCY);

  const failures = [...profileCache.values()].filter(profile => profile.error).length;
  const missingSearch = searchRows.filter(item => !item.url);
  const report = {};
  for (const name of TARGET_SHEETS) {
    const sheet = workbook.getWorksheet(name);
    const headers = sheet.getRow(1).values.slice(1).map(cellText);
    const companyColumn = findCompanyColumn(sheet, headers);
    const productsColumn = headers.indexOf(PRODUCTS_HEADER) + 1;
    const whereUsedColumn = headers.indexOf(WHERE_USED_HEADER) + 1;
    let descriptions = 0;
    let explicitUses = 0;
    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      const companyName = cellText(row.getCell(companyColumn).value);
      const url = findSourceUrl(sheet, rowNumber, headers, companyColumn) || nameToUrl.get(normalizeName(companyName));
      const existingAbout = cellText(row.getCell(sheet._legacyAboutColumn).value);
      const about = (url ? profileCache.get(url)?.about : '') || existingAbout;
      const where = explicitUsage(about);
      row.getCell(productsColumn).value = about;
      row.getCell(whereUsedColumn).value = where;
      if (about) descriptions += 1;
      if (where) explicitUses += 1;
    }
    report[name] = { rows: sheet.rowCount - 1, withProductsOrAbout: descriptions, withExplicitUsage: explicitUses };
  }

  const notes = workbook.getWorksheet('Read Me');
  if (notes) {
    const noteValues = [
      ['Products / Applications', 'Verbatim company About text from Screener is copied to this column; it describes the company business/products and applications where provided.'],
      ['Where Used', 'This column contains only explicit use/application sentences found in Screener About text. It is blank when Screener does not explicitly state a use; no use cases are inferred.'],
      ['Updated tabs', TARGET_SHEETS.join(', ')],
      ['About coverage', JSON.stringify(report)],
      ['Profile lookup', `${searchRows.length - missingSearch.length}/${searchRows.length} previously unlinked INDmoney companies matched to Screener by exact normalized company name; ${failures} profile requests failed.`]
    ];
    const noteStart = notes.rowCount + 1;
    for (const [label, value] of noteValues) {
      let existingRow;
      for (let rowNumber = 1; rowNumber <= notes.rowCount; rowNumber += 1) {
        if (cellText(notes.getRow(rowNumber).getCell(1).value) === label) {
          existingRow = notes.getRow(rowNumber);
          break;
        }
      }
      const row = existingRow || notes.addRow([]);
      row.getCell(1).value = label;
      row.getCell(2).value = value;
    }
    notes.getColumn(1).width = Math.max(notes.getColumn(1).width || 20, 28);
    notes.getColumn(2).width = Math.max(notes.getColumn(2).width || 20, 110);
    notes.eachRow((row, rowNumber) => {
      if (rowNumber >= noteStart || noteValues.some(([label]) => cellText(row.getCell(1).value) === label)) {
        row.height = 36;
        row.getCell(2).alignment = { vertical: 'top', wrapText: true };
      }
    });
  }

  const tempPath = `${WORKBOOK_PATH}.tmp`;
  try {
    await workbook.xlsx.writeFile(tempPath);
    await fs.rename(tempPath, WORKBOOK_PATH);
  } catch (error) {
    await fs.rm(tempPath, { force: true });
    throw error;
  }
  await fs.writeFile(CACHE_PATH, JSON.stringify(Object.fromEntries(profileCache)), 'utf8');
  console.log(JSON.stringify({ output: WORKBOOK_PATH, sheets: report, unresolvedINDmoney: missingSearch.length, profileFailures: failures }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
