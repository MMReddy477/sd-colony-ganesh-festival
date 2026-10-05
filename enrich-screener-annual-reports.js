const http = require('node:http');
const { gunzipSync } = require('node:zlib');
const ExcelJS = require('exceljs');

const WORKBOOK_PATH = 'Screener-Annual-Reports-Under-20-2026.xlsx';
const ORIGIN = 'https://www.screener.in';
const PORT = Number(process.env.EXPORT_PORT || 4180);
const TOKEN = 'screener-profile-enrichment-local';
const cachedProfiles = new Map();
let expectedProfileLinks = new Set();
const OUTLOOKS = ['Very Pessimistic', 'Pessimistic', 'Neutral', 'Optimistic', 'Very Optimistic'];
const OUTLOOK_URLS = {
  All: `${ORIGIN}/annual-reports/?create_date__year=2026`,
  'Very Pessimistic': `${ORIGIN}/annual-reports/?create_date__year=2026&optimism=very_pessimistic`,
  Pessimistic: `${ORIGIN}/annual-reports/?create_date__year=2026&optimism=pessimistic`,
  Neutral: `${ORIGIN}/annual-reports/?create_date__year=2026&optimism=neutral`,
  Optimistic: `${ORIGIN}/annual-reports/?create_date__year=2026&optimism=optimistic`,
  'Very Optimistic': `${ORIGIN}/annual-reports/?create_date__year=2026&optimism=very_optimistic`
};
const COLORS = {
  'Very Pessimistic': 'FFF4CCCC',
  Pessimistic: 'FFFCE4D6',
  Neutral: 'FFE7E6E6',
  Optimistic: 'FFDDEBF7',
  'Very Optimistic': 'FFE2F0D9',
  'Not Classified': 'FFF2F2F2'
};

function setHeader(sheet, headers) {
  sheet.addRow(headers);
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
  const row = sheet.getRow(1);
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF174A3A' } };
  row.alignment = { vertical: 'middle', wrapText: true };
  row.height = 34;
}

function hyperlink(value) {
  return value && typeof value === 'object' ? value.hyperlink : '';
}

function valuesFrom(sheet) {
  const records = [];
  for (let index = 2; index <= sheet.rowCount; index += 1) {
    const row = sheet.getRow(index);
    records.push({
      name: row.getCell(1).value,
      price: row.getCell(2).value,
      outlook: row.getCell(3).value,
      marketCap: row.getCell(4).value,
      pe: row.getCell(5).value,
      sales: row.getCell(6).value,
      salesChange: row.getCell(7).value,
      profit: row.getCell(8).value,
      profitChange: row.getCell(9).value,
      roce: row.getCell(10).value,
      roceChange: row.getCell(11).value,
      debt: row.getCell(12).value,
      debtChange: row.getCell(13).value,
      reportYear: row.getCell(14).value,
      pdf: row.getCell(15).value,
      companyLink: row.getCell(16).value,
      highlights: row.getCell(17).value || ''
    });
  }
  return records;
}

async function manifest() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(WORKBOOK_PATH);
  const rows = valuesFrom(workbook.getWorksheet('Under ₹20'));
  const links = [...new Set(rows.map(row => hyperlink(row.companyLink)).filter(Boolean))];
  return links.map(companyUrl => ({ companyUrl }));
}

