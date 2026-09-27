// Lapisan komunikasi mentah ke backend (Google Apps Script).
// Dipakai oleh js/store.js — jangan panggil langsung dari halaman.

async function backendCall(action, params = {}) {
  const body = new URLSearchParams({ action, ...params });
  const res = await fetch(window.APP_CONFIG.APPS_SCRIPT_URL, { method: 'POST', body });
  if (!res.ok) throw new Error('Gagal menghubungi server (' + res.status + ')');
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Terjadi kesalahan');
  return data;
}
