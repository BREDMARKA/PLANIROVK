'use strict';
/* ===== Bottom sheets: quick add, task editor, list & habit editors, pickers, plan-day, confirm ===== */

const SHEETS = {};
function openSheet(s) { ui.sheet = s; renderSheet(true); }
function closeSheet() {
  const s = ui.sheet; ui.sheet = null;
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  renderSheet(); render();
  if (ui.reloadWhenIdle) { ui.reloadWhenIdle = false; saveLocalNow(); location.reload(); return; }
  if (s && s.onClose) s.onClose();
}
function renderSheet(first) {
  const root = $('#sheet-root'); if (!root) return;
  if (!ui.sheet) { root.innerHTML = ''; return; }
  const s = SHEETS[ui.sheet.type](ui.sheet);
  const prev = $('.sheet-body', root), top = prev ? prev.scrollTop : 0;
  root.innerHTML = `<div class="sheet-wrap ${first ? '' : 'still'}"><div class="sheet-bd" data-act="sheet-close"></div>
    <div class="sheet ${s.cls || ''}" role="dialog" aria-modal="true" aria-label="${esc(s.title || 'Окно')}">${s.raw || `<div class="sheet-grab"></div>
      <div class="sheet-head">${s.left || '<button class="txt-btn l" data-act="sheet-close">Закрыть</button>'}<h3>${s.title || ''}</h3>${s.right || '<span style="min-width:64px"></span>'}</div>
      <div class="sheet-body">${s.body}</div>`}</div></div>`;
  const nb = $('.sheet-body', root);
  if (nb && !first) nb.scrollTop = top;
  if (s.after) s.after(first);
}
const rerenderSheet = () => renderSheet(false);

