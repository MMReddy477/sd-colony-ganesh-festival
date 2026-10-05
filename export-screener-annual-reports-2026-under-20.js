const http = require('node:http');
const { gunzipSync } = require('node:zlib');
const ExcelJS = require('exceljs');

const OUTPUT = 'Screener-Annual-Reports-Under-20-2026.xlsx';
const ORIGIN = 'https://www.screener.in';
const PORT = Number(process.env.EXPORT_PORT || 4179);
const IMPORT_TOKEN = 'screener-annual-report-export-local';
const OUTLOOKS = ['Very Pessimistic', 'Pessimistic', 'Neutral', 'Optimistic', 'Very Optimistic'];
const COLORS = {
  'Very Pessimistic': 'FFF4CCCC',
  Pessimistic: 'FFFCE4D6',
  Neutral: 'FFE7E6E6',
  Optimistic: 'FFDDEBF7',
  'Very Optimistic': 'FFE2F0D9',
  'Not Classified': 'FFF2F2F2'
};
const optimismUrl = {
  All: `${ORIGIN}/annual-reports/?create_date__year=2026`,
  'Very Pessimistic': `${ORIGIN}/annual-reports/?create_date__year=2026&optimism=very_pessimistic`,
  Pessimistic: `${ORIGIN}/annual-reports/?create_date__year=2026&optimism=pessimistic`,
  Neutral: `${ORIGIN}/annual-reports/?create_date__year=2026&optimism=neutral`,
  Optimistic: `${ORIGIN}/annual-reports/?create_date__year=2026&optimism=optimistic`,
  'Very Optimistic': `${ORIGIN}/annual-reports/?create_date__year=2026&optimism=very_optimistic`
};

function addHeader(sheet, headers) {
  sheet.addRow(headers);
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF174A3A' } };
  header.alignment = { vertical: 'middle', wrapText: true };
  header.height = 32;
}

