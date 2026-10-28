// 돈구리 앱: 상태를 받아 화면을 다시 그리는 단순한 렌더 루프.
// 중심 흐름은 "살까 말까?" → 판단 카드 → 살래·참을래·내일 다시 볼래 → 은행나무.
import { addDays, diffDays, weekday, cycleRange, dayStatus, goalProgress, streak, level, quizIndexes, spendable } from './budget.js';
import { load, save, blankState, todayOf, newDay, setupBudget, record, removeEntry, worry, pendingHolds, resolveHold, demoState, walletOf, canSpend, receive, canRemove } from './store.js';
import { chipList, judge, ruleLine, treeOf, weekStats, isFood, TREE_STAGES, ro, tightPlan } from './decide.js';
import { QUIZ } from './quiz-data.js';
import { SHOP, byId } from './shop-data.js';
import { askLine } from './coach.js';
import { esc, won, comma, leaf, ICON, CATEGORIES, catOf, toast, leafBurst, leafFall, treeSvg } from './ui.js';
import { mascot } from './mascot.js';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
const phone = document.querySelector('.phone');

let state = load();
let today = todayOf(state);
const view = { tab: 'home', sheet: null, onb: null, quizMode: 'today', reveal: null, shopKind: 'acc' };

const persist = () => save(state);
const dateLabel = (d) => { const [, m, dd] = d.split('-').map(Number); return `${m}월 ${dd}일 ${DAY_NAMES[weekday(d)]}요일`; };
const shortDate = (d) => (d === today ? '오늘' : d === addDays(today, -1) ? '어제' : `${Number(d.slice(5, 7))}/${Number(d.slice(8))} ${DAY_NAMES[weekday(d)]}`);
const unitOf = () => (state.settings.cycle === 'monthly' ? '달' : '주');
const want = (cat) => (isFood(cat) ? '먹고' : '갖고');

// ───────────────────────── 하루 시작 처리 ─────────────────────────
function startOfDay(announce = true) {
  today = todayOf(state);
  if (!state.settings) return;
  const events = newDay(state, today);
  if (state.quiz.date !== today) state.quiz = { date: today, answered: {} };
  persist();
  if (!announce) return;
  events.forEach((e, i) => setTimeout(() => {
    if (e.type === 'autokeep') toast(phone, `${leaf()} 3일 동안 안 산 ${esc(e.name)}, 지킨 걸로 할게요 · +${e.leaves}잎`);
    if (e.type === 'leftover') toast(phone, `${ICON.jar} 지난 주기에 남은 ${won(e.amount)}을 저축통에 넣었어요`);
    if (e.type === 'overdraw') toast(phone, `지난 주기에 넘친 ${won(e.amount)}은 저축통에서 꺼냈어요`);
    if (e.type === 'cycle') toast(phone, `새 용돈 주기 시작! ${won(e.amount)}을 먼저 저축했어요`);
  }, 300 + i * 500));
}

// ───────────────────────── 공통 틀 ─────────────────────────
function topbar() {
  const s = streak(state, today);
  return `<header class="topbar">
    <div class="who">
      <span class="avatar">${mascot('calm', 40, '')}</span>
      <div><b>돈구리 <span class="badge plain">Lv.${level(s)}</span></b><span>${ICON.flame} ${s}일 연속 한도 지킴</span></div>
    </div>
    <div class="top-actions">
      <span class="pill leaves num" id="leafPill" aria-label="은행잎 ${state.leaves}장">${leaf(18)} ${comma(state.leaves)}</span>
      <button class="icon-btn" data-act="open-settings" aria-label="설정">${ICON.gear}</button>
    </div>
  </header>`;
}

const TABS = [['home', '홈'], ['log', '기록'], ['quiz', '퀴즈'], ['shop', '상점']];
const tabbar = () => `<nav class="tabbar" aria-label="메뉴">${TABS.map(([id, name]) =>
  `<button class="tab" data-act="tab" data-tab="${id}" ${view.tab === id ? 'aria-current="page"' : ''}>${ICON[id]}<span>${name}</span></button>`).join('')}</nav>`;

function wearing() {
  const acc = state.equipped.acc && byId(state.equipped.acc);
  const ob = state.equipped.obj && byId(state.equipped.obj);
  return `${ob ? `<span class="wear obj" title="${esc(ob.name)}"><img src="${ob.img}" alt=""><span class="sr">${esc(ob.name)} 함께하는 중</span></span>` : ''}
    ${acc ? `<span class="wear acc" title="${esc(acc.name)}"><img src="${acc.img}" alt=""><span class="sr">${esc(acc.name)} 착용 중</span></span>` : ''}`;
}

