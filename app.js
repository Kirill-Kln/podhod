'use strict';
/* Подход — тренировочный дневник (PWA). Все данные — в localStorage телефона. */
const KEY = 'podhod.v1';
const VERSION = '0.5.1';
const PERIODS = [['week', 'Неделя', 7, 'за неделю'], ['month', 'Месяц', 30, 'за месяц'], ['3m', '3 месяца', 90, 'за 3 месяца'], ['year', 'Год', 365, 'за год'], ['all', 'Всё время', 0, 'за всё время']];

const DEFAULT_EX = [
  ['Грудь', ['Жим штанги лёжа', 'Жим гантелей лёжа', 'Жим штанги на наклонной', 'Жим гантелей на наклонной', 'Разводка гантелей', 'Сведение в кроссовере', 'Жим в тренажёре', 'Отжимания на брусьях', 'Отжимания']],
  ['Спина', ['Подтягивания', 'Тяга верхнего блока', 'Тяга штанги в наклоне', 'Тяга гантели одной рукой', 'Тяга горизонтального блока', 'Тяга Т-грифа', 'Пуловер на блоке', 'Становая тяга', 'Гиперэкстензия']],
  ['Ноги', ['Приседания со штангой', 'Жим ногами', 'Гакк-приседания', 'Выпады', 'Болгарские сплит-приседания', 'Румынская тяга', 'Разгибание ног', 'Сгибание ног', 'Ягодичный мост', 'Подъём на носки']],
  ['Плечи', ['Жим штанги стоя', 'Жим гантелей сидя', 'Махи гантелями в стороны', 'Махи в наклоне', 'Тяга штанги к подбородку', 'Обратная бабочка', 'Шраги']],
  ['Руки', ['Подъём штанги на бицепс', 'Подъём гантелей на бицепс', 'Молотки', 'Бицепс на блоке', 'Французский жим', 'Разгибание на трицепс в блоке', 'Жим узким хватом']],
  ['Пресс', ['Скручивания', 'Подъём ног в висе', 'Планка', 'Пресс на блоке']],
];
const GROUP_ORDER = DEFAULT_EX.map(g => g[0]).concat('Другое');

