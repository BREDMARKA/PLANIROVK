'use strict';
/* ===== Views part 1: shell, task rows, Today, Lists, list screens, Calendar ===== */

const ui = {
  tab: 'today',
  stack: { today: [], lists: [], cal: [], habits: [], more: [] },
  calMonth: null, calSel: null,
  sel: null, q: '', sheet: null, showDone: {},
};
const TABS = [
  ['today', 'Сегодня', 'sun'], ['lists', 'Списки', 'list'], ['cal', 'Календарь', 'calendar'], ['habits', 'Привычки', 'target'], ['more', 'Ещё', 'grid'],
];
const curView = () => { const s = ui.stack[ui.tab]; return s[s.length - 1] || { v: ui.tab }; };
function go(view) { ui.stack[ui.tab].push(view); ui.sel = null; render(true); }
function back() { ui.stack[ui.tab].pop(); ui.sel = null; render(true); }
function switchTab(t) {
  if (ui.tab === t) ui.stack[t] = []; // tap again = back to root
  ui.tab = t; ui.sel = null; prefs.tab = t; savePrefs(); render(true);
}

function render(reset) {
  const app = $('#app'); if (!app) return;
  const v = curView();
  const out = (VIEWS[v.v] || VIEWS.today)(v);
  const key = ui.tab + JSON.stringify(v);
  const old = $('.screen', app);
  const top = old && old.dataset.key === key && !reset ? old.scrollTop : 0;
  const sel = ui.sel;
  const head = sel
    ? `<div class="topbar-row"><button class="back-btn" data-act="sel-exit">Готово</button><div class="spacer"></div><button class="back-btn" data-act="sel-all" style="margin:0">Выбрать все</button></div>
       <h1 class="title-lg">Выбрано: ${sel.size}</h1>`
    : `<div class="topbar-row">${ui.stack[ui.tab].length ? `<button class="back-btn" data-act="back">${ic('back')}<span>${esc(out.backLabel || 'Назад')}</span></button>` : ''}<div class="spacer"></div>${out.actions || ''}</div>
       <h1 class="title-lg">${out.title}</h1>${out.sub ? `<p class="subtitle">${out.sub}</p>` : ''}`;
  app.innerHTML = `<header class="topbar">${head}</header>
    <main class="screen" data-key="${esc(key)}">${out.body}</main>
    ${out.fab !== false && !sel ? `<button class="fab" data-act="quick-add" aria-label="Добавить задачу">${ic('plus')}</button>` : ''}
    ${sel ? selBar() : ''}
    <nav class="tabbar">${TABS.map(([id, label, icon]) => {
      const badge = id === 'today' ? smartCounts().today : 0;
      return `<button class="tab ${ui.tab === id ? 'on' : ''}" data-act="tab" data-tab="${id}">${ic(icon)}<span>${label}</span>${badge ? `<span class="badge">${badge > 99 ? '99+' : badge}</span>` : ''}</button>`;
    }).join('')}</nav>`;
  const sc = $('.screen', app);
  if (sc && top) sc.scrollTop = top;
  if (out.after) out.after();
}