// ───────────────────────── 홈 ─────────────────────────
function holdCard() {
  const w = pendingHolds(state, today)[0];
  if (!w) return '';
  const ago = diffDays(w.date, today);
  return `<section class="card hold" aria-label="어제 고민한 것">
    <div class="hold-q">${mascot('think', 52, '')}<p><span class="small muted">${ago === 1 ? '어제' : `${ago}일 전`} 고민한 ${esc(w.name)} · ${won(w.amount)}</span><b>아직 ${want(w.cat)} 싶어?</b></p></div>
    <div class="btn-row"><button class="btn leaf" data-act="hold" data-id="${w.id}" data-o="skip">이제 괜찮아</button><button class="btn ghost" data-act="hold" data-id="${w.id}" data-o="buy" ${canSpend(state, today, w.amount) ? '' : 'disabled'}>그래도 살래</button></div>
    <p class="small muted" style="margin:0;text-align:center">${canSpend(state, today, w.amount) ? '3일 동안 답이 없으면 안 산 걸로 할게요' : `지금 가진 돈보다 ${won(w.amount - walletOf(state, today))} 많아서 살 수 없어요`}</p>
  </section>`;
}

function treeCard() {
  const t = treeOf(state, today);
  const g = state.settings;
  const days = t.days === null ? '저축액을 정하면 날짜가 보여요' : t.days === 0 ? '목표 금액을 다 모았어요!' : `지금처럼 모으면 <b>${t.days}일 뒤</b>`;
  return `<section class="tree-card" id="treeCard" aria-label="돈구리의 은행나무">
    <div class="leaf-fall" id="leafFall"></div>
    <div class="tree" id="tree">${treeSvg(t.stage, 132)}</div>
    <div class="char">${mascot('calm', 118)}${wearing()}</div>
    <div class="tree-info">
      <div class="row"><b>${esc(g.goalName)}</b><span class="badge leafy">${t.name} · ${Math.floor(t.ratio * 100)}%</span></div>
      <div class="meter leaf"><i style="width:${t.ratio * 100}%"></i></div>
      <span class="small muted">${days}${t.kept > 0 ? ` · 이번 ${unitOf()} 지킨 ${won(t.kept)}은 주기가 끝나면 저축통으로 가요` : ''}</span>
    </div>
  </section>`;
}

function homeView() {
  const st = dayStatus(state, today);
  return `${holdCard()}
  <button class="ask" data-act="open-worry">
    <span class="ask-face">${mascot('think', 76, '')}</span>
    <span class="ask-text"><b>살까 말까?</b><small>사기 전에 돈구리에게 3초만 물어봐</small></span>
    <span class="ask-go" aria-hidden="true">›</span>
  </button>
  ${treeCard()}
  ${moneyCard(st)}`;
}

// 홈의 돈 카드: 오늘 써도 되는 돈 + 남은 잔액(이번 주기) + 저축통, 그리고 "썼어"·"받았어"
function moneyCard(st) {
  const jar = goalProgress(state).saved;
  const tp = tightPlan(state.settings, jar);
  return `<section class="card money" aria-label="내 돈">
    <div class="money-top">
      <div><span class="label">오늘 써도 되는 돈</span><b class="num ${st.left < 0 ? 'over' : ''}">${st.left < 0 ? `${won(-st.left)} 넘음` : won(st.left)}</b></div>
      <div class="bal"><span class="label">남은 잔액</span><b class="num">${won(Math.max(0, st.cycleLeft))}</b><small class="muted">이번 ${unitOf()} · ${st.daysLeft}일 남음</small>${st.cycleLeft < 0 ? `<small style="color:var(--over);font-weight:600">넘친 ${won(-st.cycleLeft)}은 주기가 끝날 때 저축통에서 빠져요</small>` : ''}</div>
    </div>
    <div class="money-sub"><span>${ICON.jar} 저축통 <b class="num">${won(jar)}</b></span><span>가진 돈 합계 <b class="num">${won(Math.max(0, walletOf(state, today)))}</b></span></div>
    ${tp.tight ? `<button class="tight-note" data-act="open-settings">하루 ${won(tp.daily)}이면 빠듯해요 · 조정 방법 보기 ›</button>` : ''}
    <div class="btn-row"><button class="btn line" data-act="open-record">썼어</button><button class="btn line" data-act="open-income">받았어</button></div>
  </section>`;
}

// ───────────────────────── 키패드 ─────────────────────────
const keypad = () => `<div class="keypad">${['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0'].map((k) =>
  `<button class="key num" data-act="key" data-k="${k}">${k}</button>`).join('')}
  <button class="key" data-act="key" data-k="del" aria-label="지우기">${ICON.erase}</button></div>`;

