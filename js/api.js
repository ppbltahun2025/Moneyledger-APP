// Lapisan komunikasi ke backend (Google Apps Script).
// Session (idToken + spreadsheetId) disimpan di sessionStorage browser saja,
// bukan di server manapun.

const Session = {
  get idToken() { return sessionStorage.getItem('ml_idToken'); },
  get spreadsheetId() { return sessionStorage.getItem('ml_spreadsheetId'); },
  get name() { return sessionStorage.getItem('ml_name'); },
  get email() { return sessionStorage.getItem('ml_email'); },
  set(user, idToken) {
    sessionStorage.setItem('ml_idToken', idToken);
    sessionStorage.setItem('ml_spreadsheetId', user.spreadsheetId);
    sessionStorage.setItem('ml_name', user.name);
    sessionStorage.setItem('ml_email', user.email);
  },
  clear() { sessionStorage.clear(); },
  isLoggedIn() { return !!this.idToken && !!this.spreadsheetId; }
};

async function apiCall(action, params = {}) {
  const body = new URLSearchParams({
    action,
    idToken: Session.idToken || params.idToken || '',
    spreadsheetId: Session.spreadsheetId || '',
    ...params
  });
  const res = await fetch(window.APP_CONFIG.APPS_SCRIPT_URL, {
    method: 'POST',
    body
  });
  if (!res.ok) throw new Error('Gagal menghubungi server (' + res.status + ')');
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Terjadi kesalahan');
  return data;
}

async function loginWithGoogleToken(idToken) {
  const res = await fetch(window.APP_CONFIG.APPS_SCRIPT_URL, {
    method: 'POST',
    body: new URLSearchParams({ action: 'login', idToken })
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Login gagal');
  Session.set(data.user, idToken);
  return data.user;
}

function requireLogin() {
  if (!Session.isLoggedIn()) {
    window.location.href = 'index.html';
  }
}
