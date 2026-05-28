/* ============================================================
   SIM-TU — Main JavaScript
   Handles: routing, auth, API calls, UI utilities
   ============================================================ */

'use strict';

// ── SESSION ──────────────────────────────────────────
const Session = {
  get token()   { return sessionStorage.getItem('simtu_token')    || ''; },
  get nama()    { return sessionStorage.getItem('simtu_nama')     || ''; },
  get username(){ return sessionStorage.getItem('simtu_username') || ''; },
  get role()    { return sessionStorage.getItem('simtu_role')     || ''; },
  get jenjang() { return sessionStorage.getItem('simtu_jenjang')  || ''; },
  isKepalaTU()  { return this.role === 'KEPALA_TU'; },
  clear()       { sessionStorage.clear(); },
};


// ── API WRAPPER ───────────────────────────────────────
const API = {
  call(fnName, ...args) {
    return new Promise((resolve, reject) => {
      let runner = google.script.run.withFailureHandler(reject);
      runner = runner.withSuccessHandler(raw => {
        try { resolve(JSON.parse(raw)); }
        catch(e) { resolve({ success: false, message: 'Parse error', data: null }); }
      });
      runner[fnName](...args);
    });
  },
  login(u, p)           { return this.call('loginUser', u, p); },
  logout()              { return this.call('logoutUser', Session.token); },
  getDashboard()        { return this.call('getDashboardData', Session.token); },
  getSuratMasuk(filter) { return this.call('cariSuratMasuk', Session.token, filter); },
  getSuratKeluar(filter){ return this.call('cariSuratKeluar', Session.token, filter); },
  getTemplates(jenjang) { return this.call('getTemplates', Session.token, jenjang); },
  buatSuratKeluar(data) { return this.call('buatSuratKeluar', Session.token, data); },
  catSuratMasuk(data)   { return this.call('catatSuratMasuk', Session.token, data); },
  uploadFoto(b64,mime,nama,jenjang) { return this.call('uploadFotoSurat', Session.token, b64, mime, nama, jenjang); },
  uploadPdf(b64,nama,jenjang)       { return this.call('uploadPdfSurat',  Session.token, b64, nama, jenjang); },
  getDisposisi()        { return this.call('getDisposisiMasuk', Session.token); },
  buatDisposisi(data)   { return this.call('buatDisposisi', Session.token, data); },
  updateDisposisi(id,s) { return this.call('updateStatusDisposisi', Session.token, id, s); },
  getSiswa(jenjang,f)   { return this.call('cariSiswa', Session.token, jenjang, f); },
  tambahSiswa(j,data)   { return this.call('tambahSiswa', Session.token, j, data); },
  getUsers()            { return this.call('getUsers', Session.token); },
  tambahUser(data)      { return this.call('tambahUser', Session.token, data); },
  nonaktifUser(id)      { return this.call('nonaktifUser', Session.token, id); },
  getConfig()           { return this.call('getAllConfig', Session.token); },
  setConfig(k,v)        { return this.call('setConfig', Session.token, k, v); },
  getAuditLog(n)        { return this.call('getAuditLog', Session.token, n); },
  previewNomor(tplId)   { return this.call('previewNomorSurat', Session.token, tplId); },
  tambahTemplate(data)  { return this.call('tambahTemplate', Session.token, data); },
  toggleTemplate(id,s)  { return this.call('toggleTemplate', Session.token, id, s); },
  ajukanPromosi(j,sid)  { return this.call('ajukanPromosi', Session.token, j, sid); },
  konfirmasiPromosi(sid,ok) { return this.call('konfirmasiPromosi', Session.token, sid, ok); },
};