/* ---------- task row ---------- */
function taskRow(t, o = {}) {
  const list = listById(t.listId), tk = todayKey();
  const late = !t.done && t.date && t.date < tk;
  const meta = [];
  if (t.date && !o.hideDate) meta.push(`<span class="${late ? 'late' : t.date === tk ? 'today' : ''}">${ic('calendar', 'xs')}${fmtDay(t.date)}${t.time && !o.timeRight ? ', ' + t.time : ''}</span>`);
  else if (t.time && !o.timeRight) meta.push(`<span>${ic('clock', 'xs')}${t.time}</span>`);
  if (t.dur && !t.done) meta.push(`<span>${ic('timer', 'xs')}${fmtDur(t.dur)}</span>`);
  if (t.repeat) meta.push(`<span title="${esc(repeatLabel(t.repeat))}">${ic('repeat', 'xs')}</span>`);
  if (t.subtasks.length) meta.push(`<span>${ic('checks', 'xs')}${t.subtasks.filter((s) => s.done).length}/${t.subtasks.length}</span>`);
  if (t.rem && !t.done) meta.push(`<span>${ic('bell', 'xs')}${t.rem.count > 1 ? t.rem.count + '×' : t.rem.from}</span>`);
  if (t.notes) meta.push(`<span>${ic('note', 'xs')}</span>`);
  t.tags.forEach((g) => meta.push(`<span class="tag">#${esc(g)}</span>`));
  if (o.showList && list.id !== 'inbox') meta.push(`<span><i class="dot" style="background:${list.color};width:8px;height:8px"></i>${esc(list.name)}</span>`);
  if (t.example) meta.push('<span class="example-flag">пример</span>');
  const selOn = ui.sel && ui.sel.has(t.id);
  const right = t.qty ? `<div class="t-qty">${esc(t.qty)}</div>` : (o.timeRight && t.time ? `<div class="t-time ${late || (t.date === tk && !t.done && timeToMin(t.time) < nowMin()) ? 'late' : ''}">${t.time}</div>` : '');
  return `<div class="swipe" data-id="${t.id}">
    <div class="swipe-bg right">${ic('check')}<span>${t.done ? 'Вернуть' : 'Готово'}</span></div>
    <div class="swipe-bg left"><span class="lbl">На завтра</span>${ic('sunrise')}</div>
    <div class="task ${t.done ? 'done' : ''} ${selOn ? 'sel' : ''}" data-act="open" data-id="${t.id}">
      <button class="check p${t.priority} ${t.done ? 'on' : ''}" data-act="toggle" data-id="${t.id}" aria-label="${t.done ? 'Отметить невыполненной' : 'Выполнить'}">${ic('check')}</button>
      <div class="t-body"><div class="t-title">${esc(t.title)}</div>
        ${o.notes && t.notes ? `<div class="t-notes">${esc(t.notes)}</div>` : ''}
        ${meta.length ? `<div class="t-meta">${meta.join('')}</div>` : ''}</div>${right}
    </div></div>`;
}
const taskGroup = (arr, o) => `<div class="group">${arr.map((t) => taskRow(t, o)).join('')}</div>`;
function sec(title, inner, extra = '', cls = '') {
  return `<section class="sec"><div class="sec-h ${cls}"><span>${title}</span><span class="spacer"></span>${extra}</div>${inner}</section>`;
}
function emptyBox(big, text, btn = '') {
  return `<div class="empty"><div class="big">${big}</div><p>${text}</p>${btn}</div>`;
}
function ring(p, label, size = 64, stroke = 7) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return `<div class="ring" style="width:${size}px;height:${size}px"><svg viewBox="0 0 ${size} ${size}"><circle class="trk" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}"/><circle class="val" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - clamp(p, 0, 1))}"/></svg><div class="lbl">${label}</div></div>`;
}

const VIEWS = {};

