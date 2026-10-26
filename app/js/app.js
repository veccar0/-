// 돈구리 앱: 상태를 받아 화면을 다시 그리는 단순한 렌더 루프.
import { addDays, diffDays, weekday, cycleRange, dayStatus, goalProgress, streak, level, quizIndexes, spendable } from './budget.js';
import { load, save, blankState, todayOf, newDay, setupBudget, record, saveMoney, removeEntry, grant, demoState } from './store.js';
import { QUIZ } from './quiz-data.js';
import { SHOP, byId } from './shop-data.js';
import { askClaude } from './coach.js';
import { esc, won, comma, leaf, ICON, CATEGORIES, catOf, toast, leafBurst, leafFall } from './ui.js';
import { mascot } from './mascot.js';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
const phone = document.querySelector('.phone');

let state = load();
let today = todayOf(state);
const view = { tab: 'home', sheet: null, onb: null, quizMode: 'today', reveal: null, shopKind: 'acc', coachBusy: false };

const persist = () => save(state);
const dateLabel = (d) => { const [, m, dd] = d.split('-').map(Number); return `${m}월 ${dd}일 ${DAY_NAMES[weekday(d)]}요일`; };
const floor100 = (n) => Math.max(0, Math.floor(n / 100) * 100);

// ───────────────────────── 하루 시작 처리 ─────────────────────────
function startOfDay(announce = true) {
  today = todayOf(state);
  if (!state.settings) return;
  const events = newDay(state, today);
  if (state.quiz.date !== today) state.quiz = { date: today, answered: {} };
  persist();
  if (!announce) return;
  events.forEach((e, i) => setTimeout(() => {
    if (e.type === 'nospend') toast(phone, `${leaf()} ${dateLabel(e.date)} 무지출! 은행잎 5장을 받았어요`);
    if (e.type === 'leftover') toast(phone, `${ICON.jar} 지난 주기에 남은 ${won(e.amount)}을 저축통에 넣었어요`);
    if (e.type === 'cycle') toast(phone, `새 용돈 주기 시작! ${won(e.amount)}을 먼저 저축했어요`);
  }, 300 + i * 500));
}

// ───────────────────────── 돈구리 기분 ─────────────────────────
function mood(st) {
  const g = goalProgress(state);
  const pct = Math.floor(g.ratio * 100);
  const hour = new Date().getHours();
  if (st.savedToday > 0) return { mood: 'cheer', line: `저축 성공! ${esc(state.settings.goalName)}까지 <b>${pct}%</b> 왔어.` };
  if (st.left < 0) return { mood: 'surprise', line: `오늘 <b>${won(-st.left)}</b> 넘었어. 괜찮아, 남은 날에 조금씩 나눠서 맞추면 돼.` };
  if (st.spentToday === 0 && hour >= 21) return { mood: 'rest', line: '오늘은 무지출이야! 내일 은행잎 <b>5장</b>을 줄게.' };
  if (st.spentToday === 0) {
    const extra = st.bonus > 0 ? ` 아낀 <b>${won(st.bonus)}</b>이 더해졌어.` : '';
    return { mood: 'calm', line: `오늘은 <b>${won(st.limit)}</b>까지 써도 괜찮아.${extra}` };
  }
  return { mood: 'walk', line: `좋아, 오늘 <b>${won(st.left)}</b> 남았어. 남기면 내일로 넘어가!` };
}

function charStage(st, extraClass = '') {
  const m = mood(st);
  const acc = state.equipped.acc && byId(state.equipped.acc);
  const ob = state.equipped.obj && byId(state.equipped.obj);
  return `<section class="stage ${extraClass}" aria-label="돈구리">
    <div class="leaf-fall" id="leafFall"></div>
    <p class="bubble">${m.line}</p>
    <div class="char">
      <span class="pose">${mascot(m.mood, 140)}</span>
      ${ob ? `<span class="wear obj" title="${esc(ob.name)}"><img src="${ob.img}" alt=""><span class="sr">${esc(ob.name)} 함께하는 중</span></span>` : ''}
      ${acc ? `<span class="wear acc" title="${esc(acc.name)}"><img src="${acc.img}" alt=""><span class="sr">${esc(acc.name)} 착용 중</span></span>` : ''}
    </div>
  </section>`;
}

// ───────────────────────── 공통 틀 ─────────────────────────
function topbar(st) {
  const s = streak(state, today);
  return `<header class="topbar">
    <div class="who">
      <span class="avatar">${mascot(mood(st).mood, 40, '')}</span>
      <div><b>돈구리 <span class="badge plain">Lv.${level(s)}</span></b><span>${ICON.flame} ${s}일 연속 한도 지킴</span></div>
    </div>
    <div class="top-actions">
      <span class="pill leaves num" id="leafPill" aria-label="은행잎 ${state.leaves}장">${leaf(18)} ${comma(state.leaves)}</span>
      <button class="icon-btn" data-act="open-settings" aria-label="설정">${ICON.gear}</button>
    </div>
  </header>`;
}

const TABS = [['home', '홈'], ['quiz', '퀴즈'], ['coach', '코치'], ['shop', '상점']];
const tabbar = () => `<nav class="tabbar" aria-label="메뉴">${TABS.map(([id, name]) =>
  `<button class="tab" data-act="tab" data-tab="${id}" ${view.tab === id ? 'aria-current="page"' : ''}>${ICON[id]}<span>${name}</span></button>`).join('')}</nav>`;

// ───────────────────────── 홈 ─────────────────────────
function weekStrip() {
  const { start, end } = cycleRange(state.settings, today);
  const cells = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    let cls = '', mark = '';
    if (d === today) { cls = 'today'; mark = '오늘'; }
    else if (d < today && d >= state.startDate) {
      const s = dayStatus(state, d);
      if (s.spentToday === 0) { cls = 'nospend'; mark = '0'; }
      else if (s.spentToday <= s.limit) { cls = 'kept'; mark = '✓'; }
      else { cls = 'over'; mark = '!'; }
    }
    cells.push(`<div class="day ${d === today ? 'is-today' : ''}"><span>${DAY_NAMES[weekday(d)]}</span><span class="dot ${cls}">${mark}</span></div>`);
  }
  return `<div class="week">${cells.join('')}</div>
    <div class="legend"><span><i style="background:var(--blue)"></i>한도 지킴</span><span><i style="background:var(--mint)"></i>무지출</span><span><i style="background:var(--over)"></i>넘김</span></div>`;
}

