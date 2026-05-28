/**
 * NomorSurat.gs — Generate Nomor Surat Otomatis
 *
 * Format (dari CONFIG):
 * {{URUT}}/{{KODE_SEKOLAH}}/{{KODE_SURAT}}.{{KLASIFIKASI}}/{{BULAN}}/{{TAHUN}}
 *
 * Contoh output:
 * 008/SRT-48/DL.00.00/5/2026
 *
 * Prinsip keamanan:
 * - Nomor di-generate HANYA saat surat disimpan final
 * - LockService mencegah race condition
 * - Nomor lama (tahun sebelumnya) tetap tersimpan di CONFIG
 */

const NomorSurat = (() => {

  /**
   * Generate nomor surat baru
   * @param {string} jenjang   - 'SD', 'SMP', 'SMA'
   * @param {string} kodeSurat - misal 'DL', 'SKET', 'MUT'
   * @param {string} klasifikasi - misal '00.00'
   * @param {Date}   tanggal   - tanggal surat (default: sekarang)
   * @returns {string} nomor surat terformat
   */
  function generate(jenjang, kodeSurat, klasifikasi, tanggal) {
    const tgl   = tanggal || new Date();
    const tahun = tgl.getFullYear();
    const bulan = tgl.getMonth() + 1; // 1-12

    // Increment nomor urut (thread-safe)
    const noUrut = Config.incrementNoUrut(jenjang, tahun);

    // Format urut sesuai panjang digit dari CONFIG (misal 3 → "008")
    const panjang = Config.getPanjangUrut();
    const urutStr = String(noUrut).padStart(panjang, '0');

    // Ambil format dari CONFIG
    const format = Config.getFormatNomor();

    // Substitusi placeholder
    const nomor = format
      .replace('{{URUT}}', urutStr)
      .replace('{{KODE_SEKOLAH}}', Config.getKodeSekolah())
      .replace('{{KODE_SURAT}}', kodeSurat)
      .replace('{{KLASIFIKASI}}', klasifikasi)
      .replace('{{BULAN}}', bulan)
      .replace('{{BULAN_ROMAWI}}', _toRomawi(bulan))
      .replace('{{TAHUN}}', tahun);

    return nomor;
  }

  /**
   * Preview nomor surat berikutnya (tanpa increment)
   * Dipakai di form sebelum surat disimpan — READ ONLY
   * @param {string} jenjang
   * @param {string} kodeSurat
   * @param {string} klasifikasi
   * @returns {string} preview nomor
   */
  function preview(jenjang, kodeSurat, klasifikasi) {
    const tahun  = new Date().getFullYear();
    const bulan  = new Date().getMonth() + 1;
    const noUrut = Config.getNoUrut(jenjang, tahun) + 1; // +1 tapi belum disimpan

    const panjang = Config.getPanjangUrut();
    const urutStr = String(noUrut).padStart(panjang, '0');
    const format  = Config.getFormatNomor();

    return format
      .replace('{{URUT}}', urutStr)
      .replace('{{KODE_SEKOLAH}}', Config.getKodeSekolah())
      .replace('{{KODE_SURAT}}', kodeSurat || '??')
      .replace('{{KLASIFIKASI}}', klasifikasi || '00.00')
      .replace('{{BULAN}}', bulan)
      .replace('{{BULAN_ROMAWI}}', _toRomawi(bulan))
      .replace('{{TAHUN}}', tahun);
  }

  // ----------------------------------------------------------
  // PRIVATE HELPERS
  // ----------------------------------------------------------

  function _toRomawi(bulan) {
    const romawi = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
    return romawi[bulan - 1] || bulan;
  }

  // ----------------------------------------------------------
  // PUBLIC API
  // ----------------------------------------------------------
  return { generate, preview };

})();
