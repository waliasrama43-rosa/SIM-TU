/**
 * setup-sheets.gs — Script Inisialisasi Sistem SIM-TU
 *
 * Jalankan fungsi initSistem() SEKALI saja saat pertama kali setup.
 * Fungsi ini akan:
 * 1. Membuat semua sheet yang diperlukan
 * 2. Mengisi header kolom
 * 3. Mengisi data CONFIG default
 * 4. Membuat struktur folder di Google Drive
 * 5. Membuat akun Kepala TU pertama
 */

function initSistem() {
  if (!SPREADSHEET_ID) {
    throw new Error('⚠️ Isi dulu SPREADSHEET_ID di Code.gs dengan ID Google Spreadsheet database Anda, lalu clasp push & jalankan lagi.');
  }
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  Logger.log('🚀 Memulai inisialisasi SIM-TU...');

  _buatSheetConfig(ss);
  _buatSheetUsers(ss);
  _buatSheetSiswaSd(ss);
  _buatSheetSiswaSmp(ss);
  _buatSheetSiswaSma(ss);
  _buatSheetSuratMasuk(ss);
  _buatSheetSuratKeluar(ss);
  _buatSheetDisposisi(ss);
  _buatSheetTemplateReg(ss);
  _buatSheetAuditLog(ss);

  Logger.log('✅ Semua sheet berhasil dibuat.');
  Logger.log('📁 Membuat struktur folder Drive...');

  // Inisialisasi folder Drive
  // DriveService.initFolderStructure(); // Uncomment setelah SPREADSHEET_ID diisi di Code.gs

  Logger.log('✅ Setup selesai!');
  Logger.log('⚠️  LANGKAH BERIKUTNYA:');
  Logger.log('   1. Isi SPREADSHEET_ID di Code.gs dengan ID spreadsheet ini: ' + ss.getId());
  Logger.log('   2. Isi TELEGRAM_BOT_TOKEN di sheet CONFIG');
  Logger.log('   3. Deploy sebagai Web App');
  Logger.log('   4. Jalankan TelegramBot.setWebhook(url) dengan URL Web App');
}