function addEnrichedSheet(workbook, records, profiles) {
  const profileByUrl = new Map(profiles.map(item => [item.companyUrl, item]));
  const existingNotes = [];
  workbook.getWorksheet('Read Me')?.eachRow(row => existingNotes.push(row.values.slice(1)));
  const allEnriched = records.map(record => ({
    ...record,
    profile: profileByUrl.get(hyperlink(record.companyLink)) || {}
  }));
  const enriched = allEnriched;
  const outlookCounts = new Map();
  for (const item of enriched) {
    const label = item.outlook && typeof item.outlook === 'object' ? item.outlook.text : item.outlook;
    outlookCounts.set(label || 'Not Classified', (outlookCounts.get(label || 'Not Classified') || 0) + 1);
  }
  const updatedWorkbook = new ExcelJS.Workbook();
  updatedWorkbook.creator = workbook.creator;
  updatedWorkbook.created = workbook.created;
  updatedWorkbook.subject = workbook.subject;
  const sheet = updatedWorkbook.addWorksheet('Under ₹20', { properties: { tabColor: { argb: 'FF174A3A' } } });
  const headers = [
    'Sector', 'Company', 'Price (₹)', 'Market Cap (₹ Cr)', 'Promoter (%)', 'Public (%)',
    'FII Holding (%)', 'DII Holding (%)', 'ROCE (%)', 'ROE (%)', 'Pledged (%)', 'Debt/Equity',
    'Outlook', 'P/E', 'Sales (₹ Cr)', 'Sales Change', 'Profit (₹ Cr)', 'Profit Change', 'ROCE Change',
    'Debt (₹ Cr)', 'Debt Change', 'Report Year', 'Annual Report PDF', 'Screener Company', 'Screener Highlights'
  ];
  setHeader(sheet, headers);
  for (const item of enriched) {
    const profile = item.profile;
    const outlook = item.outlook && typeof item.outlook === 'object' ? item.outlook.text : item.outlook;
    const companyUrl = hyperlink(item.companyLink);
    const row = sheet.addRow([
      profile.sector || '', companyUrl ? { text: item.name || '', hyperlink: companyUrl } : item.name || '', profile.price ?? item.price ?? null,
      profile.marketCap ?? item.marketCap ?? null, profile.promoter ?? null, profile.public ?? null,
      profile.fii ?? null, profile.dii ?? null, profile.roce ?? item.roce ?? null, profile.roe ?? null,
      profile.pledged ?? null, profile.debtToEquity ?? null, item.outlook || '', item.pe ?? null,
      item.sales ?? null, item.salesChange || '', item.profit ?? null, item.profitChange || '',
      item.roceChange || '', item.debt ?? null, item.debtChange || '', item.reportYear || 2026,
      item.pdf || '', item.companyLink || '', item.highlights || ''
    ]);
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS[outlook] || COLORS['Not Classified'] } };
    row.alignment = { vertical: 'top', wrapText: true };
    for (const column of [3, 4, 14, 15, 17, 20]) row.getCell(column).numFmt = '#,##0.00';
    for (const column of [5, 6, 7, 8, 9, 10, 11, 12]) row.getCell(column).numFmt = '0.00';
    row.height = Math.min(90, Math.max(30, 18 * Math.max(1, String(item.highlights).split('\n').length)));
  }
  sheet.columns = [
    { width: 30 }, { width: 28 }, { width: 14 }, { width: 20 }, { width: 22 }, { width: 20 },
    { width: 18 }, { width: 18 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 },
    { width: 20 }, { width: 12 }, { width: 16 }, { width: 15 }, { width: 16 }, { width: 15 },
    { width: 15 }, { width: 16 }, { width: 15 }, { width: 14 }, { width: 18 }, { width: 20 }, { width: 82 }
  ];

  const summary = updatedWorkbook.addWorksheet('Outlook Summary');
  setHeader(summary, ['Outlook Filter', 'Under-₹20 Reports', 'Color Key']);
  summary.addRow([{ text: 'All', hyperlink: OUTLOOK_URLS.All }, enriched.length, 'All included rows']);
  for (const label of OUTLOOKS) {
    const row = summary.addRow([{ text: label, hyperlink: OUTLOOK_URLS[label] }, outlookCounts.get(label) || 0, 'Matches row color on Under ₹20']);
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS[label] } };
  }
  summary.addRow(['Not Classified', outlookCounts.get('Not Classified') || 0, 'No outlook label shown on Screener']);
  summary.columns = [{ width: 24 }, { width: 24 }, { width: 48 }];

  const notes = updatedWorkbook.addWorksheet('Read Me');
  notes.addRows([
    ...existingNotes,
    ['Profile data', 'Sector, ROE, ownership, pledged, debt/equity, CMP and available ROCE are from Screener company profiles/quick ratios. Values not shown by Screener remain blank.'],
    ['Profile coverage', `${profiles.filter(item => !item.error).length}/${profiles.length} profiles returned data; ${profiles.filter(item => item.error).length} profile requests failed.`],
    ['Ownership date', 'Ownership figures use the latest available values in Screener quick ratios at retrieval time.'],
    ['Row preservation', 'All original under-₹20 report rows and report details are retained. Profile fields are added where available; profile values do not filter or remove rows.']
  ]);
  notes.getColumn(1).width = 28;
  notes.getColumn(2).width = 110;
  notes.eachRow(row => { row.height = 34; row.getCell(2).alignment = { vertical: 'top', wrapText: true }; });
  return { workbook: updatedWorkbook, rows: enriched.length };
}