function homeView() {
  const st = dayStatus(state, today);
  const g = goalProgress(state);
  const over = st.left < 0;
  const used = st.limit > 0 ? Math.min(100, ((st.spentToday + st.savedToday) / st.limit) * 100) : (st.spentToday > 0 ? 100 : 0);
  let note = '';
  if (over) note = `<span class="note" style="color:var(--over)">${won(-st.left)} 넘었어요 · 남은 ${st.daysLeft - 1}일에 나눠서 맞춰요</span>`;
  else if (st.bonus > 0) note = `<span class="note up">아낀 돈 ${won(st.bonus)}이 더해졌어요</span>`;
  else if (st.bonus < 0) note = `<span class="note down">넘긴 돈을 나눠서 하루 ${won(-st.bonus)} 줄었어요</span>`;
  else note = `<span class="note down">하루 기본 한도 ${won(st.baseLimit)}</span>`;
  const saveAmt = floor100(st.left);
  const entries = state.entries.filter((e) => e.date === today).slice().reverse();
  const s = streak(state, today);
  const unit = state.settings.cycle === 'monthly' ? '달' : '주';

  return `${charStage(st)}
  <section class="card today" aria-labelledby="todayLabel">
    <div class="row"><span class="label" id="todayLabel">오늘 써도 되는 돈</span>${s >= 3 ? `<span class="badge">${s}일 연속 한도 지킴</span>` : `<span class="badge plain">${dateLabel(today)}</span>`}</div>
    <div class="big num ${over ? 'over' : ''}">${won(Math.max(0, st.left))}</div>
    ${note}
    <div class="meter ${over ? 'over' : ''}"><i style="width:${used}%"></i></div>
    <div class="row small muted"><span>오늘 한도 ${won(st.limit)}</span><span>쓴 돈 ${won(st.spentToday)}${st.savedToday ? ` · 저축 ${won(st.savedToday)}` : ''}</span></div>
  </section>
  <div class="btn-row">
    <button class="btn primary" data-act="open-record">지출 기록하기</button>
    <button class="btn leaf" data-act="open-save" id="saveBtn">${leaf(18, '#fff8e1', 'var(--on-leaf)')} ${saveAmt > 0 ? `${comma(saveAmt)}원 저축` : '저축하기'}</button>
  </div>
  <section class="card" id="goalCard">
    <div class="goal-head">
      <span class="jar" aria-hidden="true">${leaf(26)}</span>
      <div style="flex:1;min-width:0">
        <div class="row"><b>${esc(state.settings.goalName)}</b><span class="badge leafy num">${Math.floor(g.ratio * 100)}%</span></div>
        <div class="goal-num num">${won(g.saved)} <span class="small muted" style="font-weight:600">/ ${won(g.amount)}</span></div>
      </div>
    </div>
    <div class="meter leaf"><i style="width:${g.ratio * 100}%"></i></div>
    <div class="small muted">${won(g.remaining)} 남았어요 · ${unit}마다 ${won(state.settings.savePerCycle)} 자동 저축</div>
  </section>
  <section class="card">
    <div class="row"><h2>이번 용돈 주기</h2><span class="small muted">남은 돈 ${won(Math.max(0, st.cycleLeft))}</span></div>
    ${weekStrip()}
  </section>
  <section class="card">
    <div class="row"><h2>오늘 기록</h2><span class="small muted">${entries.length}건</span></div>
    ${entries.length ? `<div class="list">${entries.map((e) => {
      const c = e.type === 'save' ? { name: '저축', icon: leaf(22) } : catOf(e.category);
      return `<div class="item"><span class="cat" ${e.type === 'save' ? 'style="background:var(--leaf-tint)"' : ''}>${c.icon}</span>
        <div><b>${esc(e.memo || c.name)}</b><small>${e.type === 'save' ? '저축통으로 옮김' : c.name}</small></div>
        <div style="text-align:right"><div class="amt num ${e.type === 'save' ? 'save' : ''}">${e.type === 'save' ? '+' : '−'}${won(e.amount)}</div>
        <button class="del" data-act="ask-delete" data-id="${e.id}">지우기</button></div></div>`;
    }).join('')}</div>` : '<p class="empty">아직 기록이 없어요. 쓴 돈이 생기면 3번만 눌러 기록해요.</p>'}
  </section>`;
}

// ───────────────────────── 키패드 시트(지출 / 저축) ─────────────────────────
const keypad = () => `<div class="keypad">${['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0'].map((k) =>
  `<button class="key num" data-act="key" data-k="${k}">${k}</button>`).join('')}
  <button class="key" data-act="key" data-k="del" aria-label="지우기">${ICON.erase}</button></div>`;

function recordSheet() {
  const sh = view.sheet;
  const amount = Number(sh.amount || 0);
  const st = dayStatus(state, today);
  let hint = '얼마를 썼나요?', cls = '';
  if (amount > 0) {
    const after = st.left - amount;
    if (after >= 0) { hint = `쓰고 나면 오늘 ${won(after)} 남아요`; cls = 'ok'; }
    else { hint = `오늘 한도보다 ${won(-after)} 많아요 · 남은 날에 나눠서 맞춰요`; cls = 'bad'; }
  }
  return `<div class="grabber"></div>
    <div class="row"><h3>지출 기록</h3><button class="icon-btn" data-act="close" aria-label="닫기">${ICON.close}</button></div>
    <div class="amount-display"><div class="val num ${amount ? '' : 'empty'}">${amount ? won(amount) : '0원'}</div><div class="hint ${cls}">${hint}</div></div>
    <div class="chips" role="group" aria-label="카테고리">${CATEGORIES.map((c) =>
      `<button class="chip" data-act="cat" data-cat="${c.id}" aria-pressed="${sh.cat === c.id}">${c.name}</button>`).join('')}</div>
    ${keypad()}
    <button class="btn primary block" data-act="save-record" ${amount > 0 ? '' : 'disabled'}>기록하기</button>`;
}

