'use strict';
/* ===== Views part 2: Habits, More, Focus, Matrix, Stats, Search, Templates, Settings, Data, Help ===== */

const IN_CLAUDE = !!(window.claude && typeof window.claude.use === 'function');

/* ---------- Habits ---------- */
const HABIT_IDEAS = [['Пить воду', 8, 'стак.', '#0E9BB0'], ['Зарядка', 1, '', '#E8890A'], ['Читать 20 минут', 1, '', '#8B4FD8'], ['Прогулка', 1, '', '#188A4E'], ['Английский 15 минут', 1, '', '#2F5BEA'], ['Медитация', 1, '', '#D6409F'], ['Без сладкого', 1, '', '#E0393F'], ['Лечь до 23:00', 1, '', '#5F6B7D']];
function habitCard(h) {
  const tk = todayKey(), v = hVal(h, tk), dn = v >= h.target, st = hStreak(h);
  const ws = weekStartOf(tk);
  const week = Array.from({ length: 7 }, (_, i) => {
    const k = addDays(ws, i), val = hVal(h, k), full = val >= h.target, sch = hSched(h, k);
    const cls = full ? 'full' : val ? 'part' : (!sch ? 'off' : '');
    return `<button class="hday ${k === tk ? 'today' : ''}" data-act="habit-day" data-id="${h.id}" data-k="${k}" ${k > tk ? 'disabled' : ''}><span>${WD_S[wdOf(k)]}</span><i class="${cls}">${full ? '' : val || dateOf(k).getDate()}</i></button>`;
  }).join('');
  const sub = [habitSchedLabel(h), st.n ? `серия ${st.n} ${st.unit}` : '', h.perWeek ? `на этой неделе ${hWeekCount(h, tk)}/${h.perWeek}` : ''].filter(Boolean).join(' · ');
  return `<div class="habit" style="--hc:${h.color}">
    <div class="habit-top"><button class="grow" data-act="go" data-v="habit" data-id="${h.id}"><div class="nm">${esc(h.name)}${h.example ? ' <span class="example-flag">пример</span>' : ''}</div><div class="st">${sub}</div></button>
      ${h.target > 1 ? `<button class="hbtn" style="width:40px;height:40px;border-width:2px" data-act="habit-minus" data-id="${h.id}" aria-label="Минус один" ${v ? '' : 'disabled'}>${ic('minus')}</button>` : ''}
      <button class="hbtn ${dn ? 'done' : ''}" data-act="habit-tick" data-id="${h.id}" aria-label="Отметить">${dn ? ic('check') : h.target > 1 ? `${v}/${h.target}` : ''}</button></div>
    <div class="hweek">${week}</div></div>`;
}
VIEWS.habits = () => {
  const list = state.habits.filter((h) => !h.archived).sort((a, b) => a.order - b.order);
  const tk = todayKey(), td = habitsToday(), dn = td.filter((h) => hDone(h, tk)).length;
  let body = '';
  if (list.length) body += `<div style="margin-top:6px">${list.map(habitCard).join('')}</div>`;
  body += sec(list.length ? 'Идеи' : 'С чего начать', `${list.length ? '' : '<p class="help" style="margin:0 4px 10px">Привычка — это действие, которое вы хотите делать регулярно. Отмечайте его каждый день и следите за серией без пропусков.</p>'}
    <div class="chips">${HABIT_IDEAS.filter((x) => !list.some((h) => h.name === x[0])).map((x, i) => `<button class="chip" data-act="habit-idea" data-i="${HABIT_IDEAS.indexOf(x)}">${ic('plus', 'xs')}${esc(x[0])}</button>`).join('')}</div>`);
  const archived = state.habits.filter((h) => h.archived);
  if (archived.length) body += sec('В архиве', `<div class="group">${archived.map((h) => `<button class="row" data-act="go" data-v="habit" data-id="${h.id}"><i class="dot" style="background:${h.color}"></i><span class="grow r-title">${esc(h.name)}</span>${ic('chev', 'sm chev')}</button>`).join('')}</div>`);
  return {
    title: 'Привычки', sub: td.length ? `Сегодня: ${dn} из ${td.length}` : '', fab: false,
    actions: `<button class="icon-btn" data-act="habit-new" aria-label="Новая привычка">${ic('plus')}</button>`, body,
  };
};
VIEWS.habit = (v) => {
  const h = habitById(v.id);
  if (!h) { ui.stack[ui.tab].pop(); return VIEWS[curView().v](curView()); }
  const tk = todayKey(), st = hStreak(h);
  const mk = v.m || tk.slice(0, 7);
  const [y, m] = mk.split('-').map(Number);
  const first = `${y}-${pad(m)}-01`, start = weekStartOf(first);
  let cells = [0, 1, 2, 3, 4, 5, 6].map((i) => `<div class="blank" style="aspect-ratio:auto;font-weight:600">${WD_S[(i + state.settings.weekStart) % 7]}</div>`).join('');
  for (let i = 0; i < 42; i++) {
    const k = addDays(start, i), d = dateOf(k);
    if (i >= 35 && d.getMonth() + 1 !== m) break;
    if (d.getMonth() + 1 !== m) { cells += '<div class="blank"></div>'; continue; }
    const val = hVal(h, k);
    cells += `<div class="${val >= h.target ? 'full' : val ? 'part' : ''}" data-act="${k <= tk ? 'habit-day' : ''}" data-id="${h.id}" data-k="${k}">${d.getDate()}</div>`;
  }
  const prevM = addMonths(first, -1).slice(0, 7), nextM = addMonths(first, 1).slice(0, 7);
  let body = `<div class="stat-row" style="margin-top:6px">
    <div class="stat"><div class="v">${st.n}</div><div class="k">Текущая серия, ${h.perWeek ? 'нед.' : 'дн.'}</div></div>
    <div class="stat"><div class="v">${hBest(h)}</div><div class="k">Лучшая серия</div></div>
    <div class="stat"><div class="v">${hRate(h)}%</div><div class="k">За 30 дней</div></div></div>`;
  body += `<section class="sec"><div class="cal-head"><span class="m">${MONTHS[m - 1]} ${y}</span>
    <button class="icon-btn" data-act="habit-month" data-m="${prevM}" aria-label="Предыдущий месяц">${ic('back')}</button>
    <button class="icon-btn" data-act="habit-month" data-m="${nextM}" aria-label="Следующий месяц">${ic('chev')}</button></div>
    <div class="cal" style="--hc:${h.color};padding:10px"><div class="heat">${cells}</div></div>
    <p class="foot-note">Нажмите на день, чтобы отметить или снять отметку${h.target > 1 ? ` (цель: ${h.target} ${esc(h.unit || '')} в день)` : ''}.</p></section>`;
  body += `<div class="btn-row" style="margin-top:16px"><button class="btn ghost" data-act="habit-edit" data-id="${h.id}">${ic('edit', 'sm')}Изменить</button>
    <button class="btn ghost" data-act="habit-archive" data-id="${h.id}">${h.archived ? 'Вернуть' : 'В архив'}</button></div>
    <button class="btn danger block" style="margin-top:10px" data-act="habit-delete" data-id="${h.id}">${ic('trash', 'sm')}Удалить привычку</button>`;
  return { title: esc(h.name), sub: habitSchedLabel(h), backLabel: 'Привычки', body, fab: false };
};

