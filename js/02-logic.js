'use strict';
/* ===== Logic: tasks, repeat, smart input, shopping, templates, habits, calendar export, examples ===== */

const PRIO = [
  { v: 0, name: 'Нет', short: '' },
  { v: 1, name: 'Низкий', short: '!' },
  { v: 2, name: 'Средний', short: '!!' },
  { v: 3, name: 'Высокий', short: '!!!' },
];
/* Reminders: t.rem = { from: 'HH:MM', to: 'HH:MM', count, off } — `count` alerts spread evenly
   from `from` to `to` (count 1 = one alert at `from`), `off` days before the task date. */
const REM_OFF_OPTS = [[0, 'В день задачи'], [1, 'За 1 день'], [2, 'За 2 дня'], [3, 'За 3 дня'], [7, 'За неделю']];
function remMinutes(rem) {
  const n = clamp(rem.count || 1, 1, 12), a = timeToMin(rem.from);
  if (n === 1) return [a];
  let b = timeToMin(rem.to || rem.from); if (b <= a) b += 1440; // "с 22:00 до 01:00" runs past midnight
  return Array.from({ length: n }, (_, i) => Math.round(a + ((b - a) * i) / (n - 1)));
}
function remStamps(t) {
  if (!t.rem || !t.date) return [];
  const d = dateOf(addDays(t.date, -(t.rem.off || 0)));
  const mins = remMinutes(t.rem);
  return mins.map((m, i) => ({ at: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, m).getTime(), i: i + 1, n: mins.length, m }));
}
const joinRu = (arr) => (arr.length < 2 ? arr.join('') : arr.slice(0, -1).join(', ') + ' и ' + arr[arr.length - 1]);
function remSummary(t) {
  if (!t.rem) return '';
  const times = remMinutes(t.rem).map((m) => minToTime(m % 1440));
  const off = t.rem.off ? REM_OFF_OPTS.find((o) => o[0] === t.rem.off)?.[1].toLowerCase() + ' ' : '';
  return off + (times.length === 1 ? 'в ' + times[0] : joinRu(times));
}
function remFromOffset(time, offsetMin) {
  // "напомни за 15 мин" / old offset-style reminders -> absolute time on the right day
  let m = (time ? timeToMin(time) : 9 * 60) - (time ? offsetMin : 0), off = 0;
  if (!time && offsetMin >= 1440) off = Math.round(offsetMin / 1440);
  while (m < 0) { m += 1440; off++; }
  return { from: minToTime(m), to: minToTime(m), count: 1, off };
}
const DUR_OPTS = [0, 5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240];

/* ---------- tasks ---------- */
function newTask(f = {}) {
  return Object.assign({
    id: uid(), title: '', notes: '', listId: state.settings.defaultList || 'inbox', done: false, doneAt: null, doneDay: null,
    created: Date.now(), date: null, time: null, dur: 0, priority: 0, tags: [], subtasks: [], repeat: null, rem: null, snoozeAt: null,
    qty: '', cat: '', focusMin: 0,
  }, f);
}
function logDone(k, d) {
  if (!k) return;
  state.doneLog[k] = Math.max(0, (state.doneLog[k] || 0) + d);
}
function toggleDone(t) {
  if (t.done) {
    t.done = false; logDone(t.doneDay, -1); t.doneAt = null; t.doneDay = null;
    return 'undone';
  }
  const tk = todayKey();
  if (t.repeat) {
    const copy = Object.assign(clone(t), { id: uid(), done: true, doneAt: Date.now(), doneDay: tk, repeat: null, fromRepeat: t.id });
    state.tasks.push(copy);
    let next = nextDate(t.repeat, t.date || tk), guard = 0;
    while (next <= tk && guard++ < 2000) next = nextDate(t.repeat, next);
    t.date = next;
    t.subtasks.forEach((s) => { s.done = false; });
    logDone(tk, 1);
    return 'repeat';
  }
  t.done = true; t.doneAt = Date.now(); t.doneDay = tk;
  logDone(tk, 1);
  if (listById(t.listId).type === 'shopping') rememberShop(t);
  return 'done';
}
function nextDate(rep, from) {
  const every = Math.max(1, rep.every || 1);
  switch (rep.freq) {
    case 'day': return addDays(from, every);
    case 'weekdays': { let k = addDays(from, 1); while ([0, 6].includes(wdOf(k))) k = addDays(k, 1); return k; }
    case 'week': {
      if (!rep.days || !rep.days.length) return addDays(from, 7 * every);
      const ws0 = weekStartOf(from);
      for (let i = 1; i <= 7 * every + 7; i++) {
        const k = addDays(from, i);
        const wk = Math.round(diffDays(ws0, weekStartOf(k)) / 7);
        if (rep.days.includes(wdOf(k)) && wk % every === 0) return k;
      }
      return addDays(from, 7 * every);
    }
    case 'month': return addMonths(from, every);
    case 'year': return addMonths(from, 12 * every);
    default: return addDays(from, 1);
  }
}
function firstDate(rep, from) {
  if (rep.freq === 'week' && rep.days && rep.days.length) {
    for (let i = 0; i < 7; i++) { const k = addDays(from, i); if (rep.days.includes(wdOf(k))) return k; }
  }
  if (rep.freq === 'weekdays') { let k = from; while ([0, 6].includes(wdOf(k))) k = addDays(k, 1); return k; }
  return from;
}
const WD_ORDER = [1, 2, 3, 4, 5, 6, 0];
function repeatLabel(r) {
  if (!r) return 'Нет';
  const n = r.every || 1;
  switch (r.freq) {
    case 'day': return n === 1 ? 'Каждый день' : `Каждые ${n} ${plural(n, W_DAY)}`;
    case 'weekdays': return 'По будням';
    case 'week': {
      const base = n === 1 ? 'Каждую неделю' : `Каждые ${n} ${plural(n, ['неделю', 'недели', 'недель'])}`;
      if (r.days && r.days.length && r.days.length < 7) {
        const d = WD_ORDER.filter((x) => r.days.includes(x));
        if (d.length === 2 && d.includes(6) && d.includes(0)) return 'По выходным';
        return base + ': ' + d.map((x) => WD_S[x].toLowerCase()).join(', ');
      }
      return base;
    }
    case 'month': return n === 1 ? 'Каждый месяц' : `Каждые ${n} ${plural(n, ['месяц', 'месяца', 'месяцев'])}`;
    case 'year': return 'Каждый год';
    default: return 'Повтор';
  }
}
function cmpTask(a, b) {
  const da = a.date || '9999-99-99', db = b.date || '9999-99-99';
  if (da !== db) return da < db ? -1 : 1;
  const ta = a.time || '99:99', tb = b.time || '99:99';
  if (ta !== tb) return ta < tb ? -1 : 1;
  if (a.priority !== b.priority) return b.priority - a.priority;
  return (a.order || a.created) - (b.order || b.created);
}
function sortTasks(arr, mode) {
  const a = arr.slice();
  if (mode === 'priority') a.sort((x, y) => y.priority - x.priority || cmpTask(x, y));
  else if (mode === 'name') a.sort((x, y) => x.title.localeCompare(y.title, 'ru'));
  else if (mode === 'date') a.sort(cmpTask);
  else a.sort((x, y) => (x.order || x.created) - (y.order || y.created));
  return a;
}
const active = () => state.tasks.filter((t) => !t.done);
function overdueTasks() { const tk = todayKey(); return active().filter((t) => t.date && t.date < tk).sort(cmpTask); }
function dayTasks(k, withDone) {
  return state.tasks.filter((t) => t.date === k && (!t.done || withDone)).concat(
    withDone ? state.tasks.filter((t) => t.done && t.doneDay === k && t.date !== k && t.fromRepeat) : [],
  ).sort((a, b) => (a.done - b.done) || cmpTask(a, b));
}
function smartCounts() {
  const tk = todayKey(), act = active();
  return {
    today: act.filter((t) => t.date && t.date <= tk).length,
    upcoming: act.filter((t) => t.date && t.date > tk).length,
    inbox: act.filter((t) => t.listId === 'inbox').length,
    important: act.filter((t) => t.priority >= 2).length,
    all: act.length,
    done: state.tasks.filter((t) => t.done).length,
  };
}