// ============================================================
// BUAT SHEET CONFIG
// ============================================================
function _buatSheetConfig(ss) {
  let sheet = ss.getSheetByName('CONFIG');
  if (!sheet) sheet = ss.insertSheet('CONFIG');
  sheet.clear();

  const headers = ['KEY', 'VALUE', 'KETERANGAN'];
  sheet.getRange(1, 1, 1, 3).setValues([headers])
       .setBackground('#1a73e8').setFontColor('white').setFontWeight('bold');

  const data = [
    // ── KONFIGURASI UMUM ──────────────────────────────────────
    ['--- KONFIGURASI UMUM ---', '', ''],
    ['NAMA_SEKOLAH',       'Sekolah Rakyat',                    'Nama lengkap sekolah'],
    ['KODE_SEKOLAH',       'SRT-48',                            'Kode sekolah untuk nomor surat'],
    ['TAHUN_AJARAN',       '2025/2026',                         'Tahun ajaran aktif'],
    ['ALAMAT_SEKOLAH',     '',                                  'Alamat lengkap sekolah'],
    ['TELP_SEKOLAH',       '',                                  'Nomor telepon sekolah'],

    // ── TELEGRAM BOT ─────────────────────────────────────────
    ['--- TELEGRAM BOT ---', '', ''],
    ['TELEGRAM_BOT_TOKEN', '',                                  '⚠️ Isi dengan token dari @BotFather'],

    // ── GOOGLE DRIVE ─────────────────────────────────────────
    ['--- GOOGLE DRIVE ---', '', ''],
    ['DRIVE_ROOT_ID',      '',                                  'ID folder root SIM-TU di Drive (auto-isi)'],

    // ── FORMAT NOMOR SURAT ───────────────────────────────────
    ['--- FORMAT NOMOR SURAT ---', '', ''],
    ['FORMAT_NOMOR',       '{{URUT}}/{{KODE_SEKOLAH}}/{{KODE_SURAT}}.{{KLASIFIKASI}}/{{BULAN}}/{{TAHUN}}', 'Format nomor surat — ubah sesuai kebutuhan'],
    ['PANJANG_URUT',       '3',                                 'Jumlah digit nomor urut (3 = 001, 002...)'],

    // ── MODUL AKTIF ──────────────────────────────────────────
    ['--- MODUL AKTIF (TRUE/FALSE) ---', '', ''],
    ['MODUL_KESISWAAN',    'TRUE',                              'Aktifkan modul kesiswaan'],
    ['MODUL_SURAT',        'TRUE',                              'Aktifkan modul persuratan'],
    ['MODUL_DISPOSISI',    'TRUE',                              'Aktifkan modul disposisi'],
    ['MODUL_BOT_TELEGRAM', 'TRUE',                              'Aktifkan Telegram Bot'],

    // ── NOMOR URUT SURAT ─────────────────────────────────────
    ['--- NOMOR URUT SURAT (🔒 jangan edit manual) ---', '', ''],
    ['NO_URUT_SD_2025',    '0',                                 'Nomor urut SD tahun 2025'],
    ['NO_URUT_SD_2026',    '0',                                 'Nomor urut SD tahun 2026'],
    ['NO_URUT_SMP_2025',   '0',                                 'Nomor urut SMP tahun 2025'],
    ['NO_URUT_SMP_2026',   '0',                                 'Nomor urut SMP tahun 2026'],
    ['NO_URUT_SMA_2025',   '0',                                 'Nomor urut SMA tahun 2025'],
    ['NO_URUT_SMA_2026',   '0',                                 'Nomor urut SMA tahun 2026'],
    ['NO_URUT_AGD_SD_2026',  '0',                               'Nomor agenda surat masuk SD'],
    ['NO_URUT_AGD_SMP_2026', '0',                               'Nomor agenda surat masuk SMP'],
    ['NO_URUT_AGD_SMA_2026', '0',                               'Nomor agenda surat masuk SMA'],
  ];

  sheet.getRange(2, 1, data.length, 3).setValues(data);
  sheet.setColumnWidth(1, 250);
  sheet.setColumnWidth(2, 400);
  sheet.setColumnWidth(3, 300);
  Logger.log('  ✓ Sheet CONFIG');
}

// ============================================================
// BUAT SHEET USERS
// ============================================================
function _buatSheetUsers(ss) {
  let sheet = ss.getSheetByName('USERS');
  if (!sheet) sheet = ss.insertSheet('USERS');
  sheet.clear();

  const headers = ['ID','USERNAME','PASSWORD_HASH','ROLE','JENJANG','NAMA','EMAIL','TELEGRAM_ID','SESSION_TOKEN','LAST_LOGIN','STATUS'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers])
       .setBackground('#1a73e8').setFontColor('white').setFontWeight('bold');
  Logger.log('  ✓ Sheet USERS');
}

// ============================================================
// BUAT SHEET SISWA (SD/SMP/SMA)
// ============================================================
function _buatSheetSiswaSd(ss)  { _buatSheetSiswa(ss, 'SISWA_SD');  }
function _buatSheetSiswaSmp(ss) { _buatSheetSiswa(ss, 'SISWA_SMP'); }
function _buatSheetSiswaSma(ss) { _buatSheetSiswa(ss, 'SISWA_SMA'); }

function _buatSheetSiswa(ss, nama) {
  let sheet = ss.getSheetByName(nama);
  if (!sheet) sheet = ss.insertSheet(nama);
  sheet.clear();

  const headers = ['ID','NISN','NAMA','TEMPAT_LAHIR','TGL_LAHIR','JENIS_KELAMIN',
                   'KELAS','ROMBEL','TAHUN_MASUK','STATUS',
                   'NAMA_AYAH','NAMA_IBU','NO_TELP_ORTU','ALAMAT','CATATAN','CREATED_AT'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers])
       .setBackground('#34a853').setFontColor('white').setFontWeight('bold');
  Logger.log('  ✓ Sheet ' + nama);
}

