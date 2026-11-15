'use strict';
/* ===== Main: actions, input handling, swipes, focus timer, reminders, start-up ===== */

/* ---------- Focus timer ---------- */
const FOCUS_KEY = 'planirovk.focus';
let audioCtx = null;
const Focus = {
  mode: 'focus', running: false, endAt: 0, left: null, taskId: null, cycles: 0, timer: null, lock: null,
  len() { const s = state.settings; return this.mode === 'focus' ? s.focusLen : this.mode === 'short' ? s.shortBreak : s.longBreak; },
  remaining() { if (this.running) return Math.max(0, Math.round((this.endAt - Date.now()) / 1000)); return this.left != null ? this.left : this.len() * 60; },
  fmt(sec) { return pad(Math.floor(sec / 60)) + ':' + pad(sec % 60); },
  save() { try { localStorage.setItem(FOCUS_KEY, JSON.stringify({ mode: this.mode, running: this.running, endAt: this.endAt, left: this.left, taskId: this.taskId, cycles: this.cycles, day: todayKey() })); } catch (e) { /* no storage */ } },
  load() {
    try {
      const d = JSON.parse(localStorage.getItem(FOCUS_KEY) || 'null'); if (!d) return;
      Object.assign(this, { mode: d.mode, running: d.running, endAt: d.endAt, left: d.left, taskId: d.taskId, cycles: d.day === todayKey() ? d.cycles : 0 });
      if (this.running) { if (Date.now() >= this.endAt) this.finish(true, true); else this.loop(); }
    } catch (e) { /* ignore */ }
  },
  start() {
    this.endAt = Date.now() + this.remaining() * 1000; this.left = null; this.running = true; this.save(); this.loop();
    try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then((l) => { this.lock = l; }).catch(() => {}); } catch (e) { /* optional */ }
    try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); } catch (e) { audioCtx = null; }
  },
  pause() { this.left = this.remaining(); this.running = false; this.release(); this.save(); },
  reset() { this.running = false; this.left = null; this.release(); this.save(); },
  release() { clearInterval(this.timer); try { if (this.lock) this.lock.release(); } catch (e) { /* ignore */ } this.lock = null; },
  setMode(m) { this.mode = m; this.reset(); },
  finish(log, silent) {
    const wasFocus = this.mode === 'focus';
    if (wasFocus && log) {
      const m = this.len(), tk = todayKey();
      state.focus.log[tk] = (state.focus.log[tk] || 0) + m;
      state.focus.count[tk] = (state.focus.count[tk] || 0) + 1;
      const t = this.taskId && taskById(this.taskId); if (t) t.focusMin = (t.focusMin || 0) + m;
      this.cycles++;
      persist();
    }
    if (log && !silent) {
      beep();
      notify(wasFocus ? 'Фокус завершён' : 'Перерыв окончен', wasFocus ? 'Время сделать перерыв' : 'Можно продолжать');
    }
    this.mode = wasFocus ? (this.cycles % state.settings.longEvery === 0 ? 'long' : 'short') : 'focus';
    this.running = false; this.left = null; this.release();
    if (state.settings.autoNext && !silent) this.start();
    this.save();
    if (curView().v === 'focus') render(); else if (log && !silent) toast(wasFocus ? 'Фокус завершён — время перерыва' : 'Перерыв окончен');
  },
  loop() { clearInterval(this.timer); this.timer = setInterval(() => this.tick(), 1000); },
  tick() {
    if (!this.running) { clearInterval(this.timer); return; }
    const r = this.remaining();
    const el = $('#f-time'); if (el) el.textContent = this.fmt(r);
    const arc = $('#f-arc'); if (arc) arc.style.strokeDashoffset = arc.dataset.c * (1 - r / (this.len() * 60));
    if (r <= 0) this.finish(true);
  },
};
/* iPhone only lets a page play sound after a tap, so the audio engine is unlocked on the first touch. */
function unlockAudio() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state !== 'running') {
      audioCtx.resume();
      const b = audioCtx.createBuffer(1, 1, 22050), src = audioCtx.createBufferSource();
      src.buffer = b; src.connect(audioCtx.destination); src.start(0);
    }
  } catch (e) { audioCtx = null; }
}
function beep(loud) {
  if (!state.settings.sound || !audioCtx) return;
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t0 = audioCtx.currentTime;
    (loud ? [0, 0.25, 0.5, 1.1, 1.35, 1.6] : [0, 0.25, 0.5]).forEach((d, i) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = i % 3 === 2 ? 1046 : 784; o.type = 'sine';
      g.gain.setValueAtTime(0.0001, t0 + d); g.gain.exponentialRampToValueAtTime(0.25, t0 + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.22);
      o.connect(g).connect(audioCtx.destination); o.start(t0 + d); o.stop(t0 + d + 0.25);
    });
  } catch (e) { /* no sound */ }
}
function notify(title, body) {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    if (navigator.serviceWorker && navigator.serviceWorker.controller) navigator.serviceWorker.ready.then((r) => r.showNotification(title, { body, icon: 'icons/icon-192.png' }));
    else new Notification(title, { body });
  } catch (e) { /* ignore */ }
}
function checkReminders() {
  pruneNotified();
  const due = dueReminders();
  if (!due.length) return;
  due.forEach(({ t, info, keys }) => {
    keys.forEach((k) => { state.meta.notified[k] = Date.now(); });
    if (info.snooze) t.snoozeAt = null;
    notify('Напоминание', t.title + (t.time ? ` — начало в ${t.time}` : ''));
  });
  persist();
  beep(true);
  ui.remQueue = (ui.remQueue || []).filter((q) => !due.some((d) => d.t.id === q.id)).concat(due.map((d) => ({ id: d.t.id, info: d.info })));
  if (!ui.sheet) showNextReminder();
  else if (ui.sheet.type !== 'remind') toast(`Напоминание: ${due[0].t.title}`);
}
function showNextReminder() {
  const q = (ui.remQueue || []).shift();
  if (q && taskById(q.id)) openSheet({ type: 'remind', id: q.id, info: q.info, onClose: showNextReminder });
}

