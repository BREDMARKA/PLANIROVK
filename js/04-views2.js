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
function barChart(id, days, values, unitF, tipF) {
  const max = Math.max(1, ...values);
  const step = max <= 4 ? 1 : max <= 10 ? 2 : max <= 25 ? 5 : max <= 60 ? 15 : max <= 120 ? 30 : 60;
  const top = Math.ceil(max / step) * step;
  const tk = todayKey();
  const lines = [];
  for (let v = step; v <= top; v += step) lines.push(`<div class="gl" style="bottom:${(v / top) * 100}%"><span>${v}</span></div>`);
  return `<div class="bars" id="${id}">${lines.join('')}${values.map((v, i) => `<button class="bar ${days[i] === tk ? 'today' : ''}" data-act="bar-tip" data-chart="${id}" data-tip="${esc(tipF(days[i], v))}" aria-label="${esc(tipF(days[i], v))}"><i style="height:${(v / top) * 100}%"></i></button>`).join('')}</div>
    <div class="bar-x">${days.map((k, i) => `<span class="${k === tk ? 't' : ''}">${days.length > 7 ? (i % 2 === (days.length - 1) % 2 ? dateOf(k).getDate() : '') : WD_S[wdOf(k)]}</span>`).join('')}</div>`;
}
VIEWS.stats = () => {
  const tk = todayKey();
  const d14 = Array.from({ length: 14 }, (_, i) => addDays(tk, i - 13));
  const done14 = d14.map((k) => state.doneLog[k] || 0);
  const week = done14.slice(7).reduce((a, b) => a + b, 0), prevWeek = done14.slice(0, 7).reduce((a, b) => a + b, 0);
  let streak = 0, k = (state.doneLog[tk] || 0) ? tk : addDays(tk, -1);
  while ((state.doneLog[k] || 0) > 0 && streak < 3650) { streak++; k = addDays(k, -1); }
  const d7 = d14.slice(7), f7 = d7.map((x) => state.focus.log[x] || 0), fSum = f7.reduce((a, b) => a + b, 0);
  const avg = (Math.round((week / 7) * 10) / 10).toLocaleString('ru-RU');
  let body = `<div class="stat-row" style="margin-top:6px">
    <div class="stat"><div class="v">${state.doneLog[tk] || 0}</div><div class="k">Сделано сегодня</div></div>
    <div class="stat"><div class="v">${week}</div><div class="k">За 7 дней${prevWeek ? ` (${week >= prevWeek ? '+' : ''}${week - prevWeek})` : ''}</div></div>
    <div class="stat"><div class="v">${streak}</div><div class="k">${plural(streak, ['день', 'дня', 'дней'])} подряд</div></div></div>`;
  body += `<section class="sec"><div class="chart"><div class="chart-h"><b>Выполнено задач</b><span>14 дней · в среднем ${avg} в день</span></div>
    <div class="chart-tip" id="tip-c1">Нажмите на столбец, чтобы увидеть число</div>
    ${barChart('c1', d14, done14, null, (day, v) => `${fmtDay(day, { wd: true })}: ${pl(v, W_TASK)}`)}</div></section>`;
  body += `<section class="sec"><div class="chart"><div class="chart-h"><b>Время в фокусе, мин</b><span>за неделю ${fmtDur(fSum) || '0 мин'}</span></div>
    <div class="chart-tip" id="tip-c2">${fSum ? 'Нажмите на столбец, чтобы увидеть время' : 'Запустите фокус-таймер — здесь появится ваше время'}</div>
    ${barChart('c2', d7, f7, null, (day, v) => `${fmtDay(day, { wd: true })}: ${v ? fmtDur(v) : 'нет'}`)}</div></section>`;
  const weekAgo = Date.now() - 7 * 864e5;
  const rows = state.lists.map((l) => ({ l, done: state.tasks.filter((t) => t.listId === l.id && t.done && t.doneAt >= weekAgo).length, open: state.tasks.filter((t) => t.listId === l.id && !t.done).length }))
    .filter((r) => r.done || r.open).sort((a, b) => b.done - a.done || b.open - a.open);
  const mx = Math.max(1, ...rows.map((r) => r.done + r.open));
  if (rows.length) body += sec('Списки за неделю', `<div class="chart">${rows.map((r) => `<div class="hbar"><span class="nm"><i class="dot" style="background:${r.l.color}"></i>${esc(r.l.name)}</span>
      <span class="tr"><i style="width:${((r.done) / mx) * 100}%;background:${r.l.color}"></i></span><span class="v">${r.done} из ${r.done + r.open}</span></div>`).join('')}
      <p class="foot-note" style="margin:6px 0 0">Сколько задач выполнено за 7 дней от общего числа в списке.</p></div>`);
  const hs = state.habits.filter((h) => !h.archived);
  if (hs.length) body += sec('Привычки за 30 дней', `<div class="chart">${hs.map((h) => { const r = hRate(h); return `<div class="hbar"><span class="nm"><i class="dot" style="background:${h.color}"></i>${esc(h.name)}</span><span class="tr"><i style="width:${r}%;background:${h.color}"></i></span><span class="v">${r}%</span></div>`; }).join('')}</div>`);
  const lateN = overdueTasks().length;
  body += sec('Советы', `<div class="group">${[
    lateN ? `Просрочено ${pl(lateN, W_TASK)}. Перенесите их на реальные даты или удалите неактуальные.` : 'Просроченных задач нет — так держать.',
    week < prevWeek ? 'На этой неделе выполнено меньше, чем на прошлой. Попробуйте планировать меньше задач, но доводить их до конца.' : 'Выполнено не меньше, чем неделей раньше. Хороший темп.',
    fSum < 60 ? 'Попробуйте 2–3 подхода фокус-таймера в день для самых важных задач.' : `Вы провели в фокусе ${fmtDur(fSum)} за неделю.`,
  ].map((x) => `<div class="row static"><span class="grow r-sub" style="font-size:14px;color:var(--ink)">${x}</span></div>`).join('')}</div>`);
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
  const card = (t, own) => `<button data-act="tpl-use" data-id="${t.id}"><span class="e">${esc(t.emoji || '📋')}</span><b>${esc(t.name)}</b><span>${own ? 'Ваш шаблон · ' : ''}${pl(t.items.length, ['пункт', 'пункта', 'пунктов'])}${t.desc ? ' · ' + esc(t.desc) : ''}</span></button>`;
  let body = `<p class="help" style="margin:4px 4px 0">Готовые списки дел. Выберите шаблон — появится новый список, который можно менять как угодно.</p>`;
  body += sec('Готовые', `<div class="tpl">${TEMPLATES.map((t) => card(t)).join('')}</div>`);
  body += sec('Мои шаблоны', state.templates.length ? `<div class="tpl">${state.templates.map((t) => card(t, true)).join('')}</div>` : '<div class="group"><div class="empty-inline">Откройте любой список → «⋯» → «Сохранить как шаблон»</div></div>');
  return { title: 'Шаблоны', backLabel: 'Назад', body, fab: false };
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
    <p class="foot-note">Пока приложение открыто, напоминания приходят сами. Чтобы iPhone напомнил, даже когда приложение закрыто, нажмите в задаче «Добавить в Календарь» — напоминание сработает из приложения «Календарь».</p>`)}`;
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
