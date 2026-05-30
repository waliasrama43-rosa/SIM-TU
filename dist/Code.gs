// ════════════════════════════════════════════════════════════
// MODUL: Code.gs
// ════════════════════════════════════════════════════════════
/**
 * SIM-TU — Sistem Informasi Manajemen Tata Usaha
 * Sekolah Rakyat | Google Apps Script
 *
 * Entry point utama aplikasi.
 * Handles: Web App doGet, Telegram webhook doPost
 */

// ============================================================
// KONSTANTA GLOBAL
// ============================================================
const SPREADSHEET_ID = ''; // Isi dengan ID Google Spreadsheet setelah setup
const VERSION        = '1.0.0';

// Nama Sheet
const SHEET = {
  CONFIG       : 'CONFIG',
  USERS        : 'USERS',
  SISWA_SD     : 'SISWA_SD',
  SISWA_SMP    : 'SISWA_SMP',
  SISWA_SMA    : 'SISWA_SMA',
  SURAT_MASUK  : 'SURAT_MASUK',
  SURAT_KELUAR : 'SURAT_KELUAR',
  DISPOSISI    : 'DISPOSISI',
  TEMPLATE_REG : 'TEMPLATE_REG',
  AUDIT_LOG    : 'AUDIT_LOG',
};

// Role
const ROLE = {
  KEPALA_TU : 'KEPALA_TU',
  TU_SD     : 'TU_SD',
  TU_SMP    : 'TU_SMP',
  TU_SMA    : 'TU_SMA',
};

// Jenjang
const JENJANG = {
  SD  : 'SD',
  SMP : 'SMP',
  SMA : 'SMA',
};

// ============================================================
// WEB APP — Entry Point
// ============================================================

/**
 * Menangani request GET → render Web App
 *
 * Catatan: doGet SELALU menyajikan shell (index). Gerbang autentikasi
 * ditangani di sisi client berdasarkan session token di sessionStorage,
 * karena server tidak bisa membaca sessionStorage browser.
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('frontend/index')
    .evaluate()
    .setTitle('SIM-TU — Tata Usaha')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Menangani request POST → Telegram Bot webhook
 */
function doPost(e) {
  try {
    const update = JSON.parse(e.postData.contents);
    TelegramBot.handleUpdate(update);
  } catch (err) {
    AuditLog.error('doPost', err.message);
  }
  return ContentService.createTextOutput('OK');
}

// ============================================================
// HELPER GLOBAL
// ============================================================

/**
 * Include file HTML partial
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Mendapatkan instance Spreadsheet utama
 */
function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

/**
 * Mendapatkan sheet berdasarkan nama
 */
function getSheet(sheetName) {
  return getSpreadsheet().getSheetByName(sheetName);
}

/**
 * Response JSON standar untuk client-side call
 */
function jsonResponse(success, data, message) {
  return JSON.stringify({
    success : success,
    data    : data || null,
    message : message || '',
  });
}

// ════════════════════════════════════════════════════════════
// MODUL: Config.gs
// ════════════════════════════════════════════════════════════
/**
 * Config.gs — Baca & Tulis Sheet CONFIG
 *
 * Sheet CONFIG adalah pusat kendali sistem.
 * Semua nilai bisa diubah tanpa menyentuh kode.
 *
 * Format Sheet CONFIG:
 * Kolom A: KEY
 * Kolom B: VALUE
 * Kolom C: KETERANGAN
 */

const Config = (() => {

  let _cache = null; // Cache agar tidak baca sheet berulang-ulang

  // ----------------------------------------------------------
  // BACA CONFIG
  // ----------------------------------------------------------

  /**
   * Ambil semua config sebagai object key-value
   * @param {boolean} force - paksa refresh cache
   * @returns {object}
   */
  function getAll(force) {
    if (_cache && !force) return _cache;

    const sheet  = getSheet(SHEET.CONFIG);
    const data   = sheet.getDataRange().getValues();
    const result = {};

    for (let i = 1; i < data.length; i++) {
      const key   = String(data[i][0]).trim();
      const value = data[i][1];
      if (key && key !== '') {
        result[key] = value;
      }
    }

    _cache = result;
    return result;
  }

  /**
   * Ambil satu nilai config berdasarkan key
   * @param {string} key
   * @returns {any}
   */
  function get(key) {
    const all = getAll();
    return all[key] !== undefined ? all[key] : null;
  }

  /**
   * Set / update nilai config
   * @param {string} key
   * @param {any} value
   */
  function set(key, value) {
    const sheet = getSheet(SHEET.CONFIG);
    const data  = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === key) {
        sheet.getRange(i + 1, 2).setValue(value);
        _cache = null; // Invalidate cache
        return true;
      }
    }

    // Key belum ada → tambah baris baru
    sheet.appendRow([key, value, '']);
    _cache = null;
    return true;
  }

  // ----------------------------------------------------------
  // SHORTCUT CONFIG UMUM
  // ----------------------------------------------------------

  function getNamaSekolah()   { return get('NAMA_SEKOLAH') || 'Sekolah Rakyat'; }
  function getKodeSekolah()   { return get('KODE_SEKOLAH') || 'SRT-00'; }
  function getTahunAjaran()   { return get('TAHUN_AJARAN') || '2025/2026'; }
  function getBotToken()      { return get('TELEGRAM_BOT_TOKEN') || ''; }
  function getDriveRootId()   { return get('DRIVE_ROOT_ID') || ''; }
  function getPanjangUrut()   { return parseInt(get('PANJANG_URUT')) || 3; }

  /**
   * Ambil format nomor surat dari CONFIG
   * Default: {{URUT}}/{{KODE_SEKOLAH}}/{{KODE_SURAT}}.{{KLASIFIKASI}}/{{BULAN}}/{{TAHUN}}
   */
  function getFormatNomor() {
    return get('FORMAT_NOMOR') ||
      '{{URUT}}/{{KODE_SEKOLAH}}/{{KODE_SURAT}}.{{KLASIFIKASI}}/{{BULAN}}/{{TAHUN}}';
  }

  /**
   * Cek apakah modul aktif
   * @param {string} moduleName - misal 'MODUL_SURAT', 'MODUL_KESISWAAN'
   * @returns {boolean}
   */
  function isModulAktif(moduleName) {
    const val = get(moduleName);
    if (val === null) return true; // Default aktif jika belum diset
    return String(val).toUpperCase() === 'TRUE';
  }

  // ----------------------------------------------------------
  // NOMOR URUT SURAT
  // ----------------------------------------------------------

  /**
   * Ambil nomor urut saat ini untuk jenjang & tahun tertentu
   * @param {string} jenjang - 'SD', 'SMP', 'SMA'
   * @param {number} tahun
   * @returns {number}
   */
  function getNoUrut(jenjang, tahun) {
    const key = `NO_URUT_${jenjang}_${tahun}`;
    const val = get(key);
    return val ? parseInt(val) : 0;
  }

  /**
   * Increment nomor urut dan return nomor baru
   * Menggunakan LockService untuk mencegah race condition
   * @param {string} jenjang
   * @param {number} tahun
   * @returns {number} nomor urut baru
   */
  function incrementNoUrut(jenjang, tahun) {
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(30000); // tunggu max 30 detik

      const current = getNoUrut(jenjang, tahun);
      const next    = current + 1;
      const key     = `NO_URUT_${jenjang}_${tahun}`;

      set(key, next);
      return next;

    } finally {
      lock.releaseLock();
    }
  }

  /**
   * Koreksi manual nomor urut (Kepala TU only)
   * @param {string} actorToken
   * @param {string} jenjang
   * @param {number} tahun
   * @param {number} nilaiBaru
   */
  function koreksiNoUrut(actorToken, jenjang, tahun, nilaiBaru) {
    const actor = Auth.validateSession(actorToken);
    if (!actor || actor.role !== ROLE.KEPALA_TU) {
      return jsonResponse(false, null, 'Akses ditolak. Hanya Kepala TU.');
    }

    const key = `NO_URUT_${jenjang}_${tahun}`;
    set(key, parseInt(nilaiBaru));

    AuditLog.write(
      actor.id, actor.username,
      'KOREKSI_NO_URUT',
      `${jenjang} ${tahun} → ${nilaiBaru}`
    );

    return jsonResponse(true, null, `Nomor urut ${jenjang} ${tahun} dikoreksi ke ${nilaiBaru}.`);
  }

  // ----------------------------------------------------------
  // PUBLIC API
  // ----------------------------------------------------------
  return {
    getAll,
    get,
    set,
    getNamaSekolah,
    getKodeSekolah,
    getTahunAjaran,
    getBotToken,
    getDriveRootId,
    getPanjangUrut,
    getFormatNomor,
    isModulAktif,
    getNoUrut,
    incrementNoUrut,
    koreksiNoUrut,
  };

})();

// ════════════════════════════════════════════════════════════
// MODUL: AuditLog.gs
// ════════════════════════════════════════════════════════════
/**
 * AuditLog.gs — Pencatatan semua aktivitas sistem
 *
 * Kolom Sheet AUDIT_LOG:
 * TIMESTAMP | USER_ID | USERNAME | AKSI | DETAIL | IP/PLATFORM
 */

const AuditLog = (() => {

  const COL = {
    TIMESTAMP : 1,
    USER_ID   : 2,
    USERNAME  : 3,
    AKSI      : 4,
    DETAIL    : 5,
    PLATFORM  : 6,
  };

  /**
   * Catat aktivitas
   * @param {string} userId
   * @param {string} username
   * @param {string} aksi     - misal: 'LOGIN', 'BUAT_SURAT_KELUAR'
   * @param {string} detail   - informasi tambahan
   * @param {string} platform - 'Web' / 'Telegram' / 'System'
   */
  function write(userId, username, aksi, detail, platform) {
    try {
      const sheet = getSheet(SHEET.AUDIT_LOG);
      sheet.appendRow([
        new Date(),
        userId   || '',
        username || 'SYSTEM',
        aksi     || '',
        detail   || '',
        platform || 'System',
      ]);
    } catch (e) {
      // Jangan sampai error AuditLog mengganggu proses utama
      console.error('AuditLog.write error:', e.message);
    }
  }

  /**
   * Catat error sistem
   */
  function error(sumber, pesanError) {
    write('SYSTEM', 'SYSTEM', 'ERROR_' + sumber, pesanError, 'System');
  }

  /**
   * Ambil log terbaru (untuk Kepala TU)
   * @param {string} token
   * @param {number} limit - jumlah baris terakhir
   */
  function getRecent(token, limit) {
    const user = Auth.validateSession(token);
    if (!user || user.role !== ROLE.KEPALA_TU) {
      return jsonResponse(false, null, 'Akses ditolak.');
    }

    const sheet = getSheet(SHEET.AUDIT_LOG);
    const data  = sheet.getDataRange().getValues();
    const n     = parseInt(limit) || 50;

    // Ambil n baris terakhir (skip header)
    const rows  = data.slice(1).slice(-n).reverse();
    const hasil = rows.map(row => ({
      timestamp : row[COL.TIMESTAMP - 1],
      userId    : row[COL.USER_ID - 1],
      username  : row[COL.USERNAME - 1],
      aksi      : row[COL.AKSI - 1],
      detail    : row[COL.DETAIL - 1],
      platform  : row[COL.PLATFORM - 1],
    }));

    return jsonResponse(true, hasil, `${hasil.length} log terakhir.`);
  }

  return { write, error, getRecent };

})();

// ════════════════════════════════════════════════════════════
// MODUL: Auth.gs
// ════════════════════════════════════════════════════════════
/**
 * Auth.gs — Autentikasi & Role-Based Access Control (RBAC)
 *
 * Fitur:
 * - Login dengan username + password
 * - Single Session (satu akun = satu perangkat aktif)
 * - Hard-limit akun per role (maks 2 per jenjang)
 * - Validasi session token
 * - Whitelist Telegram Chat ID
 */