/* The iPhone "Add to Calendar" screen cannot be opened from a home-screen app, so the .ics file goes
   through the system share sheet (Save to Files, then tap the file in Files). */
function addToCalendar(tasks, name, back) {
  const arr = tasks.filter((t) => t.date);
  if (!arr.length) { toast('Сначала укажите дату'); return; }
  openSheet({ type: 'cal-add', ids: arr.map((t) => t.id), name: name || arr[0].title, onClose: back });
}
async function shareIcs(ics, name) {
  const fname = (name || 'planirovk').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 40) + '.ics';
  // Safari only shares a few file types, so a plain-text type with the .ics name is the fallback
  for (const type of ['text/calendar', 'text/plain']) {
    let file; try { file = new File([ics], fname, { type }); } catch (e) { return 'unsupported'; }
    if (!(navigator.canShare && navigator.canShare({ files: [file] }))) continue;
    try { await navigator.share({ files: [file], title: name }); return 'shared'; }
    catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
  }
  return 'unsupported';
}

/* ---------- actions ---------- */
const ds = (el) => el.dataset;
function afterToggle(t, res) {
  if (res === 'done') toast(listById(t.listId).type === 'shopping' ? 'В корзине' : 'Выполнено', true);
  else if (res === 'repeat') toast(`Готово. Следующий раз: ${fmtDay(t.date).toLowerCase()}`, true);
}
function postpone(t) {
  const tk = todayKey();
  t.date = !t.date || t.date <= tk ? addDays(tk, 1) : addDays(t.date, 1);
  delete state.meta.notified[t.id];
}
function selIds() { return Array.from(ui.sel || []); }
function applyToSel(fn, msg) {
  snap(); selIds().forEach((id) => { const t = taskById(id); if (t) fn(t); });
  const n = ui.sel.size; ui.sel = null; commit(); toast(`${msg}: ${n}`, true);
}

