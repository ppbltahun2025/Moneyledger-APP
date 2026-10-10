function renderSidebar(active) {
  const I = p => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const links = [
    { href: 'dashboard.html',    label: 'Dashboard',         cur: 'money',  page: 'dashboard',    ic: I('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>') },
    { href: 'transactions.html', label: 'Transaksi',         cur: 'money',  page: 'transactions', ic: I('<path d="M4 8h14l-3-3M20 16H6l3 3"/>') },
    { href: 'targets.html',      label: 'Target',            cur: 'target', page: 'targets',      ic: I('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8"/>') },
    { href: 'articles.html',     label: 'Berita & Pasar',    cur: 'news',   page: 'articles',     ic: I('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/>') },
    { href: 'ebooks.html',       label: 'Literasi Keuangan', cur: 'book',   page: 'ebooks',       ic: I('<path d="M3 5.5C6 4 9 4.5 12 6.5c3-2 6-2.5 9-1V19c-3-1.5-6-1-9 1-3-2-6-2.5-9-1z"/><path d="M12 6.5V20"/>') },
    { href: 'journal.html',      label: 'Jurnal Harian',     cur: 'pen',    page: 'journal',      ic: I('<path d="M4 20l1-5L16 4l4 4L9 19z"/><path d="M14 6l4 4"/>') }
  ];
  const cur = links.find(l => l.href === active);
  if (cur) document.body.dataset.page = cur.page;

  const nav = links.map(l =>
    `<a class="nav-link${l.href === active ? ' active' : ''}" data-cur="${l.cur}" href="${l.href}">${l.ic}<span>${l.label}</span></a>`
  ).join('');

  const isAccount = Store.getMode() === 'account';
  const sheetId = isAccount ? sessionStorage.getItem('ml_spreadsheetId') : '';

  document.getElementById('sidebar-root').innerHTML = `
    <div class="sidebar">
      <div class="brand">Money<em>Ledger</em></div>
      <nav>${nav}</nav>
      <div id="music-slot"></div>
      <div class="user-box">
        <div id="user-name">${esc(Store.displayName())}</div>
        ${Store.getMode() === 'guest' ? '<a href="register.html">Buat akun (simpan permanen) →</a><br>' : ''}
        ${sheetId ? `<a href="https://docs.google.com/spreadsheets/d/${esc(sheetId)}" target="_blank" rel="noopener">Buka spreadsheet backup ↗</a><br>` : ''}
        <button class="logout" onclick="Store.logout()">Keluar</button>
      </div>
    </div>`;
  Music.mount(document.getElementById('music-slot'));
}