const Auth = (() => {

  // Kolom di Sheet USERS
  const COL = {
    ID          : 1,
    USERNAME    : 2,
    PASSWORD    : 3,  // Hashed
    ROLE        : 4,
    JENJANG     : 5,
    NAMA        : 6,
    EMAIL       : 7,
    TELEGRAM_ID : 8,
    SESSION     : 9,  // Token sesi aktif
    LAST_LOGIN  : 10,
    STATUS      : 11, // AKTIF / NONAKTIF
  };

  const MAX_AKUN_PER_ROLE = 2;

  // ----------------------------------------------------------
  // LOGIN
  // ----------------------------------------------------------

  /**
   * Proses login user
   * @param {string} username
   * @param {string} password
   * @returns {string} JSON response dengan token atau error
   */
  function login(username, password) {
    const sheet = getSheet(SHEET.USERS);
    const data  = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[COL.USERNAME - 1] !== username) continue;
      if (row[COL.STATUS - 1] !== 'AKTIF') {
        return jsonResponse(false, null, 'Akun tidak aktif.');
      }

      const hashedInput = _hashPassword(password);
      if (row[COL.PASSWORD - 1] !== hashedInput) {
        return jsonResponse(false, null, 'Username atau password salah.');
      }

      // Generate token baru (single session: invalidate token lama)
      const token = _generateToken();
      const now   = new Date();

      sheet.getRange(i + 1, COL.SESSION).setValue(token);
      sheet.getRange(i + 1, COL.LAST_LOGIN).setValue(now);

      AuditLog.write(row[COL.ID - 1], username, 'LOGIN', 'Web App');

      return jsonResponse(true, {
        token    : token,
        username : username,
        nama     : row[COL.NAMA - 1],
        role     : row[COL.ROLE - 1],
        jenjang  : row[COL.JENJANG - 1],
      }, 'Login berhasil.');
    }

    return jsonResponse(false, null, 'Username atau password salah.');
  }

  // ----------------------------------------------------------
  // LOGOUT
  // ----------------------------------------------------------

  function logout(token) {
    const user = _getUserByToken(token);
    if (!user) return jsonResponse(false, null, 'Sesi tidak ditemukan.');

    const sheet = getSheet(SHEET.USERS);
    const data  = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][COL.SESSION - 1] === token) {
        sheet.getRange(i + 1, COL.SESSION).setValue('');
        AuditLog.write(data[i][COL.ID - 1], data[i][COL.USERNAME - 1], 'LOGOUT', '');
        break;
      }
    }
    return jsonResponse(true, null, 'Logout berhasil.');
  }

  // ----------------------------------------------------------
  // VALIDASI SESI
  // ----------------------------------------------------------

  /**
   * Validasi token sesi — dipakai di doGet & setiap request
   * @param {string} token
   * @returns {object|null} user object atau null
   */
  function validateSession(token) {
    if (!token) return null;
    return _getUserByToken(token);
  }

  // ----------------------------------------------------------
  // VALIDASI TELEGRAM
  // ----------------------------------------------------------

  /**
   * Cek apakah Telegram Chat ID terdaftar & aktif
   * @param {string} chatId
   * @returns {object|null} user object atau null
   */
  function validateTelegram(chatId) {
    const sheet = getSheet(SHEET.USERS);
    const data  = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (String(row[COL.TELEGRAM_ID - 1]) === String(chatId) &&
          row[COL.STATUS - 1] === 'AKTIF') {
        return {
          id       : row[COL.ID - 1],
          username : row[COL.USERNAME - 1],
          nama     : row[COL.NAMA - 1],
          role     : row[COL.ROLE - 1],
          jenjang  : row[COL.JENJANG - 1],
        };
      }
    }
    return null;
  }

  // ----------------------------------------------------------
  // KELOLA USER (Kepala TU only)
  // ----------------------------------------------------------

  /**
   * Tambah user baru
   */
  function addUser(actorToken, userData) {
    const actor = validateSession(actorToken);
    if (!actor || actor.role !== ROLE.KEPALA_TU) {
      return jsonResponse(false, null, 'Akses ditolak. Hanya Kepala TU.');
    }

    // Hard-limit: cek jumlah akun per role
    if (!_checkRoleLimit(userData.role)) {
      return jsonResponse(false, null,
        `Batas maksimal ${MAX_AKUN_PER_ROLE} akun untuk role ${userData.role} sudah tercapai.`);
    }

    const sheet = getSheet(SHEET.USERS);
    const id    = _generateId();
    const row   = [
      id,
      userData.username,
      _hashPassword(userData.password),
      userData.role,
      userData.jenjang,
      userData.nama,
      userData.email || '',
      userData.telegramId || '',
      '', // session kosong
      '',
      'AKTIF',
    ];

    sheet.appendRow(row);
    AuditLog.write(actor.id, actor.username, 'ADD_USER', `User: ${userData.username}`);
    return jsonResponse(true, { id }, 'User berhasil ditambahkan.');
  }

  /**
   * Nonaktifkan user
   */
  function deactivateUser(actorToken, userId) {
    const actor = validateSession(actorToken);
    if (!actor || actor.role !== ROLE.KEPALA_TU) {
      return jsonResponse(false, null, 'Akses ditolak.');
    }

    const sheet = getSheet(SHEET.USERS);
    const data  = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][COL.ID - 1] === userId) {
        sheet.getRange(i + 1, COL.STATUS).setValue('NONAKTIF');
        sheet.getRange(i + 1, COL.SESSION).setValue('');
        AuditLog.write(actor.id, actor.username, 'DEACTIVATE_USER', `UserID: ${userId}`);
        return jsonResponse(true, null, 'User dinonaktifkan.');
      }
    }
    return jsonResponse(false, null, 'User tidak ditemukan.');
  }

  // ----------------------------------------------------------
  // PRIVATE HELPERS
  // ----------------------------------------------------------

  function _getUserByToken(token) {
    const sheet = getSheet(SHEET.USERS);
    const data  = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[COL.SESSION - 1] === token && row[COL.STATUS - 1] === 'AKTIF') {
        return {
          id       : row[COL.ID - 1],
          username : row[COL.USERNAME - 1],
          nama     : row[COL.NAMA - 1],
          role     : row[COL.ROLE - 1],
          jenjang  : row[COL.JENJANG - 1],
        };
      }
    }
    return null;
  }

  function _checkRoleLimit(role) {
    const sheet = getSheet(SHEET.USERS);
    const data  = sheet.getDataRange().getValues();
    let count   = 0;

    for (let i = 1; i < data.length; i++) {
      if (data[i][COL.ROLE - 1] === role &&
          data[i][COL.STATUS - 1] === 'AKTIF') {
        count++;
      }
    }
    // Kepala TU tidak dibatasi
    if (role === ROLE.KEPALA_TU) return true;
    return count < MAX_AKUN_PER_ROLE;
  }

  function _hashPassword(password) {
    return Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      password
    ).map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
  }

  function _generateToken() {
    return Utilities.getUuid() + '_' + new Date().getTime();
  }

  function _generateId() {
    return 'USR_' + Utilities.getUuid().split('-')[0].toUpperCase();
  }

  // ----------------------------------------------------------
  // PUBLIC API
  // ----------------------------------------------------------
  return {
    login,
    logout,
    validateSession,
    validateTelegram,
    addUser,
    deactivateUser,
  };

})();

// ════════════════════════════════════════════════════════════
// MODUL: DriveService.gs
// ════════════════════════════════════════════════════════════
/**
 * DriveService.gs — Manajemen Folder Google Drive
 *
 * Struktur folder yang dibuat otomatis:
 *
 * 📁 SIM-TU/
 * ├── 📁 SD/
 * │   ├── 📁 Surat Masuk/2026/
 * │   ├── 📁 Surat Keluar/2026/
 * │   └── 📁 Template Surat/
 * ├── 📁 SMP/ (sama)
 * ├── 📁 SMA/ (sama)
 * ├── 📁 CONFIG/
 * └── 📁 _TEMP/
 */

const DriveService = (() => {

  // ----------------------------------------------------------
  // FOLDER SURAT MASUK
  // ----------------------------------------------------------

  function getFolderSuratMasuk(jenjang, tahun) {
    return _getOrCreateFolder([
      _getRootFolder(),
      jenjang,
      'Surat Masuk',
      String(tahun),
    ]);
  }

  // ----------------------------------------------------------
  // FOLDER SURAT KELUAR
  // ----------------------------------------------------------

  function getFolderSuratKeluar(jenjang, tahun) {
    return _getOrCreateFolder([
      _getRootFolder(),
      jenjang,
      'Surat Keluar',
      String(tahun),
    ]);
  }

  // ----------------------------------------------------------
  // FOLDER TEMPLATE SURAT
  // ----------------------------------------------------------

  function getFolderTemplate(jenjang) {
    return _getOrCreateFolder([
      _getRootFolder(),
      jenjang,
      'Template Surat',
    ]);
  }

  // ----------------------------------------------------------
  // FOLDER CONFIG
  // ----------------------------------------------------------

  function getFolderConfig() {
    return _getOrCreateFolder([
      _getRootFolder(),
      'CONFIG',
    ]);
  }

  // ----------------------------------------------------------
  // SETUP AWAL — Buat seluruh struktur folder
  // ----------------------------------------------------------

  /**
   * Inisialisasi semua folder sekaligus
   * Dipanggil saat pertama kali setup sistem
   */
  function initFolderStructure() {
    const root     = _getRootFolder();
    const jenjangs = ['SD', 'SMP', 'SMA'];
    const tahun    = new Date().getFullYear();

    jenjangs.forEach(j => {
      _getOrCreateFolder([root, j, 'Surat Masuk', String(tahun)]);
      _getOrCreateFolder([root, j, 'Surat Masuk', String(tahun - 1)]);
      _getOrCreateFolder([root, j, 'Surat Keluar', String(tahun)]);
      _getOrCreateFolder([root, j, 'Surat Keluar', String(tahun - 1)]);
      _getOrCreateFolder([root, j, 'Template Surat']);
    });

    _getOrCreateFolder([root, 'CONFIG']);
    _getOrCreateFolder([root, '_TEMP']);

    return 'Struktur folder berhasil dibuat.';
  }

  // ----------------------------------------------------------
  // PRIVATE HELPERS
  // ----------------------------------------------------------

  /**
   * Ambil root folder SIM-TU
   */
  function _getRootFolder() {
    const rootId = Config.getDriveRootId();
    if (rootId) {
      try {
        return DriveApp.getFolderById(rootId);
      } catch (e) {
        // Fallback ke root Drive jika ID tidak valid
      }
    }

    // Cari atau buat folder SIM-TU di root Drive
    const iter = DriveApp.getRootFolder().getFoldersByName('SIM-TU');
    if (iter.hasNext()) return iter.next();

    const newFolder = DriveApp.getRootFolder().createFolder('SIM-TU');
    Config.set('DRIVE_ROOT_ID', newFolder.getId());
    return newFolder;
  }

  /**
   * Buat / ambil folder berdasarkan path array
   * @param {Array} path - [parentFolder, 'nama1', 'nama2', ...]
   *                       atau ['root', 'nama1', ...]
   * @returns {string} Folder ID
   */
  function _getOrCreateFolder(path) {
    let current = path[0]; // Bisa berupa Folder object atau string 'root'

    if (typeof current === 'string') {
      current = DriveApp.getRootFolder();
    }

    for (let i = 1; i < path.length; i++) {
      const name = path[i];
      const iter = current.getFoldersByName(name);
      if (iter.hasNext()) {
        current = iter.next();
      } else {
        current = current.createFolder(name);
      }
    }

    return current.getId();
  }

  // ----------------------------------------------------------
  // PUBLIC API
  // ----------------------------------------------------------
  return {
    getFolderSuratMasuk,
    getFolderSuratKeluar,
    getFolderTemplate,
    getFolderConfig,
    initFolderStructure,
  };

})();

// ════════════════════════════════════════════════════════════
// MODUL: NomorSurat.gs
// ════════════════════════════════════════════════════════════
/**
 * NomorSurat.gs — Generate Nomor Surat Otomatis
 *
 * Format (dari CONFIG):
 * {{URUT}}/{{KODE_SEKOLAH}}/{{KODE_SURAT}}.{{KLASIFIKASI}}/{{BULAN}}/{{TAHUN}}
 *
 * Contoh output:
 * 008/SRT-48/DL.00.00/5/2026
 *
 * Prinsip keamanan:
 * - Nomor di-generate HANYA saat surat disimpan final
 * - LockService mencegah race condition
 * - Nomor lama (tahun sebelumnya) tetap tersimpan di CONFIG
 */

const NomorSurat = (() => {

  /**
   * Generate nomor surat baru
   * @param {string} jenjang   - 'SD', 'SMP', 'SMA'
   * @param {string} kodeSurat - misal 'DL', 'SKET', 'MUT'
   * @param {string} klasifikasi - misal '00.00'
   * @param {Date}   tanggal   - tanggal surat (default: sekarang)
   * @returns {string} nomor surat terformat
   */
  function generate(jenjang, kodeSurat, klasifikasi, tanggal) {
    const tgl   = tanggal || new Date();
    const tahun = tgl.getFullYear();
    const bulan = tgl.getMonth() + 1; // 1-12

    // Increment nomor urut (thread-safe)
    const noUrut = Config.incrementNoUrut(jenjang, tahun);

    // Format urut sesuai panjang digit dari CONFIG (misal 3 → "008")
    const panjang = Config.getPanjangUrut();
    const urutStr = String(noUrut).padStart(panjang, '0');

    // Ambil format dari CONFIG
    const format = Config.getFormatNomor();

    // Substitusi placeholder
    const nomor = format
      .replace('{{URUT}}', urutStr)
      .replace('{{KODE_SEKOLAH}}', Config.getKodeSekolah())
      .replace('{{KODE_SURAT}}', kodeSurat)
      .replace('{{KLASIFIKASI}}', klasifikasi)
      .replace('{{BULAN}}', bulan)
      .replace('{{BULAN_ROMAWI}}', _toRomawi(bulan))
      .replace('{{TAHUN}}', tahun);

    return nomor;
  }

  /**
   * Preview nomor surat berikutnya (tanpa increment)
   * Dipakai di form sebelum surat disimpan — READ ONLY
   * @param {string} jenjang
   * @param {string} kodeSurat
   * @param {string} klasifikasi
   * @returns {string} preview nomor
   */
  function preview(jenjang, kodeSurat, klasifikasi) {
    const tahun  = new Date().getFullYear();
    const bulan  = new Date().getMonth() + 1;
    const noUrut = Config.getNoUrut(jenjang, tahun) + 1; // +1 tapi belum disimpan

    const panjang = Config.getPanjangUrut();
    const urutStr = String(noUrut).padStart(panjang, '0');
    const format  = Config.getFormatNomor();

    return format
      .replace('{{URUT}}', urutStr)
      .replace('{{KODE_SEKOLAH}}', Config.getKodeSekolah())
      .replace('{{KODE_SURAT}}', kodeSurat || '??')
      .replace('{{KLASIFIKASI}}', klasifikasi || '00.00')
      .replace('{{BULAN}}', bulan)
      .replace('{{BULAN_ROMAWI}}', _toRomawi(bulan))
      .replace('{{TAHUN}}', tahun);
  }

  // ----------------------------------------------------------
  // PRIVATE HELPERS
  // ----------------------------------------------------------

  function _toRomawi(bulan) {
    const romawi = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
    return romawi[bulan - 1] || bulan;
  }

  // ----------------------------------------------------------
  // PUBLIC API
  // ----------------------------------------------------------
  return { generate, preview };

})();