function savePreview(amount) {
  const st = dayStatus(state, today);
  const tomorrow = addDays(today, 1);
  const g = goalProgress(state);
  const pctBefore = Math.floor(g.ratio * 100);
  const pctAfter = Math.floor(Math.min(1, (g.saved + amount) / g.amount) * 100);
  let line;
  if (tomorrow <= st.cycle.end) {
    const before = dayStatus(state, tomorrow).limit;
    const after = dayStatus({ ...state, entries: [...state.entries, { date: today, type: 'save', amount }] }, tomorrow).limit;
    line = `내일 하루 한도 <span class="arrow num">${won(before)} → ${won(after)}</span>`;
  } else {
    line = `이번 주기 남은 돈 <span class="arrow num">${won(Math.max(0, st.cycleLeft))} → ${won(Math.max(0, st.cycleLeft - amount))}</span>`;
  }
  return `<div class="preview"><span>${esc(state.settings.goalName)} <span class="arrow num">${pctBefore}% → ${pctAfter}%</span></span><span class="muted">${line}</span></div>`;
}

function saveSheet() {
  const sh = view.sheet;
  const amount = Number(sh.amount || 0);
  const st = dayStatus(state, today);
  const leftAmt = floor100(st.left);
  const chips = [[leftAmt, `오늘 남은 만큼 ${comma(leftAmt)}원`], [1000, '1,000원'], [5000, '5,000원']].filter(([v]) => v > 0);
  const overLeft = amount > Math.max(0, st.cycleLeft);
  return `<div class="grabber"></div>
    <div class="row"><h3>저축통으로 옮기기</h3><button class="icon-btn" data-act="close" aria-label="닫기">${ICON.close}</button></div>
    <div class="amount-display"><div class="val num ${amount ? '' : 'empty'}">${amount ? won(amount) : '0원'}</div>
      <div class="hint ${overLeft ? 'bad' : 'ok'}">${amount ? (overLeft ? '이번 주기에 남은 돈보다 많아요' : '저축하면 은행잎 2장(하루 1번)') : '아낀 돈을 목표로 옮겨요'}</div></div>
    <div class="chips">${chips.map(([v, label]) => `<button class="chip leafy" data-act="set-amount" data-v="${v}" aria-pressed="${amount === v}">${label}</button>`).join('')}</div>
    ${amount > 0 ? savePreview(amount) : ''}
    ${keypad()}
    <button class="btn leaf block" data-act="save-money" ${amount > 0 && !overLeft ? '' : 'disabled'}>${amount ? `${won(amount)} 저축할게요` : '금액을 골라 주세요'}</button>`;
}

// ───────────────────────── 퀴즈 ─────────────────────────
function quizView() {
  const ids = quizIndexes(today);
  const ans = state.quiz.answered;
  const sub = `<div class="subtabs" role="group"><button data-act="quiz-mode" data-m="today" aria-pressed="${view.quizMode === 'today'}">오늘의 퀴즈</button><button data-act="quiz-mode" data-m="wrong" aria-pressed="${view.quizMode === 'wrong'}">오답 노트 ${state.wrong.length}</button></div>`;
  if (view.quizMode === 'wrong') {
    return `${sub}<section class="card"><h2>틀린 문제 다시 풀기</h2><p class="small muted" style="margin:4px 0 0">다시 맞히면 은행잎 1장을 받고 노트에서 빠져요.</p>
      ${state.wrong.length ? `<div class="list">${state.wrong.map((id) => `<button class="item" style="text-align:left;width:100%" data-act="retry" data-q="${id}">
        <span class="cat">${ICON.quiz}</span><div><b>${esc(QUIZ[id].q)}</b><small>${QUIZ[id].area}</small></div><span class="muted">›</span></button>`).join('')}</div>`
        : '<p class="empty">틀린 문제가 없어요. 멋져요!</p>'}</section>`;
  }
  const bar = `<div class="qbar">${ids.map((id) => {
    const a = ans[id];
    const cls = a ? (a.correct ? 'right' : 'wrong') : (id === ids.find((x) => !ans[x]) ? 'now' : '');
    return `<i class="${cls}"></i>`;
  }).join('')}</div>`;
  const current = view.reveal ?? ids.find((id) => !ans[id]);
  if (current === undefined) {
    const right = ids.filter((id) => ans[id].correct).length;
    return `${sub}<section class="card quiz-done">${bar}
      ${mascot(right >= 4 ? 'cheer' : 'think', 140)}
      <div class="score num">${right} / 5</div>
      <p class="muted" style="margin:0">오늘 퀴즈 끝! 은행잎 ${right * 3}장을 받았어요.<br>내일 새 문제 5개가 열려요.</p>
      <div class="btn-row" style="width:100%"><button class="btn ghost" data-act="quiz-mode" data-m="wrong">오답 노트</button><button class="btn primary" data-act="tab" data-tab="shop">상점 가기</button></div>
    </section>`;
  }
  return `${sub}<section class="card" style="display:grid;gap:16px">${bar}${questionBlock(current, ans[current], 'pick')}</section>`;
}

function questionBlock(id, answered, act) {
  const q = QUIZ[id];
  const pos = quizIndexes(today).indexOf(id);
  return `<div><span class="qarea">${act === 'pick' ? `${pos + 1}번 문제 · ` : ''}${q.area}</span><p class="qtext">${esc(q.q)}</p></div>
    <div class="choices">${q.choices.map((c, i) => {
      let cls = '';
      if (answered) cls = i === q.answer ? 'right' : (i === answered.pick ? 'wrong' : '');
      return `<button class="choice ${cls}" data-act="${act}" data-q="${id}" data-i="${i}" ${answered ? 'disabled' : ''}><span class="n">${i + 1}</span><span>${esc(c)}</span></button>`;
    }).join('')}</div>
    ${answered ? `<div class="explain"><b>${answered.correct ? `정답이에요! 은행잎 +${act === 'pick' ? 3 : 1}` : '아쉬워요, 오답 노트에 담았어요'}</b><span>${esc(q.explain)}</span></div>
      ${act === 'pick' ? '<button class="btn primary block" data-act="next-q">다음</button>' : '<button class="btn primary block" data-act="close">닫기</button>'}` : ''}`;
}