/* ---------- утилиты ---------- */
const $ = s => document.querySelector(s);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => { if (v === '' || v == null) return null; const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : null; };
const fmtW = n => n == null ? '' : String(Math.round(n * 100) / 100).replace('.', ',');
const DAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const fmtDate = iso => { const d = new Date(iso); return `${DAYS[d.getDay()]}, ${d.getDate()} ${MON[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''}`; };
const fmtShort = iso => { const d = new Date(iso); return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`; };
const fmtSec = s => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const MONG = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const WDAY = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const fmtInt = n => Math.round(n).toLocaleString('ru-RU');
const BK = (p, force) => `<button class="bk" data-act="nav" data-p="${p}"${force ? ' data-force="1"' : ''} aria-label="Назад">‹</button>`;
const head = (t, back, right = '', force) => `<header class="hd">${back ? BK(back, force) : ''}<h1>${t}</h1>${right}</header>`;
const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c; };

/* ---------- данные ---------- */
function seed() {
  return {
    v: 1,
    exercises: DEFAULT_EX.flatMap(([g, list]) => list.map(n => ({ id: uid(), name: n, group: g, rest: null }))),
    workouts: [], templates: [], activeId: null, timer: null,
    settings: { rest: 90, sound: true, countdown: true, theme: 'light' },
  };
}
function migrate(s) {
  s.templates = s.templates || [];
  s.settings = { rest: 90, sound: true, countdown: true, ...(s.settings || {}) };
  if (!['light', 'dark', 'system'].includes(s.settings.theme)) s.settings.theme = 'light';
  const pe = s.settings.period;
  if (!pe || ![...PERIODS.map(x => x[0]), 'custom'].includes(pe.k) || (pe.k === 'custom' && !(parseYmd(pe.from) && parseYmd(pe.to)))) s.settings.period = { k: 'month' };
  return s;
}
function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) return migrate(s); } catch (e) { }
  return seed();
}
let S = load();
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Не удалось сохранить — память переполнена?'); } }
if (!localStorage.getItem(KEY)) save();

const ex = id => S.exercises.find(e => e.id === id) || { id, name: '(удалённое)', group: 'Другое', rest: null };
const wk = id => S.workouts.find(w => w.id === id);
const sorted = () => [...S.workouts].sort((a, b) => b.date.localeCompare(a.date));
const doneSets = it => it.sets.filter(s => s.done);
const setStr = s => (s.w != null ? fmtW(s.w) + '×' : '') + (s.r ?? '–');
const restFor = exId => ex(exId).rest ?? S.settings.rest;
const groups = () => { const g = new Set(S.exercises.map(e => e.group || 'Другое')); return [...GROUP_ORDER.filter(x => g.has(x)), ...[...g].filter(x => !GROUP_ORDER.includes(x)).sort()]; };
const wTitle = w => w.title || [...new Set(w.items.map(i => ex(i.exId).group).filter(Boolean))].join(' · ') || 'Тренировка';
const tonnage = w => w.items.reduce((a, it) => a + doneSets(it).reduce((b, s) => b + (s.w || 0) * (s.r || 0), 0), 0);
const setCount = w => w.items.reduce((a, it) => a + doneSets(it).length, 0);
const dateVal = iso => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const elapsed = w => { const m = Math.round(((w.end ? new Date(w.end) : new Date()) - new Date(w.date)) / 60000); return m < 60 ? `${m} мин` : `${Math.floor(m / 60)} ч ${m % 60} мин`; };
const usedCount = exId => S.workouts.filter(w => w.items.some(i => i.exId === exId)).length;

function lastTime(exId, beforeIso, exceptId) {
  for (const w of sorted()) {
    if (w.id === exceptId || (beforeIso && w.date >= beforeIso)) continue;
    const sets = w.items.filter(i => i.exId === exId).flatMap(doneSets);
    if (sets.length) return { w, sets };
  }
  return null;
}

/* ---------- звук и таймер ---------- */
let actx = null, scheduled = [], alarmFor = null;
function audio() {
  if (!actx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; actx = new C(); }
  if (actx.state !== 'running') actx.resume();
  return actx;
}
function unlockAudio() {
  try { if (navigator.audioSession) navigator.audioSession.type = 'transient'; } catch (e) { }
  const c = audio(); if (!c) return;
  const b = c.createBuffer(1, 1, 22050), s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0);
}
function beep(at, freq, dur, vol) {
  const c = audio(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = 'sine'; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g); g.connect(c.destination); o.start(at); o.stop(at + dur + 0.05); scheduled.push(o);
}
function scheduleAlarm(secLeft) {
  cancelAlarm(); if (!S.settings.sound) return;
  const c = audio(); if (!c) return;
  const t0 = c.currentTime + Math.max(0.05, secLeft);
  if (S.settings.countdown) for (const k of [3, 2, 1]) if (secLeft > k + 0.2) beep(t0 - k, 660, 0.13, 0.45);
  beep(t0, 988, 0.35, 0.9); beep(t0 + 0.45, 988, 0.35, 0.9); beep(t0 + 0.9, 1319, 0.7, 0.9);
}
function cancelAlarm() { scheduled.forEach(o => { try { o.stop(0); } catch (e) { } }); scheduled = []; }

function startTimer(sec, label) {
  unlockAudio();
  S.timer = { end: Date.now() + sec * 1000, total: sec, label, fired: false };
  save(); scheduleAlarm(sec); alarmFor = S.timer.end; renderTimer(true);
}
function adjustTimer(d) {
  const t = S.timer; if (!t) return;
  t.end += d * 1000; t.total = Math.max(1, t.total + d);
  const left = (t.end - Date.now()) / 1000;
  if (left <= 0) return stopTimer();
  t.fired = false; scheduleAlarm(left); alarmFor = t.end; save(); renderTimer(true);
}
function stopTimer() { cancelAlarm(); S.timer = null; alarmFor = null; save(); renderTimer(true); }

function renderTimer(force) {
  const el = $('#timer'), t = S.timer;
  if (!t) { el.hidden = true; el.dataset.mode = ''; document.body.classList.remove('has-timer'); return; }
  el.hidden = false; document.body.classList.add('has-timer');
  const left = (t.end - Date.now()) / 1000;
  if (left <= 0) {
    if (!t.fired) {
      t.fired = true; save();
      if (alarmFor !== t.end && S.settings.sound) scheduleAlarm(0.05); // таймер пережил перезагрузку
      document.body.classList.add('alarm'); setTimeout(() => document.body.classList.remove('alarm'), 2100);
    }
    if (el.dataset.mode !== 'over' || force) {
      el.dataset.mode = 'over'; el.className = 'timer over';
      el.innerHTML = `<div class="tc" data-act="tstop"><b>Отдых окончен</b><span>Далее: ${esc(t.label)}</span></div><button class="icon" data-act="tstop" aria-label="Закрыть">✕</button>`;
    }
    return;
  }
  if (el.dataset.mode !== 'run' || force) {
    el.dataset.mode = 'run'; el.className = 'timer';
    el.innerHTML = `<div class="bar"></div><button class="tb" data-act="tadj" data-d="-15">−15</button><div class="tc"><b></b><span></span></div><button class="tb" data-act="tadj" data-d="15">+15</button><button class="icon" data-act="tstop" aria-label="Стоп">✕</button>`;
  }
  el.querySelector('.bar').style.width = (100 * left / t.total) + '%';
  el.querySelector('.tc b').textContent = fmtSec(left);
  el.querySelector('.tc span').textContent = 'Далее: ' + t.label;
}

/* экран не гаснет, пока идёт тренировка */
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && !wakeLock && 'wakeLock' in navigator && document.visibilityState === 'visible') {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { }
}

/* ---------- экраны ---------- */
/* программа: шаблоны тренировок по дням недели */
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const tpl = id => S.templates.find(t => t.id === id);
const tplsFor = day => S.templates.filter(t => t.days.includes(day));
const tplDays = t => t.days.length ? WEEK.filter(d => t.days.includes(d)).map(d => DAYS[d]).join(', ') : 'без дня';
function nextPlanned() {
  const t = new Date().getDay();
  for (let k = 1; k <= 7; k++) { const d = (t + k) % 7, l = tplsFor(d); if (l.length) return { k, d, l }; }
  return null;
}
const tplStartCard = (t, main) => `<button class="card row${main ? ' today' : ''}" data-act="tstart" data-t="${t.id}"><div><b>${esc(t.name)}</b>
  <small>${tplDays(t)} · ${t.items.map(i => esc(ex(i.exId).name)).join(', ') || 'пустой'}</small></div><span class="chev">▶</span></button>`;

function viewStart() {
  const today = new Date().getDay(), todays = tplsFor(today), recent = sorted().slice(0, 4);
  const doneToday = S.workouts.some(w => sameDay(w.date, new Date().toISOString()));
  let html = head('Тренировка');
  if (S.templates.length) {
    if (todays.length) html += `<h3>Сегодня, ${DAYS[today]}${doneToday ? ' · уже была тренировка' : ' — по плану'}</h3>` + todays.map(t => tplStartCard(t, !doneToday)).join('');
    else { const n = nextPlanned(); html += `<div class="card"><b>Сегодня по плану отдых</b><small>${n ? `Дальше ${n.k === 1 ? 'завтра' : 'в ' + DAYS[n.d]}: ${n.l.map(t => esc(t.name)).join(', ')}` : ''}</small></div>`; }
    const others = S.templates.filter(t => !todays.includes(t));
    if (others.length) html += '<h3>Другие из программы</h3>' + others.map(t => tplStartCard(t, false)).join('');
    html += `<button class="btn" data-act="start">Пустая тренировка</button>`;
  } else {
    html += `<button class="btn big primary" data-act="start">Начать тренировку</button>
    <button class="card row" data-act="go" data-to="plan"><div><b>Настрой свой сплит</b><small>Шаблоны тренировок по дням недели: открыл — и сразу начал с прошлыми весами</small></div><span class="chev">›</span></button>`;
  }
  return html + `${recent.length ? `<h3>Повторить прошлую</h3>${recent.map(w => `
    <button class="card row" data-act="repeat" data-w="${w.id}"><div><b>${esc(wTitle(w))}</b>
    <small>${fmtDate(w.date)} · ${w.items.map(i => esc(ex(i.exId).name)).slice(0, 3).join(', ')}${w.items.length > 3 ? '…' : ''}</small></div><span class="chev">↻</span></button>`).join('')}`
    : `<p class="empty">Здесь появятся прошлые тренировки.<br>Любую можно будет повторить одной кнопкой — с прошлыми весами.</p>`}
  ${S.templates.length ? `<button class="btn ghost" data-act="go" data-to="plan">Программа и шаблоны</button>` : ''}`;
}

function viewPlan() {
  const td = new Date().getDay();
  return `${head('Программа', 'workout')}
  <div class="week">${WEEK.map(d => `<div class="wd${d === td ? ' on' : ''}"><b>${DAYS[d]}</b><span>${tplsFor(d).map(t => esc(t.name)).join('<br>') || '—'}</span></div>`).join('')}</div>
  ${S.templates.map(t => `<button class="card row" data-act="go" data-to="plan/${t.id}"><div><b>${esc(t.name)}</b><small>${tplDays(t)} · ${t.items.length} упр.</small>
    <small>${t.items.map(i => esc(ex(i.exId).name)).join(', ')}</small></div><span class="chev">›</span></button>`).join('')}
  <button class="btn primary" data-act="tnew">+ Новый шаблон</button>
  ${S.workouts.length ? `<button class="btn" data-act="tauto">Собрать сплит из истории</button>` : ''}
  <button class="btn" data-act="go" data-to="workout">← К тренировке</button>`;
}
function viewTpl(id) {
  const t = tpl(id); if (!t) return viewPlan();
  const a = i => `data-t="${t.id}" data-i="${i}"`;
  return `<div class="whead"><div class="hd">${BK('plan')}<input class="title" data-tf="name" data-t="${t.id}" value="${esc(t.name)}" placeholder="Название, напр. Верх А"></div></div>
  <h3>Дни недели</h3><div class="days">${WEEK.map(d => `<button class="${t.days.includes(d) ? 'on' : ''}" data-act="tday" data-t="${t.id}" data-d="${d}">${DAYS[d]}</button>`).join('')}</div>
  <h3>Упражнения · подходов</h3>
  ${t.items.length ? `<div class="list">${t.items.map((it, i) => `<div class="li tpli"><span>${esc(ex(it.exId).name)}</span><div class="tctl">
    <button data-act="tsets" ${a(i)} data-d="-1">−</button><b>${it.sets}</b><button data-act="tsets" ${a(i)} data-d="1">+</button>
    ${i ? `<button data-act="tmv" ${a(i)} aria-label="Выше">↑</button>` : ''}<button data-act="titemdel" ${a(i)} aria-label="Убрать">×</button></div></div>`).join('')}</div>`
      : '<p class="muted">Пока пусто — добавь упражнения.</p>'}
  <button class="btn ghost" data-act="tpick" data-t="${t.id}">+ Упражнение</button>
  <p class="muted" style="font-size:13px">Веса подставятся из прошлого раза по каждому упражнению.</p>
  <button class="btn primary big" data-act="tstart" data-t="${t.id}">Начать эту тренировку</button>
  <button class="btn" data-act="go" data-to="plan">← К программе</button>
  <button class="btn danger" data-act="tremove" data-t="${t.id}">Удалить шаблон</button>`;
}
let autoDays = [];
function autoSheet() {
  const since = Date.now() - 28 * 864e5, cnt = [0, 0, 0, 0, 0, 0, 0];
  S.workouts.forEach(w => { if (new Date(w.date) >= since) cnt[new Date(w.date).getDay()]++; });
  autoDays = WEEK.filter(d => cnt[d] >= 2);
  sheet(`<h2>Сплит из истории</h2><p class="muted" style="font-size:14px;margin-top:0">Отметь дни, в которые тренируешься. Для каждого возьму последнюю тренировку в этот день недели — её упражнения и число подходов. Потом всё можно поправить.</p>
  <div class="days" id="autodays"></div><button class="btn primary" data-act="tautodo">Собрать</button>`);
  renderAutoDays();
}
const renderAutoDays = () => { $('#autodays').innerHTML = WEEK.map(d => `<button class="${autoDays.includes(d) ? 'on' : ''}" data-act="aday" data-d="${d}">${DAYS[d]}</button>`).join(''); };
function autoBuild() {
  let made = 0;
  for (const d of autoDays) {
    if (S.templates.some(t => t.days.includes(d))) continue;
    const w = sorted().find(x => new Date(x.date).getDay() === d && x.id !== S.activeId); if (!w) continue;
    const base = w.items.some(i => ex(i.exId).group === 'Ноги') ? 'Низ' : 'Верх';
    S.templates.push({ id: uid(), name: `${base} · ${DAYS[d]}`, days: [d], items: w.items.map(i => ({ exId: i.exId, sets: doneSets(i).length || i.sets.length || 3 })) });
    made++;
  }
  save(); closeSheet(); toast(made ? `Создано шаблонов: ${made}` : 'Новых шаблонов нет — на эти дни уже есть'); go('plan');
}
function tplFromWorkout(w) {
  const t = { id: uid(), name: wTitle(w), days: [new Date(w.date).getDay()], items: w.items.map(i => ({ exId: i.exId, sets: doneSets(i).length || i.sets.length || 3 })) };
  S.templates.push(t); save(); go('plan/' + t.id);
}
function startFromTpl(t) {
  newWorkout(t.items.map(it => {
    const src = lastTime(it.exId)?.sets || [];
    return { exId: it.exId, sets: Array.from({ length: it.sets || 3 }, (_, k) => { const s = src[k] || src.at(-1); return { w: s ? s.w : null, r: s ? s.r : null, done: false }; }) };
  }), t.name, t.id);
}

function viewWorkout(w) {
  if (!w) return viewStart();
  const active = S.activeId === w.id;
  return `<div class="whead"><div class="hd">${active ? BK('home', true) : BK('history')}<input class="title" data-f="title" data-w="${w.id}" placeholder="${esc(wTitle(w))}" value="${esc(w.title || '')}"></div>
    <div class="wmeta"><input type="date" class="wdate" data-f="date" data-w="${w.id}" value="${dateVal(w.date)}">
    <small>${active ? `идёт <span id="elapsed">${elapsed(w)}</span> · ` : w.end ? elapsed(w) + ' · ' : ''}${setCount(w)} ${plural(setCount(w), 'подход', 'подхода', 'подходов')}${tonnage(w) ? ` · ${fmtW(Math.round(tonnage(w)))} кг` : ''}</small></div>
    <textarea class="wnote" data-f="note" data-w="${w.id}" rows="1" placeholder="Заметка к тренировке">${esc(w.note || '')}</textarea></div>
  ${w.items.map((it, i) => itemCard(w, it, i, active)).join('')}
  <button class="btn ghost big" data-act="pick" data-w="${w.id}">+ Упражнение</button>
  ${active ? `<button class="btn big primary" data-act="finish" data-w="${w.id}">Завершить тренировку</button>`
      : `<button class="btn" data-act="back">← К истории</button><button class="btn" data-act="tfromw" data-w="${w.id}">Сохранить как шаблон</button><button class="btn danger" data-act="delw" data-w="${w.id}">Удалить тренировку</button>`}`;
}

function itemCard(w, it, i) {
  const e = ex(it.exId), lt = lastTime(it.exId, w.date, w.id);
  const a = `data-w="${w.id}" data-i="${i}"`;
  return `<section class="card ex">
    <div class="exh"><div><b>${esc(e.name)}</b><small>${lt ? `Прошлый раз ${fmtShort(lt.w.date)}: ${lt.sets.map(setStr).join(' · ')}` : 'Впервые'}</small>${it.note ? `<small class="inote">📝 ${esc(it.note)}</small>` : ''}</div>
    <button class="icon" data-act="exmenu" ${a} aria-label="Меню">⋯</button></div>
    <div class="sets">${it.sets.map((s, j) => `
      <div class="set ${s.done ? 'done' : ''}"><span class="n">${j + 1}</span>
      <label><input data-f="w" ${a} data-j="${j}" inputmode="decimal" enterkeyhint="next" placeholder="—" value="${fmtW(s.w)}"><em>кг</em></label>
      <label><input data-f="r" ${a} data-j="${j}" inputmode="numeric" enterkeyhint="done" placeholder="—" value="${s.r ?? ''}"><em>раз</em></label>
      <button class="chk" data-act="done" ${a} data-j="${j}" aria-label="Подход сделан">✓</button>
      <button class="x" data-act="delset" ${a} data-j="${j}" aria-label="Удалить подход">×</button></div>`).join('')}</div>
    <div class="exf"><button class="btn sm" data-act="addset" ${a}>+ Подход</button>
    <button class="chip" data-act="rest" data-ex="${it.exId}">⏱ отдых ${fmtSec(restFor(it.exId))}</button></div></section>`;
}

/* ---------- период (общий для Главной, Прогресса и графика упражнения) ---------- */
function parseYmd(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]); return d.getMonth() === +m[2] - 1 ? d : null;
}
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const dayStart = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const fmtDM = d => `${d.getDate()} ${MON[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''}`;
// from — начало первого дня, end — начало дня ПОСЛЕ последнего (сегодня включительно)
function period() {
  const pe = S.settings.period || { k: 'month' }, t0 = dayStart(new Date()), tomorrow = addDays(t0, 1);
  let k = pe.k, from, end = tomorrow, on;
  if (k === 'custom') {
    let a = parseYmd(pe.from), b = parseYmd(pe.to);
    if (!a || !b) k = 'month';
    else { if (a > b) [a, b] = [b, a]; from = a; end = addDays(b, 1); on = 'за период'; }
  }
  if (k === 'all') {
    const ds = finished().map(w => w.date); from = ds.length ? dayStart(ds.reduce((a, d) => d < a ? d : a)) : t0; on = 'за всё время';
    if (from > t0) from = t0;
  } else if (k !== 'custom') {
    const P = PERIODS.find(x => x[0] === k) || PERIODS[1]; k = P[0]; from = addDays(t0, 1 - P[2]); on = P[3];
  }
  const days = Math.max(1, Math.round((end - from) / 864e5)), last = addDays(end, -1);
  return { k, from, end, days, on, all: k === 'all', prev: k === 'all' ? null : { from: addDays(from, -days), end: from },
    range: days === 1 ? fmtDM(from) : `${fmtDM(from)} — ${fmtDM(last)}` };
}
const inR = (w, r) => { const t = new Date(w.date); return t >= r.from && t < r.end; };
function periodBar() {
  const r = period();
  return `<div class="pchips">${PERIODS.map(([k, n]) => `<button class="${r.k === k ? 'on' : ''}" data-act="period" data-k="${k}">${n}</button>`).join('')}<button class="${r.k === 'custom' ? 'on' : ''}" data-act="pcustom">Свои даты</button></div><div class="prange">${r.range}</div>`;
}
function periodSheet() {
  const r = period();
  sheet(`<h2>Свои даты</h2><label class="f"><span>От</span><input type="date" id="pfrom" value="${ymd(r.from)}"></label>
  <label class="f"><span>До (включительно)</span><input type="date" id="pto" value="${ymd(addDays(r.end, -1))}"></label>
  <button class="btn primary" data-act="papply">Применить</button>`);
}
function periodApply() {
  let a = $('#pfrom').value, b = $('#pto').value;
  if (!a && !b) return toast('Выбери даты');
  if (!a) a = b; if (!b) b = ymd(new Date());
  if (!parseYmd(a) || !parseYmd(b)) return toast('Не разобрал даты');
  if (a > b) [a, b] = [b, a];
  S.settings.period = { k: 'custom', from: a, to: b }; save(); closeSheet(); render();
}
// столбики: по дням (до 14 дн.), неделям (до 100 дн.), иначе по месяцам (последние 12)
// подписи столбиков: при >7 столбиков — через шаг, первая и последняя всегда
function labShow(i, n) { if (n <= 7) return true; const st = Math.ceil(n / 4); return i === 0 || i === n - 1 || (i % st === 0 && n - 1 - i >= st); }
function buckets(r, list) {
  const out = [], now = new Date(), mode = r.days <= 14 ? 'd' : r.days <= 100 ? 'w' : 'm';
  if (mode === 'd') for (let s = r.from; s < r.end; s = addDays(s, 1)) out.push({ s, e: addDays(s, 1), lab: s.getDate() });
  else if (mode === 'w') for (let s = weekStart(r.from); s < r.end; s = addDays(s, 7)) out.push({ s, e: addDays(s, 7), lab: (s < r.from ? r.from : s).getDate() });
  else for (let s = new Date(r.from.getFullYear(), r.from.getMonth(), 1); s < r.end; s = new Date(s.getFullYear(), s.getMonth() + 1, 1)) out.push({ s, e: new Date(s.getFullYear(), s.getMonth() + 1, 1), lab: MON[s.getMonth()] + (s.getMonth() === 0 || s === r.from || (s.getFullYear() === r.from.getFullYear() && s.getMonth() === r.from.getMonth()) ? ' ’' + String(s.getFullYear()).slice(2) : '') });
  const res = (mode === 'm' ? out.slice(-12) : out).map(x => {
    const lo = x.s < r.from ? r.from : x.s, hi = x.e > r.end ? r.end : x.e;
    return { ...x, c: list.filter(w => { const t = new Date(w.date); return t >= lo && t < hi; }).length, cur: now >= x.s && now < x.e };
  });
  res.mode = mode; return res;
}

/* ---------- календарь и сводка ---------- */
const finished = () => S.workouts.filter(w => w.id !== S.activeId);
function byDay() { const m = new Map(); for (const w of finished()) { const k = dateVal(w.date); if (!m.has(k)) m.set(k, []); m.get(k).push(w); } return m; }
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const monthKey = d => d.getFullYear() * 12 + d.getMonth();
const arrow = (d, unit = '') => d > 0 ? `<span class="up">↑ ${fmtW(Math.round(d * 10) / 10)}${unit}</span>` : d < 0 ? `<span class="dn">↓ ${fmtW(Math.round(-d * 10) / 10)}${unit}</span>` : `<span class="eq">без изменений</span>`;
const CAL_ICON = '<svg viewBox="0 0 24 24" class="ico"><rect x="4" y="5.5" width="16" height="14" rx="3"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/></svg>';

function calendarHtml() {
  const map = byDay(), fin = finished(), now = new Date(), today = ymd(now);
  let lo = monthKey(now), hi = lo;
  for (const w of fin) { const k = monthKey(new Date(w.date)); lo = Math.min(lo, k); hi = Math.max(hi, k); }
  lo = Math.max(lo, hi - 60);
  let html = '';
  for (let k = hi; k >= lo; k--) {
    const y = Math.floor(k / 12), m = k % 12, n = new Date(y, m + 1, 0).getDate(), lead = (new Date(y, m, 1).getDay() + 6) % 7;
    let cnt = 0, cells = '';
    for (let i = 0; i < lead; i++) cells += '<span></span>';
    for (let d = 1; d <= n; d++) {
      const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, c = (map.get(key) || []).length;
      cnt += c;
      cells += `<button class="cd${c ? ' has' : ''}${c > 1 ? ' two' : ''}${key === today ? ' today' : ''}${key > today ? ' fut' : ''}" data-act="day" data-d="${key}" aria-label="${d} ${MONG[m]}">${d}</button>`;
    }
    html += `<div class="card mon"><div class="mh"><b>${MONTHS[m]} ${y}</b><span>${cnt} ${plural(cnt, 'тренировка', 'тренировки', 'тренировок')}</span></div>
    <div class="cal">${['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'].map(x => `<i>${x}</i>`).join('')}${cells}</div></div>`;
  }
  return html;
}

function daySheet(key) {
  const [y, m, d] = key.split('-').map(Number), dt = new Date(y, m - 1, d);
  const list = finished().filter(w => dateVal(w.date) === key).sort((a, b) => a.date.localeCompare(b.date));
  const body = list.length ? list.map(w => {
    const meta = [w.end ? elapsed(w) : '', tonnage(w) ? fmtInt(tonnage(w)) + ' кг' : '', `${setCount(w)} ${plural(setCount(w), 'подход', 'подхода', 'подходов')}`].filter(Boolean).join(' · ');
    return `<div class="card flat"><b>${esc(wTitle(w))}</b><small>${meta}</small>
      ${w.items.length ? w.items.map(it => { const ss = doneSets(it).length ? doneSets(it) : it.sets; return `<div class="dsess"><span>${esc(ex(it.exId).name)}</span><div>${ss.map(setStr).join(' · ')}</div></div>`; }).join('') : '<small>Пока без упражнений</small>'}
      <button class="btn primary" data-act="open" data-w="${w.id}">Открыть</button></div>`;
  }).join('') : '<p class="empty" style="padding:18px 10px">Отдых</p>';
  sheet(`<h2>${WDAY[dt.getDay()]}, ${d} ${MONG[m - 1]}</h2>${body}
  <button class="btn${list.length ? '' : ' primary'}" data-act="addday" data-d="${key}">${list.length ? '+ Ещё одна тренировка в этот день' : 'Добавить тренировку на этот день'}</button>`);
}
function addDay(key) {
  const [y, m, d] = key.split('-').map(Number);
  const w = { id: uid(), date: new Date(y, m - 1, d, 18, 0).toISOString(), title: '', items: [] };
  S.workouts.push(w); save(); closeSheet(); go('workout/' + w.id);
}

function viewHistory() {
  const list = sorted().filter(w => w.id !== S.activeId);
  let html = head('История') + calendarHtml();
  if (!list.length) return html + `<p class="empty">Пока пусто. Заверши первую тренировку — она появится здесь.</p>`;
  html += '<h3>Список</h3>';
  let month = '';
  for (const w of list) {
    const d = new Date(w.date), m = d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
    if (m !== month) { month = m; html += `<h3>${m}</h3>`; }
    html += `<button class="card row" data-act="open" data-w="${w.id}"><div><b>${esc(wTitle(w))}</b>
      <small>${fmtDate(w.date)} · ${w.items.length} упр. · ${setCount(w)} подх.${tonnage(w) ? ` · ${fmtW(Math.round(tonnage(w)))} кг` : ''}</small>
      <small>${w.items.map(i => esc(ex(i.exId).name)).join(', ')}</small></div><span class="chev">›</span></button>`;
  }
  return html;
}

/* ---------- главная ---------- */
function progRows(r) {
  const ids = [...new Set(S.workouts.flatMap(w => w.items.map(i => i.exId)))], rows = [];
  for (const id of ids) {
    const h = exHistory(id), rec = h.filter(x => inR(x.w, r));
    if (!rec.length) continue;
    const last = rec.at(-1), cur = sessStats(last.sets);
    const before = h.filter(x => new Date(x.w.date) < r.from), ref = before.length ? before.at(-1) : rec[0];
    const delta = ref === last ? null : cur.best - sessStats(ref.sets).best;
    const all = rec.flatMap(x => x.sets), ws = all.filter(s => s.w), rs = all.filter(s => s.r != null);
    rows.push({ id, n: rec.length, last: last.w.date, cur, delta, avgW: ws.length ? ws.reduce((a, s) => a + s.w, 0) / ws.length : null, avgR: rs.length ? rs.reduce((a, s) => a + s.r, 0) / rs.length : null });
  }
  return rows.sort((a, b) => b.n - a.n || b.last.localeCompare(a.last));
}

function viewHome() {
  const now = new Date(), fin = finished(), map = byDay(), today = ymd(now), act = S.activeId && wk(S.activeId);
  const r = period(), wk0 = weekStart(now);
  const mine = fin.filter(w => inR(w, r)), prev = r.prev ? fin.filter(w => inR(w, r.prev)) : null;
  let html = head('Главная', null, `<button class="ibtn" data-act="go" data-to="history" aria-label="Календарь">${CAL_ICON}</button>`);
  if (act) html += `<button class="card row hot" data-act="go" data-to="workout"><div><small class="cap">Идёт тренировка</small><b>${esc(wTitle(act))}</b><small>${setCount(act)} ${plural(setCount(act), 'подход', 'подхода', 'подходов')}</small></div><span class="pill">Продолжить</span></button>`;
  // неделя
  html += '<div class="wstrip">' + Array.from({ length: 7 }, (_, k) => {
    const d = new Date(wk0); d.setDate(d.getDate() + k); const key = ymd(d), c = (map.get(key) || []).length;
    return `<div class="wsd"><span>${['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'][k]}</span><button class="${c ? 'has ' : ''}${key === today ? 'today ' : ''}${key > today ? 'fut' : ''}" data-act="wday" data-d="${key}">${d.getDate()}</button></div>`;
  }).join('') + '</div>';
  html += periodBar();
  // период: счётчик и столбики
  const bk = buckets(r, mine), mx = Math.max(3, ...bk.map(x => x.c));
  html += `<div class="card mcard"><div class="mleft"><small class="cap">Тренировок ${r.on}</small><div class="big">${mine.length}</div>
    <small>${prev ? `в прошлом периоде ${prev.length} ${arrow(mine.length - prev.length)}` : `за ${r.days} ${plural(r.days, 'день', 'дня', 'дней')}`}</small></div>
    <div class="mbars">${bk.map((x, i) => `<div class="mc"><div class="mb"><div class="f${x.cur ? ' cur' : ''}" style="height:${x.c ? Math.max(8, 100 * x.c / mx) : 0}%"></div></div><em>${labShow(i, bk.length) ? x.lab : ''}</em></div>`).join('')}</div></div>`;
  // плитки
  const perW = mine.length / Math.max(1, r.days / 7);
  const ton = mine.reduce((a, w) => a + tonnage(w), 0);
  const msets = mine.flatMap(w => w.items.flatMap(doneSets)).filter(s => s.r != null);
  const avgR = msets.length ? msets.reduce((a, s) => a + s.r, 0) / msets.length : null;
  const wkeys = new Set(fin.map(w => ymd(weekStart(new Date(w.date)))));
  const k = new Date(wk0); let streak = 0;
  if (!wkeys.has(ymd(k))) k.setDate(k.getDate() - 7);
  while (wkeys.has(ymd(k))) { streak++; k.setDate(k.getDate() - 7); }
  const lastW = sorted().find(w => w.id !== S.activeId), since = lastW ? Math.max(0, Math.floor((now - new Date(lastW.date)) / 864e5)) : null;
  html += `<div class="tiles2">
    <div class="card t2"><small class="cap">В неделю в среднем</small><div class="big s">${mine.length ? fmtW(Math.round(perW * 10) / 10) : '—'}</div><small>${r.on}</small></div>
    <div class="card t2"><small class="cap">Тоннаж ${r.on}</small><div class="big s">${ton ? fmtInt(ton) : '—'}</div><small>кг (вес × повторы)</small></div>
    <div class="card t2"><small class="cap">Средние повторы</small><div class="big s">${avgR != null ? fmtW(Math.round(avgR * 10) / 10) : '—'}</div><small>на подход, ${r.on}</small></div>
    <div class="card t2"><small class="cap">Серия</small><div class="big s">${streak || '—'}</div><small>${streak ? plural(streak, 'неделя', 'недели', 'недель') + ' подряд' : since != null ? (since ? since + ' ' + plural(since, 'день', 'дня', 'дней') + ' без тренировки' : 'сегодня тренировка') : 'недель подряд'}</small></div></div>`;
  // план
  if (!act) {
    const todays = tplsFor(now.getDay()), done = map.has(today);
    if (S.templates.length && todays.length && !done) html += todays.map(t => `<div class="card row plan"><div><small class="cap">Сегодня по плану</small><b>${esc(t.name)}</b><small>${t.items.map(i => esc(ex(i.exId).name)).join(', ') || 'пустой'}</small></div><button class="pill" data-act="tstart" data-t="${t.id}">Начать</button></div>`).join('');
    else {
      const n = S.templates.length && !todays.length ? nextPlanned() : null;
      html += `<div class="card row plan"><div><small class="cap">${done ? 'Сегодня уже была тренировка' : 'Тренировка'}</small><b>${done ? 'Ещё одну?' : 'Начать тренировку'}</b><small>${n ? `По плану ${n.k === 1 ? 'завтра' : 'в ' + DAYS[n.d]}: ${n.l.map(t => esc(t.name)).join(', ')}` : 'Пустая — упражнения добавишь по ходу'}</small></div><button class="pill" data-act="start">Начать</button></div>`;
    }
  }
  // прогресс по упражнениям
  const rows = progRows(r);
  const per = r;
  html += '<h3>Прогресс по упражнениям</h3>' + (rows.length ? `<div class="card plist">${rows.slice(0, 20).map(r => {
    const unit = r.cur.bw ? ' раз' : ' кг';
    return `<button class="prow" data-act="prog" data-ex="${r.id}"><div class="pl"><b>${esc(ex(r.id).name)}</b><small>${r.avgW != null ? 'ср. ' + fmtW(Math.round(r.avgW * 10) / 10) + ' кг · ' : ''}${r.avgR != null ? fmtW(Math.round(r.avgR * 10) / 10) + ' повт.' : ''} ${per.on}</small></div>
      <div class="pr2"><b>${fmtW(r.cur.best)}${unit}</b><small>${r.delta == null ? 'первая запись' : 'к началу ' + arrow(r.delta, r.cur.bw ? '' : ' кг')}</small></div></button>`;
  }).join('')}</div>` : `<p class="empty" style="padding:20px 10px">${fin.length ? 'В этом периоде упражнений нет — расширь период.' : 'Здесь появятся упражнения, которые ты делал.'}</p>`);
  return html;
}

const e1rm = s => !s.w ? 0 : (s.r > 1 ? s.w * (1 + s.r / 30) : s.w);
function exHistory(exId) {
  return [...S.workouts].sort((a, b) => a.date.localeCompare(b.date))
    .map(w => ({ w, sets: w.items.filter(i => i.exId === exId).flatMap(doneSets) })).filter(x => x.sets.length);
}
function sessStats(sets) {
  const bw = sets.every(s => !s.w);
  const top = bw ? sets.reduce((a, s) => (s.r || 0) > (a.r || 0) ? s : a) : sets.reduce((a, s) => (s.w || 0) > (a.w || 0) || ((s.w || 0) === (a.w || 0) && (s.r || 0) > (a.r || 0)) ? s : a);
  return { bw, top, best: bw ? (top.r || 0) : top.w, orm: Math.max(...sets.map(e1rm)), vol: sets.reduce((a, s) => a + (s.w || 0) * (s.r || 0), 0), reps: sets.reduce((a, s) => a + (s.r || 0), 0) };
}

function weekStart(d) { d = new Date(d); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return d; }
function viewProgress() {
  const all = S.workouts.filter(w => w.id !== S.activeId), r = period();
  const inP = all.filter(w => inR(w, r)), bk = buckets(r, inP);
  const rows = progRows(r).sort((a, b) => b.last.localeCompare(a.last)).map(x => ({ ...x, pr: exHistory(x.id).filter(h => inR(h.w, r)).map(h => sessStats(h.sets)).reduce((a, b) => b.best > a.best ? b : a) }));
  const bt = { d: 'по дням', w: 'по неделям', m: 'по месяцам' }[bk.mode];
  return `${head('Прогресс')}${periodBar()}
  <div class="tiles"><div class="tile"><b>${inP.length}</b><small>тренировок ${r.on}</small></div>
  <div class="tile"><b>${all.length}</b><small>всего</small></div><div class="tile"><b>${inP.length ? fmtW(Math.round(inP.length / Math.max(1, r.days / 7) * 10) / 10) : '—'}</b><small>в неделю в среднем</small></div></div>
  <h3>Тренировок ${bt}</h3><div class="card">${bars(bk)}</div>
  ${rows.length ? `<h3>Упражнения ${r.on}</h3><div class="list">${rows.map(x => `<button class="li" data-act="prog" data-ex="${x.id}"><span>${esc(ex(x.id).name)}</span>
    <small>${x.pr.bw ? x.pr.best + ' раз' : fmtW(x.pr.best) + ' кг'} · ${x.n} трен.</small></button>`).join('')}</div>`
      : `<p class="empty">${all.length ? 'В этом периоде тренировок нет — расширь период.' : 'Графики появятся после первых тренировок.'}</p>`}
  <button class="btn" data-act="go" data-to="exercises">База упражнений</button>`;
}
function bars(bk) {
  const W = 340, H = 110, vals = bk.map(b => b.c), mx = Math.max(4, ...vals), bw = (W - 20) / vals.length;
  const f = bk[0], first = bk.mode === 'm' ? `${MON[f.s.getMonth()]} ${f.s.getFullYear()}` : fmtDM(f.s < period().from ? period().from : f.s);
  return `<svg viewBox="0 0 ${W} ${H}" class="chart">${bk.map((b, i) => {
    const v = b.c, h = (H - 30) * v / mx, x = 10 + i * bw;
    return `<rect x="${x + 3}" y="${H - 20 - h}" width="${Math.max(bw - 6, 2)}" height="${Math.max(h, 1.5)}" rx="3" opacity="${b.cur ? 1 : .55}"/>${v && bk.length <= 16 ? `<text x="${x + bw / 2}" y="${H - 24 - h}" text-anchor="middle">${v}</text>` : ''}`;
  }).join('')}<text x="10" y="${H - 4}">${first}</text>${bk.at(-1).cur ? `<text x="${W - 10}" y="${H - 4}" text-anchor="end">сейчас</text>` : ''}</svg>`;
}

let progMetric = 'best', progSel = null;
function viewExProgress(id) {
  const e = ex(id), hAll = exHistory(id), r = period(), h = hAll.filter(x => inR(x.w, r));
  if (!hAll.length) return `${head(esc(e.name), 'progress')}<p class="empty">Пока нет выполненных подходов.</p>`;
  const back = `<button class="btn" data-act="go" data-to="progress">← Ко всем упражнениям</button>`;
  if (!h.length) return `${head(esc(e.name), 'progress')}${periodBar()}<p class="empty">В этом периоде подходов нет.<br>Расширь период — всего записей: ${hAll.length}.</p>${back}`;
  const st = h.map(x => ({ ...sessStats(x.sets), date: x.w.date }));
  const bw = st.every(s => s.bw);
  const metrics = bw ? [['best', 'Повторы'], ['reps', 'Сумма повт.']] : [['best', 'Рабочий вес'], ['orm', '1ПМ ≈'], ['vol', 'Объём']];
  if (!metrics.some(m => m[0] === progMetric)) progMetric = 'best';
  const unit = bw ? 'раз' : progMetric === 'vol' ? 'кг·раз' : 'кг';
  const pr = st.reduce((a, b) => b.best > a.best ? b : a), prOrm = Math.max(...st.map(s => s.orm));
  const prAll = hAll.map(x => ({ ...sessStats(x.sets), date: x.w.date })).reduce((a, b) => b.best > a.best ? b : a);
  let si = h.findIndex(x => x.w.id === progSel); if (si < 0) si = h.length - 1;
  const sel = h[si], ss = st[si], yv = ss[progMetric], rv = Math.round(yv * 10) / 10;
  return `${head(esc(e.name), 'progress')}${periodBar()}
  <div class="tiles"><div class="tile"><b>${bw ? pr.best : fmtW(pr.best)}</b><small>рекорд ${r.on}, ${bw ? 'раз' : 'кг'}</small></div>
  <div class="tile"><b>${bw ? '—' : fmtW(Math.round(prOrm * 2) / 2)}</b><small>1ПМ ≈, кг</small></div><div class="tile"><b>${h.length}</b><small>тренировок</small></div></div>
  <div class="seg">${metrics.map(([k, n]) => `<button class="${k === progMetric ? 'on' : ''}" data-act="metric" data-m="${k}" data-ex="${id}">${n}</button>`).join('')}</div>
  <div class="card">${chart(h.map((x, i) => ({ id: x.w.id, x: fmtShort(x.w.date), y: st[i][progMetric] })), unit, si)}</div>
  <div class="card selc"><small class="cap">${fmtDate(sel.w.date)}${ss === pr ? ' · <span class="pr">рекорд</span>' : ''}</small>
    <div class="big s">${fmtW(rv)} <span class="unit">${unit}</span></div><small>${metrics.find(m => m[0] === progMetric)[1]}</small>
    <div class="selsets">${sel.sets.map((s, j) => `<span class="sp">${j + 1}. ${setStr(s)}</span>`).join('')}</div>
    <button class="btn" data-act="open" data-w="${sel.w.id}">Открыть тренировку</button></div>
  <p class="muted" style="font-size:13px">Рекорд ${r.on}: <span class="pr">${setStr(pr.top)}</span> (${fmtShort(pr.date)}).${hAll.length > h.length ? ` За всё время: <span class="pr">${setStr(prAll.top)}</span> (${fmtShort(prAll.date)}).` : ''} 1ПМ считается по формуле Эпли — ориентир, а не замер.</p>
  <h3>Все подходы ${r.on}</h3><div class="card">${[...h].reverse().map(x => `<div class="sess${x.w.id === sel.w.id ? ' sel' : ''}"><span>${fmtShort(x.w.date)}</span><div>${x.sets.map(setStr).join(' · ')}</div></div>`).join('')}</div>
  ${back}`;
}
function chart(pts, unit, si) {
  if (pts.length < 2) return `<p class="muted" style="margin:6px 0">График появится со второй тренировки. Сейчас: ${fmtW(Math.round(pts[0].y * 10) / 10)} ${unit}</p>`;
  const W = 340, H = 180, L = 34, R = 14;
  const ys = pts.map(p => p.y); let mn = Math.min(...ys), mx = Math.max(...ys);
  if (mn === mx) { mn -= 1; mx += 1; }
  const step = (W - L - R) / (pts.length - 1), X = i => L + i * step, Y = v => 14 + (H - 44) * (1 - (v - mn) / (mx - mn));
  const d = pts.map((q, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(q.y).toFixed(1)}`).join('');
  const r = v => fmtW(Math.round(v * 10) / 10), hit = pts.length > 40 ? Math.max(5, step / 2) : 18;
  return `<svg viewBox="0 0 ${W} ${H}" class="chart">
    <line class="grid" x1="${L}" x2="${W - R}" y1="${Y(mx)}" y2="${Y(mx)}"/><line class="grid" x1="${L}" x2="${W - R}" y1="${Y(mn)}" y2="${Y(mn)}"/>
    <text x="0" y="${Y(mx) + 4}">${r(mx)}</text><text x="0" y="${Y(mn) + 4}">${r(mn)}</text>
    <line class="selline" x1="${X(si)}" x2="${X(si)}" y1="6" y2="${H - 22}"/>
    <path d="${d}" class="ln"/>${pts.length <= 40 ? pts.map((q, i) => i === si ? '' : `<circle cx="${X(i)}" cy="${Y(q.y)}" r="3.5"/>`).join('') : ''}
    <circle class="sel" cx="${X(si)}" cy="${Y(pts[si].y)}" r="6.5"/>
    <text x="${L}" y="${H - 6}">${pts[0].x}</text><text x="${W - R}" y="${H - 6}" text-anchor="end">${pts.at(-1).x}</text>
    ${pts.map((q, i) => `<circle class="hit" data-act="pt" data-w="${q.id}" cx="${X(i)}" cy="${Y(q.y)}" r="${hit}"/>`).join('')}</svg>`;
}

