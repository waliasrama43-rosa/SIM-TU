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