// ════════════════════════════════════════════════════════════
// MODUL: PdfService.gs
// ════════════════════════════════════════════════════════════
/**
 * PdfService.gs — Generate PDF dari Template Google Docs
 *
 * Cara kerja:
 * 1. Copy Google Doc template ke folder sementara
 * 2. Ganti semua placeholder {{key}} dengan value
 * 3. Export Doc → PDF blob
 * 4. Simpan PDF ke Drive
 * 5. Hapus salinan Doc sementara
 */

const PdfService = (() => {

  /**
   * Generate PDF dari template Google Doc
   * @param {string} templateDocId  - File ID Google Doc template
   * @param {object} placeholders   - { key: value } untuk replace {{key}}
   * @param {string} namaFile       - Nama file PDF output
   * @returns {object} { fileId, fileUrl, blob }
   */
  function generateFromTemplate(templateDocId, placeholders, namaFile) {
    // 1. Copy template ke folder temp
    const tempFolder = _getTempFolder();
    const copyFile   = DriveApp.getFileById(templateDocId)
                               .makeCopy(namaFile + '_temp', tempFolder);
    const copyId     = copyFile.getId();

    try {
      // 2. Buka salinan dan ganti placeholder
      const doc  = DocumentApp.openById(copyId);
      const body = doc.getBody();

      _replacePlaceholders(body, placeholders);

      // Replace juga di header & footer jika ada
      const header = doc.getHeader();
      const footer = doc.getFooter();
      if (header) _replacePlaceholders(header, placeholders);
      if (footer) _replacePlaceholders(footer, placeholders);

      doc.saveAndClose();

      // 3. Export ke PDF
      const pdfBlob = DriveApp.getFileById(copyId)
                               .getAs('application/pdf')
                               .setName(namaFile + '.pdf');

      // 4. Simpan PDF sementara di folder temp
      const pdfFile = tempFolder.createFile(pdfBlob);
      pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      return {
        fileId  : pdfFile.getId(),
        fileUrl : pdfFile.getUrl(),
        blob    : pdfBlob,
      };

    } finally {
      // 5. Hapus salinan Doc sementara (selalu dieksekusi)
      try { DriveApp.getFileById(copyId).setTrashed(true); } catch(e) {}
    }
  }

  /**
   * Kirim PDF sebagai blob (untuk Telegram)
   * @param {string} templateDocId
   * @param {object} placeholders
   * @param {string} namaFile
   * @returns {Blob}
   */
  function generateBlob(templateDocId, placeholders, namaFile) {
    const result = generateFromTemplate(templateDocId, placeholders, namaFile);
    return DriveApp.getFileById(result.fileId).getBlob();
  }

  // ----------------------------------------------------------
  // PRIVATE HELPERS
  // ----------------------------------------------------------

  /**
   * Ganti semua placeholder {{key}} di dalam elemen dokumen
   */
  function _replacePlaceholders(element, placeholders) {
    Object.keys(placeholders).forEach(key => {
      const placeholder = '{{' + key + '}}';
      const value       = String(placeholders[key] !== null && placeholders[key] !== undefined
                                  ? placeholders[key] : '');
      element.replaceText(placeholder, value);
    });
  }

  /**
   * Ambil / buat folder temp di Drive
   */
  function _getTempFolder() {
    const rootId = Config.getDriveRootId();
    let root;

    if (rootId) {
      root = DriveApp.getFolderById(rootId);
    } else {
      root = DriveApp.getRootFolder();
    }

    // Cari folder _TEMP
    const iter = root.getFoldersByName('_TEMP');
    if (iter.hasNext()) return iter.next();

    return root.createFolder('_TEMP');
  }

  // ----------------------------------------------------------
  // PUBLIC API
  // ----------------------------------------------------------
  return { generateFromTemplate, generateBlob };

})();

// ════════════════════════════════════════════════════════════
// MODUL: TemplateReg.gs
// ════════════════════════════════════════════════════════════
/**
 * TemplateReg.gs — Registry Template Surat
 *
 * Sheet TEMPLATE_REG menyimpan daftar semua template surat.
 * Menambah template baru = tambah baris di sheet, tidak perlu sentuh kode.
 *
 * Kolom Sheet TEMPLATE_REG:
 * ID | NAMA | KODE_SURAT | KLASIFIKASI | DOC_ID | PLACEHOLDERS | JENJANG | AKTIF | KETERANGAN
 */

const TemplateReg = (() => {

  const COL = {
    ID           : 1,
    NAMA         : 2,
    KODE_SURAT   : 3,
    KLASIFIKASI  : 4,
    DOC_ID       : 5,  // File ID Google Doc
    PLACEHOLDERS : 6,  // Comma-separated: nama_siswa,kelas,tanggal
    JENJANG      : 7,  // SD / SMP / SMA / SEMUA
    AKTIF        : 8,  // TRUE / FALSE
    KETERANGAN   : 9,
  };

  // ----------------------------------------------------------
  // BACA TEMPLATE
  // ----------------------------------------------------------

  /**
   * Ambil semua template aktif
   * @param {string} jenjang - filter per jenjang (opsional)
   */
  function getAll(jenjang) {
    const sheet  = getSheet(SHEET.TEMPLATE_REG);
    const data   = sheet.getDataRange().getValues();
    const result = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[COL.ID - 1]) continue;

      const aktif         = String(row[COL.AKTIF - 1]).toUpperCase() === 'TRUE';
      const jenjangRow    = row[COL.JENJANG - 1];
      const jenjangMatch  = !jenjang ||
                            jenjangRow === 'SEMUA' ||
                            jenjangRow === jenjang;

      if (aktif && jenjangMatch) {
        result.push(_rowToObj(row));
      }
    }

    return result;
  }

  /**
   * Ambil template berdasarkan ID
   */
  function getById(id) {
    const sheet = getSheet(SHEET.TEMPLATE_REG);
    const data  = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][COL.ID - 1] === id) {
        return _rowToObj(data[i]);
      }
    }
    return null;
  }

  // ----------------------------------------------------------
  // TAMBAH TEMPLATE (Kepala TU only)
  // ----------------------------------------------------------

  /**
   * Tambah template baru via link Google Doc
   * @param {string} token
   * @param {object} data - { nama, kodeSurat, klasifikasi, docUrl, placeholders, jenjang, keterangan }
   */
  function tambah(token, data) {
    const user = Auth.validateSession(token);
    if (!user || user.role !== ROLE.KEPALA_TU) {
      return jsonResponse(false, null, 'Akses ditolak. Hanya Kepala TU.');
    }

    // Ekstrak File ID dari URL Google Doc
    const docId = _extractDocId(data.docUrl);
    if (!docId) {
      return jsonResponse(false, null, 'URL Google Doc tidak valid.');
    }

    // Verifikasi Doc bisa diakses
    try {
      DocumentApp.openById(docId);
    } catch (e) {
      return jsonResponse(false, null,
        'Google Doc tidak bisa diakses. Pastikan sudah dibagikan ke akun ini.');
    }

    const sheet = getSheet(SHEET.TEMPLATE_REG);
    const id    = _generateId();
    const row   = [
      id,
      data.nama,
      data.kodeSurat,
      data.klasifikasi || '00.00',
      docId,
      Array.isArray(data.placeholders)
        ? data.placeholders.join(',')
        : (data.placeholders || ''),
      data.jenjang || 'SEMUA',
      'TRUE',
      data.keterangan || '',
    ];

    sheet.appendRow(row);

    AuditLog.write(user.id, user.username, 'TAMBAH_TEMPLATE',
      `${data.nama} | Kode: ${data.kodeSurat}`);

    return jsonResponse(true, { id, docId }, 'Template berhasil ditambahkan.');
  }

  /**
   * Aktifkan / nonaktifkan template
   */
  function toggleAktif(token, templateId, status) {
    const user = Auth.validateSession(token);
    if (!user || user.role !== ROLE.KEPALA_TU) {
      return jsonResponse(false, null, 'Akses ditolak.');
    }

    const sheet = getSheet(SHEET.TEMPLATE_REG);
    const data  = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][COL.ID - 1] === templateId) {
        sheet.getRange(i + 1, COL.AKTIF).setValue(status ? 'TRUE' : 'FALSE');
        AuditLog.write(user.id, user.username, 'TOGGLE_TEMPLATE',
          `ID: ${templateId} → ${status ? 'AKTIF' : 'NONAKTIF'}`);
        return jsonResponse(true, null, `Template ${status ? 'diaktifkan' : 'dinonaktifkan'}.`);
      }
    }
    return jsonResponse(false, null, 'Template tidak ditemukan.');
  }

  // ----------------------------------------------------------
  // PRIVATE HELPERS
  // ----------------------------------------------------------

  function _rowToObj(row) {
    const placeholderStr = String(row[COL.PLACEHOLDERS - 1]);
    return {
      id           : row[COL.ID - 1],
      nama         : row[COL.NAMA - 1],
      kodeSurat    : row[COL.KODE_SURAT - 1],
      klasifikasi  : row[COL.KLASIFIKASI - 1],
      docId        : row[COL.DOC_ID - 1],
      placeholders : placeholderStr ? placeholderStr.split(',').map(s => s.trim()) : [],
      jenjang      : row[COL.JENJANG - 1],
      aktif        : String(row[COL.AKTIF - 1]).toUpperCase() === 'TRUE',
      keterangan   : row[COL.KETERANGAN - 1],
    };
  }

  /**
   * Ekstrak File ID dari berbagai format URL Google Doc
   * https://docs.google.com/document/d/FILE_ID/edit
   */
  function _extractDocId(url) {
    if (!url) return null;
    const match = String(url).match(/\/d\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }

  function _generateId() {
    return 'TPL_' + Utilities.getUuid().split('-')[0].toUpperCase();
  }

  // ----------------------------------------------------------
  // PUBLIC API
  // ----------------------------------------------------------
  return { getAll, getById, tambah, toggleAktif };

})();

// ════════════════════════════════════════════════════════════
// MODUL: SuratMasuk.gs
// ════════════════════════════════════════════════════════════
/**
 * SuratMasuk.gs — Modul Arsip Surat Masuk
 *
 * Fitur:
 * - Catat surat masuk (metadata)
 * - Upload lampiran: foto dari HP (auto-convert PDF) atau PDF langsung
 * - Pencarian & filter multi-kriteria
 * - Integrasi dengan modul Disposisi
 */

