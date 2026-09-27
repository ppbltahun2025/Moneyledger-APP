// Perhitungan rekap harian/mingguan/bulanan/tahunan, versi JS (dipakai mode Tamu).
// Logikanya sama persis dengan buildReport_() di apps-script/Code.gs supaya
// hasilnya konsisten antara mode Tamu dan mode Akun.

function isoWeekKeyJS(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((date - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return date.getUTCFullYear() + '-W' + String(week).padStart(2, '0');
}

function buildReportJS(transactions, targets) {
  const buckets = { daily: {}, weekly: {}, monthly: {}, yearly: {} };

  transactions.forEach(t => {
    const d = new Date(t.date);
    if (isNaN(d)) return;
    const dayKey = t.date;
    const monthKey = t.date.slice(0, 7);
    const yearKey = t.date.slice(0, 4);
    const weekKey = isoWeekKeyJS(d);

    [['daily', dayKey], ['weekly', weekKey], ['monthly', monthKey], ['yearly', yearKey]].forEach(([bucket, key]) => {
      if (!buckets[bucket][key]) buckets[bucket][key] = { income: 0, expense: 0, net: 0 };
      if (t.type === 'income') buckets[bucket][key].income += Number(t.amount);
      else buckets[bucket][key].expense += Number(t.amount);
      buckets[bucket][key].net += (t.type === 'income' ? 1 : -1) * Number(t.amount);
    });
  });

  const monthlyTarget = {};
  const yearlyTarget = {};
  targets.forEach(t => {
    if (t.period === 'monthly') monthlyTarget[t.periodKey] = Number(t.targetAmount);
    if (t.period === 'yearly') yearlyTarget[t.periodKey] = Number(t.targetAmount);
  });

  return { buckets, monthlyTarget, yearlyTarget };
}