/* ---------- More ---------- */
VIEWS.more = () => {
  const item = (v, icon, color, name, sub) => `<button class="row" data-act="go" data-v="${v}"><span class="ico-box" style="background:${color}">${ic(icon)}</span><span class="grow"><span class="r-title">${name}</span><br><span class="r-sub">${sub}</span></span>${ic('chev', 'sm chev')}</button>`;
  const fm = state.focus.log[todayKey()] || 0;
  let body = `<section class="sec"><div class="group">
    ${item('focus', 'timer', '#E0393F', 'Фокус-таймер', Focus.running ? `Идёт: ${Focus.fmt(Focus.remaining())}` : fm ? `Сегодня в фокусе: ${fmtDur(fm)}` : 'Работа короткими подходами с перерывами')}
    ${item('matrix', 'matrix', '#2F5BEA', 'Матрица Эйзенхауэра', 'Что делать сейчас, что запланировать, что отложить')}
    ${item('stats', 'chart', '#188A4E', 'Статистика', 'Выполненные задачи, фокус, привычки')}
    ${item('templates', 'layers', '#8B4FD8', 'Шаблоны', 'Поездка, экзамен, проект, уборка, покупки')}
    ${item('search', 'search', '#5F6B7D', 'Поиск', 'По задачам, заметкам, меткам и подзадачам')}</div></section>
    <section class="sec"><div class="group">
    ${item('settings', 'sliders', '#5F6B7D', 'Настройки', 'Тема, неделя, умный ввод, таймер')}
    ${item('data', 'download', '#0E9BB0', 'Данные и копия', IN_CLAUDE && Sync.on ? 'Синхронизация включена' : 'Резервная копия, экспорт в Календарь')}
    ${item('help', 'phone', '#15171C', 'Как пользоваться', 'Установка на iPhone, жесты, умный ввод')}</div></section>`;
  return { title: 'Ещё', body };
};

/* ---------- Focus (pomodoro) ---------- */
VIEWS.focus = () => {
  const F = Focus, s = state.settings, tk = todayKey();
  const len = F.len() * 60, rem = F.remaining();
  const t = F.taskId ? taskById(F.taskId) : null;
  const r = 120, c = 2 * Math.PI * r;
  const count = state.focus.count[tk] || 0;
  const body = `<div class="seg" style="margin-top:6px">${[['focus', 'Фокус'], ['short', 'Перерыв'], ['long', 'Длинный']].map(([m, n]) => `<button class="${F.mode === m ? 'on' : ''}" data-act="focus-mode" data-m="${m}">${n}</button>`).join('')}</div>
    <div class="focus-wrap">
      <div class="focus-ring ${F.mode !== 'focus' ? 'brk' : ''}"><svg viewBox="0 0 260 260"><circle class="trk" cx="130" cy="130" r="${r}" fill="none" stroke-width="10"/><circle id="f-arc" class="val" cx="130" cy="130" r="${r}" fill="none" stroke-width="10" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - rem / len)}" data-c="${c}"/></svg>
        <div class="c"><div class="t" id="f-time">${F.fmt(rem)}</div><div class="s">${F.mode === 'focus' ? (F.running ? 'Сосредоточьтесь' : 'Готовы начать?') : 'Отдохните, разомнитесь'}</div></div></div>
      <div class="pomos">${Array.from({ length: s.longEvery }, (_, i) => `<i class="${i < F.cycles % s.longEvery ? 'on' : ''}"></i>`).join('')}</div>
      <div class="focus-ctrl">
        <button class="round" data-act="focus-reset" aria-label="Сбросить">${ic('reset')}</button>
        <button class="round main" data-act="focus-toggle" aria-label="${F.running ? 'Пауза' : 'Старт'}">${ic(F.running ? 'pause' : 'play')}</button>
        <button class="round" data-act="focus-skip" aria-label="Пропустить">${ic('skip')}</button></div>
      <div class="focus-task"><div class="group"><button class="row" data-act="focus-pick">${ic('target')}<span class="grow"><span class="r-title">${t ? esc(t.title) : 'Выбрать задачу'}</span>${t && t.focusMin ? `<br><span class="r-sub">В фокусе: ${fmtDur(t.focusMin)}</span>` : '<br><span class="r-sub">Время фокуса запишется в задачу</span>'}</span>${t ? `<span class="icon-btn" data-act="focus-clear" style="color:var(--ink-3)">${ic('x', 'sm')}</span>` : ic('chev', 'sm chev')}</button>
        ${t ? `<button class="row" data-act="focus-done">${ic('check')}<span class="grow r-title">Задача выполнена</span></button>` : ''}</div></div>
    </div>
    <div class="stat-row" style="margin-top:22px"><div class="stat"><div class="v">${count}</div><div class="k">Подходов сегодня</div></div>
      <div class="stat"><div class="v">${fmtDur(state.focus.log[tk] || 0) || '0'}</div><div class="k">В фокусе сегодня</div></div>
      <div class="stat"><div class="v">${s.focusLen}/${s.shortBreak}</div><div class="k">Минут фокус/перерыв</div></div></div>
    <p class="foot-note">Таймер продолжает считать, даже если свернуть приложение. Длительность меняется в «Настройках».</p>`;
  return { title: 'Фокус', backLabel: 'Ещё', body, fab: false };
};