// ───────────────────────── 코치 ─────────────────────────
// 추천 질문의 요일은 항상 이번 용돈 주기 안에 들어오게 고른다.
const suggestions = (st) => {
  const d = addDays(today, Math.min(2, st.daysLeft - 1));
  const when = d === today ? '오늘' : `${DAY_NAMES[weekday(d)]}요일에`;
  return ['이번 주 지출 계획 짜 줘', `${when} 떡볶이 먹어도 돼?`, '목표를 더 빨리 이루려면?'];
};

function planBlock(plan, today0) {
  if (!plan?.length) return '';
  const max = Math.max(...plan.map((d) => d.amount), 1);
  const avg = plan.reduce((t, d) => t + d.amount, 0) / plan.length;
  return `<div class="plan">${plan.map((d) => `<div class="plan-row ${d.amount > avg * 1.4 ? 'hl' : ''}"><span>${d.date === today0 ? '오늘' : DAY_NAMES[weekday(d.date)] + '요일'}</span><span class="bar"><i style="width:${(d.amount / max) * 100}%"></i></span><span class="num">${won(d.amount)}</span></div>`).join('')}</div>`;
}

function coachView() {
  const face = `<span class="avatar">${mascot('joy', 36, '')}</span>`;
  const hello = `<div class="bot-row">${face}<div class="msg bot">안녕! 나는 돈구리야. 용돈을 어떻게 나눠 쓸지 같이 고민해 줄게.\n계산은 앱이 정확하게 하고, 나는 쉽게 설명해 줄게.</div></div>`;
  const msgs = state.chat.map((m) => m.role === 'user'
    ? `<div class="msg me">${esc(m.text)}</div>`
    : `<div class="bot-row">${face}<div class="msg bot">${esc(m.text)}${planBlock(m.plan, m.today)}<span class="src">${m.source === 'claude' ? 'Claude가 답했어요 · 숫자는 앱이 계산' : (state.coachKey ? '예시 답변 · 연결이 안 돼서 앱이 바로 답했어요' : '예시 답변 · 설정에서 Claude API 키를 넣으면 AI가 답해요')}</span></div></div>`).join('');
  const busy = view.coachBusy ? `<div class="bot-row">${face}<div class="msg bot"><span class="typing" aria-label="생각 중"><i></i><i></i><i></i></span></div></div>` : '';
  return `<div class="chat" id="chat">${hello}${msgs}${busy}</div>
    <div class="chips">${suggestions(dayStatus(state, today)).map((s) => `<button class="chip" data-act="ask" data-q="${esc(s)}" ${view.coachBusy ? 'disabled' : ''}>${s}</button>`).join('')}</div>`;
}

// ───────────────────────── 상점 ─────────────────────────
function shopView() {
  const st = dayStatus(state, today);
  const items = SHOP.filter((i) => i.kind === view.shopKind);
  return `${charStage(st)}
    <div class="row"><div class="seg" style="flex:1"><button data-act="shop-kind" data-k="acc" aria-pressed="${view.shopKind === 'acc'}">액세서리</button><button data-act="shop-kind" data-k="obj" aria-pressed="${view.shopKind === 'obj'}">저축 소품</button></div></div>
    <div class="closet">${items.map((i) => {
      const owned = state.inventory.includes(i.id);
      const worn = state.equipped[i.kind] === i.id;
      return `<button class="goods ${worn ? 'worn' : ''}" data-act="goods" data-id="${i.id}">
        ${worn ? '<span class="badge tag" style="background:var(--blue);color:#fff">함께하는 중</span>' : owned ? '<span class="badge tag plain">보유</span>' : ''}
        <span class="pic"><img src="${i.img}" alt=""></span>
        <b>${esc(i.name)}</b>
        <span class="small muted">${esc(i.line)}</span>
        ${owned ? `<span class="small" style="font-weight:700;color:var(--blue)">${worn ? '눌러서 내려놓기' : '눌러서 함께하기'}</span>` : `<span class="price num">${leaf(16)} ${i.price}잎</span>`}
      </button>`;
    }).join('')}</div>
    <p class="small muted" style="text-align:center;margin:0">은행잎은 퀴즈 정답 3장, 기록 1장, 저축 2장, 무지출 하루 5장이에요.</p>`;
}

function buySheet() {
  const i = byId(view.sheet.id);
  const lack = i.price - state.leaves;
  return `<div class="grabber"></div>
    <div style="display:grid;justify-items:center;gap:8px;text-align:center">
      <span class="pic" style="width:120px;height:120px;border-radius:24px;background:var(--hanji);display:grid;place-items:center"><img src="${i.img}" alt="" style="max-height:96px;width:auto"></span>
      <h3>${esc(i.name)}을(를) 구매할까요?</h3>
      <p class="muted" style="margin:0">${esc(i.line)}</p>
      <div class="preview" style="width:100%;text-align:left"><span class="row"><span>가격</span><span class="arrow num">${leaf(14)} ${i.price}잎</span></span>
      <span class="row"><span>구매 후 남는 은행잎</span><span class="arrow num">${lack > 0 ? '부족해요' : `${state.leaves - i.price}잎`}</span></span></div>
      ${lack > 0 ? `<p class="err" style="margin:0">은행잎이 ${lack}장 부족해요. 오늘의 퀴즈로 모아 볼까요?</p>` : ''}
    </div>
    <div class="btn-row"><button class="btn ghost" data-act="close">다음에</button>
    ${lack > 0 ? '<button class="btn primary" data-act="tab" data-tab="quiz">퀴즈 풀러 가기</button>' : `<button class="btn primary" data-act="buy" data-id="${i.id}">구매하기</button>`}</div>`;
}