const SuratMasuk = (() => {

  // Kolom Sheet SURAT_MASUK
  const COL = {
    ID           : 1,
    NO_AGENDA    : 2,  // Nomor agenda internal
    TGL_TERIMA   : 3,
    NO_SURAT     : 4,  // Nomor surat dari pengirim
    TGL_SURAT    : 5,
    PENGIRIM     : 6,
    PERIHAL      : 7,
    KLASIFIKASI  : 8,
    JENJANG      : 9,
    LAMPIRAN_ID  : 10, // File ID di Google Drive
    LAMPIRAN_URL : 11,
    STATUS       : 12, // BARU / DIDISPOSISI / SELESAI
    DICATAT_OLEH : 12,
    CREATED_AT   : 13,
  };

  // ----------------------------------------------------------
  // CATAT SURAT MASUK
  // ----------------------------------------------------------

  /**
   * Simpan data surat masuk baru
   * @param {string} token - session token user
   * @param {object} data  - data surat masuk
   * @returns {string} JSON response
   */
  function catat(token, data) {
    if (!Config.isModulAktif('MODUL_SURAT')) {
      return jsonResponse(false, null, 'Modul Surat tidak aktif.');
    }

    const user = Auth.validateSession(token);
    if (!user) return jsonResponse(false, null, 'Sesi tidak valid.');

    const sheet    = getSheet(SHEET.SURAT_MASUK);
    const id       = _generateId();
    const noAgenda = _generateNoAgenda(user.jenjang);
    const now      = new Date();

    const row = [
      id,
      noAgenda,
      data.tglTerima ? new Date(data.tglTerima) : now,
      data.noSurat    || '',
      data.tglSurat   ? new Date(data.tglSurat) : '',
      data.pengirim   || '',
      data.perihal    || '',
      data.klasifikasi || '',
      user.jenjang,
      data.lampiranId  || '',
      data.lampiranUrl || '',
      'BARU',
      user.username,
      now,
    ];

    sheet.appendRow(row);

    AuditLog.write(user.id, user.username, 'CATAT_SURAT_MASUK',
      `ID: ${id} | Perihal: ${data.perihal}`);

    return jsonResponse(true, { id, noAgenda }, 'Surat masuk berhasil dicatat.');
  }

  // ----------------------------------------------------------
  // UPLOAD LAMPIRAN FOTO (dari HP → PDF)
  // ----------------------------------------------------------

  /**
   * Terima foto base64 dari web/bot, simpan ke Drive sebagai PDF
   * @param {string} token
   * @param {string} base64Data  - data foto dalam base64
   * @param {string} mimeType    - 'image/jpeg', 'image/png', dll
   * @param {string} namaSurat   - nama file untuk Drive
   * @param {string} jenjang
   * @returns {object} { fileId, fileUrl }
   */
  function uploadFoto(token, base64Data, mimeType, namaSurat, jenjang) {
    const user = Auth.validateSession(token);
    if (!user) return jsonResponse(false, null, 'Sesi tidak valid.');

    try {
      // Decode base64 → blob
      const blob = Utilities.newBlob(
        Utilities.base64Decode(base64Data),
        mimeType,
        namaSurat + '_foto'
      );

      // Simpan foto asli ke Drive sementara
      const tahun      = new Date().getFullYear();
      const folderId   = DriveService.getFolderSuratMasuk(jenjang || user.jenjang, tahun);
      const folder     = DriveApp.getFolderById(folderId);
      const fotoFile   = folder.createFile(blob);

      // Convert ke PDF menggunakan Google Docs (embed gambar → export PDF)
      const pdfBlob    = _fotoToPdf(fotoFile, namaSurat);
      const pdfFile    = folder.createFile(pdfBlob);

      // Hapus foto asli (sudah jadi PDF)
      fotoFile.setTrashed(true);

      // Beri akses view
      pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      return jsonResponse(true, {
        fileId  : pdfFile.getId(),
        fileUrl : pdfFile.getUrl(),
      }, 'Foto berhasil dikonversi ke PDF.');

    } catch (err) {
      AuditLog.error('uploadFoto', err.message);
      return jsonResponse(false, null, 'Gagal upload: ' + err.message);
    }
  }

  /**
   * Terima PDF langsung (sudah jadi) dan simpan ke Drive
   * @param {string} token
   * @param {string} base64Data
   * @param {string} namaSurat
   * @param {string} jenjang
   */
  function uploadPdf(token, base64Data, namaSurat, jenjang) {
    const user = Auth.validateSession(token);
    if (!user) return jsonResponse(false, null, 'Sesi tidak valid.');

    try {
      const blob     = Utilities.newBlob(
        Utilities.base64Decode(base64Data),
        'application/pdf',
        namaSurat + '.pdf'
      );

      const tahun    = new Date().getFullYear();
      const folderId = DriveService.getFolderSuratMasuk(jenjang || user.jenjang, tahun);
      const folder   = DriveApp.getFolderById(folderId);
      const file     = folder.createFile(blob);

      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      return jsonResponse(true, {
        fileId  : file.getId(),
        fileUrl : file.getUrl(),
      }, 'PDF berhasil diunggah.');

    } catch (err) {
      AuditLog.error('uploadPdf', err.message);
      return jsonResponse(false, null, 'Gagal upload: ' + err.message);
    }
  }

  // ----------------------------------------------------------
  // PENCARIAN & FILTER
  // ----------------------------------------------------------

  /**
   * Cari surat masuk dengan berbagai filter
   * @param {string} token
   * @param {object} filter - { jenjang, bulan, tahun, perihal, pengirim, status, noSurat }
   * @returns {string} JSON dengan array hasil
   */
  function cari(token, filter) {
    const user = Auth.validateSession(token);
    if (!user) return jsonResponse(false, null, 'Sesi tidak valid.');

    const sheet  = getSheet(SHEET.SURAT_MASUK);
    const data   = sheet.getDataRange().getValues();
    const hasil  = [];
    const f      = filter || {};

    // TU hanya bisa lihat jenjangnya sendiri (kecuali Kepala TU)
    const jenjangFilter = user.role === ROLE.KEPALA_TU
      ? (f.jenjang || null)
      : user.jenjang;

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[COL.ID - 1]) continue;

      const tglTerima = row[COL.TGL_TERIMA - 1];
      const rowBulan  = tglTerima ? new Date(tglTerima).getMonth() + 1 : null;
      const rowTahun  = tglTerima ? new Date(tglTerima).getFullYear() : null;

      // Filter jenjang
      if (jenjangFilter && row[COL.JENJANG - 1] !== jenjangFilter) continue;
      // Filter bulan
      if (f.bulan && rowBulan !== parseInt(f.bulan)) continue;
      // Filter tahun
      if (f.tahun && rowTahun !== parseInt(f.tahun)) continue;
      // Filter perihal (contains, case-insensitive)
      if (f.perihal && !String(row[COL.PERIHAL - 1]).toLowerCase()
          .includes(f.perihal.toLowerCase())) continue;
      // Filter pengirim
      if (f.pengirim && !String(row[COL.PENGIRIM - 1]).toLowerCase()
          .includes(f.pengirim.toLowerCase())) continue;
      // Filter status
      if (f.status && row[COL.STATUS - 1] !== f.status) continue;
      // Filter nomor surat
      if (f.noSurat && !String(row[COL.NO_SURAT - 1]).toLowerCase()
          .includes(f.noSurat.toLowerCase())) continue;

      hasil.push({
        id          : row[COL.ID - 1],
        noAgenda    : row[COL.NO_AGENDA - 1],
        tglTerima   : row[COL.TGL_TERIMA - 1],
        noSurat     : row[COL.NO_SURAT - 1],
        tglSurat    : row[COL.TGL_SURAT - 1],
        pengirim    : row[COL.PENGIRIM - 1],
        perihal     : row[COL.PERIHAL - 1],
        klasifikasi : row[COL.KLASIFIKASI - 1],
        jenjang     : row[COL.JENJANG - 1],
        lampiranUrl : row[COL.LAMPIRAN_URL - 1],
        status      : row[COL.STATUS - 1],
      });
    }

    return jsonResponse(true, hasil, `${hasil.length} surat ditemukan.`);
  }

  // ----------------------------------------------------------
  // PRIVATE HELPERS
  // ----------------------------------------------------------

  function _generateId() {
    return 'SM_' + Utilities.getUuid().split('-')[0].toUpperCase() +
           '_' + new Date().getTime();
  }

  function _generateNoAgenda(jenjang) {
    const tahun  = new Date().getFullYear();
    const urut   = Config.incrementNoUrut('AGD_' + jenjang, tahun);
    const panjang = Config.getPanjangUrut();
    return `AGD-${jenjang}-${String(urut).padStart(panjang, '0')}-${tahun}`;
  }

  /**
   * Konversi foto → PDF menggunakan Google Docs sebagai perantara
   */
  function _fotoToPdf(fotoFile, namaSurat) {
    // Buat Google Doc baru, insert gambar, export PDF
    const doc     = DocumentApp.create(namaSurat + '_temp');
    const body    = doc.getBody();
    const imgBlob = fotoFile.getBlob();

    body.appendImage(imgBlob);
    doc.saveAndClose();

    const docFile = DriveApp.getFileById(doc.getId());
    const pdfBlob = docFile.getAs('application/pdf').setName(namaSurat + '.pdf');

    // Hapus doc sementara
    docFile.setTrashed(true);

    return pdfBlob;
  }

  // ----------------------------------------------------------
  // PUBLIC API
  // ----------------------------------------------------------
  return { catat, uploadFoto, uploadPdf, cari };

})();

// ════════════════════════════════════════════════════════════
// MODUL: SuratKeluar.gs
// ════════════════════════════════════════════════════════════
/**
 * SuratKeluar.gs — Modul Pembuatan & Arsip Surat Keluar
 *
 * Fitur:
 * - Pilih template dari TEMPLATE_REG
 * - Isi placeholder {{variable}}
 * - Generate PDF dari Google Docs template
 * - Penomoran surat otomatis (via NomorSurat.gs)
 * - Simpan PDF ke Drive & catat di Sheets
 * - Pencarian & filter arsip surat keluar
 */

const SuratKeluar = (() => {

  // Kolom Sheet SURAT_KELUAR
  const COL = {
    ID           : 1,
    NO_SURAT     : 2,
    TGL_SURAT    : 3,
    JENIS        : 4,  // Nama jenis surat
    KODE_SURAT   : 5,  // DL, SKET, MUT, dll
    PERIHAL      : 6,
    DITUJUKAN    : 7,
    JENJANG      : 8,
    TEMPLATE_ID  : 9,
    PDF_ID       : 10,
    PDF_URL      : 11,
    STATUS       : 12, // DRAFT / FINAL
    DIBUAT_OLEH  : 13,
    CREATED_AT   : 14,
  };

  // ----------------------------------------------------------
  // BUAT SURAT KELUAR
  // ----------------------------------------------------------

  /**
   * Generate surat keluar dari template Google Docs
   * @param {string} token
   * @param {object} data - { templateId, placeholders: {key: value}, jenjang }
   * @returns {string} JSON response dengan URL PDF
   */
  function buat(token, data) {
    if (!Config.isModulAktif('MODUL_SURAT')) {
      return jsonResponse(false, null, 'Modul Surat tidak aktif.');
    }

    const user = Auth.validateSession(token);
    if (!user) return jsonResponse(false, null, 'Sesi tidak valid.');

    // Ambil data template dari TEMPLATE_REG
    const template = TemplateReg.getById(data.templateId);
    if (!template) return jsonResponse(false, null, 'Template tidak ditemukan.');
    if (!template.aktif) return jsonResponse(false, null, 'Template tidak aktif.');

    try {
      // Generate nomor surat (ini yang mengunci & increment counter)
      const noSurat = NomorSurat.generate(
        user.jenjang,
        template.kodeSurat,
        template.klasifikasi
      );

      const tglSurat = new Date();

      // Tambahkan placeholder sistem otomatis
      const placeholders = Object.assign({}, data.placeholders, {
        no_surat        : noSurat,
        tanggal         : _formatTanggal(tglSurat),
        tahun           : tglSurat.getFullYear(),
        bulan           : tglSurat.getMonth() + 1,
        nama_sekolah    : Config.getNamaSekolah(),
        kode_sekolah    : Config.getKodeSekolah(),
        tahun_ajaran    : Config.getTahunAjaran(),
        jenjang         : user.jenjang,
        dibuat_oleh     : user.nama,
      });

      // Copy template Doc → isi placeholder → export PDF
      const pdfResult = PdfService.generateFromTemplate(
        template.docId,
        placeholders,
        `${noSurat.replace(/\//g, '_')}_${template.nama}`
      );

      // Pindahkan PDF ke folder yang tepat di Drive
      const tahun    = tglSurat.getFullYear();
      const folderId = DriveService.getFolderSuratKeluar(user.jenjang, tahun);
      const folder   = DriveApp.getFolderById(folderId);
      const pdfFile  = DriveApp.getFileById(pdfResult.fileId);
      pdfFile.moveTo(folder);

      // Catat ke Sheet SURAT_KELUAR
      const id  = _generateId();
      const row = [
        id,
        noSurat,
        tglSurat,
        template.nama,
        template.kodeSurat,
        data.placeholders.perihal || template.nama,
        data.placeholders.ditujukan || '',
        user.jenjang,
        template.docId,
        pdfResult.fileId,
        pdfFile.getUrl(),
        'FINAL',
        user.username,
        tglSurat,
      ];

      getSheet(SHEET.SURAT_KELUAR).appendRow(row);

      AuditLog.write(user.id, user.username, 'BUAT_SURAT_KELUAR',
        `No: ${noSurat} | ${template.nama}`);

      return jsonResponse(true, {
        id     : id,
        noSurat: noSurat,
        pdfUrl : pdfFile.getUrl(),
        pdfId  : pdfResult.fileId,
      }, 'Surat berhasil dibuat.');

    } catch (err) {
      AuditLog.error('SuratKeluar.buat', err.message);
      return jsonResponse(false, null, 'Gagal membuat surat: ' + err.message);
    }
  }

  // ----------------------------------------------------------
  // PREVIEW NOMOR (sebelum form diisi)
  // ----------------------------------------------------------

  function previewNomor(token, templateId) {
    const user = Auth.validateSession(token);
    if (!user) return jsonResponse(false, null, 'Sesi tidak valid.');

    const template = TemplateReg.getById(templateId);
    if (!template) return jsonResponse(false, null, 'Template tidak ditemukan.');

    const preview = NomorSurat.preview(
      user.jenjang,
      template.kodeSurat,
      template.klasifikasi
    );

    return jsonResponse(true, { preview }, '');
  }

  // ----------------------------------------------------------
  // PENCARIAN & FILTER
  // ----------------------------------------------------------

  /**
   * Cari arsip surat keluar
   * @param {string} token
   * @param {object} filter - { jenjang, bulan, tahun, perihal, kodeSurat, jenis }
   */
  function cari(token, filter) {
    const user = Auth.validateSession(token);
    if (!user) return jsonResponse(false, null, 'Sesi tidak valid.');

    const sheet = getSheet(SHEET.SURAT_KELUAR);
    const data  = sheet.getDataRange().getValues();
    const hasil = [];
    const f     = filter || {};

    const jenjangFilter = user.role === ROLE.KEPALA_TU
      ? (f.jenjang || null)
      : user.jenjang;

    for (let i = 1; i < data.length; i++) {
      const row     = data[i];
      if (!row[COL.ID - 1]) continue;

      const tglSurat = row[COL.TGL_SURAT - 1];
      const rowBulan = tglSurat ? new Date(tglSurat).getMonth() + 1 : null;
      const rowTahun = tglSurat ? new Date(tglSurat).getFullYear() : null;

      if (jenjangFilter && row[COL.JENJANG - 1] !== jenjangFilter) continue;
      if (f.bulan && rowBulan !== parseInt(f.bulan)) continue;
      if (f.tahun && rowTahun !== parseInt(f.tahun)) continue;
      if (f.perihal && !String(row[COL.PERIHAL - 1]).toLowerCase()
          .includes(f.perihal.toLowerCase())) continue;
      if (f.kodeSurat && row[COL.KODE_SURAT - 1] !== f.kodeSurat) continue;
      if (f.jenis && !String(row[COL.JENIS - 1]).toLowerCase()
          .includes(f.jenis.toLowerCase())) continue;

      hasil.push({
        id         : row[COL.ID - 1],
        noSurat    : row[COL.NO_SURAT - 1],
        tglSurat   : row[COL.TGL_SURAT - 1],
        jenis      : row[COL.JENIS - 1],
        kodeSurat  : row[COL.KODE_SURAT - 1],
        perihal    : row[COL.PERIHAL - 1],
        ditujukan  : row[COL.DITUJUKAN - 1],
        jenjang    : row[COL.JENJANG - 1],
        pdfUrl     : row[COL.PDF_URL - 1],
        status     : row[COL.STATUS - 1],
        dibuatOleh : row[COL.DIBUAT_OLEH - 1],
      });
    }

    return jsonResponse(true, hasil, `${hasil.length} surat ditemukan.`);
  }

  // ----------------------------------------------------------
  // PRIVATE HELPERS
  // ----------------------------------------------------------

  function _generateId() {
    return 'SK_' + Utilities.getUuid().split('-')[0].toUpperCase() +
           '_' + new Date().getTime();
  }

  function _formatTanggal(date) {
    const hari  = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
    const bulan = ['Januari','Februari','Maret','April','Mei','Juni',
                   'Juli','Agustus','September','Oktober','November','Desember'];
    return `${hari[date.getDay()]}, ${date.getDate()} ${bulan[date.getMonth()]} ${date.getFullYear()}`;
  }

  // ----------------------------------------------------------
  // PUBLIC API
  // ----------------------------------------------------------
  return { buat, previewNomor, cari };

})();

