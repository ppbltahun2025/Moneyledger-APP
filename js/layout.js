function renderSidebar(active) {
  const links = [
    { href: 'dashboard.html', label: 'Dashboard' },
    { href: 'transactions.html', label: 'Transaksi' },
    { href: 'targets.html', label: 'Target' },
    { href: 'articles.html', label: 'Berita & Pasar' },
    { href: 'ebooks.html', label: 'Literasi Keuangan' },
    { href: 'journal.html', label: 'Jurnal Harian' }
  ];

  const nav = links.map(l =>
    `<a class="nav-link${l.href === active ? ' active' : ''}" href="${l.href}">${l.label}</a>`
  ).join('');

  document.getElementById('sidebar-root').innerHTML = `
    <div class="sidebar">
      <div class="brand">Money<em>Ledger</em></div>
      <nav>${nav}</nav>
      <div class="user-box">
        <div id="user-name">${Session.name || ''}</div>
        <div class="logout" onclick="doLogout()">Keluar</div>
      </div>
    </div>
  `;
}

function doLogout() {
  Session.clear();
  window.location.href = 'index.html';
}