function viewExercises() {
  return `${head('Упражнения', 'settings')}<button class="btn ghost" data-act="exnew">+ Своё упражнение</button>
  ${groups().map(g => {
    const l = S.exercises.filter(e => (e.group || 'Другое') === g && !e.hidden).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    return l.length ? `<h3>${esc(g)}</h3><div class="list">${l.map(e => {
      const n = usedCount(e.id);
      return `<button class="li" data-act="exedit" data-ex="${e.id}"><span>${esc(e.name)}</span><small>${n ? n + ' трен.' : ''}${e.rest != null ? ' · ⏱' + fmtSec(e.rest) : ''}</small></button>`;
    }).join('')}</div>` : '';
  }).join('')}`;
}

function viewSettings() {
  const s = S.settings;
  return `${head('Ещё')}
  <div class="list"><button class="li" data-act="go" data-to="plan"><span>Программа и шаблоны</span><span class="chev">›</span></button>
  <button class="li" data-act="go" data-to="exercises"><span>Упражнения</span><span class="chev">›</span></button></div>
  <h3>Оформление</h3>
  <div class="seg">${[['light', 'Светлая'], ['dark', 'Тёмная'], ['system', 'Как в системе']].map(([k, n]) => `<button class="${(s.theme || 'light') === k ? 'on' : ''}" data-act="theme" data-v="${k}">${n}</button>`).join('')}</div>
  <h3>Отдых по умолчанию</h3>
  <div class="presets">${[45, 60, 90, 120, 150, 180, 240, 300].map(v => `<button class="${s.rest === v ? 'on' : ''}" data-act="defrest" data-v="${v}">${fmtSec(v)}</button>`).join('')}</div>
  <p class="muted" style="font-size:13px">Для отдельного упражнения отдых меняется кнопкой ⏱ на его карточке.</p>
  <h3>Звук</h3>
  <div class="list"><label class="toggle">Сигнал в конце отдыха<input type="checkbox" data-set="sound" ${s.sound ? 'checked' : ''}></label>
  <label class="toggle">Отсчёт 3-2-1<input type="checkbox" data-set="countdown" ${s.countdown ? 'checked' : ''}></label></div>
  <button class="btn" data-act="testsound">🔊 Проверить звук</button>
  <h3>Данные</h3>
  <button class="btn" data-act="imp">📋 Импорт из Заметок</button>
  <button class="btn" data-act="export">Сохранить резервную копию</button>
  <label class="btn" style="cursor:pointer">Загрузить из копии<input type="file" accept=".json,application/json" data-act-file="import" hidden></label>
  <p class="muted" style="font-size:13px">Всё хранится только на этом телефоне. Делай копию раз в пару недель — сохранится в «Файлы» или отправится в Telegram.</p>
  <h3>Как поставить на iPhone</h3>
  <div class="card" style="font-size:15px">Открой ссылку в <b>Safari</b> → кнопка «Поделиться» → <b>«На экран Домой»</b>. Приложение откроется во весь экран и будет работать без интернета.</div>
  <p class="muted" style="font-size:12px;text-align:center">Подход ${VERSION} · тренировок: ${S.workouts.length} · упражнений: ${S.exercises.filter(e => !e.hidden).length}</p>`;
}

