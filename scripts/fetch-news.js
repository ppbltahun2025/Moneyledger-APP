// Dijalankan GitHub Actions (.github/workflows/fetch-news.yml) beberapa kali sehari.
// Mengumpulkan judul + ringkasan singkat + tautan dari RSS publik (tanpa API key),
// menggabungkannya dengan arsip lama, lalu menulis data/articles.json.
// Isi artikel penuh sengaja TIDAK disalin (hak cipta & paywall): pembaca dibawa ke sumber asli.

const Parser = require('rss-parser');
const fs = require('fs');
const path = require('path');

const parser = new Parser({ timeout: 20000, headers: { 'User-Agent': 'Mozilla/5.0 MoneyLedgerBot' } });

// Google News RSS: pencarian per topik. Sangat produktif dan bisa difilter bahasa/negara.
const gn = (q, lang) => lang === 'id'
  ? `https://news.google.com/rss/search?q=${encodeURIComponent(q + ' when:2d')}&hl=id&gl=ID&ceid=ID:id`
  : `https://news.google.com/rss/search?q=${encodeURIComponent(q + ' when:2d')}&hl=en-US&gl=US&ceid=US:en`;

// region: 'id' = dalam negeri, 'intl' = luar negeri. category: topik utama.
// Tambah/kurangi sumber kapan saja. Feed yang gagal dilewati, tidak menggagalkan yang lain.
const FEEDS = [
  // ---- Dalam negeri: portal langsung ----
  { url: 'https://www.cnbcindonesia.com/market/rss', source: 'CNBC Indonesia', category: 'Saham', region: 'id' },
  { url: 'https://www.cnbcindonesia.com/news/rss', source: 'CNBC Indonesia', category: 'Ekonomi', region: 'id' },
  { url: 'https://www.bisnis.com/rss', source: 'Bisnis.com', category: 'Ekonomi', region: 'id' },
  { url: 'https://www.antaranews.com/rss/ekonomi.xml', source: 'Antara', category: 'Ekonomi', region: 'id' },
  { url: 'https://www.antaranews.com/rss/dunia.xml', source: 'Antara', category: 'Geopolitik', region: 'id' },
  { url: 'https://www.cnnindonesia.com/ekonomi/rss', source: 'CNN Indonesia', category: 'Ekonomi', region: 'id' },
  { url: 'https://www.cnnindonesia.com/internasional/rss', source: 'CNN Indonesia', category: 'Geopolitik', region: 'id' },
  { url: 'https://finance.detik.com/rss', source: 'Detik Finance', category: 'Ekonomi', region: 'id' },
  { url: 'https://www.kontan.co.id/rss', source: 'Kontan', category: 'Ekonomi', region: 'id' },
  // ---- Dalam negeri: topik via Google News ----
  { url: gn('geopolitik', 'id'), source: 'Google News ID', category: 'Geopolitik', region: 'id' },
  { url: gn('IHSG saham', 'id'), source: 'Google News ID', category: 'Saham', region: 'id' },
  { url: gn('harga emas Antam', 'id'), source: 'Google News ID', category: 'Emas', region: 'id' },
  { url: gn('batu bara nikel sawit komoditas', 'id'), source: 'Google News ID', category: 'Sumber Daya', region: 'id' },
  { url: gn('minyak gas energi tambang', 'id'), source: 'Google News ID', category: 'Sumber Daya', region: 'id' },
  { url: gn('ekonomi Indonesia rupiah BI', 'id'), source: 'Google News ID', category: 'Ekonomi', region: 'id' },
  { url: gn('bitcoin kripto', 'id'), source: 'Google News ID', category: 'Kripto', region: 'id' },
  // ---- Luar negeri: media langsung ----
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', source: 'BBC World', category: 'Geopolitik', region: 'intl' },
  { url: 'https://feeds.bbci.co.uk/news/business/rss.xml', source: 'BBC Business', category: 'Ekonomi', region: 'intl' },
  { url: 'https://www.aljazeera.com/xml/rss/all.xml', source: 'Al Jazeera', category: 'Geopolitik', region: 'intl' },
  { url: 'https://www.theguardian.com/world/rss', source: 'The Guardian', category: 'Geopolitik', region: 'intl' },
  { url: 'https://www.theguardian.com/business/rss', source: 'The Guardian', category: 'Ekonomi', region: 'intl' },
  { url: 'https://thediplomat.com/feed/', source: 'The Diplomat', category: 'Geopolitik', region: 'intl' },
  { url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml', source: 'WSJ Markets', category: 'Pasar Global', region: 'intl' },
  { url: 'https://www.cnbc.com/id/10000664/device/rss/rss.html', source: 'CNBC', category: 'Pasar Global', region: 'intl' },
  { url: 'https://feeds.marketwatch.com/marketwatch/topstories/', source: 'MarketWatch', category: 'Pasar Global', region: 'intl' },
  { url: 'https://www.investing.com/rss/news_25.rss', source: 'Investing.com', category: 'Saham', region: 'intl' },
  { url: 'https://www.investing.com/rss/news_11.rss', source: 'Investing.com', category: 'Emas', region: 'intl' },
  { url: 'https://www.investing.com/rss/news_301.rss', source: 'Investing.com', category: 'Kripto', region: 'intl' },
  { url: 'https://www.mining.com/feed/', source: 'Mining.com', category: 'Sumber Daya', region: 'intl' },
  { url: 'https://oilprice.com/rss/main', source: 'OilPrice.com', category: 'Sumber Daya', region: 'intl' },
  // ---- Luar negeri: topik via Google News (Inggris) ----
  { url: gn('geopolitics', 'en'), source: 'Google News', category: 'Geopolitik', region: 'intl' },
  { url: gn('sanctions OR war OR ceasefire OR trade tariffs', 'en'), source: 'Google News', category: 'Geopolitik', region: 'intl' },
  { url: gn('stock market Wall Street', 'en'), source: 'Google News', category: 'Saham', region: 'intl' },
  { url: gn('gold price', 'en'), source: 'Google News', category: 'Emas', region: 'intl' },
  { url: gn('copper lithium nickel rare earths', 'en'), source: 'Google News', category: 'Sumber Daya', region: 'intl' },
  { url: gn('crude oil OPEC natural gas', 'en'), source: 'Google News', category: 'Sumber Daya', region: 'intl' }
];

// Topik ditentukan dari isi judul/ringkasan; kalau tidak ada kata kunci, pakai kategori bawaan feed.
const RULES = [
  ['Emas', /\b(emas|antam|gold|bullion|xau)\b/i],
  ['Kripto', /\b(bitcoin|btc|ethereum|kripto|crypto|stablecoin)\b/i],
  ['Sumber Daya', /\b(batu ?bara|coal|nikel|nickel|timah|tin|tembaga|copper|lithium|litium|rare earth|logam tanah jarang|minyak|crude|brent|opec|lng|gas alam|natural gas|sawit|palm oil|tambang|mining|komoditas|commodit)/i],
  ['Geopolitik', /(geopolitik|geopolitic|perang|war\b|gencatan|ceasefire|sanksi|sanction|tarif|tariff|nato|rusia|russia|ukraina|ukraine|gaza|israel|iran|tiongkok|china|taiwan|laut china selatan|south china sea|selat hormuz|hormuz|diplomat|konflik|conflict|embargo)/i],
  ['Saham', /\b(saham|ihsg|bei|idx|stock|stocks|wall street|nasdaq|dow jones|s&p|nikkei|ipo|dividen)\b/i]
];
function classify(item, feed) {
  const text = (item.title || '') + ' ' + (item.contentSnippet || '');
  for (const [cat, re] of RULES) if (re.test(text)) return cat;
  return feed.category;
}

const MAX_PER_FEED = 40;
const KEEP_DAYS = 120;
const MAX_TOTAL = 6000;

const clean = s => String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const normTitle = t => t.toLowerCase().replace(/\s+-\s+[^-]+$/, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
// Google News menambahkan " - Nama Media" di akhir judul: pecah supaya sumber asli terbaca.
function splitSource(title, feed, item) {
  if (feed.source.startsWith('Google News')) {
    const src = (item.creator || (item.source && item.source.title) || '').trim() || (title.match(/\s-\s([^-]+)$/) || [])[1];
    return { title: title.replace(/\s-\s[^-]+$/, ''), source: src ? src.trim() : feed.source };
  }
  return { title, source: feed.source };
}

async function fetchFeed(feed) {
  try {
    const parsed = await parser.parseURL(feed.url);
    return (parsed.items || []).slice(0, MAX_PER_FEED).map(item => {
      const { title, source } = splitSource(clean(item.title) || '(tanpa judul)', feed, item);
      const d = new Date(item.isoDate || item.pubDate || Date.now());
      return {
        title, source,
        category: classify(item, feed),
        region: feed.region,
        link: item.link || '#',
        publishedAt: isNaN(d) ? new Date().toISOString() : d.toISOString(),
        // Ringkasan singkat saja, bukan isi artikel penuh.
        summary: clean(item.contentSnippet || item.summary).slice(0, 220)
      };
    }).filter(a => a.link !== '#');
  } catch (err) {
    console.error('Gagal ambil feed:', feed.url, '-', err.message);
    return [];
  }
}

async function main() {
  const outPath = path.join(__dirname, '..', 'data', 'articles.json');
  let old = [];
  try { old = JSON.parse(fs.readFileSync(outPath, 'utf8')).articles || []; } catch (e) { /* belum ada arsip */ }

  // Ambil per kelompok kecil supaya tidak membanjiri satu host.
  const fresh = [];
  for (let i = 0; i < FEEDS.length; i += 6) {
    const batch = await Promise.all(FEEDS.slice(i, i + 6).map(fetchFeed));
    fresh.push(...batch.flat());
  }
  console.log(`Berita baru terambil: ${fresh.length} dari ${FEEDS.length} feed`);

  // Gabung arsip lama + baru, buang duplikat (tautan atau judul sama), buang yang terlalu lama.
  const cutoff = Date.now() - KEEP_DAYS * 86400000;
  const seenLink = new Set(), seenTitle = new Set(), merged = [];
  for (const a of [...fresh, ...old]) {
    const nt = normTitle(a.title);
    if (seenLink.has(a.link) || seenTitle.has(nt)) continue;
    if (new Date(a.publishedAt).getTime() < cutoff) continue;
    seenLink.add(a.link); seenTitle.add(nt); merged.push(a);
  }
  merged.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  const articles = merged.slice(0, MAX_TOTAL);

  fs.writeFileSync(outPath, JSON.stringify({ updatedAt: new Date().toISOString(), articles }));
  console.log(`Selesai. ${articles.length} artikel di arsip -> ${outPath}`);
}

main();
