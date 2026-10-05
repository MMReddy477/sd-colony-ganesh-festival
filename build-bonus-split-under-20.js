const fs = require('node:fs/promises');
const ExcelJS = require('exceljs');

const ACTIONS_PATH = '.corporate-actions-raw.json';
const PROFILE_CACHE_PATH = '.corporate-action-profiles.json';
const OUTPUT_PATH = 'Screener-Bonus-Split-Under-20-2024-2026.xlsx';
const SCREENER_ORIGIN = 'https://www.screener.in';
const USER_AGENT = 'Mozilla/5.0 (compatible; ScreenerWorkbook/1.0)';
const REQUEST_DELAY_MS = 1000;
const CHECKPOINT_SIZE = 20;
const PROFILE_CONCURRENCY = 2;
const PROFILE_PARSER_VERSION = 2;
const HEADERS = [
  'Ex-Date', 'Sector', 'Company', 'Price ₹', 'Market Cap ₹ Cr', 'Promoter %', 'Public %',
  'ROCE %', 'ROE %', 'Pledged %', 'Debt/Equity', 'Sales (₹ Cr)',
  'Products / Applications / Where Used (Screener About)', 'Action',
  'Bonus Ratio / Split Face Value (Old:New)'
];
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const normalizeName = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const cellText = value => value && typeof value === 'object' ? value.text || '' : value || '';

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