// ───────────────────────── 설정 ─────────────────────────
function settingsSheet() {
  const s = state.settings;
  const unit = s.cycle === 'monthly' ? '달' : '주';
  return `<div class="row"><h3>설정</h3><button class="icon-btn" data-act="close" aria-label="닫기">${ICON.close}</button></div>
    <section class="card" style="background:var(--soft);display:grid;gap:12px">
      <h2>예산</h2>
      <div class="field"><label for="setAllowance">${unit}마다 받는 용돈</label><div class="input-won"><input class="input num" id="setAllowance" inputmode="numeric" value="${s.allowance}"></div></div>
      <div class="field"><label for="setFixed">꼭 나가는 돈(고정 지출)</label><div class="input-won"><input class="input num" id="setFixed" inputmode="numeric" value="${s.fixed}"></div></div>
      <div class="field"><label for="setSave">${unit}마다 먼저 저축할 돈</label><div class="input-won"><input class="input num" id="setSave" inputmode="numeric" value="${s.savePerCycle}"></div></div>
      <div class="field"><label for="setGoal">목표</label><input class="input" id="setGoal" value="${esc(s.goalName)}"></div>
      <div class="field"><label for="setGoalAmt">목표 금액</label><div class="input-won"><input class="input num" id="setGoalAmt" inputmode="numeric" value="${s.goalAmount}"></div></div>
      <div class="preview" id="setPreview"></div>
      <button class="btn primary block" data-act="save-settings">저장하기</button>
    </section>
    <section class="card" style="background:var(--soft);display:grid;gap:10px">
      <h2>AI 코치 연결</h2>
      <p class="small muted" style="margin:0">Claude API 키를 넣으면 코치가 AI로 답해요. 키는 이 기기에만 저장되고, 이름 같은 개인정보는 보내지 않아요. 키가 없어도 앱이 계산한 예시 답변이 나와요.</p>
      <input class="input" id="setKey" type="password" autocomplete="off" placeholder="sk-ant-..." value="${esc(state.coachKey)}">
      <button class="btn line block" data-act="save-key">키 저장</button>
    </section>
    <section class="card" style="background:var(--soft);display:grid;gap:10px">
      <h2>시연</h2>
      <p class="small muted" style="margin:0">지금 날짜: <b>${dateLabel(today)}</b>${state.devOffset ? ` (실제보다 ${state.devOffset}일 뒤)` : ''}</p>
      <button class="btn line block" data-act="demo-load">시연 데이터 불러오기 (김도연의 2주)</button>
      <button class="btn line block" data-act="demo-next">하루 넘기기</button>
      <button class="btn danger block" data-act="ask-reset">처음부터 다시 하기</button>
    </section>`;
}

function readSettingsForm() {
  const n = (id) => Math.max(0, Math.floor(Number(String(document.getElementById(id).value).replace(/[^\d]/g, '')) || 0));
  return { ...state.settings, allowance: n('setAllowance'), fixed: n('setFixed'), savePerCycle: n('setSave'), goalName: document.getElementById('setGoal').value.trim() || '목표', goalAmount: n('setGoalAmt') };
}

function updateSettingsPreview() {
  const box = document.getElementById('setPreview');
  if (!box) return;
  const next = readSettingsForm();
  const money = spendable(next);
  if (money < 0) { box.innerHTML = `<span class="err">용돈보다 고정 지출과 저축이 ${won(-money)} 많아요.</span>`; return; }
  const before = dayStatus(state, today).limit;
  const after = dayStatus({ ...state, settings: next }, today).limit;
  box.innerHTML = before === after ? '<span class="muted">하루 한도는 그대로예요.</span>' : `<span>저장하면 오늘 하루 한도 <span class="arrow num">${won(before)} → ${won(after)}</span></span>`;
}

// ───────────────────────── 온보딩 ─────────────────────────
function onbView() {
  const o = view.onb;
  const d = o.draft;
  if (o.step === 0) {
    return `<div class="welcome">
      <div class="hero" id="heroLeaves"><span class="hero-mascot">${mascot('cheer', 200)}</span></div>
      <div class="copy">
        <h1 class="brand">돈구리</h1>
        <p class="slogan">오늘 써도 되는 돈, 매일 한 숫자로.</p>
        <p class="muted" style="margin:0 0 10px">나는 돈구리야. 매일 아침 오늘 써도 되는 돈을 알려 주고, 아낀 돈은 네 목표로 옮겨 줄게.</p>
        <button class="btn primary block" data-act="onb-next">시작하기</button>
        <button class="btn text" data-act="demo-load">시연 데이터로 둘러보기</button>
      </div></div>`;
  }
  const steps = `<div class="steps">${[1, 2, 3, 4].map((n) => `<i class="${n <= o.step ? 'on' : ''}"></i>`).join('')}</div>`;
  const back = `<button class="icon-btn" data-act="onb-back" aria-label="뒤로">${ICON.back}</button>`;
  const unit = d.cycle === 'monthly' ? '달' : '주';
  let body = '', foot = '';
  if (o.step === 1) {
    body = `<div><h1>용돈은 얼마나,<br>언제 받아?</h1><p class="lead">받는 날부터 다음 받는 날 전까지를 한 주기로 계산해요.</p></div>
      <div class="field"><label>받는 주기</label><div class="seg"><button data-act="onb-cycle" data-v="weekly" aria-pressed="${d.cycle === 'weekly'}">매주</button><button data-act="onb-cycle" data-v="monthly" aria-pressed="${d.cycle === 'monthly'}">매월</button></div></div>
      <div class="field"><label for="onbAllow">${unit}마다 받는 용돈</label><div class="input-won"><input class="input num" id="onbAllow" inputmode="numeric" placeholder="30,000" value="${d.allowance || ''}"></div></div>
      ${d.cycle === 'weekly'
        ? `<div class="field"><label>받는 요일</label><div class="days7">${DAY_NAMES.map((n, i) => `<button data-act="onb-payday" data-v="${i}" aria-pressed="${d.payday === i}">${n}</button>`).join('')}</div></div>`
        : `<div class="field"><label for="onbPayday">받는 날짜</label><select class="input" id="onbPayday">${Array.from({ length: 28 }, (_, i) => `<option value="${i + 1}" ${d.payday === i + 1 ? 'selected' : ''}>매월 ${i + 1}일</option>`).join('')}</select></div>`}
      <p class="err" id="onbErr"></p>`;
    foot = '<button class="btn primary block" data-act="onb-next">다음</button>';
  } else if (o.step === 2) {
    body = `<div><h1>꼭 나가는 돈이 있어?</h1><p class="lead">교통카드 충전, 구독료처럼 ${unit}마다 정해진 돈이요. 먼저 빼 두고 계산해요.</p></div>
      <div class="field"><label for="onbFixed">${unit}마다 고정 지출</label><div class="input-won"><input class="input num" id="onbFixed" inputmode="numeric" placeholder="10,000" value="${d.fixed || ''}"></div></div>
      <p class="err" id="onbErr"></p>`;
    foot = `<div class="btn-row"><button class="btn ghost" data-act="onb-skip">없어요</button><button class="btn primary" data-act="onb-next">다음</button></div>`;
  } else if (o.step === 3) {
    body = `<div><h1>무엇을 위해 모을까?</h1><p class="lead">목표가 있으면 아낀 돈이 어디로 가는지 눈에 보여요.</p></div>
      <div class="field"><label for="onbGoal">목표 이름</label><input class="input" id="onbGoal" placeholder="무선 이어폰" value="${esc(d.goalName || '')}"></div>
      <div class="field"><label for="onbGoalAmt">목표 금액</label><div class="input-won"><input class="input num" id="onbGoalAmt" inputmode="numeric" placeholder="200,000" value="${d.goalAmount || ''}"></div></div>
      <div class="field"><label>언제까지?</label><div class="chips">${[[1, '1개월'], [3, '3개월'], [6, '6개월'], [12, '1년']].map(([m, l]) => `<button class="chip" data-act="onb-months" data-v="${m}" aria-pressed="${d.months === m}">${l}</button>`).join('')}</div></div>
      <div class="field"><label for="onbSave">${unit}마다 먼저 저축할 돈</label><div class="input-won"><input class="input num" id="onbSave" inputmode="numeric" value="${d.savePerCycle ?? ''}"></div></div>
      <div class="preview" id="onbPreview"></div>
      <p class="err" id="onbErr"></p>`;
    foot = '<button class="btn primary block" data-act="onb-next">다음</button>';
  } else {
    const st = dayStatus({ ...blankState(), settings: d, startDate: today, autoSaved: d.savePerCycle }, today);
    body = `<div class="result-big">
        ${mascot('joy', 160)}
        <span class="muted">오늘 써도 되는 돈</span>
        <span class="big num">${won(st.limit)}</span>
        <p class="muted" style="margin:0">${unit}마다 ${won(d.allowance)}에서 고정 지출 ${won(d.fixed)}과<br>저축 ${won(d.savePerCycle)}을 먼저 빼고 나눴어요.<br>아낀 돈은 다음 날 한도로 돌아와요.</p>
      </div>`;
    foot = '<button class="btn primary block" data-act="onb-finish">돈구리 시작하기</button>';
  }
  return `<div class="onb"><div style="display:grid;gap:14px">${o.step > 0 ? `<div class="row">${back}<span class="small muted">${o.step} / 4</span><span style="width:36px"></span></div>` : ''}${steps}</div>
    <div class="onb-body">${body}</div><div>${foot}</div></div>`;
}

