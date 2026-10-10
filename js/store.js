// Store: satu API yang sama dipakai semua halaman, entah user pilih
// "Tanpa akun" (data di localStorage device ini) atau "Akun" (data di backend).

const GUEST_KEYS = { tx: 'ml_guest_tx', targets: 'ml_guest_targets', journal: 'ml_guest_journal', news: 'ml_guest_news' };
const gRead = k => JSON.parse(localStorage.getItem(k) || '[]');
const gJournal = () => gRead(GUEST_KEYS.journal).map((j, i) => j.id ? j : { ...j, id: 'local-j' + i });
const gWrite = (k, v) => localStorage.setItem(k, JSON.stringify(v));

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
      transactions: tx, targets, journal,
      news: localStorage.getItem(GUEST_KEYS.news) || '[]'
    });
    localStorage.removeItem(GUEST_KEYS.news);
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
        journal: gJournal()
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
      const list = gJournal();
      list.push({ id: 'local-' + Date.now(), date, entry });
      gWrite(GUEST_KEYS.journal, list);
      return;
    }
    return backendCall('addJournal', { ...this._accountParams(), date, entry });
  },

  // ---------- Ubah & hapus ----------
  async updateTransaction(id, tx) {
    if (this.getMode() === 'guest') {
      const list = gRead(GUEST_KEYS.tx), i = list.findIndex(t => t.id === id);
      if (i < 0) throw new Error('Transaksi tidak ditemukan');
      list[i] = { ...list[i], ...tx, amount: Number(tx.amount) };
      return gWrite(GUEST_KEYS.tx, list);
    }
    return backendCall('updateTransaction', { ...this._accountParams(), id, tx: JSON.stringify(tx) });
  },
  async deleteTransaction(id) {
    if (this.getMode() === 'guest') return gWrite(GUEST_KEYS.tx, gRead(GUEST_KEYS.tx).filter(t => t.id !== id));
    return backendCall('deleteTransaction', { ...this._accountParams(), id });
  },
  async updateJournal(id, date, entry) {
    if (this.getMode() === 'guest') {
      const list = gJournal(), i = list.findIndex(j => j.id === id);
      if (i < 0) throw new Error('Catatan tidak ditemukan');
      list[i] = { ...list[i], date, entry };
      return gWrite(GUEST_KEYS.journal, list);
    }
    return backendCall('updateJournal', { ...this._accountParams(), id, date, entry });
  },
  async deleteJournal(id) {
    if (this.getMode() === 'guest') return gWrite(GUEST_KEYS.journal, gJournal().filter(j => j.id !== id));
    return backendCall('deleteJournal', { ...this._accountParams(), id });
  },
  async deleteTarget(period, periodKey) {
    if (this.getMode() === 'guest') {
      return gWrite(GUEST_KEYS.targets, gRead(GUEST_KEYS.targets).filter(t => !(t.period === period && String(t.periodKey) === String(periodKey))));
    }
    return backendCall('deleteTarget', { ...this._accountParams(), period, periodKey });
  },

  // ---------- Berita tersimpan (backup ke spreadsheet) ----------
  async saveNews(articles) {
    if (this.getMode() === 'guest') {
      const list = gRead(GUEST_KEYS.news), have = new Set(list.map(a => a.link));
      articles.forEach(a => { if (!have.has(a.link)) list.push(a); });
      gWrite(GUEST_KEYS.news, list);
      return { saved: articles.length, local: true };
    }
    return backendCall('saveNews', { ...this._accountParams(), articles: JSON.stringify(articles) });
  },
  async getSavedNews() {
    if (this.getMode() === 'guest') return { links: gRead(GUEST_KEYS.news).map(a => a.link) };
    return backendCall('getSavedNews', this._accountParams());
  },

  _accountParams() {
    return { spreadsheetId: sessionStorage.getItem('ml_spreadsheetId'), sessionToken: sessionStorage.getItem('ml_sessionToken') };
  }
};

function requireSession() {
  if (!Store.isLoggedIn()) window.location.href = 'index.html';
}