/* ---------- smart input (Russian) ---------- */
const B = '(?=[\\s,.;!?)]|$)';
const WD_NAMES = { 'понедельник': 1, 'вторник': 2, 'среду': 3, 'среда': 3, 'четверг': 4, 'пятницу': 5, 'пятница': 5, 'субботу': 6, 'суббота': 6, 'воскресенье': 0, 'пн': 1, 'вт': 2, 'ср': 3, 'чт': 4, 'пт': 5, 'сб': 6, 'вс': 0 };
const WD_EVERY = { 'понедельник': 1, 'вторник': 2, 'среду': 3, 'четверг': 4, 'пятницу': 5, 'субботу': 6, 'воскресенье': 0, 'понедельникам': 1, 'вторникам': 2, 'средам': 3, 'четвергам': 4, 'пятницам': 5, 'субботам': 6, 'воскресеньям': 0 };
const MONTH_RX = 'января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря|янв|фев|мар|апр|июн|июл|авг|сен|сент|окт|ноя|нояб|дек';
function monthIdx(w) {
  w = w.toLowerCase();
  const full = MONTHS_G.indexOf(w);
  if (full >= 0) return full;
  return ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'].findIndex((p) => w.startsWith(p));
}

function parseQuick(raw, opts = {}) {
  const r = { title: raw.trim(), date: undefined, time: undefined, dur: undefined, priority: undefined, tags: [], listId: undefined, repeat: undefined, remind: undefined };
  if (opts.smart === false) return r;
  let s = ' ' + raw.replace(/\s+/g, ' ') + ' ';
  const tk = todayKey();
  const cut = (re, fn) => { s = s.replace(re, (...m) => (fn(...m) === false ? m[0] : ' ')); };

  cut(/\s#([0-9a-zа-яё_\-]+)/gi, (m, g) => { const t = g.toLowerCase(); if (!r.tags.includes(t)) r.tags.push(t); });
  cut(/\s@([0-9a-zа-яё_\-]+)/gi, (m, g) => {
    const q = g.toLowerCase();
    const l = state.lists.find((x) => x.name.toLowerCase().replace(/\s+/g, '') === q) || state.lists.find((x) => x.name.toLowerCase().replace(/\s+/g, '').startsWith(q));
    if (!l) return false;
    r.listId = l.id;
  });
  cut(/\s(!{1,3})(?=\s)/, (m, p) => { r.priority = p.length; });
  // "напоминай с 12:40 до 19:30 3 раза"
  cut(new RegExp('\\s(?:напоминай|напоминать|напомни|напомнить)\\s(?:с\\s)?(\\d{1,2})[:.](\\d{2})\\s(?:до|-|–)\\s?(\\d{1,2})[:.](\\d{2})(?:\\s(\\d{1,2})\\s?(?:раз|раза))?' + B, 'i'), (m, h1, m1, h2, m2, n) => {
    if (+h1 > 23 || +h2 > 23 || +m1 > 59 || +m2 > 59) return false;
    r.rem = { from: `${pad(+h1)}:${m1}`, to: `${pad(+h2)}:${m2}`, count: clamp(n ? +n : 3, 1, 12), off: 0 };
  });

  // repeat
  const setRep = (rep) => { if (!r.repeat) r.repeat = rep; };
  cut(new RegExp('\\s(каждый день|ежедневно)' + B, 'i'), () => setRep({ freq: 'day', every: 1 }));
  cut(new RegExp('\\sкаждые (\\d+) (дня|дней)' + B, 'i'), (m, n) => setRep({ freq: 'day', every: +n }));
  cut(new RegExp('\\s(по будням|каждый будний день)' + B, 'i'), () => setRep({ freq: 'weekdays', every: 1 }));
  cut(new RegExp('\\sпо выходным' + B, 'i'), () => setRep({ freq: 'week', every: 1, days: [6, 0] }));
  cut(new RegExp('\\s(каждую неделю|еженедельно)' + B, 'i'), () => setRep({ freq: 'week', every: 1, days: [] }));
  cut(new RegExp('\\sкаждые (\\d+) (недели|недель)' + B, 'i'), (m, n) => setRep({ freq: 'week', every: +n, days: [] }));
  cut(new RegExp('\\s(каждый месяц|ежемесячно)' + B, 'i'), () => setRep({ freq: 'month', every: 1 }));
  cut(new RegExp('\\s(каждый год|ежегодно)' + B, 'i'), () => setRep({ freq: 'year', every: 1 }));
  cut(new RegExp('\\s(?:каждый|каждую|каждое|по) (понедельник|вторник|среду|четверг|пятницу|субботу|воскресенье|понедельникам|вторникам|средам|четвергам|пятницам|субботам|воскресеньям)((?:\\s?,\\s?|\\sи\\s)(?:понедельник|вторник|среду|четверг|пятницу|субботу|воскресенье|понедельникам|вторникам|средам|четвергам|пятницам|субботам|воскресеньям))*' + B, 'i'), (m) => {
    const days = [];
    m.toLowerCase().replace(/[а-яё]+/g, (w) => { if (w in WD_EVERY && !days.includes(WD_EVERY[w])) days.push(WD_EVERY[w]); return w; });
    setRep({ freq: 'week', every: 1, days });
  });

  // relative
  const setDate = (k) => { if (r.date === undefined) r.date = k; };
  cut(new RegExp('\\sчерез (\\d+) (день|дня|дней)' + B, 'i'), (m, n) => setDate(addDays(tk, +n)));
  cut(new RegExp('\\sчерез (неделю|(\\d+) (недели|недель))' + B, 'i'), (m, a, n) => setDate(addDays(tk, 7 * (n ? +n : 1))));
  cut(new RegExp('\\sчерез (месяц|(\\d+) (месяца|месяцев))' + B, 'i'), (m, a, n) => setDate(addMonths(tk, n ? +n : 1)));
  cut(new RegExp('\\sчерез (час|полчаса|(\\d+) (час|часа|часов|мин|минут|минуты|минуту))' + B, 'i'), (m, a, n, u) => {
    let add = 60;
    if (a.toLowerCase() === 'полчаса') add = 30; else if (n) add = /^ч/i.test(u) ? +n * 60 : +n;
    const d = new Date(Date.now() + add * 60000);
    setDate(keyOf(d)); if (r.time === undefined) r.time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    if (r.remind === undefined) r.remind = 0;
  });
  cut(new RegExp('\\s(сегодня)' + B, 'i'), () => setDate(tk));
  cut(new RegExp('\\s(послезавтра)' + B, 'i'), () => setDate(addDays(tk, 2)));
  cut(new RegExp('\\s(завтра)' + B, 'i'), () => setDate(addDays(tk, 1)));
  cut(new RegExp('\\sна выходных' + B, 'i'), () => { let k = addDays(tk, 1); while (wdOf(k) !== 6) k = addDays(k, 1); setDate(wdOf(tk) === 6 || wdOf(tk) === 0 ? tk : k); });
  cut(new RegExp('\\sна следующей неделе' + B, 'i'), () => setDate(addDays(weekStartOf(tk), 7)));
  cut(new RegExp('\\s(?:(?:в|во)\\s)?(понедельник|вторник|среду|среда|четверг|пятницу|пятница|субботу|суббота|воскресенье|пн|вт|ср|чт|пт|сб|вс)' + B, 'i'), (m, w) => {
    if (r.date !== undefined) return false;
    const target = WD_NAMES[w.toLowerCase()];
    let diff = (target - wdOf(tk) + 7) % 7; if (diff === 0) diff = 7;
    setDate(addDays(tk, diff));
  });

  // time with "в" + dot, before dates
  const setTime = (h, mi) => { if (r.time === undefined && h >= 0 && h < 24 && mi >= 0 && mi < 60) { r.time = `${pad(h)}:${pad(mi)}`; return true; } return false; };
  cut(new RegExp('\\s(?:в|к|до|с)?\\s?(\\d{1,2}):(\\d{2})' + B, 'i'), (m, h, mi) => (setTime(+h, +mi) ? undefined : false));
  cut(new RegExp('\\s(?:в|к)\\s(\\d{1,2})\\.(\\d{2})' + B, 'i'), (m, h, mi) => (setTime(+h, +mi) ? undefined : false));

  // dates
  cut(new RegExp('\\s(\\d{1,2})[./](\\d{1,2})(?:[./](\\d{2,4}))?' + B), (m, d, mo, y) => {
    if (r.date !== undefined || +mo < 1 || +mo > 12 || +d < 1 || +d > 31) return false;
    let yr = y ? (+y < 100 ? 2000 + +y : +y) : new Date().getFullYear();
    let k = `${yr}-${pad(+mo)}-${pad(+d)}`;
    if (!y && k < tk) k = `${yr + 1}-${pad(+mo)}-${pad(+d)}`;
    setDate(k);
  });
  cut(new RegExp('\\s(\\d{1,2})\\s(' + MONTH_RX + ')\\.?(?:\\s(\\d{4}))?' + B, 'i'), (m, d, mo, y) => {
    if (r.date !== undefined) return false;
    const mi = monthIdx(mo); if (mi < 0 || +d < 1 || +d > 31) return false;
    let yr = y ? +y : new Date().getFullYear();
    let k = `${yr}-${pad(mi + 1)}-${pad(+d)}`;
    if (!y && k < tk) k = `${yr + 1}-${pad(mi + 1)}-${pad(+d)}`;
    setDate(k);
  });

  // "в 7 вечера", "в 9 утра", "в 15 ч", "в 10" at the end
  cut(new RegExp('\\s(?:в|к)\\s(\\d{1,2})\\s?(утра|дня|вечера|ночи|ч|час|часа|часов)' + B, 'i'), (m, h, suf) => {
    h = +h; suf = suf.toLowerCase();
    if ((suf === 'дня' || suf === 'вечера') && h < 12) h += 12;
    if (suf === 'ночи' && h === 12) h = 0;
    return setTime(h, 0) ? undefined : false;
  });
  cut(/\s(?:в|к)\s(\d{1,2})\s*$/i, (m, h) => { h = +h; if (h >= 1 && h <= 6) h += 12; return setTime(h, 0) ? undefined : false; });
  cut(new RegExp('\\s(утром)' + B, 'i'), () => { if (r.time !== undefined) return false; r.time = '09:00'; });
  cut(new RegExp('\\s(днём|днем)' + B, 'i'), () => { if (r.time !== undefined) return false; r.time = '13:00'; });
  cut(new RegExp('\\s(вечером)' + B, 'i'), () => { if (r.time !== undefined) return false; r.time = '19:00'; });

  // reminder
  cut(new RegExp('\\s(?:напомни|напомнить)(?:\\sза\\s(\\d+)\\s?(мин|минут|минуты|ч|час|часа|часов|день|дня))?' + B, 'i'), (m, n, u) => {
    let v = 0;
    if (n) v = /^д/i.test(u) ? +n * 1440 : /^ч/i.test(u) ? +n * 60 : +n;
    r.remind = v;
  });

  // duration
  cut(new RegExp('\\s(?:на\\s)?(\\d+(?:[.,]\\d+)?)\\s?(ч|час|часа|часов)' + B, 'i'), (m, n) => { if (r.dur !== undefined) return false; r.dur = Math.round(parseFloat(n.replace(',', '.')) * 60); });
  cut(new RegExp('\\s(?:на\\s)?(\\d+)\\s?(мин|минут|минуты|минуту)' + B, 'i'), (m, n) => { if (r.dur !== undefined) return false; r.dur = +n; });
  cut(new RegExp('\\sна (полчаса|час)' + B, 'i'), (m, w) => { if (r.dur !== undefined) return false; r.dur = w.toLowerCase() === 'час' ? 60 : 30; });

  if (r.repeat && r.date === undefined) r.date = firstDate(r.repeat, tk);
  if (r.time && r.date === undefined) r.date = timeToMin(r.time) > nowMin() ? tk : addDays(tk, 1);
  if (!r.rem && r.remind !== undefined) r.rem = remFromOffset(r.time, r.remind);
  else if (!r.rem && r.time) r.rem = { from: r.time, to: r.time, count: 1, off: 0 }; // timed tasks remind at their start
  if (r.rem && r.date === undefined) r.date = tk;
  const title = s.replace(/\s+/g, ' ').replace(/^[\s,.;-]+|[\s,;-]+$/g, '').trim();
  r.title = title || raw.trim();
  return r;
}
function parsedChips(p) {
  const c = [];
  if (p.date) c.push([ 'calendar', fmtDay(p.date) + (p.time ? ', ' + p.time : '') ]);
  else if (p.time) c.push([ 'clock', p.time ]);
  if (p.dur) c.push([ 'timer', fmtDur(p.dur) ]);
  if (p.repeat) c.push([ 'repeat', repeatLabel(p.repeat) ]);
  if (p.priority) c.push([ 'flag', PRIO[p.priority].name ]);
  if (p.listId) c.push([ 'folder', listById(p.listId).name ]);
  p.tags.forEach((g) => c.push([ 'tag', g ]));
  if (p.rem) c.push([ 'bell', 'Напомнить ' + (p.rem.count > 1 ? `${p.rem.count} раза: ` : '') + remSummary({ rem: p.rem }) ]);
  return c;
}

/* ---------- shopping ---------- */
const SHOP_CATS = [
  ['Овощи и фрукты', 'овощ фрукт яблок яблоки банан апельсин мандарин лимон лайм груш виноград киви помидор томат черри огур картоф картош морков лук чеснок капуст перец кабач баклаж свекл редис зелен укроп петруш кинз базилик салат шпинат авокадо ягод клубник малин черник голубик гриб шампин тыкв брокол цукини имбир персик нектарин слив арбуз дын гранат хурм'],
  ['Хлеб и выпечка', 'хлеб батон булк булоч багет лаваш выпечк круассан пирож пирог торт печенье печенья сушк сухар пряник лепеш лепёш тортил'],
  ['Молочное и яйца', 'молок кефир йогурт сметан творог творож сыр сырок сливк сливоч ряженк простокваш яйц яиц яйца айран моцарел пармезан брынз фет маскарпоне'],
  ['Мясо и рыба', 'мяс курин куриц курица курочк филе грудк бедр крыл говяд свин баран фарш индейк колбас сосиск сардел ветчин бекон буженин рыб лосос семг сёмг форел тунец скумбр сельд кревет кальмар мидии стейк котлет печень'],
  ['Бакалея', 'круп рис гречк гречн булгур кускус макарон спагетти паст лапш мук сахар сол специ приправ масло уксус соус кетчуп майонез горчиц консерв тушен фасол горох чечевиц нут овсян хлопь мюсли гранол мед мёд варень джем орех миндал сухофрукт изюм чай кофе какао дрожж разрыхл крахмал'],
  ['Напитки', 'вод вода сок лимонад газиров кола пиво вино напит морс компот квас минерал энергет'],
  ['Сладкое и снеки', 'шоколад конфет чипс снек сухарик мармелад зефир пастил батончик вафл попкорн'],
  ['Замороженное', 'заморож пельмен вареник пицц наггетс морожен блинчик'],
  ['Гигиена и аптека', 'шампун бальзам зубн щетк щётк нить дезодор крем бритв станк прокладк тампон ватн пласт лекарств таблет витамин бинт пластыр гель мыл'],
  ['Бытовая химия', 'порош стираль средств губк салфет бумаг туалетн пакет мусор отбел кондиционер освежит фольг пленк плёнк капсул лампоч батарейк'],
  ['Для детей и животных', 'подгуз детск корм наполнит пюре смесь'],
];
const SHOP_OTHER = 'Другое';
const CAT_PRIORITY = ['Гигиена и аптека', 'Бытовая химия', 'Для детей и животных'];
function categorize(name) {
  // the longest matching word stem wins ("сливочное" beats "слив"); ties go to the more specific departments
  const words = name.toLowerCase().replace(/ё/g, 'е').split(/[^a-zа-я0-9]+/).filter(Boolean);
  let best = SHOP_OTHER, bestLen = 0, bestRank = 99;
  SHOP_CATS.forEach(([cat, stems], idx) => {
    const rank = CAT_PRIORITY.includes(cat) ? CAT_PRIORITY.indexOf(cat) : 10 + idx;
    stems.replace(/ё/g, 'е').split(' ').forEach((p) => {
      if (!words.some((w) => w.startsWith(p))) return;
      if (p.length > bestLen || (p.length === bestLen && rank < bestRank)) { best = cat; bestLen = p.length; bestRank = rank; }
    });
  });
  return best;
}
const UNIT = '(?:шт|штук|штуки|кг|г|гр|л|мл|уп|упак|упаковк[аи]|пач|пачк[аи]|бут|бутылк[аи]|банк[аи]|пакет[а]?|бан)\\.?';
function splitQty(text) {
  const t = text.trim();
  let m = t.match(new RegExp('^(.+?)[\\s,]+((?:\\d+(?:[.,]\\d+)?\\s?' + UNIT + ')|(?:[xх×]\\s?\\d+)|(?:\\d+\\s?[xх×]))$', 'i'));
  if (m) return { name: m[1].trim(), qty: m[2].trim() };
  m = t.match(new RegExp('^((?:\\d+(?:[.,]\\d+)?\\s?' + UNIT + ')|(?:\\d+\\s?[xх×])|(?:[xх×]\\d+))\\s+(.+)$', 'i'));
  if (m) return { name: m[2].trim(), qty: m[1].trim() };
  return { name: t, qty: '' };
}
function rememberShop(t) {
  const k = t.title.toLowerCase().trim();
  if (!k) return;
  const h = state.shopHist[k] || { name: t.title, n: 0, cat: t.cat };
  h.n += 1; h.last = Date.now(); h.name = t.title; h.cat = t.cat || h.cat;
  state.shopHist[k] = h;
}
function shopSuggestions(listId, limit = 14) {
  const have = new Set(state.tasks.filter((t) => t.listId === listId && !t.done).map((t) => t.title.toLowerCase().trim()));
  return Object.entries(state.shopHist).filter(([k]) => !have.has(k))
    .sort((a, b) => b[1].n - a[1].n || b[1].last - a[1].last).slice(0, limit).map(([, v]) => v);
}

/* Create one or more tasks from text (multi-line paste = several tasks). */
function addFromText(text, ctx = {}) {
  const lines = text.split(/\n+/).map((x) => x.trim()).filter(Boolean);
  const made = [];
  const ord = Date.now();
  lines.forEach((line, i) => {
    const p = parseQuick(line, { smart: state.settings.smartInput });
    const listId = p.listId || ctx.listId || state.settings.defaultList || 'inbox';
    const list = listById(listId);
    const t = newTask({
      title: p.title, listId, date: p.date !== undefined ? p.date : (ctx.date || null),
      time: p.time !== undefined ? p.time : (ctx.time || null), dur: p.dur || ctx.dur || 0,
      priority: p.priority !== undefined ? p.priority : (ctx.priority || 0),
      tags: Array.from(new Set([...(ctx.tags || []), ...p.tags])), repeat: p.repeat || ctx.repeat || null,
      rem: p.rem || null, order: ord + i,
    });
    if (list.type === 'shopping') {
      const q = splitQty(t.title); t.title = q.name.charAt(0).toUpperCase() + q.name.slice(1); t.qty = q.qty; t.cat = categorize(q.name);
      if (!p.date && !ctx.date) t.date = null;
    }
    if (t.time && !t.date) t.date = todayKey();
    state.tasks.push(t);
    made.push(t);
  });
  return made;
}

/* ---------- templates ---------- */
const TEMPLATES = [
  { id: 'tpl-shop', name: 'Покупки на неделю', emoji: '🛒', color: '#E8890A', type: 'shopping', desc: 'Базовый набор продуктов', items: ['Молоко 1 л', 'Хлеб', 'Яйца 10 шт', 'Куриное филе 1 кг', 'Рис', 'Помидоры', 'Огурцы', 'Бананы', 'Сыр', 'Кофе', 'Туалетная бумага'] },
  { id: 'tpl-trip', name: 'Сборы в поездку', emoji: '✈️', color: '#0E9BB0', type: 'tasks', desc: 'Документы, вещи, дом', items: ['Паспорт и билеты !!!', 'Страховка', 'Зарядки и пауэрбанк', 'Наличные и карты', 'Аптечка', 'Одежда по погоде', 'Средства гигиены', 'Скачать офлайн-карты', 'Полить цветы, вынести мусор', 'Закрыть окна, выключить приборы'] },
  { id: 'tpl-exam', name: 'Подготовка к экзамену', emoji: '🎓', color: '#8B4FD8', type: 'tasks', desc: 'План по шагам с запасом', items: ['Собрать список тем и билетов !!', 'Распределить темы по дням', 'Конспект по каждой теме', 'Решить пробный вариант на время', 'Разобрать ошибки', 'Повторить сложные темы', 'Выспаться перед экзаменом'] },
  { id: 'tpl-project', name: 'Запуск проекта', emoji: '📈', color: '#2F5BEA', type: 'tasks', desc: 'Цель, сроки, команда, отчёт', items: ['Сформулировать цель и результат !!!', 'Сроки и бюджет', 'Роли в команде', 'План работ по этапам', 'Встреча с командой', 'Промежуточный отчёт', 'Итоговая презентация'] },
  { id: 'tpl-meeting', name: 'Встреча', emoji: '💼', color: '#5F6B7D', type: 'tasks', desc: 'Повестка, материалы, итоги', items: ['Определить цель встречи', 'Разослать приглашения', 'Подготовить повестку', 'Материалы и презентация', 'Записать решения', 'Разослать итоги и задачи'] },
  { id: 'tpl-clean', name: 'Генеральная уборка', emoji: '🧹', color: '#188A4E', type: 'tasks', desc: 'По зонам, ничего не забыть', items: ['Разобрать вещи, выбросить лишнее', 'Пыль на всех поверхностях', 'Окна и зеркала', 'Кухня: плита, духовка, холодильник', 'Ванная и туалет', 'Пропылесосить и помыть полы', 'Сменить постельное бельё'] },
  { id: 'tpl-weekend', name: 'Планы на выходные', emoji: '🎉', color: '#D6409F', type: 'tasks', desc: 'Отдых, дела, близкие', items: ['Выспаться без будильника', 'Прогулка или поездка за город', 'Встреча с друзьями', 'Фильм или книга', 'Продукты на неделю', 'Подготовить одежду на неделю', 'Спланировать следующую неделю'] },
  { id: 'tpl-move', name: 'Переезд', emoji: '📦', color: '#8A6A44', type: 'tasks', desc: 'Сборы, транспорт, документы', items: ['Коробки, скотч, маркер', 'Заказать грузчиков и машину !!', 'Упаковать вещи по комнатам', 'Подписать коробки', 'Перенести интернет', 'Сменить адрес доставки и в документах', 'Передать ключи'] },
];
function createFromTemplate(tpl) {
  const list = { id: uid(), name: tpl.name, color: tpl.color, emoji: tpl.emoji, type: tpl.type, sort: tpl.type === 'shopping' ? 'manual' : 'manual', created: Date.now() };
  let name = list.name, i = 2;
  while (state.lists.some((l) => l.name === name)) name = `${list.name} ${i++}`;
  list.name = name;
  state.lists.push(list);
  addFromText(tpl.items.join('\n'), { listId: list.id });
  return list;
}

/* ---------- habits ---------- */
const HABIT_COLORS = ['#188A4E', '#2F5BEA', '#E8890A', '#8B4FD8', '#0E9BB0', '#D6409F', '#E0393F', '#B79600'];
function newHabit(f = {}) {
  return Object.assign({ id: uid(), name: '', color: HABIT_COLORS[0], days: [0, 1, 2, 3, 4, 5, 6], perWeek: 0, target: 1, unit: '', log: {}, created: todayKey(), order: Date.now() }, f);
}
const hVal = (h, k) => h.log[k] || 0;
const hDone = (h, k) => hVal(h, k) >= h.target;
const hSched = (h, k) => (h.perWeek ? true : h.days.includes(wdOf(k)));
function hWeekCount(h, k) {
  const ws = weekStartOf(k); let n = 0;
  for (let i = 0; i < 7; i++) if (hDone(h, addDays(ws, i))) n++;
  return n;
}
function hStreak(h) {
  const tk = todayKey();
  if (h.perWeek) {
    let ws = weekStartOf(tk), n = 0;
    if (hWeekCount(h, ws) < h.perWeek) ws = addDays(ws, -7);
    for (let i = 0; i < 520; i++) {
      if (ws < weekStartOf(h.created)) break;
      if (hWeekCount(h, ws) >= h.perWeek) { n++; ws = addDays(ws, -7); } else break;
    }
    return { n, unit: plural(n, ['неделя', 'недели', 'недель']) };
  }
  let k = tk, n = 0;
  if (hSched(h, k) && !hDone(h, k)) k = addDays(k, -1);
  for (let i = 0; i < 3000 && k >= h.created; i++) {
    if (!hSched(h, k)) { k = addDays(k, -1); continue; }
    if (hDone(h, k)) { n++; k = addDays(k, -1); } else break;
  }
  return { n, unit: plural(n, W_DAY) };
}
function hBest(h) {
  let best = 0, cur = 0, k = h.created;
  const tk = todayKey();
  if (h.perWeek) {
    let ws = weekStartOf(h.created);
    while (ws <= tk) { if (hWeekCount(h, ws) >= h.perWeek) { cur++; best = Math.max(best, cur); } else if (ws < weekStartOf(tk)) cur = 0; ws = addDays(ws, 7); }
    return best;
  }
  for (let i = 0; i < 5000 && k <= tk; i++, k = addDays(k, 1)) {
    if (!hSched(h, k)) continue;
    if (hDone(h, k)) { cur++; best = Math.max(best, cur); } else if (k < tk) cur = 0;
  }
  return best;
}
function hRate(h, days = 30) {
  const tk = todayKey(); let sched = 0, done = 0;
  for (let i = 0; i < days; i++) {
    const k = addDays(tk, -i);
    if (k < h.created) break;
    if (hDone(h, k)) done++;
    if (!h.perWeek && hSched(h, k) && !(k === tk && !hDone(h, k))) sched++;
  }
  if (h.perWeek) { const span = Math.min(days, diffDays(h.created, tk) + 1); sched = Math.max(1, Math.round((h.perWeek * span) / 7)); }
  return sched ? Math.min(100, Math.round((done / sched) * 100)) : 0;
}
function habitsToday() {
  const tk = todayKey();
  return state.habits.filter((h) => !h.archived && (h.perWeek ? hWeekCount(h, tk) < h.perWeek || hDone(h, tk) : hSched(h, tk)));
}
function habitTick(h, k, delta) {
  const v = hVal(h, k);
  let nv;
  if (delta === 'toggle') nv = h.target > 1 ? (v >= h.target ? 0 : v + 1) : (v ? 0 : 1);
  else nv = clamp(v + delta, 0, 999);
  if (nv) h.log[k] = nv; else delete h.log[k];
  return nv;
}
function habitSchedLabel(h) {
  if (h.perWeek) return `${pl(h.perWeek, W_TIME)} в неделю`;
  if (h.days.length === 7) return 'Каждый день';
  const d = WD_ORDER.filter((x) => h.days.includes(x));
  if (d.length === 5 && !d.includes(0) && !d.includes(6)) return 'По будням';
  return d.map((x) => WD_S[x].toLowerCase()).join(', ');
}

/* ---------- calendar export (.ics) ---------- */
function icsEsc(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => '\\' + c); }
function icsFold(line) {
  const out = []; let s = line;
  while (s.length > 72) { out.push(s.slice(0, 72)); s = ' ' + s.slice(72); }
  out.push(s); return out.join('\r\n');
}
const ICS_WD = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
function icsRRule(r) {
  if (!r) return '';
  const iv = r.every > 1 ? `;INTERVAL=${r.every}` : '';
  if (r.freq === 'day') return `RRULE:FREQ=DAILY${iv}`;
  if (r.freq === 'weekdays') return 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR';
  if (r.freq === 'week') return `RRULE:FREQ=WEEKLY${iv}` + (r.days && r.days.length ? ';BYDAY=' + r.days.map((x) => ICS_WD[x]).join(',') : '');
  if (r.freq === 'month') return `RRULE:FREQ=MONTHLY${iv}`;
  if (r.freq === 'year') return 'RRULE:FREQ=YEARLY';
  return '';
}
function buildICS(tasks) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Planirovk//RU', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  tasks.filter((t) => t.date).forEach((t) => {
    const d = t.date.replace(/-/g, '');
    const main = [];
    main.push('BEGIN:VEVENT', `UID:${t.id}@planirovk`, `DTSTAMP:${stamp}`);
    if (t.time) {
      const st = timeToMin(t.time), en = st + (t.dur || 30);
      const endKey = en >= 1440 ? addDays(t.date, 1).replace(/-/g, '') : d;
      main.push(`DTSTART:${d}T${t.time.replace(':', '')}00`, `DTEND:${endKey}T${minToTime(en % 1440).replace(':', '')}00`);
    } else {
      main.push(`DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${addDays(t.date, 1).replace(/-/g, '')}`);
    }
    main.push(icsFold('SUMMARY:' + icsEsc(t.title)));
    const desc = [t.notes, ...t.subtasks.map((s) => (s.done ? '✓ ' : '☐ ') + s.title)].filter(Boolean).join('\n');
    if (desc) main.push(icsFold('DESCRIPTION:' + icsEsc(desc)));
    const rr = icsRRule(t.repeat);
    if (rr) main.push(rr);
    const alarm = (trig, to = main) => to.push('BEGIN:VALARM', 'ACTION:DISPLAY', icsFold('DESCRIPTION:' + icsEsc(t.title)), `TRIGGER:${trig}`, 'END:VALARM');
    const mins = t.rem ? remMinutes(t.rem) : [];
    if (mins.length === 1) {
      // one alert: relative to the event start, so it also works for repeating tasks
      const diff = mins[0] - (t.rem.off || 0) * 1440 - (t.time ? timeToMin(t.time) : 0);
      alarm(`${diff < 0 ? '-' : ''}PT${Math.abs(diff)}M`);
    }
    main.push('END:VEVENT');
    // a task without a time but with several alerts needs only the alert events, not an extra all-day entry
    if (!(mins.length > 1 && !t.time)) L.push(...main);
    if (mins.length > 1) {
      // iPhone Calendar keeps at most two alerts per event, so each alert becomes its own short event
      const base = addDays(t.date, -(t.rem.off || 0));
      mins.forEach((m, i) => {
        const k = addDays(base, Math.floor(m / 1440)).replace(/-/g, ''), hm = minToTime(m % 1440).replace(':', '');
        L.push('BEGIN:VEVENT', `UID:${t.id}-r${i + 1}@planirovk`, `DTSTAMP:${stamp}`, `DTSTART:${k}T${hm}00`, 'DURATION:PT5M',
          icsFold('SUMMARY:' + icsEsc(`Напоминание ${i + 1}/${mins.length}: ${t.title}`)));
        if (rr) L.push(rr);
        alarm('PT0M', L); L.push('END:VEVENT');
      });
    }
  });
  L.push('END:VCALENDAR');
  return L.join('\r\n') + '\r\n';
}

