const ExcelJS = require('exceljs');
const fs = require('node:fs/promises');

const BASE = 'https://www.screener.in';
const OUTPUT = 'Screener-under-10-Industries-Filtered.xlsx';
const CONCURRENCY = 1;

const clean = html => html.replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/\s+/g, ' ').trim();
const num = value => {
  const match = String(value ?? '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
};
const cells = html => [...html.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m => clean(m[1]));

async function get(url) {
  let error;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await new Promise(resolve => setTimeout(resolve, 900));
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ScreenerWorkbook/1.0)' },
        signal: AbortSignal.timeout(30000)
      });
      if (response.status === 429) {
        const retryAfter = Number(response.headers.get('retry-after'));
        const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : attempt * 5000;
        await new Promise(resolve => setTimeout(resolve, delay));
        throw new Error(`HTTP 429: ${url}`);
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
      return response.text();
    } catch (caught) {
      error = caught;
      if (!String(caught.message).includes('HTTP 429')) {
        await new Promise(resolve => setTimeout(resolve, attempt * 1200));
      }
    }
  }
  throw error;
}

async function parallel(items, task) {
  const output = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      output[index] = await task(items[index], index);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }));
  return output;
}

function parseIndustries(html) {
  const industries = [];
  for (const [, row] of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const link = row.match(/<a\s+href="([^"]+)"[^>]*class="font-weight-500"[^>]*>([\s\S]*?)<\/a>/i);
    if (!link || !link[1].startsWith('/market/')) continue;
    const values = cells(row);
    const count = Number(values[2]);
    if (Number.isFinite(count)) industries.push({ name: clean(link[2]), path: link[1], expected: count, industryPe: num(values[5]) });
  }
  return industries;
}

function parseCompanies(html) {
  const companies = [];
  for (const [, id, row] of html.matchAll(/<tr\b[^>]*data-row-company-id="([^"]+)"[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const link = row.match(/<a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    const values = cells(row);
    if (!link || values.length < 11) continue;
    companies.push({
      id, name: clean(link[2]), path: link[1], price: num(values[2]), pe: num(values[3]),
      marketCap: num(values[4]), dividendYield: num(values[5]), roce: num(values[10])
    });
  }
  return companies;
}

async function industryCompanies(industry) {
  const found = new Map();
  for (let page = 1; page <= Math.ceil(industry.expected / 50) + 2; page++) {
    const url = new URL(industry.path, BASE);
    if (page > 1) url.searchParams.set('page', page);
    const rows = parseCompanies(await get(url));
    if (!rows.length) break;
    rows.forEach(company => found.set(company.id, company));
    if (found.size >= industry.expected) break;
  }
  return [...found.values()];
}

