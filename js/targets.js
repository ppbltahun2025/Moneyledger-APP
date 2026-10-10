requireSession();
renderSidebar('targets.html');

const now = new Date();
document.getElementById('monthly-period').value = localISO(now).slice(0, 7);
document.getElementById('yearly-period').value = now.getFullYear();

const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const label = (period, key) => period === 'monthly' ? `${BULAN[Number(String(key).slice(5, 7)) - 1] || ''} ${String(key).slice(0, 4)}` : `Tahun ${key}`;

async function save(period, key, amount, msg) {
  try {
    await Store.setTarget(period, key, amount);
    Sound.coin(); toast(msg);
    await draw();
  } catch (err) { toast('Gagal: ' + err.message, { error: true }); }
}
document.getElementById('monthly-form').addEventListener('submit', e => {
  e.preventDefault();
  save('monthly', document.getElementById('monthly-period').value, document.getElementById('monthly-amount').value, 'Target bulanan disimpan');
  e.target.reset(); document.getElementById('monthly-period').value = localISO(now).slice(0, 7);
});
document.getElementById('yearly-form').addEventListener('submit', e => {
  e.preventDefault();
  save('yearly', document.getElementById('yearly-period').value, document.getElementById('yearly-amount').value, 'Target tahunan disimpan');
  e.target.reset(); document.getElementById('yearly-period').value = now.getFullYear();
});

const $list = document.getElementById('target-list');
let targets = [];

function cardHTML(t, income) {
  const amt = Number(t.targetAmount), pct = amt ? Math.min(100, (income / amt) * 100) : 0, done = amt && income >= amt;
  return `<div class="card lift" style="margin-bottom:12px" data-period="${esc(t.period)}" data-key="${esc(t.periodKey)}">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
      <div><b style="font-family:Fraunces,serif;font-size:17px">${esc(label(t.period, t.periodKey))}</b>
        <span class="tag" style="margin-left:8px">${t.period === 'monthly' ? 'Bulanan' : 'Tahunan'}</span>${done ? ' <span class="tag income">Tercapai 🎯</span>' : ''}</div>
      <div class="row-actions" style="opacity:1">
        <button class="icon-btn" data-act="edit" title="Ubah target" aria-label="Ubah target">✎</button>
        <button class="icon-btn danger" data-act="del" title="Hapus target" aria-label="Hapus target">✕</button>
      </div>
    </div>
    <div class="target-line" style="margin-top:10px;font-size:14px;color:var(--ink-soft)">
      <b style="color:var(--ink)">${rupiah(income)}</b> dari ${rupiah(amt)} · ${Math.round(pct)}%
    </div>
    <div class="progress-track"><div class="progress-fill${done ? ' done' : ''}" data-w="${pct}"></div></div>
  </div>`;
}

async function draw() {
  try {
    const { transactions, targets: tg } = await Store.getData();
    targets = tg.map(t => ({ ...t, periodKey: String(t.periodKey).slice(0, t.period === 'monthly' ? 7 : 4) }));
    const incomeFor = t => transactions.filter(x => x.type === 'income' && dateOnly(x.date).startsWith(t.periodKey))
      .reduce((s, x) => s + Number(x.amount), 0);
    const sorted = targets.slice().sort((a, b) => (a.period === b.period ? (a.periodKey < b.periodKey ? 1 : -1) : a.period === 'yearly' ? -1 : 1));
    $list.innerHTML = sorted.map(t => cardHTML(t, incomeFor(t))).join('') ||
      '<div class="empty">Belum ada target. Tentukan target pertamamu di atas, lalu bidik. 🎯</div>';
    requestAnimationFrame(() => requestAnimationFrame(() =>
      $list.querySelectorAll('.progress-fill').forEach(b => b.style.width = b.dataset.w + '%')));
  } catch (e) { $list.innerHTML = `<div class="empty">Gagal memuat: ${esc(e.message)}</div>`; }
}

$list.addEventListener('click', async e => {
  const b = e.target.closest('button[data-act]'); if (!b) return;
  const card = b.closest('.card'), period = card.dataset.period, key = card.dataset.key;
  const t = targets.find(x => x.period === period && String(x.periodKey) === key);
  if (b.dataset.act === 'edit') {
    const line = card.querySelector('.target-line');
    line.innerHTML = `<form style="display:flex;gap:8px;align-items:center"><input type="number" min="0" value="${esc(t.targetAmount)}" style="width:180px" aria-label="Target baru">
      <button class="icon-btn ok" type="submit" aria-label="Simpan">✓</button><button class="icon-btn" type="button" data-act="cancel" aria-label="Batal">↶</button></form>`;
    const inp = line.querySelector('input'); inp.focus(); inp.select();
    line.querySelector('form').onsubmit = ev => { ev.preventDefault(); save(period, key, inp.value, 'Target diperbarui'); };
    inp.onkeydown = ev => { if (ev.key === 'Escape') draw(); };
  }
  if (b.dataset.act === 'cancel') draw();
  if (b.dataset.act === 'del') {
    card.style.transition = 'opacity .3s, transform .3s'; card.style.opacity = 0; card.style.transform = 'translateX(24px)';
    try {
      await Store.deleteTarget(period, key); Sound.pop();
      toast(`Target ${label(period, key)} dihapus`, { action: 'Urungkan', onAction: () => save(period, key, t.targetAmount, 'Target dikembalikan') });
      setTimeout(draw, 280);
    } catch (err) { card.style.opacity = 1; card.style.transform = ''; toast('Gagal: ' + err.message, { error: true }); }
  }
});
draw();
