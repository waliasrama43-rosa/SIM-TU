/**
 * Auth.gs — Autentikasi & Role-Based Access Control (RBAC)
 *
 * Fitur:
 * - Login dengan username + password
 * - Single Session (satu akun = satu perangkat aktif)
 * - Hard-limit akun per role (maks 2 per jenjang)
 * - Validasi session token
 * - Whitelist Telegram Chat ID
 */

const Auth = (() => {

  // Kolom di Sheet USERS
  const COL = {
    ID          : 1,
    USERNAME    : 2,
    PASSWORD    : 3,  // Hashed
    ROLE        : 4,
    JENJANG     : 5,
    NAMA        : 6,
    EMAIL       : 7,
    TELEGRAM_ID : 8,
    SESSION     : 9,  // Token sesi aktif
    LAST_LOGIN  : 10,
    STATUS      : 11, // AKTIF / NONAKTIF
  };

  const MAX_AKUN_PER_ROLE = 2;

  // ----------------------------------------------------------
  // LOGIN
  // ----------------------------------------------------------

  /**
   * Proses login user
   * @param {string} username
   * @param {string} password
   * @returns {string} JSON response dengan token atau error
   */
  function login(username, password) {
    const sheet = getSheet(SHEET.USERS);
    const data  = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[COL.USERNAME - 1] !== username) continue;
      if (row[COL.STATUS - 1] !== 'AKTIF') {
        return jsonResponse(false, null, 'Akun tidak aktif.');
      }

      const hashedInput = _hashPassword(password);
      if (row[COL.PASSWORD - 1] !== hashedInput) {
        return jsonResponse(false, null, 'Username atau password salah.');
      }

      // Generate token baru (single session: invalidate token lama)
      const token = _generateToken();
      const now   = new Date();

      sheet.getRange(i + 1, COL.SESSION).setValue(token);
      sheet.getRange(i + 1, COL.LAST_LOGIN).setValue(now);

      AuditLog.write(row[COL.ID - 1], username, 'LOGIN', 'Web App');

      return jsonResponse(true, {
        token    : token,
        username : username,
        nama     : row[COL.NAMA - 1],
        role     : row[COL.ROLE - 1],
        jenjang  : row[COL.JENJANG - 1],
      }, 'Login berhasil.');
    }

    return jsonResponse(false, null, 'Username atau password salah.');
  }

  // ----------------------------------------------------------
  // LOGOUT
  // ----------------------------------------------------------

  function logout(token) {
    const user = _getUserByToken(token);
    if (!user) return jsonResponse(false, null, 'Sesi tidak ditemukan.');

    const sheet = getSheet(SHEET.USERS);
    const data  = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][COL.SESSION - 1] === token) {
        sheet.getRange(i + 1, COL.SESSION).setValue('');
        AuditLog.write(data[i][COL.ID - 1], data[i][COL.USERNAME - 1], 'LOGOUT', '');
        break;
      }
    }
    return jsonResponse(true, null, 'Logout berhasil.');
  }

  // ----------------------------------------------------------
  // VALIDASI SESI
  // ----------------------------------------------------------

  /**
   * Validasi token sesi — dipakai di doGet & setiap request
   * @param {string} token
   * @returns {object|null} user object atau null
   */
  function validateSession(token) {
    if (!token) return null;
    return _getUserByToken(token);
  }

  // ----------------------------------------------------------
  // VALIDASI TELEGRAM
  // ----------------------------------------------------------

  /**
   * Cek apakah Telegram Chat ID terdaftar & aktif
   * @param {string} chatId
   * @returns {object|null} user object atau null
   */
  function validateTelegram(chatId) {
    const sheet = getSheet(SHEET.USERS);
    const data  = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (String(row[COL.TELEGRAM_ID - 1]) === String(chatId) &&
          row[COL.STATUS - 1] === 'AKTIF') {
        return {
          id       : row[COL.ID - 1],
          username : row[COL.USERNAME - 1],
          nama     : row[COL.NAMA - 1],
          role     : row[COL.ROLE - 1],
          jenjang  : row[COL.JENJANG - 1],
        };
      }
    }
    return null;
  }

  // ----------------------------------------------------------
  // KELOLA USER (Kepala TU only)
  // ----------------------------------------------------------

  /**
   * Tambah user baru
   */
  function addUser(actorToken, userData) {
    const actor = validateSession(actorToken);
    if (!actor || actor.role !== ROLE.KEPALA_TU) {
      return jsonResponse(false, null, 'Akses ditolak. Hanya Kepala TU.');
    }

    // Hard-limit: cek jumlah akun per role
    if (!_checkRoleLimit(userData.role)) {
      return jsonResponse(false, null,
        `Batas maksimal ${MAX_AKUN_PER_ROLE} akun untuk role ${userData.role} sudah tercapai.`);
    }

    const sheet = getSheet(SHEET.USERS);
    const id    = _generateId();
    const row   = [
      id,
      userData.username,
      _hashPassword(userData.password),
      userData.role,
      userData.jenjang,
      userData.nama,
      userData.email || '',
      userData.telegramId || '',
      '', // session kosong
      '',
      'AKTIF',
    ];

    sheet.appendRow(row);
    AuditLog.write(actor.id, actor.username, 'ADD_USER', `User: ${userData.username}`);
    return jsonResponse(true, { id }, 'User berhasil ditambahkan.');
  }

  /**
   * Nonaktifkan user
   */
  function deactivateUser(actorToken, userId) {
    const actor = validateSession(actorToken);
    if (!actor || actor.role !== ROLE.KEPALA_TU) {
      return jsonResponse(false, null, 'Akses ditolak.');
    }

    const sheet = getSheet(SHEET.USERS);
    const data  = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][COL.ID - 1] === userId) {
        sheet.getRange(i + 1, COL.STATUS).setValue('NONAKTIF');
        sheet.getRange(i + 1, COL.SESSION).setValue('');
        AuditLog.write(actor.id, actor.username, 'DEACTIVATE_USER', `UserID: ${userId}`);
        return jsonResponse(true, null, 'User dinonaktifkan.');
      }
    }
    return jsonResponse(false, null, 'User tidak ditemukan.');
  }

  // ----------------------------------------------------------
  // PRIVATE HELPERS
  // ----------------------------------------------------------

  function _getUserByToken(token) {
    const sheet = getSheet(SHEET.USERS);
    const data  = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[COL.SESSION - 1] === token && row[COL.STATUS - 1] === 'AKTIF') {
        return {
          id       : row[COL.ID - 1],
          username : row[COL.USERNAME - 1],
          nama     : row[COL.NAMA - 1],
          role     : row[COL.ROLE - 1],
          jenjang  : row[COL.JENJANG - 1],
        };
      }
    }
    return null;
  }

  function _checkRoleLimit(role) {
    const sheet = getSheet(SHEET.USERS);
    const data  = sheet.getDataRange().getValues();
    let count   = 0;

    for (let i = 1; i < data.length; i++) {
      if (data[i][COL.ROLE - 1] === role &&
          data[i][COL.STATUS - 1] === 'AKTIF') {
        count++;
      }
    }
    // Kepala TU tidak dibatasi
    if (role === ROLE.KEPALA_TU) return true;
    return count < MAX_AKUN_PER_ROLE;
  }

  function _hashPassword(password) {
    return Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      password
    ).map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
  }

  function _generateToken() {
    return Utilities.getUuid() + '_' + new Date().getTime();
  }

  function _generateId() {
    return 'USR_' + Utilities.getUuid().split('-')[0].toUpperCase();
  }

  // ----------------------------------------------------------
  // PUBLIC API
  // ----------------------------------------------------------
  return {
    login,
    logout,
    validateSession,
    validateTelegram,
    addUser,
    deactivateUser,
  };

})();
