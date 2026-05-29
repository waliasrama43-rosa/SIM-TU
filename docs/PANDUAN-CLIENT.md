# 📚 PANDUAN LENGKAP SIM-TU
### Sistem Informasi Manajemen Tata Usaha — Sekolah Rakyat
### Versi 1.0 | Dokumen untuk Pengguna & Administrator

---

> **Dokumen ini mencakup:**
> Setup dari nol, cara pakai Web App, cara pakai Telegram Bot,
> pengelolaan template surat, manajemen user, dan troubleshooting.

---

## DAFTAR ISI

1. [Persiapan Sebelum Setup](#1-persiapan-sebelum-setup)
2. [Setup Google Spreadsheet](#2-setup-google-spreadsheet)
3. [Setup Google Apps Script](#3-setup-google-apps-script)
4. [Inisialisasi Sheet Database](#4-inisialisasi-sheet-database)
5. [Buat Telegram Bot](#5-buat-telegram-bot)
6. [Deploy Web App](#6-deploy-web-app)
7. [Hubungkan Telegram Webhook](#7-hubungkan-telegram-webhook)
8. [Buat Akun Pertama (Kepala TU)](#8-buat-akun-pertama-kepala-tu)
9. [Setup Folder Google Drive](#9-setup-folder-google-drive)
10. [Buat Template Surat di Google Docs](#10-buat-template-surat-di-google-docs)
11. [Panduan Penggunaan Web App](#11-panduan-penggunaan-web-app)
12. [Panduan Penggunaan Telegram Bot](#12-panduan-penggunaan-telegram-bot)
13. [Referensi Sheet CONFIG](#13-referensi-sheet-config)
14. [Troubleshooting](#14-troubleshooting)
15. [Daftar Placeholder Otomatis](#15-daftar-placeholder-otomatis)

---


## 1. Persiapan Sebelum Setup

### Yang Anda butuhkan:
| Kebutuhan | Keterangan |
|---|---|
| **Akun Google** | Disarankan akun khusus sekolah (bukan pribadi) |
| **Akun Telegram** | Untuk membuat bot dan menerima notifikasi |
| **Browser** | Chrome/Firefox versi terbaru |
| **Koneksi internet** | Stabil selama setup |

### Estimasi waktu setup:
- Setup teknis (langkah 1–9): **± 30–45 menit**
- Buat template surat pertama: **± 15 menit per template**

> ⚠️ **Penting:** Gunakan **satu akun Google** yang sama untuk semua langkah.
> Akun ini akan menjadi "pemilik" sistem dan harus selalu aktif.

---

## 2. Setup Google Spreadsheet

### Langkah-langkah:

**1.** Buka [https://sheets.google.com](https://sheets.google.com)

**2.** Klik tombol **+ Blank** untuk membuat spreadsheet baru

**3.** Beri nama: `SIM-TU Database`

**4.** Catat **ID Spreadsheet** dari URL:
```
https://docs.google.com/spreadsheets/d/[SALIN_BAGIAN_INI]/edit
```
Contoh ID: `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms`

> 💡 Simpan ID ini, akan dipakai di Langkah 3.

---

## 3. Setup Google Apps Script

**1.** Di spreadsheet, klik menu **Extensions → Apps Script**

**2.** Jendela Apps Script akan terbuka. Hapus semua kode default yang ada.

**3.** Di panel kiri, klik ikon **+** di samping "Files" untuk membuat file baru.
   Buat file-file berikut **satu per satu** (pilih tipe: Script):

| Nama File | Salin dari |
|---|---|
| `Code` | `src/gas/Code.gs` |
| `Auth` | `src/gas/Auth.gs` |
| `Config` | `src/gas/Config.gs` |
| `NomorSurat` | `src/gas/NomorSurat.gs` |
| `SuratMasuk` | `src/gas/SuratMasuk.gs` |
| `SuratKeluar` | `src/gas/SuratKeluar.gs` |
| `PdfService` | `src/gas/PdfService.gs` |
| `DriveService` | `src/gas/DriveService.gs` |
| `TemplateReg` | `src/gas/TemplateReg.gs` |
| `Disposisi` | `src/gas/Disposisi.gs` |
| `TelegramBot` | `src/gas/TelegramBot.gs` |
| `AuditLog` | `src/gas/AuditLog.gs` |
| `Kesiswaan` | `src/gas/Kesiswaan.gs` |
| `WebHandlers` | `src/gas/WebHandlers.gs` |

**4.** Buat file HTML. Klik **+** → pilih tipe **HTML**:

| Nama File HTML | Salin dari |
|---|---|
| `frontend/index` | `src/frontend/index.html` |
| `frontend/dashboard` | `src/frontend/dashboard.html` |
| `frontend/surat-masuk` | `src/frontend/surat-masuk.html` |
| `frontend/surat-keluar` | `src/frontend/surat-keluar.html` |
| `frontend/disposisi` | `src/frontend/disposisi.html` |
| `frontend/kesiswaan` | `src/frontend/kesiswaan.html` |
| `frontend/template-reg` | `src/frontend/template-reg.html` |
| `frontend/users` | `src/frontend/users.html` |
| `frontend/config` | `src/frontend/config.html` |
| `frontend/audit-log` | `src/frontend/audit-log.html` |
| `frontend/styles` | `src/frontend/styles.html` |
| `frontend/scripts` | `src/frontend/scripts.html` |

**5.** Di file `Code.gs`, isi `SPREADSHEET_ID`:
```javascript
const SPREADSHEET_ID = 'ID_YANG_DICATAT_DI_LANGKAH_2';
```

**6.** Klik ikon 💾 **Save** (Ctrl+S)

---


## 4. Inisialisasi Sheet Database

**1.** Di Apps Script, klik **+** → tambah file Script baru bernama `setup`

**2.** Paste seluruh isi file `scripts/setup-sheets.gs`

**3.** Pilih fungsi `initSistem` dari dropdown di toolbar

**4.** Klik tombol ▶️ **Run**

**5.** Akan muncul popup izin akses — klik **Review permissions**
   → Pilih akun Google Anda → Klik **Advanced** → **Go to SIM-TU (unsafe)** → **Allow**

**6.** Tunggu hingga muncul pesan di console:
   ```
   ✅ Semua sheet berhasil dibuat.
   ✅ Setup selesai!
   ```

**7.** Buka kembali Google Spreadsheet — pastikan sheet-sheet berikut sudah terbuat:
   `CONFIG` · `USERS` · `SISWA_SD` · `SISWA_SMP` · `SISWA_SMA` ·
   `SURAT_MASUK` · `SURAT_KELUAR` · `DISPOSISI` · `TEMPLATE_REG` · `AUDIT_LOG`

> ✅ Setelah langkah ini, Anda bisa **hapus file `setup`** dari Apps Script.

---

## 5. Buat Telegram Bot

**1.** Buka aplikasi Telegram di HP atau PC

**2.** Cari dan buka chat dengan **@BotFather**

**3.** Kirim pesan: `/newbot`

**4.** BotFather akan meminta:
   - **Nama bot** (nama tampilan): contoh `SIM TU Sekolah Rakyat`
   - **Username bot** (harus diakhiri `bot`): contoh `simtu_sekolahrakyat_bot`

**5.** BotFather akan memberikan **Token API**:
   ```
   Use this token to access the HTTP API:
   7123456789:AAFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
   > ⚠️ Salin dan simpan token ini. **Jangan bagikan ke siapapun.**

**6.** Buka Google Spreadsheet → Sheet **CONFIG** → cari baris `TELEGRAM_BOT_TOKEN`
   → isi kolom VALUE dengan token tadi

---

## 6. Deploy Web App

**1.** Di Apps Script, klik tombol **Deploy** (pojok kanan atas)

**2.** Pilih **New deployment**

**3.** Klik ikon ⚙️ di samping "Select type" → pilih **Web app**

**4.** Isi pengaturan:
   | Pengaturan | Nilai |
   |---|---|
   | Description | `SIM-TU v1.0` |
   | Execute as | **Me** (akun Anda) |
   | Who has access | **Anyone** |

**5.** Klik **Deploy** → izinkan akses jika diminta

**6.** Salin **Web App URL** yang diberikan:
   ```
   https://script.google.com/macros/s/[KODE_PANJANG]/exec
   ```
   > 💡 URL ini adalah alamat Web App SIM-TU Anda. Bagikan ke staf TU.

---

## 7. Hubungkan Telegram Webhook

**1.** Di Apps Script, klik ikon **⚡ Executions** atau buka console (View → Logs)

**2.** Jalankan kode berikut di console Apps Script:
   ```javascript
   TelegramBot.setWebhook('URL_WEB_APP_DARI_LANGKAH_6');
   ```
   Ganti `URL_WEB_APP_DARI_LANGKAH_6` dengan URL dari Langkah 6.

**3.** Harus muncul respons:
   ```json
   {"ok":true,"result":true,"description":"Webhook was set"}
   ```

**4.** Test bot: Buka Telegram → cari username bot Anda → kirim `/start`
   → Bot akan membalas (jika sudah ada akun terdaftar)

---

## 8. Buat Akun Pertama (Kepala TU)

Sebelum bisa login, Anda perlu membuat akun Kepala TU secara manual:

**1.** Dapatkan Chat ID Telegram Anda:
   - Buka Telegram → cari [@userinfobot](https://t.me/userinfobot)
   - Kirim pesan apapun → bot akan membalas dengan ID Anda
   - Contoh: `Id: 123456789`

**2.** Buat hash SHA-256 dari password Anda:
   - Buka [https://emn178.github.io/online-tools/sha256.html](https://emn178.github.io/online-tools/sha256.html)
   - Ketik password Anda → salin hasil hash

**3.** Buka Google Spreadsheet → Sheet **USERS**

**4.** Tambah baris pertama (baris 2) dengan data berikut:

| Kolom | Nilai |
|---|---|
| ID | `USR_KEPALA_001` |
| USERNAME | `kepala_tu` *(atau nama pilihan Anda)* |
| PASSWORD_HASH | *(hash SHA-256 dari password Anda)* |
| ROLE | `KEPALA_TU` |
| JENJANG | `SD` |
| NAMA | *(nama lengkap Anda)* |
| EMAIL | *(email Anda)* |
| TELEGRAM_ID | *(Chat ID dari langkah 1)* |
| SESSION_TOKEN | *(kosongkan)* |
| LAST_LOGIN | *(kosongkan)* |
| STATUS | `AKTIF` |

**5.** Buka Web App URL → login dengan username dan password yang dibuat

---


## 9. Setup Folder Google Drive

**1.** Di Apps Script console, jalankan:
   ```javascript
   DriveService.initFolderStructure();
   ```

**2.** Buka [Google Drive](https://drive.google.com) — akan ada folder baru **SIM-TU** dengan struktur:
   ```
   📁 SIM-TU/
   ├── 📁 SD/
   │   ├── 📁 Surat Masuk/2026/
   │   ├── 📁 Surat Keluar/2026/
   │   └── 📁 Template Surat/
   ├── 📁 SMP/ (sama)
   ├── 📁 SMA/ (sama)
   ├── 📁 CONFIG/
   └── 📁 _TEMP/
   ```

**3.** Salin **ID folder SIM-TU** dari URL Drive:
   ```
   https://drive.google.com/drive/folders/[SALIN_ID_INI]
   ```

**4.** Buka Sheet **CONFIG** → cari baris `DRIVE_ROOT_ID` → isi dengan ID tersebut

---

## 10. Buat Template Surat di Google Docs

Template surat adalah file Google Docs berisi format surat dengan
**placeholder** `{{nama_variabel}}` yang akan diganti otomatis oleh sistem.

### Cara membuat template:

**1.** Buka [https://docs.google.com](https://docs.google.com) → buat dokumen baru

**2.** Desain surat sesuai format resmi sekolah Anda

**3.** Gunakan placeholder untuk data yang berubah-ubah:
   ```
   Nomor  : {{no_surat}}
   Tanggal: {{tanggal}}

   Yang bertanda tangan di bawah ini menerangkan bahwa:
   Nama   : {{nama_siswa}}
   NISN   : {{nisn}}
   Kelas  : {{kelas}}

   adalah benar siswa aktif {{nama_sekolah}} Tahun Ajaran {{tahun_ajaran}}.

   Surat ini dibuat untuk keperluan: {{keperluan}}
   ```

**4.** Klik menu **Share** → tambahkan email akun Google yang menjalankan GAS
   sebagai **Editor**

**5.** Salin URL dokumen:
   ```
   https://docs.google.com/document/d/[FILE_ID]/edit
   ```

**6.** Di Web App SIM-TU → menu **Template Surat** → klik **+ Tambah Template**
   → paste URL Google Doc → isi kode surat, klasifikasi, dan daftar placeholder

### Contoh daftar placeholder untuk template di atas:
```
nama_siswa, nisn, kelas, keperluan
```
*(Tidak perlu tulis: no_surat, tanggal, nama_sekolah, tahun_ajaran — sudah otomatis)*

---

## 11. Panduan Penggunaan Web App

### Login
1. Buka URL Web App di browser
2. Masukkan **username** dan **password**
3. Klik **Masuk**

> ⚠️ Satu akun hanya bisa login di **satu perangkat**. Login di tempat lain akan
> otomatis mengakhiri sesi sebelumnya.

---

### 📥 Mencatat Surat Masuk

**Cara 1 — Upload Foto (dari HP/Scanner):**
1. Menu **Surat Masuk** → klik **+ Catat Surat Masuk**
2. Pilih tab **Upload Lampiran**
3. Klik zona upload atau seret file foto (JPG/PNG)
4. Sistem akan otomatis mengkonversi foto ke PDF
5. Isi data: No. Surat, Tanggal, Pengirim, Perihal
6. Klik **Simpan**

**Cara 2 — Upload PDF Langsung:**
1. Langkah sama, tapi unggah file PDF
2. File langsung tersimpan ke Drive

**Cara 3 — Input Manual (tanpa lampiran):**
1. Pilih tab **Input Manual**
2. Isi semua field
3. Klik **Simpan**

**Hasil:** Surat tercatat di arsip dengan **No. Agenda** otomatis.

---

### 📋 Disposisi Surat Masuk

1. Di tabel Surat Masuk, klik ikon 📋 di kolom Aksi
2. Pilih **penerima disposisi** dari dropdown
3. Tambahkan **catatan/instruksi** (opsional)
4. Klik **Kirim Disposisi**
5. Penerima akan mendapat **notifikasi Telegram** otomatis

**Update status disposisi:**
1. Menu **Disposisi** → akan tampil semua disposisi yang masuk ke Anda
2. Klik **Terima** → **Proses** → **Selesai** sesuai progres

---

### 📤 Membuat Surat Keluar

1. Menu **Surat Keluar** → klik **+ Buat Surat Keluar**
2. **Langkah 1:** Pilih template surat dari daftar
3. **Langkah 2:**
   - Preview **nomor surat** akan tampil otomatis (READ ONLY)
   - Isi field yang diperlukan (nama siswa, keperluan, dll)
4. Klik **Generate PDF**
5. PDF akan otomatis:
   - Terbuka di tab baru untuk diunduh/dicetak
   - Tersimpan di Google Drive folder yang sesuai
   - Tercatat di arsip Surat Keluar

---

### 🎓 Data Siswa

**Tambah siswa baru:**
1. Menu **Data Siswa** → pilih jenjang (SD/SMP/SMA)
2. Klik **+ Tambah Siswa** → isi formulir → **Simpan**

**Promosi siswa ke jenjang berikutnya:**
1. Cari siswa yang akan dipromosikan
2. Klik tombol **⬆️ Promosi**
3. Konfirmasi pengajuan → sistem kirim notifikasi ke TU jenjang tujuan
4. TU jenjang tujuan harus **menyetujui** di halaman Data Siswa mereka
5. Setelah disetujui, data siswa otomatis pindah ke jenjang baru

---

### ⚙️ Konfigurasi (Kepala TU)

1. Menu **Konfigurasi** → akan tampil semua pengaturan sistem
2. Edit nilai yang ingin diubah langsung di tabel
3. Klik **Simpan** di baris yang diubah
4. Perubahan berlaku langsung

**Yang bisa diubah di sini:**
- Nama sekolah, kode sekolah
- Format nomor surat
- Token Telegram Bot
- Aktif/nonaktif modul

---


## 12. Panduan Penggunaan Telegram Bot

### Daftar Chat ID Staf ke Bot

Sebelum bisa menggunakan bot, Chat ID Telegram staf harus didaftarkan:

1. Staf membuka Telegram → cari bot sekolah → kirim `/start`
2. Bot akan menolak dengan pesan: *"Anda tidak terdaftar"*
3. Staf minta Chat ID ke [@userinfobot](https://t.me/userinfobot)
4. Kepala TU masuk ke Web App → **Kelola User** → Tambah/Edit user → isi **Telegram Chat ID**
5. Staf coba lagi kirim `/start` ke bot → sekarang berhasil

---

### Perintah Bot

| Perintah | Fungsi |
|---|---|
| `/start` atau `/menu` | Tampilkan menu utama |
| `/surat_keluar` | Mulai membuat surat keluar |
| `/surat_masuk` | Catat surat masuk baru |
| `/cari` | Cari arsip surat |
| `/disposisi` | Lihat disposisi yang menunggu |
| `/dashboard` | Ringkasan statistik |

---

### Cara Pakai Bot — Buat Surat Keluar

```
1. Ketik /surat_keluar
   └─ Bot tampilkan daftar template surat

2. Pilih template (tap tombol)
   └─ Bot tampilkan preview nomor surat & form isian

3. Bot akan menanyakan satu per satu:
   "Isi data untuk: nama_siswa"
   → Ketik: Ahmad Fauzi
   "Isi data untuk: keperluan"
   → Ketik: Outing Class ke Kebun Raya

4. Bot memproses & mengirim PDF langsung ke chat ✅
   └─ Surat otomatis tercatat di arsip
```

---

### Cara Pakai Bot — Catat Surat Masuk

**Cara A — Kirim Foto:**
```
1. Foto surat dari kamera HP → kirim ke bot
2. Bot: "📸 Foto diterima. Sedang diproses..."
3. Setelah konversi, bot minta data:
   "Balas dengan: NOMOR_SURAT | TANGGAL | PENGIRIM | PERIHAL"
4. Contoh balas:
   001/DISDIK/V/2026 | 2026-05-15 | Dinas Pendidikan | Undangan Rapat Koordinasi
5. Bot konfirmasi: "✅ Surat masuk dicatat. No. Agenda: AGD-SD-001-2026"
```

**Cara B — Kirim PDF:**
```
1. Kirim file PDF ke bot
2. Lanjut seperti Cara A dari langkah 3
```

**Cara C — Input Teks Manual:**
```
1. Ketik /surat_masuk
2. Ikuti instruksi bot
```

---

### Cara Pakai Bot — Cari Arsip

```
Ketik /cari
Bot: "Ketik kata kunci. Format: perihal:kata_kunci atau bulan:5"

Contoh pencarian:
  perihal:rapat          → cari surat dengan kata "rapat" di perihal
  bulan:5                → semua surat bulan Mei
  pengirim:dinas         → surat dari pengirim mengandung "dinas"
  perihal:undangan bulan:5  → kombinasi filter
```

---

### Notifikasi Otomatis Bot

Bot mengirim notifikasi otomatis untuk kejadian berikut:

| Kejadian | Penerima Notif |
|---|---|
| Disposisi surat masuk | Penerima disposisi |
| Pengajuan promosi siswa | TU jenjang tujuan |
| Konfirmasi promosi disetujui/ditolak | TU pengaju |

---

## 13. Referensi Sheet CONFIG

Berikut daftar lengkap key yang tersedia di Sheet CONFIG:

### Konfigurasi Umum
| KEY | Contoh Value | Keterangan |
|---|---|---|
| `NAMA_SEKOLAH` | `Sekolah Rakyat Sulawesi Selatan` | Nama lengkap sekolah |
| `KODE_SEKOLAH` | `SRT-48` | Kode untuk nomor surat |
| `TAHUN_AJARAN` | `2025/2026` | Tahun ajaran aktif |
| `ALAMAT_SEKOLAH` | `Jl. Pendidikan No.1` | Alamat lengkap |
| `TELP_SEKOLAH` | `0411-123456` | Nomor telepon |

### Telegram
| KEY | Contoh Value | Keterangan |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | `7123456789:AAFxx...` | Token dari @BotFather |

### Google Drive
| KEY | Keterangan |
|---|---|
| `DRIVE_ROOT_ID` | ID folder SIM-TU di Drive (auto-isi setelah initFolderStructure) |

### Format Nomor Surat
| KEY | Default Value | Keterangan |
|---|---|---|
| `FORMAT_NOMOR` | `{{URUT}}/{{KODE_SEKOLAH}}/{{KODE_SURAT}}.{{KLASIFIKASI}}/{{BULAN}}/{{TAHUN}}` | Format bisa diubah |
| `PANJANG_URUT` | `3` | Digit nomor urut (3 = 001, 4 = 0001) |

### Placeholder yang tersedia di FORMAT_NOMOR
| Placeholder | Keterangan |
|---|---|
| `{{URUT}}` | Nomor urut auto-increment per jenjang per tahun |
| `{{KODE_SEKOLAH}}` | Dari key KODE_SEKOLAH |
| `{{KODE_SURAT}}` | Dari template (DL, SKET, dll) |
| `{{KLASIFIKASI}}` | Kode klasifikasi arsip (dari template) |
| `{{BULAN}}` | Bulan angka (5) |
| `{{BULAN_ROMAWI}}` | Bulan romawi (V) |
| `{{TAHUN}}` | Tahun 4 digit (2026) |

### Modul Aktif/Nonaktif
| KEY | Value | Keterangan |
|---|---|---|
| `MODUL_KESISWAAN` | `TRUE` / `FALSE` | Aktifkan modul kesiswaan |
| `MODUL_SURAT` | `TRUE` / `FALSE` | Aktifkan modul persuratan |
| `MODUL_DISPOSISI` | `TRUE` / `FALSE` | Aktifkan modul disposisi |
| `MODUL_BOT_TELEGRAM` | `TRUE` / `FALSE` | Aktifkan Telegram Bot |

### Nomor Urut Surat *(🔒 Jangan edit kecuali darurat)*
| KEY | Keterangan |
|---|---|
| `NO_URUT_SD_2026` | Nomor urut surat keluar SD tahun 2026 |
| `NO_URUT_SMP_2026` | Nomor urut surat keluar SMP tahun 2026 |
| `NO_URUT_SMA_2026` | Nomor urut surat keluar SMA tahun 2026 |

> ⚠️ Jika perlu koreksi nomor urut, gunakan menu **Konfigurasi** di Web App —
> jangan edit langsung di spreadsheet untuk menghindari race condition.

---


## 14. Troubleshooting

### ❌ Tidak bisa login
| Penyebab | Solusi |
|---|---|
| Password salah | Minta Kepala TU reset password di Sheet USERS |
| Akun nonaktif | Kepala TU ubah STATUS → `AKTIF` di Sheet USERS |
| Session masih aktif di perangkat lain | Kepala TU kosongkan kolom SESSION_TOKEN |

---

### ❌ Bot Telegram tidak merespons
| Penyebab | Solusi |
|---|---|
| Webhook belum diset | Jalankan `TelegramBot.setWebhook(url)` di Apps Script |
| Token salah di CONFIG | Periksa `TELEGRAM_BOT_TOKEN` di Sheet CONFIG |
| Web App belum di-deploy | Ulangi Langkah 6 |
| Chat ID belum terdaftar | Tambahkan Telegram ID di Sheet USERS |

---

### ❌ Surat gagal dibuat (PDF error)
| Penyebab | Solusi |
|---|---|
| DOC_ID di TEMPLATE_REG kosong/salah | Periksa kolom DOC_ID di Sheet TEMPLATE_REG |
| Google Doc belum dibagikan ke GAS | Share Doc ke akun GAS sebagai Editor |
| Placeholder tidak cocok | Pastikan nama placeholder di Sheet sama persis dengan di Google Doc |

---

### ❌ Foto surat gagal dikonversi
| Penyebab | Solusi |
|---|---|
| Ukuran file terlalu besar | Kompresi foto terlebih dahulu (max 10MB) |
| Format tidak didukung | Gunakan JPG atau PNG saja |
| Timeout GAS | Foto resolusi terlalu tinggi, kurangi ukuran |

---

### ❌ Nomor surat loncat / tidak urut
| Penyebab | Solusi |
|---|---|
| Surat dibuat tapi dibatalkan | Normal — nomor tidak bisa di-recycle |
| Edit manual di Sheet CONFIG | Gunakan menu Konfigurasi di Web App untuk koreksi |
| Race condition (dua orang bersamaan) | LockService sudah menangani ini secara otomatis |

---

### ❌ Perlu deploy ulang setelah edit kode
Setiap kali Anda mengubah kode GAS:
1. Klik **Deploy** → **Manage deployments**
2. Klik ✏️ Edit di deployment yang ada
3. Ubah **version** ke **New version**
4. Klik **Deploy**

> ⚠️ URL Web App **tidak berubah** saat deploy ulang.

---

### ❌ Kuota Google Apps Script habis
GAS memiliki batas harian:
- **6 menit** total waktu eksekusi per hari (akun biasa)
- **Solusi:** Gunakan akun Google Workspace (G Suite) untuk batas lebih tinggi

---

## 15. Daftar Placeholder Otomatis

Placeholder berikut **terisi otomatis** oleh sistem — tidak perlu diisi manual:

| Placeholder | Nilai |
|---|---|
| `{{no_surat}}` | Nomor surat yang di-generate otomatis |
| `{{tanggal}}` | Tanggal surat dibuat (format: Senin, 15 Mei 2026) |
| `{{tahun}}` | Tahun saat ini (2026) |
| `{{bulan}}` | Bulan angka (5) |
| `{{nama_sekolah}}` | Dari CONFIG: `NAMA_SEKOLAH` |
| `{{kode_sekolah}}` | Dari CONFIG: `KODE_SEKOLAH` |
| `{{tahun_ajaran}}` | Dari CONFIG: `TAHUN_AJARAN` |
| `{{jenjang}}` | Jenjang pembuat surat (SD/SMP/SMA) |
| `{{dibuat_oleh}}` | Nama user yang membuat surat |

### Placeholder dari data siswa (jika surat untuk siswa):
| Placeholder | Keterangan |
|---|---|
| `{{nisn}}` | Nomor Induk Siswa Nasional |
| `{{nama_siswa}}` | Nama lengkap siswa |
| `{{tempat_lahir}}` | Tempat lahir |
| `{{tgl_lahir}}` | Tanggal lahir |
| `{{kelas}}` | Kelas (7A, 8B, dll) |
| `{{rombel}}` | Rombongan belajar |
| `{{nama_ayah}}` | Nama ayah |
| `{{nama_ibu}}` | Nama ibu |
| `{{no_telp_ortu}}` | No. telp orang tua |
| `{{alamat}}` | Alamat lengkap |

---

## Kontak & Dukungan

Jika mengalami kendala teknis yang tidak ada di troubleshooting ini,
laporkan melalui chat session Kiro dengan menyertakan:
1. Screenshot error yang muncul
2. Langkah yang dilakukan sebelum error
3. Isi sheet CONFIG (sensor token Telegram)

---

*SIM-TU v1.0 — Sekolah Rakyat © 2026*
*Dokumen ini bersifat confidential untuk penggunaan internal sekolah.*
