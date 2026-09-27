requireSession();
renderSidebar('dashboard.html');

function rupiah(n) { return 'Rp' + Math.round(n || 0).toLocaleString('id-ID'); }

function todayKeys() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return {
    dayKey: `${now.getFullYear()}-${month}-${day}`,
    weekKey: isoWeekKeyJS(now),
    monthKey: `${now.getFullYear()}-${month}`,
    yearKey: `${now.getFullYear()}`
  };
}

async function load() {
  document.getElementById('today-label').textContent = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const keys = todayKeys();

  try {
    const [{ report }, { transactions }] = await Promise.all([Store.getReport(), Store.getData()]);
    const b = report.buckets;
    const set = (id, val) => document.getElementById(id).textContent = rupiah(val);

    set('stat-daily-income', b.daily[keys.dayKey]?.income);
    set('stat-daily-expense', b.daily[keys.dayKey]?.expense);
    set('stat-weekly-income', b.weekly[keys.weekKey]?.income);
    set('stat-weekly-expense', b.weekly[keys.weekKey]?.expense);
    set('stat-monthly-income', b.monthly[keys.monthKey]?.income);
    set('stat-monthly-expense', b.monthly[keys.monthKey]?.expense);

    const monthlyIncome = b.monthly[keys.monthKey]?.income || 0;
    const yearlyIncome = b.yearly[keys.yearKey]?.income || 0;
    const monthlyTarget = report.monthlyTarget[keys.monthKey];
    const yearlyTarget = report.yearlyTarget[keys.yearKey];

    if (monthlyTarget) {
      document.getElementById('monthly-target-text').textContent = `${rupiah(monthlyIncome)} / ${rupiah(monthlyTarget)}`;
      document.getElementById('monthly-progress').style.width = Math.min(100, (monthlyIncome / monthlyTarget) * 100) + '%';
    }
    if (yearlyTarget) {
      document.getElementById('yearly-target-text').textContent = `${rupiah(yearlyIncome)} / ${rupiah(yearlyTarget)}`;
      document.getElementById('yearly-progress').style.width = Math.min(100, (yearlyIncome / yearlyTarget) * 100) + '%';
    }

    const recent = transactions.slice(-8).reverse();
    document.getElementById('recent-ledger').innerHTML =
      `<div class="ledger-row head"><div>Tanggal</div><div>Kategori / Catatan</div><div>Jenis</div><div>Jumlah</div></div>` +
      recent.map(t => `
        <div class="ledger-row">
          <div>${t.date}</div>
          <div>${t.category}${t.note ? ' — ' + t.note : ''}</div>
          <div><span class="tag">${t.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}</span></div>
          <div class="amt ${t.type}">${t.type === 'income' ? '+' : '-'}${rupiah(t.amount)}</div>
        </div>
      `).join('') || '<p style="color:var(--ink-soft); padding:12px 4px;">Belum ada transaksi. Tambahkan di halaman Transaksi.</p>';
  } catch (e) {
    alert('Gagal memuat data: ' + e.message);
  }
}

load();