/* ---------- шторки ---------- */
function sheet(html) { const m = $('#modal'); m.innerHTML = `<div class="back" data-act="close"></div><div class="sheet">${html}</div>`; m.hidden = false; }
function closeSheet() { const m = $('#modal'); m.hidden = true; m.innerHTML = ''; }
let toastT;
function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => el.hidden = true, 2200); }

let pickerW = null, pickerKind = 'w';
function pickAdd(exId) {
  if (pickerKind === 't') { tpl(pickerW).items.push({ exId, sets: 3 }); save(); closeSheet(); return render(); }
  addExercise(wk(pickerW), exId);
}
function openPicker(wid, kind = 'w') {
  pickerW = wid; pickerKind = kind;
  sheet(`<div class="sheet-h"><input id="q" type="search" placeholder="Найти или создать упражнение" autocomplete="off"></div><div id="plist"></div>`);
  renderPicker('');
  $('#q').addEventListener('input', e => renderPicker(e.target.value));
}
function renderPicker(q) {
  const ql = q.trim().toLowerCase(), w = pickerKind === 't' ? tpl(pickerW) : wk(pickerW), used = new Set(w.items.map(i => i.exId));
  const list = S.exercises.filter(e => !e.hidden && (!ql || e.name.toLowerCase().includes(ql)));
  let html = ql && !S.exercises.some(e => !e.hidden && e.name.toLowerCase() === ql) ? `<button class="btn primary" data-act="pnew">+ Создать «${esc(q.trim())}»</button>` : '';
  if (!ql) {
    const recent = [...new Set(sorted().flatMap(x => x.items.map(i => i.exId)))].filter(id => !ex(id).hidden && S.exercises.some(e => e.id === id)).slice(0, 8);
    if (recent.length) html += `<h3>Недавние</h3>` + recent.map(id => pickBtn(ex(id), used)).join('');
  }
  for (const g of groups()) {
    const l = list.filter(e => (e.group || 'Другое') === g).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    if (l.length) html += `<h3>${esc(g)}</h3>` + l.map(e => pickBtn(e, used)).join('');
  }
  $('#plist').innerHTML = html || '<p class="muted">Ничего не нашлось</p>';
}
const pickBtn = (e, used) => `<button class="pick ${used.has(e.id) ? 'used' : ''}" data-act="padd" data-ex="${e.id}">${esc(e.name)}${used.has(e.id) ? ' ✓' : ''}</button>`;

