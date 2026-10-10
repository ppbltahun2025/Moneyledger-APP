requireSession();
renderSidebar('journal.html');

document.getElementById('journal-date').valueAsDate = new Date();
let entries = [], query = '';
const $list = document.getElementById('journal-list');

document.getElementById('journal-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const date = document.getElementById('journal-date').value;
  const entry = document.getElementById('journal-entry').value;
  try {
    await Store.addJournal(date, entry);
    e.target.reset();
    document.getElementById('journal-date').valueAsDate = new Date();
    Sound.coin(); toast('Catatan tersimpan');
    await load();
    const first = $list.querySelector('.card'); if (first) first.classList.add('fresh-card');
  } catch (err) { toast('Gagal menyimpan: ' + err.message, { error: true }); }
});
document.getElementById('journal-search').addEventListener('input', e => { query = e.target.value.toLowerCase(); draw(); });

const viewHTML = j => `<div class="card journal-entry" data-id="${esc(j.id)}" title="Klik dua kali untuk mengubah">
  <div class="stat-label">${esc(fmtDate(j.date))}</div>
  <p>${esc(j.entry)}</p>
  <div class="row-actions"><button class="icon-btn" data-act="edit" aria-label="Ubah" title="Ubah">✎</button><button class="icon-btn danger" data-act="del" aria-label="Hapus" title="Hapus">✕</button></div></div>`;

function draw() {
  const rows = entries.filter(j => !query || (j.entry + ' ' + j.date).toLowerCase().includes(query));
  $list.innerHTML = rows.map(viewHTML).join('') || `<div class="empty">${query ? 'Tidak ada catatan yang cocok.' : 'Belum ada catatan. Tulis yang pertama di atas.'}</div>`;
}
async function load() {
  try {
    const { journal } = await Store.getData();
    entries = journal.map(j => ({ ...j, date: dateOnly(j.date) }))
      .sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
    draw();
  } catch (e) { $list.innerHTML = `<div class="empty">Gagal memuat: ${esc(e.message)}</div>`; }
}

function startEdit(card) {
  const j = entries.find(x => String(x.id) === card.dataset.id); if (!j) return;
  card.innerHTML = `<form><input type="date" name="date" value="${esc(j.date)}" required style="max-width:200px">
    <textarea name="entry" required>${esc(j.entry)}</textarea>
    <div style="display:flex;gap:8px"><button class="small" type="submit">Simpan</button><button class="small secondary" type="button" data-act="cancel">Batal</button></div></form>`;
  const f = card.querySelector('form'); f.elements.entry.focus();
  f.onsubmit = async ev => {
    ev.preventDefault();
    try { await Store.updateJournal(j.id, f.elements.date.value, f.elements.entry.value); Sound.coin(); toast('Catatan diperbarui'); load(); }
    catch (err) { toast('Gagal: ' + err.message, { error: true }); }
  };
  f.onkeydown = ev => { if (ev.key === 'Escape') draw(); };
}
$list.addEventListener('dblclick', e => {
  const card = e.target.closest('.journal-entry');
  if (card && !card.querySelector('form') && !e.target.closest('button')) startEdit(card);
});
$list.addEventListener('click', async e => {
  const b = e.target.closest('button[data-act]'); if (!b) return;
  const card = b.closest('.journal-entry'), j = entries.find(x => String(x.id) === card.dataset.id);
  if (b.dataset.act === 'edit') startEdit(card);
  if (b.dataset.act === 'cancel') draw();
  if (b.dataset.act === 'del' && j) {
    card.style.transition = 'opacity .3s, transform .3s'; card.style.opacity = 0; card.style.transform = 'translateX(24px)';
    try {
      await Store.deleteJournal(j.id); Sound.pop();
      toast('Catatan dihapus', { action: 'Urungkan', onAction: async () => { await Store.addJournal(j.date, j.entry); toast('Catatan dikembalikan'); load(); } });
      setTimeout(load, 280);
    } catch (err) { card.style.opacity = 1; card.style.transform = ''; toast('Gagal: ' + err.message, { error: true }); }
  }
});
load();