const ACTS = {
  tab: (el) => switchTab(ds(el).tab),
  back: () => back(),
  go: (el) => { const d = ds(el); const v = { v: d.v }; if (d.sid) v.sid = d.sid; if (d.tag) v.tag = d.tag; if (d.id) v.id = d.id; go(v); },
  'go-habit': (el) => { ui.tab = 'habits'; ui.stack.habits = [{ v: 'habit', id: ds(el).id }]; render(true); },
  'open-list': (el) => go({ v: 'list', id: ds(el).id }),
  'quick-add': (el) => { const x = {}; if (ds(el).date) x.date = ds(el).date; if (ds(el).time) x.time = ds(el).time; openQuickAdd(x); },
  undo: () => undo(),
  toggle: (el) => {
    const id = ds(el).id;
    if (ui.sel) { ACTS.open(el); return; }
    const t = taskById(id); if (!t) return;
    snap(); el.classList.add('pop', 'on');
    const res = toggleDone(t);
    setTimeout(() => { commit(); if (ui.sheet && ui.sheet.type === 'task') rerenderSheet(); afterToggle(t, res); }, 160);
  },
  open: (el) => {
    const id = ds(el).id;
    if (ui.sel) { ui.sel.has(id) ? ui.sel.delete(id) : ui.sel.add(id); render(); return; }
    openTask(id);
  },
  'move-overdue': () => { snap(); const tk = todayKey(); const arr = overdueTasks(); arr.forEach((t) => { t.date = tk; }); commit(); toast(`Перенесено на сегодня: ${arr.length}`, true); },
  'plan-day': () => openSheet({ type: 'plan', orig: {} }),
  'plan-add': (el) => {
    const t = taskById(ds(el).id), s = ui.sheet, tk = todayKey(); if (!t) return;
    if (t.date === tk && s.orig && ds(el).id in s.orig) { t.date = s.orig[t.id]; delete s.orig[t.id]; }
    else { s.orig[t.id] = t.date; t.date = tk; }
    commit(); rerenderSheet();
  },
  'remove-examples': () => confirmSheet('Удалить примеры задач и привычек? Ваши собственные записи и списки останутся.', 'Удалить примеры', () => { snap(); removeExamples(); commit(); toast('Примеры удалены', true); }),
  'toggle-done': (el) => { const k = ds(el).key; ui.showDone[k] = !ui.showDone[k]; render(); },

  /* habits */
  'habit-tick': (el) => { const h = habitById(ds(el).id); if (!h) return; const v = habitTick(h, todayKey(), 'toggle'); commit(); if (v >= h.target) toast(`${h.name}: отмечено`); },
  'habit-minus': (el) => { const h = habitById(ds(el).id); if (!h) return; habitTick(h, todayKey(), -1); commit(); },
  'habit-day': (el) => {
    const h = habitById(ds(el).id), k = ds(el).k; if (!h || !k || k > todayKey()) return;
    if (hVal(h, k) >= h.target) delete h.log[k]; else h.log[k] = h.target;
    commit();
  },
  'habit-idea': (el) => {
    const [name, target, unit, color] = HABIT_IDEAS[+ds(el).i];
    state.habits.push(newHabit({ name, target, unit, color, order: Date.now() })); commit(); toast(`Добавлено: ${name}`);
  },
  'habit-new': () => openHabitEdit(null),
  'habit-edit': (el) => openHabitEdit(ds(el).id),
  'habit-archive': (el) => { const h = habitById(ds(el).id); h.archived = !h.archived; commit(); toast(h.archived ? 'Перенесено в архив' : 'Привычка снова активна'); },
  'habit-delete': (el) => { const id = ds(el).id; confirmSheet('Удалить привычку вместе со всей историей отметок?', 'Удалить', () => { snap(); state.habits = state.habits.filter((h) => h.id !== id); ui.stack[ui.tab].pop(); commit(); toast('Привычка удалена', true); }); },
  'habit-month': (el) => { curView().m = ds(el).m; render(); },
  'hab-mode': (el) => { const d = ui.sheet.draft, v = ds(el).v; if (v === 'daily') { d.days = [0, 1, 2, 3, 4, 5, 6]; d.perWeek = 0; } else if (v === 'days') { d.perWeek = 0; if (d.days.length === 7) d.days = [1, 3, 5]; } else { d.perWeek = d.perWeek || 3; } rerenderSheet(); },
  'hab-day': (el) => { const d = ui.sheet.draft, x = +ds(el).d; d.days = d.days.includes(x) ? d.days.filter((y) => y !== x) : d.days.concat(x); if (!d.days.length) d.days = [x]; rerenderSheet(); },
  'hab-per': (el) => { ui.sheet.draft.perWeek = +ds(el).n; rerenderSheet(); },
  'hab-target': (el) => { const d = ui.sheet.draft; d.target = clamp(d.target + +ds(el).d, 1, 50); rerenderSheet(); },
  'hab-color': (el) => { ui.sheet.draft.color = ds(el).v; rerenderSheet(); },
  'habit-save': () => {
    const s = ui.sheet, d = s.draft; if (!d.name.trim()) return;
    const fields = { name: d.name.trim(), color: d.color, days: d.days, perWeek: d.perWeek, target: d.target, unit: d.unit.trim() };
    if (s.id) Object.assign(habitById(s.id), fields); else state.habits.push(newHabit(Object.assign(fields, { order: Date.now() })));
    closeSheet(); commit(); toast(s.id ? 'Сохранено' : 'Привычка добавлена');
  },

  /* lists */
  'new-list': (el) => openListEdit(null, ds(el).type || 'tasks'),
  'list-type': (el) => { ui.sheet.draft.type = ds(el).v; if (ds(el).v === 'shopping' && ui.sheet.draft.emoji === '📌') ui.sheet.draft.emoji = '🛒'; rerenderSheet(); },
  'list-color': (el) => { ui.sheet.draft.color = ds(el).v; rerenderSheet(); },
  'list-emoji': (el) => { ui.sheet.draft.emoji = ds(el).v; rerenderSheet(); },
  'list-save': () => {
    const s = ui.sheet, d = s.draft; if (!d.name.trim()) return;
    if (s.id) { const l = listById(s.id); Object.assign(l, { name: d.name.trim(), color: d.color, emoji: d.emoji, type: d.type }); if (d.type === 'shopping') state.tasks.forEach((t) => { if (t.listId === l.id && !t.cat) t.cat = categorize(t.title); }); closeSheet(); commit(); return; }
    const l = { id: uid(), name: d.name.trim(), color: d.color, emoji: d.emoji, type: d.type, sort: 'manual', created: Date.now() };
    state.lists.push(l); closeSheet(); persist(); go({ v: 'list', id: l.id });
  },
  'list-menu': (el) => openSheet({ type: 'list-menu', id: ds(el).id }),
  'list-sort': (el) => { listById(ui.sheet.id).sort = ds(el).v; commit(); rerenderSheet(); },
  'list-edit': (el) => openListEdit(ds(el).id),
  'list-share': (el) => { const l = listById(ds(el).id); shareText(l.name, listAsText(l)); },
  'list-copy': (el) => copyText(listAsText(listById(ds(el).id))),
  'list-tpl': (el) => {
    const l = listById(ds(el).id);
    const items = state.tasks.filter((t) => t.listId === l.id && !t.fromRepeat).sort((a, b) => (a.order || a.created) - (b.order || b.created)).map(tplItemFromTask);
    if (!items.length) { toast('В списке нет пунктов'); return; }
    state.templates.push({ id: uid(), name: l.name, emoji: l.emoji, color: l.color, type: l.type, items });
    closeSheet(); commit(); toast('Шаблон сохранён: «Ещё → Шаблоны»');
  },
  'list-ics': (el) => { const l = listById(ds(el).id); const arr = state.tasks.filter((t) => t.listId === l.id && !t.done && t.date); if (!arr.length) { toast('В списке нет задач с датой'); return; } addToCalendar(arr, l.name); },
  'list-clear-done': (el) => { const id = ds(el).id; snap(); const n = state.tasks.filter((t) => t.listId === id && t.done).length; state.tasks = state.tasks.filter((t) => !(t.listId === id && t.done)); closeSheet(); commit(); toast(`Удалено выполненных: ${n}`, true); },
  'list-del': (el) => {
    const id = ds(el).id, l = listById(id), n = state.tasks.filter((t) => t.listId === id).length;
    confirmSheet(`Удалить список «${esc(l.name)}»${n ? ` и ${pl(n, W_TASK)} в нём` : ''}?`, 'Удалить', () => {
      snap(); state.tasks = state.tasks.filter((t) => t.listId !== id); state.lists = state.lists.filter((x) => x.id !== id);
      if (state.settings.defaultList === id) state.settings.defaultList = 'inbox';
      ui.stack[ui.tab] = ui.stack[ui.tab].filter((v) => !(v.v === 'list' && v.id === id)); commit(); toast('Список удалён', true);
    });
  },
  'shop-add': (el) => { addFromText(ds(el).name, { listId: ds(el).id }); commit(); toast(`Добавлено: ${ds(el).name}`); },
  'shop-reset': (el) => { snap(); state.tasks.forEach((t) => { if (t.listId === ds(el).id && t.done) { t.done = false; t.doneAt = null; t.doneDay = null; } }); commit(); toast('Отметки сняты', true); },
  'shop-clear': (el) => { snap(); state.tasks = state.tasks.filter((t) => !(t.listId === ds(el).id && t.done)); commit(); toast('Купленное убрано', true); },

  /* selection */
  'sel-start': () => { ui.sel = new Set(); render(); },
  'sel-exit': () => { ui.sel = null; render(); },
  'sel-all': () => { visibleTaskIds().forEach((id) => { const t = taskById(id); if (t && !t.done) ui.sel.add(id); }); render(); },
  'sel-do': (el) => {
    const op = ds(el).op, tk = todayKey();
    if (!ui.sel || !ui.sel.size) return;
    if (op === 'today') applyToSel((t) => { t.date = tk; }, 'На сегодня');
    else if (op === 'tomorrow') applyToSel((t) => { t.date = addDays(tk, 1); }, 'На завтра');
    else if (op === 'done') applyToSel((t) => { if (!t.done) toggleDone(t); }, 'Выполнено');
    else if (op === 'delete') { const ids = new Set(ui.sel); snap(); state.tasks = state.tasks.filter((t) => !ids.has(t.id)); ui.sel = null; commit(); toast(`Удалено: ${ids.size}`, true); }
    else if (op === 'move') openSheet({ type: 'pick-list' });
    else if (op === 'prio') openSheet({ type: 'pick-prio' });
    else if (op === 'tpl') openSheet({ type: 'tpl-pick', ids: selIds() });
  },
  'pick-list': (el) => { const id = ds(el).id, l = listById(id); closeSheet(); applyToSel((t) => { t.listId = id; if (l.type === 'shopping' && !t.cat) t.cat = categorize(t.title); }, `В «${l.name}»`); },
  'pick-prio': (el) => { const p = +ds(el).p; closeSheet(); applyToSel((t) => { t.priority = p; }, `Приоритет «${PRIO[p].name}»`); },

  /* calendar */
  'cal-day': (el) => { ui.calSel = ds(el).k; ui.calMonth = ui.calSel.slice(0, 7); render(); },
  'cal-nav': (el) => { ui.calMonth = addMonths(ui.calMonth + '-01', +ds(el).d).slice(0, 7); render(); },
  'cal-today': () => { ui.calSel = todayKey(); ui.calMonth = ui.calSel.slice(0, 7); render(); },
  'cal-mode': (el) => { prefs.calMode = ds(el).m; savePrefs(); render(); },

  /* focus */
  'focus-mode': (el) => { Focus.setMode(ds(el).m); render(); },
  'focus-toggle': () => { Focus.running ? Focus.pause() : Focus.start(); render(); },
  'focus-reset': () => { Focus.reset(); render(); },
  'focus-skip': () => { Focus.finish(false); render(); },
  'focus-pick': (el, e) => { if (e.target.closest('[data-act="focus-clear"]')) return; openSheet({ type: 'pick-task' }); },
  'focus-clear': () => { Focus.taskId = null; Focus.save(); render(); },
  'focus-done': () => { const t = taskById(Focus.taskId); if (t) { snap(); const r = toggleDone(t); if (r !== 'repeat') Focus.taskId = null; Focus.save(); commit(); afterToggle(t, r); } },
  'pick-task': (el) => { Focus.taskId = ds(el).id; Focus.save(); closeSheet(); },
  'task-focus': (el) => { Focus.taskId = ds(el).id; if (Focus.mode !== 'focus' && !Focus.running) Focus.setMode('focus'); Focus.save(); ui.sheet = null; renderSheet(); ui.tab = 'more'; ui.stack.more = [{ v: 'focus' }]; render(true); },

  /* stats */
  'bar-tip': (el) => { const tip = $('#tip-' + ds(el).chart); if (tip) tip.textContent = ds(el).tip; $$(`#${ds(el).chart} .bar`).forEach((b) => b.classList.toggle('hl', b === el)); },

  /* settings & data */
  'set-theme': (el) => { state.settings.theme = ds(el).v; applyTheme(); commit(); },
  'set-week': (el) => { state.settings.weekStart = +ds(el).v; commit(); },
  'set-toggle': (el) => { const k = ds(el).k; state.settings[k] = !state.settings[k]; commit(); },
  'notify-perm': () => { try { Notification.requestPermission().then(() => render()); } catch (e) { toast('Уведомления недоступны'); } },
  'export-json': () => saveFile(`planirovk-${todayKey()}.json`, JSON.stringify(state, null, 1), 'application/json').then((ok) => { if (ok) toast('Копия сохранена'); }),
  'copy-all': () => copyText(state.lists.map(listAsText).join('\n\n')),
  'export-ics': () => { const arr = active().filter((t) => t.date && listById(t.listId).type !== 'shopping'); if (!arr.length) { toast('Нет задач с датой'); return; } addToCalendar(arr, 'planirovk'); },
  'reset-all': () => confirmSheet('Удалить <b>все</b> задачи, списки, привычки и статистику? Это нельзя отменить — сначала сохраните копию.', 'Удалить всё', () => {
    const keep = state.settings; state = freshState(); state.settings = keep; state.meta.hideExampleBanner = true; ui.stack = { today: [], lists: [], cal: [], habits: [], more: [] }; commit(); toast('Все данные удалены');
  }),

  /* sheets */
  'sheet-close': () => closeSheet(),
  'confirm-ok': () => { const fn = ui.sheet.onOk; ui.sheet = null; renderSheet(); fn(); },
  'tpl-use': (el) => openSheet({ type: 'tpl-apply', id: ds(el).id }),
  'tpl-apply-new': () => applyTemplate(null),
  'tpl-apply-list': () => { const sel = $('#tpl-target'); applyTemplate(sel ? sel.value : null); },
  'task-tpl': (el) => openSheet({ type: 'tpl-pick', ids: [ds(el).id], onClose: (() => { const id = ds(el).id; return () => { if (taskById(id)) openTask(id); }; })() }),
  'tpl-add': (el) => {
    const tpl = state.templates.find((t) => t.id === ds(el).id), s = ui.sheet; if (!tpl || !s) return;
    const n = addTasksToTemplate(tpl, s.ids.map(taskById).filter(Boolean));
    if (ui.sel) ui.sel = null;
    closeSheet(); commit();
    toast(n ? `Добавлено в «${tpl.name}»: ${n}` : `Уже есть в «${tpl.name}»`);
  },
  'tpl-new': () => {
    const s = ui.sheet; if (!s) return;
    const inp = $('#tpl-new-name'), name = (inp ? inp.value : '').trim();
    if (!name) { toast('Напишите название шаблона'); if (inp) inp.focus(); return; }
    const tasks = s.ids.map(taskById).filter(Boolean), l = tasks[0] ? listById(tasks[0].listId) : null;
    const tpl = { id: uid(), name, emoji: l && l.id !== 'inbox' ? l.emoji : '📋', color: l && l.id !== 'inbox' ? l.color : LIST_COLORS[0], type: l ? l.type : 'tasks', items: [] };
    addTasksToTemplate(tpl, tasks); state.templates.push(tpl);
    if (ui.sel) ui.sel = null;
    closeSheet(); commit(); toast(`Шаблон «${name}» создан: «Ещё → Шаблоны»`);
  },
  'tpl-item-del': (el) => { const tpl = state.templates.find((t) => t.id === ds(el).id); if (!tpl) return; snap(); const it = tpl.items.splice(+ds(el).i, 1)[0]; commit(); toast(`Убрано: ${tplItemTitle(it)}`, true); },
  'tpl-del': (el) => { const id = ds(el).id, tpl = state.templates.find((t) => t.id === id); confirmSheet(`Удалить шаблон «${esc(tpl.name)}»? Задачи в списках останутся.`, 'Удалить', () => { snap(); state.templates = state.templates.filter((t) => t.id !== id); ui.stack[ui.tab] = ui.stack[ui.tab].filter((v) => !(v.v === 'tpl' && v.id === id)); commit(); toast('Шаблон удалён', true); }); },
  'tpl-create': () => { const tpl = { id: uid(), name: 'Новый шаблон', emoji: '📋', color: LIST_COLORS[0], type: 'tasks', items: [] }; state.templates.push(tpl); persist(); go({ v: 'tpl', id: tpl.id }); },
  'stat-period': (el) => { prefs.statPeriod = ds(el).p; savePrefs(); render(); },
  'qa-submit': () => qaSubmit(),
  'qa-date': (el) => { const c = ui.sheet.ctx; c.date = c.date === ds(el).k ? null : ds(el).k; refreshQaTools(); },
  'qa-prio': () => { const c = ui.sheet.ctx; c.priority = [3, 0, 1, 2][c.priority || 0]; refreshQaTools(); },
  'qa-clear-date': () => { const c = ui.sheet.ctx; c.date = null; c.time = null; refreshQaTools(); },
  'qa-more': () => {
    const s = ui.sheet; if (!(s.text || '').trim()) { toast('Сначала напишите название'); return; }
    const made = addFromText(s.text.split('\n')[0], s.ctx); commit(); openTask(made[0].id);
  },
  'ed-date': (el) => { editTask('date', ds(el).k); commit(); rerenderSheet(); },
  'ed-clear-time': () => { editTask('time', ''); commit(); rerenderSheet(); },
  'rem-mode': (el) => {
    const t = taskById(ui.sheet.id), m = ds(el).m, r = t.rem;
    if (m === 'none') { t.rem = null; t.snoozeAt = null; }
    else {
      if (!t.date) t.date = todayKey();
      const nextHour = minToTime(Math.min(23 * 60, (Math.floor(nowMin() / 60) + 1) * 60));
      const from = (r && r.from) || t.time || (m === 'many' ? '09:00' : nextHour);
      t.rem = m === 'once' ? { from, to: from, count: 1, off: r ? r.off || 0 : 0 }
        : { from, to: r && r.count > 1 ? r.to : minToTime(Math.min(timeToMin(from) + 360, 23 * 60 + 30)), count: r && r.count > 1 ? r.count : 3, off: r ? r.off || 0 : 0 };
      markPastNotified(t);
    }
    commit(); rerenderSheet();
  },
  'rem-count': (el) => { const t = taskById(ui.sheet.id); t.rem.count = clamp(t.rem.count + +ds(el).d, 2, 12); markPastNotified(t); commit(); rerenderSheet(); },
  'rem-cal': (el) => { const t = taskById(ds(el).id); addToCalendar([t], t.title, () => openTask(t.id)); },
  'cal-send': async () => {
    const sh = ui.sheet; if (!sh || sh.type !== 'cal-add') return;
    const tasks = sh.ids.map(taskById).filter(Boolean), ics = buildICS(tasks);
    const r = await shareIcs(ics, sh.name);
    if (r === 'unsupported') { toast('Окно «Поделиться» недоступно — скачиваю файл'); saveFile((sh.name || 'planirovk').slice(0, 40) + '.ics', ics, 'text/calendar'); }
  },
  'cal-file': () => { const sh = ui.sheet; if (!sh) return; const tasks = sh.ids.map(taskById).filter(Boolean); saveFile((sh.name || 'planirovk').slice(0, 40) + '.ics', buildICS(tasks), 'text/calendar'); },
  'rem-done': (el) => { const t = taskById(ds(el).id); if (!t) return; snap(); const r = toggleDone(t); closeSheet(); commit(); afterToggle(t, r); },
  'rem-snooze': (el) => {
    const t = taskById(ds(el).id); if (!t) return;
    t.snoozeAt = Date.now() + +ds(el).min * 60000; persist(); closeSheet();
    const d = new Date(t.snoozeAt); toast(`Напомню в ${pad(d.getHours())}:${pad(d.getMinutes())}`);
  },
  'rem-open': (el) => { const id = ds(el).id; ui.sheet = null; openTask(id); },
  'ed-prio': (el) => { editTask('priority', +ds(el).p); commit(); rerenderSheet(); },
  'ed-repday': (el) => { const t = taskById(ui.sheet.id), d = +ds(el).d; const days = t.repeat.days || []; t.repeat.days = days.includes(d) ? days.filter((x) => x !== d) : days.concat(d); if (t.repeat.days.length && t.date && !t.repeat.days.includes(wdOf(t.date))) t.date = firstDate(t.repeat, todayKey()); commit(); rerenderSheet(); },
  'sub-toggle': (el) => { const t = taskById(ui.sheet.id), st = t.subtasks.find((x) => x.id === ds(el).sid); st.done = !st.done; commit(); rerenderSheet(); if (t.subtasks.every((x) => x.done) && !t.done) toast('Все шаги готовы — отметьте задачу'); },
  'sub-del': (el) => { const t = taskById(ui.sheet.id); t.subtasks = t.subtasks.filter((x) => x.id !== ds(el).sid); commit(); rerenderSheet(); },
  'tag-del': (el) => { const t = taskById(ui.sheet.id); t.tags = t.tags.filter((g) => g !== ds(el).tag); commit(); rerenderSheet(); },
  'tag-add': (el) => { const t = taskById(ui.sheet.id); if (!t.tags.includes(ds(el).tag)) t.tags.push(ds(el).tag); commit(); rerenderSheet(); },
  'task-share': (el) => { const t = taskById(ds(el).id); shareText(t.title, [t.title, t.date ? fmtDay(t.date) + (t.time ? ', ' + t.time : '') : '', t.notes, ...t.subtasks.map((s) => (s.done ? '✓ ' : '☐ ') + s.title)].filter(Boolean).join('\n')); },
  'task-dup': (el) => { const t = taskById(ds(el).id); const c = Object.assign(clone(t), { id: uid(), created: Date.now(), order: Date.now(), done: false, doneAt: null, doneDay: null, focusMin: 0, example: false }); c.subtasks.forEach((s) => { s.id = uid(); }); state.tasks.push(c); commit(); ui.sheet.id = c.id; rerenderSheet(); toast('Создана копия'); },
  'task-del': (el) => { snap(); const id = ds(el).id; state.tasks = state.tasks.filter((t) => t.id !== id); ui.sheet = null; renderSheet(); commit(); toast('Задача удалена', true); },
};
function applyTemplate(targetId) {
  const s = ui.sheet; if (!s) return;
  const tpl = TEMPLATES.find((t) => t.id === s.id) || state.templates.find((t) => t.id === s.id); if (!tpl) return;
  snap();
  const l = createFromTemplate(tpl, targetId);
  ui.sheet = null; renderSheet(); persist();
  ui.tab = 'lists'; ui.stack.lists = [{ v: 'list', id: l.id }]; render(true);
  toast(targetId ? `Добавлено в «${l.name}»: ${tpl.items.length}` : 'Список создан', true);
}
function refreshQaTools() { const box = $('#qa-tools'); if (box && ui.sheet) box.innerHTML = qaTools(ui.sheet); }