function addExercise(w, exId) {
  const lt = lastTime(exId, w.date, w.id);
  const sets = lt ? lt.sets.map(s => ({ w: s.w, r: s.r, done: false })) : [{ w: null, r: null, done: false }];
  w.items.push({ exId, sets }); save(); closeSheet(); render();
  setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 50);
}

function restSheet(exId) {
  const e = ex(exId), cur = restFor(exId);
  sheet(`<h2>Отдых: ${esc(e.name)}</h2>
  <div class="presets">${[30, 45, 60, 90, 120, 150, 180, 240].map(v => `<button class="${cur === v ? 'on' : ''}" data-act="setrest" data-ex="${exId}" data-v="${v}">${fmtSec(v)}</button>`).join('')}</div>
  <label class="f"><span>Своё значение, секунд</span><input id="restv" inputmode="numeric" value="${cur}"></label>
  <button class="btn primary" data-act="setrest" data-ex="${exId}">Сохранить</button>
  ${e.rest != null ? `<button class="btn" data-act="setrest" data-ex="${exId}" data-v="default">Как по умолчанию (${fmtSec(S.settings.rest)})</button>` : ''}`);
}

function exMenu(w, i) {
  const it = w.items[i], e = ex(it.exId), a = `data-w="${w.id}" data-i="${i}"`;
  sheet(`<h2>${esc(e.name)}</h2>
  <button class="act" data-act="rest" data-ex="${it.exId}">⏱ Отдых между подходами — ${fmtSec(restFor(it.exId))}</button>
  <button class="act" data-act="inote" ${a}>📝 Заметка к упражнению</button>
  <button class="act" data-act="prog" data-ex="${it.exId}">📈 Прогресс по упражнению</button>
  ${i > 0 ? `<button class="act" data-act="mv" ${a} data-d="-1">↑ Поднять выше</button>` : ''}
  ${i < w.items.length - 1 ? `<button class="act" data-act="mv" ${a} data-d="1">↓ Опустить ниже</button>` : ''}
  <button class="act red" data-act="delitem" ${a}>Убрать из тренировки</button>`);
}

