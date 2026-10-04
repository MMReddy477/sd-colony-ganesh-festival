const ExcelJS = require('exceljs');
const path = require('path');

const source = 'Screener-under-10-Industries.xlsx';
const output = 'Final-All-Under-10-Review.xlsx';
const rowColors = ['FFB7E1CD', 'FFBFE6FF', 'FFFFE7A3', 'FFD9D2E5', 'FFD8F0C8'];

function formatNumber(value) {
  if (value === null || value === undefined || value === '') return '';
  const num = Number(value);
  return Number.isFinite(num) ? num.toFixed(2) : String(value);
}

function parseNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const match = String(value).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const num = Number(match[0]);
  return Number.isFinite(num) ? num : null;
}

function parseRowValues(sheet, rowNumber) {
  const headerRow = sheet.getRow(1).values.slice(1);
  const row = sheet.getRow(rowNumber);
  const out = {};
  for (let index = 0; index < headerRow.length; index += 1) {
    const key = String(headerRow[index] ?? '').trim();
    if (!key) continue;
    out[key] = row.getCell(index + 1).value;
  }
  return out;
}

function styleHeader(row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
  row.alignment = { vertical: 'middle', horizontal: 'center' };
}

function matchesBaseFilter(raw) {
  const price = parseNumber(raw['Current Price (₹)'] ?? raw['Current Price']);
  const promoter = parseNumber(raw['Promoter Holding (%)'] ?? raw['Promoter Holding']);
  const roe = parseNumber(raw['ROE (%)'] ?? raw['ROE']);
  const roce = parseNumber(raw['ROCE (%)'] ?? raw['ROCE']);

  return price !== null && price > 0 && price < 10
    && promoter !== null && promoter > 50
    && roe !== null && roe > 15
    && roce !== null && roce > 18;
}

function normalizeLabel(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function extractRatios(html) {
  const section = html.match(/<ul\s+id="top-ratios"[^>]*>([\s\S]*?)<\/ul>/i)?.[1] || '';
  const ratios = {};
  for (const [, item] of section.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
    const label = item.match(/<span\s+class="name"[^>]*>([\s\S]*?)<\/span>/i)?.[1]
      .replace(/<[^>]+>/g, '').trim();
    const value = item.match(/<span\s+class="nowrap value"[^>]*>([\s\S]*?)<\/span>/i)?.[1]
      .replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
    if (label) ratios[normalizeLabel(label)] = value;
  }
  return ratios;
}

function latestBalanceSheetValue(section, label) {
  const rows = [...section.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  const row = rows.map(([, html]) => [...html.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)]
    .map(([, cell]) => cell.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()))
    .find(cells => normalizeLabel(cells[0]?.replace(/\s*\+$/, '')) === normalizeLabel(label));
  const values = row?.slice(1).map(parseNumber).filter(value => value !== null) || [];
  return values.at(-1) ?? null;
}

async function fetchCompanyMetrics(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ScreenerWorkbook/1.0)' },
    signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) throw new Error(`Screener returned HTTP ${response.status} for ${url}`);
  const html = await response.text();
  const ratios = extractRatios(html);
  const balanceSheet = html.match(/<section\s+id="balance-sheet"[^>]*>([\s\S]*?)(?=<section\s+id=|$)/i)?.[1] || '';
  const equityCapital = latestBalanceSheetValue(balanceSheet, 'Equity Capital');
  const reserves = latestBalanceSheetValue(balanceSheet, 'Reserves');
  const borrowings = latestBalanceSheetValue(balanceSheet, 'Borrowings');
  const equity = equityCapital !== null && reserves !== null ? equityCapital + reserves : null;

  return {
    price: parseNumber(ratios['current price']),
    roe: parseNumber(ratios.roe),
    roce: parseNumber(ratios.roce),
    pledged: parseNumber(ratios['pledged percentage']),
    debtToEquity: borrowings !== null && equity !== null && equity > 0 ? borrowings / equity : null
  };
}

