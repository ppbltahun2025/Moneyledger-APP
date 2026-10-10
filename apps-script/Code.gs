/**
 * MoneyLedger — Backend (Google Apps Script)
 * ---------------------------------------------------
 * Auth: username + email + password (bukan lagi Google Sign-In).
 * - register  -> buat user belum-terverifikasi, kirim email verifikasi
 * - verify    -> aktifkan akun, buat spreadsheet pribadi (dibuka lewat link email)
 * - login     -> cek password, kembalikan sessionToken + spreadsheetId
 * - migrateGuestData -> pindahkan data localStorage (mode tamu) ke akun
 * - getData / addTransaction / setTarget / addJournal / getReport -> butuh sessionToken valid
 * - updateTransaction / deleteTransaction / updateJournal / deleteJournal / deleteTarget
 * - saveNews / getSavedNews -> backup berita ke tab "SavedNews" di spreadsheet pribadi
 *
 * DEPLOY: sama seperti sebelumnya —
 *   Deploy -> New deployment -> Web app -> Execute as: Me, Who has access: Anyone
 */

const MASTER_SHEET_ID = '11Wxc4dUQFk4XnLrB81m3B2tTQl80fUPJB5SOdI4hJRA';
const USERS_SHEET_NAME = 'Users';
// Ganti ke URL Web App kamu sendiri setelah deploy pertama (dipakai untuk link verifikasi di email).
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwHVwjdKu0LXVJawtT8r12hlNyJKcmVwMQtF-RWiihEx0GYFDgfg1bo1swEmlalWRTp/exec';

const COLS = ['username', 'email', 'passwordHash', 'salt', 'verified', 'verificationToken', 'sessionToken', 'spreadsheetId', 'createdAt'];

// ---------- Master sheet helpers ----------
function getMasterSheet() {
  const ss = SpreadsheetApp.openById(MASTER_SHEET_ID);
  let sheet = ss.getSheetByName(USERS_SHEET_NAME);

  if (!sheet) {
    // Belum ada tab "Users" -> buat baru dengan header yang benar.
    sheet = ss.insertSheet(USERS_SHEET_NAME);
    sheet.appendRow(COLS);
    return sheet;
  }

  // Tab sudah ada (mungkin dari percobaan sebelumnya) -> pastikan headernya
  // persis sesuai COLS. Kalau tidak cocok, tulis ulang baris 1 saja
  // (tidak menghapus baris data lain di bawahnya).
  const lastCol = Math.max(sheet.getLastColumn(), COLS.length);
  const currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const matches = COLS.every((c, i) => currentHeaders[i] === c);
  if (!matches) {
    sheet.getRange(1, 1, 1, COLS.length).setValues([COLS]);
  }
  return sheet;
}

function colIndex(name) { return COLS.indexOf(name); }

function findUserRow(sheet, colName, value) {
  const data = sheet.getDataRange().getValues();
  const idx = colIndex(colName);
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idx]) === String(value)) return { rowNum: i + 1, row: data[i] };
  }
  return null;
}

function rowToUser(row) {
  const obj = {};
  COLS.forEach((c, i) => (obj[c] = row[i]));
  return obj;
}

// ---------- Password hashing (SHA-256 + salt) ----------
function hashPassword(password, salt) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + ':' + salt);
  return digest.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

function randomToken() { return Utilities.getUuid().replace(/-/g, ''); }

// ---------- Personal spreadsheet ----------
function createUserSpreadsheet(username, email) {
  const ss = SpreadsheetApp.create('MoneyLedger — ' + username);
  const id = ss.getId();

  const tx = ss.getSheets()[0];
  tx.setName('Transactions');
  tx.appendRow(['id', 'date', 'type', 'category', 'amount', 'note']);

  const targets = ss.insertSheet('Targets');
  targets.appendRow(['period', 'periodKey', 'targetAmount']);

  const journal = ss.insertSheet('Journal');
  journal.appendRow(['date', 'entry', 'id']);

  try { DriveApp.getFileById(id).addEditor(email); } catch (e) { /* tidak fatal */ }

  return id;
}