/* ---------- event wiring ---------- */
let swipeBlockClick = false;
document.addEventListener('click', (e) => {
  if (swipeBlockClick) { swipeBlockClick = false; e.preventDefault(); return; }
  if (!audioCtx || audioCtx.state !== 'running') unlockAudio();
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled || !el.dataset.act) return;
  const fn = ACTS[el.dataset.act];
  if (fn) fn(el, e);
});
// keep the keyboard open while tapping quick-add chips
document.addEventListener('mousedown', (e) => { if (e.target.closest('#qa-tools button, .qa-send')) e.preventDefault(); });
document.addEventListener('touchend', (e) => {
  const b = e.target.closest('#qa-tools button, .qa-send');
  if (b && !b.disabled) { e.preventDefault(); const fn = ACTS[b.dataset.act]; if (fn) fn(b, e); }
}, { passive: false });

document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.id === 'qa-text' && ui.sheet) { ui.sheet.text = el.value; autoGrow(el); qaPreview(); return; }
  if (el.id === 'tpl-name') { const tpl = state.templates.find((t) => t.id === el.dataset.tpl); if (tpl && el.value.trim()) { tpl.name = el.value.trim(); persist(); } return; }
  if (el.id === 'q') { ui.q = el.value; const r = $('#results'); if (r) r.innerHTML = searchResults(ui.q); return; }
  if (el.dataset.tf && ui.sheet && ui.sheet.type === 'task' && (el.tagName === 'TEXTAREA' || el.type === 'text')) {
    const t = taskById(ui.sheet.id); if (!t) return;
    t[el.dataset.tf] = el.value; if (el.tagName === 'TEXTAREA') autoGrow(el); persist(); return;
  }
  if (el.dataset.sub && ui.sheet) { const t = taskById(ui.sheet.id); const st = t && t.subtasks.find((x) => x.id === el.dataset.sub); if (st) { st.title = el.value; persist(); } return; }
  if (el.dataset.lf && ui.sheet) { ui.sheet.draft[el.dataset.lf] = el.value; const b = $('[data-act="list-save"]'); if (b) { b.disabled = !el.value.trim(); b.style.opacity = el.value.trim() ? '' : '.4'; } return; }
  if (el.dataset.hf && ui.sheet) { ui.sheet.draft[el.dataset.hf] = el.value; const b = $('[data-act="habit-save"]'); if (b) { b.disabled = !ui.sheet.draft.name.trim(); b.style.opacity = ui.sheet.draft.name.trim() ? '' : '.4'; } }
});
document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.qa && ui.sheet) {
    const c = ui.sheet.ctx;
    if (el.dataset.qa === 'date') c.date = el.value || null;
    if (el.dataset.qa === 'time') { c.time = el.value || null; if (c.time && !c.date) c.date = todayKey(); }
    if (el.dataset.qa === 'list') { c.listId = el.value; renderSheet(false); return; }
    refreshQaTools(); return;
  }
  if (el.dataset.tf && ui.sheet && ui.sheet.type === 'task' && (el.tagName === 'SELECT' || el.type === 'date' || el.type === 'time')) {
    editTask(el.dataset.tf, el.value); commit(); rerenderSheet(); return;
  }
  if (el.dataset.rf && ui.sheet && ui.sheet.type === 'task') {
    const t = taskById(ui.sheet.id); if (!t || !t.rem) return;
    const f = el.dataset.rf;
    if (f === 'off') t.rem.off = +el.value;
    else if (el.value) { t.rem[f] = el.value; if (t.rem.count === 1) t.rem.to = t.rem.from; }
    markPastNotified(t); commit(); rerenderSheet(); return;
  }
  if (el.dataset.set) { const k = el.dataset.set, v = el.value; state.settings[k] = /^\d+$/.test(v) ? +v : v; commit(); return; }
  if (el.id === 'import-file' && el.files && el.files[0]) {
    const f = el.files[0], r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        if (!data || !Array.isArray(data.tasks) || !Array.isArray(data.lists)) throw new Error('format');
        confirmSheet(`В копии ${pl(data.tasks.length, W_TASK)} и ${pl(data.lists.length, ['список', 'списка', 'списков'])}. Заменить текущие данные?`, 'Восстановить', () => {
          snap(); state = migrate(data); applyTheme(); commit(); toast('Данные восстановлены', true);
        }, false);
      } catch (er) { toast('Это не файл копии планировщика'); }
      el.value = '';
    };
    r.readAsText(f);
  }
});
document.addEventListener('keydown', (e) => {
  const el = e.target;
  if (e.key !== 'Enter' && e.key !== ',') return;
  if (el.id === 'qa-text' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); qaSubmit(); return; }
  if (e.key === 'Enter' && el.dataset.tf === 'title') { e.preventDefault(); el.blur(); return; }
  if (el.id === 'sub-new' && e.key === 'Enter') {
    e.preventDefault(); const v = el.value.trim(); if (!v) return;
    const t = taskById(ui.sheet.id); t.subtasks.push({ id: uid(), title: v, done: false }); commit(); rerenderSheet();
    const ni = $('#sub-new'); if (ni) ni.focus(); return;
  }
  if (el.id === 'tag-new') {
    e.preventDefault(); const v = el.value.trim().replace(/^#/, '').toLowerCase().replace(/\s+/g, '-'); if (!v) return;
    const t = taskById(ui.sheet.id); if (!t.tags.includes(v)) t.tags.push(v); commit(); rerenderSheet();
    const ni = $('#tag-new'); if (ni) ni.focus(); return;
  }
  if (el.id === 'list-name' && e.key === 'Enter') { e.preventDefault(); ACTS['list-save'](); return; }
  if (el.id === 'habit-name' && e.key === 'Enter') { e.preventDefault(); ACTS['habit-save'](); }
});
document.addEventListener('keyup', (e) => { if (e.key === 'Escape' && ui.sheet) closeSheet(); });

