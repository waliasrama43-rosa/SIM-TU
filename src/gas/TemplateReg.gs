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
