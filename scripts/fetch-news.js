// Dijalankan oleh GitHub Actions (.github/workflows/fetch-news.yml) setiap hari.
// Mengambil berita dari beberapa RSS feed publik (gratis, tanpa API key),
// lalu menulis hasilnya ke data/articles.json.

const Parser = require('rss-parser');
const fs = require('fs');
const path = require('path');

const parser = new Parser({ timeout: 15000 });

// Kamu bisa tambah/kurangi sumber di sini kapan saja.
const FEEDS = [
  { url: 'https://www.investing.com/rss/news_25.rss', source: 'Investing.com', category: 'Saham' },
  { url: 'https://www.investing.com/rss/news_301.rss', source: 'Investing.com', category: 'Kripto' },
  { url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml', source: 'WSJ Markets', category: 'Pasar Global' },
  { url: 'https://www.cnbcindonesia.com/market/rss', source: 'CNBC Indonesia', category: 'Pasar Indonesia' },
  { url: 'https://www.bisnis.com/rss', source: 'Bisnis.com', category: 'Ekonomi' }
];

const MAX_PER_FEED = 6;
const MAX_TOTAL = 40;

async function fetchFeed(feed) {
  try {
    const parsed = await parser.parseURL(feed.url);
    return (parsed.items || []).slice(0, MAX_PER_FEED).map(item => ({
      title: item.title || '(tanpa judul)',
      source: feed.source,
      category: feed.category,
      link: item.link || '#',
      publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
      // Ringkasan singkat saja (bukan menyalin isi artikel penuh) — hormati hak cipta sumber.
      summary: (item.contentSnippet || item.summary || '').slice(0, 220)
    }));
  } catch (err) {
    console.error('Gagal ambil feed:', feed.url, err.message);
    return [];
  }
}

async function main() {
  const results = await Promise.all(FEEDS.map(fetchFeed));
  let articles = results.flat();

  articles.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  articles = articles.slice(0, MAX_TOTAL);

  const out = {
    updatedAt: new Date().toISOString(),
    articles
  };

  const outPath = path.join(__dirname, '..', 'data', 'articles.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`Selesai. ${articles.length} artikel ditulis ke ${outPath}`);
}

main();