/* ---------- swipe gestures ---------- */
let sw = null;
document.addEventListener('touchstart', (e) => {
  if (e.touches.length > 1) { sw = null; return; }
  const t = e.touches[0];
  const cal = e.target.closest('#cal');
  if (cal) { sw = { cal: true, x0: t.clientX, y0: t.clientY }; return; }
  if (ui.sel) return;
  const row = e.target.closest('.swipe');
  if (!row) { sw = null; return; }
  sw = { row, task: row.querySelector('.task'), x0: t.clientX, y0: t.clientY, dx: 0, on: false, dead: false };
}, { passive: true });
document.addEventListener('touchmove', (e) => {
  if (!sw || sw.dead || sw.cal) return;
  const t = e.touches[0], dx = t.clientX - sw.x0, dy = t.clientY - sw.y0;
  if (!sw.on) {
    if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { sw.dead = true; return; }
    if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.3) { sw.on = true; sw.task.classList.add('dragging'); } else return;
  }
  e.preventDefault();
  sw.dx = dx;
  const w = sw.row.offsetWidth, delAt = Math.max(170, w * 0.55);
  sw.task.style.transform = `translateX(${dx}px)`;
  sw.row.classList.toggle('sr', dx > 0); sw.row.classList.toggle('sl', dx < 0);
  const left = sw.row.querySelector('.swipe-bg.left'), del = dx < -delAt;
  if (left.classList.contains('del') !== del) { left.classList.toggle('del', del); left.querySelector('.lbl').textContent = del ? 'Удалить' : 'На завтра'; }
}, { passive: false });
document.addEventListener('touchend', (e) => {
  if (!sw) return;
  const s = sw; sw = null;
  if (s.cal) {
    const t = e.changedTouches[0], dx = t.clientX - s.x0, dy = t.clientY - s.y0;
    if (Math.abs(dx) > 60 && Math.abs(dy) < 50) { ui.calMonth = addMonths(ui.calMonth + '-01', dx < 0 ? 1 : -1).slice(0, 7); render(); }
    return;
  }
  if (!s.on) return;
  swipeBlockClick = true; setTimeout(() => { swipeBlockClick = false; }, 400);
  const id = s.row.dataset.id, task = taskById(id), w = s.row.offsetWidth, dx = s.dx;
  s.task.classList.remove('dragging');
  const finish = (fn) => { s.task.style.transform = `translateX(${dx > 0 ? w : -w}px)`; setTimeout(fn, 200); };
  if (!task) { s.task.style.transform = ''; return; }
  if (dx > 80) finish(() => { snap(); const r = toggleDone(task); commit(); afterToggle(task, r); if (r === 'undone') toast('Возвращено в работу', true); });
  else if (dx < -Math.max(170, w * 0.55)) finish(() => { snap(); state.tasks = state.tasks.filter((t) => t.id !== id); commit(); toast('Задача удалена', true); });
  else if (dx < -80) finish(() => { snap(); postpone(task); commit(); toast(`Перенесено: ${fmtDay(task.date).toLowerCase()}`, true); });
  else { s.task.style.transform = ''; setTimeout(() => s.row.classList.remove('sr', 'sl'), 220); }
});