const numIn = (id) => { const el = document.getElementById(id); return el ? Math.floor(Number(String(el.value).replace(/[^\d]/g, '')) || 0) : 0; };

function cyclesFor(months, cycle) { return cycle === 'monthly' ? months : Math.max(1, Math.round((months * 365) / 12 / 7)); }

function updateOnbPreview() {
  const box = document.getElementById('onbPreview');
  if (!box) return;
  const d = view.onb.draft;
  const amt = numIn('onbGoalAmt');
  const saveEl = document.getElementById('onbSave');
  if (document.activeElement !== saveEl && amt > 0 && d.months) {
    const suggest = Math.ceil(amt / cyclesFor(d.months, d.cycle) / 100) * 100;
    saveEl.value = suggest;
  }
  const savePer = numIn('onbSave');
  const money = d.allowance - d.fixed - savePer;
  const unit = d.cycle === 'monthly' ? '달' : '주';
  const days = d.cycle === 'monthly' ? 30 : 7;
  if (money < 0) box.innerHTML = `<span class="err">저축이 쓸 수 있는 돈보다 ${won(-money)} 많아요. 기간을 늘려 볼까요?</span>`;
  else box.innerHTML = `<span>${unit}마다 <b>${won(savePer)}</b> 저축하면 하루 약 <span class="arrow num">${won(Math.floor(money / days))}</span>씩 쓸 수 있어요.</span>${money / days < 500 ? '<span class="muted small">조금 빠듯하다면 기간을 늘려도 괜찮아요.</span>' : ''}`;
}

// ───────────────────────── 렌더 ─────────────────────────
function sheetHtml() {
  const s = view.sheet;
  if (!s) return '';
  const inner = { record: recordSheet, save: saveSheet, buy: buySheet, settings: settingsSheet, retry: () => `<div class="grabber"></div><div class="row"><h3>오답 다시 풀기</h3><button class="icon-btn" data-act="close" aria-label="닫기">${ICON.close}</button></div>${questionBlock(s.id, s.answered, 'repick')}`, confirm: () => `<div class="grabber"></div><h3>${s.title}</h3><p class="muted" style="margin:0">${s.body}</p><div class="btn-row"><button class="btn ghost" data-act="close">취소</button><button class="btn ${s.danger ? 'danger' : 'primary'}" data-act="confirm-ok">${s.ok}</button></div>` }[s.type]();
  return `<div class="scrim" data-act="scrim"><div class="sheet ${s.type === 'settings' ? 'full' : ''}" role="dialog" aria-modal="true">${inner}</div></div>`;
}

