# PRD — SIM-TU v1.0
### Sistem Informasi Manajemen Tata Usaha | Sekolah Rakyat

> Dokumen ini adalah versi ringkas PRD untuk referensi development.
> Lihat diskusi lengkap di sesi Kiro untuk detail keputusan desain.

---

## Ringkasan
SIM-TU adalah sistem kearsipan & administrasi digital berbasis Google Apps Script (GAS) untuk Tata Usaha Sekolah Rakyat (SD/SMP/SMA). Dapat diakses via Web App dan Telegram Bot. Tidak ada transaksi keuangan.

## Stack Teknis
| Komponen | Teknologi |
|---|---|
| Platform | Google Apps Script |
| Database | Google Sheets |
| Storage | Google Drive |
| Template Surat | Google Docs |
| Bot | Telegram Bot API (Webhook) |

## Role
- **Kepala TU** — Super admin, akses semua jenjang, kelola user & CONFIG
- **TU SD/SMP/SMA** — Maksimal 2 akun per jenjang, akses jenjang sendiri

## Fitur Utama
1. Arsip Surat Masuk (foto/PDF → arsip digital)
2. Surat Keluar (template Google Docs → PDF otomatis)
3. Penomoran surat otomatis per jenjang
4. Disposisi surat bertingkat + notifikasi Telegram
5. Manajemen kesiswaan + promosi jenjang (Maker-Checker)
6. Telegram Bot aktif dua arah (inline keyboard)
7. Konfigurasi via Sheet CONFIG tanpa sentuh kode

## Format Nomor Surat
```
{{URUT}}/{{KODE_SEKOLAH}}/{{KODE_SURAT}}.{{KLASIFIKASI}}/{{BULAN}}/{{TAHUN}}
Contoh: 008/SRT-48/DL.00.00/5/2026
```

## Keamanan
- Hard-limit 2 akun per role jenjang
- Single Session Login
- Maker-Checker untuk aksi kritis
- Whitelist Telegram ID
- Audit Log semua aktivitas