// 고민 없이 쓴 돈 기록("썼어")
function recordSheet() {
  const sh = view.sheet;
  const amount = Number(sh.amount || 0);
  const st = dayStatus(state, today);
  let hint = '얼마를 썼나요?', cls = '';
  const ok = canSpend(state, today, amount);
  if (amount > 0) {
    const after = st.left - amount;
    if (!ok) { hint = `가진 돈(이번 ${unitOf()} 남은 돈 + 저축통)보다 ${won(amount - walletOf(state, today))} 많아요`; cls = 'bad'; }
    else if (after >= 0) { hint = `쓰고 나면 오늘 ${won(after)} 남아요`; cls = 'ok'; }
    else if (amount <= Math.max(0, st.cycleLeft)) { hint = `오늘 한도보다 ${won(-after)} 많아요 · 남은 날에 나눠서 맞춰요`; cls = 'bad'; }
    else { hint = `이번 ${unitOf()} 돈보다 ${won(amount - Math.max(0, st.cycleLeft))} 많아요 · 그만큼 저축통에서 빠져요`; cls = 'bad'; }
  }
  return `<div class="grabber"></div>
    <div class="row"><h3>쓴 돈 기록</h3><button class="icon-btn" data-act="close" aria-label="닫기">${ICON.close}</button></div>
    <div class="amount-display"><div class="val num ${amount ? '' : 'empty'}">${amount ? won(amount) : '0원'}</div><div class="hint ${cls}">${hint}</div></div>
    <div class="chips" role="group" aria-label="카테고리">${CATEGORIES.map((c) =>
      `<button class="chip" data-act="cat" data-cat="${c.id}" aria-pressed="${sh.cat === c.id}">${c.name}</button>`).join('')}</div>
    ${keypad()}
    <button class="btn primary block" data-act="save-record" ${ok ? '' : 'disabled'}>기록하기</button>`;
}

// 용돈 말고 추가로 받은 돈("받았어")
const INCOME_MEMOS = ['세뱃돈', '심부름', '생일 선물', '기타'];
function incomeSheet() {
  const sh = view.sheet;
  const amount = Number(sh.amount || 0);
  const st = dayStatus(state, today);
  let hint = '얼마를 받았나요?';
  if (amount > 0) {
    const after = dayStatus({ ...state, entries: [...state.entries, { date: today, type: 'income', amount }] }, today);
    const bal = (n) => (n < 0 ? `${won(-n)} 넘침` : won(n));
    hint = `남은 잔액 ${bal(st.cycleLeft)} → ${bal(after.cycleLeft)} · 오늘 ${won(st.limit)} → ${won(after.limit)}`;
  }
  return `<div class="grabber"></div>
    <div class="row"><h3>받은 돈 기록</h3><button class="icon-btn" data-act="close" aria-label="닫기">${ICON.close}</button></div>
    <div class="amount-display"><div class="val num ${amount ? '' : 'empty'}">${amount ? won(amount) : '0원'}</div><div class="hint ${amount ? 'ok' : ''}">${hint}</div></div>
    <div class="chips" role="group" aria-label="받은 이유">${INCOME_MEMOS.map((m) =>
      `<button class="chip" data-act="memo" data-v="${m}" aria-pressed="${sh.memo === m}">${m}</button>`).join('')}</div>
    ${keypad()}
    <p class="small muted" style="margin:0;text-align:center">이번 ${unitOf()} 쓸 돈에 더해져요. 남으면 주기가 끝날 때 저축통으로 가요.</p>
    <button class="btn primary block" data-act="save-income" ${amount > 0 ? '' : 'disabled'}>기록하기</button>`;
}

// ───────────────────────── 살까 말까: 고민 입력 ─────────────────────────
function worrySheet() {
  const sh = view.sheet;
  const head = `<div class="grabber"></div><div class="row"><h3>뭐가 고민돼?</h3><button class="icon-btn" data-act="close" aria-label="닫기">${ICON.close}</button></div>`;
  if (!sh.custom) {
    return `${head}
      <div class="worry-chips">${chipList(state.chipPrefs).map((c) =>
        `<button class="wchip" data-act="worry-chip" data-name="${esc(c.name)}"><b>${esc(c.name)}</b><span class="num">${won(c.amount)}</span></button>`).join('')}</div>
      <button class="btn line block" data-act="worry-custom">직접 입력</button>`;
  }
  const amount = Number(sh.amount || 0);
  return `${head}
    <input class="input" id="worryName" maxlength="20" autocomplete="off" placeholder="무엇을 살까? (예: 영화)" value="${esc(sh.name || '')}">
    <div class="amount-display"><div class="val num ${amount ? '' : 'empty'}">${amount ? won(amount) : '0원'}</div><div class="hint">${sh.editing ? '금액을 고치면 다음부터 이 금액으로 나와요' : '얼마예요?'}</div></div>
    ${keypad()}
    <button class="btn primary block" data-act="worry-go" ${amount > 0 ? '' : 'disabled'}>판단 카드 보기</button>`;
}