// ════════════════════════════════════════════════════════════
// MODUL: Disposisi.gs
// ════════════════════════════════════════════════════════════
/**
 * Disposisi.gs — Modul Disposisi Surat Masuk
 *
 * Alur disposisi bertingkat:
 * TU Penerima → Kepala TU → TU Jenjang Lain (sesuai jenis surat)
 *
 * Status: MENUNGGU → DITERIMA → DIPROSES → SELESAI
 */

const Disposisi = (() => {

  const COL = {
    ID           : 1,
    SURAT_ID     : 2,  // ID dari SURAT_MASUK
    NO_AGENDA    : 3,
    PERIHAL      : 4,
    DARI         : 5,  // Username pengirim disposisi
    KEPADA       : 6,  // Username penerima disposisi
    CATATAN      : 7,  // Instruksi/catatan disposisi
    LEVEL        : 8,  // 1, 2, 3 (tingkat disposisi)
    STATUS       : 9,  // MENUNGGU / DITERIMA / DIPROSES / SELESAI
    TGL_DISPOSISI: 10,
    TGL_SELESAI  : 11,
  };

  // ----------------------------------------------------------
  // BUAT DISPOSISI
  // ----------------------------------------------------------

  /**
   * Disposisikan surat kepada user tertentu
   * @param {string} token
   * @param {object} data - { suratId, kepada, catatan }
   */
  function buat(token, data) {
    const user = Auth.validateSession(token);
    if (!user) return jsonResponse(false, null, 'Sesi tidak valid.');

    // Ambil data surat masuk
    const surat = _getSuratMasuk(data.suratId);
    if (!surat) return jsonResponse(false, null, 'Surat tidak ditemukan.');

    // Hitung level disposisi
    const levelSebelumnya = _getLevelTerakhir(data.suratId);
    const levelBaru       = levelSebelumnya + 1;

    const sheet = getSheet(SHEET.DISPOSISI);
    const id    = _generateId();
    const now   = new Date();

    const row = [
      id,
      data.suratId,
      surat.noAgenda,
      surat.perihal,
      user.username,
      data.kepada,
      data.catatan || '',
      levelBaru,
      'MENUNGGU',
      now,
      '',
    ];

    sheet.appendRow(row);

    // Update status surat masuk → DIDISPOSISI
    _updateStatusSurat(data.suratId, 'DIDISPOSISI');

    // Kirim notifikasi Telegram ke penerima
    _kirimNotifikasiDisposisi(data.kepada, surat, data.catatan, levelBaru);

    AuditLog.write(user.id, user.username, 'BUAT_DISPOSISI',
      `Surat: ${surat.noAgenda} → ${data.kepada} (Level ${levelBaru})`);

    return jsonResponse(true, { id }, 'Disposisi berhasil dikirim.');
  }

  // ----------------------------------------------------------
  // UPDATE STATUS DISPOSISI
  // ----------------------------------------------------------

  /**
   * Penerima konfirmasi diterima / selesai
   * @param {string} token
   * @param {string} disposisiId
   * @param {string} statusBaru - 'DITERIMA' / 'DIPROSES' / 'SELESAI'
   */
  function updateStatus(token, disposisiId, statusBaru) {
    const user = Auth.validateSession(token);
    if (!user) return jsonResponse(false, null, 'Sesi tidak valid.');

    const sheet = getSheet(SHEET.DISPOSISI);
    const data  = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[COL.ID - 1] !== disposisiId) continue;

      // Hanya penerima yang bisa update
      if (row[COL.KEPADA - 1] !== user.username) {
        return jsonResponse(false, null, 'Anda bukan penerima disposisi ini.');
      }

      sheet.getRange(i + 1, COL.STATUS).setValue(statusBaru);

      if (statusBaru === 'SELESAI') {
        sheet.getRange(i + 1, COL.TGL_SELESAI).setValue(new Date());
        // Update status surat jika semua disposisi selesai
        if (_semuaDisposisiSelesai(row[COL.SURAT_ID - 1])) {
          _updateStatusSurat(row[COL.SURAT_ID - 1], 'SELESAI');
        }
      }

      AuditLog.write(user.id, user.username, 'UPDATE_DISPOSISI',
        `ID: ${disposisiId} → ${statusBaru}`);

      return jsonResponse(true, null, `Status disposisi diupdate ke ${statusBaru}.`);
    }

    return jsonResponse(false, null, 'Disposisi tidak ditemukan.');
  }

  // ----------------------------------------------------------
  // AMBIL DISPOSISI MASUK (untuk user tertentu)
  // ----------------------------------------------------------

  function getDisposisiMasuk(token) {
    const user = Auth.validateSession(token);
    if (!user) return jsonResponse(false, null, 'Sesi tidak valid.');

    const sheet  = getSheet(SHEET.DISPOSISI);
    const data   = sheet.getDataRange().getValues();
    const hasil  = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[COL.ID - 1]) continue;
      if (row[COL.KEPADA - 1] !== user.username) continue;
      if (row[COL.STATUS - 1] === 'SELESAI') continue;

      hasil.push({
        id           : row[COL.ID - 1],
        suratId      : row[COL.SURAT_ID - 1],
        noAgenda     : row[COL.NO_AGENDA - 1],
        perihal      : row[COL.PERIHAL - 1],
        dari         : row[COL.DARI - 1],
        catatan      : row[COL.CATATAN - 1],
        level        : row[COL.LEVEL - 1],
        status       : row[COL.STATUS - 1],
        tglDisposisi : row[COL.TGL_DISPOSISI - 1],
      });
    }

    return jsonResponse(true, hasil, `${hasil.length} disposisi menunggu.`);
  }

  // ----------------------------------------------------------
  // PRIVATE HELPERS
  // ----------------------------------------------------------

  function _getSuratMasuk(suratId) {
    const sheet = getSheet(SHEET.SURAT_MASUK);
    const data  = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === suratId) {
        return {
          id       : data[i][0],
          noAgenda : data[i][1],
          perihal  : data[i][6],
          pengirim : data[i][5],
        };
      }
    }
    return null;
  }

  function _getLevelTerakhir(suratId) {
    const sheet = getSheet(SHEET.DISPOSISI);
    const data  = sheet.getDataRange().getValues();
    let maxLevel = 0;
    for (let i = 1; i < data.length; i++) {
      if (data[i][COL.SURAT_ID - 1] === suratId) {
        const level = parseInt(data[i][COL.LEVEL - 1]) || 0;
        if (level > maxLevel) maxLevel = level;
      }
    }
    return maxLevel;
  }

  function _semuaDisposisiSelesai(suratId) {
    const sheet = getSheet(SHEET.DISPOSISI);
    const data  = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][COL.SURAT_ID - 1] === suratId &&
          data[i][COL.STATUS - 1] !== 'SELESAI') {
        return false;
      }
    }
    return true;
  }

  function _updateStatusSurat(suratId, status) {
    const sheet = getSheet(SHEET.SURAT_MASUK);
    const data  = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === suratId) {
        sheet.getRange(i + 1, 12).setValue(status);
        break;
      }
    }
  }

  function _kirimNotifikasiDisposisi(username, surat, catatan, level) {
    try {
      const chatId = _getTelegramId(username);
      if (!chatId) return;

      const pesan =
        `📋 *DISPOSISI SURAT — Level ${level}*\n\n` +
        `📌 No. Agenda: \`${surat.noAgenda}\`\n` +
        `📄 Perihal: ${surat.perihal}\n` +
        `📨 Dari: ${surat.pengirim}\n` +
        (catatan ? `💬 Catatan: ${catatan}\n` : '') +
        `\nSilakan cek sistem SIM-TU untuk detail.`;

      TelegramBot.kirimPesan(chatId, pesan);
    } catch (e) {
      AuditLog.error('kirimNotifikasiDisposisi', e.message);
    }
  }

  function _getTelegramId(username) {
    const sheet = getSheet(SHEET.USERS);
    const data  = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === username) return data[i][7]; // kolom TELEGRAM_ID
    }
    return null;
  }

  function _generateId() {
    return 'DSP_' + Utilities.getUuid().split('-')[0].toUpperCase() +
           '_' + new Date().getTime();
  }

  // ----------------------------------------------------------
  // PUBLIC API
  // ----------------------------------------------------------
  return { buat, updateStatus, getDisposisiMasuk };

})();

// ════════════════════════════════════════════════════════════
// MODUL: Kesiswaan.gs
// ════════════════════════════════════════════════════════════
/**
 * Kesiswaan.gs — Manajemen Data Siswa
 *
 * Fitur:
 * - CRUD data siswa per jenjang
 * - Promosi siswa antar jenjang (dengan Maker-Checker)
 * - Pencarian & filter siswa
 * - Data siswa tersedia sebagai placeholder di template surat
 */