function exEditSheet(id) {
  const e = id ? ex(id) : { name: '', group: 'Другое', rest: null };
  sheet(`<h2>${id ? 'Упражнение' : 'Новое упражнение'}</h2>
  <label class="f"><span>Название</span><input id="exn" value="${esc(e.name)}" autocomplete="off"></label>
  <label class="f"><span>Группа мышц</span><input id="exg" value="${esc(e.group || '')}" list="glist" autocomplete="off"><datalist id="glist">${groups().map(g => `<option value="${esc(g)}">`).join('')}</datalist></label>
  <label class="f"><span>Отдых, секунд (пусто — как по умолчанию)</span><input id="exr" inputmode="numeric" value="${e.rest ?? ''}"></label>
  <button class="btn primary" data-act="exsave" data-ex="${id || ''}">Сохранить</button>
  ${id ? `<button class="btn" data-act="prog" data-ex="${id}">📈 Прогресс</button><button class="btn danger" data-act="exdel" data-ex="${id}">Удалить из списка</button>` : ''}`);
}

/* ---------- импорт из Заметок ---------- */
// Формат: дата «04.11.2026», строки «Упражнение: 60/12 60/8 60/8» (кг/повторы).
// «2.15/20» — 2 блина по 15 кг → 30 кг. Пустая строка или «… шкаф» — граница тренировки.
const TYPOS = { 'дим': 'жим', 'спишу': 'спину', 'силя': 'сидя', 'бедре': 'бедра', 'не': 'на', 'смитте': 'смите' };
const norm = s => String(s).toLowerCase().replace(/ё/g, 'е').replace(/[^а-яa-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean).map(x => TYPOS[x] || x).join(' ');
// [шаблон, название (или функция от макс. веса), группа]
const IMPORT_RULES = [
  [/жим штанги/, 'Жим штанги лёжа', 'Грудь'],
  [/жим гантел.*наклон/, 'Жим гантелей на наклонной', 'Грудь'],
  [/жим гантел.*(перед|дельт|плеч)/, 'Жим гантелей на плечи сидя', 'Плечи'],
  [/жим гантел/, 'Жим гантелей лёжа', 'Грудь'],
  [/жим на грудь|жим сидя в тренаж/, 'Жим на грудь в тренажёре', 'Грудь'],
  [/платформ|жим ногами/, 'Жим ногами', 'Ноги'],
  [/жим на (переднюю )?дельт|жим на плеч/, mx => mx > 30 ? 'Жим на плечи в тренажёре' : 'Жим гантелей на плечи сидя', 'Плечи'],
  [/тяга верхнего блока.*узк/, 'Тяга верхнего блока узким хватом', 'Спина'],
  [/тяга верхнего блока/, 'Тяга верхнего блока', 'Спина'],
  [/тяга блока.*(сидя|наклон)/, 'Тяга горизонтального блока', 'Спина'],
  [/тяга на спину сидя/, 'Тяга рычажная сидя', 'Спина'],
  [/задн.*дельт.*блок/, 'Задняя дельта в блоке', 'Плечи'],
  [/задн.*дельт/, 'Обратная бабочка', 'Плечи'],
  [/махи.*средн|махи.*стороны/, mx => mx > 15 ? 'Махи на среднюю дельту в блоке' : 'Махи гантелями в стороны', 'Плечи'],
  [/трицепс/, 'Разгибание на трицепс в блоке', 'Руки'],
  [/молот/, 'Молотки', 'Руки'],
  [/бицепс.*полулеж/, 'Сгибание на бицепс полулёжа', 'Руки'],
  [/бицепс/, 'Сгибание на бицепс сидя на скамье', 'Руки'],
  [/разгибани. кист/, 'Разгибание кистей стоя', 'Руки'],
  [/предплеч.*(обратн|стоя)/, 'Предплечья обратным хватом стоя', 'Руки'],
  [/предплеч/, 'Предплечья сидя с упором в скамью', 'Руки'],
  [/разгибани.*ног/, 'Разгибание ног', 'Ноги'],
  [/сгибани.*ног|задн.*поверхн.*бедр/, 'Сгибание ног', 'Ноги'],
  [/икр/, 'Икры сидя в тренажёре', 'Ноги'],
  [/трапец|шраг/, 'Шраги в Смите', 'Плечи'],
];
function resolveName(src, sets) {
  const n = norm(src), mx = Math.max(0, ...sets.map(s => s.w || 0));
  for (const [re, name, group] of IMPORT_RULES) if (re.test(n)) return { name: typeof name === 'function' ? name(mx) : name, group };
  const own = S.exercises.find(e => norm(e.name) === n);
  if (own) return { name: own.name, group: own.group };
  const clean = src.trim().replace(/\s+/g, ' ');
  return { name: clean[0].toUpperCase() + clean.slice(1), group: 'Другое', isNew: true };
}
function parseSets(str) {
  const sets = [], plates = [];
  for (const tok of str.replace(/^\s*на\s+/i, '').split(/\s+/)) {
    const m = tok.match(/^(\d+(?:[.,]\d+)?)\/(\d+)?$/); if (!m) continue;
    let w; const p = m[1].match(/^(\d)\.(\d{2})$/);
    if (p && +p[1] <= 4) { w = +p[1] * +p[2]; plates.push(m[1]); } else w = num(m[1]);
    sets.push({ w, r: m[2] ? +m[2] : null, done: true });
  }
  const note = plates.length ? `в заметках «${[...new Set(plates)].join(', ')}» — посчитал как блины: ${[...new Set(plates)].map(x => x.replace('.', '×')).join(', ')} кг` : '';
  return { sets, note };
}
function parseNotes(text) {
  const out = []; let date = null, fresh = false, cur = null, boundary = true;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) { boundary = true; continue; }
    const dm = line.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
    if (dm) { const y = +dm[3] < 100 ? 2000 + +dm[3] : +dm[3]; date = new Date(y, dm[2] - 1, +dm[1], 18, 0); fresh = true; boundary = true; continue; }
    if (/шкаф/i.test(line) && !line.includes(':')) { boundary = true; continue; }
    const em = line.match(/^([^:]+):\s*(.*)$/); if (!em) continue;
    const { sets, note } = parseSets(em[2]); if (!sets.length) continue;
    if (!cur || (boundary && cur.items.length)) {
      let d, est = false;
      if (fresh) { d = new Date(date); fresh = false; }
      else if (cur) { d = new Date(cur.date); d.setDate(d.getDate() + 1); est = true; }
      else { d = new Date(); d.setHours(18, 0, 0, 0); est = true; }
      cur = { date: d, est, items: [] }; out.push(cur);
    }
    boundary = false;
    cur.items.push({ src: em[1].trim(), sets, note, ...resolveName(em[1], sets) });
  }
  // примерные даты не ставим на дни, где уже есть тренировка
  const busy = d => out.some(o => !o.est && sameDay(o.date, d)) || S.workouts.some(w => sameDay(w.date, d));
  for (const o of out) if (o.est) { let k = 0; while (busy(o.date) && k++ < 6) o.date.setDate(o.date.getDate() + 1); }
  return out;
}
const sameDay = (a, b) => dateVal(a) === dateVal(b);
function markDups(draft) {
  for (const d of draft) {
    const names = d.items.map(i => norm(i.name)).sort().join('|');
    d.dup = S.workouts.some(w => sameDay(w.date, d.date) && w.items.map(i => norm(ex(i.exId).name)).sort().join('|') === names);
  }
}
let importDraft = [];
function importSheet() {
  sheet(`<h2>Импорт из Заметок</h2>
  <p class="muted" style="font-size:14px;margin-top:0">Скопируй заметку целиком и вставь сюда. Понимаю «60/12 60/8», даты «04.11.2026», «2.15/20» как 2 блина по 15. Ничего не добавится, пока не нажмёшь кнопку внизу.</p>
  <textarea id="imptext" rows="8" placeholder="04.11.2026&#10;Жим штанги лежа: 60/12 60/8 60/8"></textarea>
  <button class="btn primary" data-act="impparse">Разобрать</button><div id="impprev"></div>`);
}
function renderImport() {
  markDups(importDraft);
  const fresh = importDraft.filter(d => !d.dup), sets = fresh.reduce((a, d) => a + d.items.reduce((b, i) => b + i.sets.length, 0), 0);
  const newEx = [...new Set(importDraft.flatMap(d => d.items.filter(i => i.isNew).map(i => i.name)))];
  $('#impprev').innerHTML = !importDraft.length ? '<p class="muted">Не нашёл ни одной строки вида «Упражнение: 60/12 60/8».</p>' : `
  <p><b>Нашёл ${importDraft.length} ${plural(importDraft.length, 'тренировку', 'тренировки', 'тренировок')}</b>, к добавлению — ${fresh.length} (${sets} подх.).${importDraft.some(d => d.est) ? ' <span class="pr">Жёлтым</span> — даты, которых не было в заметках: поправь.' : ''}</p>
  ${newEx.length ? `<p class="muted" style="font-size:13px">Новые упражнения: ${newEx.map(esc).join(', ')}</p>` : ''}
  ${importDraft.map((d, k) => `<div class="card${d.dup ? ' dim' : ''}"><div class="wmeta"><input type="date" class="wdate${d.est ? ' est' : ''}" data-imp="${k}" value="${dateVal(d.date)}">
    <small>${d.dup ? 'уже есть — пропущу' : d.est ? 'дата примерная' : DAYS[d.date.getDay()]}</small></div>
    ${d.items.map(i => `<div class="impi"><b>${esc(i.name)}</b> ${i.sets.map(setStr).join(' · ')}${norm(i.src) !== norm(i.name) ? `<small>было: ${esc(i.src)}</small>` : ''}${i.note ? `<small>📝 ${esc(i.note)}</small>` : ''}</div>`).join('')}</div>`).join('')}
  ${fresh.length ? `<button class="btn primary big" data-act="impdo">Добавить ${fresh.length} ${plural(fresh.length, 'тренировку', 'тренировки', 'тренировок')}</button>` : ''}`;
}
function findOrCreateEx(name, group) {
  let e = S.exercises.find(x => norm(x.name) === norm(name));
  if (!e) { e = { id: uid(), name, group, rest: null }; S.exercises.push(e); }
  e.hidden = false; return e.id;
}
function doImport() {
  const fresh = importDraft.filter(d => !d.dup);
  for (const d of fresh) S.workouts.push({
    id: uid(), date: d.date.toISOString(), title: '', imported: true,
    items: d.items.map(i => ({ exId: findOrCreateEx(i.name, i.group), sets: i.sets.map(s => ({ ...s })), ...(i.note ? { note: i.note } : {}) })),
  });
  save(); closeSheet(); toast(`Добавлено тренировок: ${fresh.length}`); importDraft = []; go('history');
}

