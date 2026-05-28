# SIM-TU — Sistem Informasi Manajemen Tata Usaha
### Sekolah Rakyat | Berbasis Google Apps Script + Telegram Bot

---

## 📌 Deskripsi

SIM-TU adalah sistem kearsipan dan administrasi digital untuk operasional Tata Usaha Sekolah Rakyat (SD, SMP, SMA) yang dapat diakses melalui **Web App (GAS)** dan **Telegram Bot**. Sistem ini dirancang tanpa transaksi keuangan dan fokus pada kearsipan surat masuk, surat keluar, dan manajemen kesiswaan.

---

## 🏗️ Arsitektur

```
Google Apps Script (GAS)
├── Web App (HTML Service)
└── Telegram Bot (Webhook)

Google Sheets (Database)
├── CONFIG
├── USERS
├── SISWA_SD / SISWA_SMP / SISWA_SMA
├── SURAT_MASUK
├── SURAT_KELUAR
├── DISPOSISI
├── TEMPLATE_REG
└── AUDIT_LOG

Google Drive (Storage)
└── SIM-TU/
    ├── SD/Surat Masuk|Keluar|Template
    ├── SMP/...
    └── SMA/...

Google Docs (Template Surat)
└── Placeholder {{variable}}
```

---

## 👥 Role & Akses

| Role | Akses |
|---|---|
| **Kepala TU** | Akses penuh semua jenjang + kelola user + CONFIG |
| **TU SD** (maks 2) | Akses penuh data SD |
| **TU SMP** (maks 2) | Akses penuh data SMP |
| **TU SMA** (maks 2) | Akses penuh data SMA |

---

## 📂 Struktur Project

```
SIM-TU/
├── src/
│   ├── gas/
│   │   ├── Code.gs              ← Entry point GAS
│   │   ├── Auth.gs              ← Autentikasi & RBAC
│   │   ├── Config.gs            ← Baca/tulis Sheet CONFIG
│   │   ├── SuratMasuk.gs        ← Modul surat masuk
│   │   ├── SuratKeluar.gs       ← Modul surat keluar
│   │   ├── Kesiswaan.gs         ← Modul kesiswaan
│   │   ├── Disposisi.gs         ← Modul disposisi
│   │   ├── TelegramBot.gs       ← Handler Telegram webhook
│   │   ├── PdfService.gs        ← Generate PDF dari template
│   │   ├── DriveService.gs      ← Manajemen folder Drive
│   │   ├── NomorSurat.gs        ← Penomoran surat otomatis
│   │   └── AuditLog.gs          ← Pencatatan audit
│   └── frontend/
│       ├── index.html           ← Shell HTML utama
│       ├── dashboard.html       ← Halaman dashboard
│       ├── surat-masuk.html     ← Halaman surat masuk
│       ├── surat-keluar.html    ← Halaman surat keluar
│       ├── kesiswaan.html       ← Halaman kesiswaan
│       ├── template-reg.html    ← Halaman kelola template
│       ├── users.html           ← Halaman kelola user
│       ├── config.html          ← Halaman CONFIG (Kepala TU)
│       └── assets/
│           ├── css/
│           │   └── main.css
│           └── js/
│               └── main.js
├── docs/
│   ├── PRD.md                   ← Product Requirements Document
│   └── SETUP.md                 ← Panduan setup & deployment
├── scripts/
│   └── setup-sheets.gs         ← Script inisialisasi Sheets pertama kali
└── README.md
```

---

## 🚀 Roadmap

- **Phase 1** — Foundation: Setup GAS, Sheets, Autentikasi, RBAC
- **Phase 2** — Core Arsip: Surat Masuk, Surat Keluar, Penomoran, Pencarian
- **Phase 3** — Bot & Integrasi: Telegram Bot, Notifikasi, Disposisi
- **Phase 4** — Polish: Kesiswaan, Maker-Checker, Dashboard, Audit Log

---

## ⚙️ Konfigurasi

Semua konfigurasi sistem dilakukan melalui **Sheet CONFIG** di Google Sheets — tanpa menyentuh kode:

- Nama & kode sekolah
- Token Telegram Bot
- Format nomor surat `{{URUT}}/{{KODE_SEKOLAH}}/{{KODE_SURAT}}.{{KLASIFIKASI}}/{{BULAN}}/{{TAHUN}}`
- Modul aktif/nonaktif
- Nomor urut surat per jenjang per tahun

---

## 📋 Format Nomor Surat

```
001 / SRT-48 / DL.00.00 / 5 / 2026
 │      │         │        │    │
 │      │         │        │    └── Tahun (auto)
 │      │         │        └─────── Bulan (auto)
 │      │         └──────────────── Kode Jenis + Klasifikasi Arsip
 │      └────────────────────────── Kode Sekolah (dari CONFIG)
 └───────────────────────────────── Nomor Urut per Jenjang (auto, reset/tahun)
```

---

*SIM-TU © 2026 — Sekolah Rakyat*
