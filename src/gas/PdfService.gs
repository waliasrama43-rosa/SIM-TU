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
