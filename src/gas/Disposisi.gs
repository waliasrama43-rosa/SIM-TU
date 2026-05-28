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
