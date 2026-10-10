requireSession();
renderSidebar('transactions.html');

let all = [], typeFilter = 'all', query = '';
const $ledger = document.getElementById('full-ledger');
$ledger.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';

document.getElementById('tx-date').valueAsDate = new Date();

document.getElementById('tx-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const tx = {
    date: document.getElementById('tx-date').value,
    type: document.getElementById('tx-type').value,
    category: document.getElementById('tx-category').value.trim(),
    amount: document.getElementById('tx-amount').value,
    note: document.getElementById('tx-note').value.trim()
  };
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true;
  try {
    await Store.addTransaction(tx);
    e.target.reset();
    document.getElementById('tx-date').valueAsDate = new Date();
    Sound.coin();
    toast(`${tx.type === 'income' ? 'Pemasukan' : 'Pengeluaran'} ${rupiah(tx.amount)} tercatat`);
    await refresh();
    const first = $ledger.querySelector('.ledger-row:not(.head)');
    if (first) first.classList.add('fresh');
  } catch (err) {
    toast('Gagal menyimpan: ' + err.message, { error: true });
  } finally { btn.disabled = false; }
});

document.querySelectorAll('[data-type]').forEach(c => c.addEventListener('click', () => {
  typeFilter = c.dataset.type;
  document.querySelectorAll('[data-type]').forEach(x => x.classList.toggle('on', x === c));
  draw();
}));
document.getElementById('tx-search').addEventListener('input', e => { query = e.target.value.toLowerCase(); draw(); });

function draw() {
  const rows = all.filter(t =>
    (typeFilter === 'all' || t.type === typeFilter) &&
    (!query || (t.category + ' ' + (t.note || '')).toLowerCase().includes(query))
  );
  const inc = rows.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const exp = rows.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  document.getElementById('tx-summary').innerHTML =
    `<span>${rows.length} transaksi</span> · masuk <b style="color:var(--primary)">${rupiah(inc)}</b> · keluar <b style="color:var(--rust)">${rupiah(exp)}</b> · selisih <b>${rupiah(inc - exp)}</b>`;
  Ledger.render($ledger, rows, refresh, query || typeFilter !== 'all' ? 'Tidak ada transaksi yang cocok.' : 'Belum ada transaksi. Catat yang pertama di atas.');
}

async function refresh() {
  try {
    const { transactions } = await Store.getData();
    all = transactions.map(t => ({ ...t, date: dateOnly(t.date) }))
      .sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
    draw();
  } catch (e) { $ledger.innerHTML = `<div class="empty">Gagal memuat data: ${esc(e.message)}</div>`; }
}
refresh();