// ============================================================
// BUAT SHEET SURAT MASUK
// ============================================================
function _buatSheetSuratMasuk(ss) {
  let sheet = ss.getSheetByName('SURAT_MASUK');
  if (!sheet) sheet = ss.insertSheet('SURAT_MASUK');
  sheet.clear();

  const headers = ['ID','NO_AGENDA','TGL_TERIMA','NO_SURAT','TGL_SURAT',
                   'PENGIRIM','PERIHAL','KLASIFIKASI','JENJANG',
                   'LAMPIRAN_ID','LAMPIRAN_URL','STATUS','DICATAT_OLEH','CREATED_AT'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers])
       .setBackground('#e8710a').setFontColor('white').setFontWeight('bold');
  Logger.log('  ✓ Sheet SURAT_MASUK');
}

// ============================================================
// BUAT SHEET SURAT KELUAR
// ============================================================
function _buatSheetSuratKeluar(ss) {
  let sheet = ss.getSheetByName('SURAT_KELUAR');
  if (!sheet) sheet = ss.insertSheet('SURAT_KELUAR');
  sheet.clear();

  const headers = ['ID','NO_SURAT','TGL_SURAT','JENIS','KODE_SURAT',
                   'PERIHAL','DITUJUKAN','JENJANG','TEMPLATE_ID',
                   'PDF_ID','PDF_URL','STATUS','DIBUAT_OLEH','CREATED_AT'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers])
       .setBackground('#e8710a').setFontColor('white').setFontWeight('bold');
  Logger.log('  ✓ Sheet SURAT_KELUAR');
}

// ============================================================
// BUAT SHEET DISPOSISI
// ============================================================
function _buatSheetDisposisi(ss) {
  let sheet = ss.getSheetByName('DISPOSISI');
  if (!sheet) sheet = ss.insertSheet('DISPOSISI');
  sheet.clear();

  const headers = ['ID','SURAT_ID','NO_AGENDA','PERIHAL','DARI',
                   'KEPADA','CATATAN','LEVEL','STATUS',
                   'TGL_DISPOSISI','TGL_SELESAI'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers])
       .setBackground('#9c27b0').setFontColor('white').setFontWeight('bold');
  Logger.log('  ✓ Sheet DISPOSISI');
}

// ============================================================
// BUAT SHEET TEMPLATE_REG
// ============================================================
function _buatSheetTemplateReg(ss) {
  let sheet = ss.getSheetByName('TEMPLATE_REG');
  if (!sheet) sheet = ss.insertSheet('TEMPLATE_REG');
  sheet.clear();

  const headers = ['ID','NAMA','KODE_SURAT','KLASIFIKASI','DOC_ID',
                   'PLACEHOLDERS','JENJANG','AKTIF','KETERANGAN'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers])
       .setBackground('#0f9d58').setFontColor('white').setFontWeight('bold');

  // Contoh data template
  const contoh = [
    ['TPL_CONTOH_01', 'Surat Keterangan Aktif', 'SKET', '00.00', '',
     'no_surat,tanggal,nama_siswa,nisn,kelas,tahun_ajaran,nama_sekolah',
     'SEMUA', 'TRUE', 'Isi DOC_ID dengan File ID Google Doc template'],
    ['TPL_CONTOH_02', 'Surat Dinas Luar', 'DL', '00.00', '',
     'no_surat,tanggal,nama_siswa,keperluan,tgl_kegiatan,nama_sekolah',
     'SEMUA', 'TRUE', 'Isi DOC_ID dengan File ID Google Doc template'],
  ];
  sheet.getRange(2, 1, contoh.length, contoh[0].length).setValues(contoh);
  Logger.log('  ✓ Sheet TEMPLATE_REG');
}

// ============================================================
// BUAT SHEET AUDIT_LOG
// ============================================================
function _buatSheetAuditLog(ss) {
  let sheet = ss.getSheetByName('AUDIT_LOG');
  if (!sheet) sheet = ss.insertSheet('AUDIT_LOG');
  sheet.clear();

  const headers = ['TIMESTAMP','USER_ID','USERNAME','AKSI','DETAIL','PLATFORM'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers])
       .setBackground('#607d8b').setFontColor('white').setFontWeight('bold');
  Logger.log('  ✓ Sheet AUDIT_LOG');
}