// ── TOAST ─────────────────────────────────────────────
const Toast = {
  show(msg, type='info', duration=3500) {
    const icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span class="toast-icon">${icons[type]||'ℹ️'}</span>
                    <span class="toast-msg">${msg}</span>`;
    document.getElementById('toastContainer').appendChild(el);
    setTimeout(() => { el.style.opacity='0'; el.style.transition='opacity .4s';
      setTimeout(() => el.remove(), 400); }, duration);
  },
  success(m) { this.show(m,'success'); },
  error(m)   { this.show(m,'error',5000); },
  warn(m)    { this.show(m,'warning'); },
};

// ── MODAL ─────────────────────────────────────────────
const Modal = {
  open(title, bodyHtml, opts={}) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML   = bodyHtml;
    const footer = document.getElementById('modalFooter');
    if (opts.hideFooter) { footer.style.display='none'; }
    else {
      footer.style.display='flex';
      document.getElementById('modalConfirm').textContent = opts.confirmText || 'Ya, Lanjutkan';
      document.getElementById('modalConfirm').className   = `btn ${opts.confirmClass||'btn-primary'}`;
    }
    if (opts.large) document.getElementById('modalBox').classList.add('modal-lg');
    else document.getElementById('modalBox').classList.remove('modal-lg');
    document.getElementById('modalOverlay').classList.add('open');
    this._onConfirm = opts.onConfirm || null;
  },
  close() {
    document.getElementById('modalOverlay').classList.remove('open');
    this._onConfirm = null;
  },
  confirm() { if (this._onConfirm) this._onConfirm(); this.close(); },
  _onConfirm: null,
};


// ── ROUTER ────────────────────────────────────────────
const pages = {};   // { pageName: renderFn }

function registerPage(name, fn) { pages[name] = fn; }

async function navigate(page) {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  const titles = {
    'dashboard'   : 'Dashboard',
    'surat-masuk' : 'Surat Masuk',
    'surat-keluar': 'Surat Keluar',
    'disposisi'   : 'Disposisi Surat',
    'kesiswaan'   : 'Data Siswa',
    'template-reg': 'Template Surat',
    'users'       : 'Kelola User',
    'config'      : 'Konfigurasi Sistem',
    'audit-log'   : 'Audit Log',
  };
  document.getElementById('pageTitle').textContent = titles[page] || page;
  const content = document.getElementById('pageContent');
  content.innerHTML = '<div class="loading-page"><div class="loading-spinner"></div><p>Memuat...</p></div>';
  if (pages[page]) { await pages[page](content); }
  else { content.innerHTML = `<div class="loading-page"><p>Halaman tidak ditemukan.</p></div>`; }
}

// ── HELPERS ──────────────────────────────────────────
function fmtTanggal(val) {
  if (!val) return '-';
  const d = new Date(val);
  if (isNaN(d)) return val;
  return d.toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });
}
function fmtBulan(n) {
  return ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][n-1] || n;
}
function statusBadge(s) {
  const map = {
    'BARU'        : 'info',    'DIDISPOSISI':'warning', 'SELESAI':'success',
    'MENUNGGU'    : 'warning', 'DITERIMA'   :'info',    'DIPROSES':'info',
    'AKTIF'       : 'success', 'NONAKTIF'   :'danger',  'FINAL'   :'success',
    'PROMOSI_PENDING':'warning','LULUS'      :'gray',    'MUTASI'  :'gray',
  };
  return `<span class="badge badge-${map[s]||'gray'}">${s}</span>`;
}
function escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}


// ── INIT APP ──────────────────────────────────────────
function initApp() {
  // Auth guard
  if (!Session.token) { window.location.reload(); return; }

  // Populate UI
  document.getElementById('sidebarNama').textContent  = Session.nama;
  document.getElementById('sidebarRole').textContent  = Session.role.replace('_',' ');
  document.getElementById('userAvatar').textContent   = Session.nama.charAt(0).toUpperCase();
  document.getElementById('topbarUser').textContent   = Session.nama;
  const jEl = document.getElementById('topbarJenjang');
  jEl.textContent = Session.jenjang;
  jEl.className   = `topbar-jenjang ${Session.jenjang.toLowerCase()}`;

  // Admin-only menus
  if (!Session.isKepalaTU()) {
    document.querySelectorAll('.admin-only').forEach(el => el.style.display='none');
  }

  // Clock
  function updateClock() {
    document.getElementById('topbarTime').textContent =
      new Date().toLocaleTimeString('id-ID', {hour:'2-digit',minute:'2-digit',second:'2-digit'});
  }
  updateClock(); setInterval(updateClock, 1000);

  // Sidebar toggle
  const sidebar     = document.getElementById('sidebar');
  const mainWrapper = document.getElementById('mainWrapper');
  document.getElementById('sidebarToggle').addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    mainWrapper.classList.toggle('sidebar-collapsed');
  });
  document.getElementById('mobileMenuBtn').addEventListener('click', () => {
    sidebar.classList.toggle('mobile-open');
  });

  // Nav links
  document.querySelectorAll('.nav-item[data-page]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      sidebar.classList.remove('mobile-open');
      navigate(el.dataset.page);
    });
  });

  // Modal
  document.getElementById('modalClose').addEventListener('click',  () => Modal.close());
  document.getElementById('modalCancel').addEventListener('click', () => Modal.close());
  document.getElementById('modalConfirm').addEventListener('click',() => Modal.confirm());
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modalOverlay')) Modal.close();
  });

  // Logout
  document.getElementById('btnLogout').addEventListener('click', () => {
    Modal.open('Konfirmasi Keluar', '<p>Apakah Anda yakin ingin keluar?</p>', {
      confirmText: 'Ya, Keluar',
      confirmClass: 'btn-danger',
      onConfirm: async () => {
        await API.logout();
        Session.clear();
        window.location.reload();
      }
    });
  });

  // Start on dashboard
  navigate('dashboard');
}

document.addEventListener('DOMContentLoaded', initApp);