function sourceLink(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

async function createWorkbook(payload) {
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  if (payload.pagesRead !== payload.expectedPages || payload.totalCards !== payload.expectedResults) {
    throw new Error(`Incomplete Screener coverage: pages ${payload.pagesRead}/${payload.expectedPages}, cards ${payload.totalCards}/${payload.expectedResults}.`);
  }
  const validRows = rows.filter(row => Number.isFinite(Number(row.price)) && Number(row.price) > 0 && Number(row.price) < 20);
  if (!validRows.length) throw new Error('No under-₹20 rows were received.');

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Screener.in annual reports export';
  workbook.created = new Date();
  workbook.subject = 'Screener annual reports for 2026 with share price below ₹20';

  const sheet = workbook.addWorksheet('Under ₹20');
  const headers = [
    'Company', 'Price (₹)', 'Outlook', 'Market Cap (₹ Cr)', 'P/E', 'Sales (₹ Cr)', 'Sales Change',
    'Profit (₹ Cr)', 'Profit Change', 'ROCE (%)', 'ROCE Change', 'Debt (₹ Cr)', 'Debt Change',
    'Report Year', 'Annual Report PDF', 'Screener Company', 'Screener Highlights'
  ];
  addHeader(sheet, headers);
  for (const item of validRows) {
    const outlook = OUTLOOKS.includes(item.outlook) ? item.outlook : 'Not Classified';
    const outlookLink = OUTLOOKS.includes(outlook) ? optimismUrl[outlook] : optimismUrl.All;
    const row = sheet.addRow([
      item.company || '', Number(item.price), { text: outlook, hyperlink: outlookLink }, item.marketCap ?? null, item.pe ?? null,
      item.sales ?? null, item.salesChange || '', item.profit ?? null, item.profitChange || '',
      item.roce ?? null, item.roceChange || '', item.debt ?? null, item.debtChange || '',
      item.reportYear || 2026,
      sourceLink(item.reportUrl) ? { text: 'Open PDF', hyperlink: sourceLink(item.reportUrl) } : 'Link missing',
      sourceLink(item.companyUrl) ? { text: 'Open Screener', hyperlink: sourceLink(item.companyUrl) } : 'Link missing',
      (item.highlights || []).join('\n')
    ]);
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS[outlook] } };
    row.alignment = { vertical: 'top', wrapText: true };
    row.getCell(2).numFmt = '0.00';
    row.getCell(4).numFmt = '#,##0.00';
    row.getCell(5).numFmt = '0.00';
    row.getCell(6).numFmt = '#,##0.00';
    row.getCell(8).numFmt = '#,##0.00';
    row.getCell(10).numFmt = '0.00';
    row.getCell(12).numFmt = '#,##0.00';
    row.height = Math.min(90, Math.max(30, 18 * Math.max(1, (item.highlights || []).length)));
  }
  sheet.columns = [
    { width: 28 }, { width: 14 }, { width: 20 }, { width: 20 }, { width: 12 }, { width: 16 },
    { width: 15 }, { width: 16 }, { width: 15 }, { width: 14 }, { width: 15 }, { width: 16 },
    { width: 15 }, { width: 14 }, { width: 18 }, { width: 20 }, { width: 82 }
  ];

  const counts = Object.fromEntries(OUTLOOKS.map(value => [value, 0]));
  let unclassified = 0;
  for (const item of validRows) {
    if (OUTLOOKS.includes(item.outlook)) counts[item.outlook] += 1;
    else unclassified += 1;
  }
  const summary = workbook.addWorksheet('Outlook Summary');
  addHeader(summary, ['Outlook Filter', 'Under-₹20 Reports', 'Color Key']);
  summary.addRow([{ text: 'All', hyperlink: optimismUrl.All }, validRows.length, 'All included rows']);
  for (const label of OUTLOOKS) {
    const row = summary.addRow([{ text: label, hyperlink: optimismUrl[label] }, counts[label], 'Matches row color on Under ₹20']);
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS[label] } };
  }
  summary.addRow(['Not Classified', unclassified, 'No outlook label shown on Screener']);
  summary.columns = [{ width: 24 }, { width: 24 }, { width: 48 }];

  const notes = workbook.addWorksheet('Read Me');
  notes.addRows([
    ['Source: 2026 reports', `${ORIGIN}/annual-reports/?create_date__year=2026`],
    ['All reports index', `${ORIGIN}/annual-reports/`],
    ['Retrieved', new Date().toISOString()],
    ['Listing coverage', `${payload.pagesRead}/${payload.expectedPages} pages; ${payload.totalCards}/${payload.expectedResults} report cards.`],
    ['Price rule', 'Current price shown on Screener is greater than ₹0 and strictly below ₹20.'],
    ['Missing prices', `${payload.missingPrice ?? 'Unknown'} cards had no numeric price and were excluded from the under-₹20 selection; no prices were estimated.`],
    ['Outlook', 'Outlook labels and highlights are copied from the Screener annual-report listing; they are not investment recommendations.'],
    ['Report-link check', 'Every row has the PDF link listed on Screener; the PDF file contents were not independently audited.'],
    ['Unclassified', 'A blank or unavailable Screener outlook is shown as Not Classified.'],
    ['Use', 'Point-in-time public data. Informational only, not investment advice.']
  ]);
  notes.getColumn(1).width = 28;
  notes.getColumn(2).width = 110;
  notes.getColumn(2).alignment = { vertical: 'top', wrapText: true };
  notes.eachRow(row => { row.height = 30; });

  await workbook.xlsx.writeFile(OUTPUT);
  return { output: OUTPUT, rows: validRows.length, counts, unclassified, pagesRead: payload.pagesRead, totalCards: payload.totalCards };
}

const server = http.createServer({ maxHeaderSize: 16 * 1024 * 1024 }, async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  if (request.method !== 'GET' || url.pathname !== '/import' || url.searchParams.get('token') !== IMPORT_TOKEN) {
    response.writeHead(403, { 'Content-Type': 'text/plain' });
    response.end('Export request rejected.');
    return;
  }
  try {
    const compressed = Buffer.from(url.searchParams.get('payload') || '', 'base64');
    if (!compressed.length || compressed.length > 8_000_000) throw new Error('Missing or oversized export payload.');
    const payload = JSON.parse(gunzipSync(compressed).toString('utf8'));
    const result = await createWorkbook(payload);
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(`<title>Excel export complete</title><h1>Excel export complete</h1><p>${result.rows} under-₹20 reports saved to ${result.output}.</p><p>Validated coverage: ${result.totalCards}/${payload.expectedResults} cards across ${result.pagesRead}/${payload.expectedPages} pages.</p>`);
    console.log(`Saved ${result.output}: ${result.rows} rows; ${result.totalCards} cards verified across ${result.pagesRead} pages.`);
    server.close();
  } catch (error) {
    response.writeHead(400, { 'Content-Type': 'text/plain' });
    response.end(error.message);
    console.error(error);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Waiting for Screener export at http://127.0.0.1:${PORT}/import (local token: ${IMPORT_TOKEN})`);
});