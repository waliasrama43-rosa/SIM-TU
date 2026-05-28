# Panduan Setup SIM-TU
### Langkah demi langkah dari nol hingga siap pakai

---

## Prasyarat
- Akun Google (disarankan akun khusus sekolah)
- Akun Telegram untuk membuat bot (@BotFather)
- Akses ke Google Drive, Sheets, Docs

---

## Langkah 1 — Buat Google Spreadsheet

1. Buka [Google Sheets](https://sheets.google.com)
2. Buat spreadsheet baru, beri nama **SIM-TU Database**
3. Catat ID spreadsheet dari URL:
   ```
   https://docs.google.com/spreadsheets/d/[INI_ID_NYA]/edit
   ```

---

## Langkah 2 — Setup Google Apps Script

1. Di spreadsheet, klik **Extensions → Apps Script**
2. Hapus kode default yang ada
3. Buat file-file berikut (klik ikon `+` di sebelah "Files"):
   - `Code.gs` — paste isi dari `src/gas/Code.gs`
   - `Auth.gs` — paste isi dari `src/gas/Auth.gs`
   - `Config.gs` — paste isi dari `src/gas/Config.gs`
   - `NomorSurat.gs`
   - `SuratMasuk.gs`
   - `SuratKeluar.gs`
   - `PdfService.gs`
   - `DriveService.gs`
   - `TemplateReg.gs`
   - `Disposisi.gs`
   - `TelegramBot.gs`
   - `AuditLog.gs`
   - `Kesiswaan.gs`

4. Di `Code.gs`, isi `SPREADSHEET_ID`:
   ```javascript
   const SPREADSHEET_ID = 'ID_DARI_LANGKAH_1';
   ```

---

## Langkah 3 — Inisialisasi Sheet

1. Di Apps Script, buka file baru `setup-sheets.gs`
2. Paste isi dari `scripts/setup-sheets.gs`
3. Klik **Run → initSistem()**
4. Izinkan akses yang diminta
5. Cek spreadsheet — semua sheet harus sudah terbuat

---

## Langkah 4 — Buat Telegram Bot

1. Buka Telegram, chat ke **@BotFather**
2. Ketik `/newbot`
3. Ikuti instruksi (beri nama & username bot)
4. Salin **token** yang diberikan
5. Di Sheet CONFIG, isi `TELEGRAM_BOT_TOKEN` dengan token tersebut

---

## Langkah 5 — Deploy Web App

1. Di Apps Script, klik **Deploy → New deployment**
2. Pilih type: **Web app**
3. Settings:
   - Execute as: **Me**
   - Who has access: **Anyone** (atau Anyone with Google account)
4. Klik Deploy
5. Salin URL Web App yang diberikan

---

## Langkah 6 — Set Telegram Webhook

1. Di Apps Script, buka console (Ctrl+Enter)
2. Jalankan:
   ```javascript
   TelegramBot.setWebhook('URL_WEB_APP_DARI_LANGKAH_5');
   ```
3. Harus muncul: `{"ok":true,"result":true}`

---

## Langkah 7 — Buat Akun Kepala TU Pertama

1. Di Sheet USERS, tambah baris manual pertama:
   ```
   ID          : USR_KEPALA_001
   USERNAME    : kepala_tu
   PASSWORD    : [hash SHA-256 dari password]
   ROLE        : KEPALA_TU
   JENJANG     : SD
   NAMA        : [nama lengkap]
   TELEGRAM_ID : [Chat ID Telegram]
   STATUS      : AKTIF
   ```

2. Untuk mendapat Chat ID Telegram: chat ke bot, ketik `/start`, cek AUDIT_LOG atau gunakan [@userinfobot](https://t.me/userinfobot)

---

## Langkah 8 — Setup Template Surat

1. Buat Google Doc untuk setiap jenis surat
2. Gunakan placeholder `{{nama_variabel}}` di dalam dokumen
3. Bagikan Doc ke akun yang menjalankan GAS (Editor)
4. Di Sheet TEMPLATE_REG, isi baris:
   - `DOC_ID` = ID dari URL Google Doc
   - `PLACEHOLDERS` = nama variabel dipisah koma

---

## Langkah 9 — Inisialisasi Folder Drive

1. Di Apps Script console, jalankan:
   ```javascript
   DriveService.initFolderStructure();
   ```
2. Cek Google Drive — folder SIM-TU harus sudah terbuat

---

## ✅ Selesai!

Akses Web App di URL dari Langkah 5.
Bot Telegram siap menerima perintah.

---

## Troubleshooting

| Masalah | Solusi |
|---|---|
| Bot tidak merespons | Cek token di CONFIG & pastikan webhook sudah diset |
| Surat gagal dibuat | Pastikan DOC_ID di TEMPLATE_REG benar & Doc sudah dibagikan |
| Folder tidak terbuat | Cek DRIVE_ROOT_ID di CONFIG |
| Login gagal | Pastikan PASSWORD di USERS adalah hash SHA-256 |