const Kesiswaan = (() => {

  // Kolom Sheet SISWA_SD / SISWA_SMP / SISWA_SMA
  const COL = {
    ID           : 1,
    NISN         : 2,
    NAMA         : 3,
    TEMPAT_LAHIR : 4,
    TGL_LAHIR    : 5,
    JENIS_KELAMIN: 6,
    KELAS        : 7,
    ROMBEL       : 8,
    TAHUN_MASUK  : 9,
    STATUS       : 10, // AKTIF / LULUS / MUTASI / PROMOSI_PENDING
    NAMA_AYAH    : 11,
    NAMA_IBU     : 12,
    NO_TELP_ORTU : 13,
    ALAMAT       : 14,
    CATATAN      : 15,
    CREATED_AT   : 16,
  };

  // ----------------------------------------------------------
  // TAMBAH SISWA
  // ----------------------------------------------------------

  function tambah(token, jenjang, dataSiswa) {
    if (!Config.isModulAktif('MODUL_KESISWAAN')) {
      return jsonResponse(false, null, 'Modul Kesiswaan tidak aktif.');
    }

    const user = Auth.validateSession(token);
    if (!user) return jsonResponse(false, null, 'Sesi tidak valid.');
    if (!_aksesJenjang(user, jenjang)) {
      return jsonResponse(false, null, 'Akses ditolak untuk jenjang ' + jenjang);
    }

    const sheetName = _getSheetName(jenjang);
    const sheet     = getSheet(sheetName);
    const id        = _generateId(jenjang);

    const row = [
      id,
      dataSiswa.nisn          || '',
      dataSiswa.nama          || '',
      dataSiswa.tempatLahir   || '',
      dataSiswa.tglLahir      ? new Date(dataSiswa.tglLahir) : '',
      dataSiswa.jenisKelamin  || '',
      dataSiswa.kelas         || '',
      dataSiswa.rombel        || '',
      dataSiswa.tahunMasuk    || new Date().getFullYear(),
      'AKTIF',
      dataSiswa.namaAyah      || '',
      dataSiswa.namaIbu       || '',
      dataSiswa.noTelpOrtu    || '',
      dataSiswa.alamat        || '',
      dataSiswa.catatan       || '',
      new Date(),
    ];

    sheet.appendRow(row);

    AuditLog.write(user.id, user.username, 'TAMBAH_SISWA',
      `${jenjang} | ${dataSiswa.nama} | NISN: ${dataSiswa.nisn}`);

    return jsonResponse(true, { id }, 'Siswa berhasil ditambahkan.');
  }

  // ----------------------------------------------------------
  // CARI SISWA
  // ----------------------------------------------------------

  function cari(token, jenjang, filter) {
    const user = Auth.validateSession(token);
    if (!user) return jsonResponse(false, null, 'Sesi tidak valid.');

    const jenjangTarget = jenjang || user.jenjang;
    if (!_aksesJenjang(user, jenjangTarget)) {
      return jsonResponse(false, null, 'Akses ditolak.');
    }

    const sheet  = getSheet(_getSheetName(jenjangTarget));
    const data   = sheet.getDataRange().getValues();
    const hasil  = [];
    const f      = filter || {};

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[COL.ID - 1]) continue;

      if (f.nama && !String(row[COL.NAMA - 1]).toLowerCase()
          .includes(f.nama.toLowerCase())) continue;
      if (f.nisn && !String(row[COL.NISN - 1]).includes(f.nisn)) continue;
      if (f.kelas && row[COL.KELAS - 1] !== f.kelas) continue;
      if (f.status && row[COL.STATUS - 1] !== f.status) continue;

      hasil.push(_rowToObj(row, jenjangTarget));
    }

    return jsonResponse(true, hasil, `${hasil.length} siswa ditemukan.`);
  }

  // ----------------------------------------------------------
  // AMBIL DATA SISWA (untuk placeholder surat)
  // ----------------------------------------------------------

  function getById(jenjang, siswaId) {
    const sheet = getSheet(_getSheetName(jenjang));
    const data  = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][COL.ID - 1] === siswaId) {
        return _rowToObj(data[i], jenjang);
      }
    }
    return null;
  }

  /**
   * Convert data siswa ke object placeholder untuk template surat
   */
  function getPlaceholders(jenjang, siswaId) {
    const siswa = getById(jenjang, siswaId);
    if (!siswa) return {};

    return {
      nisn         : siswa.nisn,
      nama_siswa   : siswa.nama,
      tempat_lahir : siswa.tempatLahir,
      tgl_lahir    : siswa.tglLahir,
      kelas        : siswa.kelas,
      rombel       : siswa.rombel,
      jenjang      : jenjang,
      nama_ayah    : siswa.namaAyah,
      nama_ibu     : siswa.namaIbu,
      no_telp_ortu : siswa.noTelpOrtu,
      alamat       : siswa.alamat,
    };
  }

  // ----------------------------------------------------------
  // PROMOSI SISWA (Maker-Checker)
  // ----------------------------------------------------------

  /**
   * MAKER: Ajukan promosi siswa ke jenjang berikutnya
   * @param {string} token  - token TU pengaju
   * @param {string} jenjangAsal  - 'SD' atau 'SMP'
   * @param {string} siswaId
   */
  function ajukanPromosi(token, jenjangAsal, siswaId) {
    const user = Auth.validateSession(token);
    if (!user) return jsonResponse(false, null, 'Sesi tidak valid.');
    if (!_aksesJenjang(user, jenjangAsal)) {
      return jsonResponse(false, null, 'Akses ditolak.');
    }

    const jenjangTujuan = jenjangAsal === JENJANG.SD ? JENJANG.SMP :
                          jenjangAsal === JENJANG.SMP ? JENJANG.SMA : null;

    if (!jenjangTujuan) {
      return jsonResponse(false, null, 'SMA adalah jenjang terakhir, tidak bisa dipromosikan.');
    }

    const siswa = getById(jenjangAsal, siswaId);
    if (!siswa) return jsonResponse(false, null, 'Siswa tidak ditemukan.');
    if (siswa.status !== 'AKTIF') {
      return jsonResponse(false, null, 'Siswa tidak aktif.');
    }

    // Tandai status siswa sebagai PROMOSI_PENDING
    _updateStatus(jenjangAsal, siswaId, 'PROMOSI_PENDING');

    // Simpan pengajuan di CONFIG sementara
    Config.set(`PROMOSI_PENDING_${siswaId}`, JSON.stringify({
      siswaId       : siswaId,
      jenjangAsal   : jenjangAsal,
      jenjangTujuan : jenjangTujuan,
      diajukanOleh  : user.username,
      tglAjuan      : new Date().toISOString(),
    }));

    // Notifikasi ke TU jenjang tujuan
    _notifikasiPromosi(jenjangTujuan, siswa, jenjangAsal, user.username);

    AuditLog.write(user.id, user.username, 'AJUKAN_PROMOSI',
      `${siswa.nama} | ${jenjangAsal} → ${jenjangTujuan}`);

    return jsonResponse(true, null,
      `Pengajuan promosi ${siswa.nama} ke ${jenjangTujuan} berhasil dikirim. Menunggu persetujuan TU ${jenjangTujuan}.`);
  }

  /**
   * CHECKER: Setujui atau tolak promosi
   */
  function konfirmasiPromosi(token, siswaId, disetujui) {
    const user = Auth.validateSession(token);
    if (!user) return jsonResponse(false, null, 'Sesi tidak valid.');

    const pendingRaw = Config.get(`PROMOSI_PENDING_${siswaId}`);
    if (!pendingRaw) return jsonResponse(false, null, 'Tidak ada pengajuan promosi untuk siswa ini.');

    const pending = JSON.parse(pendingRaw);

    // Pastikan yang konfirmasi adalah TU jenjang tujuan (atau Kepala TU)
    if (user.jenjang !== pending.jenjangTujuan && user.role !== ROLE.KEPALA_TU) {
      return jsonResponse(false, null,
        `Hanya TU ${pending.jenjangTujuan} atau Kepala TU yang bisa mengkonfirmasi.`);
    }

    if (!disetujui) {
      _updateStatus(pending.jenjangAsal, siswaId, 'AKTIF'); // Batalkan, kembalikan ke aktif
      Config.set(`PROMOSI_PENDING_${siswaId}`, '');
      AuditLog.write(user.id, user.username, 'TOLAK_PROMOSI',
        `Siswa ID: ${siswaId}`);
      return jsonResponse(true, null, 'Pengajuan promosi ditolak. Status siswa dikembalikan ke AKTIF.');
    }

    // Setujui → copy data ke jenjang tujuan
    const siswa = getById(pending.jenjangAsal, siswaId);
    if (!siswa) return jsonResponse(false, null, 'Data siswa tidak ditemukan.');

    // Tambah ke jenjang tujuan (reset kelas)
    const dataBaru = {
      nisn         : siswa.nisn,
      nama         : siswa.nama,
      tempatLahir  : siswa.tempatLahir,
      tglLahir     : siswa.tglLahir,
      jenisKelamin : siswa.jenisKelamin,
      kelas        : '7',  // Default kelas awal jenjang baru
      rombel       : '',
      tahunMasuk   : new Date().getFullYear(),
      namaAyah     : siswa.namaAyah,
      namaIbu      : siswa.namaIbu,
      noTelpOrtu   : siswa.noTelpOrtu,
      alamat       : siswa.alamat,
      catatan      : `Promosi dari ${pending.jenjangAsal}`,
    };

    // Gunakan token Kepala TU (bypass validasi jenjang)
    tambah(token, pending.jenjangTujuan, dataBaru);

    // Tandai siswa lama sebagai LULUS
    _updateStatus(pending.jenjangAsal, siswaId, 'LULUS');

    // Hapus pending
    Config.set(`PROMOSI_PENDING_${siswaId}`, '');

    AuditLog.write(user.id, user.username, 'SETUJU_PROMOSI',
      `${siswa.nama} | ${pending.jenjangAsal} → ${pending.jenjangTujuan}`);

    return jsonResponse(true, null,
      `${siswa.nama} berhasil dipromosikan ke ${pending.jenjangTujuan}.`);
  }

  // ----------------------------------------------------------
  // PRIVATE HELPERS
  // ----------------------------------------------------------

  function _getSheetName(jenjang) {
    return 'SISWA_' + jenjang;
  }

  function _aksesJenjang(user, jenjang) {
    if (user.role === ROLE.KEPALA_TU) return true;
    return user.jenjang === jenjang;
  }

  function _rowToObj(row, jenjang) {
    return {
      id           : row[COL.ID - 1],
      nisn         : row[COL.NISN - 1],
      nama         : row[COL.NAMA - 1],
      tempatLahir  : row[COL.TEMPAT_LAHIR - 1],
      tglLahir     : row[COL.TGL_LAHIR - 1],
      jenisKelamin : row[COL.JENIS_KELAMIN - 1],
      kelas        : row[COL.KELAS - 1],
      rombel       : row[COL.ROMBEL - 1],
      tahunMasuk   : row[COL.TAHUN_MASUK - 1],
      status       : row[COL.STATUS - 1],
      namaAyah     : row[COL.NAMA_AYAH - 1],
      namaIbu      : row[COL.NAMA_IBU - 1],
      noTelpOrtu   : row[COL.NO_TELP_ORTU - 1],
      alamat       : row[COL.ALAMAT - 1],
      catatan      : row[COL.CATATAN - 1],
      jenjang      : jenjang,
    };
  }

  function _updateStatus(jenjang, siswaId, status) {
    const sheet = getSheet(_getSheetName(jenjang));
    const data  = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][COL.ID - 1] === siswaId) {
        sheet.getRange(i + 1, COL.STATUS).setValue(status);
        break;
      }
    }
  }

  function _notifikasiPromosi(jenjangTujuan, siswa, jenjangAsal, pengaju) {
    // Ambil semua TU jenjang tujuan dan kirim notifikasi
    const sheet = getSheet(SHEET.USERS);
    const data  = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if ((row[3] === 'TU_' + jenjangTujuan || row[3] === ROLE.KEPALA_TU) &&
          row[10] === 'AKTIF' && row[7]) {
        TelegramBot.kirimPesan(String(row[7]),
          `📢 *PENGAJUAN PROMOSI SISWA*\n\n` +
          `👤 Nama: *${siswa.nama}*\n` +
          `📚 Dari: ${jenjangAsal} → *${jenjangTujuan}*\n` +
          `👨‍💼 Diajukan oleh: ${pengaju}\n\n` +
          `Buka SIM-TU untuk menyetujui atau menolak.`
        );
      }
    }
  }

  function _generateId(jenjang) {
    return `SISWA_${jenjang}_` + Utilities.getUuid().split('-')[0].toUpperCase();
  }

  // ----------------------------------------------------------
  // PUBLIC API
  // ----------------------------------------------------------
  return { tambah, cari, getById, getPlaceholders, ajukanPromosi, konfirmasiPromosi };

})();

// ════════════════════════════════════════════════════════════
// MODUL: TelegramBot.gs
// ════════════════════════════════════════════════════════════
/**
 * TelegramBot.gs — Handler Telegram Bot
 *
 * Sistem bot bersifat AKTIF (interaktif dua arah).
 * Navigasi menggunakan Inline Keyboard untuk kemudahan akses.
 *
 * Fitur via Bot:
 * - Buat surat keluar
 * - Catat surat masuk
 * - Upload foto/PDF surat masuk
 * - Cari arsip surat
 * - Lihat disposisi masuk
 * - Konfirmasi disposisi
 * - Ringkasan dashboard
 *
 * State management: disimpan di memory cache (PropertiesService)
 * untuk multi-step conversation.
 */

