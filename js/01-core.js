'use strict';
/* ===== Core: utilities, dates, icons, state, storage, sync, undo ===== */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const clone = (o) => JSON.parse(JSON.stringify(o));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function plural(n, f) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return f[2];
  if (b > 1 && b < 5) return f[1];
  if (b === 1) return f[0];
  return f[2];
}
const pl = (n, f) => n + ' ' + plural(n, f);
const W_TASK = ['задача', 'задачи', 'задач'];
const W_DAY = ['день', 'дня', 'дней'];
const W_MIN = ['минута', 'минуты', 'минут'];
const W_TIME = ['раз', 'раза', 'раз'];

/* ---------- icons ---------- */
const ICONS = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2.5"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  chev: '<path d="m9 18 6-6-6-6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  up: '<path d="m18 15-6-6-6 6"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
  tag: '<path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  note: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M10 2h4"/>',
  chart: '<path d="M3 3v18h18"/><path d="M8 17v-5M13 17V8M18 17v-3"/>',
  matrix: '<rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M12 3v18M3 12h18"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="m16 6-4-4-4 4M12 2v13"/>',
  calplus: '<rect x="3" y="4" width="18" height="18" rx="2.5"/><path d="M16 2v4M8 2v4M3 10h18M12 13v6M9 16h6"/>',
  folder: '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9l-.8-1.2A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z"/>',
  star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2-6.2 3.2L7 14.2 2 9.3l6.9-1z"/>',
  cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2 2h2l2.7 12.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L22 7H5.1"/>',
  sort: '<path d="M3 6h18M6 12h12M10 18h4"/>',
  dots: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
  play: '<path d="M7 4v16l13-8z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  skip: '<path d="m5 4 10 8-10 8zM19 5v14"/>',
  reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>',
  select: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="m8 12 3 3 5-6"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M4 16V5a1 1 0 0 1 1-1h11"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  sunrise: '<path d="M12 2v8M4.9 10.9l1.4 1.4M2 18h2M20 18h2M19.1 10.9l-1.4 1.4M22 22H2M8 6l4-4 4 4M16 18a4 4 0 0 0-8 0"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/>',
  checks: '<path d="m3 17 2 2 4-4M3 7l2 2 4-4M13 6h8M13 12h8M13 18h8"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
  wand: '<path d="m15 4 5 5M3 21l12-12M14 3v2M19 8h2M17 2l.5 1.5M21 6l-1.5.5"/>',
  minus: '<path d="M5 12h14"/>',
  timeline: '<path d="M4 5h3M4 12h3M4 19h3M10 5h10M10 12h7M10 19h9"/>',
};
const ic = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;

