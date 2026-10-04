const ExcelJS = require('exceljs');
const path = require('path');

const source = 'Screener-under-10-Industries.xlsx';
const fallbackSource = 'Screener-under-10-Industries-Filtered.xlsx';
const output = 'Final-All-Under-10-Review.xlsx';

const sectorColors = [
  { fg: 'FFB7E1CD' },
  { fg: 'FFBFE6FF' },
  { fg: 'FFFFE7A3' },
  { fg: 'FFD9D2E5' },
  { fg: 'FFD8F0C8' }
];

function formatNumber(value) {
  if (value === null || value === undefined || value === '') return '';
  const num = Number(value);
  return Number.isFinite(num) ? num.toFixed(2) : String(value);
}

function parseNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(String(value).replace(/,/g, '').replace(/%/g, ''));
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

function matchesAllUnder10Filter(raw) {
  const price = parseNumber(raw['Current Price (₹)'] ?? raw['Current Price']);
  if (price === null || price >= 10) return false;
  return true;
}

function addSectorSheet(finalWorkbook, title, entries) {
  const sheet = finalWorkbook.addWorksheet(title);
  const headers = ['Sector', 'Company', 'Price ₹', 'Market Cap ₹ Cr', 'Promoter %', 'Public %', 'ROCE %', 'ROE %', 'Pledged %', 'Debt/Equity', 'TTM Growth %', '3Y Growth %', 'Screener Link'];
  const headerRow = sheet.addRow(headers);
  styleHeader(headerRow);

  for (const item of entries) {
    const stockRow = sheet.addRow([
      item.sector,
      item.company,
      item.price,
      item.marketCap,
      item.promoter,
      item.public,
      item.roce,
      item.roe,
      item.pledged,
      item.debt,
      item.ttmGrowth,
      item.threeYGrowth,
      item.link
    ]);

    const companyCell = stockRow.getCell(2);
    companyCell.value = item.link ? { text: String(item.company), hyperlink: item.link, tooltip: item.link } : String(item.company);
    if (item.link) {
      companyCell.font = { color: { argb: 'FF0000FF' }, underline: true };
    }

    stockRow.eachCell({ includeEmpty: true }, cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: item.fill } };
    });
  }

  sheet.columns = [
    { width: 18 }, { width: 28 }, { width: 12 }, { width: 16 }, { width: 12 },
    { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 14 },
    { width: 14 }, { width: 14 }, { width: 30 }
  ];
}

async function main() {
  const workbook = new ExcelJS.Workbook();
  const sourcePath = path.join(__dirname, source);
  const fallbackPath = path.join(__dirname, fallbackSource);

  try {
    await workbook.xlsx.readFile(sourcePath);
  } catch (error) {
    await workbook.xlsx.readFile(fallbackPath);
  }

  const finalWorkbook = new ExcelJS.Workbook();
  const allSheets = workbook.worksheets.filter(ws => !['Overview', 'Notes', 'Turnaround Review', 'Final Review', 'Sector View', 'All Stocks'].includes(ws.name));
  const finalEntries = [];

  for (const ws of allSheets) {
    if (ws.rowCount <= 1) continue;
    const sectorName = ws.name;
    for (let r = 2; r <= ws.rowCount; r += 1) {
      const raw = parseRowValues(ws, r);
      const company = raw['Company'] || raw['Company Name'];
      if (!company) continue;
      const link = raw['Screener Link'] || raw['Screener URL'] || raw['Link'] || '';
      if (!matchesAllUnder10Filter(raw)) continue;
      finalEntries.push({
        sector: sectorName,
        company,
        price: formatNumber(raw['Current Price (₹)'] ?? raw['Current Price']),
        marketCap: formatNumber(raw['Market Cap (₹ Cr)'] ?? raw['Market Cap']),
        promoter: formatNumber(raw['Promoter Holding (%)'] ?? raw['Promoter Holding']),
        public: formatNumber(raw['Public Holding (%)'] ?? raw['Public Holding']),
        roce: formatNumber(raw['ROCE (%)'] ?? raw['ROCE']),
        roe: formatNumber(raw['ROE (%)'] ?? raw['ROE']),
        pledged: formatNumber(raw['Pledged Percentage (%)'] ?? raw['Pledged Percentage']),
        debt: formatNumber(raw['Debt to Equity'] ?? raw['Debt to Equity Ratio'] ?? raw['Debt/Equity']),
        ttmGrowth: formatNumber(raw['Profit Growth TTM (%)'] ?? raw['Profit Growth TTM']),
        threeYGrowth: formatNumber(raw['Profit Growth 3Yrs (%)'] ?? raw['Profit Growth 3Yrs']),
        link,
        fill: sectorColors[(finalEntries.length + 1) % sectorColors.length].fg
      });
    }
  }

  const allSheet = finalWorkbook.addWorksheet('All Stocks');
  const headers = ['Sector', 'Company', 'Price ₹', 'Market Cap ₹ Cr', 'Promoter %', 'Public %', 'ROCE %', 'ROE %', 'Pledged %', 'Debt/Equity', 'TTM Growth %', '3Y Growth %', 'Screener Link'];
  const headerRow = allSheet.addRow(headers);
  styleHeader(headerRow);

  if (finalEntries.length === 0) {
    const noDataRow = allSheet.addRow(['No stocks found matching the filter', '', '', '', '', '', '', '', '', '', '', '', '']);
    noDataRow.getCell(1).font = { bold: true, color: { argb: 'FF000000' } };
    noDataRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F3F3' } };
    allSheet.mergeCells(`A${allSheet.rowCount}:M${allSheet.rowCount}`);
    allSheet.getCell(`A${allSheet.rowCount}`).value = 'No stocks found matching the filter';
    allSheet.getCell(`A${allSheet.rowCount}`).alignment = { horizontal: 'center', vertical: 'middle' };
  } else {
    for (const item of finalEntries) {
      const stockRow = allSheet.addRow([
        item.sector,
        item.company,
        item.price,
        item.marketCap,
        item.promoter,
        item.public,
        item.roce,
        item.roe,
        item.pledged,
        item.debt,
        item.ttmGrowth,
        item.threeYGrowth,
        item.link
      ]);

      const companyCell = stockRow.getCell(2);
      companyCell.value = item.link ? { text: String(item.company), hyperlink: item.link, tooltip: item.link } : String(item.company);
      if (item.link) {
        companyCell.font = { color: { argb: 'FF0000FF' }, underline: true };
      }

      stockRow.eachCell({ includeEmpty: true }, cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: item.fill } };
      });
    }
  }

  addSectorSheet(finalWorkbook, 'Sector View', finalEntries);
  const finalReviewSheet = finalWorkbook.addWorksheet('Final Review');
  finalReviewSheet.addRow(['All filtered stocks are shown in the All Stocks sheet.']);
  finalReviewSheet.getRow(1).font = { bold: true };

  allSheet.columns = [
    { width: 18 }, { width: 28 }, { width: 12 }, { width: 16 }, { width: 12 },
    { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 14 },
    { width: 14 }, { width: 14 }, { width: 30 }
  ];

  await finalWorkbook.xlsx.writeFile(path.join(__dirname, output));
  console.log(`Saved ${output} with filtered all-stock results and a sector view.`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