// ---------- Actions ----------
function register(p) {
  const username = String(p.username || '').trim();
  const email = String(p.email || '').trim().toLowerCase();
  const password = String(p.password || '');

  if (!username || !email || !password) return { ok: false, error: 'Username, email, dan password wajib diisi' };
  if (password.length < 6) return { ok: false, error: 'Password minimal 6 karakter' };

  const sheet = getMasterSheet();
  if (findUserRow(sheet, 'username', username)) return { ok: false, error: 'Username sudah dipakai' };
  if (findUserRow(sheet, 'email', email)) return { ok: false, error: 'Email sudah terdaftar' };

  const salt = randomToken();
  const passwordHash = hashPassword(password, salt);
  const verificationToken = randomToken();

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

function verifyHtml(token) {
  const sheet = getMasterSheet();
  const found = findUserRow(sheet, 'verificationToken', token);
  if (!found) {
    return HtmlService.createHtmlOutput('<h2>Link tidak valid atau sudah dipakai.</h2>');
  }
  const user = rowToUser(found.row);
  if (user.verified === true || user.verified === 'true' || user.verified === 'TRUE') {
    return HtmlService.createHtmlOutput('<h2>Akun sudah terverifikasi sebelumnya. Silakan login.</h2>');
  }
  const spreadsheetId = createUserSpreadsheet(user.username, user.email);
  sheet.getRange(found.rowNum, colIndex('verified') + 1).setValue(true);
  sheet.getRange(found.rowNum, colIndex('spreadsheetId') + 1).setValue(spreadsheetId);

  return HtmlService.createHtmlOutput(
    '<h2>Akun berhasil diverifikasi! 🎉</h2><p>Silakan kembali ke MoneyLedger dan login dengan username & password kamu.</p>'
  );
}

function login(p) {
  const identifier = String(p.identifier || '').trim();
  const password = String(p.password || '');
  const sheet = getMasterSheet();

  let found = findUserRow(sheet, 'username', identifier);
  if (!found) found = findUserRow(sheet, 'email', identifier.toLowerCase());
  if (!found) return { ok: false, error: 'Akun tidak ditemukan' };

  const user = rowToUser(found.row);
  if (!(user.verified === true || user.verified === 'true' || user.verified === 'TRUE')) {
    return { ok: false, error: 'Akun belum diverifikasi. Cek email kamu.' };
  }
  const hash = hashPassword(password, user.salt);
  if (hash !== user.passwordHash) return { ok: false, error: 'Password salah' };

  const sessionToken = randomToken();
  sheet.getRange(found.rowNum, colIndex('sessionToken') + 1).setValue(sessionToken);

  return {
    ok: true,
    user: { username: user.username, email: user.email, spreadsheetId: user.spreadsheetId, sessionToken }
  };
}

function verifySession(spreadsheetId, sessionToken) {
  const sheet = getMasterSheet();
  const found = findUserRow(sheet, 'spreadsheetId', spreadsheetId);
  if (!found) return false;
  const user = rowToUser(found.row);
  return user.sessionToken && String(user.sessionToken) === String(sessionToken);
}

// ---------- Data helpers (per-user spreadsheet) ----------
function sheetOf(spreadsheetId, name) { return SpreadsheetApp.openById(spreadsheetId).getSheetByName(name); }

function readRows(sheet) {
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const tz = Session.getScriptTimeZone();
  return values.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      let v = row[i];
      if (v instanceof Date) v = Utilities.formatDate(v, tz, h === 'periodKey' ? 'yyyy-MM' : 'yyyy-MM-dd');
      obj[h] = v;
    });
    return obj;
  });
}

// Pastikan sheet punya kolom "id" di paling kanan dan setiap baris data terisi id
// (akun lama belum punya id di Journal).
function ensureIds(sheet) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  let idCol = headers.indexOf('id') + 1;
  if (!idCol) { idCol = lastCol + 1; sheet.getRange(1, idCol).setValue('id'); }
  const n = sheet.getLastRow() - 1;
  if (n > 0) {
    const rng = sheet.getRange(2, idCol, n, 1), vals = rng.getValues();
    let changed = false;
    vals.forEach(r => { if (!r[0]) { r[0] = Utilities.getUuid(); changed = true; } });
    if (changed) rng.setValues(vals);
  }
  return idCol;
}

