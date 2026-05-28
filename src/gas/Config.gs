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
