/**
 * WebHandlers.gs — Fungsi-fungsi yang dipanggil dari frontend (google.script.run)
 *
 * Semua fungsi di sini adalah "jembatan" antara HTML frontend dan modul GAS.
 * Naming convention: camelCase, nama deskriptif agar mudah dipanggil dari JS.
 */

// ============================================================
// AUTH
// ============================================================

function loginUser(username, password) {
  return Auth.login(username, password);
}

function logoutUser(token) {
  return Auth.logout(token);
}

function getWebAppUrl() {
  return ScriptApp.getService().getUrl();
}

// ============================================================
// DASHBOARD
// ============================================================

function getDashboardData(token) {
  const user = Auth.validateSession(token);
  if (!user) return jsonResponse(false, null, 'Sesi tidak valid.');

  const bulan = new Date().getMonth() + 1;
  const tahun = new Date().getFullYear();

  const smSheet = getSheet(SHEET.SURAT_MASUK);
  const skSheet = getSheet(SHEET.SURAT_KELUAR);
  const smData  = smSheet.getDataRange().getValues();
  const skData  = skSheet.getDataRange().getValues();

  let suratMasukBulanIni = 0, suratKeluarBulanIni = 0;
  let belumDisposisi = 0;
  const recentSuratMasuk = [];

  for (let i = smData.length - 1; i >= 1; i--) {
    const row = smData[i];
    if (!row[0]) continue;
    const jenjang = row[8];
    if (user.role !== ROLE.KEPALA_TU && jenjang !== user.jenjang) continue;
    const tgl = row[2] ? new Date(row[2]) : null;
    if (tgl && tgl.getMonth() + 1 === bulan && tgl.getFullYear() === tahun) suratMasukBulanIni++;
    if (row[11] === 'BARU') belumDisposisi++;
    if (recentSuratMasuk.length < 5) {
      recentSuratMasuk.push({ noAgenda: row[1], perihal: row[6], status: row[11] });
    }
  }

  for (let i = 1; i < skData.length; i++) {
    const row = skData[i];
    if (!row[0]) continue;
    if (user.role !== ROLE.KEPALA_TU && row[7] !== user.jenjang) continue;
    const tgl = row[2] ? new Date(row[2]) : null;
    if (tgl && tgl.getMonth() + 1 === bulan && tgl.getFullYear() === tahun) suratKeluarBulanIni++;
  }

  // Disposisi menunggu
  const dispResult  = JSON.parse(Disposisi.getDisposisiMasuk(token));
  const recentDisposisi = dispResult.success ? (dispResult.data || []).slice(0, 5) : [];

  // Hitung siswa aktif
  let totalSiswaAktif = 0;
  const jenjangs = user.role === ROLE.KEPALA_TU ? ['SD','SMP','SMA'] : [user.jenjang];
  jenjangs.forEach(j => {
    const sh = getSheet('SISWA_' + j);
    if (!sh) return;
    const d = sh.getDataRange().getValues();
    for (let i = 1; i < d.length; i++) {
      if (d[i][0] && d[i][9] === 'AKTIF') totalSiswaAktif++;
    }
  });

  // Audit log terkini (Kepala TU)
  let recentAudit = [];
  if (user.role === ROLE.KEPALA_TU) {
    const auditResult = JSON.parse(AuditLog.getRecent(token, 10));
    recentAudit = auditResult.success ? (auditResult.data || []) : [];
  }

  return jsonResponse(true, {
    suratMasukBulanIni,
    suratKeluarBulanIni,
    belumDisposisi,
    disposisiMenunggu : recentDisposisi.length,
    totalSiswaAktif,
    recentSuratMasuk,
    recentDisposisi,
    recentAudit,
  }, 'OK');
}

// ============================================================
// SURAT MASUK
// ============================================================

function cariSuratMasuk(token, filter) {
  return SuratMasuk.cari(token, filter);
}

function catatSuratMasuk(token, data) {
  return SuratMasuk.catat(token, data);
}

