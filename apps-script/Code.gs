/**
 * MoneyLedger — Backend (Google Apps Script)
 * ---------------------------------------------------
 * Peran file ini:
 *  1. Menyimpan "sheet induk" (MASTER_SHEET_ID) yang berisi daftar user
 *     dan ID spreadsheet pribadi masing-masing.
 *  2. Saat user baru login (via Google Sign-In di frontend), otomatis
 *     membuatkan 1 spreadsheet pribadi baru untuk user tsb (Transactions,
 *     Targets, Journal).
 *  3. Menyediakan endpoint (doGet/doPost) untuk CRUD transaksi, target,
 *     dan jurnal, serta menghitung rekap harian/mingguan/bulanan/tahunan.
 *
 * CARA DEPLOY (ringkas — detail lengkap ada di README.md):
 *  1. Buat Google Sheet baru khusus untuk jadi "sheet induk", copy ID-nya
 *     dari URL, tempel ke MASTER_SHEET_ID di bawah.
 *  2. Buka https://script.google.com -> New project -> hapus isi default,
 *     tempel seluruh isi file ini.
 *  3. Deploy -> New deployment -> Web app.
 *     - Execute as: Me
 *     - Who has access: Anyone
 *  4. Salin URL Web App yang muncul, tempel ke js/config.js (API_URL).
 */

const MASTER_SHEET_ID = '11Wxc4dUQFk4XnLrB81m3B2tTQl80fUPJB5SOdI4hJRA';
const USERS_SHEET_NAME = 'Users';

// ---------- Utility: verifikasi token Google Sign-In dari frontend ----------
function verifyGoogleToken(idToken) {
  const res = UrlFetchApp.fetch(
    'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
    { muteHttpExceptions: true }
  );
  if (res.getResponseCode() !== 200) return null;
  const payload = JSON.parse(res.getContentText());
  if (!payload.email || payload.email_verified !== 'true') return null;
  return { email: payload.email, name: payload.name || payload.email };
}

// ---------- Master sheet helpers ----------
function getMasterSheet_() {
  const ss = SpreadsheetApp.openById(MASTER_SHEET_ID);
  let sheet = ss.getSheetByName(USERS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(USERS_SHEET_NAME);
    sheet.appendRow(['email', 'name', 'spreadsheetId', 'createdAt']);
  }
  return sheet;
}

function findUser_(email) {
  const sheet = getMasterSheet_();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === email) {
      return { email: data[i][0], name: data[i][1], spreadsheetId: data[i][2], createdAt: data[i][3] };
    }
  }
  return null;
}

// Buat spreadsheet pribadi baru untuk user baru, dengan 3 tab siap pakai.
function createUserSpreadsheet_(email, name) {
  const ss = SpreadsheetApp.create('MoneyLedger — ' + email);
  const id = ss.getId();

  const tx = ss.getSheets()[0];
  tx.setName('Transactions');
  tx.appendRow(['id', 'date', 'type', 'category', 'amount', 'note']);

  const targets = ss.insertSheet('Targets');
  targets.appendRow(['period', 'periodKey', 'targetAmount']); // period: 'monthly' | 'yearly'

  const journal = ss.insertSheet('Journal');
  journal.appendRow(['date', 'entry']);

  DriveApp.getFileById(id).addEditor(email);

  const master = getMasterSheet_();
  master.appendRow([email, name, id, new Date().toISOString()]);

  return id;
}

function getOrCreateUser_(email, name) {
  let user = findUser_(email);
  if (!user) {
    const spreadsheetId = createUserSpreadsheet_(email, name);
    user = { email, name, spreadsheetId, createdAt: new Date().toISOString() };
  }
  return user;
}

// ---------- Data helpers (per-user spreadsheet) ----------
function sheetOf_(spreadsheetId, name) {
  return SpreadsheetApp.openById(spreadsheetId).getSheetByName(name);
}

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
  const txSheet = sheetOf_(spreadsheetId, 'Transactions');
  const txs = readRows_(txSheet);
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
  return handle_(e);
}

function doPost(e) {
  const body = e.postData ? JSON.parse(e.postData.contents) : {};
  return handle_({ parameter: body });
}

function handle_(e) {
  try {
    const p = e.parameter;
    const action = p.action;

    if (action === 'login') {
      const user = verifyGoogleToken(p.idToken);
      if (!user) return jsonOut_({ ok: false, error: 'Token tidak valid' });
      const record = getOrCreateUser_(user.email, user.name);
      return jsonOut_({ ok: true, user: record });
    }

    // Semua action lain butuh idToken + spreadsheetId yang cocok dengan email user
    const user = verifyGoogleToken(p.idToken);
    if (!user) return jsonOut_({ ok: false, error: 'Token tidak valid' });
    const record = findUser_(user.email);
    if (!record || record.spreadsheetId !== p.spreadsheetId) {
      return jsonOut_({ ok: false, error: 'Tidak diizinkan mengakses spreadsheet ini' });
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
      default:
        return jsonOut_({ ok: false, error: 'Aksi tidak dikenal' });
    }
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  }
}
