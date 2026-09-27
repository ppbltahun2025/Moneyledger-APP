// Store: satu API yang sama dipakai semua halaman, entah user pilih
// "Tanpa akun" (data di localStorage device ini) atau "Akun" (data di backend).

const GUEST_KEYS = { tx: 'ml_guest_tx', targets: 'ml_guest_targets', journal: 'ml_guest_journal' };

const Store = {
  getMode() { return localStorage.getItem('ml_mode') || null; }, // 'guest' | 'account'

  isLoggedIn() {
    const mode = this.getMode();
    if (mode === 'guest') return true;
    if (mode === 'account') return !!(sessionStorage.getItem('ml_spreadsheetId') && sessionStorage.getItem('ml_sessionToken'));
    return false;
  },

  startGuest() {
    localStorage.setItem('ml_mode', 'guest');
    if (!localStorage.getItem(GUEST_KEYS.tx)) localStorage.setItem(GUEST_KEYS.tx, '[]');
    if (!localStorage.getItem(GUEST_KEYS.targets)) localStorage.setItem(GUEST_KEYS.targets, '[]');
    if (!localStorage.getItem(GUEST_KEYS.journal)) localStorage.setItem(GUEST_KEYS.journal, '[]');
  },

  setAccountSession(user) {
    localStorage.setItem('ml_mode', 'account');
    sessionStorage.setItem('ml_username', user.username);
    sessionStorage.setItem('ml_spreadsheetId', user.spreadsheetId);
    sessionStorage.setItem('ml_sessionToken', user.sessionToken);
  },

  displayName() {
    const mode = this.getMode();
    if (mode === 'guest') return 'Mode Tamu (device ini)';
    if (mode === 'account') return sessionStorage.getItem('ml_username') || '';
    return '';
  },

  hasGuestData() {
    const tx = JSON.parse(localStorage.getItem(GUEST_KEYS.tx) || '[]');
    const t = JSON.parse(localStorage.getItem(GUEST_KEYS.targets) || '[]');
    const j = JSON.parse(localStorage.getItem(GUEST_KEYS.journal) || '[]');
    return tx.length > 0 || t.length > 0 || j.length > 0;
  },

  // Kirim data tamu yang sudah ada ke akun baru, lalu bersihkan data lokal.
  async migrateGuestDataToAccount() {
    const tx = localStorage.getItem(GUEST_KEYS.tx) || '[]';
    const targets = localStorage.getItem(GUEST_KEYS.targets) || '[]';
    const journal = localStorage.getItem(GUEST_KEYS.journal) || '[]';
    if (JSON.parse(tx).length === 0 && JSON.parse(targets).length === 0 && JSON.parse(journal).length === 0) return;

    await backendCall('migrateGuestData', {
      spreadsheetId: sessionStorage.getItem('ml_spreadsheetId'),
      sessionToken: sessionStorage.getItem('ml_sessionToken'),
      transactions: tx, targets, journal
    });
    localStorage.removeItem(GUEST_KEYS.tx);
    localStorage.removeItem(GUEST_KEYS.targets);
    localStorage.removeItem(GUEST_KEYS.journal);
  },

  logout() {
    localStorage.removeItem('ml_mode');
    sessionStorage.clear();
    window.location.href = 'index.html';
  },

  // ---------- Data operations (bercabang sesuai mode) ----------
  async getData() {
    if (this.getMode() === 'guest') {
      return {
        transactions: JSON.parse(localStorage.getItem(GUEST_KEYS.tx) || '[]'),
        targets: JSON.parse(localStorage.getItem(GUEST_KEYS.targets) || '[]'),
        journal: JSON.parse(localStorage.getItem(GUEST_KEYS.journal) || '[]')
      };
    }
    return backendCall('getData', this._accountParams());
  },

  async getReport() {
    if (this.getMode() === 'guest') {
      const { transactions, targets } = await this.getData();
      return { report: buildReportJS(transactions, targets) };
    }
    return backendCall('getReport', this._accountParams());
  },

  async addTransaction(tx) {
    if (this.getMode() === 'guest') {
      const list = JSON.parse(localStorage.getItem(GUEST_KEYS.tx) || '[]');
      list.push({ id: 'local-' + Date.now(), ...tx, amount: Number(tx.amount) });
      localStorage.setItem(GUEST_KEYS.tx, JSON.stringify(list));
      return;
    }
    return backendCall('addTransaction', { ...this._accountParams(), tx: JSON.stringify(tx) });
  },

  async setTarget(period, periodKey, targetAmount) {
    if (this.getMode() === 'guest') {
      const list = JSON.parse(localStorage.getItem(GUEST_KEYS.targets) || '[]');
      const existing = list.find(t => t.period === period && String(t.periodKey) === String(periodKey));
      if (existing) existing.targetAmount = Number(targetAmount);
      else list.push({ period, periodKey, targetAmount: Number(targetAmount) });
      localStorage.setItem(GUEST_KEYS.targets, JSON.stringify(list));
      return;
    }
    return backendCall('setTarget', { ...this._accountParams(), period, periodKey, targetAmount });
  },

  async addJournal(date, entry) {
    if (this.getMode() === 'guest') {
      const list = JSON.parse(localStorage.getItem(GUEST_KEYS.journal) || '[]');
      list.push({ date, entry });
      localStorage.setItem(GUEST_KEYS.journal, JSON.stringify(list));
      return;
    }
    return backendCall('addJournal', { ...this._accountParams(), date, entry });
  },

  _accountParams() {
    return { spreadsheetId: sessionStorage.getItem('ml_spreadsheetId'), sessionToken: sessionStorage.getItem('ml_sessionToken') };
  }
};

function requireSession() {
  if (!Store.isLoggedIn()) window.location.href = 'index.html';
}
