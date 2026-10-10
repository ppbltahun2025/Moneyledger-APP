requireSession();
renderSidebar('articles.html');

const CATS = ['Geopolitik', 'Saham', 'Emas', 'Sumber Daya', 'Ekonomi', 'Kripto', 'Pasar Global'];
const PAGE = 30;
let all = [], saved = new Set(), cat = '', shown = PAGE, filtered = [];
const $ = id => document.getElementById(id);

const dayOf = a => localISO(new Date(a.publishedAt));
function inferRegion(a) { return a.region || (['CNBC Indonesia', 'Bisnis.com'].includes(a.source) || a.category === 'Pasar Indonesia' ? 'id' : 'intl'); }

function apply() {
  const q = $('n-search').value.trim().toLowerCase(), from = $('n-from').value, to = $('n-to').value, region = $('n-region').value;
  filtered = all.filter(a => {
    const d = dayOf(a);
    return (!cat || a.category === cat) && (!region || inferRegion(a) === region) &&
      (!from || d >= from) && (!to || d <= to) &&
      (!q || (a.title + ' ' + (a.summary || '') + ' ' + a.source).toLowerCase().includes(q));
  });
  shown = PAGE; draw();
}

function googleNewsLink() {
  const q = $('n-search').value.trim() || 'ekonomi saham emas geopolitik', from = $('n-from').value, to = $('n-to').value;
  let s = q;
  if (from) s += ' after:' + from;
  if (to) { const d = new Date(to + 'T00:00:00'); d.setDate(d.getDate() + 1); s += ' before:' + localISO(d); }
  return 'https://news.google.com/search?q=' + encodeURIComponent(s) + '&hl=id&gl=ID&ceid=ID:id';
}

function cardHTML(a, i) {
  const isSaved = saved.has(a.link), reg = inferRegion(a) === 'id' ? 'Dalam negeri' : 'Luar negeri';
  return `<div class="article-card${isSaved ? ' saved' : ''}" data-i="${i}">
    <div class="source"><span>${esc(a.source)}</span><span>·</span><span>${esc(fmtDate(a.publishedAt))}</span>
      <span class="tag">${esc(a.category)}</span><span class="tag">${reg}</span></div>
    <h3><a href="${esc(a.link)}" target="_blank" rel="noopener">${esc(a.title)}</a></h3>
    ${a.summary ? `<p>${esc(a.summary)}</p>` : ''}
    <div class="foot"><span></span>
      <button class="secondary small" data-save ${isSaved ? 'disabled' : ''}>${isSaved ? '✓ Tersimpan di spreadsheet' : '☆ Simpan ke spreadsheet'}</button></div>
  </div>`;
}

function draw() {
  $('n-count').textContent = `${filtered.length} berita ditemukan`;
  const list = $('article-list');
  if (!filtered.length) {
    const hasDate = $('n-from').value || $('n-to').value;
    list.innerHTML = `<div class="empty">Tidak ada berita yang cocok di arsip.${hasDate ? `<br><br>Arsip hanya berisi berita sejak scraper pertama kali berjalan.
      <a href="${esc(googleNewsLink())}" target="_blank" rel="noopener">Cari tanggal ini di Google News ↗</a>` : ''}</div>`;
  } else list.innerHTML = filtered.slice(0, shown).map(cardHTML).join('');
  $('n-more').hidden = filtered.length <= shown;
}

async function backup(items, btn) {
  const fresh = items.filter(a => !saved.has(a.link));
  if (!fresh.length) return toast('Semua sudah tersimpan');
  if (btn) btn.disabled = true;
  try {
    // Kirim bertahap supaya permintaan ke Apps Script tidak terlalu besar.
    for (let i = 0; i < fresh.length; i += 50) {
      await Store.saveNews(fresh.slice(i, i + 50).map(a => ({ date: a.publishedAt, source: a.source, category: a.category, region: inferRegion(a), title: a.title, link: a.link, summary: a.summary || '' })));
    }
    fresh.forEach(a => saved.add(a.link));
    Sound.coin();
    toast(Store.getMode() === 'guest' ? `${fresh.length} berita disimpan di device ini (buat akun untuk backup ke spreadsheet)` : `${fresh.length} berita dicatat ke spreadsheet`);
    draw();
  } catch (e) { toast('Gagal backup: ' + e.message, { error: true }); }
  finally { if (btn) btn.disabled = false; }
}

$('article-list').addEventListener('click', e => {
  const b = e.target.closest('[data-save]'); if (!b) return;
  backup([filtered[Number(b.closest('.article-card').dataset.i)]], b);
});
$('n-backup').addEventListener('click', e => backup(filtered.slice(0, 300), e.target));
$('n-more').addEventListener('click', () => { shown += PAGE; draw(); });
['n-search'].forEach(id => $(id).addEventListener('input', apply));
['n-from', 'n-to', 'n-region'].forEach(id => $(id).addEventListener('change', () => {
  document.querySelectorAll('#n-quick .chip').forEach(c => c.classList.remove('on')); apply();
}));
$('n-quick').addEventListener('click', e => {
  const c = e.target.closest('.chip'); if (!c) return;
  document.querySelectorAll('#n-quick .chip').forEach(x => x.classList.toggle('on', x === c));
  const r = c.dataset.range, today = new Date();
  if (r === 'all') { $('n-from').value = ''; $('n-to').value = ''; }
  else if (r === '0') { $('n-from').value = $('n-to').value = localISO(today); }
  else if (r === '1') { const y = new Date(); y.setDate(y.getDate() - 1); $('n-from').value = $('n-to').value = localISO(y); }
  else { const f = new Date(); f.setDate(f.getDate() - Number(r)); $('n-from').value = localISO(f); $('n-to').value = localISO(today); }
  apply();
});

function buildCatChips() {
  const present = new Set(all.map(a => a.category));
  const cats = [...CATS.filter(c => present.has(c)), ...[...present].filter(c => !CATS.includes(c))];
  $('n-cats').innerHTML = `<button class="chip on" data-cat="">Semua topik</button>` + cats.map(c => `<button class="chip" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
  $('n-cats').onclick = e => {
    const c = e.target.closest('.chip'); if (!c) return;
    cat = c.dataset.cat; $('n-cats').querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === c)); apply();
  };
}

(async function init() {
  try {
    const data = await fetch('data/articles.json?_=' + Date.now()).then(r => { if (!r.ok) throw 0; return r.json(); });
    all = (data.articles || []).sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    const days = all.length ? dayOf(all[all.length - 1]) : '';
    $('updated-label').textContent = `Diperbarui ${new Date(data.updatedAt).toLocaleString('id-ID')} · ${all.length} berita di arsip${days ? ' sejak ' + fmtDate(days) : ''}. Judul, ringkasan singkat, dan tautan ke sumber asli.`;
    buildCatChips();
    try { const s = await Store.getSavedNews(); saved = new Set(s.links || []); } catch (e) { /* belum ada / offline */ }
    apply();
  } catch (e) {
    $('updated-label').textContent = 'Belum ada data berita.';
    $('article-list').innerHTML = '<div class="empty">Jalankan GitHub Action "Fetch News" dulu (lihat README).</div>';
  }
})();
