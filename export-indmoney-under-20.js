const ExcelJS = require('exceljs');
const path = require('path');

const API_BASE = 'https://apixt-in.indmoney.com/indian-stock-broker/catalog/listing';
const STOCKS_BASE = 'https://www.indmoney.com';
const OUTPUT = 'INDmoney-All-Sectors-Under-20-Review.xlsx';
const PAGE_SIZE = 100;
const CONCURRENCY = 4;
const CATEGORIES = [
  { name: 'Defence', slug: 'defence' },
  { name: 'Construction', slug: 'construction' },
  { name: 'Infrastructure', slug: 'infrastructure' },
  { name: 'Railway', slug: 'railway' },
  { name: 'Pharma', slug: 'pharma' },
  { name: 'IT', slug: 'it' },
  { name: 'FMCG', slug: 'fmcg' },
  { name: 'Steel', slug: 'steel' },
  { name: 'Sugar', slug: 'sugar' },
  { name: 'Metal', slug: 'metal' },
  { name: 'Power', slug: 'power' },
  { name: 'Real Estate', slug: 'real-estate' },
  { name: 'Alcohol', slug: 'alcohol' },
  { name: 'Auto', slug: 'auto' },
  { name: 'Chemical', slug: 'chemical' },
  { name: 'Auto Ancillary', slug: 'auto-ancillary' },
  { name: 'REIT', slug: 'reit' },
  { name: 'Cement', slug: 'cement' },
  { name: 'Banking', slug: 'banking' },
  { name: 'Agriculture', slug: 'agriculture' },
  { name: 'Fertilizer', slug: 'fertilizer' },
  { name: 'Healthcare', slug: 'healthcare' },
  { name: 'Telecom', slug: 'telecom' },
  { name: 'InvIT', slug: 'invit' },
  { name: 'Oil & Gas', slug: 'oil-gas' },
  { name: 'Textile', slug: 'textile' },
  { name: 'Capital Goods', slug: 'capital-goods' },
  { name: 'Finance', slug: 'finance' },
  { name: 'Media', slug: 'media' },
  { name: 'Insurance', slug: 'insurance' },
  { name: 'Consumer Durables', slug: 'consumer-durables' },
  { name: 'Diamond & Jewellery', slug: 'diamond-and-jewellery' },
  { name: 'Paper', slug: 'paper' },
  { name: 'Mining & Minerals', slug: 'mining' },
  { name: 'Petrochemicals', slug: 'petrochemical' },
  { name: 'Logistics', slug: 'logistics' },
  { name: 'Packaging', slug: 'packaging' },
  { name: 'Shipping', slug: 'shipping' },
  { name: 'Airlines', slug: 'airline' },
  { name: 'Paints', slug: 'paint' },
  { name: 'Tobacco', slug: 'tobacco' },
  { name: 'Leather', slug: 'leather' },
  { name: 'Education', slug: 'education' },
  { name: 'Hotels & Restaurants', slug: 'hotel' },
  { name: 'Retail', slug: 'retail' },
  { name: 'Ceramics', slug: 'ceramic' },
  { name: 'Edible Oil', slug: 'edible-oil' }
];

const numberOrNull = value => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