/* ---------- Today ---------- */
VIEWS.today = () => {
  const tk = todayKey(), d = dateOf(tk);
  const over = overdueTasks();
  const todays = dayTasks(tk, false);
  const doneToday = state.tasks.filter((t) => t.done && t.doneDay === tk);
  const total = todays.length + doneToday.length;
  const planned = todays.reduce((s, t) => s + (t.dur || 0), 0);
  const cap = state.settings.dayCapacity || 480;
  let body = '';
  body += `<div class="hero">${ring(total ? doneToday.length / total : 0, total ? Math.round((doneToday.length / total) * 100) + '%' : '—')}
    <div class="hero-txt"><div class="k">${total ? `Сделано ${doneToday.length} из ${total}` : 'План на день пуст'}</div>
      <div class="v">${planned ? `Запланировано ${fmtDur(planned)} из ${fmtDur(cap)}` : 'Укажите длительность задач, чтобы видеть загрузку дня'}</div>
      ${planned ? `<div class="load-bar"><i class="${planned > cap ? 'over' : ''}" style="width:${Math.min(100, (planned / cap) * 100)}%"></i></div>` : ''}</div></div>`;
  if (hasExamples() && !state.meta.hideExampleBanner) {
    body += `<div class="banner"><div class="grow"><b>Это примеры.</b> Они показывают, как всё работает. Удалите их, когда освоитесь.</div><button class="btn sm soft" data-act="remove-examples">Удалить</button></div>`;
  }
  if (planned > cap) body += `<div class="banner warn"><div class="grow">День перегружен на <b>${fmtDur(planned - cap)}</b>. Перенесите что-то на завтра свайпом влево.</div></div>`;
  const hs = habitsToday();
  if (hs.length) {
    body += sec('Привычки', `<div class="habit-strip">${hs.map((h) => {
      const v = hVal(h, tk), dn = v >= h.target;
      return `<button class="hchip ${dn ? 'done' : ''}" style="--hc:${h.color}" data-act="habit-tick" data-id="${h.id}"><span class="hc">${dn ? ic('check', 'xs') : h.target > 1 ? v + '/' + h.target : ''}</span><span class="nm">${esc(h.name)}</span></button>`;
    }).join('')}</div>`, `<button class="link" data-act="tab" data-tab="habits">Все</button>`);
  }
  if (over.length) {
    body += sec(`Просрочено · ${over.length}`, taskGroup(over, { showList: true }), `<button class="link" data-act="move-overdue">На сегодня</button>`, 'danger');
  }
  if (todays.length) body += sec('На сегодня', taskGroup(todays, { hideDate: true, timeRight: true, showList: true }), `<button class="link" data-act="plan-day">Добавить из планов</button>`);
  else if (!over.length) {
    body += `<section class="sec">${emptyBox('День свободен', 'Добавьте задачу кнопкой «+» или возьмите из ближайших планов.', '<button class="btn soft" data-act="plan-day">' + ic('wand', 'sm') + 'Спланировать день</button>')}</section>`;
  }
  const inboxN = active().filter((t) => t.listId === 'inbox' && !t.date).length;
  if (inboxN) body += `<div class="banner" data-act="open-list" data-id="inbox" style="cursor:pointer">${ic('inbox')}<div class="grow">Во «Входящих» <b>${pl(inboxN, W_TASK)}</b> без срока. Разберите: назначьте дату или список.</div>${ic('chev', 'sm')}</div>`;
  if (doneToday.length && state.settings.showDoneToday) {
    const open = ui.showDone.today;
    body += sec(`Выполнено · ${doneToday.length}`, open ? taskGroup(doneToday, { hideDate: true, showList: true }) : '', `<button class="link" data-act="toggle-done" data-key="today">${open ? 'Скрыть' : 'Показать'}</button>`);
  }
  return {
    title: 'Сегодня',
    sub: `${WD_L[d.getDay()][0].toUpperCase() + WD_L[d.getDay()].slice(1)}, ${d.getDate()} ${MONTHS_G[d.getMonth()]}`,
    actions: `<button class="icon-btn" data-act="go" data-v="search" aria-label="Поиск">${ic('search')}</button><button class="icon-btn" data-act="plan-day" aria-label="Спланировать день">${ic('wand')}</button>`,
    body,
  };
};