function numberFrom(value) {
  const match = String(value ?? '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function parseActionDate(value) {
  const match = String(value || '').match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (!match) throw new Error(`Unexpected action date: ${value}`);
  const month = new Date(`${match[2]} 1, ${match[3]}`).getMonth();
  if (!Number.isFinite(month)) throw new Error(`Unexpected action month: ${value}`);
  return new Date(Date.UTC(Number(match[3]), month, Number(match[1])));
}

function parseEvents(rawEvents, cutoff) {
  const seen = new Set();
  const events = [];
  for (const item of rawEvents) {
    let type;
    let name;
    let path;
    let exDate;
    let ratio;
    if (item[0] === 'Bonus') {
      [, , name, path, exDate, ratio] = item;
      type = 'Bonus';
    } else if (item[0] === 'Split') {
      [, name, path, exDate] = item;
      ratio = `${item[4]}:${item[5]}`;
      type = 'Split';
    } else {
      continue;
    }

    const date = parseActionDate(exDate);
    const year = date.getUTCFullYear();
    if (type === 'Bonus' && ![2025, 2026].includes(year)) continue;
    if (type === 'Split' && ![2024, 2025, 2026].includes(year)) continue;
    if (date > cutoff || !name || !path) continue;

    const companyUrl = new URL(path, SCREENER_ORIGIN).href;
    const key = [type, companyUrl, date.toISOString(), ratio].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    events.push({ type, name, companyUrl, exDate, date, ratio });
  }
  return events;
}

function latestRatios(html) {
  const ratios = {};
  const list = html.match(/<ul\b[^>]*id=['"]top-ratios['"][^>]*>([\s\S]*?)<\/ul>/i)?.[1] || '';
  for (const [, item] of list.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
    const name = clean(item.match(/<span\b[^>]*class=['"][^'"]*name[^'"]*['"][^>]*>([\s\S]*?)<\/span>/i)?.[1] || '');
    const value = clean(item.match(/<span\b[^>]*class=['"][^'"]*nowrap value[^'"]*['"][^>]*>([\s\S]*?)<\/span>/i)?.[1] || '');
    if (name) ratios[normalizeName(name)] = value;
  }
  return ratios;
}

function latestHolding(section, target) {
  for (const [, row] of section.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    if (!/plausible-event-period=quarterly/i.test(row)) continue;
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(match => clean(match[1]));
    const label = (cells[0] || '').replace(/\+/g, '').trim().toLowerCase();
    if (label !== target) continue;
    const values = cells.slice(1).map(numberFrom).filter(value => value !== null);
    return values.length ? values[values.length - 1] : null;
  }
  return null;
}

function latestSales(html) {
  const section = html.match(/<section\b[^>]*id=['"]profit-loss['"][^>]*>([\s\S]*?)(?=<section\b|$)/i)?.[1] || '';
  for (const [, row] of section.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(match => clean(match[1]));
    if (!cells[0]?.toLowerCase().startsWith('sales')) continue;
    const values = cells.slice(1).map(numberFrom).filter(value => value !== null);
    return values.length ? values[values.length - 1] : null;
  }
  return null;
}

function parseProfile(html) {
  const ratios = latestRatios(html);
  const value = (...names) => {
    for (const name of names) {
      const raw = ratios[normalizeName(name)];
      if (raw !== undefined) return numberFrom(raw);
    }
    return null;
  };
  let sector = '';
  for (const [, attributes, body] of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    if (/\btitle\s*=\s*['"]Sector['"]/i.test(attributes)) {
      sector = clean(body);
      break;
    }
  }
  const shareholding = html.match(/<section\b[^>]*id=['"]shareholding['"][^>]*>([\s\S]*?)(?=<section\b|$)/i)?.[1] || '';
  const about = clean(html.match(/<div\b[^>]*class=['"][^'"]*\babout\b[^'"]*['"][^>]*>([\s\S]*?)<\/div>/i)?.[1] || '');
  const profile = {
    parserVersion: PROFILE_PARSER_VERSION,
    sector,
    price: value('current price'),
    marketCap: value('market cap'),
    promoter: latestHolding(shareholding, 'promoters'),
    public: latestHolding(shareholding, 'public'),
    roce: value('roce'),
    roe: value('roe'),
    pledged: value('pledged percentage', 'pledged percentage %', 'pledged %', 'pledged'),
    debtToEquity: value('debt to equity', 'debt / equity', 'debt/equity'),
    sales: latestSales(html),
    about
  };
  for (const field of ['promoter', 'public', 'pledged']) {
    if (profile[field] !== null && (profile[field] < 0 || profile[field] > 100)) profile[field] = null;
  }
  return profile;
}

async function fetchProfile(companyUrl) {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    await delay(REQUEST_DELAY_MS);
    try {
      const response = await fetch(companyUrl, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(30000)
      });
      if (response.status === 429) {
        console.warn(`Screener returned HTTP 429; retrying ${companyUrl} after a cooldown.`);
        await delay(Math.max(60000, attempt * 15000));
        continue;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      if (/Register - Screener/i.test(html.slice(0, 3000))) throw new Error('Profile request redirected to Screener registration.');
      return { ...parseProfile(html), error: '' };
    } catch (error) {
      if (attempt === 5) return { error: `${error.message || error}`.slice(0, 300) };
      await delay(attempt * 3000);
    }
  }
  return { error: 'Profile request failed after all retries.' };
}

async function fetchProfileBatch(urls) {
  const results = new Array(urls.length);
  let nextIndex = 0;
  await Promise.all(Array.from({ length: Math.min(PROFILE_CONCURRENCY, urls.length) }, async () => {
    while (nextIndex < urls.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await fetchProfile(urls[index]);
    }
  }));
  return results;
}

function currentDateInIndia() {
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
  const [year, month, day] = formatted.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

async function writeWorkbook(events, profiles, cutoff, checkpoint = false) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Screener corporate actions review';
  workbook.subject = 'Bonus and stock split events with current share price below ₹20';
  const qualifyingByAction = new Map([
    ['Bonus', events.filter(event => event.type === 'Bonus')],
    ['Split', events.filter(event => event.type === 'Split')]
  ]);
  let qualifyingRows = 0;
  const promoterFilteredRows = {};
  const profileFailures = [...profiles.values()].filter(profile => profile.error).length;
  for (const [action, actionEvents] of qualifyingByAction) {
    const qualifying = actionEvents.flatMap(event => {
      const profile = profiles.get(event.companyUrl);
      if (!profile || profile.error || !Number.isFinite(profile.price) || profile.price <= 0 || profile.price >= 20) return [];
      return [{ event, profile }];
    }).sort((left, right) => left.profile.price - right.profile.price
      || left.event.name.localeCompare(right.event.name)
      || left.event.date - right.event.date);
    qualifyingRows += qualifying.length;
    const promoterAtLeast30 = qualifying.filter(({ profile }) => (
      Number.isFinite(profile.promoter) && profile.promoter >= 30
    ));
    promoterFilteredRows[action] = promoterAtLeast30.length;

    for (const [sheetName, rows] of [
      [action, qualifying],
      [`${action} Promoter >=30`, promoterAtLeast30]
    ]) {
      const sheet = workbook.addWorksheet(sheetName);
      sheet.addRow(HEADERS);
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
      sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: HEADERS.length } };
      const header = sheet.getRow(1);
      header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF174A3A' } };
      header.alignment = { vertical: 'middle', wrapText: true };
      header.height = 42;

      for (const { event, profile } of rows) {
        const row = sheet.addRow([
          event.exDate,
          profile.sector || '',
          { text: event.name, hyperlink: event.companyUrl },
          profile.price,
          profile.marketCap,
          profile.promoter,
          profile.public,
          profile.roce,
          profile.roe,
          profile.pledged,
          profile.debtToEquity,
          profile.sales,
          profile.about || '',
          event.type,
          event.ratio
        ]);
        row.alignment = { vertical: 'top', wrapText: true };
        row.getCell(3).font = { color: { argb: 'FF0563C1' }, underline: true };
        for (const column of [4, 5, 8, 9, 10, 11, 12]) row.getCell(column).numFmt = '#,##0.00';
        for (const column of [6, 7]) row.getCell(column).numFmt = '0.00';
        row.height = Math.min(90, Math.max(24, Math.ceil(String(profile.about || '').length / 80) * 18));
      }
      sheet.columns = [
        { width: 17 }, { width: 26 }, { width: 30 }, { width: 14 }, { width: 18 },
        { width: 14 }, { width: 14 }, { width: 12 }, { width: 12 }, { width: 12 },
        { width: 14 }, { width: 16 }, { width: 82 }, { width: 12 }, { width: 33 }
      ];
    }
  }

  const notes = workbook.addWorksheet('Read Me');
  const eligibleEvents = events.filter(event => event.date <= cutoff);
  const pendingProfiles = [...profiles.values()].filter(profile => !profile.error).length;
  notes.addRows([
    ['Source', 'Screener bonus and stock split action listings and company profiles.'],
    ['Price rule', `Included only when Screener's current profile price is above ₹0 and below ₹20; retrieved ${new Date().toISOString()}.`],
    ['Action dates', `Only completed actions through ${cutoff.toISOString().slice(0, 10)} are included. Future ex-dates were excluded because post-action prices are not yet available.`],
    ['Bonus periods', 'Ex-dates in 2025 and 2026.'],
    ['Split periods', 'Ex-dates in 2024, 2025 and 2026.'],
    ['Ownership', 'Promoter and public holdings use the latest quarterly shareholding figures available on the Screener profile; unavailable values remain blank.'],
    ['Promoter-filtered tabs', `Bonus Promoter >=30 and Split Promoter >=30 include only rows with a known promoter holding of at least 30%: ${promoterFilteredRows.Bonus} bonus rows and ${promoterFilteredRows.Split} split rows. The unfiltered Bonus and Split tabs are retained.`],
    ['Products / applications', 'The description is copied from Screener company-profile About text; it is not independently verified as a complete product catalogue.'],
    ['Coverage', `${eligibleEvents.length} completed action records screened across ${profiles.size} unique company profiles; ${qualifyingRows} action rows meet the current-price rule. Bonus and split results, plus promoter-filtered tabs, are provided separately.`],
    ['Profile failures', `${profileFailures} profile requests failed; those companies are omitted until a successful profile fetch. ${pendingProfiles} profiles returned data.`],
    ['Progress', checkpoint ? 'This workbook was saved at an intermediate profile checkpoint and will refresh when the enrichment script is resumed.' : 'Profile enrichment completed.']
  ]);
  notes.getColumn(1).width = 27;
  notes.getColumn(2).width = 115;
  notes.eachRow(row => {
    row.height = 34;
    row.getCell(2).alignment = { vertical: 'top', wrapText: true };
  });

  const temporaryPath = `${OUTPUT_PATH}.tmp`;
  try {
    await workbook.xlsx.writeFile(temporaryPath);
    await fs.rename(temporaryPath, OUTPUT_PATH);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true });
    throw error;
  }
  return { qualifyingRows, failedProfiles: profileFailures, eventsScreened: eligibleEvents.length };
}

async function main() {
  const cutoff = currentDateInIndia();
  const rawEvents = JSON.parse(await fs.readFile(ACTIONS_PATH, 'utf8'));
  const events = parseEvents(rawEvents, cutoff);
  if (!events.length) throw new Error('No completed bonus or split events found for the requested years.');

  let profiles = new Map();
  try {
    profiles = new Map(Object.entries(JSON.parse(await fs.readFile(PROFILE_CACHE_PATH, 'utf8'))));
  } catch (error) {
    if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
  }

  const companyUrls = [...new Set(events.map(event => event.companyUrl))];
  const pending = companyUrls.filter(url => (
    !profiles.has(url)
    || profiles.get(url)?.error
    || profiles.get(url)?.parserVersion !== PROFILE_PARSER_VERSION
  ));
  console.log(`${events.length} completed actions; ${companyUrls.length} unique company profiles; ${pending.length} profiles pending.`);
  let result = await writeWorkbook(events, profiles, cutoff, true);
  console.log(`Workbook checkpoint saved: ${result.qualifyingRows} qualifying action rows.`);

  for (let offset = 0; offset < pending.length; offset += CHECKPOINT_SIZE) {
    const batch = pending.slice(offset, offset + CHECKPOINT_SIZE);
    const fetched = await fetchProfileBatch(batch);
    batch.forEach((url, index) => profiles.set(url, fetched[index]));
    await fs.writeFile(PROFILE_CACHE_PATH, JSON.stringify(Object.fromEntries(profiles)), 'utf8');
    result = await writeWorkbook(events, profiles, cutoff, offset + batch.length < pending.length);
    console.log(`Saved profile checkpoint ${Math.min(offset + batch.length, pending.length)}/${pending.length}: ${result.qualifyingRows} qualifying action rows; ${result.failedProfiles} profile failures.`);
  }

  result = await writeWorkbook(events, profiles, cutoff, false);
  console.log(JSON.stringify({
    output: OUTPUT_PATH,
    actionRowsScreened: result.eventsScreened,
    uniqueProfiles: companyUrls.length,
    qualifyingActionRows: result.qualifyingRows,
    profileFailures: result.failedProfiles
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