function render() {
  const main = phone.querySelector('.main');
  const scroll = main ? main.scrollTop : 0;
  const keepToasts = phone.querySelector('.toasts');
  if (!state.settings) {
    if (!view.onb) view.onb = { step: 0, draft: { cycle: 'weekly', payday: weekday(today), allowance: 0, fixed: 0, goalName: '', goalAmount: 0, months: 3, savePerCycle: null } };
    phone.innerHTML = onbView() + sheetHtml();
    updateOnbPreview();
  } else {
    const st = dayStatus(state, today);
    const body = { home: homeView, quiz: quizView, coach: coachView, shop: shopView }[view.tab]();
    const composer = view.tab === 'coach' ? `<form class="composer" data-form="coach"><label class="sr" for="coachInput">돈구리에게 묻기</label><input class="input" id="coachInput" autocomplete="off" placeholder="예: 토요일에 영화 봐도 돼?" ${view.coachBusy ? 'disabled' : ''}><button class="send" aria-label="보내기" ${view.coachBusy ? 'disabled' : ''}>${ICON.send}</button></form>` : '';
    phone.innerHTML = `${topbar(st)}<main class="main" id="main">${body}</main>${composer}${tabbar()}${sheetHtml()}`;
    const m = phone.querySelector('.main');
    if (view.tab === 'coach') m.scrollTop = m.scrollHeight;
    else if (!view.resetScroll) m.scrollTop = scroll;
    view.resetScroll = false;
    if (view.sheet?.type === 'settings') updateSettingsPreview();
  }
  if (keepToasts) phone.appendChild(keepToasts);
}

// ───────────────────────── 동작 ─────────────────────────
const open = (sheet) => { view.sheet = sheet; render(); };
const close = () => { view.sheet = null; render(); };
const confirm = (title, body, ok, run, danger = false) => open({ type: 'confirm', title, body, ok, run, danger });