function normalizeRatioName(name) {
  return String(name ?? '').toLowerCase().replace(/&/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
}

function ratioValue(values, candidates) {
  for (const candidate of candidates) {
    const key = normalizeRatioName(candidate);
    const value = values[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function ratios(html) {
  const values = {};
  const list = html.match(/<ul\s+id="top-ratios"[^>]*>([\s\S]*?)<\/ul>/i)?.[1] || '';
  for (const [, item] of list.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
    const rawName = clean(item.match(/<span\s+class="name"[^>]*>([\s\S]*?)<\/span>/i)?.[1] || '');
    const name = normalizeRatioName(rawName);
    const value = clean(item.match(/<span\s+class="nowrap value"[^>]*>([\s\S]*?)<\/span>/i)?.[1] || '');
    if (name) values[name] = value;
  }
  return values;
}

function shareholding(html, name) {
  const rows = html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) || [];
  const row = rows.find(item => clean(item).startsWith(name));
  return row ? cells(row).slice(1).map(num).filter(value => value !== null).at(-1) ?? null : null;
}

function growth(html, period) {
  const table = (html.match(/<table\b[^>]*class="ranges-table"[^>]*>[\s\S]*?<\/table>/gi) || [])
    .find(item => item.includes('Compounded Profit Growth'));
  if (!table) return null;
  for (const [, row] of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const rowCells = cells(row);
    if (rowCells[0]?.replace(/:$/, '').trim() === period) return num(rowCells[1]);
  }
  return null;
}

function latestFinancial(html, label) {
  const section = html.match(/<section\s+id="profit-loss"[^>]*>([\s\S]*?)(?=<section\s+id=|$)/i)?.[1] || '';
  const rows = [...section.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  const row = rows.find(([, item]) => cells(item)[0]?.toLowerCase() === label.toLowerCase());
  return row ? cells(row[1]).slice(1).map(num).filter(value => value !== null).at(-1) ?? null : null;
}

function about(html) {
  const description = html.match(/<div[^>]*class="[^"]*company-profile[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1]
    || html.match(/<section[^>]*id="about"[^>]*>([\s\S]*?)<\/section>/i)?.[1]
    || '';
  return clean(description).slice(0, 600);
}

async function profile(company, industryPe) {
  const url = new URL(company.path, BASE);
  const html = await get(url);
  const r = ratios(html);
  const getRatio = name => num(r[normalizeRatioName(name)] || '');
  const price = getRatio('current price') ?? company.price;
  const bookValue = getRatio('book value');
  const pe = getRatio('stock p/e') ?? company.pe;
  const priceToBook = price !== null && bookValue ? price / bookValue : null;
  const promoter = shareholding(html, 'Promoters');
  const pledged = num(ratioValue(r, ['pledged percentage', 'pledged percentage %', 'pledged %', 'pledged']) || '') ?? null;
  const debtToEquity = num(ratioValue(r, ['debt to equity', 'debt / equity', 'debt equity', 'debt to equity ratio', 'debt/equity']) || '') ?? null;
  return {
    ...company, url: url.href, price, marketCap: getRatio('market cap') ?? company.marketCap,
    highLow: r[normalizeRatioName('high / low')] || '', pe, bookValue, dividendYield: getRatio('dividend yield') ?? company.dividendYield,
    roce: getRatio('roce') ?? company.roce, roe: getRatio('roe'), faceValue: getRatio('face value'),
    promoter, public: shareholding(html, 'Public'), pledged, debtToEquity,
    profitGrowth: growth(html, 'TTM'), profitGrowth3Yrs: growth(html, '3 Years'),
    currentTax: latestFinancial(html, 'Tax'), sales: latestFinancial(html, 'Sales'),
    priceToBook, fii: shareholding(html, 'FIIs'), dii: shareholding(html, 'DIIs'),
    pbXPe: priceToBook !== null && pe !== null ? priceToBook * pe : null,
    industryPe, products: about(html), keyCustomers: '', infrastructure: ''
  };
}

function sheetName(name, used) {
  const base = name.replace(/[\\/?*\[\]:]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31) || 'Industry';
  let value = base;
  let suffix = 2;
  while (used.has(value.toLowerCase())) {
    const tail = ` ${suffix++}`;
    value = `${base.slice(0, 31 - tail.length)}${tail}`;
  }
  used.add(value.toLowerCase());
  return value;
}

function styleHeader(sheet, headers) {
  sheet.addRow(headers);
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
  sheet.getRow(1).alignment = { wrapText: true, vertical: 'middle' };
  sheet.getRow(1).height = 32;
}

function classifyStock(stock) {
  const promoter = Number(stock.promoter ?? 0);
  const debtToEquity = Number(stock.debtToEquity ?? Number.POSITIVE_INFINITY);
  const roce = Number(stock.roce ?? Number.NEGATIVE_INFINITY);
  const roe = Number(stock.roe ?? Number.NEGATIVE_INFINITY);
  const growth = Number(stock.profitGrowth ?? Number.NEGATIVE_INFINITY);
  const growth3Yrs = Number(stock.profitGrowth3Yrs ?? Number.NEGATIVE_INFINITY);

  if (promoter >= 60 && debtToEquity < 0.3 && (roe >= 10 || roce >= 12)) return 'Anchor';
  if ((growth > 15 || growth3Yrs > 15 || (stock.price !== null && stock.price < 5))
    && promoter > 50 && debtToEquity < 0.5) return 'Rocket';
  return null;
}

function applyCategoryColor(row, category) {
  if (!category) return;
  const fill = category === 'Anchor'
    ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB7E1CD' } }
    : { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE7A3' } };
  row.fill = fill;
}

async function main() {
  console.log('Reading Screener Industries Overview...');
  const industries = parseIndustries(await get(`${BASE}/market/`));
  if (!industries.length) throw new Error('No industries found; Screener may have changed its page markup.');
  console.log(`Found ${industries.length} industries; loading constituent lists...`);
  const data = await parallel(industries, async industry => {
    const companies = await industryCompanies(industry);
    return { ...industry, companies, matches: companies.filter(c => c.price !== null && c.price > 0 && c.price < 10) };
  });
  const matches = new Map();
  for (const industry of data) for (const company of industry.matches) {
    if (!matches.has(company.id)) matches.set(company.id, { company, industryPe: industry.industryPe });
  }
  console.log(`Found ${matches.size} unique stocks under ₹10; loading profiles...`);
  const entries = [...matches.entries()];
  const loaded = await parallel(entries, async ([id, item], index) => {
    try {
      const result = await profile(item.company, item.industryPe);
      if ((index + 1) % 20 === 0) console.log(`Profiles loaded: ${index + 1}/${entries.length}`);
      return [id, result];
    } catch (error) {
      console.warn(`Profile unavailable for ${item.company.name}: ${error.message}`);
      return [id, { ...item.company, url: new URL(item.company.path, BASE).href, industryPe: item.industryPe }];
    }
  });
  const qualifies = stock => {
    const price = stock.price ?? null;
    const promoter = stock.promoter ?? null;
    const pledged = stock.pledged ?? null;
    const debtToEquity = stock.debtToEquity ?? null;
    return price !== null && price > 0 && price < 10
      && promoter !== null && promoter > 50
      && pledged !== null && pledged === 0
      && debtToEquity !== null && debtToEquity < 0.5;
  };
  const byId = new Map(loaded.filter(([, stock]) => qualifies(stock)));
  for (const industry of data) {
    industry.matches = industry.matches.filter(company => qualifies(byId.get(company.id) || company));
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Screener.in data export';
  workbook.created = new Date();
  const headers = [
    'Category', 'Company', 'Screener Link', 'Current Price (₹)', 'Market Cap (₹ Cr)', 'High / Low (₹)', 'Stock P/E',
    'Book Value (₹)', 'Dividend Yield (%)', 'ROCE (%)', 'ROE (%)', 'Face Value (₹)', 'Promoter Holding (%)',
    'Public Holding (%)', 'Profit Growth TTM (%)', 'Pledged Percentage (%)', 'Debt to Equity', 'Current Tax (₹ Cr)',
    'Price to Book', 'FII Holding (%)', 'DII Holding (%)', 'PB × PE', 'Industry Median P/E',
    'Sales Last Year (₹ Cr)', 'Profit Growth 3Yrs (%)', 'Products / Services', 'Key Customers', 'Infrastructure'
  ];
  const used = new Set();
  const overview = workbook.addWorksheet('Overview');
  const overviewHeaders = ['Industry', 'Overview Company Count', 'Companies Retrieved', 'Count Check', 'Qualified Stocks', 'Screener Industry Page'];
  styleHeader(overview, overviewHeaders);
  for (const industry of data) {
    overview.addRow([
      industry.name, industry.expected, industry.companies.length,
      industry.expected === industry.companies.length ? 'OK' : 'MISMATCH', industry.matches.length,
      new URL(industry.path, BASE).href
    ]);
    const sheet = workbook.addWorksheet(sheetName(industry.name, used));
    styleHeader(sheet, headers);
    for (const company of industry.matches) {
      const stock = byId.get(company.id) || company;
      const category = classifyStock(stock);
      const row = sheet.addRow([
        category || '', stock.name, stock.url || new URL(stock.path, BASE).href, stock.price ?? null, stock.marketCap ?? null,
        stock.highLow || '', stock.pe ?? null, stock.bookValue ?? null, stock.dividendYield ?? null,
        stock.roce ?? null, stock.roe ?? null, stock.faceValue ?? null, stock.promoter ?? null,
        stock.public ?? null, stock.profitGrowth ?? null, stock.pledged ?? null, stock.debtToEquity ?? null,
        stock.currentTax ?? null, stock.priceToBook ?? null, stock.fii ?? null, stock.dii ?? null,
        stock.pbXPe ?? null, stock.industryPe ?? null, stock.sales ?? null, stock.profitGrowth3Yrs ?? null,
        stock.products || '', stock.keyCustomers || '', stock.infrastructure || ''
      ]);
      applyCategoryColor(row, category);
    }
    sheet.columns = headers.map((_, index) => ({ width: index === 0 ? 18 : index === 2 ? 38 : index < 3 ? 28 : 18 }));
  }
  overview.columns = [{ width: 48 }, { width: 24 }, { width: 20 }, { width: 16 }, { width: 18 }, { width: 55 }];
  const notes = workbook.addWorksheet('Notes');
  notes.addRows([
    ['Source', `${BASE}/market/`], ['Retrieved', new Date().toISOString()],
    ['Price filter', 'Current Screener price greater than ₹0 and below ₹10.'],
    ['Selection rules', 'Only companies with promoter holding > 50%, pledged percentage = 0, and debt-to-equity < 0.5 are included.'],
    ['Validation', 'Overview compares the overview count to companies returned by its industry page. MISMATCH means Screener pages disagree; constituents are retained.'],
    ['Empty tabs', 'Every overview industry has a worksheet. A header-only worksheet means no stock met all filters.'],
    ['Blank fields', 'Screener did not expose the information publicly or in the profile page; values are not estimated.'],
    ['Business information', 'Products / Services is populated only when a company description is exposed. Key Customers and Infrastructure are left blank when unavailable.'],
    ['Use', 'Point-in-time public market data; not investment advice.']
  ]);
  notes.getColumn(1).width = 24;
  notes.getColumn(2).width = 110;
  notes.getColumn(2).alignment = { wrapText: true, vertical: 'top' };
  await workbook.xlsx.writeFile(OUTPUT);
  const mismatches = data.filter(item => item.expected !== item.companies.length);
  console.log(`Saved ${OUTPUT}; ${data.length} industries; ${matches.size} unique under-₹10 stocks; ${mismatches.length} count mismatches.`);
  mismatches.forEach(item => console.log(`COUNT MISMATCH: ${item.name}: overview=${item.expected}, page=${item.companies.length}`));
}

async function createOfflineTemplate(snapshotPath) {
  const snapshot = await fs.readFile(snapshotPath, 'utf8');
  const lines = snapshot.split(/\r?\n/);
  const industries = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].trim().startsWith('- row ')) continue;
    const block = [];
    for (let rowIndex = index + 1; rowIndex < lines.length && !lines[rowIndex].trim().startsWith('- row '); rowIndex += 1) {
      block.push(lines[rowIndex].trim());
    }
    const values = block.filter(line => line.startsWith('- cell ')).map(line => {
      return line.match(/^- cell "([^"]*)"/)?.[1] || '';
    });
    const serial = Number(values[0]?.replace(/\.$/, ''));
    const expected = Number(values[2]);
    if (!Number.isInteger(serial) || !values[1] || !Number.isFinite(expected)) continue;
    const pathLine = block.find(line => line.startsWith('- /url: /market/'));
    industries.push({ name: values[1], expected, path: pathLine ? pathLine.slice(pathLine.indexOf('/market/')) : '' });
  }
  if (!industries.length) throw new Error('The saved industry snapshot did not contain readable industry rows.');

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Screener.in data export';
  workbook.created = new Date();
  const headers = [
    'Company', 'Screener Link', 'Current Price (₹)', 'Market Cap (₹ Cr)', 'High / Low (₹)', 'Stock P/E',
    'Book Value (₹)', 'Dividend Yield (%)', 'ROCE (%)', 'ROE (%)', 'Face Value (₹)', 'Promoter Holding (%)',
    'Public Holding (%)', 'Profit Growth TTM (%)', 'Pledged Percentage (%)', 'Current Tax (₹ Cr)',
    'Price to Book', 'FII Holding (%)', 'DII Holding (%)', 'PB × PE', 'Industry Median P/E',
    'Sales Last Year (₹ Cr)', 'Profit Growth 3Yrs (%)', 'Products / Services', 'Key Customers', 'Infrastructure'
  ];
  const overview = workbook.addWorksheet('Overview');
  const overviewHeaders = ['Industry', 'Overview Company Count', 'Companies Retrieved', 'Data Status', 'Stocks Under ₹10', 'Screener Industry Page'];
  styleHeader(overview, overviewHeaders);
  const used = new Set();
  for (const industry of industries) {
    overview.addRow([industry.name, industry.expected, null, 'NOT VERIFIED: Screener unavailable', null, industry.path ? new URL(industry.path, BASE).href : '']);
    const sheet = workbook.addWorksheet(sheetName(industry.name, used));
    styleHeader(sheet, headers);
    sheet.columns = headers.map((_, column) => ({ width: column === 23 ? 48 : column === 1 ? 38 : column < 2 ? 28 : 18 }));
  }
  overview.columns = [{ width: 48 }, { width: 24 }, { width: 20 }, { width: 38 }, { width: 18 }, { width: 55 }];
  const notes = workbook.addWorksheet('Notes');
  notes.addRows([
    ['Status', 'Template created from the saved Screener Industries Overview snapshot. Stock constituent pages could not be retrieved because Screener timed out / returned HTTP 429.'],
    ['Retrieved', new Date().toISOString()],
    ['Industry rows', `${industries.length} industries; overview company counts are from the saved page snapshot.`],
    ['Important', 'Blank sector tabs mean stock data was not verified. They do not mean that no under-₹10 stocks exist.'],
    ['Price filter', 'Intended filter is Screener current price greater than ₹0 and below ₹10.'],
    ['Fields', 'Requested ratios and Products / Services, Key Customers, Infrastructure columns are present. Values remain blank until live stock pages are available.']
  ]);
  notes.getColumn(1).width = 24;
  notes.getColumn(2).width = 110;
  notes.getColumn(2).alignment = { wrapText: true, vertical: 'top' };
  await workbook.xlsx.writeFile(OUTPUT);
  console.log(`Saved ${OUTPUT} with ${industries.length} industry tabs. Stock data is explicitly marked not verified.`);
}

const snapshotPath = process.argv[2];
(snapshotPath ? createOfflineTemplate(snapshotPath) : main()).catch(error => {
  console.error(error);
  process.exitCode = 1;
});