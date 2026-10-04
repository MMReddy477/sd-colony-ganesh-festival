const ExcelJS = require('exceljs');
const path = require('path');

const source = 'Screener-under-10-Industries-Filtered.xlsx';
const fallbackSource = 'Screener-under-10-Industries.xlsx';
const output = 'Turnaround-Stock-Review-Status.xlsx';

function num(value) {
  if (value === null || value === undefined || value === '') return null;
  const cleaned = String(value).replace(/,/g, '').replace(/%/g, '').trim();
  const match = cleaned.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function categoryFor(row) {
  const promoter = num(row['Promoter Holding (%)']);
  const pledged = num(row['Pledged Percentage (%)']);
  const debt = num(row['Debt to Equity'] ?? row['Debt / Equity'] ?? row['Debt to Equity Ratio'] ?? row['Debt/Equity']);
  const roe = num(row['ROE (%)']);
  const roce = num(row['ROCE (%)']);
  const growth = num(row['Profit Growth TTM (%)']);
  const growth3Y = num(row['Profit Growth 3Yrs (%)']);
  const price = num(row['Current Price (₹)']);

  const debtOk = debt === null || debt < 0.5;

  if (promoter !== null && promoter > 60 && pledged === 0 && debtOk && (roe !== null && roe > 10 || roce !== null && roce > 12)) {
    return 'Anchor';
  }

  if (promoter !== null && promoter > 50 && pledged === 0 && debtOk && (
    (growth !== null && growth > 15) || (growth3Y !== null && growth3Y > 15) || (price !== null && price < 5)
  )) {
    return 'Rocket';
  }

  return null;
}

function fillFor(category) {
  if (category === 'Anchor') {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB7E1CD' } };
  }
  if (category === 'Rocket') {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE7A3' } };
  }
  return null;
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

  const sourceSheet = workbook.getWorksheet(1);
  const originalHeaders = sourceSheet.getRow(1).values.slice(1);
  const review = workbook.addWorksheet('Turnaround Review');
  review.addRow(['Category', ...originalHeaders]);
  review.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  review.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };

  let foundMatch = false;
  for (let rowNumber = 2; rowNumber <= sourceSheet.rowCount; rowNumber += 1) {
    const originalRow = sourceSheet.getRow(rowNumber);
    const raw = {};
    for (let col = 0; col < originalHeaders.length; col += 1) {
      const key = originalHeaders[col];
      raw[key] = originalRow.getCell(col + 1).value;
    }
    const category = categoryFor(raw);
    if (!category) continue;
    foundMatch = true;
    const reviewRow = review.addRow([category, ...originalHeaders.map(header => raw[header] ?? '')]);
    const fill = fillFor(category);
    if (fill) {
      reviewRow.fill = fill;
      reviewRow.eachCell({ includeEmpty: true }, cell => {
        cell.fill = fill;
      });
    }
  }

  if (!foundMatch) {
    const noStocks = review.addRow(['No turnaround stocks', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
    noStocks.getCell(1).font = { bold: true, color: { argb: 'FF000000' } };
    noStocks.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F3F3' } };
    noStocks.eachCell({ includeEmpty: true }, cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F3F3' } };
    });
  }

  review.columns = review.columns.map((col, idx) => ({
    width: idx === 0 ? 20 : idx === 1 ? 28 : idx === 2 ? 36 : 18
  }));

  await workbook.xlsx.writeFile(path.join(__dirname, output));
  const resultText = foundMatch ? 'with Anchor/Rocket color coding.' : 'with explicit No turnaround stocks message.';
  console.log(`Saved ${output} ${resultText}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
