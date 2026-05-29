/**
 * SIM-TU — Sistem Informasi Manajemen Tata Usaha
 * Sekolah Rakyat | Google Apps Script
 *
 * Entry point utama aplikasi.
 * Handles: Web App doGet, Telegram webhook doPost
 */

// ============================================================
// KONSTANTA GLOBAL
// ============================================================
const SPREADSHEET_ID = ''; // Isi dengan ID Google Spreadsheet setelah setup
const VERSION        = '1.0.0';

// Nama Sheet
const SHEET = {
  CONFIG       : 'CONFIG',
  USERS        : 'USERS',
  SISWA_SD     : 'SISWA_SD',
  SISWA_SMP    : 'SISWA_SMP',
  SISWA_SMA    : 'SISWA_SMA',
  SURAT_MASUK  : 'SURAT_MASUK',
  SURAT_KELUAR : 'SURAT_KELUAR',
  DISPOSISI    : 'DISPOSISI',
  TEMPLATE_REG : 'TEMPLATE_REG',
  AUDIT_LOG    : 'AUDIT_LOG',
};

// Role
const ROLE = {
  KEPALA_TU : 'KEPALA_TU',
  TU_SD     : 'TU_SD',
  TU_SMP    : 'TU_SMP',
  TU_SMA    : 'TU_SMA',
};

// Jenjang
const JENJANG = {
  SD  : 'SD',
  SMP : 'SMP',
  SMA : 'SMA',
};

// ============================================================
// WEB APP — Entry Point
// ============================================================

/**
 * Menangani request GET → render Web App
 *
 * Catatan: doGet SELALU menyajikan shell (index). Gerbang autentikasi
 * ditangani di sisi client berdasarkan session token di sessionStorage,
 * karena server tidak bisa membaca sessionStorage browser.
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('frontend/index')
    .evaluate()
    .setTitle('SIM-TU — Tata Usaha')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Menangani request POST → Telegram Bot webhook
 */
function doPost(e) {
  try {
    const update = JSON.parse(e.postData.contents);
    TelegramBot.handleUpdate(update);
  } catch (err) {
    AuditLog.error('doPost', err.message);
  }
  return ContentService.createTextOutput('OK');
}

// ============================================================
// HELPER GLOBAL
// ============================================================

/**
 * Include file HTML partial
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Mendapatkan instance Spreadsheet utama
 */
function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

/**
 * Mendapatkan sheet berdasarkan nama
 */
function getSheet(sheetName) {
  return getSpreadsheet().getSheetByName(sheetName);
}

/**
 * Response JSON standar untuk client-side call
 */
function jsonResponse(success, data, message) {
  return JSON.stringify({
    success : success,
    data    : data || null,
    message : message || '',
  });
}