/* ---------- Lists overview ---------- */
const SMART = {
  today: { name: 'Сегодня', icon: 'sun', color: '#2F5BEA' },
  upcoming: { name: 'Предстоящие', icon: 'calendar', color: '#E0393F' },
  inbox: { name: 'Входящие', icon: 'inbox', color: '#5F6B7D' },
  important: { name: 'Важное', icon: 'flag', color: '#E8890A' },
  all: { name: 'Все задачи', icon: 'list', color: '#15171C' },
  done: { name: 'Выполненные', icon: 'check', color: '#188A4E' },
};
VIEWS.lists = () => {
  const c = smartCounts();
  let body = `<div class="smart-grid" style="margin-top:6px">${Object.entries(SMART).map(([id, s]) => `
    <button class="smart" data-act="${id === 'today' ? 'tab' : id === 'inbox' ? 'open-list' : 'go'}" data-tab="today" data-id="inbox" data-v="smart" data-sid="${id}">
      <span class="ico-box" style="background:${s.color === '#15171C' ? 'var(--ink)' : s.color};color:${s.color === '#15171C' ? 'var(--bg)' : '#fff'}">${ic(s.icon)}</span>
      <span class="n">${c[id]}</span><span class="nm">${s.name}</span></button>`).join('')}</div>`;
  const lists = userLists();
  const rows = lists.map((l) => {
    const items = state.tasks.filter((t) => t.listId === l.id);
    const left = items.filter((t) => !t.done).length, all = items.length;
    const pct = all ? (all - left) / all : 0;
    return `<button class="row" data-act="open-list" data-id="${l.id}">
      <span class="ico-box" style="background:${l.color}">${l.emoji ? `<span>${esc(l.emoji)}</span>` : ic(l.type === 'shopping' ? 'cart' : 'list')}</span>
      <span class="grow r-title">${esc(l.name)}</span>
      ${all && l.type !== 'shopping' ? `<span class="prog"><i style="width:${pct * 100}%;background:${l.color}"></i></span>` : ''}
      <span class="r-end">${left}</span>${ic('chev', 'sm chev')}</button>`;
  }).join('');
  body += sec('Мои списки', lists.length ? `<div class="group">${rows}</div>` : emptyBox('Списков пока нет', 'Создайте список для работы, учёбы, дома или покупок.'),
    `<button class="link" data-act="new-list">Новый</button>`);
  body += `<div class="btn-row" style="margin-top:10px"><button class="btn ghost sm" data-act="new-list">${ic('plus', 'sm')}Список</button><button class="btn ghost sm" data-act="new-list" data-type="shopping">${ic('cart', 'sm')}Покупки</button><button class="btn ghost sm" data-act="go" data-v="templates">${ic('layers', 'sm')}Шаблон</button></div>`;
  const tags = allTags();
  if (tags.length) body += sec('Метки', `<div class="chips">${tags.map(([g, n]) => `<button class="chip" data-act="go" data-v="tag" data-tag="${esc(g)}">#${esc(g)} <span style="color:var(--ink-3)">${n}</span></button>`).join('')}</div>`);
  return {
    title: 'Списки',
    actions: `<button class="icon-btn" data-act="go" data-v="search" aria-label="Поиск">${ic('search')}</button><button class="icon-btn" data-act="new-list" aria-label="Новый список">${ic('plus')}</button>`,
    body,
  };
};

/* ---------- One list ---------- */
VIEWS.list = (v) => {
  const l = state.lists.find((x) => x.id === v.id);
  if (!l) { ui.stack[ui.tab].pop(); return VIEWS[curView().v](curView()); }
  const items = state.tasks.filter((t) => t.listId === l.id);
  const open = items.filter((t) => !t.done), done = items.filter((t) => t.done);
  const showDone = ui.showDone[l.id];
  let body = '';
  if (l.type === 'shopping') {
    if (open.length) {
      body += groupShop(open).map(([cat, arr]) => sec(cat, taskGroup(arr, { hideDate: true }))).join('');
    } else {
      body += `<section class="sec">${emptyBox(done.length ? 'Всё куплено' : 'Список пуст', done.length ? 'Снимите отметки, чтобы использовать список снова.' : 'Добавьте товары кнопкой «+». Можно вставить сразу несколько строк.')}</section>`;
    }
    const sug = shopSuggestions(l.id);
    if (sug.length) body += sec('Часто покупаете', `<div class="chips">${sug.map((s) => `<button class="chip" data-act="shop-add" data-name="${esc(s.name)}" data-id="${l.id}">${ic('plus', 'xs')}${esc(s.name)}</button>`).join('')}</div>`);
    if (done.length) {
      body += sec(`В корзине · ${done.length}`, showDone ? taskGroup(done, { hideDate: true }) : '',
        `<button class="link" data-act="toggle-done" data-key="${l.id}">${showDone ? 'Скрыть' : 'Показать'}</button>`);
      body += `<div class="btn-row" style="margin-top:12px"><button class="btn ghost sm" data-act="shop-reset" data-id="${l.id}">${ic('reset', 'sm')}Снять отметки</button><button class="btn danger sm" data-act="shop-clear" data-id="${l.id}">${ic('trash', 'sm')}Убрать купленное</button></div>`;
    }
  } else {
    if (open.length) body += `<section class="sec">${taskGroup(sortTasks(open, l.sort || 'manual'), { notes: true })}</section>`;
    else body += `<section class="sec">${emptyBox(done.length ? 'Всё сделано' : 'Пока пусто', done.length ? 'Отличная работа. Добавьте новые задачи кнопкой «+».' : 'Добавьте задачу кнопкой «+». Можно вставить список из заметок — каждая строка станет задачей.')}</section>`;
    if (done.length) body += sec(`Выполнено · ${done.length}`, showDone ? taskGroup(done.sort((a, b) => b.doneAt - a.doneAt)) : '', `<button class="link" data-act="toggle-done" data-key="${l.id}">${showDone ? 'Скрыть' : 'Показать'}</button>`);
  }
  const sub = l.type === 'shopping' ? (open.length ? `Осталось купить: ${open.length}` : 'Список покупок') : `${pl(open.length, W_TASK)}${done.length ? ` · выполнено ${done.length}` : ''}`;
  return {
    title: `${l.emoji ? esc(l.emoji) + ' ' : ''}${esc(l.name)}`, sub, backLabel: 'Списки',
    actions: `<button class="icon-btn" data-act="sel-start" aria-label="Выбрать несколько">${ic('select')}</button><button class="icon-btn" data-act="list-menu" data-id="${l.id}" aria-label="Меню списка">${ic('dots')}</button>`,
    body, ctx: { listId: l.id },
  };
};

/* ---------- Smart lists & tags ---------- */
VIEWS.smart = (v) => {
  const s = SMART[v.sid], tk = todayKey();
  let body = '', items = [];
  if (v.sid === 'upcoming') {
    items = active().filter((t) => t.date && t.date > tk).sort(cmpTask);
    const week = [];
    for (let i = 1; i <= 7; i++) week.push(addDays(tk, i));
    week.forEach((k) => {
      const arr = items.filter((t) => t.date === k);
      body += sec(fmtDay(k, { wd: true }), arr.length ? taskGroup(arr, { hideDate: true, timeRight: true, showList: true }) : '<div class="group"><div class="empty-inline">Свободно</div></div>', `<button class="link" data-act="quick-add" data-date="${k}">+ Задача</button>`);
    });
    const later = items.filter((t) => t.date > week[6]);
    if (later.length) body += sec('Позже', taskGroup(later, { showList: true }));
  } else if (v.sid === 'important') {
    items = active().filter((t) => t.priority >= 2).sort(cmpTask);
    [3, 2].forEach((p) => { const arr = items.filter((t) => t.priority === p); if (arr.length) body += sec(PRIO[p].name + ' приоритет', taskGroup(arr, { showList: true })); });
    if (!items.length) body = `<section class="sec">${emptyBox('Нет важных задач', 'Поставьте задаче приоритет «Средний» или «Высокий» — или добавьте «!!» и «!!!» при вводе.')}</section>`;
  } else if (v.sid === 'all') {
    items = active();
    state.lists.forEach((l) => { const arr = sortTasks(items.filter((t) => t.listId === l.id), 'date'); if (arr.length) body += sec(esc(l.name), taskGroup(arr)); });
    if (!items.length) body = `<section class="sec">${emptyBox('Задач нет', 'Добавьте первую задачу кнопкой «+».')}</section>`;
  } else if (v.sid === 'done') {
    items = state.tasks.filter((t) => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)).slice(0, 300);
    const byDay = new Map();
    items.forEach((t) => { const k = t.doneDay || tk; if (!byDay.has(k)) byDay.set(k, []); byDay.get(k).push(t); });
    byDay.forEach((arr, k) => { body += sec(fmtDay(k, { wd: true }), taskGroup(arr, { showList: true, hideDate: true })); });
    if (!items.length) body = `<section class="sec">${emptyBox('Пока ничего', 'Здесь появится история выполненных задач.')}</section>`;
    else body += `<div style="margin-top:14px"><button class="btn danger block" data-act="clear-done">${ic('trash', 'sm')}Удалить выполненные старше 30 дней</button></div>`;
  }
  return { title: s.name, sub: v.sid === 'done' ? '' : pl(v.sid === 'upcoming' ? items.length : items.length, W_TASK), backLabel: 'Списки', body, ctx: v.sid === 'important' ? { priority: 3 } : {} };
};
VIEWS.tag = (v) => {
  const items = state.tasks.filter((t) => t.tags.includes(v.tag));
  const open = items.filter((t) => !t.done).sort(cmpTask), done = items.filter((t) => t.done);
  let body = open.length ? `<section class="sec">${taskGroup(open, { showList: true })}</section>` : `<section class="sec">${emptyBox('Нет активных задач', 'Добавьте задачу с этой меткой: просто напишите #' + esc(v.tag) + ' в тексте.')}</section>`;
  if (done.length) body += sec(`Выполнено · ${done.length}`, ui.showDone['tag:' + v.tag] ? taskGroup(done, { showList: true }) : '', `<button class="link" data-act="toggle-done" data-key="tag:${esc(v.tag)}">${ui.showDone['tag:' + v.tag] ? 'Скрыть' : 'Показать'}</button>`);
  return { title: '#' + esc(v.tag), sub: pl(open.length, W_TASK), backLabel: 'Списки', body, ctx: { tags: [v.tag] } };
};