async function enrich(payload) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(WORKBOOK_PATH);
  const existing = valuesFrom(workbook.getWorksheet('Under ₹20'));
  const uniqueLinks = new Set(existing.map(row => hyperlink(row.companyLink)).filter(Boolean));
  if (payload.profiles?.length !== uniqueLinks.size) {
    throw new Error(`Profile coverage mismatch: ${payload.profiles?.length || 0}/${uniqueLinks.size}.`);
  }
  const counts = addEnrichedSheet(workbook, existing, payload.profiles);
  await counts.workbook.xlsx.writeFile(WORKBOOK_PATH);
  return { output: WORKBOOK_PATH, rows: counts.rows, profiles: payload.profiles.length, failed: payload.profiles.filter(item => item.error).length };
}

const server = http.createServer({ maxHeaderSize: 16 * 1024 * 1024 }, async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  try {
    if (request.method === 'GET' && url.pathname === '/status') {
      const expected = expectedProfileLinks.size;
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ completed: cachedProfiles.size, expected, remaining: Math.max(0, expected - cachedProfiles.size) }));
      return;
    }
    if (request.method === 'GET' && url.pathname === '/launch') {
      const links = await manifest();
      expectedProfileLinks = new Set(links.map(item => item.companyUrl));
      const pending = links.filter(item => !cachedProfiles.has(item.companyUrl) || cachedProfiles.get(item.companyUrl).error);
      const destination = `${ORIGIN}/annual-reports/?create_date__year=2026#profile-enrichment=${encodeURIComponent(JSON.stringify(pending))}`;
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(`<!doctype html><meta charset="utf-8"><script>location.replace(${JSON.stringify(destination)})</script>`);
      return;
    }
    if (request.method !== 'GET' || url.pathname !== '/import' || url.searchParams.get('token') !== TOKEN) {
      response.writeHead(403, { 'Content-Type': 'text/plain' });
      response.end('Import rejected.');
      return;
    }
    const compressed = Buffer.from(url.searchParams.get('payload') || '', 'base64');
    if (!compressed.length || compressed.length > 8_000_000) throw new Error('Missing or oversized profile payload.');
    const payload = JSON.parse(gunzipSync(compressed).toString('utf8'));
    if (!Array.isArray(payload.profiles) || !expectedProfileLinks.size) throw new Error('Profile batch or manifest is missing.');
    for (const item of payload.profiles) {
      if (!expectedProfileLinks.has(item.companyUrl)) throw new Error(`Unexpected profile URL: ${item.companyUrl || 'blank'}.`);
      cachedProfiles.set(item.companyUrl, item);
    }
    if (cachedProfiles.size < expectedProfileLinks.size) {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(`<title>Profile batch saved</title><p>Saved ${cachedProfiles.size}/${expectedProfileLinks.size} company profiles.</p>`);
      console.log(`Profile checkpoint: ${cachedProfiles.size}/${expectedProfileLinks.size}.`);
      return;
    }
    const result = await enrich({ profiles: [...cachedProfiles.values()] });
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(`<title>Workbook updated</title><h1>Workbook updated</h1><p>${result.rows} report rows retained with profile data from ${result.profiles} profiles.</p><p>${result.failed} profile requests failed; unavailable profile fields remain blank.</p>`);
    console.log(`Updated ${result.output}: ${result.rows} report rows retained; ${result.profiles} profiles, ${result.failed} failed.`);
    server.close();
  } catch (error) {
    response.writeHead(400, { 'Content-Type': 'text/plain' });
    response.end(error.message);
    console.error(error);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Open http://127.0.0.1:${PORT}/launch in the shared Screener browser tab to start profile enrichment.`);
});