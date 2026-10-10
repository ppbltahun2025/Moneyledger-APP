requireSession();
renderSidebar('ebooks.html');

// ---------- Kalkulator bunga majemuk ----------
const g = id => document.getElementById(id);
function calc() {
  const P = +g('c-p').value, M = +g('c-m').value, R = +g('c-r').value / 100, Y = +g('c-y').value;
  g('o-p').textContent = rupiah(P); g('o-m').textContent = rupiah(M); g('o-r').textContent = g('c-r').value + '%'; g('o-y').textContent = Y + ' th';
  const r = R / 12; let bal = P;
  for (let i = 0; i < Y * 12; i++) bal = bal * (1 + r) + M;
  const put = P + M * Y * 12;
  g('c-out').textContent = rupiah(bal);
  g('c-sub').textContent = `Total disetor ${rupiah(put)} · hasil bunga ${rupiah(bal - put)}`;
}
['c-p', 'c-m', 'c-r', 'c-y'].forEach(id => g(id).addEventListener('input', calc));
calc();

// ---------- Pencarian Wikipedia (CORS terbuka, tanpa API key) ----------
const strip = h => h.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
g('w-form').addEventListener('submit', async e => {
  e.preventDefault();
  const q = g('w-q').value.trim(); if (!q) return;
  const out = g('w-out'); out.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div>';
  try {
    const url = 'https://id.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=6&srsearch=' + encodeURIComponent(q + ' keuangan OR ekonomi OR investasi');
    const res = await fetch(url).then(r => r.json());
    const hits = res.query.search;
    out.innerHTML = hits.map(h => `<div class="article-card" data-title="${esc(h.title)}">
      <div class="source">Wikipedia · CC BY-SA</div>
      <h3><a href="https://id.wikipedia.org/wiki/${encodeURIComponent(h.title.replace(/ /g, '_'))}" target="_blank" rel="noopener">${esc(h.title)}</a></h3>
      <p>${esc(strip(h.snippet))}…</p>
      <div class="foot"><span></span><button class="secondary small" data-sum>Tampilkan ringkasan</button></div></div>`).join('')
      || '<div class="empty">Tidak ada hasil. Coba kata kunci lain.</div>';
  } catch (err) { out.innerHTML = '<div class="empty">Gagal mengambil hasil. Periksa koneksi internet.</div>'; }
});
g('w-out').addEventListener('click', async e => {
  const b = e.target.closest('[data-sum]'); if (!b) return;
  const card = b.closest('.article-card'); b.disabled = true; b.textContent = 'Memuat…';
  try {
    const s = await fetch('https://id.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(card.dataset.title.replace(/ /g, '_'))).then(r => r.json());
    card.querySelector('p').textContent = s.extract || 'Ringkasan tidak tersedia.';
    b.remove();
  } catch (err) { b.disabled = false; b.textContent = 'Coba lagi'; }
});

// ---------- Tautan sumber resmi ----------
const LINKS = [
  ['Modul edukasi resmi OJK', 'https://www.ojk.go.id/id/kanal/edukasi-dan-perlindungan-konsumen/Pages/default.aspx', 'Buka OJK'],
  ['Sikapi Uangmu (OJK)', 'https://sikapiuangmu.ojk.go.id', 'Buka'],
  ['Edukasi pasar modal (BEI)', 'https://www.idx.co.id', 'Buka BEI'],
  ['Khan Academy: Finance and capital markets', 'https://www.khanacademy.org/economics-finance-domain/core-finance', 'Belajar gratis'],
  ['Rich Dad Poor Dad — Robert Kiyosaki', 'https://play.google.com/store/search?q=rich%20dad%20poor%20dad&c=books', 'Cari di Play Books'],
  ['The Psychology of Money — Morgan Housel', 'https://play.google.com/store/search?q=the%20psychology%20of%20money&c=books', 'Cari di Play Books'],
  ['Toko buku Gramedia (versi cetak)', 'https://www.gramedia.com/search?q=literasi%20keuangan', 'Cari di Gramedia']
];
g('links').innerHTML = LINKS.map(([t, u, l]) => `<div class="ledger-row" style="grid-template-columns:1fr 170px"><div>${esc(t)}</div><div><a href="${esc(u)}" target="_blank" rel="noopener">${esc(l)} ↗</a></div></div>`).join('');