function bumpLeaves() {
  const pill = document.getElementById('leafPill');
  pill?.animate?.([{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 420 });
}

const ACT = {
  tab: (el) => { view.tab = el.dataset.tab; view.sheet = null; view.resetScroll = true; render(); },
  'open-settings': () => open({ type: 'settings' }),
  'open-record': () => open({ type: 'record', amount: '', cat: 'friends' }),
  'open-save': () => { const st = dayStatus(state, today); open({ type: 'save', amount: floor100(st.left) ? String(floor100(st.left)) : '' }); },
  close, scrim: (el, e) => { if (e.target === el) close(); },
  key: (el) => {
    const s = view.sheet; const k = el.dataset.k;
    if (k === 'del') s.amount = s.amount.slice(0, -1);
    else if (s.amount.length < 7 && !(s.amount === '' && (k === '0' || k === '00'))) s.amount += k;
    render();
  },
  cat: (el) => { view.sheet.cat = el.dataset.cat; render(); },
  'set-amount': (el) => { view.sheet.amount = el.dataset.v; render(); },
  'save-record': () => {
    const { amount, cat } = view.sheet;
    const got = record(state, today, Number(amount), cat);
    persist(); view.sheet = null; view.tab = 'home'; view.resetScroll = true; render();
    const st = dayStatus(state, today);
    toast(phone, `${won(Number(amount))} 기록했어요 · 오늘 ${st.left >= 0 ? `${won(st.left)} 남았어요` : `${won(-st.left)} 넘었어요`}${got ? ` · ${leaf()} +${got}` : ''}`);
    if (got) bumpLeaves();
  },
  'save-money': () => {
    const amount = Number(view.sheet.amount);
    const btn = phone.querySelector('[data-act="save-money"]');
    const fromRect = btn?.getBoundingClientRect();
    const got = saveMoney(state, today, amount);
    persist(); view.sheet = null; view.tab = 'home'; view.resetScroll = true; render();
    const goal = document.getElementById('goalCard');
    if (fromRect) { const ghost = document.createElement('div'); Object.assign(ghost.style, { position: 'fixed', left: `${fromRect.left}px`, top: `${fromRect.top}px`, width: `${fromRect.width}px`, height: `${fromRect.height}px` }); document.body.appendChild(ghost); leafBurst(phone, ghost, goal, 9); ghost.remove(); }
    leafFall(document.getElementById('leafFall'), 10);
    toast(phone, `${leaf()} ${won(amount)}을 ${esc(state.settings.goalName)} 저축통에 넣었어요${got ? ` · +${got}잎` : ''}`);
    if (got) setTimeout(bumpLeaves, 700);
  },
  'ask-delete': (el) => {
    const e = state.entries.find((x) => x.id === el.dataset.id);
    confirm('이 기록을 지울까요?', `${won(e.amount)} ${e.type === 'save' ? '저축' : '지출'} 기록을 지우면 한도가 다시 계산돼요.`, '지우기', () => { removeEntry(state, e.id); persist(); toast(phone, '기록을 지웠어요'); }, true);
  },
  'confirm-ok': () => { const run = view.sheet.run; view.sheet = null; run(); render(); },

  'quiz-mode': (el) => { view.tab = 'quiz'; view.quizMode = el.dataset.m; view.reveal = null; render(); },
  pick: (el) => {
    const id = Number(el.dataset.q), i = Number(el.dataset.i);
    if (state.quiz.answered[id]) return;
    const correct = QUIZ[id].answer === i;
    state.quiz.answered[id] = { pick: i, correct };
    if (correct) grant(state, today, 'quiz'); else if (!state.wrong.includes(id)) state.wrong.push(id);
    view.reveal = id; persist(); render();
    if (correct) { bumpLeaves(); toast(phone, `${leaf()} 정답! 은행잎 +3`, 1600); }
  },
  'next-q': () => { view.reveal = null; render(); },
  retry: (el) => open({ type: 'retry', id: Number(el.dataset.q), answered: null }),
  repick: (el) => {
    const id = Number(el.dataset.q), i = Number(el.dataset.i);
    const correct = QUIZ[id].answer === i;
    view.sheet.answered = { pick: i, correct };
    if (correct) { grant(state, today, 'retry'); state.wrong = state.wrong.filter((x) => x !== id); persist(); toast(phone, `${leaf()} 이제 확실히 알았어요! +1`, 1600); }
    render();
  },

  ask: (el) => sendCoach(el.dataset.q),

  'shop-kind': (el) => { view.shopKind = el.dataset.k; render(); },
  goods: (el) => {
    const i = byId(el.dataset.id);
    if (state.inventory.includes(i.id)) {
      state.equipped[i.kind] = state.equipped[i.kind] === i.id ? null : i.id;
      persist(); render();
      toast(phone, state.equipped[i.kind] ? `${esc(i.name)}을(를) 돈구리에게 줬어요` : `${esc(i.name)}을(를) 내려놓았어요`, 1600);
    } else open({ type: 'buy', id: i.id });
  },
  buy: (el) => {
    const i = byId(el.dataset.id);
    if (state.leaves < i.price) return;
    state.leaves -= i.price; state.inventory.push(i.id); state.equipped[i.kind] = i.id;
    persist(); view.sheet = null; render();
    leafFall(document.getElementById('leafFall'), 12);
    toast(phone, `${esc(i.name)}을(를) 샀어요! 은행잎 ${state.leaves}장 남았어요`);
  },

  'save-settings': () => {
    const next = readSettingsForm();
    if (spendable(next) < 0) return updateSettingsPreview();
    const old = state.settings;
    if (next.savePerCycle !== old.savePerCycle) state.autoSaved += next.savePerCycle - old.savePerCycle;
    state.settings = next;
    persist(); close(); toast(phone, '예산을 저장했어요');
  },
  'save-key': () => { state.coachKey = document.getElementById('setKey').value.trim(); persist(); toast(phone, state.coachKey ? 'Claude 키를 저장했어요' : '키를 지웠어요. 예시 답변으로 바뀌어요'); },
  'demo-load': () => {
    const realToday = todayOf({ devOffset: 0 });
    const key = state.coachKey;
    state = demoState(realToday); state.coachKey = key;
    view.sheet = null; view.onb = null; view.tab = 'home'; view.reveal = null; view.resetScroll = true;
    startOfDay(false); persist(); render();
    toast(phone, '시연 데이터를 불러왔어요 · 김도연의 2주');
  },
  'demo-next': () => {
    if (!state.settings) return toast(phone, '먼저 예산을 설정하거나 시연 데이터를 불러와 주세요');
    state.devOffset = (state.devOffset || 0) + 1;
    view.reveal = null; view.sheet = null;
    startOfDay(true); render();
    toast(phone, `${dateLabel(today)}로 넘어갔어요`);
  },
  'ask-reset': () => confirm('처음부터 다시 할까요?', '기록, 은행잎, 상점 물건이 모두 지워져요. 되돌릴 수 없어요.', '모두 지우기', () => {
    const key = state.coachKey; state = blankState(); state.coachKey = key; today = todayOf(state); view.onb = null; view.tab = 'home';
    persist();
  }, true),

  'onb-next': () => {
    const o = view.onb, d = o.draft, err = (t) => { const e = document.getElementById('onbErr'); if (e) e.textContent = t; };
    if (o.step === 1) {
      d.allowance = numIn('onbAllow');
      if (d.cycle === 'monthly') d.payday = Number(document.getElementById('onbPayday').value);
      if (d.allowance < 1000) return err('용돈 금액을 1,000원 이상으로 넣어 주세요.');
    }
    if (o.step === 2) {
      d.fixed = numIn('onbFixed');
      if (d.fixed >= d.allowance) return err('고정 지출이 용돈보다 같거나 많아요.');
    }
    if (o.step === 3) {
      d.goalName = document.getElementById('onbGoal').value.trim();
      d.goalAmount = numIn('onbGoalAmt');
      d.savePerCycle = numIn('onbSave');
      if (!d.goalName) return err('목표 이름을 적어 주세요.');
      if (d.goalAmount < 1000) return err('목표 금액을 1,000원 이상으로 넣어 주세요.');
      if (d.allowance - d.fixed - d.savePerCycle < 0) return err('저축이 너무 많아요. 기간을 늘리거나 저축액을 줄여 주세요.');
    }
    o.step += 1; render();
  },
  'onb-back': () => { view.onb.step = Math.max(0, view.onb.step - 1); render(); },
  'onb-skip': () => { view.onb.draft.fixed = 0; view.onb.step = 3; render(); },
  'onb-cycle': (el) => { const d = view.onb.draft; d.allowance = numIn('onbAllow'); d.cycle = el.dataset.v; d.payday = d.cycle === 'weekly' ? weekday(today) : Number(today.slice(8)) > 28 ? 1 : Number(today.slice(8)); render(); },
  'onb-payday': (el) => { const d = view.onb.draft; d.allowance = numIn('onbAllow'); d.payday = Number(el.dataset.v); render(); },
  'onb-months': (el) => {
    const d = view.onb.draft;
    d.goalName = document.getElementById('onbGoal').value; d.goalAmount = numIn('onbGoalAmt'); d.months = Number(el.dataset.v);
    d.savePerCycle = d.goalAmount ? Math.ceil(d.goalAmount / cyclesFor(d.months, d.cycle) / 100) * 100 : null;
    render();
  },
  'onb-finish': () => {
    const d = view.onb.draft;
    setupBudget(state, { cycle: d.cycle, payday: d.payday, allowance: d.allowance, fixed: d.fixed, savePerCycle: d.savePerCycle, goalName: d.goalName, goalAmount: d.goalAmount }, today);
    state.quiz = { date: today, answered: {} };
    view.onb = null; view.resetScroll = true; persist(); render();
    toast(phone, `${won(d.savePerCycle)}을 먼저 저축통에 넣었어요`);
  },
};

async function sendCoach(q) {
  q = String(q || '').trim();
  if (!q || view.coachBusy) return;
  view.tab = 'coach';
  const history = state.chat.slice(-6).map((m) => ({ role: m.role, content: m.text }));
  state.chat.push({ role: 'user', text: q });
  view.coachBusy = true; render();
  const st = dayStatus(state, today);
  const ans = await askClaude({ apiKey: state.coachKey, question: q, status: st, today, state, history });
  state.chat.push({ role: 'assistant', text: ans.text, plan: ans.plan, source: ans.source, today });
  state.chat = state.chat.slice(-20);
  view.coachBusy = false; persist(); render();
  document.getElementById('coachInput')?.focus();
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = ACT[el.dataset.act];
  if (fn) fn(el, e);
});
document.addEventListener('submit', (e) => {
  if (e.target.dataset.form !== 'coach') return;
  e.preventDefault();
  sendCoach(document.getElementById('coachInput').value);
});
document.addEventListener('input', (e) => {
  if (['onbGoalAmt', 'onbSave'].includes(e.target.id)) updateOnbPreview();
  if (e.target.id?.startsWith('set') && e.target.id !== 'setKey') updateSettingsPreview();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && view.sheet) close();
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && todayOf(state) !== today) { startOfDay(true); render(); }
});

startOfDay(true);
render();
