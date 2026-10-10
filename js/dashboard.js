requireSession();
renderSidebar('dashboard.html');

const $recent = document.getElementById('recent-ledger');
$recent.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';

function todayKeys() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return { dayKey: localISO(now), weekKey: isoWeekKeyJS(now), monthKey: `${now.getFullYear()}-${month}`, yearKey: `${now.getFullYear()}` };
}

function drawWeek(transactions) {
  const days = [];
  for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(d); }
  const data = days.map(d => {
    const k = localISO(d), rows = transactions.filter(t => dateOnly(t.date) === k);
    return {
      label: d.toLocaleDateString('id-ID', { weekday: 'short' }),
      inc: rows.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0),
      exp: rows.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
    };
  });
  const max = Math.max(1, ...data.map(d => Math.max(d.inc, d.exp)));
  const box = document.getElementById('week-bars');
  box.innerHTML = data.map(d => `<div class="bar-col">
    <div class="bar-pair">
      <div class="bar in" data-h="${(d.inc / max) * 100}" title="Masuk ${rupiah(d.inc)}"></div>
      <div class="bar out" data-h="${(d.exp / max) * 100}" title="Keluar ${rupiah(d.exp)}"></div>
    </div><small>${esc(d.label)}</small></div>`).join('');
  requestAnimationFrame(() => requestAnimationFrame(() =>
    box.querySelectorAll('.bar').forEach(b => b.style.height = b.dataset.h + '%')));
}

function setTarget(prefix, income, target) {
  const txt = document.getElementById(prefix + '-target-text'), bar = document.getElementById(prefix + '-progress');
  if (!target) { txt.textContent = 'Belum diset'; bar.style.width = '0%'; return; }
  const pct = Math.min(100, (income / target) * 100);
  txt.textContent = `${rupiah(income)} / ${rupiah(target)}`;
  bar.classList.toggle('done', income >= target);
  requestAnimationFrame(() => requestAnimationFrame(() => bar.style.width = pct + '%'));
}

async function load() {
  document.getElementById('today-label').textContent = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  const keys = todayKeys();
  try {
    const [{ report }, { transactions }] = await Promise.all([Store.getReport(), Store.getData()]);
    const b = report.buckets;
    const set = (id, val) => countUp(document.getElementById(id), val || 0);

    set('stat-daily-income', b.daily[keys.dayKey]?.income);   set('stat-daily-expense', b.daily[keys.dayKey]?.expense);
    set('stat-weekly-income', b.weekly[keys.weekKey]?.income); set('stat-weekly-expense', b.weekly[keys.weekKey]?.expense);
    set('stat-monthly-income', b.monthly[keys.monthKey]?.income); set('stat-monthly-expense', b.monthly[keys.monthKey]?.expense);

    setTarget('monthly', b.monthly[keys.monthKey]?.income || 0, report.monthlyTarget[keys.monthKey]);
    setTarget('yearly', b.yearly[keys.yearKey]?.income || 0, report.yearlyTarget[keys.yearKey]);
    drawWeek(transactions);

    const recent = transactions.map(t => ({ ...t, date: dateOnly(t.date) }))
      .sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0)).slice(0, 8);
    Ledger.render($recent, recent, load, 'Belum ada transaksi. Tambahkan di halaman Transaksi.');
  } catch (e) {
    $recent.innerHTML = `<div class="empty">Gagal memuat data: ${esc(e.message)}</div>`;
    toast('Gagal memuat data: ' + e.message, { error: true });
  }
}
load();