function findRowById(sheet, id) {
  const idCol = ensureIds(sheet);
  const ids = sheet.getRange(2, idCol, Math.max(sheet.getLastRow() - 1, 1), 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return 0;
}

function addTransaction(spreadsheetId, tx) {
  const sheet = sheetOf(spreadsheetId, 'Transactions');
  const id = Utilities.getUuid();
  sheet.appendRow([id, tx.date, tx.type, tx.category, Number(tx.amount), tx.note || '']);
  return id;
}

function setTarget(spreadsheetId, period, periodKey, targetAmount) {
  const sheet = sheetOf(spreadsheetId, 'Targets');
  const data = sheet.getDataRange().getValues();
  const tz = Session.getScriptTimeZone();
  for (let i = 1; i < data.length; i++) {
    // Sheets bisa mengubah "2026-10" menjadi tanggal; samakan kembali ke yyyy-MM.
    const k = data[i][1] instanceof Date ? Utilities.formatDate(data[i][1], tz, 'yyyy-MM') : String(data[i][1]);
    if (data[i][0] === period && k === String(periodKey)) {
      sheet.getRange(i + 1, 3).setValue(Number(targetAmount));
      return;
    }
  }
  const row = sheet.getLastRow() + 1;
  sheet.getRange(row, 2).setNumberFormat('@'); // simpan sebagai teks supaya tidak jadi tanggal
  sheet.getRange(row, 1, 1, 3).setValues([[period, String(periodKey), Number(targetAmount)]]);
}

function addJournal(spreadsheetId, date, entry) {
  const sheet = sheetOf(spreadsheetId, 'Journal');
  ensureIds(sheet);
  sheet.appendRow([date, entry, Utilities.getUuid()]);
}

function updateTransaction(spreadsheetId, id, tx) {
  const sheet = sheetOf(spreadsheetId, 'Transactions');
  const row = findRowById(sheet, id);
  if (!row) throw new Error('Transaksi tidak ditemukan');
  sheet.getRange(row, 2, 1, 5).setValues([[tx.date, tx.type, tx.category, Number(tx.amount), tx.note || '']]);
}

function deleteTransaction(spreadsheetId, id) {
  const sheet = sheetOf(spreadsheetId, 'Transactions');
  const row = findRowById(sheet, id);
  if (row) sheet.deleteRow(row);
}

function updateJournal(spreadsheetId, id, date, entry) {
  const sheet = sheetOf(spreadsheetId, 'Journal');
  const row = findRowById(sheet, id);
  if (!row) throw new Error('Catatan tidak ditemukan');
  sheet.getRange(row, 1, 1, 2).setValues([[date, entry]]);
}

function deleteJournal(spreadsheetId, id) {
  const sheet = sheetOf(spreadsheetId, 'Journal');
  const row = findRowById(sheet, id);
  if (row) sheet.deleteRow(row);
}

function deleteTarget(spreadsheetId, period, periodKey) {
  const sheet = sheetOf(spreadsheetId, 'Targets');
  const data = sheet.getDataRange().getValues();
  const tz = Session.getScriptTimeZone();
  for (let i = data.length - 1; i >= 1; i--) {
    const k = data[i][1] instanceof Date ? Utilities.formatDate(data[i][1], tz, 'yyyy-MM') : String(data[i][1]);
    if (data[i][0] === period && k === String(periodKey)) sheet.deleteRow(i + 1);
  }
}

// ---------- Backup berita ----------
const NEWS_COLS = ['savedAt', 'date', 'source', 'category', 'region', 'title', 'link', 'summary'];

function newsSheet(spreadsheetId) {
  const ss = SpreadsheetApp.openById(spreadsheetId);
  let sh = ss.getSheetByName('SavedNews');
  if (!sh) {
    sh = ss.insertSheet('SavedNews');
    sh.appendRow(NEWS_COLS);
    sh.setFrozenRows(1);
  }
  return sh;
}

function saveNews(spreadsheetId, articles) {
  const sh = newsSheet(spreadsheetId);
  const last = sh.getLastRow();
  const have = {};
  if (last > 1) sh.getRange(2, 7, last - 1, 1).getValues().forEach(r => (have[String(r[0])] = true));
  const now = new Date().toISOString();
  const rows = [];
  (articles || []).forEach(a => {
    if (!a.link || have[a.link]) return;
    have[a.link] = true;
    rows.push([now, a.date || '', a.source || '', a.category || '', a.region || '', a.title || '', a.link, String(a.summary || '').slice(0, 500)]);
  });
  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, NEWS_COLS.length).setValues(rows);
  return rows.length;
}

function getSavedNews(spreadsheetId) {
  const sh = newsSheet(spreadsheetId);
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 7, last - 1, 1).getValues().map(r => String(r[0]));
}