/* ---------- Eisenhower matrix ---------- */
VIEWS.matrix = () => {
  const lim = addDays(todayKey(), 1);
  const items = active().filter((t) => listById(t.listId).type !== 'shopping');
  const imp = (t) => t.priority >= 2, urg = (t) => t.date && t.date <= lim;
  const Q = [
    ['q1', 'Сделать сейчас', 'Важно и срочно', items.filter((t) => imp(t) && urg(t))],
    ['q2', 'Запланировать', 'Важно, не срочно', items.filter((t) => imp(t) && !urg(t))],
    ['q3', 'Делегировать', 'Срочно, не важно', items.filter((t) => !imp(t) && urg(t))],
    ['q4', 'Отложить', 'Не срочно и не важно', items.filter((t) => !imp(t) && !urg(t))],
  ];
  const body = `<div class="mx" style="margin-top:6px">${Q.map(([c, n, sub, arr]) => `<div class="mq ${c}"><div class="mq-h">${n}<span class="n">${arr.length}</span></div><div class="mq-sub">${sub}</div>
      ${arr.sort(cmpTask).slice(0, 8).map((t) => `<button class="mq-item" data-act="open" data-id="${t.id}"><i class="dot" style="background:${listById(t.listId).color}"></i><span>${esc(t.title)}${t.date ? ` <span style="color:var(--ink-3)">· ${fmtShort(t.date)}</span>` : ''}</span></button>`).join('')}
      ${arr.length > 8 ? `<div class="mq-sub">и ещё ${arr.length - 8}</div>` : ''}${!arr.length ? '<div class="mq-sub" style="margin-top:6px">Пусто</div>' : ''}</div>`).join('')}</div>
    <p class="foot-note"><b>Важно</b> — приоритет «Средний» или «Высокий». <b>Срочно</b> — срок сегодня, завтра или уже прошёл. Откройте задачу, чтобы поменять приоритет или дату, и она переместится в нужный квадрат.</p>`;
  return { title: 'Матрица', sub: 'Решите, чем заняться в первую очередь', backLabel: 'Ещё', body };
};

