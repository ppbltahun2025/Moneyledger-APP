/**
 * MoneyLedger — Backend (Google Apps Script)
 * ---------------------------------------------------
 * Auth: username + email + password (bukan lagi Google Sign-In).
 * - register  -> buat user belum-terverifikasi, kirim email verifikasi
 * - verify    -> aktifkan akun, buat spreadsheet pribadi (dibuka lewat link email)
 * - login     -> cek password, kembalikan sessionToken + spreadsheetId
 * - migrateGuestData -> pindahkan data localStorage (mode tamu) ke akun
 * - getData / addTransaction / setTarget / addJournal / getReport -> butuh sessionToken valid
 *
 * DEPLOY: sama seperti sebelumnya —
 *   Deploy -> New deployment -> Web app -> Execute as: Me, Who has access: Anyone
 */

const MASTER_SHEET_ID = '11Wxc4dUQFk4XnLrB81m3B2tTQl80fUPJB5SOdI4hJRA';
const USERS_SHEET_NAME = 'Users';
// Ganti ke URL Web App kamu sendiri setelah deploy pertama (dipakai untuk link verifikasi di email).
const WEB_APP_URL = 'GANTI_DENGAN_URL_WEB_APP_INI_SENDIRI';

const COLS = ['username', 'email', 'passwordHash', 'salt', 'verified', 'verificationToken', 'sessionToken', 'spreadsheetId', 'createdAt'];

// ---------- Master sheet helpers ----------
function getMasterSheet_() {
  const ss = SpreadsheetApp.openById(MASTER_SHEET_ID);
  let sheet = ss.getSheetByName(USERS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(USERS_SHEET_NAME);
    sheet.appendRow(COLS);
  }
  return sheet;
}

function colIndex_(name) { return COLS.indexOf(name); }

function findUserRow_(sheet, colName, value) {
  const data = sheet.getDataRange().getValues();
  const idx = colIndex_(colName);
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idx]) === String(value)) return { rowNum: i + 1, row: data[i] };
  }
  return null;
}

function rowToUser_(row) {
  const obj = {};
  COLS.forEach((c, i) => (obj[c] = row[i]));
  return obj;
}

// ---------- Password hashing (SHA-256 + salt) ----------
function hashPassword_(password, salt) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + ':' + salt);
  return digest.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

function randomToken_() { return Utilities.getUuid().replace(/-/g, ''); }

// ---------- Personal spreadsheet ----------
function createUserSpreadsheet_(username, email) {
  const ss = SpreadsheetApp.create('MoneyLedger — ' + username);
  const id = ss.getId();

  const tx = ss.getSheets()[0];
  tx.setName('Transactions');
  tx.appendRow(['id', 'date', 'type', 'category', 'amount', 'note']);

  const targets = ss.insertSheet('Targets');
  targets.appendRow(['period', 'periodKey', 'targetAmount']);

  const journal = ss.insertSheet('Journal');
  journal.appendRow(['date', 'entry']);

  try { DriveApp.getFileById(id).addEditor(email); } catch (e) { /* tidak fatal */ }

  return id;
}

// ---------- Actions ----------
function register_(p) {
  const username = String(p.username || '').trim();
  const email = String(p.email || '').trim().toLowerCase();
  const password = String(p.password || '');

  if (!username || !email || !password) return { ok: false, error: 'Username, email, dan password wajib diisi' };
  if (password.length < 6) return { ok: false, error: 'Password minimal 6 karakter' };

  const sheet = getMasterSheet_();
  if (findUserRow_(sheet, 'username', username)) return { ok: false, error: 'Username sudah dipakai' };
  if (findUserRow_(sheet, 'email', email)) return { ok: false, error: 'Email sudah terdaftar' };

  const salt = randomToken_();
  const passwordHash = hashPassword_(password, salt);
  const verificationToken = randomToken_();

  sheet.appendRow([username, email, passwordHash, salt, false, verificationToken, '', '', new Date().toISOString()]);

  const verifyLink = WEB_APP_URL + '?action=verify&token=' + verificationToken;
  try {
    MailApp.sendEmail({
      to: email,
      subject: 'Verifikasi akun MoneyLedger kamu',
      htmlBody: `<p>Halo <b>${username}</b>,</p>
        <p>Klik tombol di bawah untuk mengaktifkan akun MoneyLedger kamu:</p>
        <p><a href="${verifyLink}" style="background:#1B4332;color:#fff;padding:10px 18px;text-decoration:none;border-radius:4px;">Verifikasi Akun</a></p>
        <p>Atau salin link ini: ${verifyLink}</p>`
    });
  } catch (e) {
    return { ok: false, error: 'Gagal mengirim email verifikasi: ' + e };
  }

  return { ok: true, message: 'Cek email kamu untuk verifikasi akun.' };
}