/* ---------- list as text (to share via messengers) ---------- */
function listAsText(list) {
  const items = state.tasks.filter((t) => t.listId === list.id && !t.done);
  const lines = [list.name];
  if (list.type === 'shopping') {
    const groups = groupShop(items);
    groups.forEach(([cat, arr]) => { lines.push('', cat + ':'); arr.forEach((t) => lines.push('☐ ' + t.title + (t.qty ? ' — ' + t.qty : ''))); });
  } else {
    sortTasks(items, list.sort || 'manual').forEach((t) => {
      lines.push('☐ ' + t.title + (t.date ? ` (${fmtDay(t.date)}${t.time ? ' ' + t.time : ''})` : ''));
      t.subtasks.forEach((s) => lines.push('   ' + (s.done ? '✓ ' : '◦ ') + s.title));
    });
  }
  return lines.join('\n');
}
function groupShop(items) {
  const order = SHOP_CATS.map((c) => c[0]).concat([SHOP_OTHER]);
  const m = new Map();
  items.forEach((t) => { const c = t.cat || categorize(t.title); if (!m.has(c)) m.set(c, []); m.get(c).push(t); });
  return Array.from(m.entries()).sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
    .map(([c, arr]) => [c, arr.sort((x, y) => (x.order || x.created) - (y.order || y.created))]);
}