/* ---------- Stats ---------- */
const STAT_PERIODS = [['week', 'Неделя', 7], ['month', 'Месяц', 30], ['year', 'Год', 365], ['all', 'Всё время', 0]];
/* Bars on one scale; items: [{v, label, tip, hl}] */
function bars(id, items, height = 120) {
  const max = Math.max(1, ...items.map((x) => x.v));
  const step = max <= 4 ? 1 : max <= 10 ? 2 : max <= 25 ? 5 : max <= 60 ? 15 : max <= 120 ? 30 : max <= 300 ? 60 : Math.ceil(max / 5 / 100) * 100;
  const top = Math.ceil(max / step) * step;
  const lines = [];
  for (let v = step; v <= top; v += step) lines.push(`<div class="gl" style="bottom:${(v / top) * 100}%"><span>${v}</span></div>`);
  return `<div class="bars" id="${id}" style="height:${height}px">${lines.join('')}${items.map((x) => `<button class="bar ${x.hl ? 'today' : ''}" data-act="bar-tip" data-chart="${id}" data-tip="${esc(x.tip)}" aria-label="${esc(x.tip)}"><i style="height:${(x.v / top) * 100}%"></i></button>`).join('')}</div>
    <div class="bar-x">${items.map((x) => `<span class="${x.hl ? 't' : ''}">${x.label}</span>`).join('')}</div>`;
}
function hbars(rows, unit = '') {
  const mx = Math.max(1, ...rows.map((r) => r.v));
  return rows.map((r) => `<div class="hbar"><span class="nm">${r.color ? `<i class="dot" style="background:${r.color}"></i>` : ''}${esc(r.name)}</span>
    <span class="tr"><i style="width:${(r.v / mx) * 100}%;background:${r.color || 'var(--accent)'}"></i></span><span class="v">${r.text != null ? r.text : r.v + unit}</span></div>`).join('');
}
const tile = (v, k, sub) => `<div class="stat"><div class="v">${v}</div><div class="k">${k}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>`;
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
function dayStreaks() {
  const keys = Object.keys(state.doneLog).filter((k) => state.doneLog[k] > 0).sort();
  let best = 0, run = 0, prev = null;
  keys.forEach((k) => { run = prev && diffDays(prev, k) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = k; });
  const tk = todayKey();
  let cur = 0, k = (state.doneLog[tk] || 0) ? tk : addDays(tk, -1);
  while ((state.doneLog[k] || 0) > 0 && cur < 3650) { cur++; k = addDays(k, -1); }
  return { cur, best };
}
VIEWS.stats = () => {
  const tk = todayKey(), period = prefs.statPeriod || 'week';
  const P = STAT_PERIODS.find((x) => x[0] === period) || STAT_PERIODS[0];
  // the "all time" range starts at the earliest thing the planner knows about
  const firstKey = [...Object.keys(state.doneLog), ...state.tasks.map((t) => keyOf(new Date(t.created))), ...Object.keys(state.focus.log)].sort()[0] || tk;
  const from = P[2] ? addDays(tk, -(P[2] - 1)) : (firstKey < tk ? firstKey : tk);
  const span = diffDays(from, tk) + 1;
  const inR = (k) => k && k >= from && k <= tk;
  const sumLog = (log, a, b) => Object.keys(log).reduce((s, k) => (k >= a && k <= b ? s + (log[k] || 0) : s), 0);
  const done = sumLog(state.doneLog, from, tk);
  const prevDone = P[2] ? sumLog(state.doneLog, addDays(from, -P[2]), addDays(from, -1)) : null;
  const doneTasks = state.tasks.filter((t) => t.done && inR(t.doneDay));
  const created = state.tasks.filter((t) => !t.fromRepeat && inR(keyOf(new Date(t.created))));
  const createdDone = created.filter((t) => t.done).length;
  const withDate = doneTasks.filter((t) => t.date);
  const late = withDate.filter((t) => t.doneDay > t.date);
  const onTime = withDate.length - late.length;
  const avgLate = late.length ? Math.round((late.reduce((s, t) => s + diffDays(t.date, t.doneDay), 0) / late.length) * 10) / 10 : 0;
  let activeDays = 0, best = { v: 0, k: null };
  for (let i = 0; i < span; i++) { const k = addDays(from, i), v = state.doneLog[k] || 0; if (v) activeDays++; if (v > best.v) best = { v, k }; }
  const st = dayStreaks();
  const fmtN = (n) => n.toLocaleString('ru-RU');
  const delta = prevDone == null ? '' : (done - prevDone === 0 ? 'как в прошлый период' : `${done > prevDone ? '+' : ''}${done - prevDone} к прошлому периоду`);

  let body = `<div class="seg" style="margin-top:6px">${STAT_PERIODS.map(([k, n]) => `<button class="${k === period ? 'on' : ''}" data-act="stat-period" data-p="${k}">${n}</button>`).join('')}</div>
    <p class="foot-note" style="margin:8px 4px 0">${period === 'all' ? `С ${fmtDay(from, { noRel: true })} — ${pl(span, W_DAY)}` : `${fmtDay(from, { noRel: true })} — сегодня`}</p>`;

  body += `<div class="stat-row" style="margin-top:10px">${tile(fmtN(done), 'Выполнено задач', delta)}${tile(fmtN(created.length), 'Создано задач', created.length ? `из них сделано ${pct(createdDone, created.length)}%` : '')}${tile(withDate.length ? pct(onTime, withDate.length) + '%' : '—', 'Сделано в срок', withDate.length ? `${onTime} из ${withDate.length} со сроком` : 'нет задач со сроком')}</div>
    <div class="stat-row" style="margin-top:10px">${tile(`${activeDays}<small>/${span}</small>`, 'Дней с делами', `${pct(activeDays, span)}% дней`)}${tile((Math.round((done / span) * 10) / 10).toLocaleString('ru-RU'), 'В среднем в день', activeDays ? `${(Math.round((done / activeDays) * 10) / 10).toLocaleString('ru-RU')} в рабочий день` : '')}${tile(best.v, 'Рекорд за день', best.k ? fmtDay(best.k, { noRel: true }) : '')}</div>`;

  // completed over time: days for week/month, months for year/all time
  let items = [];
  if (span <= 31) {
    items = Array.from({ length: span }, (_, i) => { const k = addDays(from, i), v = state.doneLog[k] || 0; return { v, hl: k === tk, label: span <= 7 ? WD_S[wdOf(k)] : (i % 5 === (span - 1) % 5 ? dateOf(k).getDate() : ''), tip: `${fmtDay(k, { wd: true })}: ${pl(v, W_TASK)}` }; });
  } else {
    const months = []; let m = from.slice(0, 7);
    while (m <= tk.slice(0, 7)) { months.push(m); m = addMonths(m + '-01', 1).slice(0, 7); }
    const shown = months.slice(-24);
    items = shown.map((mk, i) => { const [y, mo] = mk.split('-').map(Number); const v = sumLog(state.doneLog, mk + '-01', mk + '-31'); return { v, hl: mk === tk.slice(0, 7), label: shown.length <= 12 || i % 2 === (shown.length - 1) % 2 ? MONTHS_S[mo - 1] : '', tip: `${MONTHS[mo - 1]} ${y}: ${pl(v, W_TASK)}` }; });
  }
  body += `<section class="sec"><div class="chart"><div class="chart-h"><b>Выполнено ${span <= 31 ? 'по дням' : 'по месяцам'}</b><span>всего ${fmtN(done)}</span></div>
    <div class="chart-tip" id="tip-c1">Нажмите на столбец, чтобы увидеть число</div>${bars('c1', items)}</div></section>`;

  // weekdays: which days of the week get things done
  const wd = [0, 0, 0, 0, 0, 0, 0];
  Object.keys(state.doneLog).forEach((k) => { if (inR(k)) wd[wdOf(k)] += state.doneLog[k]; });
  const order = [0, 1, 2, 3, 4, 5, 6].map((i) => (i + state.settings.weekStart) % 7);
  const wmax = Math.max(...wd);
  body += `<section class="sec"><div class="chart"><div class="chart-h"><b>По дням недели</b><span>${wmax ? 'больше всего — ' + WD_L[wd.indexOf(wmax)] : 'пока нет данных'}</span></div>
    <div class="chart-tip" id="tip-c3">Нажмите на столбец, чтобы увидеть число</div>
    ${bars('c3', order.map((d) => ({ v: wd[d], label: WD_S[d], hl: wd[d] === wmax && wmax > 0, tip: `${WD_L[d][0].toUpperCase() + WD_L[d].slice(1)}: ${pl(wd[d], W_TASK)}` })), 90)}</div></section>`;

  // time of day by the moment tasks were checked off
  const parts = [['Утро', 5, 12], ['День', 12, 17], ['Вечер', 17, 23], ['Ночь', 23, 29]];
  const byPart = parts.map(([n, a, b]) => ({ name: `${n} (${pad(a % 24)}–${pad(b % 24)})`, v: doneTasks.filter((t) => { if (!t.doneAt) return false; let h = new Date(t.doneAt).getHours(); if (h < 5) h += 24; return h >= a && h < b; }).length }));
  if (doneTasks.length) body += sec('Когда вы делаете дела', `<div class="chart">${hbars(byPart)}</div>`);

  // priorities
  const pr = [3, 2, 1, 0].map((p) => ({ name: p ? PRIO[p].name : 'Обычные', v: doneTasks.filter((t) => t.priority === p).length, color: p ? `var(--p${p})` : 'var(--ink-3)' }));
  if (doneTasks.length) body += sec('Выполнено по важности', `<div class="chart">${hbars(pr)}</div>`);

  // deadlines
  const lateNow = overdueTasks().length;
  body += sec('Сроки', `<div class="group">
    ${[['Сделано в срок', onTime], ['Сделано с опозданием', late.length], ['Среднее опоздание', late.length ? `${avgLate.toLocaleString('ru-RU')} ${plural(Math.ceil(avgLate), ['день', 'дня', 'дней'])}` : '—'], ['Просрочено сейчас', lateNow]]
      .map(([k, v]) => `<div class="row static"><span class="grow">${k}</span><span class="r-end">${v}</span></div>`).join('')}</div>`);

  // lists and tags
  const lrows = state.lists.map((l) => ({ name: l.name, color: l.color, v: doneTasks.filter((t) => t.listId === l.id).length, open: state.tasks.filter((t) => t.listId === l.id && !t.done).length }))
    .filter((r) => r.v || r.open).sort((a, b) => b.v - a.v || b.open - a.open).map((r) => Object.assign(r, { text: `${r.v} · осталось ${r.open}` }));
  if (lrows.length) body += sec('По спискам', `<div class="chart">${hbars(lrows)}</div>`);
  const tagCount = {};
  doneTasks.forEach((t) => t.tags.forEach((g) => { tagCount[g] = (tagCount[g] || 0) + 1; }));
  const trows = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([g, v]) => ({ name: '#' + g, v }));
  if (trows.length) body += sec('Самые частые метки', `<div class="chart">${hbars(trows)}</div>`);

  // focus
  const fMin = sumLog(state.focus.log, from, tk), fCnt = sumLog(state.focus.count, from, tk);
  const fDays = span <= 31 ? Array.from({ length: Math.min(span, 14) }, (_, i) => addDays(tk, -Math.min(span, 14) + 1 + i)) : [];
  const topF = state.tasks.filter((t) => t.focusMin).sort((a, b) => b.focusMin - a.focusMin).slice(0, 3);
  body += sec('Фокус', `<div class="stat-row">${tile(fmtDur(fMin) || '0 мин', 'В фокусе')}${tile(fCnt, 'Подходов')}${tile(fCnt ? Math.round(fMin / fCnt) + ' мин' : '—', 'Средний подход')}</div>
    ${fDays.length && fMin ? `<div class="chart" style="margin-top:10px"><div class="chart-tip" id="tip-c2">Минуты в фокусе — нажмите на столбец</div>${bars('c2', fDays.map((k) => ({ v: state.focus.log[k] || 0, hl: k === tk, label: fDays.length <= 7 ? WD_S[wdOf(k)] : (dateOf(k).getDate() % 2 ? '' : dateOf(k).getDate()), tip: `${fmtDay(k, { wd: true })}: ${state.focus.log[k] ? fmtDur(state.focus.log[k]) : 'нет'}` })), 90)}</div>` : ''}
    ${topF.length ? `<div class="group" style="margin-top:10px">${topF.map((t) => `<button class="row" data-act="open" data-id="${t.id}"><span class="grow r-title">${esc(t.title)}</span><span class="r-end">${fmtDur(t.focusMin)}</span></button>`).join('')}</div>` : ''}`);

  // habits
  const hs = state.habits.filter((h) => !h.archived);
  if (hs.length) {
    const days = Math.min(span, 365);
    body += sec(`Привычки за ${pl(days, W_DAY)}`, `<div class="chart">${hbars(hs.map((h) => { const r = hRate(h, days), s = hStreak(h); return { name: h.name, color: h.color, v: r, text: `${r}% · серия ${s.n}` }; }))}</div>`);
  }

  // all-time totals
  const allDone = Object.values(state.doneLog).reduce((a, b) => a + b, 0);
  const subDone = state.tasks.reduce((a, t) => a + t.subtasks.filter((x) => x.done).length, 0);
  const focusAll = Object.values(state.focus.log).reduce((a, b) => a + b, 0);
  const habitMarks = state.habits.reduce((a, h) => a + Object.keys(h.log).filter((k) => hDone(h, k)).length, 0);
  body += sec('За всё время', `<div class="group">${[
    ['Выполнено задач', fmtN(allDone)], ['Выполнено подзадач', fmtN(subDone)], ['Сейчас в работе', fmtN(active().length)],
    ['Серия дней с делами', `${st.cur} (лучшая ${st.best})`], ['Время в фокусе', fmtDur(focusAll) || '0 мин'], ['Отметок привычек', fmtN(habitMarks)],
    ['Списков', userLists().length], ['Своих шаблонов', state.templates.length],
  ].map(([k, v]) => `<div class="row static"><span class="grow">${k}</span><span class="r-end">${v}</span></div>`).join('')}</div>
  <p class="foot-note">Подробности по спискам, важности и срокам считаются по задачам, которые не удалены.</p>`);

  const tips = [
    lateNow ? `Просрочено ${pl(lateNow, W_TASK)}. Перенесите их на реальные даты или удалите неактуальные.` : 'Просроченных задач нет — так держать.',
    withDate.length >= 3 && pct(onTime, withDate.length) < 70 ? 'Меньше трети задач сделано вовремя? Ставьте сроки с запасом в 1–2 дня.' : '',
    prevDone != null && done < prevDone ? 'В этот период сделано меньше, чем в прошлый. Планируйте меньше задач, но доводите их до конца.' : '',
    wmax && span >= 14 ? `Самый продуктивный день — ${WD_L[wd.indexOf(wmax)]}. Ставьте на него самые важные дела.` : '',
    fMin < 60 ? 'Попробуйте 2–3 подхода фокус-таймера в день для самых важных задач.' : '',
  ].filter(Boolean);
  body += sec('Советы', `<div class="group">${tips.map((x) => `<div class="row static"><span class="grow" style="font-size:14px">${x}</span></div>`).join('')}</div>`);
  return { title: 'Статистика', backLabel: 'Ещё', body, fab: false };
};