class IndmoneySectorExporter {
  async requestPage(category, offset) {
    const url = new URL(API_BASE);
    url.searchParams.set('category', category.slug);
    url.searchParams.set('group', 'sectors');
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('limit', String(PAGE_SIZE));
    url.searchParams.set('active', 'true');

    let lastError;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; IndmoneySectorWorkbook/1.0)',
            Origin: 'https://www.indmoney.com',
            Referer: `https://www.indmoney.com/stocks/sectors/${category.slug}`
          },
          signal: AbortSignal.timeout(30000)
        });
        if (!response.ok) throw new Error(`HTTP ${response.status} for ${category.name}`);
        const payload = await response.json();
        if (!Array.isArray(payload.data)) throw new Error(`Unexpected data format for ${category.name}`);
        return payload;
      } catch (error) {
        lastError = error;
        if (attempt < 3) await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      }
    }
    throw lastError;
  }

  async fetchCategory(category) {
    const stocks = [];
    let offset = 0;
    let total = Number.POSITIVE_INFINITY;

    while (offset < total) {
      const payload = await this.requestPage(category, offset);
      total = numberOrNull(payload.count) ?? offset + payload.data.length;
      if (payload.data.length === 0) break;
      stocks.push(...payload.data);
      offset += payload.data.length;
      if (payload.data.length < PAGE_SIZE) break;
    }

    return { category, stocks };
  }

  async fetchCategories() {
    const results = new Array(CATEGORIES.length);
    let nextIndex = 0;
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, CATEGORIES.length) }, async () => {
      while (nextIndex < CATEGORIES.length) {
        const index = nextIndex++;
        results[index] = await this.fetchCategory(CATEGORIES[index]);
      }
    }));
    return results;
  }

  collectUnder20(categoryResults) {
    const stocksById = new Map();
    for (const { category, stocks } of categoryResults) {
      for (const stock of stocks) {
        const price = numberOrNull(stock.price);
        if (price === null || price <= 0 || price >= 20) continue;
        const key = stock.companyCode || stock.symbol || stock.slug || stock.name;
        let entry = stocksById.get(key);
        if (!entry) {
          const relativePath = stock.relativepath || `/stocks/${stock.slug}-share-price`;
          const stockLink = stock.navlinks?.web || new URL(relativePath, STOCKS_BASE).href;
          entry = {
            sectorNames: new Set(),
            company: stock.name,
            price,
            marketCap: numberOrNull(stock.mcap),
            promoter: numberOrNull(stock.promoter_holding ?? stock.promoter),
            public: numberOrNull(stock.public_holding ?? stock.public),
            roce: numberOrNull(stock.roce),
            roe: numberOrNull(stock.roe),
            pledged: numberOrNull(stock.pledged_percentage ?? stock.pledged),
            debt: numberOrNull(stock.debt_to_equity ?? stock.debtToEquity),
            ttmGrowth: numberOrNull(stock.profit_growth_ttm ?? stock.profitGrowthTtm),
            threeYGrowth: numberOrNull(stock.profit_growth_3y ?? stock.profitGrowth3Y),
            link: stockLink
          };
          stocksById.set(key, entry);
        }
        entry.sectorNames.add(category.name);
      }
    }

    return [...stocksById.values()]
      .map(stock => ({ ...stock, sector: [...stock.sectorNames].join('; ') }))
      .sort((left, right) => left.price - right.price || left.company.localeCompare(right.company));
  }

  writeWorkbook(stocks) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'INDmoney sector export';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Stocks under 20Rs');
    const headers = [
      'Sector', 'Company', 'Price ₹', 'Market Cap ₹ Cr', 'Promoter %', 'Public %',
      'ROCE %', 'ROE %', 'Pledged %', 'Debt/Equity', 'TTM Growth %', '3Y Growth %', 'Stock Page Link'
    ];
    sheet.addRow(headers);
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
    sheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    sheet.getRow(1).height = 32;

    for (const stock of stocks) {
      const row = sheet.addRow([
        stock.sector, stock.company, stock.price, stock.marketCap, stock.promoter, stock.public,
        stock.roce, stock.roe, stock.pledged, stock.debt, stock.ttmGrowth, stock.threeYGrowth, stock.link
      ]);
      row.getCell(3).numFmt = '0.00';
      row.getCell(4).numFmt = '#,##0.00';
      for (const column of [5, 6, 7, 8, 9, 10, 11, 12]) row.getCell(column).numFmt = '0.00';
      const companyCell = row.getCell(2);
      companyCell.value = { text: stock.company, hyperlink: stock.link, tooltip: stock.link };
      companyCell.font = { color: { argb: 'FF0000FF' }, underline: true };
      const linkCell = row.getCell(13);
      linkCell.value = { text: stock.link, hyperlink: stock.link, tooltip: stock.link };
      linkCell.font = { color: { argb: 'FF0000FF' }, underline: true };
    }

    sheet.columns = [
      { width: 38 }, { width: 38 }, { width: 12 }, { width: 18 }, { width: 14 },
      { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 14 },
      { width: 14 }, { width: 14 }, { width: 58 }
    ];
    return workbook.xlsx.writeFile(path.join(__dirname, OUTPUT));
  }

  async run() {
    console.log(`Loading ${CATEGORIES.length} INDmoney sectors...`);
    const categoryResults = await this.fetchCategories();
    const stocks = this.collectUnder20(categoryResults);
    await this.writeWorkbook(stocks);
    const rowsBySector = categoryResults.reduce((count, { stocks: sectorStocks }) => count + sectorStocks.length, 0);
    console.log(`Saved ${OUTPUT}: ${stocks.length} unique stocks under ₹20, ${CATEGORIES.length} sectors checked, ${rowsBySector} sector-stock records scanned.`);
  }
}

new IndmoneySectorExporter().run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
