requireLogin();
renderSidebar('transactions.html');

function rupiah(n) { return 'Rp' + Math.round(n).toLocaleString('id-ID'); }

document.getElementById('tx-date').valueAsDate = new Date();

document.getElementById('tx-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const tx = {
    date: document.getElementById('tx-date').value,
    type: document.getElementById('tx-type').value,
    category: document.getElementById('tx-category').value,
    amount: document.getElementById('tx-amount').value,
    note: document.getElementById('tx-note').value
  };
  try {
    await apiCall('addTransaction', { tx: JSON.stringify(tx) });
    e.target.reset();
    document.getElementById('tx-date').valueAsDate = new Date();
    loadLedger();
  } catch (err) {
    alert('Gagal menyimpan: ' + err.message);
  }
});

async function loadLedger() {
  const { transactions } = await apiCall('getData');
  const rows = transactions.slice().reverse();
  document.getElementById('full-ledger').innerHTML =
    `<div class="ledger-row head"><div>Tanggal</div><div>Kategori / Catatan</div><div>Jenis</div><div>Jumlah</div></div>` +
    rows.map(t => `
      <div class="ledger-row">
        <div>${t.date}</div>
        <div>${t.category}${t.note ? ' — ' + t.note : ''}</div>
        <div><span class="tag">${t.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}</span></div>
        <div class="amt ${t.type}">${t.type === 'income' ? '+' : '-'}${rupiah(t.amount)}</div>
      </div>
    `).join('') || '<p style="color:var(--ink-soft); padding:12px 4px;">Belum ada transaksi.</p>';
}

loadLedger();