/* ---------- роутер ---------- */
let navN = 0, shownHash = null;
function route() { return (location.hash.slice(2) || 'home').split('/'); }
function go(h) {
  if (location.hash === '#/' + h) return render();
  closeSheet(); navN++; history.pushState({ n: navN }, '', '#/' + h); render(); window.scrollTo(0, 0);
}
function goBack(parent) { if (navN > 0) history.back(); else go(parent); }
function onNav() {
  if (shownHash === location.hash) return;
  const n = history.state && history.state.n;
  if (typeof n === 'number') navN = n; else { navN++; history.replaceState({ n: navN }, ''); }
  closeSheet(); render(); window.scrollTo(0, 0);
}
function applyTheme() {
  const t = S.settings.theme || 'light', dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = t;
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = dark ? '#0e0f11' : '#ecebe8';
}
function render() {
  const [p, a] = route();
  let html;
  if (p === 'workout') html = a ? viewWorkout(wk(a)) : viewWorkout(wk(S.activeId));
  else if (p === 'plan') html = a ? viewTpl(a) : viewPlan();
  else if (p === 'history') html = viewHistory();
  else if (p === 'progress') html = a ? viewExProgress(a) : viewProgress();
  else if (p === 'exercises') html = viewExercises();
  else if (p === 'settings') html = viewSettings();
  else if (p === 'home') html = viewHome();
  else html = viewHome();
  shownHash = location.hash;
  $('#view').innerHTML = html;
  const tab = p === 'workout' && a && a !== S.activeId ? 'history' : p === 'plan' ? 'workout' : p === 'exercises' ? 'settings' : ['workout', 'history', 'progress', 'settings'].includes(p) ? p : 'home';
  document.querySelectorAll('.tabs a').forEach(t => t.classList.toggle('on', t.dataset.tab === tab));
  const pc = document.querySelector('.pchips'), on = pc && pc.querySelector('.on');
  if (on) pc.scrollLeft = on.offsetLeft - (pc.clientWidth - on.offsetWidth) / 2;
  renderTimer(true); keepAwake(!!S.activeId);
}

/* ---------- действия ---------- */
function newWorkout(items = [], title = '', tplId = null) {
  if (S.activeId && wk(S.activeId)) { toast('Сначала заверши текущую тренировку'); return go('workout'); }
  const w = { id: uid(), date: new Date().toISOString(), title, items, ...(tplId ? { tplId } : {}) };
  S.workouts.push(w); S.activeId = w.id; save(); unlockAudio(); go('workout');
}
function nextLabel(w, i, j) {
  const it = w.items[i], k = it.sets.findIndex((s, x) => x > j && !s.done);
  if (k >= 0) return `${ex(it.exId).name} — подход ${k + 1}`;
  for (let a = i + 1; a < w.items.length; a++) { const kk = w.items[a].sets.findIndex(s => !s.done); if (kk >= 0) return ex(w.items[a].exId).name + (kk ? ` — подход ${kk + 1}` : ''); }
  for (let a = 0; a < i; a++) if (w.items[a].sets.some(s => !s.done)) return ex(w.items[a].exId).name;
  return 'ещё подход или новое упражнение';
}
function finish(w) {
  if (!setCount(w)) {
    if (!confirm('Ни одного подхода не отмечено. Удалить пустую тренировку?')) return;
    S.workouts = S.workouts.filter(x => x.id !== w.id); S.activeId = null; stopTimer(); save(); return go('workout');
  }
  w.items.forEach(it => it.sets = doneSets(it)); w.items = w.items.filter(it => it.sets.length);
  w.end = new Date().toISOString(); S.activeId = null; stopTimer(); save(); toast('Тренировка сохранена 💪'); go('history');
}