function verifyHtml_(token) {
  const sheet = getMasterSheet_();
  const found = findUserRow_(sheet, 'verificationToken', token);
  if (!found) {
    return HtmlService.createHtmlOutput('<h2>Link tidak valid atau sudah dipakai.</h2>');
  }
  const user = rowToUser_(found.row);
  if (user.verified === true || user.verified === 'true' || user.verified === 'TRUE') {
    return HtmlService.createHtmlOutput('<h2>Akun sudah terverifikasi sebelumnya. Silakan login.</h2>');
  }
  const spreadsheetId = createUserSpreadsheet_(user.username, user.email);
  sheet.getRange(found.rowNum, colIndex_('verified') + 1).setValue(true);
  sheet.getRange(found.rowNum, colIndex_('spreadsheetId') + 1).setValue(spreadsheetId);

  return HtmlService.createHtmlOutput(
    '<h2>Akun berhasil diverifikasi! 🎉</h2><p>Silakan kembali ke MoneyLedger dan login dengan username & password kamu.</p>'
  );
}

function login_(p) {
  const identifier = String(p.identifier || '').trim();
  const password = String(p.password || '');
  const sheet = getMasterSheet_();

  let found = findUserRow_(sheet, 'username', identifier);
  if (!found) found = findUserRow_(sheet, 'email', identifier.toLowerCase());
  if (!found) return { ok: false, error: 'Akun tidak ditemukan' };

  const user = rowToUser_(found.row);
  if (!(user.verified === true || user.verified === 'true' || user.verified === 'TRUE')) {
    return { ok: false, error: 'Akun belum diverifikasi. Cek email kamu.' };
  }
  const hash = hashPassword_(password, user.salt);
  if (hash !== user.passwordHash) return { ok: false, error: 'Password salah' };

  const sessionToken = randomToken_();
  sheet.getRange(found.rowNum, colIndex_('sessionToken') + 1).setValue(sessionToken);

  return {
    ok: true,
    user: { username: user.username, email: user.email, spreadsheetId: user.spreadsheetId, sessionToken }
  };
}

function verifySession_(spreadsheetId, sessionToken) {
  const sheet = getMasterSheet_();
  const found = findUserRow_(sheet, 'spreadsheetId', spreadsheetId);
  if (!found) return false;
  const user = rowToUser_(found.row);
  return user.sessionToken && String(user.sessionToken) === String(sessionToken);
}

// ---------- Data helpers (per-user spreadsheet) ----------
function sheetOf_(spreadsheetId, name) { return SpreadsheetApp.openById(spreadsheetId).getSheetByName(name); }

function readRows_(sheet) {
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  return values.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => (obj[h] = row[i]));
    return obj;
  });
}

function addTransaction_(spreadsheetId, tx) {
  const sheet = sheetOf_(spreadsheetId, 'Transactions');
  const id = Utilities.getUuid();
  sheet.appendRow([id, tx.date, tx.type, tx.category, Number(tx.amount), tx.note || '']);
  return id;
}

function setTarget_(spreadsheetId, period, periodKey, targetAmount) {
  const sheet = sheetOf_(spreadsheetId, 'Targets');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === period && String(data[i][1]) === String(periodKey)) {
      sheet.getRange(i + 1, 3).setValue(Number(targetAmount));
      return;
    }
  }
  sheet.appendRow([period, periodKey, Number(targetAmount)]);
}