/* ---------- Quick add ---------- */
function quickCtx() { const v = curView(); const out = (VIEWS[v.v] || VIEWS.today)(v); const c = Object.assign({}, out.ctx || {}); if (ui.tab === 'today' && !ui.stack.today.length) c.date = todayKey(); return c; }
function openQuickAdd(extra = {}) {
  const ctx = Object.assign(quickCtx(), extra);
  openSheet({ type: 'qa', ctx, text: '' });
}
function qaTools(s) {
  // the toolbar shows what will actually be saved: words typed in the text win over the buttons
  const p = s.parsed || {};
  const c = Object.assign({}, s.ctx), tk = todayKey(), tm = addDays(tk, 1);
  if (p.date !== undefined) c.date = p.date;
  if (p.time !== undefined) c.time = p.time;
  if (p.listId) c.listId = p.listId;
  const lst = listById(c.listId || state.settings.defaultList);
  const pr = p.priority !== undefined ? p.priority : (c.priority || 0);
  return `<button class="chip ${c.date === tk ? 'on' : ''}" data-act="qa-date" data-k="${tk}">${ic('sun', 'xs')}Сегодня</button>
    <button class="chip ${c.date === tm ? 'on' : ''}" data-act="qa-date" data-k="${tm}">${ic('sunrise', 'xs')}Завтра</button>
    <span class="chip ${c.date && c.date !== tk && c.date !== tm ? 'on' : ''}">${ic('calendar', 'xs')}${c.date && c.date !== tk && c.date !== tm ? fmtShort(c.date) : 'Дата'}<input type="date" data-qa="date" value="${c.date || ''}" aria-label="Дата"></span>
    <span class="chip ${c.time ? 'on' : ''}">${ic('clock', 'xs')}${c.time || 'Время'}<input type="time" data-qa="time" value="${c.time || ''}" aria-label="Время"></span>
    <button class="chip p${pr} ${pr ? 'on' : ''}" data-act="qa-prio">${ic('flag', 'xs')}${pr ? PRIO[pr].name : 'Приоритет'}</button>
    <span class="chip">${ic('folder', 'xs')}${esc(lst.name)}<select class="over-input" data-qa="list" aria-label="Список">${state.lists.filter((l) => !l.archived).map((l) => `<option value="${l.id}" ${l.id === lst.id ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select></span>
    ${c.date || c.time ? `<button class="chip" data-act="qa-clear-date">${ic('x', 'xs')}Без срока</button>` : ''}`;
}
SHEETS.qa = (s) => {
  const lst = listById(s.ctx.listId || state.settings.defaultList);
  const ph = lst.type === 'shopping' ? 'Что купить? Например: молоко 2 л' : 'Новая задача';
  return {
    cls: 'qa-sheet',
    raw: `<div class="qa"><div class="qa-row"><textarea id="qa-text" rows="1" placeholder="${esc(ph)}" enterkeyhint="done" autocomplete="off">${esc(s.text || '')}</textarea>
      <button class="qa-send" data-act="qa-submit" aria-label="Добавить" ${s.text && s.text.trim() ? '' : 'disabled'}>${ic('up')}</button></div>
      <div class="qa-parsed" id="qa-parsed"></div>
      <div class="qa-tools chips scroll" id="qa-tools">${qaTools(s)}</div>
      <div class="qa-hint">${lst.type === 'shopping' ? 'Каждая строка — отдельный товар. Количество можно писать в конце: <code>яйца 10 шт</code>' : 'Пишите как удобно: <code>Встреча завтра в 15:00 #работа !!!</code> · несколько строк — несколько задач'}</div>
      <div class="btn-row" style="margin-top:10px"><button class="btn ghost sm" data-act="sheet-close">Закрыть</button><button class="btn soft sm" data-act="qa-more">${ic('edit', 'sm')}Подробнее</button></div></div>`,
    after: (first) => {
      const ta = $('#qa-text');
      if (!ta) return;
      autoGrow(ta); qaPreview();
      if (first) setTimeout(() => ta.focus(), 30);
    },
  };
};
function autoGrow(ta) { ta.style.height = 'auto'; ta.style.height = Math.min(140, ta.scrollHeight) + 'px'; }
function qaPreview() {
  const s = ui.sheet; const box = $('#qa-parsed'); const btn = $('.qa-send');
  if (!s || !box) return;
  const txt = s.text || '';
  if (btn) btn.disabled = !txt.trim();
  const lines = txt.split('\n').filter((x) => x.trim());
  const prev = JSON.stringify(s.parsed || null);
  s.parsed = lines.length === 1 && state.settings.smartInput ? parseQuick(lines[0]) : null;
  if (JSON.stringify(s.parsed) !== prev) refreshQaTools();
  if (!lines.length || !state.settings.smartInput) { box.innerHTML = ''; return; }
  if (lines.length > 1) { box.innerHTML = `<span class="chip">${ic('checks', 'xs')}Будет добавлено: ${lines.length}</span>`; return; }
  box.innerHTML = parsedChips(s.parsed).map(([i, l]) => `<span class="chip">${ic(i, 'xs')}${esc(l)}</span>`).join('');
}
function qaSubmit(keepOpen = true) {
  const s = ui.sheet; if (!s || s.type !== 'qa') return;
  const txt = (s.text || '').trim(); if (!txt) return;
  const made = addFromText(txt, s.ctx);
  s.text = ''; s.parsed = null;
  commit();
  const ta = $('#qa-text'); if (ta) { ta.value = ''; autoGrow(ta); }
  qaPreview();
  toast(made.length > 1 ? `Добавлено: ${made.length}` : `Добавлено: ${made[0].title}${made[0].date ? ' · ' + fmtDay(made[0].date) : ''}`);
  if (!keepOpen) closeSheet();
  return made;
}

/* ---------- Task editor ---------- */
function openTask(id) { openSheet({ type: 'task', id }); }
const REP_PRESETS = [
  ['none', 'Нет', null], ['day', 'Каждый день', { freq: 'day', every: 1 }], ['weekdays', 'По будням', { freq: 'weekdays', every: 1 }],
  ['weekend', 'По выходным', { freq: 'week', every: 1, days: [6, 0] }], ['week', 'Каждую неделю', { freq: 'week', every: 1, days: [] }],
  ['week2', 'Каждые 2 недели', { freq: 'week', every: 2, days: [] }], ['month', 'Каждый месяц', { freq: 'month', every: 1 }],
  ['year', 'Каждый год', { freq: 'year', every: 1 }], ['day2', 'Через день', { freq: 'day', every: 2 }],
];
function repKey(r) {
  if (!r) return 'none';
  if (r.freq === 'week' && r.days && r.days.length === 2 && r.days.includes(6) && r.days.includes(0) && r.every === 1) return 'weekend';
  if (r.freq === 'week') return r.every === 2 ? 'week2' : 'week';
  if (r.freq === 'day') return r.every === 2 ? 'day2' : 'day';
  return r.freq;
}
SHEETS.task = (s) => {
  const t = taskById(s.id);
  if (!t) return { title: '', body: '<div class="empty-inline">Задача удалена</div>' };
  const l = listById(t.listId), shop = l.type === 'shopping', tk = todayKey();
  const subs = t.subtasks.map((st) => `<div class="sub-row ${st.done ? 'done' : ''}"><button class="check square ${st.done ? 'on' : ''}" data-act="sub-toggle" data-sid="${st.id}" aria-label="Отметить подзадачу">${ic('check')}</button>
    <input value="${esc(st.title)}" data-sub="${st.id}" aria-label="Подзадача"><button class="icon-btn" style="width:30px;height:30px;color:var(--ink-3)" data-act="sub-del" data-sid="${st.id}" aria-label="Удалить подзадачу">${ic('x', 'sm')}</button></div>`).join('');
  const rk = repKey(t.repeat);
  const tagSug = allTags().map((x) => x[0]).filter((g) => !t.tags.includes(g)).slice(0, 8);
  let sat = addDays(tk, 1); while (wdOf(sat) !== 6) sat = addDays(sat, 1);
  const nextMon = addDays(weekStartOf(tk), 7);
  const body = `
    <div style="display:flex;gap:12px;align-items:flex-start;margin-top:4px">
      <button class="check p${t.priority} ${t.done ? 'on' : ''}" style="margin-top:9px" data-act="toggle" data-id="${t.id}" aria-label="Выполнить">${ic('check')}</button>
      <div style="flex:1;min-width:0"><textarea class="ed-title" rows="1" data-tf="title" placeholder="Название">${esc(t.title)}</textarea>
      <textarea class="ed-notes" rows="1" data-tf="notes" placeholder="Заметка">${esc(t.notes)}</textarea></div></div>
    ${shop ? `<div class="group"><div class="fld">${ic('cart')}<span class="lbl">Количество</span><input type="text" class="val" data-tf="qty" value="${esc(t.qty)}" placeholder="1 шт" style="max-width:45%"></div>
      <div class="fld">${ic('folder')}<span class="lbl">Отдел</span><select data-tf="cat">${SHOP_CATS.map((c) => c[0]).concat([SHOP_OTHER]).map((c) => `<option ${c === (t.cat || SHOP_OTHER) ? 'selected' : ''}>${c}</option>`).join('')}</select></div></div>` : ''}
    ${!shop || t.subtasks.length ? `<section class="sec" style="margin-top:12px"><div class="sec-h"><span>Подзадачи${t.subtasks.length ? ' · ' + t.subtasks.filter((x) => x.done).length + '/' + t.subtasks.length : ''}</span></div>
      <div class="group">${subs}<div class="sub-row">${ic('plus', 'sm')}<input id="sub-new" placeholder="Добавить шаг" enterkeyhint="done" aria-label="Новая подзадача"></div></div></section>` : ''}
    <section class="sec" style="margin-top:14px"><div class="chips scroll" style="margin-bottom:10px">
      ${[[tk, 'Сегодня'], [addDays(tk, 1), 'Завтра'], [sat, 'В субботу'], [nextMon, 'След. неделя']].map(([k, n]) => `<button class="chip ${t.date === k ? 'on' : ''}" data-act="ed-date" data-k="${k}">${n}</button>`).join('')}
      ${t.date ? '<button class="chip" data-act="ed-date" data-k="">Без даты</button>' : ''}</div>
    <div class="group">
      <div class="fld">${ic('calendar')}<span class="lbl">Дата</span><input type="date" data-tf="date" value="${t.date || ''}"></div>
      <div class="fld">${ic('clock')}<span class="lbl">Время</span><input type="time" data-tf="time" value="${t.time || ''}">${t.time ? `<button class="icon-btn clear" data-act="ed-clear-time" aria-label="Убрать время">${ic('x', 'sm')}</button>` : ''}</div>
      <div class="fld">${ic('timer')}<span class="lbl">Длительность</span><select data-tf="dur">${DUR_OPTS.map((m) => `<option value="${m}" ${m === (t.dur || 0) ? 'selected' : ''}>${m ? fmtDur(m) : 'Не указана'}</option>`).join('')}${!DUR_OPTS.includes(t.dur || 0) ? `<option value="${t.dur}" selected>${fmtDur(t.dur)}</option>` : ''}</select></div>
      <div class="fld">${ic('repeat')}<span class="lbl">Повтор</span><select data-tf="repeat">${REP_PRESETS.map(([k, n]) => `<option value="${k}" ${k === rk ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      ${t.repeat && t.repeat.freq === 'week' && rk !== 'weekend' ? `<div class="fld" style="flex-wrap:wrap"><span class="lbl" style="flex-basis:100%;font-size:14px;color:var(--ink-2)">По дням (если не выбрать — в тот же день недели)</span><div class="chips">${WD_ORDER.map((d) => `<button class="chip ${t.repeat.days && t.repeat.days.includes(d) ? 'on' : ''}" data-act="ed-repday" data-d="${d}">${WD_S[d]}</button>`).join('')}</div></div>` : ''}
    </div></section>
    ${remBlock(t)}
    <section class="sec" style="margin-top:14px"><div class="group">
      <div class="fld">${ic('flag')}<span class="lbl">Приоритет</span><div class="seg" style="width:190px">${PRIO.map((p) => `<button class="${t.priority === p.v ? 'on' : ''}" data-act="ed-prio" data-p="${p.v}" style="${p.v && t.priority === p.v ? `color:var(--p${p.v})` : ''}">${p.v ? p.short : 'Нет'}</button>`).join('')}</div></div>
      <div class="fld">${ic('folder')}<span class="lbl">Список</span><select data-tf="listId">${state.lists.filter((x) => !x.archived || x.id === t.listId).map((x) => `<option value="${x.id}" ${x.id === t.listId ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>
      <div class="tag-input">${ic('tag')}${t.tags.map((g) => `<button class="chip soft" data-act="tag-del" data-tag="${esc(g)}">#${esc(g)}${ic('x', 'xs x')}</button>`).join('')}<input id="tag-new" placeholder="${t.tags.length ? '' : 'Добавить метку'}" enterkeyhint="done" aria-label="Новая метка"></div>
      ${tagSug.length ? `<div class="chips scroll" style="padding:0 14px 12px">${tagSug.map((g) => `<button class="chip" data-act="tag-add" data-tag="${esc(g)}">+ #${esc(g)}</button>`).join('')}</div>` : ''}
    </div></section>
    <section class="sec" style="margin-top:14px"><div class="group menu-list">
      ${!shop ? `<button class="row" data-act="task-focus" data-id="${t.id}">${ic('timer')}<span class="grow r-title">Фокус на задаче</span>${t.focusMin ? `<span class="r-end">${fmtDur(t.focusMin)}</span>` : ''}</button>` : ''}
      <button class="row" data-act="task-share" data-id="${t.id}">${ic('share')}<span class="grow r-title">Поделиться</span></button>
      <button class="row" data-act="task-tpl" data-id="${t.id}">${ic('layers')}<span class="grow r-title">Добавить в шаблон</span></button>
      <button class="row" data-act="task-dup" data-id="${t.id}">${ic('copy')}<span class="grow r-title">Дублировать</span></button>
      <button class="row danger" data-act="task-del" data-id="${t.id}">${ic('trash')}<span class="grow r-title">Удалить</span></button></div></section>
    <p class="meta-note">Создано ${fmtDay(keyOf(new Date(t.created)), { wd: true }).toLowerCase()}${t.done && t.doneDay ? ' · выполнено ' + fmtDay(t.doneDay).toLowerCase() : ''}${t.repeat ? ' · ' + repeatLabel(t.repeat).toLowerCase() : ''}</p>`;
  return {
    title: esc(l.name), body, cls: 'full',
    left: '<span style="min-width:64px"></span>',
    right: '<button class="txt-btn r" data-act="sheet-close">Готово</button>',
    after: () => $$('.sheet textarea').forEach(autoGrow),
  };
};
function editTask(field, val) {
  const t = taskById(ui.sheet && ui.sheet.id); if (!t) return;
  if (field === 'repeat') {
    const p = REP_PRESETS.find((x) => x[0] === val);
    t.repeat = p && p[2] ? clone(p[2]) : null;
    if (t.repeat && !t.date) t.date = firstDate(t.repeat, todayKey());
  } else if (field === 'dur') t.dur = +val || 0;
  else if (field === 'date') { t.date = val || null; if (!val) { t.time = null; t.rem = null; } }
  else if (field === 'time') {
    const old = t.time; t.time = val || null;
    if (val && !t.date) t.date = todayKey();
    // a single reminder that followed the old start time moves with it; a new time gets one by default
    if (val && (!t.rem || (t.rem.count === 1 && t.rem.from === old))) t.rem = { from: val, to: val, count: 1, off: t.rem ? t.rem.off || 0 : 0 };
  }
  else if (field === 'listId') { t.listId = val; if (listById(val).type === 'shopping' && !t.cat) t.cat = categorize(t.title); }
  else t[field] = val;
  markPastNotified(t);
}
/* Alert times that are already over when a reminder is set should not fire right away. */
function markPastNotified(t) {
  const now = Date.now();
  remStamps(t).forEach((x) => { if (x.at <= now) state.meta.notified[t.id + '@' + x.at] = now; });
}

/* ---------- Reminders block in the task editor ---------- */
function remBlock(t) {
  const r = t.rem, mode = !r ? 'none' : r.count > 1 ? 'many' : 'once', now = Date.now();
  const stamps = remStamps(t);
  const dayLbl = r && r.off ? fmtDay(addDays(t.date, -r.off)) : (t.date ? fmtDay(t.date) : '');
  return `<section class="sec" style="margin-top:14px"><div class="sec-h"><span>Напоминания</span></div><div class="group">
    <div class="fld">${ic('bell')}<div class="seg" style="flex:1">
      <button class="${mode === 'none' ? 'on' : ''}" data-act="rem-mode" data-m="none">Нет</button>
      <button class="${mode === 'once' ? 'on' : ''}" data-act="rem-mode" data-m="once">Один раз</button>
      <button class="${mode === 'many' ? 'on' : ''}" data-act="rem-mode" data-m="many">Несколько</button></div></div>
    ${mode === 'once' ? `<div class="fld"><span class="lbl">Во сколько</span><input type="time" data-rf="from" value="${r.from}"></div>` : ''}
    ${mode === 'many' ? `<div class="fld"><span class="lbl">Период</span><span class="tpair"><input type="time" data-rf="from" value="${r.from}" aria-label="С"><span>–</span><input type="time" data-rf="to" value="${r.to}" aria-label="До"></span></div>
      <div class="fld"><span class="lbl">Сколько раз</span><span class="tpair"><button class="round" style="width:34px;height:34px" data-act="rem-count" data-d="-1" aria-label="Меньше">${ic('minus', 'sm')}</button><b class="num" style="min-width:26px;text-align:center">${r.count}</b><button class="round" style="width:34px;height:34px" data-act="rem-count" data-d="1" aria-label="Больше">${ic('plus', 'sm')}</button></span></div>` : ''}
    ${r ? `<div class="fld"><span class="lbl">День</span><select data-rf="off">${REM_OFF_OPTS.map(([v, n]) => `<option value="${v}" ${v === (r.off || 0) ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="rem-times"><span class="rem-day">${esc(dayLbl)}:</span>${stamps.map((x) => `<span class="chip ${x.at <= now ? 'past' : ''}">${ic('bell', 'xs')}${minToTime(x.m % 1440)}</span>`).join('')}</div>` : ''}
  </div>
  ${r ? `<p class="foot-note">Пока приложение открыто, напоминание придёт со звуком. Закрытое веб-приложение iPhone будить не разрешает — чтобы напоминания пришли в любом случае, добавьте их в Календарь: он напомнит даже без интернета.</p>
    ${IN_CLAUDE ? '<p class="foot-note">Добавление в Календарь работает в версии, установленной на экран «Домой».</p>' : `<button class="btn soft block" style="margin-top:10px" data-act="rem-cal" data-id="${t.id}">${ic('calplus', 'sm')}Добавить в Календарь iPhone</button>`}` : ''}
  </section>`;
}

/* ---------- Templates: add tasks to one, apply one ---------- */
SHEETS['tpl-pick'] = (s) => {
  const tasks = s.ids.map(taskById).filter(Boolean);
  const first = tasks[0], defName = first ? listById(first.listId).id === 'inbox' ? first.title.slice(0, 40) : listById(first.listId).name : 'Мой шаблон';
  return {
    title: 'В шаблон',
    body: `<p class="help" style="margin:0 4px 10px">${tasks.length === 1 ? `Задача «${esc(first.title)}» сохранится в шаблоне вместе с подзадачами, заметкой, приоритетом и метками.` : `${pl(tasks.length, W_TASK)} сохранятся в шаблоне вместе с подзадачами, заметками, приоритетом и метками.`}</p>
      ${state.templates.length ? `${sec('Добавить в шаблон', `<div class="group">${state.templates.map((t) => `<button class="row" data-act="tpl-add" data-id="${t.id}"><span class="ico-box" style="background:${t.color || 'var(--accent)'}">${esc(t.emoji || '📋')}</span><span class="grow"><span class="r-title">${esc(t.name)}</span><br><span class="r-sub">${pl(t.items.length, ['пункт', 'пункта', 'пунктов'])}</span></span>${ic('plus', 'sm')}</button>`).join('')}</div>`)}` : ''}
      ${sec('Новый шаблон', `<input class="inp" id="tpl-new-name" value="${esc(s.newName != null ? s.newName : defName)}" placeholder="Название шаблона" maxlength="60">
        <button class="btn block" style="margin-top:10px" data-act="tpl-new">${ic('plus', 'sm')}Создать шаблон</button>`)}`,
  };
};
SHEETS['tpl-apply'] = (s) => {
  const tpl = TEMPLATES.find((t) => t.id === s.id) || state.templates.find((t) => t.id === s.id);
  if (!tpl) return { title: 'Шаблон', body: '<div class="empty-inline">Шаблон удалён</div>' };
  const lists = state.lists.filter((l) => !l.archived);
  const cur = s.listId || (lists.find((l) => l.type === (tpl.type || 'tasks')) || lists[0]).id;
  return {
    title: esc(tpl.name),
    body: `<p class="help" style="margin:0 4px 6px">${pl(tpl.items.length, ['задача', 'задачи', 'задач'])}: ${esc(tpl.items.slice(0, 4).map(tplItemTitle).join(', '))}${tpl.items.length > 4 ? '…' : ''}</p>
      <button class="btn block" style="margin-top:10px" data-act="tpl-apply-new">${ic('plus', 'sm')}Новым списком «${esc(tpl.name)}»</button>
      ${sec('Или добавить в список', `<div class="group"><div class="fld">${ic('folder')}<span class="lbl">Список</span><select id="tpl-target">${lists.map((l) => `<option value="${l.id}" ${l.id === cur ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select></div></div>
        <button class="btn soft block" style="margin-top:10px" data-act="tpl-apply-list">Добавить задачи в этот список</button>`)}`,
  };
};

/* ---------- Add to Calendar ---------- */
SHEETS['cal-add'] = (s) => {
  const tasks = s.ids.map(taskById).filter(Boolean);
  const evs = icsEvents(buildICS(tasks));
  const shown = evs.slice(0, 12);
  return {
    title: 'В Календарь',
    body: `<p class="help" style="margin:0 4px 10px">Календарь напомнит в нужное время, даже когда планировщик закрыт и нет интернета. Будет добавлено: <b>${pl(evs.length, ['событие', 'события', 'событий'])}</b>.</p>
      <div class="group">${shown.map((e) => `<div class="row static"><span class="grow"><span class="r-title">${esc(e.title)}</span><br><span class="r-sub">${esc(e.when)}${e.repeat ? ' · повторяется' : ''}${e.alarm ? ' · с напоминанием' : ''}</span></span></div>`).join('')}${evs.length > shown.length ? `<div class="empty-inline">и ещё ${evs.length - shown.length}</div>` : ''}</div>
      <button class="btn block" style="margin-top:14px" data-act="cal-send">${ic('share', 'sm')}Отправить в Календарь</button>
      <div class="sec-h" style="margin-top:18px"><span>Что делать дальше</span></div>
      <div class="group"><div class="row static help" style="display:block"><ol style="margin:0">
        <li>В появившемся окне выберите <b>«Сохранить в Файлы»</b> и сохраните файл.</li>
        <li>Откройте приложение <b>«Файлы»</b> и нажмите на сохранённый файл.</li>
        <li>iPhone покажет события — нажмите <b>«Добавить все»</b>.</li></ol></div></div>
      <p class="foot-note">Если в окне есть пункт «Календарь», выберите его — файл откроется сразу. Чтобы Календарь присылал уведомления, включите их: Настройки → Календарь → Уведомления.</p>
      <button class="btn ghost block sm" style="margin-top:10px" data-act="cal-file">Скачать файл (.ics)</button>`,
  };
};

/* ---------- Reminder alert ---------- */
SHEETS.remind = (s) => {
  const t = taskById(s.id);
  if (!t) return { title: 'Напоминание', body: '<div class="empty-inline">Задача удалена</div>' };
  const i = s.info || {};
  const when = i.snooze ? 'Отложенное напоминание' : `${i.n > 1 ? `Напоминание ${i.i} из ${i.n}` : 'Напоминание'}${i.m != null ? ' на ' + minToTime(i.m % 1440) : ''}${t.time ? ` · начало в ${t.time}` : ''}`;
  return {
    title: 'Напоминание',
    body: `<div class="rem-alert"><div class="rem-bell">${ic('bell')}</div><div class="rem-title">${esc(t.title)}</div><div class="rem-sub">${esc(when)}</div>
      ${t.notes ? `<div class="rem-sub">${esc(t.notes)}</div>` : ''}</div>
      <button class="btn block" data-act="rem-done" data-id="${t.id}">${ic('check', 'sm')}Выполнено</button>
      <div class="btn-row" style="margin-top:10px"><button class="btn ghost" data-act="rem-snooze" data-id="${t.id}" data-min="10">Через 10 мин</button><button class="btn ghost" data-act="rem-snooze" data-id="${t.id}" data-min="60">Через час</button></div>
      <button class="btn ghost block" style="margin-top:10px" data-act="rem-open" data-id="${t.id}">Открыть задачу</button>`,
  };
};

/* ---------- List editor & menu ---------- */
SHEETS['list-edit'] = (s) => {
  const d = s.draft;
  return {
    title: s.id ? 'Список' : 'Новый список',
    right: `<button class="txt-btn r" data-act="list-save" ${d.name.trim() ? '' : 'disabled style="opacity:.4"'}>${s.id ? 'Готово' : 'Создать'}</button>`,
    body: `<input class="inp" id="list-name" data-lf="name" value="${esc(d.name)}" placeholder="Название, например «Отпуск»" style="margin-top:4px" maxlength="60">
      <div class="seg" style="margin-top:12px"><button class="${d.type === 'tasks' ? 'on' : ''}" data-act="list-type" data-v="tasks">Задачи</button><button class="${d.type === 'shopping' ? 'on' : ''}" data-act="list-type" data-v="shopping">Покупки</button></div>
      <p class="foot-note">${d.type === 'shopping' ? 'Товары группируются по отделам магазина, есть подсказки из прошлых покупок.' : 'Обычный список дел с датами, приоритетами и подзадачами.'}</p>
      ${sec('Цвет', `<div class="group"><div class="color-pick">${LIST_COLORS.map((c) => `<button class="${c === d.color ? 'on' : ''}" style="background:${c}" data-act="list-color" data-v="${c}" aria-label="Цвет"></button>`).join('')}</div></div>`)}
      ${sec('Значок', `<div class="group"><div class="emoji-pick">${LIST_EMOJI.map((e) => `<button class="${e === d.emoji ? 'on' : ''}" data-act="list-emoji" data-v="${e}">${e}</button>`).join('')}</div></div>`)}`,
    after: (first) => { if (first && !s.id) setTimeout(() => { const i = $('#list-name'); if (i) i.focus(); }, 60); },
  };
};
function openListEdit(id, type = 'tasks') {
  const l = id ? listById(id) : null;
  openSheet({ type: 'list-edit', id, draft: l ? { name: l.name, color: l.color, emoji: l.emoji, type: l.type } : { name: '', color: LIST_COLORS[(userLists().length + 1) % LIST_COLORS.length], emoji: type === 'shopping' ? '🛒' : '📌', type } });
}
SHEETS['list-menu'] = (s) => {
  const l = listById(s.id), tasks = l.type === 'tasks';
  const sorts = [['manual', 'Вручную'], ['date', 'Дата'], ['priority', 'Важность'], ['name', 'А–Я']];
  return {
    title: esc(l.name),
    body: `${tasks ? `<div class="sec-h" style="margin-top:4px">Сортировка</div><div class="seg">${sorts.map(([k, n]) => `<button class="${(l.sort || 'manual') === k ? 'on' : ''}" data-act="list-sort" data-v="${k}">${n}</button>`).join('')}</div>` : ''}
      <div class="group menu-list" style="margin-top:14px">
      ${!l.builtin ? `<button class="row" data-act="list-edit" data-id="${l.id}">${ic('edit')}<span class="grow r-title">Название, цвет, значок</span></button>` : ''}
      <button class="row" data-act="list-share" data-id="${l.id}">${ic('share')}<span class="grow r-title">Отправить список</span></button>
      <button class="row" data-act="list-copy" data-id="${l.id}">${ic('copy')}<span class="grow r-title">Скопировать текстом</span></button>
      <button class="row" data-act="list-tpl" data-id="${l.id}">${ic('layers')}<span class="grow r-title">Сохранить как шаблон</span></button>
      ${!IN_CLAUDE && tasks ? `<button class="row" data-act="list-ics" data-id="${l.id}">${ic('calplus')}<span class="grow r-title">Задачи с датами — в Календарь</span></button>` : ''}
      <button class="row" data-act="list-clear-done" data-id="${l.id}">${ic('check')}<span class="grow r-title">Удалить выполненные</span></button>
      ${!l.builtin ? `<button class="row danger" data-act="list-del" data-id="${l.id}">${ic('trash')}<span class="grow r-title">Удалить список</span></button>` : ''}</div>`,
  };
};

/* ---------- Habit editor ---------- */
function openHabitEdit(id, preset) {
  const h = id ? habitById(id) : null;
  const d = h ? { name: h.name, color: h.color, days: h.days.slice(), perWeek: h.perWeek, target: h.target, unit: h.unit }
    : Object.assign({ name: '', color: HABIT_COLORS[state.habits.length % HABIT_COLORS.length], days: [0, 1, 2, 3, 4, 5, 6], perWeek: 0, target: 1, unit: '' }, preset || {});
  openSheet({ type: 'habit-edit', id, draft: d });
}
SHEETS['habit-edit'] = (s) => {
  const d = s.draft;
  const mode = d.perWeek ? 'week' : d.days.length === 7 ? 'daily' : 'days';
  return {
    title: s.id ? 'Привычка' : 'Новая привычка',
    right: `<button class="txt-btn r" data-act="habit-save" ${d.name.trim() ? '' : 'disabled style="opacity:.4"'}>${s.id ? 'Готово' : 'Создать'}</button>`,
    body: `<input class="inp" id="habit-name" data-hf="name" value="${esc(d.name)}" placeholder="Например: Зарядка" style="margin-top:4px" maxlength="60">
      ${sec('Как часто', `<div class="seg"><button class="${mode === 'daily' ? 'on' : ''}" data-act="hab-mode" data-v="daily">Каждый день</button><button class="${mode === 'days' ? 'on' : ''}" data-act="hab-mode" data-v="days">По дням</button><button class="${mode === 'week' ? 'on' : ''}" data-act="hab-mode" data-v="week">N в неделю</button></div>
        ${mode === 'days' ? `<div class="chips" style="margin-top:10px">${WD_ORDER.map((x) => `<button class="chip ${d.days.includes(x) ? 'on' : ''}" data-act="hab-day" data-d="${x}">${WD_S[x]}</button>`).join('')}</div>` : ''}
        ${mode === 'week' ? `<div class="chips" style="margin-top:10px">${[1, 2, 3, 4, 5, 6].map((n) => `<button class="chip ${d.perWeek === n ? 'on' : ''}" data-act="hab-per" data-n="${n}">${pl(n, W_TIME)}</button>`).join('')}</div>` : ''}`)}
      ${sec('Цель на день', `<div class="group"><div class="fld"><span class="lbl">Сколько раз</span><div style="display:flex;align-items:center;gap:6px"><button class="round" style="width:34px;height:34px" data-act="hab-target" data-d="-1">${ic('minus', 'sm')}</button><b class="num" style="min-width:28px;text-align:center">${d.target}</b><button class="round" style="width:34px;height:34px" data-act="hab-target" data-d="1">${ic('plus', 'sm')}</button></div></div>
        <div class="fld"><span class="lbl">Единица</span><input type="text" class="val" data-hf="unit" value="${esc(d.unit)}" placeholder="стаканов, страниц…" style="max-width:55%"></div></div>
        <p class="foot-note">Для «Пить воду» поставьте 8 стаканов: каждое нажатие добавляет один.</p>`)}
      ${sec('Цвет', `<div class="group"><div class="color-pick">${HABIT_COLORS.map((c) => `<button class="${c === d.color ? 'on' : ''}" style="background:${c}" data-act="hab-color" data-v="${c}" aria-label="Цвет"></button>`).join('')}</div></div>`)}`,
    after: (first) => { if (first && !s.id && !d.name) setTimeout(() => { const i = $('#habit-name'); if (i) i.focus(); }, 60); },
  };
};

/* ---------- Pickers ---------- */
SHEETS['pick-list'] = (s) => ({
  title: 'Перенести в список',
  body: `<div class="group">${state.lists.filter((l) => !l.archived).map((l) => `<button class="row" data-act="pick-list" data-id="${l.id}"><span class="ico-box" style="background:${l.color}">${esc(l.emoji || '')}</span><span class="grow r-title">${esc(l.name)}</span></button>`).join('')}</div>`,
});
SHEETS['pick-prio'] = () => ({
  title: 'Приоритет',
  body: `<div class="group">${PRIO.slice().reverse().map((p) => `<button class="row" data-act="pick-prio" data-p="${p.v}"><span class="check p${p.v} on" style="width:20px;height:20px">${ic('flag', 'xs')}</span><span class="grow r-title">${p.name}</span></button>`).join('')}</div>`,
});
SHEETS['pick-task'] = () => {
  const tk = todayKey();
  const items = active().filter((t) => listById(t.listId).type !== 'shopping').sort((a, b) => ((a.date && a.date <= tk) ? 0 : 1) - ((b.date && b.date <= tk) ? 0 : 1) || cmpTask(a, b)).slice(0, 60);
  return {
    title: 'Задача для фокуса',
    body: items.length ? `<div class="group">${items.map((t) => `<button class="row" data-act="pick-task" data-id="${t.id}"><span class="check p${t.priority}" style="width:20px;height:20px"></span><span class="grow"><span class="r-title">${esc(t.title)}</span>${t.date ? `<br><span class="r-sub">${fmtDay(t.date)}${t.time ? ', ' + t.time : ''}</span>` : ''}</span></button>`).join('')}</div>` : emptyBox('Нет задач', 'Добавьте задачу, чтобы работать над ней в фокусе.'),
  };
};

/* ---------- Plan the day ---------- */
SHEETS.plan = (s) => {
  const tk = todayKey(), act = active().filter((t) => listById(t.listId).type !== 'shopping');
  const added = s.added || (s.added = []);
  const row = (t) => {
    const on = t.date === tk;
    return `<div class="row static"><span class="grow"><span class="r-title">${esc(t.title)}</span><br><span class="r-sub">${t.date ? fmtDay(t.date) : 'Без даты'} · ${esc(listById(t.listId).name)}${t.dur ? ' · ' + fmtDur(t.dur) : ''}</span></span>
      <button class="btn sm ${on ? 'soft' : 'ghost'}" data-act="plan-add" data-id="${t.id}">${on ? ic('check', 'sm') + 'Сегодня' : ic('plus', 'sm') + 'Взять'}</button></div>`;
  };
  if (!s.groups) {
    // membership is fixed when the sheet opens, so taken tasks stay in place with a "Сегодня" mark
    const shown = new Set();
    const take = (arr) => arr.filter((t) => { if (shown.has(t.id)) return false; shown.add(t.id); return true; }).map((t) => t.id);
    s.groups = [
      ['Просрочено', take(act.filter((t) => t.date && t.date < tk).sort(cmpTask))],
      ['Ближайшие 3 дня', take(act.filter((t) => t.date && t.date > tk && t.date <= addDays(tk, 3)).sort(cmpTask))],
      ['Важное без даты', take(act.filter((t) => !t.date && t.priority >= 2).sort(cmpTask))],
      ['Без даты', take(act.filter((t) => !t.date)).slice(0, 15)],
    ];
  }
  const groups = s.groups.map(([n, ids]) => [n, ids.map(taskById).filter((t) => t && !t.done)]);
  const todayLoad = act.filter((t) => t.date === tk).reduce((a, t) => a + (t.dur || 0), 0);
  const body = `<p class="help" style="margin:0 4px 6px">Выберите, что сделать сегодня. Уже запланировано: <b>${pl(act.filter((t) => t.date === tk).length, W_TASK)}</b>${todayLoad ? ` на ${fmtDur(todayLoad)}` : ''}.</p>
    ${groups.filter((g) => g[1].length).map(([n, arr]) => sec(n, `<div class="group">${arr.map(row).join('')}</div>`)).join('') || emptyBox('Нечего добавить', 'Все задачи уже распределены. Отличный порядок.')}`;
  return { title: 'План на день', right: '<button class="txt-btn r" data-act="sheet-close">Готово</button>', body, cls: 'full' };
};

/* ---------- Confirm ---------- */
function confirmSheet(text, okLabel, onOk, danger = true) { openSheet({ type: 'confirm', text, okLabel, onOk, danger }); }
SHEETS.confirm = (s) => ({
  title: 'Подтвердите',
  body: `<p class="confirm-txt">${s.text}</p><div class="btn-row"><button class="btn ghost" data-act="sheet-close">Отмена</button><button class="btn ${s.danger ? 'danger' : ''}" data-act="confirm-ok">${esc(s.okLabel)}</button></div>`,
});