document.addEventListener('click', e => {
  const tabA = e.target.closest('.tabs a'); if (tabA) { e.preventDefault(); return go(tabA.dataset.tab); }
  const b = e.target.closest('[data-act]'); if (!b) return;
  const d = b.dataset, w = d.w ? wk(d.w) : null, i = +d.i, j = +d.j;
  switch (d.act) {
    case 'start': return newWorkout();
    case 'repeat': { const src = wk(d.w); return newWorkout(src.items.map(it => ({ exId: it.exId, sets: it.sets.map(s => ({ w: s.w, r: s.r, done: false })) })), src.title); }
    case 'open': return go('workout/' + d.w);
    case 'back': return go('history');
    case 'nav': return d.force ? go(d.p) : goBack(d.p);
    case 'day': return daySheet(d.d);
    case 'wday': { const l = finished().filter(x => dateVal(x.date) === d.d); if (l.length === 1) return go('workout/' + l[0].id); if (l.length) return daySheet(d.d); return; }
    case 'addday': return addDay(d.d);
    case 'pt': progSel = d.w; return render();
    case 'period': S.settings.period = { k: d.k }; save(); return render();
    case 'pcustom': return periodSheet();
    case 'papply': return periodApply();
    case 'theme': S.settings.theme = d.v; save(); applyTheme(); return render();
    case 'go': return go(d.to);
    case 'pick': return openPicker(d.w);
    case 'padd': return pickAdd(d.ex);
    case 'tpick': return openPicker(d.t, 't');
    case 'tstart': {
      if (S.activeId && wk(S.activeId)) { toast('Сначала заверши текущую тренировку'); return go('workout'); }
      return startFromTpl(tpl(d.t));
    }
    case 'tnew': { const t = { id: uid(), name: 'Новая тренировка', days: [], items: [] }; S.templates.push(t); save(); return go('plan/' + t.id); }
    case 'tauto': return autoSheet();
    case 'aday': { const k = +d.d; autoDays = autoDays.includes(k) ? autoDays.filter(x => x !== k) : [...autoDays, k]; return renderAutoDays(); }
    case 'tautodo': return autoBuild();
    case 'tfromw': return tplFromWorkout(w);
    case 'tday': { const t = tpl(d.t), k = +d.d; t.days = t.days.includes(k) ? t.days.filter(x => x !== k) : [...t.days, k]; save(); return render(); }
    case 'tsets': { const it = tpl(d.t).items[i]; it.sets = Math.max(1, Math.min(10, it.sets + +d.d)); save(); return render(); }
    case 'tmv': { const its = tpl(d.t).items; [its[i - 1], its[i]] = [its[i], its[i - 1]]; save(); return render(); }
    case 'titemdel': { tpl(d.t).items.splice(i, 1); save(); return render(); }
    case 'tremove': { if (!confirm('Удалить шаблон? Тренировки в истории останутся.')) return; S.templates = S.templates.filter(t => t.id !== d.t); save(); return go('plan'); }
    case 'pnew': {
      const name = $('#q').value.trim(); if (!name) return;
      const n = { id: uid(), name: name[0].toUpperCase() + name.slice(1), group: 'Другое', rest: null };
      S.exercises.push(n); toast('Добавлено в «Другое» — группу можно сменить в «Упражнениях»'); return pickAdd(n.id);
    }
    case 'done': {
      const it = w.items[i], s = it.sets[j];
      s.done = !s.done; s.t = s.done ? Date.now() : null;
      if (s.done) {
        const nx = it.sets[j + 1]; if (nx && !nx.done) { if (nx.w == null) nx.w = s.w; if (nx.r == null) nx.r = s.r; }
        if (S.activeId === w.id) startTimer(restFor(it.exId), nextLabel(w, i, j));
      }
      save(); return render();
    }
    case 'addset': { const ss = w.items[i].sets, l = ss.at(-1); ss.push({ w: l ? l.w : null, r: l ? l.r : null, done: false }); save(); return render(); }
    case 'delset': { w.items[i].sets.splice(j, 1); save(); return render(); }
    case 'exmenu': return exMenu(w, i);
    case 'mv': { const k = i + +d.d; [w.items[i], w.items[k]] = [w.items[k], w.items[i]]; save(); closeSheet(); return render(); }
    case 'delitem': { if (doneSets(w.items[i]).length && !confirm('Убрать упражнение вместе с подходами?')) return; w.items.splice(i, 1); save(); closeSheet(); return render(); }
    case 'rest': return restSheet(d.ex);
    case 'setrest': {
      const e2 = S.exercises.find(x => x.id === d.ex); if (!e2) return;
      if (d.v === 'default') e2.rest = null; else { const v = d.v ? +d.v : Math.round(num($('#restv').value)); if (!(v > 0)) return toast('Введи число секунд'); e2.rest = v; }
      save(); closeSheet(); return render();
    }
    case 'finish': return finish(w);
    case 'delw': { if (!confirm('Удалить тренировку насовсем?')) return; S.workouts = S.workouts.filter(x => x.id !== d.w); save(); return go('history'); }
    case 'tadj': return adjustTimer(+d.d);
    case 'tstop': return stopTimer();
    case 'prog': closeSheet(); return go('progress/' + d.ex);
    case 'metric': progMetric = d.m; return render();
    case 'exnew': return exEditSheet(null);
    case 'exedit': return exEditSheet(d.ex);
    case 'exsave': {
      const name = $('#exn').value.trim(); if (!name) return toast('Нужно название');
      const group = $('#exg').value.trim() || 'Другое', r = num($('#exr').value), rest = r > 0 ? Math.round(r) : null;
      if (d.ex) Object.assign(ex(d.ex), { name, group, rest }); else S.exercises.push({ id: uid(), name, group, rest });
      save(); closeSheet(); return render();
    }
    case 'exdel': { const e2 = ex(d.ex); e2.hidden = true; save(); closeSheet(); toast('Убрано из списка, история сохранена'); return render(); }
    case 'defrest': S.settings.rest = +d.v; save(); return render();
    case 'testsound': unlockAudio(); return scheduleAlarm(0.3);
    case 'export': return exportData();
    case 'close': return closeSheet();
    case 'imp': return importSheet();
    case 'impparse': importDraft = parseNotes($('#imptext').value); return renderImport();
    case 'impdo': return doImport();
    case 'inote': sheet(`<h2>Заметка: ${esc(ex(w.items[i].exId).name)}</h2><textarea id="inotev" rows="3" placeholder="Сиденье на 4, хват шире…">${esc(w.items[i].note || '')}</textarea>
      <button class="btn primary" data-act="inotesave" data-w="${w.id}" data-i="${i}">Сохранить</button>`); return;
    case 'inotesave': { const v = $('#inotev').value.trim(); if (v) w.items[i].note = v; else delete w.items[i].note; save(); closeSheet(); return render(); }
  }
});

document.addEventListener('input', e => {
  const t = e.target, f = t.dataset.f;
  if (t.dataset.tf === 'name') { const tp = tpl(t.dataset.t); if (tp) { tp.name = t.value.trim() || 'Тренировка'; save(); } return; }
  if (!f) return;
  const w = wk(t.dataset.w); if (!w) return;
  if (f === 'title') w.title = t.value.trim();
  else if (f === 'note') w.note = t.value;
  else if (f === 'date') {
    if (!t.value) return;
    const [y, m, d] = t.value.split('-').map(Number), old = new Date(w.date), nd = new Date(y, m - 1, d, old.getHours(), old.getMinutes());
    if (w.end) w.end = new Date(new Date(w.end).getTime() + (nd - old)).toISOString();
    w.date = nd.toISOString();
  } else { const s = w.items[+t.dataset.i].sets[+t.dataset.j]; if (f === 'w') s.w = num(t.value); else { const r = num(t.value); s.r = r == null ? null : Math.round(r); } }
  save();
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.set) { S.settings[t.dataset.set] = t.checked; save(); }
  if (t.dataset.actFile === 'import' && t.files[0]) importData(t.files[0]);
  if (t.dataset.imp != null && t.value) { const [y, m, d] = t.value.split('-').map(Number), it = importDraft[+t.dataset.imp]; it.date = new Date(y, m - 1, d, 18, 0); it.est = false; renderImport(); }
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset.f === 'r') e.target.blur(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { renderTimer(true); keepAwake(!!S.activeId); } });
window.addEventListener('popstate', onNav);
window.addEventListener('hashchange', onNav);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme());

/* ---------- резервные копии ---------- */
async function exportData() {
  const name = `podhod-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([JSON.stringify({ ...S, timer: null }, null, 1)], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); a.remove();
}
function importData(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (d.v !== 1 || !Array.isArray(d.workouts) || !Array.isArray(d.exercises)) throw 0;
      if (!confirm(`В копии ${d.workouts.length} тренировок. Заменить текущие данные?`)) return;
      S = migrate({ ...seed(), ...d, timer: null }); save(); applyTheme(); toast('Данные загружены'); go('history');
    } catch (e) { toast('Это не копия «Подхода»'); }
  };
  r.readAsText(file);
}

/* ---------- старт ---------- */
setInterval(() => {
  if (S.timer) renderTimer();
  const el = $('#elapsed'); if (el && S.activeId && wk(S.activeId)) el.textContent = elapsed(wk(S.activeId));
}, 250);
if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js');
applyTheme();
if (!history.state || typeof history.state.n !== 'number') history.replaceState({ n: 0 }, '');
else navN = history.state.n;
render();