/* ---------- Calendar ---------- */
VIEWS.cal = () => {
  const tk = todayKey();
  if (!ui.calSel) ui.calSel = tk;
  if (!ui.calMonth) ui.calMonth = ui.calSel.slice(0, 7);
  const [y, m] = ui.calMonth.split('-').map(Number);
  const first = `${y}-${pad(m)}-01`;
  const gridStart = weekStartOf(first);
  const counts = {};
  active().forEach((t) => { if (t.date) { const c = counts[t.date] || (counts[t.date] = { n: 0, late: 0 }); c.n++; if (t.date < tk) c.late++; } });
  const ws = state.settings.weekStart;
  const wdh = [0, 1, 2, 3, 4, 5, 6].map((i) => (i + ws) % 7);
  let cells = '';
  for (let i = 0; i < 42; i++) {
    const k = addDays(gridStart, i), dd = dateOf(k);
    if (i === 35 && dd.getMonth() + 1 !== m) break;
    const c = counts[k];
    const cls = ['cd', dd.getMonth() + 1 !== m ? 'out' : '', k === tk ? 'today' : '', k === ui.calSel ? 'sel' : '', [0, 6].includes(dd.getDay()) ? 'we' : ''].join(' ');
    cells += `<button class="${cls}" data-act="cal-day" data-k="${k}"><span class="d">${dd.getDate()}</span><span class="dots">${c ? Array.from({ length: Math.min(3, c.n) }, (_, j) => `<i class="${j < c.late ? 'late' : ''}"></i>`).join('') : ''}</span></button>`;
  }
  const sel = ui.calSel, selD = dateOf(sel);
  const dayItems = dayTasks(sel, true);
  const mode = prefs.calMode || 'list';
  let body = `<div class="cal-head"><span class="m">${MONTHS[m - 1]} ${y}</span>
    <button class="icon-btn" data-act="cal-nav" data-d="-1" aria-label="Предыдущий месяц">${ic('back')}</button>
    <button class="btn ghost sm" data-act="cal-today">Сегодня</button>
    <button class="icon-btn" data-act="cal-nav" data-d="1" aria-label="Следующий месяц">${ic('chev')}</button></div>
    <div class="cal" id="cal"><div class="cal-wd">${wdh.map((w) => `<div class="${[0, 6].includes(w) ? 'we' : ''}">${WD_S[w]}</div>`).join('')}</div><div class="cal-grid">${cells}</div></div>`;
  const open = dayItems.filter((t) => !t.done);
  const load = open.reduce((s, t) => s + (t.dur || 0), 0);
  body += `<div class="day-title"><b>${fmtDay(sel, { wd: true })}</b><span>${dayItems.length ? pl(open.length, W_TASK) + (load ? ' · ' + fmtDur(load) : '') : ''}</span></div>`;
  body += `<div class="seg" style="margin-bottom:10px"><button class="${mode === 'list' ? 'on' : ''}" data-act="cal-mode" data-m="list">Список</button><button class="${mode === 'timeline' ? 'on' : ''}" data-act="cal-mode" data-m="timeline">Расписание</button></div>`;
  if (mode === 'timeline') body += timeline(sel, dayItems);
  else body += dayItems.length ? taskGroup(dayItems, { hideDate: true, timeRight: true, showList: true }) : emptyBox(selD < dateOf(tk) ? 'Нет задач' : 'День свободен', 'Нажмите «+», чтобы добавить задачу на этот день.');
  return {
    title: 'Календарь', body, ctx: { date: sel },
    actions: `<button class="icon-btn" data-act="go" data-v="search" aria-label="Поиск">${ic('search')}</button>`,
    after: () => {
      const box = $('#tl-scroll');
      if (box) {
        const first = dayItems.filter((t) => t.time).map((t) => timeToMin(t.time)).sort((a, b) => a - b)[0];
        const h = sel === tk ? Math.max(0, new Date().getHours() - 1) : first != null ? Math.max(0, Math.floor(first / 60) - 1) : 8;
        box.scrollTop = h * 56;
      }
    },
  };
};
function timeline(k, items) {
  const HH = 56, timed = items.filter((t) => t.time), untimed = items.filter((t) => !t.time);
  let out = '';
  if (untimed.length) out += `<div class="sec-h" style="margin-top:4px">Без времени</div>${taskGroup(untimed, { hideDate: true })}<div style="height:14px"></div>`;
  // place events, side-by-side when overlapping
  const evs = timed.map((t) => ({ t, s: timeToMin(t.time), e: timeToMin(t.time) + Math.max(20, t.dur || 30) })).sort((a, b) => a.s - b.s);
  const cols = [];
  evs.forEach((ev) => { let c = cols.findIndex((end) => end <= ev.s); if (c < 0) { c = cols.length; cols.push(0); } cols[c] = ev.e; ev.c = c; });
  evs.forEach((ev) => { ev.n = Math.max(1, ...evs.filter((o) => o.s < ev.e && o.e > ev.s).map((o) => o.c + 1)); });
  let hours = '';
  for (let h = 0; h < 24; h++) hours += `<div class="tl-h"><div class="hl">${pad(h)}:00</div><button class="slot" data-act="quick-add" data-date="${k}" data-time="${pad(h)}:00" aria-label="Добавить на ${pad(h)}:00"></button></div>`;
  const blocks = evs.map((ev) => {
    const l = listById(ev.t.listId), w = 100 / ev.n;
    return `<button class="tl-ev ${ev.t.done ? 'done' : ''}" data-act="open" data-id="${ev.t.id}" style="--ec:${l.id === 'inbox' ? 'var(--accent)' : l.color};top:${(ev.s / 60) * HH + 1}px;height:${Math.max(26, ((ev.e - ev.s) / 60) * HH - 2)}px;left:calc(56px + (100% - 64px) * ${(ev.c * w) / 100});right:auto;width:calc((100% - 64px) * ${w / 100} - 3px)">
      <b>${esc(ev.t.title)}</b><span>${ev.t.time}–${minToTime(ev.e % 1440)}</span></button>`;
  }).join('');
  const now = k === todayKey() ? `<div class="tl-now" style="top:${(nowMin() / 60) * HH}px"></div>` : '';
  out += `<div class="tl-scroll" id="tl-scroll"><div class="tl" id="tl">${hours}${blocks}${now}</div></div><p class="foot-note">Нажмите на свободный час, чтобы запланировать задачу на это время.</p>`;
  return out;
}

/* ---------- selection bar ---------- */
function selBar() {
  const n = ui.sel.size, dis = n ? '' : 'disabled';
  return `<div class="sel-bar">
    <button data-act="sel-do" data-op="today" ${dis}>${ic('sun')}Сегодня</button>
    <button data-act="sel-do" data-op="tomorrow" ${dis}>${ic('sunrise')}Завтра</button>
    <button data-act="sel-do" data-op="move" ${dis}>${ic('folder')}Список</button>
    <button data-act="sel-do" data-op="prio" ${dis}>${ic('flag')}Важность</button>
    <button data-act="sel-do" data-op="tpl" ${dis}>${ic('layers')}В шаблон</button>
    <button data-act="sel-do" data-op="done" ${dis}>${ic('check')}Готово</button>
    <button class="danger" data-act="sel-do" data-op="delete" ${dis}>${ic('trash')}Удалить</button></div>`;
}
function visibleTaskIds() { return $$('.screen .swipe[data-id]').map((e) => e.dataset.id); }