function addJournal_(spreadsheetId, date, entry) {
  const sheet = sheetOf_(spreadsheetId, 'Journal');
  sheet.appendRow([date, entry]);
}

function migrateGuestData_(spreadsheetId, transactions, targets, journal) {
  (transactions || []).forEach(t => addTransaction_(spreadsheetId, t));
  (targets || []).forEach(t => setTarget_(spreadsheetId, t.period, t.periodKey, t.targetAmount));
  (journal || []).forEach(j => addJournal_(spreadsheetId, j.date, j.entry));
}

// ---------- Rekap harian / mingguan / bulanan / tahunan ----------
function isoWeekKey_(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((date - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return date.getUTCFullYear() + '-W' + String(week).padStart(2, '0');
}

function buildReport_(spreadsheetId) {
  const txs = readRows_(sheetOf_(spreadsheetId, 'Transactions'));
  const targets = readRows_(sheetOf_(spreadsheetId, 'Targets'));

  const buckets = { daily: {}, weekly: {}, monthly: {}, yearly: {} };
  txs.forEach(t => {
    const d = new Date(t.date);
    if (isNaN(d)) return;
    const dayKey = Utilities.formatDate(d, 'GMT', 'yyyy-MM-dd');
    const monthKey = Utilities.formatDate(d, 'GMT', 'yyyy-MM');
    const yearKey = Utilities.formatDate(d, 'GMT', 'yyyy');
    const weekKey = isoWeekKey_(d);
    const sign = t.type === 'income' ? 1 : -1;
    const amt = Number(t.amount) * sign;

    [['daily', dayKey], ['weekly', weekKey], ['monthly', monthKey], ['yearly', yearKey]].forEach(([bucket, key]) => {
      if (!buckets[bucket][key]) buckets[bucket][key] = { income: 0, expense: 0, net: 0 };
      if (t.type === 'income') buckets[bucket][key].income += Number(t.amount);
      else buckets[bucket][key].expense += Number(t.amount);
      buckets[bucket][key].net += amt;
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

// ---------- HTTP entry points ----------
function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const p = e.parameter;
  if (p.action === 'verify') return verifyHtml_(p.token);
  return jsonOut_({ ok: false, error: 'Gunakan POST untuk aksi ini' });
}

function doPost(e) {
  const p = e.parameter;
  return handlePost_(p);
}

function handlePost_(p) {
  try {
    const action = p.action;

    if (action === 'register') return jsonOut_(register_(p));
    if (action === 'login') return jsonOut_(login_(p));

    // Aksi lain butuh sessionToken yang valid untuk spreadsheetId tsb
    if (!verifySession_(p.spreadsheetId, p.sessionToken)) {
      return jsonOut_({ ok: false, error: 'Sesi tidak valid, silakan login ulang' });
    }

    switch (action) {
      case 'getData': {
        const txs = readRows_(sheetOf_(p.spreadsheetId, 'Transactions'));
        const targets = readRows_(sheetOf_(p.spreadsheetId, 'Targets'));
        const journal = readRows_(sheetOf_(p.spreadsheetId, 'Journal'));
        return jsonOut_({ ok: true, transactions: txs, targets, journal });
      }
      case 'addTransaction': {
        const id = addTransaction_(p.spreadsheetId, JSON.parse(p.tx));
        return jsonOut_({ ok: true, id });
      }
      case 'setTarget': {
        setTarget_(p.spreadsheetId, p.period, p.periodKey, p.targetAmount);
        return jsonOut_({ ok: true });
      }
      case 'addJournal': {
        addJournal_(p.spreadsheetId, p.date, p.entry);
        return jsonOut_({ ok: true });
      }
      case 'getReport': {
        return jsonOut_({ ok: true, report: buildReport_(p.spreadsheetId) });
      }
      case 'migrateGuestData': {
        migrateGuestData_(
          p.spreadsheetId,
          JSON.parse(p.transactions || '[]'),
          JSON.parse(p.targets || '[]'),
          JSON.parse(p.journal || '[]')
        );
        return jsonOut_({ ok: true });
      }
      default:
        return jsonOut_({ ok: false, error: 'Aksi tidak dikenal' });
    }
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  }
}
