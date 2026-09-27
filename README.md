# MoneyLedger

App untuk memantau keuangan pribadi (harian/mingguan/bulanan), target pemasukan
bulanan & tahunan, artikel/literasi keuangan, berita ekonomi-saham-kripto yang
update otomatis tiap hari, dan jurnal harian pribadi.

**Arsitektur:**
- **Frontend**: HTML/CSS/JS statis → di-host gratis di **GitHub Pages**.
- **Backend + database**: **Google Apps Script** + **Google Sheets**. Tiap user
  login pakai akun Google-nya sendiri (Sign in with Google), dan sistem
  otomatis membuatkan 1 spreadsheet pribadi untuk data keuangan & jurnalnya.
- **Berita otomatis**: **GitHub Actions** menjalankan script tiap hari untuk
  ambil RSS berita ekonomi/saham/kripto lalu commit ke `data/articles.json`.

Tidak ada biaya sama sekali — semua pakai layanan gratis (GitHub, Google Apps Script, Google Sheets).

---

## 1. Setup Google Sheet Induk (master)

1. Buat Google Sheet baru (kosong), beri nama misal "MoneyLedger — Master Users".
2. Salin **ID spreadsheet** dari URL-nya, contoh:
   `https://docs.google.com/spreadsheets/d/`**`INI_ID_NYA`**`/edit`

Sheet ini hanya menyimpan daftar: email user, nama, dan ID spreadsheet pribadi
mereka — dibuat & diisi otomatis oleh sistem, kamu tidak perlu isi manual.

## 2. Deploy backend (Google Apps Script)

1. Buka https://script.google.com → **New project**.
2. Hapus isi default, tempel seluruh isi file `apps-script/Code.gs` (di repo ini).
3. Di baris `const MASTER_SHEET_ID = '...'`, ganti dengan ID sheet dari langkah 1.
4. Klik **Deploy → New deployment → Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Klik Deploy, izinkan akses saat diminta. Salin **URL Web App** yang muncul
   (bentuknya seperti `https://script.google.com/macros/s/xxx/exec`).

## 3. Buat Google OAuth Client ID (untuk tombol "Sign in with Google")

1. Buka https://console.cloud.google.com/apis/credentials.
2. Buat project baru (atau pakai yang ada) → **Create Credentials → OAuth client ID**.
3. Application type: **Web application**.
4. Di **Authorized JavaScript origins**, tambahkan URL GitHub Pages kamu, contoh:
   `https://username-github-kamu.github.io`
5. Salin **Client ID** yang muncul (bentuknya `xxxx.apps.googleusercontent.com`).

## 4. Isi `js/config.js`

Buka file `js/config.js` di repo ini, ganti dua nilainya:

```js
window.APP_CONFIG = {
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/.../exec', // dari langkah 2
  GOOGLE_CLIENT_ID: 'xxxx.apps.googleusercontent.com'             // dari langkah 3
};
```

## 5. Deploy ke GitHub Pages

1. Push semua isi folder ini ke repo GitHub (public atau private, keduanya bisa
   pakai GitHub Pages di akun gratis, tapi private butuh plan tertentu untuk
   Pages — kalau ragu, pakai repo public).
2. Di repo → **Settings → Pages** → Source: pilih branch `main`, folder `/ (root)`.
3. Tunggu 1-2 menit, situs akan aktif di `https://username-kamu.github.io/nama-repo/`.
4. Kembali ke langkah 3 (Google Cloud Console), tambahkan URL persis ini ke
   **Authorized JavaScript origins** juga.

## 6. Aktifkan auto-fetch berita (GitHub Actions)

Workflow-nya (`.github/workflows/fetch-news.yml`) sudah otomatis berjalan tiap
hari jam 23:00 UTC setelah repo di-push ke GitHub — tidak perlu setup tambahan.

Untuk coba jalankan manual (tidak perlu tunggu jadwal):
1. Buka tab **Actions** di repo GitHub.
2. Pilih workflow **Fetch News** → **Run workflow**.

Sumber berita bisa kamu tambah/kurangi di `scripts/fetch-news.js` (variabel `FEEDS`).

## 7. Selesai

Buka URL GitHub Pages kamu, klik **Sign in with Google**, dan mulai catat transaksi.

---

## Catatan penting

- **Privasi**: data keuangan tiap user tersimpan di spreadsheet Google **milik
  user itu sendiri** (dibuat otomatis di Google Drive akun mereka). Kamu
  sebagai pemilik sheet induk hanya bisa lihat daftar email + ID spreadsheet,
  bukan isi transaksinya (kecuali kamu diberi akses editor ke sheet itu).
- **Bukan nasihat keuangan**: konten literasi & berita di app ini bersifat
  edukasi umum, bukan rekomendasi investasi.
- Kalau kamu sudah punya sheet induk / struktur login sendiri yang berbeda dari
  yang dijelaskan di sini, kasih tahu strukturnya (nama kolom, dsb.) supaya
  `Code.gs` bisa disesuaikan.