// ───────────────────────── 살까 말까: 판단 카드 ─────────────────────────
function judgeSheet() {
  const sh = view.sheet;
  const c = judge(state, today, sh.item);
  const u = c.unit;
  const tLabel = c.nextCycle ? '다음 주기 시작 한도' : '내일 한도';
  const goal = esc(c.goalName);
  const arrow = (a, b) => (a === b ? `${won(a)} 그대로` : `${won(a)} → ${won(b)}`);
  const buyGoal = c.later === null ? '목표 날짜는 저축액을 정하면 보여요'
    : c.later > 0 ? `<strong>${goal} ${c.later}일 늦어짐</strong>` : `${goal} 날짜 그대로`;
  const keepGoal = c.sooner === null ? `목표에 ${won(c.keep)} 더 가까워짐`
    : c.sooner > 0 ? `<strong>이번 ${u} 끝까지 지키면 ${c.sooner}일 당겨짐</strong>` : c.keep > 0 ? `목표에 ${won(c.keep)} 더 가까워짐` : '목표 날짜 그대로';
  const leaves = c.leaves ? `은행잎 ${c.leaves}장` : '은행잎 없음';
  const leafNote = c.leafReason === 'same' ? '<small class="note-plain">같은 물건은 하루 2번까지만 은행잎을 줘요</small>'
    : c.leafReason === 'empty' ? `<small class="note-plain">이번 ${u} 남은 돈은 이미 다 지킨 돈으로 셌어요</small>`
    : c.leafReason === 'small' ? `<small class="note-plain">${won(c.toNext)} 더 지키면 은행잎 1장</small>` : '';
  const line = sh.ai?.text || ruleLine(c);
  const src = sh.ai?.source === 'claude' ? 'Claude가 다듬은 말 · 숫자는 앱이 계산' : (sh.ai ? '' : state.coachKey ? '돈구리가 생각 중…' : '');
  return `<div class="grabber"></div>
    <div class="row"><div><span class="small muted">살까 말까?</span><h3>${esc(c.name)} <span class="num">${won(c.amount)}</span></h3></div><button class="icon-btn" data-act="close" aria-label="닫기">${ICON.close}</button></div>
    <div class="say">${mascot('think', 60, '')}<p class="say-line">${esc(line)}${src ? `<small>${src}</small>` : ''}</p></div>
    <div class="opts">
      ${c.canBuy ? `<button class="opt" data-act="choose" data-c="buy">
        <b>살래</b>
        <span>이번 ${u} 남은 돈 <em class="num">${arrow(c.left, c.weekAfterBuy)}</em>${c.over ? `<small>${won(c.over)}은 저축에서 빠져요</small>` : ''}</span>
        <span>${tLabel} <em class="num">${arrow(c.tomorrowNow, c.tomorrowBuy)}</em></span>
        <span>${buyGoal}</span>
      </button>` : `<button class="opt" disabled>
        <b>살래</b>
        <span>가진 돈 <em class="num">${won(c.amount - c.short)}</em></span>
        <span><strong>${won(c.short)} 모자라서 지금은 살 수 없어요</strong></span>
        <span>목표로 정하면 같이 모을 수 있어요</span>
      </button>`}
      <button class="opt" data-act="choose" data-c="skip">
        <b>참을래 <i class="badge leafy">${leaf(14)} ${leaves}</i></b>
        <span>${c.keep === c.left || c.keep === c.amount ? `이번 ${u} 남은 돈 <em class="num">${won(c.left)} 그대로 지킴</em>` : `새로 지키는 돈 <em class="num">${won(c.keep)}</em>`}</span>
        <span>${tLabel} <em class="num">${won(c.tomorrowNow)} 그대로</em></span>
        <span>${keepGoal}</span>${leafNote}
      </button>
      <button class="opt" data-act="choose" data-c="hold">
        <b>내일 다시 볼래</b>
        <span>돈도 목표도 지금 그대로</span>
        <span>내일 "아직 ${want(c.cat)} 싶어?" 하고 물어볼게</span>
        <span>내일 안 사면 그때 남은 돈만큼 지킨 돈으로 쳐요</span>
      </button>
    </div>
    <button class="btn text block" data-act="worry-edit">금액 고치기</button>`;
}

// ───────────────────────── 기록 ─────────────────────────
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

function worryBadge(w) {
  if (!w.outcome) return '<span class="badge plain">보류 중</span>';
  if (w.outcome === 'buy') return `<span class="badge plain">${w.choice === 'hold' ? '하루 뒤 샀어' : '샀어'}</span>`;
  const how = w.auto ? '안 산 걸로' : w.choice === 'hold' ? '하루 뒤 참았어' : '참았어';
  return `<span class="badge leafy">${how}${w.leaves ? ` +${w.leaves}잎` : ''}</span>`;
}