/* ---------- dates (keys are local 'YYYY-MM-DD') ---------- */
const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const MONTHS_G = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_S = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const WD_S = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const WD_L = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const pad = (n) => String(n).padStart(2, '0');
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dateOf = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d, 12); };
const todayKey = () => keyOf(new Date());
const addDays = (k, n) => { const d = dateOf(k); d.setDate(d.getDate() + n); return keyOf(d); };
const diffDays = (a, b) => Math.round((dateOf(b) - dateOf(a)) / 864e5); // b - a
const wdOf = (k) => dateOf(k).getDay();
function addMonths(k, n) {
  const d = dateOf(k), day = d.getDate();
  d.setDate(1); d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return keyOf(d);
}
function weekStartOf(k) {
  const ws = state.settings.weekStart;
  const back = (wdOf(k) - ws + 7) % 7;
  return addDays(k, -back);
}
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const timeToMin = (t) => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const minToTime = (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
function fmtDur(min) {
  if (!min) return '';
  const h = Math.floor(min / 60), m = min % 60;
  if (!h) return m + ' мин';
  return h + ' ч' + (m ? ' ' + m + ' мин' : '');
}
function fmtDay(k, opts = {}) {
  const t = todayKey(), dd = diffDays(t, k), d = dateOf(k);
  if (!opts.noRel) {
    if (dd === 0) return 'Сегодня';
    if (dd === 1) return 'Завтра';
    if (dd === -1) return 'Вчера';
    if (dd === 2) return 'Послезавтра';
  }
  let s = `${d.getDate()} ${MONTHS_G[d.getMonth()]}`;
  if (d.getFullYear() !== new Date().getFullYear()) s += ' ' + d.getFullYear();
  if (opts.wd || (dd > 1 && dd < 7)) s = WD_S[d.getDay()] + ', ' + s;
  return s;
}
const fmtShort = (k) => { const d = dateOf(k); return `${d.getDate()} ${MONTHS_S[d.getMonth()]}`; };

/* ---------- state ---------- */
const STORE_KEY = 'planirovk.v1';
const PREFS_KEY = 'planirovk.prefs';
const LIST_COLORS = ['#2F5BEA', '#E0393F', '#E8890A', '#188A4E', '#8B4FD8', '#D6409F', '#0E9BB0', '#8A6A44', '#5F6B7D', '#B79600'];
const LIST_EMOJI = ['📥', '💼', '📚', '🏠', '🛒', '🎯', '💡', '✈️', '🏋️', '💰', '❤️', '🎉', '🧹', '🍳', '🚗', '👶', '🐶', '🎓', '📈', '🛠️', '🎨', '🌿', '🎁', '📌'];
const DEFAULT_SETTINGS = {
  theme: 'auto', weekStart: 1, smartInput: true, defaultList: 'inbox',
  focusLen: 25, shortBreak: 5, longBreak: 15, longEvery: 4, autoNext: false, sound: true,
  dayCapacity: 480, showDoneToday: true, notify: false,
};

function freshState() {
  return {
    v: 1,
    lists: [{ id: 'inbox', name: 'Входящие', color: '#5F6B7D', emoji: '📥', type: 'tasks', builtin: true, sort: 'manual', created: Date.now() }],
    tasks: [], habits: [], templates: [],
    focus: { log: {}, count: {} },
    doneLog: {},
    shopHist: {},
    settings: { ...DEFAULT_SETTINGS },
    meta: { created: Date.now(), updatedAt: 0, touched: false, seeded: false, notified: {}, exampleLog: false, hideExampleBanner: false },
  };
}

function migrate(s) {
  const base = freshState();
  s = Object.assign(base, s || {});
  s.settings = Object.assign({ ...DEFAULT_SETTINGS }, s.settings || {});
  s.meta = Object.assign(freshState().meta, s.meta || {});
  s.focus = Object.assign({ log: {}, count: {} }, s.focus || {});
  if (!s.lists.find((l) => l.id === 'inbox')) s.lists.unshift(freshState().lists[0]);
  s.tasks.forEach((t) => {
    t.tags = t.tags || []; t.subtasks = t.subtasks || []; t.priority = t.priority || 0;
    if (t.remind != null && !t.rem && typeof remFromOffset === 'function') {
      t.rem = t.time ? remFromOffset(t.time, t.remind) : null;
      // converted reminders that are already over stay quiet
      if (t.rem) remStamps(t).forEach((x) => { if (x.at <= Date.now()) s.meta.notified[t.id + '@' + x.at] = Date.now(); });
    }
    delete t.remind;
    if (!t.listId || !s.lists.find((l) => l.id === t.listId)) t.listId = 'inbox';
  });
  s.habits.forEach((h) => { h.log = h.log || {}; h.target = h.target || 1; h.days = h.days || [0, 1, 2, 3, 4, 5, 6]; });
  return s;
}

let state = freshState();
let prefs = { tab: 'today', calMode: 'list' };

function loadLocal() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) { state = migrate(JSON.parse(raw)); return true; }
  } catch (e) { console.warn('load failed', e); }
  return false;
}
function loadPrefs() {
  try { Object.assign(prefs, JSON.parse(localStorage.getItem(PREFS_KEY) || '{}')); } catch (e) { /* no storage */ }
}
function savePrefs() {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (e) { /* no storage */ }
}
let saveTimer = null;
function saveLocalNow() {
  clearTimeout(saveTimer); saveTimer = null;
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { console.warn('save failed', e); }
}
function persist() {
  state.meta.updatedAt = Date.now();
  state.meta.touched = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveLocalNow, 250);
  Sync.schedule();
}

/* Mutations go through commit(): persist + re-render. */
function commit(opts = {}) {
  persist();
  if (opts.render !== false) render();
}

/* ---------- undo ---------- */
let undoSnap = null;
function snap() { undoSnap = JSON.stringify(state); }
function undo() {
  if (!undoSnap) return;
  state = migrate(JSON.parse(undoSnap));
  undoSnap = null;
  hideToast();
  commit();
}