function addStockSheet(workbook, title, entries, emptyMessage = '') {
  const sheet = workbook.addWorksheet(title);
  const headers = ['Sector', 'Company', 'Price ₹', 'Market Cap ₹ Cr', 'Promoter %', 'Public %', 'ROCE %', 'ROE %', 'Pledged %', 'Debt/Equity', 'TTM Growth %', '3Y Growth %', 'Screener Link'];
  styleHeader(sheet.addRow(headers));
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };

  if (entries.length === 0 && emptyMessage) {
    sheet.mergeCells('A2:M2');
    sheet.getCell('A2').value = emptyMessage;
    sheet.getCell('A2').alignment = { wrapText: true, vertical: 'middle' };
    sheet.getCell('A2').font = { bold: true };
    sheet.getRow(2).height = 32;
  }

  for (const [index, item] of entries.entries()) {
    const row = sheet.addRow([
      item.sector, item.company, item.price, item.marketCap, item.promoter, item.public,
      item.roce, item.roe, item.pledged, item.debt, item.ttmGrowth, item.threeYGrowth, item.link
    ]);
    const fillColor = rowColors[(index + 2) % rowColors.length];
    row.eachCell({ includeEmpty: true }, cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
    });
    if (!item.link) continue;
    const companyCell = row.getCell(2);
    companyCell.value = { text: String(item.company), hyperlink: item.link, tooltip: item.link };
    companyCell.font = { color: { argb: 'FF0000FF' }, underline: true };
    const linkCell = row.getCell(13);
    linkCell.value = { text: item.link, hyperlink: item.link, tooltip: item.link };
    linkCell.font = { color: { argb: 'FF0000FF' }, underline: true };
  }

  sheet.columns = [
    { width: 18 }, { width: 28 }, { width: 12 }, { width: 16 }, { width: 12 },
    { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 14 },
    { width: 14 }, { width: 14 }, { width: 30 }
  ];
}

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path.join(__dirname, source));
  const allStocks = [];
  const filteredStocks = [];

  for (const ws of workbook.worksheets.slice(1)) {
    if (ws.rowCount <= 1) continue;
    for (let r = 2; r <= ws.rowCount; r += 1) {
      const raw = parseRowValues(ws, r);
      const company = raw['Company'] || raw['Company Name'];
      if (!company) continue;
      const link = raw['Screener Link'] || raw['Screener URL'] || raw['Link'] || '';
      const price = parseNumber(raw['Current Price (₹)'] ?? raw['Current Price']);
      if (price !== null && price > 0 && price < 10) {
        allStocks.push({
          sector: ws.name,
          company,
          price: formatNumber(price),
          marketCap: formatNumber(raw['Market Cap (₹ Cr)'] ?? raw['Market Cap']),
          promoter: formatNumber(raw['Promoter Holding (%)'] ?? raw['Promoter Holding']),
          public: formatNumber(raw['Public Holding (%)'] ?? raw['Public Holding']),
          roce: formatNumber(raw['ROCE (%)'] ?? raw['ROCE']),
          roe: formatNumber(raw['ROE (%)'] ?? raw['ROE']),
          pledged: formatNumber(raw['Pledged Percentage (%)'] ?? raw['Pledged Percentage']),
          debt: formatNumber(raw['Debt to Equity'] ?? raw['Debt to Equity Ratio'] ?? raw['Debt/Equity']),
          ttmGrowth: formatNumber(raw['Profit Growth TTM (%)'] ?? raw['Profit Growth TTM']),
          threeYGrowth: formatNumber(raw['Profit Growth 3Yrs (%)'] ?? raw['Profit Growth 3Yrs']),
          link: String(link)
        });
      }

      if (!matchesBaseFilter(raw)) continue;
      if (!link) continue;
      await new Promise(resolve => setTimeout(resolve, 900));
      const live = await fetchCompanyMetrics(String(link));
      if (live.price === null || live.roe === null || live.roce === null || live.pledged === null || live.debtToEquity === null) {
        console.warn(`Skipped ${company}: Screener did not expose all live query metrics.`);
        continue;
      }
      if (!(live.price > 0 && live.price < 10 && live.debtToEquity < 1 && live.pledged < 0
        && live.roe > 15 && live.roce > 18)) continue;
      filteredStocks.push({
        sector: ws.name,
        company,
        price: formatNumber(live.price),
        marketCap: formatNumber(raw['Market Cap (₹ Cr)'] ?? raw['Market Cap']),
        promoter: formatNumber(raw['Promoter Holding (%)'] ?? raw['Promoter Holding']),
        public: formatNumber(raw['Public Holding (%)'] ?? raw['Public Holding']),
        roce: formatNumber(live.roce),
        roe: formatNumber(live.roe),
        pledged: formatNumber(live.pledged),
        debt: formatNumber(live.debtToEquity),
        ttmGrowth: formatNumber(raw['Profit Growth TTM (%)'] ?? raw['Profit Growth TTM']),
        threeYGrowth: formatNumber(raw['Profit Growth 3Yrs (%)'] ?? raw['Profit Growth 3Yrs']),
        link: String(link)
      });
    }
  }
  const finalWorkbook = new ExcelJS.Workbook();
  addStockSheet(finalWorkbook, 'All Stocks', allStocks);
  addStockSheet(finalWorkbook, 'Stocks under 10Rs', filteredStocks,
    'No verified stocks matched. Pledged percentage < 0 is not a valid no-pledge filter; use 0% for no pledged shares.');

  await finalWorkbook.xlsx.writeFile(path.join(__dirname, output));
  console.log(`Saved ${output} with ${allStocks.length} All Stocks rows and ${filteredStocks.length} query matches.`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