/* ---------- offline readiness (installed version) ---------- */
const Offline = {
  ready: null,
  check(reg) {
    const sw = (reg && reg.active) || (navigator.serviceWorker && navigator.serviceWorker.controller);
    if (sw) sw.postMessage('offline-status');
    setTimeout(() => { const a = navigator.serviceWorker && navigator.serviceWorker.controller; if (Offline.ready !== true && a) a.postMessage('offline-status'); }, 4000);
  },
};

/* ---------- start-up ---------- */
let lastDay = null;
function init() {
  loadPrefs();
  ui.tab = TABS.some((t) => t[0] === prefs.tab) ? prefs.tab : 'today';
  if (!loadLocal()) { seedExamples(); state.meta.touched = false; saveLocalNow(); }
  lastDay = todayKey();
  applyTheme();
  Focus.load();
  render(true);
  Sync.init();
  setTimeout(checkReminders, 1500);
  setInterval(checkReminders, 15000);
  setInterval(() => { if (todayKey() !== lastDay) { lastDay = todayKey(); ui.calSel = null; ui.calMonth = null; render(); } }, 60000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { Focus.tick(); if (todayKey() !== lastDay) { lastDay = todayKey(); ui.calSel = null; ui.calMonth = null; } if (!ui.sheet) render(); checkReminders(); } else saveLocalNow(); });
  window.addEventListener('pagehide', saveLocalNow);
  if (window.visualViewport) {
    const upd = () => { const kb = Math.max(0, window.innerHeight - visualViewport.height - visualViewport.offsetTop); document.documentElement.style.setProperty('--kb', (kb > 60 ? kb : 0) + 'px'); };
    visualViewport.addEventListener('resize', upd); visualViewport.addEventListener('scroll', upd);
  }
  if (IS_PWA && 'serviceWorker' in navigator && /^https?:/.test(location.protocol)) {
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (!e.data || e.data.type !== 'offline-status') return;
      const was = Offline.ready; Offline.ready = e.data.ready;
      let told = false; try { told = localStorage.getItem('planirovk.offline') === '1'; } catch (er) { /* no storage */ }
      if (Offline.ready && !told) { try { localStorage.setItem('planirovk.offline', '1'); } catch (er) { /* no storage */ } toast('Готово: приложение работает без интернета'); }
      if (was !== Offline.ready && ['data', 'help'].includes(curView().v)) render();
    });
    // a new version of the app took over: reload into it (right away if nothing is being edited)
    const hadController = !!navigator.serviceWorker.controller;
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloading) return;
      const typing = document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
      if (ui.sheet || typing) { ui.reloadWhenIdle = true; return; }
      reloading = true; saveLocalNow(); location.reload();
    });
    navigator.serviceWorker.register('sw.js').then((reg) => { try { reg.update(); } catch (e) { /* offline */ } return navigator.serviceWorker.ready; }).then((reg) => Offline.check(reg)).catch(() => {});
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
