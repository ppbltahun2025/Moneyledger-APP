requireLogin();
renderSidebar('dashboard.html');

function rupiah(n) {
  return 'Rp' + Math.round(n).toLocaleString('id-ID');
}

function todayKeys() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const dayKey = `${now.getFullYear()}-${month}-${day}`;
  const monthKey = `${now.getFullYear()}-${month}`;
  const yearKey = `${now.getFullYear()}`;

  // ISO week key, dihitung sama seperti di backend (Code.gs) biar konsisten
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dnum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dnum + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  const weekKey = d.getUTCFullYear() + '-W' + String(week).padStart(2, '0');

  return { dayKey, weekKey, monthKey, yearKey };
}

async function load() {
  document.getElementById('today-label').textContent = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const keys = todayKeys();

  try {
    const [{ report }, { transactions }] = await Promise.all([
      apiCall('getReport'),
      apiCall('getData')
    ]);

    const b = report.buckets;
    const set = (id, val) => document.getElementById(id).textContent = rupiah(val || 0);

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
      const pct = Math.min(100, (monthlyIncome / monthlyTarget) * 100);
      document.getElementById('monthly-target-text').textContent = `${rupiah(monthlyIncome)} / ${rupiah(monthlyTarget)}`;
      document.getElementById('monthly-progress').style.width = pct + '%';
    }
    if (yearlyTarget) {
      const pct = Math.min(100, (yearlyIncome / yearlyTarget) * 100);
      document.getElementById('yearly-target-text').textContent = `${rupiah(yearlyIncome)} / ${rupiah(yearlyTarget)}`;
      document.getElementById('yearly-progress').style.width = pct + '%';
    }

    const recent = transactions.slice(-8).reverse();
    const ledger = document.getElementById('recent-ledger');
    ledger.innerHTML = `<div class="ledger-row head"><div>Tanggal</div><div>Kategori / Catatan</div><div>Jenis</div><div>Jumlah</div></div>` +
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
