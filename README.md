# MoneyLedger

App untuk memantau keuangan pribadi (harian/mingguan/bulanan), target pemasukan
bulanan & tahunan, artikel/literasi keuangan, berita ekonomi-saham-kripto yang
update otomatis tiap hari, dan jurnal harian pribadi.

**Dua mode:**
- **Tanpa akun (Tamu)**: data tersimpan di `localStorage` browser (device itu saja), langsung pakai tanpa daftar.
- **Akun**: daftar username + email + password → link verifikasi dikirim ke email → setelah verifikasi, akun aktif dan data tersimpan permanen di Google Sheet pribadi (dibuat otomatis). Bisa login lagi dari device manapun.
- Kalau user mulai sebagai Tamu lalu belakangan bikin akun, data lokalnya otomatis ditawarkan untuk dipindah ke akun barunya.

**Arsitektur:**
- **Frontend**: HTML/CSS/JS statis → di-host gratis di **GitHub Pages**.
- **Backend + database**: **Google Apps Script** (menangani register/login/data) + **Google Sheets** (jadi "database").
- **Berita otomatis**: **GitHub Actions** menjalankan script tiap hari untuk ambil RSS berita ekonomi/saham/kripto lalu commit ke `data/articles.json`.

Tidak ada biaya sama sekali — semua pakai layanan gratis. Tidak perlu lagi setup Google Cloud OAuth (sudah dihapus dari arsitektur).

---

## 1. Sheet induk (master) — sudah kamu punya

ID spreadsheet induk kamu sudah ditulis di `apps-script/Code.gs` (`MASTER_SHEET_ID`).
Sheet ini otomatis akan berisi tab "Users" dengan kolom:
`username | email | passwordHash | salt | verified | verificationToken | sessionToken | spreadsheetId | createdAt`
— semua diisi otomatis oleh sistem, jangan diedit manual.

## 2. Deploy backend (Google Apps Script)

1. Buka project Apps Script yang sudah ter-bind ke sheet induk (atau https://script.google.com → New project).
2. Hapus isi default, tempel seluruh isi file `apps-script/Code.gs` dari repo ini.
3. Klik **Deploy → New deployment → Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone** (bukan "Anyone with Google account" — penting, ini penyebab error "Failed to fetch" kalau salah pilih)
4. Klik Deploy, izinkan akses ("Advanced" → "Go to ... (unsafe)" → Allow — wajar muncul karena app buatan sendiri).
5. Salin **Web app URL** yang muncul (bentuknya `https://script.google.com/macros/s/xxx/exec`).
6. Tempel URL itu ke variabel `WEB_APP_URL` di baris atas `Code.gs` (dipakai untuk link verifikasi di email), **lalu Deploy ulang** (Deploy → Manage deployments → edit → New version → Deploy) supaya perubahan itu aktif.

## 3. Isi `js/config.js`

```js
window.APP_CONFIG = {
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/.../exec' // dari langkah 2
};
```

## 4. Deploy ke GitHub Pages

1. Push semua isi folder ini ke repo GitHub.
2. Repo → **Settings → Pages** → Source: branch `main`, folder `/ (root)`.
3. Situs aktif di `https://username-kamu.github.io/nama-repo/`.

## 5. Aktifkan auto-fetch berita (GitHub Actions)

Workflow `.github/workflows/fetch-news.yml` otomatis jalan tiap hari. Untuk coba manual:
Repo → tab **Actions** → **Fetch News** → **Run workflow**.

## 6. Selesai — coba alurnya

1. Buka situsmu → **Buat akun baru** → isi username/email/password.
2. Cek email → klik link verifikasi → muncul halaman "Akun berhasil diverifikasi".
3. Kembali ke situs → **Masuk** → login dengan username/password tadi.

---

## Troubleshooting cepat

- **"Failed to fetch" saat register/login**: cek lagi Deploy setting "Who has access" harus **Anyone**, dan pastikan `APPS_SCRIPT_URL` di `config.js` adalah URL `/exec` hasil Deploy (bukan URL editor `/home/projects/...`).
- **Email verifikasi tidak masuk**: cek folder Spam. `MailApp` (akun Gmail biasa) punya kuota ~100 email/hari, cukup untuk pemakaian pribadi.
- **"Sesi tidak valid, silakan login ulang"**: sessionToken tersimpan di `sessionStorage` (hilang kalau tab ditutup) — ini wajar, tinggal login lagi.

## Catatan penting

- **Privasi**: data tiap akun tersimpan di spreadsheet Google terpisah, dibuat otomatis. Pemilik sheet induk hanya bisa lihat daftar username/email, bukan isi transaksi (kecuali diberi akses editor).
- **Keamanan password**: password di-hash (SHA-256 + salt) sebelum disimpan, tidak disimpan polos. Ini setup DIY yang cukup untuk pemakaian pribadi/kecil, bukan setara sistem auth komersial (tidak ada rate-limiting, dsb).
- **Bukan nasihat keuangan**: konten literasi & berita bersifat edukasi umum, bukan rekomendasi investasi.