function logView() {
  const s = weekStats(state, today);
  const u = unitOf();
  const { start } = cycleRange(state.settings, today);
  const entries = state.entries.filter((e) => e.date >= start && e.date <= today).slice().reverse();
  return `<section class="card">
      <div class="row"><h2>이번 ${u} 고민</h2><span class="small muted">${shortDate(start)}부터</span></div>
      <div class="stats">
        <div><b class="num">${s.count}번</b><span>고민</span></div>
        <div><b class="num">${s.kept}번</b><span>참음</span></div>
        <div><b class="num">${Math.round(s.ratio * 100)}%</b><span>참은 비율</span></div>
        <div><b class="num">${won(s.keptMoney)}</b><span>지킨 돈</span></div>
      </div>
      ${s.top ? `<p class="small muted" style="margin:12px 0 0">제일 많이 고민한 물건은 <b style="color:var(--ink)">${esc(s.top.name)}</b>(${s.top.n}번)이에요.</p>` : ''}
    </section>
    <section class="card">
      <h2>고민 목록</h2>
      ${s.list.length ? `<div class="list">${s.list.map((w) => `<div class="item"><span class="cat">${catOf(w.cat).icon}</span>
        <div><b>${esc(w.name)}</b><small>${shortDate(w.date)} · ${won(w.amount)}</small></div>${worryBadge(w)}</div>`).join('')}</div>`
        : '<p class="empty">아직 고민이 없어요. 사고 싶은 게 생기면 홈의 "살까 말까?"를 눌러 봐요.</p>'}
    </section>
    <section class="card"><div class="row"><h2>이번 용돈 주기</h2><span class="small muted">남은 돈 ${won(Math.max(0, dayStatus(state, today).cycleLeft))}</span></div>${weekStrip()}</section>
    <section class="card">
      <div class="row"><h2>쓴 돈 · 받은 돈</h2><span><button class="btn text" data-act="open-record" style="padding:0 6px">썼어</button><button class="btn text" data-act="open-income" style="padding:0 6px">받았어</button></span></div>
      ${entries.length ? `<div class="list">${entries.map((e) => {
        const c = e.type === 'save' ? { name: '저축', icon: leaf(22) } : e.type === 'income' ? { name: '받은 돈', icon: ICON.coin } : catOf(e.category);
        const sub = e.type === 'save' ? '저축통으로 옮김' : e.type === 'income' ? '받은 돈' : c.name;
        return `<div class="item"><span class="cat" ${e.type === 'save' ? 'style="background:var(--leaf-tint)"' : e.type === 'income' ? 'style="background:var(--blue-tint);color:var(--blue)"' : ''}>${c.icon}</span>
          <div><b>${esc(e.memo || c.name)}</b><small>${shortDate(e.date)} · ${sub}</small></div>
          <div style="text-align:right"><div class="amt num ${e.type}">${e.type === 'spend' ? '−' : '+'}${won(e.amount)}</div>
          <button class="del" data-act="ask-delete" data-id="${e.id}">지우기</button></div></div>`;
      }).join('')}</div>` : '<p class="empty">이번 주기에 쓰거나 받은 돈이 없어요.</p>'}
    </section>`;
}

