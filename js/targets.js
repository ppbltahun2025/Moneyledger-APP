requireLogin();
renderSidebar('targets.html');

document.getElementById('monthly-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const periodKey = document.getElementById('monthly-period').value; // yyyy-MM
  const amount = document.getElementById('monthly-amount').value;
  try {
    await apiCall('setTarget', { period: 'monthly', periodKey, targetAmount: amount });
    alert('Target bulanan disimpan.');
  } catch (err) { alert('Gagal: ' + err.message); }
});

document.getElementById('yearly-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const periodKey = document.getElementById('yearly-period').value;
  const amount = document.getElementById('yearly-amount').value;
  try {
    await apiCall('setTarget', { period: 'yearly', periodKey, targetAmount: amount });
    alert('Target tahunan disimpan.');
  } catch (err) { alert('Gagal: ' + err.message); }
});