function uploadFotoSurat(token, base64, mimeType, nama, jenjang) {
  return SuratMasuk.uploadFoto(token, base64, mimeType, nama, jenjang);
}

function uploadPdfSurat(token, base64, nama, jenjang) {
  return SuratMasuk.uploadPdf(token, base64, nama, jenjang);
}

// ============================================================
// SURAT KELUAR
// ============================================================

function buatSuratKeluar(token, data) {
  return SuratKeluar.buat(token, data);
}

function cariSuratKeluar(token, filter) {
  return SuratKeluar.cari(token, filter);
}

function previewNomorSurat(token, templateId) {
  return SuratKeluar.previewNomor(token, templateId);
}

// ============================================================
// DISPOSISI
// ============================================================

function getDisposisiMasuk(token) {
  return Disposisi.getDisposisiMasuk(token);
}

function buatDisposisi(token, data) {
  return Disposisi.buat(token, data);
}

function updateStatusDisposisi(token, disposisiId, status) {
  return Disposisi.updateStatus(token, disposisiId, status);
}

// ============================================================
// TEMPLATE
// ============================================================

function getTemplates(token, jenjang) {
  const user = Auth.validateSession(token);
  if (!user) return jsonResponse(false, null, 'Sesi tidak valid.');
  const data = TemplateReg.getAll(jenjang || user.jenjang);
  return jsonResponse(true, data, '');
}

function tambahTemplate(token, data) {
  return TemplateReg.tambah(token, data);
}

function toggleTemplate(token, id, status) {
  return TemplateReg.toggleAktif(token, id, status);
}

// ============================================================
// KESISWAAN
// ============================================================

function cariSiswa(token, jenjang, filter) {
  return Kesiswaan.cari(token, jenjang, filter);
}

function tambahSiswa(token, jenjang, data) {
  return Kesiswaan.tambah(token, jenjang, data);
}

function ajukanPromosi(token, jenjang, siswaId) {
  return Kesiswaan.ajukanPromosi(token, jenjang, siswaId);
}

function konfirmasiPromosi(token, siswaId, disetujui) {
  return Kesiswaan.konfirmasiPromosi(token, siswaId, disetujui);
}

// ============================================================
// USERS
// ============================================================

function getUsers(token) {
  const user = Auth.validateSession(token);
  if (!user || user.role !== ROLE.KEPALA_TU) {
    return jsonResponse(false, null, 'Akses ditolak.');
  }
  const sheet = getSheet(SHEET.USERS);
  const data  = sheet.getDataRange().getValues();
  const result = [];
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    if (!r[0]) continue;
    result.push({
      id         : r[0],
      username   : r[1],
      role       : r[3],
      jenjang    : r[4],
      nama       : r[5],
      email      : r[6],
      telegramId : r[7],
      lastLogin  : r[9],
      status     : r[10],
    });
  }
  return jsonResponse(true, result, '');
}

function tambahUser(token, data) {
  return Auth.addUser(token, data);
}

function nonaktifUser(token, userId) {
  return Auth.deactivateUser(token, userId);
}

// ============================================================
// CONFIG
// ============================================================

function getAllConfig(token) {
  const user = Auth.validateSession(token);
  if (!user || user.role !== ROLE.KEPALA_TU) {
    return jsonResponse(false, null, 'Akses ditolak.');
  }
  return jsonResponse(true, Config.getAll(true), '');
}

function setConfig(token, key, value) {
  const user = Auth.validateSession(token);
  if (!user || user.role !== ROLE.KEPALA_TU) {
    return jsonResponse(false, null, 'Akses ditolak.');
  }
  Config.set(key, value);
  AuditLog.write(user.id, user.username, 'SET_CONFIG', `${key} = ${value}`);
  return jsonResponse(true, null, 'Konfigurasi disimpan.');
}

// ============================================================
// AUDIT LOG
// ============================================================

function getAuditLog(token, limit) {
  return AuditLog.getRecent(token, limit);
}