// ───────────────────────── 퀴즈 ─────────────────────────
function quizView() {
  const ids = quizIndexes(today);
  const ans = state.quiz.answered;
  const sub = `<div class="subtabs" role="group"><button data-act="quiz-mode" data-m="today" aria-pressed="${view.quizMode === 'today'}">오늘의 퀴즈</button><button data-act="quiz-mode" data-m="wrong" aria-pressed="${view.quizMode === 'wrong'}">오답 노트 ${state.wrong.length}</button></div>`;
  if (view.quizMode === 'wrong') {
    return `${sub}<section class="card"><h2>틀린 문제 다시 풀기</h2><p class="small muted" style="margin:4px 0 0">다시 맞히면 노트에서 빠져요.</p>
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
      <span class="badge leafy" style="font-size:14px;padding:6px 14px">오늘의 경제 박사</span>
      <div class="score num">${right} / 5</div>
      <p class="muted" style="margin:0">오늘 퀴즈 끝! 은행잎은 고민 끝에 지킨 돈으로만 모여요.<br>내일 새 문제 5개가 열려요.</p>
      <div class="btn-row" style="width:100%"><button class="btn ghost" data-act="quiz-mode" data-m="wrong">오답 노트</button><button class="btn primary" data-act="tab" data-tab="home">홈으로</button></div>
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
    ${answered ? `<div class="explain"><b>${answered.correct ? '정답이에요!' : '아쉬워요, 오답 노트에 담았어요'}</b><span>${esc(q.explain)}</span></div>
      ${act === 'pick' ? '<button class="btn primary block" data-act="next-q">다음</button>' : '<button class="btn primary block" data-act="close">닫기</button>'}` : ''}`;
}

// ───────────────────────── 상점 ─────────────────────────
function shopView() {
  const items = SHOP.filter((i) => i.kind === view.shopKind);
  return `<section class="stage shop-stage" aria-label="돈구리"><div class="leaf-fall" id="leafFall"></div>
      <p class="bubble">은행잎은 <b>고민 끝에 지킨 돈</b>이야. 그걸로 나한테 선물해 줄래?</p>
      <div class="char">${mascot('calm', 140)}${wearing()}</div></section>
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
    <p class="small muted" style="text-align:center;margin:0">은행잎은 "참을래"로 지킨 돈 1,000원당 1장이에요.</p>`;
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
      ${lack > 0 ? `<p class="err" style="margin:0">은행잎이 ${lack}장 부족해요. 다음에 고민될 때 "참을래"를 골라 모아 봐요.</p>` : ''}
    </div>
    <div class="btn-row"><button class="btn ghost" data-act="close">다음에</button>
    ${lack > 0 ? '<button class="btn primary" data-act="close">알겠어요</button>' : `<button class="btn primary" data-act="buy" data-id="${i.id}">구매하기</button>`}</div>`;
}

// ───────────────────────── 설정 ─────────────────────────
function settingsSheet() {
  const s = state.settings;
  const unit = unitOf();
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
      <h2>돈구리 한마디 AI 연결</h2>
      <p class="small muted" style="margin:0">Claude API 키를 넣으면 판단 카드의 한마디를 AI가 다듬어요. 숫자는 늘 앱이 계산해요. 키는 이 기기에만 저장되고, 이름 같은 개인정보는 보내지 않아요. 키가 없어도 규칙으로 만든 한마디가 나와요.</p>
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

// 하루 쓸 돈이 가장 싼 칩보다 적을 때: 저축을 줄이는 안과 그 대가를 같이 보여 준다.
function tightBlock(tp, unit, goalName, act) {
  if (!tp.tight) return '';
  const head = `<span class="err">하루 ${won(tp.daily)}이면 ${won(tp.min)}짜리 간식도 하루 돈으로는 못 사요.</span>`;
  if (!tp.fix) return `${head}<span class="muted small">고정 지출을 줄이거나, 용돈 말고 받은 돈을 홈의 "받았어"로 더해 보세요.</span>`;
  const f = tp.fix;
  const cost = f.later === null ? '목표 날짜는 계산할 수 없어요' : f.later > 0 ? `${esc(goalName || '목표')}는 ${f.later}일 늦어져요` : '목표 날짜는 그대로예요';
  return `${head}<span>저축을 ${unit}마다 <b>${won(f.savePerCycle)}</b>로 줄이면 하루 <b>${won(f.daily)}</b> · ${cost}</span>
    ${f.enough ? '' : '<span class="muted small">저축을 0원으로 해도 빠듯해요. 받은 돈은 홈의 "받았어"로 더할 수 있어요.</span>'}
    <button class="btn leaf" data-act="${act}" data-v="${f.savePerCycle}" style="height:40px;font-size:14px;justify-self:start">이렇게 바꾸기</button>`;
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
  box.innerHTML = (before === after ? '<span class="muted">하루 한도는 그대로예요.</span>' : `<span>저장하면 오늘 하루 한도 <span class="arrow num">${won(before)} → ${won(after)}</span></span>`)
    + tightBlock(tightPlan(next, goalProgress(state).saved), next.cycle === 'monthly' ? '달' : '주', next.goalName, 'set-apply-save');
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
        <p class="slogan">살까 말까, 돈구리에게 3초.</p>
        <p class="muted" style="margin:0 0 10px">나는 돈구리야. 사고 싶은 게 생기면 나한테 물어봐. 사면 뭐가 달라지는지 바로 보여 줄게. 결정은 네가 해!</p>
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
    body = `<div><h1>무엇을 위해 모을까?</h1><p class="lead">고민될 때 "사면 목표가 며칠 늦어지는지" 보여 줄게요.</p></div>
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
        <span class="muted">이번 ${unit} 자유롭게 쓸 돈</span>
        <span class="big num">${won(st.spendable)}</span>
        <p class="muted" style="margin:0">${unit}마다 ${won(d.allowance)}에서 고정 지출 ${won(d.fixed)}과<br>저축 ${won(d.savePerCycle)}을 먼저 뺐어요.<br>사고 싶은 게 생기면 <b>"살까 말까?"</b>를 눌러 줘.<br>이 돈으로 3초 만에 따져 줄게.</p>
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
  if (document.activeElement !== saveEl && !d.saveTouched && amt > 0 && d.months) {
    const suggest = Math.ceil(amt / cyclesFor(d.months, d.cycle) / 100) * 100;
    saveEl.value = suggest;
  }
  const savePer = numIn('onbSave');
  const money = d.allowance - d.fixed - savePer;
  const unit = d.cycle === 'monthly' ? '달' : '주';
  const days = d.cycle === 'monthly' ? 30 : 7;
  if (money < 0) box.innerHTML = `<span class="err">저축이 쓸 수 있는 돈보다 ${won(-money)} 많아요. 기간을 늘려 볼까요?</span>`;
  else box.innerHTML = `<span>${unit}마다 <b>${won(savePer)}</b> 저축하면 하루 약 <span class="arrow num">${won(Math.floor(money / days))}</span>씩 쓸 수 있어요.</span>`
    + tightBlock(tightPlan({ ...d, savePerCycle: savePer, goalAmount: amt, goalName: document.getElementById('onbGoal')?.value }, 0), unit, document.getElementById('onbGoal')?.value, 'onb-apply-save');
}

// ───────────────────────── 렌더 ─────────────────────────
function sheetHtml() {
  const s = view.sheet;
  if (!s) return '';
  const inner = {
    record: recordSheet, income: incomeSheet, worry: worrySheet, judge: judgeSheet, buy: buySheet, settings: settingsSheet,
    retry: () => `<div class="grabber"></div><div class="row"><h3>오답 다시 풀기</h3><button class="icon-btn" data-act="close" aria-label="닫기">${ICON.close}</button></div>${questionBlock(s.id, s.answered, 'repick')}`,
    confirm: () => `<div class="grabber"></div><h3>${s.title}</h3><p class="muted" style="margin:0">${s.body}</p><div class="btn-row"><button class="btn ghost" data-act="close">취소</button><button class="btn ${s.danger ? 'danger' : 'primary'}" data-act="confirm-ok">${s.ok}</button></div>`,
  }[s.type]();
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
    const body = { home: homeView, log: logView, quiz: quizView, shop: shopView }[view.tab]();
    phone.innerHTML = `${topbar()}<main class="main" id="main">${body}</main>${tabbar()}${sheetHtml()}`;
    const m = phone.querySelector('.main');
    if (!view.resetScroll) m.scrollTop = scroll;
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

// 누른 버튼 자리에서 은행나무로 은행잎이 날아간다(시트가 닫힌 뒤라 위치를 미리 받아 둔다).
function flyToTree(rect, count = 9) {
  const tree = document.getElementById('tree');
  if (rect && tree) {
    const ghost = document.createElement('div');
    Object.assign(ghost.style, { position: 'fixed', left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    document.body.appendChild(ghost);
    leafBurst(phone, ghost, tree, count);
    ghost.remove();
  }
  setTimeout(() => leafFall(document.getElementById('leafFall'), 10), 500);
}

// 고른 결과를 반영하고 홈으로 돌아가 결과를 보여 준다.
function afterChoice(w, rect, stageBefore) {
  view.sheet = null; view.tab = 'home'; view.resetScroll = true;
  persist(); render();
  const st = dayStatus(state, today);
  const fromHold = w.choice === 'hold';
  if (w.outcome === 'buy') {
    const ok = isFood(w.cat) ? '맛있게 먹어!' : '잘 써!';
    toast(phone, `${fromHold ? '하루 고민했으니 진짜 필요한 거야. ' : ''}${ok} · 이번 ${unitOf()} ${won(Math.max(0, st.cycleLeft))} 남았어요`);
    return;
  }
  if (!w.outcome) { toast(phone, `좋아, 내일 "${esc(w.name)}" 다시 물어볼게`); return; }
  flyToTree(rect);
  toast(phone, `${leaf()} ${fromHold ? '하루 기다리니까 안 사도 됐지? ' : ''}${w.kept ? `지킨 ${won(w.kept)}` : '참았어요'}${w.leaves ? ` · 은행잎 +${w.leaves}` : ''}`);
  if (w.leaves) setTimeout(bumpLeaves, 700);
  const t = treeOf(state, today);
  if (t.stage > stageBefore) setTimeout(() => {
    const el = document.getElementById('tree');
    if (el) { el.innerHTML = treeSvg(t.stage, 132); el.animate?.([{ transform: 'scale(.85)' }, { transform: 'scale(1.06)' }, { transform: 'scale(1)' }], { duration: 600 }); }
    toast(phone, `돈구리의 은행나무가 ${ro(TREE_STAGES[t.stage])} 자랐어요!`, 3200);
  }, 1300);
}

let lineSeq = 0;
function openJudge(item) {
  const id = ++lineSeq;
  open({ type: 'judge', item, id });
  if (!state.coachKey) { view.sheet.ai = { text: '', source: 'rule' }; return; }
  askLine({ apiKey: state.coachKey, card: judge(state, today, item) }).then((ai) => {
    if (view.sheet?.type === 'judge' && view.sheet.id === id) { view.sheet.ai = ai; render(); }
  });
}

const ACT = {
  tab: (el) => { view.tab = el.dataset.tab; view.sheet = null; view.resetScroll = true; render(); },
  'open-settings': () => open({ type: 'settings' }),
  'open-record': () => open({ type: 'record', amount: '', cat: 'friends' }),
  'open-worry': () => open({ type: 'worry' }),
  'open-income': () => open({ type: 'income', amount: '', memo: '세뱃돈' }),
  memo: (el) => { view.sheet.memo = el.dataset.v; render(); },
  'save-income': () => {
    const { amount, memo } = view.sheet;
    const before = dayStatus(state, today).limit;
    receive(state, today, Number(amount), memo === '기타' ? '' : memo);
    persist(); view.sheet = null; render();
    const st = dayStatus(state, today);
    toast(phone, `${won(Number(amount))} 받았어요 · 남은 잔액 ${won(Math.max(0, st.cycleLeft))}${st.limit !== before ? ` · 오늘 ${won(st.limit)}` : ''}`);
  },
  close, scrim: (el, e) => { if (e.target === el) close(); },
  key: (el) => {
    const s = view.sheet; const k = el.dataset.k;
    if (k === 'del') s.amount = s.amount.slice(0, -1);
    else if (s.amount.length < 7 && !(s.amount === '' && (k === '0' || k === '00'))) s.amount += k;
    render();
  },
  cat: (el) => { view.sheet.cat = el.dataset.cat; render(); },
  'save-record': () => {
    const { amount, cat } = view.sheet;
    if (!canSpend(state, today, Number(amount))) return;
    record(state, today, Number(amount), cat);
    persist(); view.sheet = null; render();
    const st = dayStatus(state, today);
    toast(phone, `${won(Number(amount))} 기록했어요 · 오늘 ${st.left >= 0 ? `${won(st.left)} 남았어요` : `${won(-st.left)} 넘었어요`}`);
  },

  'worry-chip': (el) => {
    const c = chipList(state.chipPrefs).find((x) => x.name === el.dataset.name);
    openJudge({ name: c.name, amount: c.amount, cat: c.cat });
  },
  'worry-custom': () => open({ type: 'worry', custom: true, name: '', amount: '', cat: 'etc' }),
  'worry-go': () => {
    const s = view.sheet;
    openJudge({ name: (s.name || '').trim() || '사고 싶은 것', amount: Number(s.amount), cat: s.cat || 'etc' });
  },
  'worry-edit': () => { const { item } = view.sheet; open({ type: 'worry', custom: true, editing: true, name: item.name, amount: String(item.amount), cat: item.cat }); },
  choose: (el) => {
    const rect = el.getBoundingClientRect();
    const stageBefore = treeOf(state, today).stage;
    const w = worry(state, today, view.sheet.item, el.dataset.c);
    if (w) afterChoice(w, rect, stageBefore);
  },
  hold: (el) => {
    const rect = el.getBoundingClientRect();
    const stageBefore = treeOf(state, today).stage;
    const w = resolveHold(state, today, el.dataset.id, el.dataset.o);
    if (w) afterChoice(w, rect, stageBefore);
  },

  'ask-delete': (el) => {
    const e = state.entries.find((x) => x.id === el.dataset.id);
    if (!canRemove(state, today, e.id)) return toast(phone, '받은 돈을 이미 써서 지우면 잔액이 마이너스가 돼요');
    confirm('이 기록을 지울까요?', `${won(e.amount)} ${{ save: '저축', income: '받은 돈', spend: '지출' }[e.type]} 기록을 지우면 한도가 다시 계산돼요.`, '지우기', () => { removeEntry(state, e.id); persist(); toast(phone, '기록을 지웠어요'); }, true);
  },
  'confirm-ok': () => { const run = view.sheet.run; view.sheet = null; run(); render(); },

  'quiz-mode': (el) => { view.tab = 'quiz'; view.quizMode = el.dataset.m; view.reveal = null; render(); },
  pick: (el) => {
    const id = Number(el.dataset.q), i = Number(el.dataset.i);
    if (state.quiz.answered[id]) return;
    const correct = QUIZ[id].answer === i;
    state.quiz.answered[id] = { pick: i, correct };
    if (!correct && !state.wrong.includes(id)) state.wrong.push(id);
    view.reveal = id; persist(); render();
  },
  'next-q': () => { view.reveal = null; render(); },
  retry: (el) => open({ type: 'retry', id: Number(el.dataset.q), answered: null }),
  repick: (el) => {
    const id = Number(el.dataset.q), i = Number(el.dataset.i);
    const correct = QUIZ[id].answer === i;
    view.sheet.answered = { pick: i, correct };
    if (correct) { state.wrong = state.wrong.filter((x) => x !== id); persist(); toast(phone, '이제 확실히 알았어요!', 1600); }
    render();
  },

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
    if (next.savePerCycle !== old.savePerCycle) state.autoSaved = Math.max(0, state.autoSaved + next.savePerCycle - old.savePerCycle);
    state.settings = next;
    persist(); close(); toast(phone, '예산을 저장했어요');
  },
  'save-key': () => { state.coachKey = document.getElementById('setKey').value.trim(); persist(); toast(phone, state.coachKey ? 'Claude 키를 저장했어요' : '키를 지웠어요. 규칙으로 만든 한마디로 바뀌어요'); },
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
    view.reveal = null; view.sheet = null; view.tab = 'home'; view.resetScroll = true;
    startOfDay(true); render();
    toast(phone, `${dateLabel(today)}로 넘어갔어요`);
  },
  'ask-reset': () => confirm('처음부터 다시 할까요?', '기록, 고민, 은행잎, 상점 물건이 모두 지워져요. 되돌릴 수 없어요.', '모두 지우기', () => {
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
    d.saveTouched = false;
    render();
  },
  'onb-apply-save': (el) => {
    const d = view.onb.draft;
    d.savePerCycle = Number(el.dataset.v); d.saveTouched = true;
    document.getElementById('onbSave').value = el.dataset.v;
    updateOnbPreview();
  },
  'set-apply-save': (el) => {
    document.getElementById('setSave').value = el.dataset.v;
    updateSettingsPreview();
  },
  'onb-finish': () => {
    const d = view.onb.draft;
    setupBudget(state, { cycle: d.cycle, payday: d.payday, allowance: d.allowance, fixed: d.fixed, savePerCycle: d.savePerCycle, goalName: d.goalName, goalAmount: d.goalAmount }, today);
    state.quiz = { date: today, answered: {} };
    view.onb = null; view.resetScroll = true; persist(); render();
    toast(phone, `${won(d.savePerCycle)}을 먼저 저축통에 넣었어요`);
  },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = ACT[el.dataset.act];
  if (fn) fn(el, e);
});
document.addEventListener('input', (e) => {
  if (e.target.id === 'onbSave' && view.onb) view.onb.draft.saveTouched = true;
  if (['onbGoalAmt', 'onbSave'].includes(e.target.id)) updateOnbPreview();
  if (e.target.id?.startsWith('set') && e.target.id !== 'setKey') updateSettingsPreview();
  if (e.target.id === 'worryName' && view.sheet) view.sheet.name = e.target.value;
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && view.sheet) close();
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && todayOf(state) !== today) { startOfDay(true); render(); }
});

startOfDay(true);
render();
