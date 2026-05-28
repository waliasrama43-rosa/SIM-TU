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