/* ---------- Search ---------- */
function searchResults(q) {
  q = q.trim().toLowerCase();
  if (!q) return '<div class="empty-inline">Начните вводить: название, заметка, #метка или подзадача</div>';
  const tq = q.replace(/^#/, '');
  const hit = (t) => t.title.toLowerCase().includes(q) || (t.notes || '').toLowerCase().includes(q) || t.tags.some((g) => g.includes(tq)) || t.subtasks.some((s) => s.title.toLowerCase().includes(q));
  const tasks = state.tasks.filter(hit).sort((a, b) => a.done - b.done || cmpTask(a, b)).slice(0, 80);
  const lists = state.lists.filter((l) => l.name.toLowerCase().includes(q));
  const habits = state.habits.filter((h) => h.name.toLowerCase().includes(q));
  let out = '';
  if (lists.length) out += sec('Списки', `<div class="group">${lists.map((l) => `<button class="row" data-act="open-list" data-id="${l.id}"><i class="dot" style="background:${l.color}"></i><span class="grow r-title">${esc(l.name)}</span>${ic('chev', 'sm chev')}</button>`).join('')}</div>`);
  if (habits.length) out += sec('Привычки', `<div class="group">${habits.map((h) => `<button class="row" data-act="go-habit" data-id="${h.id}"><i class="dot" style="background:${h.color}"></i><span class="grow r-title">${esc(h.name)}</span>${ic('chev', 'sm chev')}</button>`).join('')}</div>`);
  if (tasks.length) out += sec(`Задачи · ${tasks.length}`, taskGroup(tasks, { showList: true, notes: true }));
  return out || '<div class="empty-inline">Ничего не найдено</div>';
}
VIEWS.search = () => ({
  title: 'Поиск', fab: false,
  body: `<div class="search-box">${ic('search', 'sm')}<input id="q" type="search" placeholder="Задачи, заметки, метки" value="${esc(ui.q)}" autocomplete="off" enterkeyhint="search"></div><div id="results">${searchResults(ui.q)}</div>`,
  after: () => { const i = $('#q'); if (i && !ui.q) setTimeout(() => i.focus(), 50); },
});

/* ---------- Templates ---------- */
VIEWS.templates = () => {
  const card = (t, own) => `<button data-act="${own ? 'go' : 'tpl-use'}" data-v="tpl" data-id="${t.id}"><span class="e">${esc(t.emoji || '📋')}</span><b>${esc(t.name)}</b><span>${pl(t.items.length, ['пункт', 'пункта', 'пунктов'])}${t.desc ? ' · ' + esc(t.desc) : ''}</span></button>`;
  let body = `<p class="help" style="margin:4px 4px 0">Шаблон — готовый набор задач. Примените его, и задачи появятся в новом или уже существующем списке.</p>`;
  body += sec('Мои шаблоны', state.templates.length ? `<div class="tpl">${state.templates.map((t) => card(t, true)).join('')}</div>`
    : `<div class="group"><div class="row static help" style="display:block">Чтобы сделать свой шаблон: откройте задачу → <b>«Добавить в шаблон»</b>. Или выберите несколько задач в списке кнопкой ${ic('select', 'xs')} → <b>«В шаблон»</b>. Весь список целиком: «⋯» → «Сохранить как шаблон».</div></div>`,
    `<button class="link" data-act="tpl-create">Новый</button>`);
  body += sec('Готовые', `<div class="tpl">${TEMPLATES.map((t) => card(t)).join('')}</div>`);
  return { title: 'Шаблоны', backLabel: 'Назад', body, fab: false };
};
VIEWS.tpl = (v) => {
  const t = state.templates.find((x) => x.id === v.id);
  if (!t) { ui.stack[ui.tab].pop(); return VIEWS[curView().v](curView()); }
  const rows = t.items.map((it, i) => {
    const meta = tplItemMeta(it);
    return `<div class="row static"><span class="grow"><span class="r-title">${esc(tplItemTitle(it))}</span>${meta ? `<br><span class="r-sub">${esc(meta)}</span>` : ''}${typeof it !== 'string' && it.notes ? `<br><span class="r-sub">${esc(it.notes)}</span>` : ''}</span>
      <button class="icon-btn" style="color:var(--ink-3)" data-act="tpl-item-del" data-id="${t.id}" data-i="${i}" aria-label="Убрать из шаблона">${ic('x', 'sm')}</button></div>`;
  }).join('');
  const body = `<input class="inp" id="tpl-name" data-tpl="${t.id}" value="${esc(t.name)}" aria-label="Название шаблона" maxlength="60" style="margin-top:4px">
    <button class="btn block" style="margin-top:12px" data-act="tpl-use" data-id="${t.id}" ${t.items.length ? '' : 'disabled'}>${ic('layers', 'sm')}Применить шаблон</button>
    ${sec(`Задачи · ${t.items.length}`, t.items.length ? `<div class="group">${rows}</div>` : emptyBox('Шаблон пуст', 'Откройте любую задачу и нажмите «Добавить в шаблон».'))}
    <p class="foot-note">Даты в шаблоне не хранятся: задачи появятся без срока, а повторяющиеся — с ближайшей подходящей даты. Подзадачи, заметки, приоритет, метки и длительность сохраняются.</p>
    <button class="btn danger block" style="margin-top:14px" data-act="tpl-del" data-id="${t.id}">${ic('trash', 'sm')}Удалить шаблон</button>`;
  return { title: `${esc(t.emoji || '📋')} ${esc(t.name)}`, sub: t.type === 'shopping' ? 'Шаблон покупок' : '', backLabel: 'Шаблоны', body, fab: false };
};

/* ---------- Settings ---------- */
const swBtn = (on, act, extra = '') => `<button class="switch ${on ? 'on' : ''}" role="switch" aria-checked="${on}" data-act="${act}" ${extra}></button>`;
function selectF(id, cur, opts) { return `<select id="${id}" data-set="${id}">${opts.map(([v, n]) => `<option value="${v}" ${String(v) === String(cur) ? 'selected' : ''}>${n}</option>`).join('')}</select>`; }
VIEWS.settings = () => {
  const s = state.settings;
  const minOpts = (arr) => arr.map((x) => [x, x + ' мин']);
  const perm = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
  const body = `
  ${sec('Оформление', `<div class="group"><div class="fld">${ic('moon')}<span class="lbl">Тема</span><div class="seg" style="width:200px">${[['auto', 'Авто'], ['light', 'Светлая'], ['dark', 'Тёмная']].map(([v, n]) => `<button class="${s.theme === v ? 'on' : ''}" data-act="set-theme" data-v="${v}">${n}</button>`).join('')}</div></div>
    <div class="fld">${ic('calendar')}<span class="lbl">Неделя начинается</span><div class="seg" style="width:120px"><button class="${s.weekStart === 1 ? 'on' : ''}" data-act="set-week" data-v="1">Пн</button><button class="${s.weekStart === 0 ? 'on' : ''}" data-act="set-week" data-v="0">Вс</button></div></div></div>`)}
  ${sec('Задачи', `<div class="group">
    <div class="fld">${ic('wand')}<span class="lbl">Умный ввод<br><span class="r-sub" style="font-size:13px;color:var(--ink-2)">Понимает «завтра в 18:00», #метки, !!!</span></span>${swBtn(s.smartInput, 'set-toggle', 'data-k="smartInput"')}</div>
    <div class="fld">${ic('inbox')}<span class="lbl">Список по умолчанию</span>${selectF('defaultList', s.defaultList, state.lists.filter((l) => !l.archived).map((l) => [l.id, l.name]))}</div>
    <div class="fld">${ic('clock')}<span class="lbl">Рабочее время в день</span>${selectF('dayCapacity', s.dayCapacity, [240, 300, 360, 420, 480, 540, 600, 720].map((m) => [m, fmtDur(m)]))}</div>
    <div class="fld">${ic('check')}<span class="lbl">Выполненные на «Сегодня»</span>${swBtn(s.showDoneToday, 'set-toggle', 'data-k="showDoneToday"')}</div></div>
    <p class="foot-note">Рабочее время нужно, чтобы показывать загрузку дня и предупреждать о перегрузке.</p>`)}
  ${sec('Фокус-таймер', `<div class="group">
    <div class="fld">${ic('timer')}<span class="lbl">Фокус</span>${selectF('focusLen', s.focusLen, minOpts([10, 15, 20, 25, 30, 40, 45, 50, 60, 90]))}</div>
    <div class="fld">${ic('sun')}<span class="lbl">Короткий перерыв</span>${selectF('shortBreak', s.shortBreak, minOpts([3, 5, 10, 15]))}</div>
    <div class="fld">${ic('moon')}<span class="lbl">Длинный перерыв</span>${selectF('longBreak', s.longBreak, minOpts([10, 15, 20, 30]))}</div>
    <div class="fld">${ic('repeat')}<span class="lbl">Длинный перерыв каждые</span>${selectF('longEvery', s.longEvery, [2, 3, 4, 5, 6].map((n) => [n, n + ' подх.']))}</div>
    <div class="fld">${ic('play')}<span class="lbl">Автостарт следующего этапа</span>${swBtn(s.autoNext, 'set-toggle', 'data-k="autoNext"')}</div>
    <div class="fld">${ic('bell')}<span class="lbl">Звук по окончании</span>${swBtn(s.sound, 'set-toggle', 'data-k="sound"')}</div></div>`)}
  ${sec('Напоминания', `<div class="group"><div class="fld">${ic('bell')}<span class="lbl">Уведомления</span>${perm === 'granted' ? '<span class="r-end" style="color:var(--ok)">Включены</span>' : perm === 'unsupported' ? '<span class="r-end">Недоступны</span>' : `<button class="btn sm soft" data-act="notify-perm">${perm === 'denied' ? 'Запрещены' : 'Включить'}</button>`}</div></div>
    <p class="foot-note">Пока приложение открыто, напоминание приходит окном со звуком (если на iPhone не включён беззвучный режим). Закрытые веб-приложения iPhone будить не разрешает, поэтому для надёжных напоминаний откройте задачу → «Напоминания» → «Добавить в Календарь»: напомнит «Календарь», даже без интернета.</p>`)}`;
  return { title: 'Настройки', backLabel: 'Ещё', body, fab: false };
};

/* ---------- Data ---------- */
VIEWS.data = () => {
  const n = state.tasks.length;
  let body = '';
  if (IS_PWA) body += `<div class="banner ${Offline.ready ? '' : 'warn'}" style="margin-top:6px">${ic(Offline.ready ? 'check' : 'info')}<div class="grow">${Offline.ready ? '<b>Работает без интернета.</b> Приложение сохранено на телефоне.' : '<b>Без интернета пока не готово.</b> Откройте приложение с иконки при включённом интернете и подождите несколько секунд.'}</div></div>`;
  if (Sync.on) body += `<div class="banner" style="margin-top:6px">${ic('check')}<div class="grow"><b>Синхронизация включена.</b> Ваши данные сохраняются в аккаунте Claude и одинаковы на всех устройствах, где вы открываете эту ссылку.</div></div>`;
  body += sec('Резервная копия', `<div class="group menu-list">
    <button class="row" data-act="export-json">${ic('download')}<span class="grow r-title">Сохранить копию (.json)</span></button>
    <label class="row" style="cursor:pointer">${ic('upload')}<span class="grow r-title">Восстановить из копии</span><input type="file" id="import-file" accept=".json,application/json" class="hidden"></label>
    <button class="row" data-act="copy-all">${ic('copy')}<span class="grow r-title">Скопировать все задачи текстом</span></button></div>
    <p class="foot-note">Всего задач: ${n}, списков: ${userLists().length}, привычек: ${state.habits.length}. Делайте копию раз в неделю — особенно перед сменой телефона.</p>`);
  body += sec('Календарь iPhone', IN_CLAUDE
    ? '<div class="group"><div class="empty-inline">Экспорт в Календарь работает в установленной версии приложения (см. «Как пользоваться»).</div></div>'
    : `<div class="group menu-list"><button class="row" data-act="export-ics">${ic('calplus')}<span class="grow r-title">Экспорт задач с датами (.ics)</span></button></div>
      <p class="foot-note">Файл откроется в «Календаре»: задачи со временем станут событиями с напоминаниями.</p>`);
  body += sec('Очистка', `<div class="group menu-list">
    ${hasExamples() ? `<button class="row" data-act="remove-examples">${ic('wand')}<span class="grow r-title">Удалить примеры</span></button>` : ''}
    <button class="row danger" data-act="reset-all">${ic('trash')}<span class="grow r-title">Удалить все данные</span></button></div>`);
  return { title: 'Данные', backLabel: 'Ещё', body, fab: false };
};

/* ---------- Help ---------- */
VIEWS.help = () => {
  const ex = [['Купить молоко завтра', 'завтра'], ['Встреча в пятницу в 15:00 #работа', 'пятница, 15:00, метка'], ['Отчёт 25.11 !!!', 'дата, высокий приоритет'], ['Тренировка по пн и чт в 19:00 на 1 ч', 'повтор, время, длительность'], ['Оплатить кредит каждый месяц 10 декабря', 'ежемесячно с 10 декабря'], ['Позвонить через 2 часа', 'время + напоминание'], ['Созвон по будням в 10 @Работа', 'повтор, в список «Работа»'], ['Сдать проект через неделю напомни за 1 день', 'дата + напоминание']];
  const body = `
  ${sec('Установка на iPhone', `<div class="group"><div class="row static help" style="display:block"><ol>
    <li>Откройте ссылку на приложение в <b>Safari</b>.</li>
    <li>Нажмите кнопку <b>«Поделиться»</b> (квадрат со стрелкой) внизу экрана.</li>
    <li>Выберите <b>«На экран „Домой“»</b> и нажмите <b>«Добавить»</b>.</li>
    <li>Запускайте с иконки «Планировщик» — откроется на весь экран и будет работать без интернета.</li></ol>
    ${IN_CLAUDE ? '<p style="margin:6px 0 0">Сейчас вы в версии внутри Claude: она хранит данные в вашем аккаунте и синхронизирует их между устройствами.</p>' : ''}</div></div>`)}
  ${sec('Умный ввод', `<div class="group">${ex.map(([a, b]) => `<div class="row static"><span class="grow"><span class="r-title">${esc(a)}</span><br><span class="r-sub">${esc(b)}</span></span></div>`).join('')}</div>
    <p class="foot-note">Приоритет: <b>!</b> низкий, <b>!!</b> средний, <b>!!!</b> высокий. Метка: <b>#слово</b>. Список: <b>@название</b>. Время суток: «утром», «днём», «вечером». Вставьте несколько строк — получится несколько задач.</p>`)}
  ${sec('Жесты', `<div class="group">
    <div class="row static">${ic('arrow')}<span class="grow">Смахните задачу <b>вправо</b> — выполнено</span></div>
    <div class="row static">${ic('sunrise')}<span class="grow">Смахните <b>влево</b> — перенести на завтра; длинный свайп — удалить</span></div>
    <div class="row static">${ic('select')}<span class="grow">Кнопка выбора в списке — действия сразу с несколькими задачами</span></div>
    <div class="row static">${ic('calendar')}<span class="grow">В календаре смахните сетку, чтобы листать месяцы</span></div></div>`)}
  ${sec('Повторяющиеся задачи', `<div class="group"><div class="row static help" style="display:block">Когда вы отмечаете повторяющуюся задачу, она переносится на следующую дату, а выполненный раз сохраняется в истории и статистике.</div></div>`)}`;
  return { title: 'Как пользоваться', backLabel: 'Ещё', body, fab: false };
};
