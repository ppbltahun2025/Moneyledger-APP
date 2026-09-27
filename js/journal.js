requireLogin();
renderSidebar('journal.html');

document.getElementById('journal-date').valueAsDate = new Date();

document.getElementById('journal-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const date = document.getElementById('journal-date').value;
  const entry = document.getElementById('journal-entry').value;
  try {
    await apiCall('addJournal', { date, entry });
    e.target.reset();
    document.getElementById('journal-date').valueAsDate = new Date();
    loadJournal();
  } catch (err) { alert('Gagal menyimpan: ' + err.message); }
});

async function loadJournal() {
  const { journal } = await apiCall('getData');
  const rows = journal.slice().reverse();
  document.getElementById('journal-list').innerHTML = rows.map(j => `
    <div class="card" style="margin-bottom:10px;">
      <div class="stat-label">${j.date}</div>
      <p style="margin-top:6px; font-size:14.5px; white-space:pre-wrap;">${(j.entry || '').replace(/</g,'&lt;')}</p>
    </div>
  `).join('') || '<p style="color:var(--ink-soft);">Belum ada catatan.</p>';
}

loadJournal();
