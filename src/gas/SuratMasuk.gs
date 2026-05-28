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