function migrateGuestData(spreadsheetId, transactions, targets, journal, news) {
  (transactions || []).forEach(t => addTransaction(spreadsheetId, t));
  (targets || []).forEach(t => setTarget(spreadsheetId, t.period, t.periodKey, t.targetAmount));
  (journal || []).forEach(j => addJournal(spreadsheetId, j.date, j.entry));
  if (news && news.length) saveNews(spreadsheetId, news);
}

// ---------- Rekap harian / mingguan / bulanan / tahunan ----------
function isoWeekKey(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((date - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return date.getUTCFullYear() + '-W' + String(week).padStart(2, '0');
}

function buildReport(spreadsheetId) {
  const txs = readRows(sheetOf(spreadsheetId, 'Transactions'));
  const targets = readRows(sheetOf(spreadsheetId, 'Targets'));

  const buckets = { daily: {}, weekly: {}, monthly: {}, yearly: {} };
  txs.forEach(t => {
    const d = new Date(t.date);
    if (isNaN(d)) return;
    const dayKey = Utilities.formatDate(d, 'GMT', 'yyyy-MM-dd');
    const monthKey = Utilities.formatDate(d, 'GMT', 'yyyy-MM');
    const yearKey = Utilities.formatDate(d, 'GMT', 'yyyy');
    const weekKey = isoWeekKey(d);
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
function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const p = e.parameter;
  if (p.action === 'verify') return verifyHtml(p.token);
  return jsonOut({ ok: false, error: 'Gunakan POST untuk aksi ini' });
}

function doPost(e) {
  const p = e.parameter;
  return handlePost(p);
}

function handlePost(p) {
  try {
    const action = p.action;

    if (action === 'register') return jsonOut(register(p));
    if (action === 'login') return jsonOut(login(p));

    // Aksi lain butuh sessionToken yang valid untuk spreadsheetId tsb
    if (!verifySession(p.spreadsheetId, p.sessionToken)) {
      return jsonOut({ ok: false, error: 'Sesi tidak valid, silakan login ulang' });
    }

    switch (action) {
      case 'getData': {
        const txs = readRows(sheetOf(p.spreadsheetId, 'Transactions'));
        const targets = readRows(sheetOf(p.spreadsheetId, 'Targets'));
        const journal = readRows(sheetOf(p.spreadsheetId, 'Journal'));
        return jsonOut({ ok: true, transactions: txs, targets, journal });
      }
      case 'addTransaction': {
        const id = addTransaction(p.spreadsheetId, JSON.parse(p.tx));
        return jsonOut({ ok: true, id });
      }
      case 'setTarget': {
        setTarget(p.spreadsheetId, p.period, p.periodKey, p.targetAmount);
        return jsonOut({ ok: true });
      }
      case 'addJournal': {
        addJournal(p.spreadsheetId, p.date, p.entry);
        return jsonOut({ ok: true });
      }
      case 'updateTransaction': {
        updateTransaction(p.spreadsheetId, p.id, JSON.parse(p.tx));
        return jsonOut({ ok: true });
      }
      case 'deleteTransaction': {
        deleteTransaction(p.spreadsheetId, p.id);
        return jsonOut({ ok: true });
      }
      case 'updateJournal': {
        updateJournal(p.spreadsheetId, p.id, p.date, p.entry);
        return jsonOut({ ok: true });
      }
      case 'deleteJournal': {
        deleteJournal(p.spreadsheetId, p.id);
        return jsonOut({ ok: true });
      }
      case 'deleteTarget': {
        deleteTarget(p.spreadsheetId, p.period, p.periodKey);
        return jsonOut({ ok: true });
      }
      case 'saveNews': {
        const saved = saveNews(p.spreadsheetId, JSON.parse(p.articles || '[]'));
        return jsonOut({ ok: true, saved });
      }
      case 'getSavedNews': {
        return jsonOut({ ok: true, links: getSavedNews(p.spreadsheetId) });
      }
      case 'getReport': {
        return jsonOut({ ok: true, report: buildReport(p.spreadsheetId) });
      }
      case 'migrateGuestData': {
        migrateGuestData(
          p.spreadsheetId,
          JSON.parse(p.transactions || '[]'),
          JSON.parse(p.targets || '[]'),
          JSON.parse(p.journal || '[]'),
          JSON.parse(p.news || '[]')
        );
        return jsonOut({ ok: true });
      }
      default:
        return jsonOut({ ok: false, error: 'Aksi tidak dikenal' });
    }
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}
