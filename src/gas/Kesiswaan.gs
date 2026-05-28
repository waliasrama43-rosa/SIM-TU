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