const TelegramBot = (() => {

  const BASE_URL = 'https://api.telegram.org/bot';

  // State keys untuk multi-step conversation
  const STATE = {
    IDLE              : 'IDLE',
    PILIH_TEMPLATE    : 'PILIH_TEMPLATE',
    ISI_PLACEHOLDER   : 'ISI_PLACEHOLDER',
    CATAT_SURAT_MASUK : 'CATAT_SURAT_MASUK',
    CARI_SURAT        : 'CARI_SURAT',
  };

  // ----------------------------------------------------------
  // ENTRY POINT — dipanggil dari doPost
  // ----------------------------------------------------------

  function handleUpdate(update) {
    try {
      if (update.callback_query) {
        _handleCallback(update.callback_query);
      } else if (update.message) {
        _handleMessage(update.message);
      }
    } catch (err) {
      AuditLog.error('TelegramBot.handleUpdate', err.message);
    }
  }

  // ----------------------------------------------------------
  // HANDLE PESAN TEKS / FOTO / DOKUMEN
  // ----------------------------------------------------------

  function _handleMessage(msg) {
    const chatId = String(msg.chat.id);
    const text   = msg.text || '';

    // Validasi user
    const user = Auth.validateTelegram(chatId);
    if (!user) {
      kirimPesan(chatId,
        '⛔ Anda tidak terdaftar dalam sistem SIM-TU.\n' +
        'Hubungi Kepala TU untuk mendaftarkan akun Telegram Anda.');
      return;
    }

    // Handle foto (surat masuk)
    if (msg.photo) {
      _handleFoto(chatId, msg, user);
      return;
    }

    // Handle dokumen PDF
    if (msg.document && msg.document.mime_type === 'application/pdf') {
      _handleDokumenPdf(chatId, msg, user);
      return;
    }

    // Handle state aktif (multi-step)
    const state = _getState(chatId);
    if (state && state.step !== STATE.IDLE) {
      _handleState(chatId, text, state, user);
      return;
    }

    // Handle perintah
    if (text.startsWith('/')) {
      _handleCommand(chatId, text, user);
    } else {
      _kirimMenuUtama(chatId, user);
    }
  }

  // ----------------------------------------------------------
  // HANDLE PERINTAH
  // ----------------------------------------------------------

  function _handleCommand(chatId, text, user) {
    const cmd = text.split(' ')[0].toLowerCase();

    switch (cmd) {
      case '/start':
      case '/menu':
        _kirimMenuUtama(chatId, user);
        break;

      case '/surat_keluar':
        _mulaiSuratKeluar(chatId, user);
        break;

      case '/surat_masuk':
        _mulaiCatatSuratMasuk(chatId, user);
        break;

      case '/cari':
        _mulaiCariSurat(chatId, user);
        break;

      case '/disposisi':
        _kirimDisposisiMasuk(chatId, user);
        break;

      case '/dashboard':
        _kirimDashboard(chatId, user);
        break;

      default:
        kirimPesan(chatId, '❓ Perintah tidak dikenal. Ketik /menu untuk melihat daftar menu.');
    }
  }

  // ----------------------------------------------------------
  // MENU UTAMA
  // ----------------------------------------------------------

  function _kirimMenuUtama(chatId, user) {
    const pesan =
      `👋 Halo, *${user.nama}*!\n` +
      `🏫 Jenjang: *${user.jenjang}*\n\n` +
      `Pilih menu yang tersedia:`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '📤 Buat Surat Keluar', callback_data: 'cmd_surat_keluar' },
          { text: '📥 Catat Surat Masuk', callback_data: 'cmd_surat_masuk' },
        ],
        [
          { text: '🔍 Cari Arsip', callback_data: 'cmd_cari' },
          { text: '📋 Disposisi Masuk', callback_data: 'cmd_disposisi' },
        ],
        [
          { text: '📊 Dashboard', callback_data: 'cmd_dashboard' },
        ],
      ],
    };

    kirimPesanDenganKeyboard(chatId, pesan, keyboard);
  }

  // ----------------------------------------------------------
  // ALUR BUAT SURAT KELUAR
  // ----------------------------------------------------------

  function _mulaiSuratKeluar(chatId, user) {
    const templates = TemplateReg.getAll(user.jenjang);
    if (!templates || templates.length === 0) {
      kirimPesan(chatId, '⚠️ Belum ada template surat yang tersedia untuk jenjang ' + user.jenjang);
      return;
    }

    const buttons = templates.map(t => ([{
      text          : `📄 ${t.nama} (${t.kodeSurat})`,
      callback_data : `tpl_${t.id}`,
    }]));

    buttons.push([{ text: '❌ Batal', callback_data: 'cmd_batal' }]);

    kirimPesanDenganKeyboard(chatId,
      '📋 Pilih jenis surat yang akan dibuat:',
      { inline_keyboard: buttons }
    );

    _setState(chatId, { step: STATE.PILIH_TEMPLATE, user });
  }

  function _prosesTemplateSelected(chatId, templateId, user) {
    const template = TemplateReg.getById(templateId);
    if (!template) {
      kirimPesan(chatId, '⚠️ Template tidak ditemukan.');
      return;
    }

    // Preview nomor surat
    const preview = NomorSurat.preview(user.jenjang, template.kodeSurat, template.klasifikasi);

    const pesan =
      `✅ Template dipilih: *${template.nama}*\n` +
      `🔢 Nomor surat (preview): \`${preview}\`\n\n` +
      `📝 Silakan isi data berikut satu per satu.\n` +
      `Ketik nilai untuk: *${template.placeholders[0] || 'perihal'}*`;

    kirimPesan(chatId, pesan);

    _setState(chatId, {
      step        : STATE.ISI_PLACEHOLDER,
      template    : template,
      user        : user,
      data        : {},
      currentIdx  : 0,
    });
  }

  // ----------------------------------------------------------
  // HANDLE FOTO SURAT MASUK
  // ----------------------------------------------------------

  function _handleFoto(chatId, msg, user) {
    kirimPesan(chatId, '📸 Foto diterima. Sedang diproses...');

    try {
      // Ambil foto ukuran terbesar
      const photos  = msg.photo;
      const foto    = photos[photos.length - 1];
      const fileId  = foto.file_id;

      // Download foto dari Telegram
      const fileInfo = _getFileInfo(fileId);
      const fotoBlob = _downloadFile(fileInfo.file_path);

      // Konversi ke base64
      const base64 = Utilities.base64Encode(fotoBlob.getBytes());

      // Upload via SuratMasuk
      const result = SuratMasuk.uploadFoto(
        null,  // tidak perlu token, sudah validasi via Telegram
        base64,
        fotoBlob.getContentType(),
        'SuratMasuk_' + new Date().getTime(),
        user.jenjang
      );

      const parsed = JSON.parse(result);
      if (parsed.success) {
        kirimPesan(chatId,
          '✅ Foto berhasil dikonversi ke PDF!\n\n' +
          '📎 Sekarang lengkapi data surat:\n' +
          'Balas dengan format:\n' +
          '`NOMOR_SURAT | TANGGAL | PENGIRIM | PERIHAL`\n\n' +
          'Contoh:\n' +
          '`001/TU/V/2026 | 2026-05-01 | Dinas Pendidikan | Undangan Rapat`'
        );
        _setState(chatId, {
          step       : STATE.CATAT_SURAT_MASUK,
          lampiranId : parsed.data.fileId,
          lampiranUrl: parsed.data.fileUrl,
          user       : user,
        });
      } else {
        kirimPesan(chatId, '❌ Gagal memproses foto: ' + parsed.message);
      }
    } catch (err) {
      kirimPesan(chatId, '❌ Terjadi kesalahan: ' + err.message);
    }
  }

  // ----------------------------------------------------------
  // HANDLE STATE (multi-step conversation)
  // ----------------------------------------------------------

  function _handleState(chatId, text, state, user) {
    switch (state.step) {

      case STATE.ISI_PLACEHOLDER:
        _prosesIsianPlaceholder(chatId, text, state, user);
        break;

      case STATE.CATAT_SURAT_MASUK:
        _prosesCatatSuratMasuk(chatId, text, state, user);
        break;

      case STATE.CARI_SURAT:
        _prosesCariSurat(chatId, text, state, user);
        break;
    }
  }

  function _prosesIsianPlaceholder(chatId, text, state, user) {
    const { template, data, currentIdx } = state;
    const key = template.placeholders[currentIdx];
    data[key] = text;

    const nextIdx = currentIdx + 1;

    if (nextIdx < template.placeholders.length) {
      // Masih ada placeholder berikutnya
      kirimPesan(chatId, `📝 Isi data untuk: *${template.placeholders[nextIdx]}*`);
      _setState(chatId, { ...state, data, currentIdx: nextIdx });
    } else {
      // Semua placeholder selesai → generate surat
      kirimPesan(chatId, '⏳ Membuat surat... Mohon tunggu.');
      _finalisasiSuratKeluar(chatId, template, data, user);
    }
  }

  function _finalisasiSuratKeluar(chatId, template, data, user) {
    try {
      // Buat token sementara dari Telegram untuk auth
      const result = JSON.parse(SuratKeluar.buat(
        _getTempToken(user),
        { templateId: template.id, placeholders: data }
      ));

      if (result.success) {
        // Kirim PDF
        const pdfBlob = DriveApp.getFileById(result.data.pdfId).getBlob();
        kirimDokumen(chatId, pdfBlob, result.data.noSurat + '.pdf',
          `✅ Surat berhasil dibuat!\n🔢 No. Surat: \`${result.data.noSurat}\``);
      } else {
        kirimPesan(chatId, '❌ Gagal membuat surat: ' + result.message);
      }
    } catch (err) {
      kirimPesan(chatId, '❌ Terjadi kesalahan: ' + err.message);
    }
    _clearState(chatId);
  }

  function _prosesCatatSuratMasuk(chatId, text, state, user) {
    const parts = text.split('|').map(s => s.trim());
    if (parts.length < 4) {
      kirimPesan(chatId,
        '⚠️ Format tidak valid. Gunakan:\n' +
        '`NOMOR_SURAT | TANGGAL | PENGIRIM | PERIHAL`');
      return;
    }

    const result = JSON.parse(SuratMasuk.catat(
      _getTempToken(user),
      {
        noSurat    : parts[0],
        tglSurat   : parts[1],
        pengirim   : parts[2],
        perihal    : parts[3],
        lampiranId : state.lampiranId || '',
        lampiranUrl: state.lampiranUrl || '',
      }
    ));

    if (result.success) {
      kirimPesan(chatId,
        `✅ Surat masuk berhasil dicatat!\n` +
        `📌 No. Agenda: \`${result.data.noAgenda}\``);
    } else {
      kirimPesan(chatId, '❌ Gagal mencatat: ' + result.message);
    }
    _clearState(chatId);
  }

  // ----------------------------------------------------------
  // DASHBOARD RINGKAS
  // ----------------------------------------------------------

  function _kirimDashboard(chatId, user) {
    const smSheet = getSheet(SHEET.SURAT_MASUK);
    const skSheet = getSheet(SHEET.SURAT_KELUAR);
    const bulan   = new Date().getMonth() + 1;
    const tahun   = new Date().getFullYear();

    const smData  = smSheet.getDataRange().getValues();
    const skData  = skSheet.getDataRange().getValues();

    let smCount = 0, skCount = 0, smBaru = 0;

    smData.slice(1).forEach(row => {
      if (!row[0]) return;
      if (user.role !== ROLE.KEPALA_TU && row[8] !== user.jenjang) return;
      const tgl = row[2] ? new Date(row[2]) : null;
      if (tgl && tgl.getMonth() + 1 === bulan && tgl.getFullYear() === tahun) smCount++;
      if (row[11] === 'BARU') smBaru++;
    });

    skData.slice(1).forEach(row => {
      if (!row[0]) return;
      if (user.role !== ROLE.KEPALA_TU && row[7] !== user.jenjang) return;
      const tgl = row[2] ? new Date(row[2]) : null;
      if (tgl && tgl.getMonth() + 1 === bulan && tgl.getFullYear() === tahun) skCount++;
    });

    const bulanNama = ['Jan','Feb','Mar','Apr','Mei','Jun',
                       'Jul','Agu','Sep','Okt','Nov','Des'][bulan - 1];

    kirimPesan(chatId,
      `📊 *Dashboard SIM-TU*\n` +
      `🏫 ${user.jenjang} | ${bulanNama} ${tahun}\n\n` +
      `📥 Surat Masuk bulan ini: *${smCount}*\n` +
      `📤 Surat Keluar bulan ini: *${skCount}*\n` +
      `🔴 Belum didisposisi: *${smBaru}*`
    );
  }

  // ----------------------------------------------------------
  // HANDLE CALLBACK (Inline Keyboard)
  // ----------------------------------------------------------

  function _handleCallback(query) {
    const chatId = String(query.message.chat.id);
    const data   = query.data;
    const user   = Auth.validateTelegram(chatId);

    // Hapus loading indicator
    _answerCallback(query.id);

    if (!user) return;

    if (data.startsWith('tpl_')) {
      _prosesTemplateSelected(chatId, data.replace('tpl_', ''), user);
    } else {
      switch (data) {
        case 'cmd_surat_keluar' : _mulaiSuratKeluar(chatId, user); break;
        case 'cmd_surat_masuk'  : _mulaiCatatSuratMasuk(chatId, user); break;
        case 'cmd_cari'         : _mulaiCariSurat(chatId, user); break;
        case 'cmd_disposisi'    : _kirimDisposisiMasuk(chatId, user); break;
        case 'cmd_dashboard'    : _kirimDashboard(chatId, user); break;
        case 'cmd_batal'        : _clearState(chatId); kirimPesan(chatId, '❌ Dibatalkan.'); break;
      }
    }
  }

  // ----------------------------------------------------------
  // KIRIM PESAN (Public API)
  // ----------------------------------------------------------

  function kirimPesan(chatId, text) {
    const token = Config.getBotToken();
    if (!token) return;

    UrlFetchApp.fetch(`${BASE_URL}${token}/sendMessage`, {
      method      : 'post',
      contentType : 'application/json',
      payload     : JSON.stringify({
        chat_id    : chatId,
        text       : text,
        parse_mode : 'Markdown',
      }),
    });
  }

  function kirimPesanDenganKeyboard(chatId, text, keyboard) {
    const token = Config.getBotToken();
    if (!token) return;

    UrlFetchApp.fetch(`${BASE_URL}${token}/sendMessage`, {
      method      : 'post',
      contentType : 'application/json',
      payload     : JSON.stringify({
        chat_id      : chatId,
        text         : text,
        parse_mode   : 'Markdown',
        reply_markup : keyboard,
      }),
    });
  }

  function kirimDokumen(chatId, blob, namaFile, caption) {
    const token = Config.getBotToken();
    if (!token) return;

    UrlFetchApp.fetch(`${BASE_URL}${token}/sendDocument`, {
      method  : 'post',
      payload : {
        chat_id  : chatId,
        document : blob,
        caption  : caption || '',
      },
    });
  }

  // ----------------------------------------------------------
  // SETUP WEBHOOK
  // ----------------------------------------------------------

  /**
   * Daftarkan URL webhook ke Telegram
   * Panggil fungsi ini SEKALI setelah deploy Web App
   */
  function setWebhook(webAppUrl) {
    const token = Config.getBotToken();
    if (!token) return 'Token bot belum diset di CONFIG.';

    const response = UrlFetchApp.fetch(
      `${BASE_URL}${token}/setWebhook?url=${webAppUrl}`
    );
    return response.getContentText();
  }

  // ----------------------------------------------------------
  // PRIVATE HELPERS
  // ----------------------------------------------------------

  function _getState(chatId) {
    const props = PropertiesService.getUserProperties();
    const raw   = props.getProperty('state_' + chatId);
    return raw ? JSON.parse(raw) : { step: STATE.IDLE };
  }

  function _setState(chatId, state) {
    const props = PropertiesService.getUserProperties();
    props.setProperty('state_' + chatId, JSON.stringify(state));
  }

  function _clearState(chatId) {
    const props = PropertiesService.getUserProperties();
    props.deleteProperty('state_' + chatId);
  }

  function _answerCallback(callbackId) {
    const token = Config.getBotToken();
    if (!token) return;
    UrlFetchApp.fetch(`${BASE_URL}${token}/answerCallbackQuery`, {
      method      : 'post',
      contentType : 'application/json',
      payload     : JSON.stringify({ callback_query_id: callbackId }),
    });
  }

  function _getFileInfo(fileId) {
    const token    = Config.getBotToken();
    const response = UrlFetchApp.fetch(`${BASE_URL}${token}/getFile?file_id=${fileId}`);
    return JSON.parse(response.getContentText()).result;
  }

  function _downloadFile(filePath) {
    const token    = Config.getBotToken();
    const response = UrlFetchApp.fetch(
      `https://api.telegram.org/file/bot${token}/${filePath}`
    );
    return response.getBlob();
  }

  function _getTempToken(user) {
    // Buat token sementara berdasarkan username untuk aksi bot
    // Token ini valid untuk satu operasi saja
    const sheet = getSheet(SHEET.USERS);
    const data  = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === user.username) {
        return data[i][8]; // session token yang tersimpan
      }
    }
    return null;
  }

  function _mulaiCatatSuratMasuk(chatId, user) {
    kirimPesan(chatId,
      '📥 *Catat Surat Masuk*\n\n' +
      'Pilih cara input:\n' +
      '📸 Kirim *foto* surat langsung dari kamera\n' +
      '📄 Kirim *file PDF* surat\n' +
      '⌨️ Atau ketik data manual dengan format:\n' +
      '`NOMOR_SURAT | TANGGAL | PENGIRIM | PERIHAL`'
    );
    _setState(chatId, { step: STATE.CATAT_SURAT_MASUK, user });
  }

  function _mulaiCariSurat(chatId, user) {
    kirimPesan(chatId,
      '🔍 *Cari Arsip Surat*\n\n' +
      'Ketik kata kunci pencarian.\n' +
      'Format: `perihal:kata_kunci` atau `bulan:5` atau `pengirim:dinas`\n\n' +
      'Contoh: `perihal:rapat`'
    );
    _setState(chatId, { step: STATE.CARI_SURAT, user });
  }

  function _prosesCariSurat(chatId, text, state, user) {
    const filter = {};
    const parts  = text.split(' ');
    parts.forEach(p => {
      const [key, val] = p.split(':');
      if (key && val) filter[key.trim()] = val.trim();
    });

    const smResult = JSON.parse(SuratMasuk.cari(_getTempToken(user), filter));
    const skResult = JSON.parse(SuratKeluar.cari(_getTempToken(user), filter));

    let pesan = `🔍 *Hasil Pencarian*\n\n`;

    if (smResult.data && smResult.data.length > 0) {
      pesan += `📥 *Surat Masuk (${smResult.data.length})*\n`;
      smResult.data.slice(0, 5).forEach(s => {
        pesan += `• ${s.noAgenda} — ${s.perihal}\n`;
      });
      if (smResult.data.length > 5) pesan += `  _...dan ${smResult.data.length - 5} lainnya_\n`;
    }

    if (skResult.data && skResult.data.length > 0) {
      pesan += `\n📤 *Surat Keluar (${skResult.data.length})*\n`;
      skResult.data.slice(0, 5).forEach(s => {
        pesan += `• ${s.noSurat} — ${s.perihal}\n`;
      });
      if (skResult.data.length > 5) pesan += `  _...dan ${skResult.data.length - 5} lainnya_\n`;
    }

    if ((!smResult.data || smResult.data.length === 0) &&
        (!skResult.data || skResult.data.length === 0)) {
      pesan += '_Tidak ada surat yang ditemukan._';
    }

    kirimPesan(chatId, pesan);
    _clearState(chatId);
  }

  function _kirimDisposisiMasuk(chatId, user) {
    const result = JSON.parse(Disposisi.getDisposisiMasuk(_getTempToken(user)));
    if (!result.data || result.data.length === 0) {
      kirimPesan(chatId, '✅ Tidak ada disposisi yang menunggu.');
      return;
    }

    let pesan = `📋 *Disposisi Menunggu (${result.data.length})*\n\n`;
    result.data.forEach((d, i) => {
      pesan += `${i + 1}. ${d.noAgenda}\n`;
      pesan += `   📄 ${d.perihal}\n`;
      pesan += `   👤 Dari: ${d.dari}\n`;
      if (d.catatan) pesan += `   💬 ${d.catatan}\n`;
      pesan += '\n';
    });
    pesan += '_Buka web SIM-TU untuk detail & konfirmasi._';

    kirimPesan(chatId, pesan);
  }

  function _handleDokumenPdf(chatId, msg, user) {
    kirimPesan(chatId, '📄 PDF diterima. Sedang disimpan...');
    try {
      const fileId   = msg.document.file_id;
      const fileInfo = _getFileInfo(fileId);
      const pdfBlob  = _downloadFile(fileInfo.file_path);
      const base64   = Utilities.base64Encode(pdfBlob.getBytes());

      const result = JSON.parse(SuratMasuk.uploadPdf(
        null,
        base64,
        'SuratMasuk_' + new Date().getTime(),
        user.jenjang
      ));

      if (result.success) {
        kirimPesan(chatId,
          '✅ PDF berhasil disimpan!\n\n' +
          '📝 Sekarang lengkapi data surat:\n' +
          '`NOMOR_SURAT | TANGGAL | PENGIRIM | PERIHAL`'
        );
        _setState(chatId, {
          step       : STATE.CATAT_SURAT_MASUK,
          lampiranId : result.data.fileId,
          lampiranUrl: result.data.fileUrl,
          user       : user,
        });
      } else {
        kirimPesan(chatId, '❌ Gagal menyimpan PDF: ' + result.message);
      }
    } catch (err) {
      kirimPesan(chatId, '❌ Terjadi kesalahan: ' + err.message);
    }
  }

  // ----------------------------------------------------------
  // PUBLIC API
  // ----------------------------------------------------------
  return {
    handleUpdate,
    kirimPesan,
    kirimPesanDenganKeyboard,
    kirimDokumen,
    setWebhook,
  };

})();