/* ---------- cloud sync (only inside claude.ai, private per person) ---------- */
const Sync = {
  col: null, on: false, remoteAt: 0, prevN: 0, busy: false, again: false, timer: null,
  async init() {
    try {
      if (!window.claude || typeof window.claude.use !== 'function') return;
      const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
      if (!db || !user) return;
      const id = await user.id();
      if (!id) return;
      this.col = db.collection('data/users/' + id);
      await this.pull(true);
      this.on = true;
      if (state.meta.touched && state.meta.updatedAt > this.remoteAt) this.schedule(200);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') this.pull(false).catch(() => {});
      });
      render();
    } catch (e) { console.warn('cloud sync unavailable', e); this.on = false; }
  },
  async pull(initial) {
    if (!this.col) return;
    const m = await this.col.doc('meta').get();
    if (!m.exists) return;
    const d = m.data() || {};
    this.prevN = d.n || 0;
    const at = d.updatedAt || 0;
    if (!initial && at === this.remoteAt) return;
    const localWins = state.meta.touched && state.meta.updatedAt >= at;
    if (localWins) { this.remoteAt = at; if (state.meta.updatedAt > at) this.schedule(200); return; }
    const parts = [];
    for (let i = 0; i < d.n; i++) {
      const c = await this.col.doc('c' + i).get();
      const cd = c.exists ? c.data() : null;
      if (!cd || cd.w !== d.w) return; // half-written; try next time
      parts.push(cd.s);
    }
    try {
      const remote = migrate(JSON.parse(parts.join('')));
      remote.meta.updatedAt = at;
      remote.meta.touched = true;
      state = remote;
      this.remoteAt = at;
      saveLocalNow();
      applyTheme();
      render();
    } catch (e) { console.warn('bad remote data', e); }
  },
  schedule(ms = 1500) {
    if (!this.col) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.push(), ms);
  },
  async push() {
    if (!this.col) return;
    if (this.busy) { this.again = true; return; }
    this.busy = true;
    try {
      const at = state.meta.updatedAt;
      const s = JSON.stringify(state);
      const SZ = 60000, w = uid();
      const n = Math.max(1, Math.ceil(s.length / SZ));
      for (let i = 0; i < n; i++) await this.col.doc('c' + i).set({ s: s.slice(i * SZ, (i + 1) * SZ), w });
      await this.col.doc('meta').set({ n, w, updatedAt: at });
      for (let i = n; i < this.prevN; i++) await this.col.doc('c' + i).delete();
      this.prevN = n;
      this.remoteAt = at;
    } catch (e) {
      console.warn('sync push failed', e);
      if (e && e.code === 'quota_exceeded') toast('Облако переполнено: сделайте резервную копию в «Ещё → Данные»');
    } finally {
      this.busy = false;
      if (this.again) { this.again = false; this.schedule(500); }
    }
  },
};

/* ---------- lookups ---------- */
const listById = (id) => state.lists.find((l) => l.id === id) || state.lists[0];
const taskById = (id) => state.tasks.find((t) => t.id === id);
const habitById = (id) => state.habits.find((h) => h.id === id);
const userLists = () => state.lists.filter((l) => !l.builtin && !l.archived);
function allTags() {
  const m = new Map();
  state.tasks.forEach((t) => { if (!t.done) t.tags.forEach((g) => m.set(g, (m.get(g) || 0) + 1)); });
  state.tasks.forEach((t) => { if (t.done) t.tags.forEach((g) => { if (!m.has(g)) m.set(g, 0); }); });
  return Array.from(m.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ru'));
}

/* ---------- toast ---------- */
let toastTimer = null;
function toast(msg, withUndo = false) {
  const root = $('#toast-root');
  if (!root) return;
  root.innerHTML = `<div class="toast" role="status"><span>${esc(msg)}</span>${withUndo ? '<button data-act="undo">Отменить</button>' : ''}</div>`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, withUndo ? 5000 : 2600);
}
function hideToast() { const r = $('#toast-root'); if (r) r.innerHTML = ''; }

/* ---------- theme ---------- */
function applyTheme() {
  const t = state.settings.theme, root = document.documentElement;
  if (t === 'light' || t === 'dark') { root.setAttribute('data-theme', t); root.dataset.appTheme = '1'; }
  else if (root.dataset.appTheme) { root.removeAttribute('data-theme'); delete root.dataset.appTheme; }
}

/* ---------- environment ---------- */
const IS_PWA = document.documentElement.classList.contains('pwa');
const IS_STANDALONE = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;

/* Save a generated file: claude.ai downloads capability, Web Share (iOS), or a plain download link. */
async function saveFile(filename, text, mime) {
  try {
    if (window.claude && typeof window.claude.use === 'function') {
      const dl = await Promise.race([window.claude.use('downloads'), new Promise((r) => setTimeout(() => r(null), 1500))]);
      if (dl) {
        try { await dl.save({ filename, data: text }); return true; }
        catch (e) { if (e && e.code === 'declined') return false; if (e && e.code === 'rejected_extension') { toast('Этот формат здесь недоступен — откройте установленную версию'); return false; } }
      }
    }
  } catch (e) { /* fall through */ }
  const blob = new Blob([text], { type: mime });
  try {
    const file = new File([blob], filename, { type: mime });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: filename }); return true; }
  } catch (e) { if (e && e.name === 'AbortError') return false; }
  try {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    return true;
  } catch (e) { toast('Не удалось сохранить файл'); return false; }
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('Скопировано'); return true; }
  catch (e) {
    const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (er) { ok = false; }
    ta.remove(); toast(ok ? 'Скопировано' : 'Не удалось скопировать'); return ok;
  }
}
async function shareText(title, text) {
  try { if (navigator.share) { await navigator.share({ title, text }); return; } }
  catch (e) { if (e && e.name === 'AbortError') return; }
  copyText(text);
}
