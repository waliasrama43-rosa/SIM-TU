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