/* ---------- in-app reminders ---------- */
/* Returns one entry per task whose alert time has come (the latest one if several were missed). */
function dueReminders() {
  const now = Date.now(), out = [], seen = state.meta.notified;
  active().forEach((t) => {
    const stamps = remStamps(t);
    if (t.snoozeAt) stamps.push({ at: t.snoozeAt, snooze: true });
    const due = stamps.filter((x) => now >= x.at && now - x.at < 12 * 3600e3 && !seen[t.id + '@' + x.at]);
    if (due.length) out.push({ t, info: due[due.length - 1], keys: due.map((x) => t.id + '@' + x.at) });
  });
  return out;
}
function nextReminder(t) {
  const now = Date.now();
  const all = remStamps(t).map((x) => x.at).concat(t.snoozeAt ? [t.snoozeAt] : []).filter((a) => a > now).sort((a, b) => a - b);
  return all[0] || null;
}
function pruneNotified() {
  const old = Date.now() - 3 * 864e5;
  Object.keys(state.meta.notified).forEach((k) => { const at = +k.split('@')[1]; if (!(at > old)) delete state.meta.notified[k]; });
}

/* ---------- examples for the first launch ---------- */
function seedExamples() {
  const tk = todayKey(), d = (n) => addDays(tk, n);
  const L = (name, emoji, color, type = 'tasks') => { const l = { id: uid(), name, emoji, color, type, sort: 'manual', created: Date.now() }; state.lists.push(l); return l.id; };
  const work = L('Работа', '💼', '#2F5BEA'), study = L('Учёба', '📚', '#8B4FD8'), home = L('Дом', '🏠', '#188A4E'), shop = L('Покупки', '🛒', '#E8890A', 'shopping');
  let o = Date.now();
  const T = (f) => { const t = newTask(Object.assign({ example: true, order: o++ }, f)); state.tasks.push(t); return t; };
  let sat = addDays(tk, 1); while (wdOf(sat) !== 6) sat = addDays(sat, 1);
  T({ title: 'Созвон с командой', listId: work, date: tk, time: '10:00', dur: 30, priority: 2, tags: ['встречи'], rem: { from: '09:45', to: '09:45', count: 1, off: 0 }, repeat: { freq: 'weekdays', every: 1 } });
  T({ title: 'Подготовить отчёт за месяц', listId: work, date: tk, time: '14:00', dur: 90, priority: 3, notes: 'Цифры за месяц, сравнение с прошлым, выводы', subtasks: [{ id: uid(), title: 'Собрать цифры', done: true }, { id: uid(), title: 'Построить графики', done: false }, { id: uid(), title: 'Отправить руководителю', done: false }] });
  T({ title: 'Оплатить интернет', listId: home, date: d(-1), priority: 2, repeat: { freq: 'month', every: 1 } });
  T({ title: 'Позвонить маме', listId: home, date: d(1), time: '18:30', dur: 20, rem: { from: '18:30', to: '18:30', count: 1, off: 0 } });
  T({ title: 'Конспект лекции по истории', listId: study, date: d(1), dur: 45 });
  T({ title: 'Решить 20 задач к экзамену', listId: study, date: d(3), priority: 3, tags: ['экзамен'], dur: 120, subtasks: [{ id: uid(), title: 'Задачи 1–10', done: false }, { id: uid(), title: 'Задачи 11–20', done: false }] });
  T({ title: 'Обновить презентацию для клиента', listId: work, date: d(2), time: '11:00', dur: 60, priority: 1 });
  T({ title: 'Кино с друзьями', listId: home, date: sat, time: '18:00', dur: 150, tags: ['выходные'] });
  T({ title: 'Напишите задачу как в жизни: «Встреча в пятницу в 15:00 #работа !!!»', listId: 'inbox' });
  T({ title: 'Смахните задачу вправо — выполнено, влево — перенести или удалить', listId: 'inbox' });
  T({ title: 'Попробуйте фокус-таймер: «Ещё → Фокус»', listId: 'inbox', date: tk, dur: 25 });
  [['Молоко', '1 л'], ['Помидоры', '1 кг'], ['Куриное филе', ''], ['Яйца', '10 шт'], ['Сыр', ''], ['Бананы', ''], ['Стиральный порошок', ''], ['Хлеб', '']].forEach(([n, q], i) => {
    const t = T({ title: n, qty: q, listId: shop, cat: categorize(n) });
    if (i === 7) { t.done = true; t.doneAt = Date.now(); t.doneDay = tk; logDone(tk, 1); }
    state.shopHist[n.toLowerCase()] = { name: n, n: 3 - (i % 3), cat: t.cat, last: Date.now() };
  });
  state.shopHist['кофе'] = { name: 'Кофе', n: 4, cat: 'Бакалея', last: Date.now() };
  state.shopHist['гречка'] = { name: 'Гречка', n: 2, cat: 'Бакалея', last: Date.now() };
  for (let i = 1; i <= 9; i++) {
    const t = T({ title: ['Проверить почту', 'Сдать лабораторную', 'Купить подарок', 'Разобрать входящие', 'Заказать воду', 'Обновить резюме', 'Записаться к врачу', 'Отправить счёт', 'Прочитать главу'][i - 1], listId: [work, study, home][i % 3], date: d(-i % 7 - 1) });
    t.done = true; t.doneDay = d(-(i % 7) - 1); t.doneAt = Date.now() - i * 864e5; logDone(t.doneDay, 1);
  }
  const hl = (n, every) => { const log = {}; for (let i = 1; i <= 20; i++) if ((i * 7 + n) % every) log[d(-i)] = 1; return log; };
  const water = newHabit({ name: 'Пить воду', color: '#0E9BB0', target: 8, unit: 'стак.', example: true, created: d(-21), log: {} });
  for (let i = 0; i <= 20; i++) water.log[d(-i)] = i === 0 ? 3 : (i % 5 === 0 ? 5 : 8);
  state.habits.push(water);
  state.habits.push(newHabit({ name: 'Читать 20 минут', color: '#8B4FD8', example: true, created: d(-21), log: hl(2, 6) }));
  state.habits.push(newHabit({ name: 'Спорт', color: '#E8890A', perWeek: 3, example: true, created: d(-21), log: hl(1, 2) }));
  state.meta.seeded = true; state.meta.exampleLog = true;
}
function removeExamples() {
  state.tasks = state.tasks.filter((t) => !t.example);
  state.habits = state.habits.filter((h) => !h.example);
  if (state.meta.exampleLog) { state.doneLog = {}; state.meta.exampleLog = false; }
  state.shopHist = {};
  state.meta.hideExampleBanner = true;
}
const hasExamples = () => state.tasks.some((t) => t.example) || state.habits.some((h) => h.example);
