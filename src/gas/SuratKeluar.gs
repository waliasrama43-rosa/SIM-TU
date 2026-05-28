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