// ════════════════════════════════════════════════════════════
// MODUL: WebHandlers.gs
// ════════════════════════════════════════════════════════════
/**
 * WebHandlers.gs — Fungsi-fungsi yang dipanggil dari frontend (google.script.run)
 *
 * Semua fungsi di sini adalah "jembatan" antara HTML frontend dan modul GAS.
 * Naming convention: camelCase, nama deskriptif agar mudah dipanggil dari JS.
 */

// ============================================================
// AUTH
// ============================================================

function loginUser(username, password) {
  return Auth.login(username, password);
}

function logoutUser(token) {
  return Auth.logout(token);
}

function getWebAppUrl() {
  return ScriptApp.getService().getUrl();
}

// ============================================================
// DASHBOARD
// ============================================================

function getDashboardData(token) {
  const user = Auth.validateSession(token);
  if (!user) return jsonResponse(false, null, 'Sesi tidak valid.');

  const bulan = new Date().getMonth() + 1;
  const tahun = new Date().getFullYear();

  const smSheet = getSheet(SHEET.SURAT_MASUK);
  const skSheet = getSheet(SHEET.SURAT_KELUAR);
  const smData  = smSheet.getDataRange().getValues();
  const skData  = skSheet.getDataRange().getValues();

  let suratMasukBulanIni = 0, suratKeluarBulanIni = 0;
  let belumDisposisi = 0;
  const recentSuratMasuk = [];

  for (let i = smData.length - 1; i >= 1; i--) {
    const row = smData[i];
    if (!row[0]) continue;
    const jenjang = row[8];
    if (user.role !== ROLE.KEPALA_TU && jenjang !== user.jenjang) continue;
    const tgl = row[2] ? new Date(row[2]) : null;
    if (tgl && tgl.getMonth() + 1 === bulan && tgl.getFullYear() === tahun) suratMasukBulanIni++;
    if (row[11] === 'BARU') belumDisposisi++;
    if (recentSuratMasuk.length < 5) {
      recentSuratMasuk.push({ noAgenda: row[1], perihal: row[6], status: row[11] });
    }
  }

  for (let i = 1; i < skData.length; i++) {
    const row = skData[i];
    if (!row[0]) continue;
    if (user.role !== ROLE.KEPALA_TU && row[7] !== user.jenjang) continue;
    const tgl = row[2] ? new Date(row[2]) : null;
    if (tgl && tgl.getMonth() + 1 === bulan && tgl.getFullYear() === tahun) suratKeluarBulanIni++;
  }

  // Disposisi menunggu
  const dispResult  = JSON.parse(Disposisi.getDisposisiMasuk(token));
  const recentDisposisi = dispResult.success ? (dispResult.data || []).slice(0, 5) : [];

  // Hitung siswa aktif
  let totalSiswaAktif = 0;
  const jenjangs = user.role === ROLE.KEPALA_TU ? ['SD','SMP','SMA'] : [user.jenjang];
  jenjangs.forEach(j => {
    const sh = getSheet('SISWA_' + j);
    if (!sh) return;
    const d = sh.getDataRange().getValues();
    for (let i = 1; i < d.length; i++) {
      if (d[i][0] && d[i][9] === 'AKTIF') totalSiswaAktif++;
    }
  });

  // Audit log terkini (Kepala TU)
  let recentAudit = [];
  if (user.role === ROLE.KEPALA_TU) {
    const auditResult = JSON.parse(AuditLog.getRecent(token, 10));
    recentAudit = auditResult.success ? (auditResult.data || []) : [];
  }

  return jsonResponse(true, {
    suratMasukBulanIni,
    suratKeluarBulanIni,
    belumDisposisi,
    disposisiMenunggu : recentDisposisi.length,
    totalSiswaAktif,
    recentSuratMasuk,
    recentDisposisi,
    recentAudit,
  }, 'OK');
}

// ============================================================
// SURAT MASUK
// ============================================================

function cariSuratMasuk(token, filter) {
  return SuratMasuk.cari(token, filter);
}

function catatSuratMasuk(token, data) {
  return SuratMasuk.catat(token, data);
}

function uploadFotoSurat(token, base64, mimeType, nama, jenjang) {
  return SuratMasuk.uploadFoto(token, base64, mimeType, nama, jenjang);
}

function uploadPdfSurat(token, base64, nama, jenjang) {
  return SuratMasuk.uploadPdf(token, base64, nama, jenjang);
}

// ============================================================
// SURAT KELUAR
// ============================================================

function buatSuratKeluar(token, data) {
  return SuratKeluar.buat(token, data);
}

function cariSuratKeluar(token, filter) {
  return SuratKeluar.cari(token, filter);
}

function previewNomorSurat(token, templateId) {
  return SuratKeluar.previewNomor(token, templateId);
}

// ============================================================
// DISPOSISI
// ============================================================

function getDisposisiMasuk(token) {
  return Disposisi.getDisposisiMasuk(token);
}

function buatDisposisi(token, data) {
  return Disposisi.buat(token, data);
}

function updateStatusDisposisi(token, disposisiId, status) {
  return Disposisi.updateStatus(token, disposisiId, status);
}

// ============================================================
// TEMPLATE
// ============================================================

function getTemplates(token, jenjang) {
  const user = Auth.validateSession(token);
  if (!user) return jsonResponse(false, null, 'Sesi tidak valid.');
  const data = TemplateReg.getAll(jenjang || user.jenjang);
  return jsonResponse(true, data, '');
}

function tambahTemplate(token, data) {
  return TemplateReg.tambah(token, data);
}

function toggleTemplate(token, id, status) {
  return TemplateReg.toggleAktif(token, id, status);
}

// ============================================================
// KESISWAAN
// ============================================================

function cariSiswa(token, jenjang, filter) {
  return Kesiswaan.cari(token, jenjang, filter);
}

function tambahSiswa(token, jenjang, data) {
  return Kesiswaan.tambah(token, jenjang, data);
}

function ajukanPromosi(token, jenjang, siswaId) {
  return Kesiswaan.ajukanPromosi(token, jenjang, siswaId);
}

function konfirmasiPromosi(token, siswaId, disetujui) {
  return Kesiswaan.konfirmasiPromosi(token, siswaId, disetujui);
}

// ============================================================
// USERS
// ============================================================

function getUsers(token) {
  const user = Auth.validateSession(token);
  if (!user || user.role !== ROLE.KEPALA_TU) {
    return jsonResponse(false, null, 'Akses ditolak.');
  }
  const sheet = getSheet(SHEET.USERS);
  const data  = sheet.getDataRange().getValues();
  const result = [];
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    if (!r[0]) continue;
    result.push({
      id         : r[0],
      username   : r[1],
      role       : r[3],
      jenjang    : r[4],
      nama       : r[5],
      email      : r[6],
      telegramId : r[7],
      lastLogin  : r[9],
      status     : r[10],
    });
  }
  return jsonResponse(true, result, '');
}

function tambahUser(token, data) {
  return Auth.addUser(token, data);
}

function nonaktifUser(token, userId) {
  return Auth.deactivateUser(token, userId);
}

// ============================================================
// CONFIG
// ============================================================

function getAllConfig(token) {
  const user = Auth.validateSession(token);
  if (!user || user.role !== ROLE.KEPALA_TU) {
    return jsonResponse(false, null, 'Akses ditolak.');
  }
  return jsonResponse(true, Config.getAll(true), '');
}

function setConfig(token, key, value) {
  const user = Auth.validateSession(token);
  if (!user || user.role !== ROLE.KEPALA_TU) {
    return jsonResponse(false, null, 'Akses ditolak.');
  }
  Config.set(key, value);
  AuditLog.write(user.id, user.username, 'SET_CONFIG', `${key} = ${value}`);
  return jsonResponse(true, null, 'Konfigurasi disimpan.');
}

// ============================================================
// AUDIT LOG
// ============================================================

function getAuditLog(token, limit) {
  return AuditLog.getRecent(token, limit);
}

// ════════════════════════════════════════════════════════════
// MODUL: Setup.gs
// ════════════════════════════════════════════════════════════
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
