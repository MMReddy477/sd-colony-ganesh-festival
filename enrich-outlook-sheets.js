const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const ExcelJS = require('exceljs');

const WORKBOOK_PATH = 'Screener-Annual-Reports-Under-20-2026.xlsx';
const CACHE_PATH = '.outlook-profile-cache.json';
const OUTLOOK_SHEETS = ['Neutral', 'Optimistic', 'Very Optimistic'];
const REQUEST_DELAY_MS = 900;
const USER_AGENT = 'Mozilla/5.0 (compatible; ScreenerWorkbook/1.0)';
const PRODUCT_HEADER = 'Products / Applications (Screener About)';

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const cellText = value => value && typeof value === 'object' ? value.text || '' : value || '';
const cellUrl = value => value && typeof value === 'object' ? value.hyperlink || '' : value || '';

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

function parseProfile(html) {
  let sector = '';
  for (const [, attributes, body] of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    if (/\btitle\s*=\s*['"]Sector['"]/i.test(attributes)) {
      sector = clean(body);
      break;
    }
  }

  const section = html.match(/<section\b[^>]*id=['"]shareholding['"][^>]*>([\s\S]*?)(?=<section\b|$)/i)?.[1] || '';
  const ownership = {};
  for (const [, row] of section.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    if (!/plausible-event-period=quarterly/i.test(row)) continue;
    const values = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(match => clean(match[1]));
    const label = (values[0] || '').replace(/\+/g, '').trim().toLowerCase();
    if (!['promoters', 'public'].includes(label) || ownership[label] !== undefined) continue;
    const numbers = values.slice(1).map(value => {
      const match = value.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
      return match ? Number(match[0]) : null;
    }).filter(value => value !== null);
    ownership[label] = numbers.length ? numbers[numbers.length - 1] : null;
  }

  const about = clean(html.match(/<div\b[^>]*class=['"][^'"]*\babout\b[^'"]*['"][^>]*>([\s\S]*?)<\/div>/i)?.[1] || '');
  return {
    sector,
    promoter: ownership.promoters ?? null,
    public: ownership.public ?? null,
    about
  };
}

async function fetchProfile(companyUrl) {
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    await delay(REQUEST_DELAY_MS);
    try {
      const response = await fetch(companyUrl, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(30000)
      });
      if (response.status === 429) {
        const retryAfter = Number(response.headers.get('retry-after'));
        await delay(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : attempt * 5000);
        throw new Error(`HTTP 429 for ${companyUrl}`);
      }
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${companyUrl}`);
      return { ...parseProfile(await response.text()), error: '' };
    } catch (error) {
      lastError = error;
      if (attempt < 5 && !String(error.message).includes('HTTP 429')) {
        await delay(attempt * 1200);
      }
    }
  }
  return { sector: '', promoter: null, public: null, about: '', error: String(lastError?.message || lastError).slice(0, 300) };
}

async function saveCache(cache) {
  await fs.writeFile(CACHE_PATH, JSON.stringify(Object.fromEntries(cache)), 'utf8');
}

async function persistWorkbook(workbook, expectedHash) {
  const currentHash = crypto.createHash('sha256').update(await fs.readFile(WORKBOOK_PATH)).digest('hex');
  if (currentHash !== expectedHash) {
    throw new Error('Workbook changed outside this run; refusing to overwrite newer edits.');
  }

  const temporaryPath = `${WORKBOOK_PATH}.tmp`;
  try {
    await workbook.xlsx.writeFile(temporaryPath);
    await fs.rename(temporaryPath, WORKBOOK_PATH);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true });
    throw error;
  }
  return crypto.createHash('sha256').update(await fs.readFile(WORKBOOK_PATH)).digest('hex');
}

function applyProfiles(targetSheets, cache) {
  for (const { name, sheet, columns } of targetSheets) {
    const existingProductColumn = sheet.getRow(1).values.slice(1).map(cellText).indexOf(PRODUCT_HEADER) + 1;
    const productColumn = existingProductColumn || sheet.columnCount + 1;
    const header = sheet.getRow(1).getCell(productColumn);
    header.value = PRODUCT_HEADER;
    header.style = { ...sheet.getCell(1, Math.max(1, productColumn - 1)).style };
    sheet.getColumn(productColumn).width = 72;
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: Math.max(sheet.columnCount, productColumn) }
    };

    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      const url = cellUrl(row.getCell(columns['Screener Company']).value);
      const profile = cache.get(url) || {};
      const sectorCell = row.getCell(columns.Sector);
      const promoterCell = row.getCell(columns['Promoter %']);
      const publicCell = row.getCell(columns['Public %']);
      if (profile.sector) sectorCell.value = profile.sector;
      if (profile.promoter !== null && profile.promoter !== undefined) promoterCell.value = profile.promoter;
      if (profile.public !== null && profile.public !== undefined) publicCell.value = profile.public;

      const productCell = row.getCell(productColumn);
      productCell.value = profile.about || cellText(productCell.value);
      productCell.alignment = { vertical: 'top', wrapText: true };
      productCell.fill = { ...row.getCell(columns.Company).fill };
      productCell.font = { ...row.getCell(columns.Company).font };
    }
    console.log(`Prepared ${name}: ${sheet.rowCount - 1} rows.`);
  }
}

async function main() {
  const originalBytes = await fs.readFile(WORKBOOK_PATH);
  let expectedHash = crypto.createHash('sha256').update(originalBytes).digest('hex');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(originalBytes);

  const targetSheets = OUTLOOK_SHEETS.map(name => {
    const sheet = workbook.getWorksheet(name);
    if (!sheet) throw new Error(`Missing required sheet: ${name}`);
    const headers = sheet.getRow(1).values.slice(1).map(cellText);
    const columns = Object.fromEntries(
      ['Sector', 'Company', 'Promoter %', 'Public %', 'Screener Company', 'Price ₹', 'Outlook']
        .map(header => [header, headers.indexOf(header) + 1])
    );
    for (const [header, column] of Object.entries(columns)) {
      if (column < 1) throw new Error(`${name} is missing required column: ${header}`);
    }
    return { name, sheet, headers, columns };
  });

  const links = [...new Set(targetSheets.flatMap(({ sheet, columns }) => {
    const values = [];
    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const url = cellUrl(sheet.getRow(rowNumber).getCell(columns['Screener Company']).value);
      if (url) values.push(url);
    }
    return values;
  }))];
  if (!links.length) throw new Error('No Screener company profile links found in the target sheets.');

  let cache = new Map();
  try {
    cache = new Map(Object.entries(JSON.parse(await fs.readFile(CACHE_PATH, 'utf8'))));
  } catch (error) {
    if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
  }

  const pending = links.filter(url => !cache.has(url) || cache.get(url)?.error);
  console.log(`Fetching ${pending.length} profiles (${cache.size} already checkpointed).`);
  if (cache.size) {
    applyProfiles(targetSheets, cache);
    expectedHash = await persistWorkbook(workbook, expectedHash);
    console.log(`Saved workbook checkpoint with ${cache.size} cached profiles.`);
  }
  for (let index = 0; index < pending.length; index += 1) {
    const url = pending[index];
    cache.set(url, await fetchProfile(url));
    if ((index + 1) % 25 === 0 || index + 1 === pending.length) {
      await saveCache(cache);
      console.log(`Profile checkpoint: ${index + 1}/${pending.length} fetched; ${cache.size} total cached.`);
      applyProfiles(targetSheets, cache);
      expectedHash = await persistWorkbook(workbook, expectedHash);
      console.log(`Saved workbook checkpoint with ${cache.size} cached profiles.`);
    }
  }

  const failures = [...cache.values()].filter(profile => profile.error).length;
  const savedWorkbook = new ExcelJS.Workbook();
  await savedWorkbook.xlsx.readFile(WORKBOOK_PATH);
  for (const { name, columns } of targetSheets) {
    const sheet = savedWorkbook.getWorksheet(name);
    if (sheet.rowCount !== workbook.getWorksheet(name).rowCount) {
      throw new Error(`${name} row count changed during save.`);
    }
    let populatedSector = 0;
    let populatedPromoter = 0;
    let populatedPublic = 0;
    let populatedAbout = 0;
    let priceOutOfOrder = 0;
    let lastPrice = Number.NEGATIVE_INFINITY;
    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      if (row.getCell(columns.Sector).value) populatedSector += 1;
      if (row.getCell(columns['Promoter %']).value !== null && row.getCell(columns['Promoter %']).value !== '') populatedPromoter += 1;
      if (row.getCell(columns['Public %']).value !== null && row.getCell(columns['Public %']).value !== '') populatedPublic += 1;
      if (row.getCell(productColumnFor(sheet)).value) populatedAbout += 1;
      const outlook = cellText(row.getCell(columns.Outlook).value);
      if (outlook !== name) throw new Error(`${name} contains an unexpected outlook label at row ${rowNumber}: ${outlook}`);
      const price = Number(String(cellText(row.getCell(columns['Price ₹']).value)).replace(/,/g, ''));
      if (Number.isFinite(price)) {
        if (price < lastPrice) priceOutOfOrder += 1;
        lastPrice = price;
      }
      if (!cellUrl(row.getCell(columns.Company).value)) throw new Error(`${name} lost a company hyperlink at row ${rowNumber}.`);
    }
    if (priceOutOfOrder) throw new Error(`${name} is no longer sorted by price low-to-high (${priceOutOfOrder} inversions).`);
    console.log(JSON.stringify({ sheet: name, rows: sheet.rowCount - 1, populatedSector, populatedPromoter, populatedPublic, populatedAbout, priceOutOfOrder }));
  }
  console.log(`Workbook updated. ${links.length} unique profile URLs; ${failures} profile requests failed.`);
}

function productColumnFor(sheet) {
  return sheet.getRow(1).values.slice(1).map(cellText).indexOf(PRODUCT_HEADER) + 1;
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
