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
        <div id="user-name">${Store.displayName()}</div>
        ${Store.getMode() === 'guest' ? '<div style="margin-top:6px;"><a class="logout" href="register.html" style="text-decoration:none;">Buat akun (simpan permanen) →</a></div>' : ''}
        <div class="logout" onclick="Store.logout()" style="margin-top:6px;">Keluar</div>
      </div>
    </div>
  `;
}
