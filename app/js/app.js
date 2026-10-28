// 돈구리 앱: 상태를 받아 화면을 다시 그리는 단순한 렌더 루프.
// 중심 흐름은 "살까 말까?" → 판단 카드 → 살래·참을래·내일 다시 볼래 → 은행나무.
import { addDays, diffDays, weekday, cycleRange, dayStatus, goalProgress, streak, level, quizIndexes, spendable, hasSpendDays, dayWeight, fixedPerCycle, fixedMonthly } from './budget.js';
import { load, save, blankState, todayOf, newDay, setupBudget, record, removeEntry, worry, pendingHolds, resolveHold, demoState, walletOf, canSpend, receive, canRemove } from './store.js';
import { chipList, judge, ruleLine, treeOf, weekStats, isFood, TREE_STAGES, ro, eul, tightPlan, needPerCycle, DEFAULT_SPEND, goalOptions, saveForDate, goalDays } from './decide.js';
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

// 오늘이 쓰는 날인지, 아끼는 날이면 다음 쓰는 날이 언제인지
function dayKind() {
  const s = state.settings;
  if (!hasSpendDays(s)) return '';
  if (dayWeight(s, today) === 1) return '<small class="day-kind spend">오늘은 쓰는 날</small>';
  let d = addDays(today, 1);
  while (dayWeight(s, d) !== 1) d = addDays(d, 1);
  return `<small class="day-kind">아끼는 날 · 다음 쓰는 날 ${DAY_NAMES[weekday(d)]}요일</small>`;
}

// 홈의 돈 카드: 오늘 써도 되는 돈 + 남은 잔액(이번 주기) + 저축통, 그리고 "썼어"·"받았어"
function moneyCard(st) {
  const jar = goalProgress(state).saved;
  const tp = tightPlan(state.settings, jar);
  return `<section class="card money" aria-label="내 돈">
    <div class="money-top">
      <div><span class="label">오늘 써도 되는 돈</span><b class="num ${st.left < 0 ? 'over' : ''}">${st.left < 0 ? `${won(-st.left)} 넘음` : won(st.left)}</b>${dayKind()}</div>
      <div class="bal"><span class="label">남은 잔액</span><b class="num">${won(Math.max(0, st.cycleLeft))}</b><small class="muted">이번 ${unitOf()} · ${st.daysLeft}일 남음</small>${st.cycleLeft < 0 ? `<small style="color:var(--over);font-weight:600">넘친 ${won(-st.cycleLeft)}은 주기가 끝날 때 저축통에서 빠져요</small>` : ''}</div>
    </div>
    <div class="money-sub"><span>${ICON.jar} 저축통 <b class="num">${won(jar)}</b></span><span>가진 돈 합계 <b class="num">${won(Math.max(0, walletOf(state, today)))}</b></span></div>
    ${tp.tight ? `<button class="tight-note" data-act="open-settings">${tp.custom ? `쓰는 날에 쓸 돈이 ${won(tp.need - Math.max(0, tp.money))} 모자라요` : `하루 ${won(tp.daily)}이면 빠듯해요`} · 조정 방법 보기 ›</button>` : ''}
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

// ───────────────────────── 매달 나가는 돈(고정 지출) 편집기: 온보딩 2단계와 설정에서 같이 쓴다 ─────────────────────────
const FX_NAMES = ['교통카드 충전', '휴대폰 요금', '구독료', '학원 간식비'];
const ymLabel = (ym) => `${Number(ym.slice(0, 4))}년 ${Number(ym.slice(5))}월`;
const fullDate = (d) => { const [y, m, dd] = d.split('-').map(Number); return `${y === Number(today.slice(0, 4)) ? '' : `${y}년 `}${m}월 ${dd}일`; };
function nextMonths(n = 12) {
  const out = [];
  let [y, m] = today.split('-').map(Number);
  for (let i = 0; i < n; i++) { out.push(`${y}-${String(m).padStart(2, '0')}`); m += 1; if (m > 12) { m = 1; y += 1; } }
  return out;
}
const fxList = () => (view.sheet?.type === 'settings' ? view.sheet.fixedItems : view.onb.draft.fixedItems);
const fxUi = () => (view.sheet?.type === 'settings' ? view.sheet : view.onb);

function fixedEditor(list, cycle) {
  const ui = fxUi();
  const monthly = list.reduce((t, i) => t + i.amount, 0);
  const per = fixedPerCycle({ cycle, fixedItems: list });
  const items = list.map((it, i) => `<div class="fx-item"><div><b>${esc(it.name)}</b>
      <small>한 달 ${won(it.amount)} · 매월 ${it.day}일${it.until ? ` · ${ymLabel(it.until)}까지` : ''}</small></div>
      <button class="del" data-act="fx-del" data-i="${i}" aria-label="${esc(it.name)} 지우기">지우기</button></div>`).join('');
  const total = list.length ? `<p class="fx-total">한 달 <b>${won(monthly)}</b>${cycle === 'monthly' ? '' : ` · 주마다 약 ${won(per)}씩 떼어 둬요`}</p>` : '';
  if (!ui.fxOpen) return `<div class="fx-list">${items}</div>${total}<button class="btn line block" data-act="fx-open">+ ${list.length ? '하나 더 ' : ''}추가하기</button>`;
  return `<div class="fx-list">${items}</div>${total}
    <div class="fx-form">
      <div class="chips scroll">${FX_NAMES.map((n) => `<button class="chip" data-act="fx-name" data-v="${n}">${n}</button>`).join('')}</div>
      <input class="input" id="fxName" maxlength="20" autocomplete="off" placeholder="무엇에 나가? (예: 휴대폰 요금)">
      <div class="input-won"><input class="input num" id="fxAmt" inputmode="numeric" placeholder="한 달에 얼마?"></div>
      ${ui.fxMore ? `<div class="fx-row">
        <select class="input" id="fxDay" aria-label="나가는 날">${Array.from({ length: 28 }, (_, i) => `<option value="${i + 1}">매월 ${i + 1}일</option>`).join('')}</select>
        <select class="input" id="fxUntil" aria-label="언제까지"><option value="">계속 나가요</option>${nextMonths().map((ym) => `<option value="${ym}">${ymLabel(ym)}까지</option>`).join('')}</select>
      </div>` : '<button class="btn text" data-act="fx-more" style="justify-self:start;padding:0">매월 1일 · 계속 나가요 <u>바꾸기</u></button>'}
      <div class="btn-row"><button class="btn ghost" data-act="fx-cancel">취소</button><button class="btn primary" data-act="fx-add">추가</button></div>
    </div>`;
}
function readFxForm() {
  const amount = numIn('fxAmt');
  if (!amount) return null;
  const day = document.getElementById('fxDay');
  const until = document.getElementById('fxUntil');
  return { name: document.getElementById('fxName').value.trim() || '고정 지출', amount, day: day ? Number(day.value) : 1, until: until?.value || null };
}

// ───────────────────────── 설정 ─────────────────────────
function settingsSheet() {
  const s = state.settings;
  const unit = unitOf();
  const sh = view.sheet;
  const f = (id, def) => esc(sh.form?.[id] ?? def);
  const next = readSettingsForm();
  const days = (sh.spendDays || []).slice().sort();
  const rows = [
    ['allowance', `${unit}마다 받는 용돈`, won(next.allowance), `<div class="input-won"><input class="input num" id="setAllowance" inputmode="numeric" value="${f('setAllowance', s.allowance)}"></div>`],
    ['fixed', '매달 나가는 돈', sh.fixedItems.length ? `한 달 ${won(fixedMonthly(next))}` : '없음', fixedEditor(sh.fixedItems, s.cycle)],
    ['spend', '돈 쓰는 날', days.length ? `${days.map((i) => DAY_NAMES[i]).join('·')} · ${won(next.spendAmount)}` : '매일 똑같이',
      `<div class="days7">${DAY_NAMES.map((n, i) => `<button data-act="set-day" data-v="${i}" aria-pressed="${days.includes(i)}">${n}</button>`).join('')}</div>
       <div class="field"><label for="setSpendAmt">그날 보통 쓰는 돈</label><div class="input-won"><input class="input num" id="setSpendAmt" inputmode="numeric" value="${f('setSpendAmt', s.spendAmount || DEFAULT_SPEND)}"></div></div>`],
    ['save', `${unit}마다 먼저 저축`, won(next.savePerCycle), `<div class="input-won"><input class="input num" id="setSave" inputmode="numeric" value="${f('setSave', s.savePerCycle)}"></div>`],
    ['goal', '목표', `${esc(next.goalName)} · ${won(next.goalAmount)}`,
      `<input class="input" id="setGoal" aria-label="목표 이름" value="${f('setGoal', s.goalName)}">
       <div class="input-won"><input class="input num" id="setGoalAmt" aria-label="목표 금액" inputmode="numeric" value="${f('setGoalAmt', s.goalAmount)}"></div>`],
  ];
  const row = ([key, label, value, body]) => `<div class="set-row ${sh.open === key ? 'open' : ''}">
      <button class="set-head" data-act="set-open" data-k="${key}" aria-expanded="${sh.open === key}"><span>${label}</span><b>${value}</b><i aria-hidden="true">›</i></button>
      ${sh.open === key ? `<div class="set-body">${body}</div>` : ''}</div>`;
  return `<div class="row"><h3>설정</h3><button class="icon-btn" data-act="close" aria-label="닫기">${ICON.close}</button></div>
    <section class="set-group">${rows.map(row).join('')}</section>
    <div class="preview" id="setPreview"></div>
    <button class="btn primary block" data-act="save-settings">저장하기</button>
    <section class="set-group">
      ${row(['ai', '돈구리 한마디 AI', state.coachKey ? '연결됨' : '연결 안 됨', `<p class="small muted" style="margin:0">Claude API 키를 넣으면 판단 카드의 한마디를 AI가 다듬어요. 숫자는 늘 앱이 계산하고, 키는 이 기기에만 저장돼요.</p>
        <input class="input" id="setKey" type="password" autocomplete="off" placeholder="sk-ant-..." value="${esc(state.coachKey)}">
        <button class="btn line block" data-act="save-key">키 저장</button>`])}
      ${row(['demo', '시연 도구', dateLabel(today), `<button class="btn line block" data-act="demo-load">시연 데이터 불러오기 (김도연의 2주)</button>
        <button class="btn line block" data-act="demo-next">하루 넘기기</button>
        <button class="btn danger block" data-act="ask-reset">처음부터 다시 하기</button>`])}
    </section>`;
}

// 빠듯한 계획일 때: 필요한 돈과 쓸 돈을 비교하고, 저축을 줄이는 안(그 대가)과 쓰는 날을 줄이는 안을 보여 준다.
function tightBlock(tp, unit, goalName, act) {
  if (!tp.tight) return '';
  const head = tp.custom
    ? `<span class="err">쓰는 날 ${tp.nDays}일 × ${won(tp.perDay)} = ${unit}에 ${won(tp.need)}이 필요한데, 쓸 돈은 ${won(Math.max(0, tp.money))}이에요.</span>`
    : `<span class="err">하루 ${won(tp.daily)}이면 ${won(tp.min)}짜리 간식도 하루 돈으로는 못 사요.</span>`;
  const fewer = tp.fewerDays ? `<span class="muted small">또는 쓰는 날을 ${tp.fewerDays}일로 줄이면 저축은 그대로예요.</span>` : '';
  if (!tp.fix) return `${head}${fewer}<span class="muted small">고정 지출을 줄이거나, 용돈 말고 받은 돈을 홈의 "받았어"로 더해 보세요.</span>`;
  const f = tp.fix;
  const cost = f.later === null ? '목표 날짜는 계산할 수 없어요' : f.later > 0 ? `${esc(goalName || '목표')}는 ${f.later}일 늦어져요` : '목표 날짜는 그대로예요';
  const gain = tp.custom ? '쓰는 날 돈이 맞아요' : `하루 <b>${won(f.daily)}</b>`;
  return `${head}<span>저축을 ${unit}마다 <b>${won(f.savePerCycle)}</b>로 줄이면 ${gain} · ${cost}</span>${fewer}
    ${f.enough ? '' : '<span class="muted small">저축을 0원으로 해도 빠듯해요. 받은 돈은 홈의 "받았어"로 더할 수 있어요.</span>'}
    <button class="btn leaf" data-act="${act}" data-v="${f.savePerCycle}" style="height:40px;font-size:14px;justify-self:start">이렇게 바꾸기</button>`;
}

function readSettingsForm() {
  const s = state.settings;
  const def = { setAllowance: s.allowance, setSave: s.savePerCycle, setGoal: s.goalName, setGoalAmt: s.goalAmount, setSpendAmt: s.spendAmount || DEFAULT_SPEND };
  const raw = (id) => view.sheet.form?.[id] ?? def[id];
  const n = (id) => Math.max(0, Math.floor(Number(String(raw(id)).replace(/[^\d]/g, '')) || 0));
  const days = (view.sheet?.spendDays || []).slice().sort();
  const { fixed, ...rest } = state.settings;
  return { ...rest, fixedItems: view.sheet.fixedItems.map((x) => ({ ...x })), allowance: n('setAllowance'), savePerCycle: n('setSave'), goalName: String(raw('setGoal')).trim() || '목표', goalAmount: n('setGoalAmt'), spendDays: days.length ? days : null, spendAmount: n('setSpendAmt') || DEFAULT_SPEND };
}

function updateSettingsPreview() {
  const box = document.getElementById('setPreview');
  if (!box) return;
  const next = readSettingsForm();
  const money = spendable(next);
  if (money < 0) { box.innerHTML = `<span class="err">용돈보다 고정 지출과 저축이 ${won(-money)} 많아요.</span>`; return; }
  const before = dayStatus(state, today).limit;
  const after = dayStatus({ ...state, settings: next }, today).limit;
  const days = goalDays(Math.max(0, next.goalAmount - goalProgress(state).saved), next, next.cycle === 'monthly' ? 30 : 7);
  const when = days === null ? '<span class="muted small">저축액이 0원이라 목표 날짜를 계산할 수 없어요.</span>' : `<span class="muted small">이대로면 ${esc(next.goalName)}까지 ${days}일(${fullDate(addDays(today, days))})</span>`;
  box.innerHTML = (before === after ? '<span class="muted">하루 한도는 그대로예요.</span>' : `<span>저장하면 오늘 하루 한도 <span class="arrow num">${won(before)} → ${won(after)}</span></span>`) + when
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
  const steps = `<div class="steps">${[1, 2, 3, 4, 5].map((n) => `<i class="${n <= o.step ? 'on' : ''}"></i>`).join('')}</div>`;
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
    body = `<div><h1>매달 꼭 나가는 돈이 있어?</h1><p class="lead">교통카드 충전, 휴대폰 요금처럼 달마다 나가는 돈이요. 얼마, 며칠에, 언제까지 나가는지 적어 두면 미리 떼어 두고 계산해요.</p></div>
      ${fixedEditor(d.fixedItems, d.cycle)}
      <p class="err" id="onbErr"></p>`;
    foot = `<div class="btn-row"><button class="btn ghost" data-act="onb-skip">없어요</button><button class="btn primary" data-act="onb-next">다음</button></div>`;
  } else if (o.step === 3) {
    const custom = !SPEND_PRESETS.includes(d.spendAmount) || o.spendCustom;
    body = `<div><h1>주로 언제 돈을 써?</h1><p class="lead">고른 요일에 돈을 더 많이 나눠 줄게요. 안 쓰는 날에도 조금은 남겨 둬요.</p></div>
      <div class="field"><label>돈 쓰는 요일 (여러 개 고르기)</label><div class="days7">${DAY_NAMES.map((nm, i) => `<button data-act="onb-spend-day" data-v="${i}" aria-pressed="${(d.spendDays || []).includes(i)}">${nm}</button>`).join('')}</div></div>
      <div class="field"><label>그날은 보통 얼마쯤 써?</label><div class="chips">${SPEND_PRESETS.map((v) => `<button class="chip" data-act="onb-spend-amt" data-v="${v}" aria-pressed="${!custom && d.spendAmount === v}">${comma(v)}원</button>`).join('')}
        <button class="chip" data-act="onb-spend-custom" aria-pressed="${custom}">직접 입력</button></div>
        ${custom ? `<div class="input-won"><input class="input num" id="onbSpendAmt" inputmode="numeric" placeholder="예: 2,500" value="${d.spendAmount || ''}"></div>` : ''}</div>
      <div class="preview" id="onbSpendSum">${spendSummary(d)}</div>`;
    foot = `<div class="btn-row"><button class="btn ghost" data-act="onb-spend-skip">잘 모르겠어</button><button class="btn primary" data-act="onb-next">다음</button></div>`;
  } else if (o.step === 4) {
    body = `<div><h1>무엇을 위해 모을까?</h1><p class="lead">금액을 넣으면 지금 용돈으로 언제쯤 살 수 있는지 날짜로 추천해 줄게요.</p></div>
      <div class="field"><label for="onbGoal">목표 이름</label><input class="input" id="onbGoal" placeholder="무선 이어폰" value="${esc(d.goalName || '')}"></div>
      <div class="field"><label for="onbGoalAmt">목표 금액</label><div class="input-won"><input class="input num" id="onbGoalAmt" inputmode="numeric" placeholder="200,000" value="${d.goalAmount || ''}"></div></div>
      <div id="onbPlans" style="display:grid;gap:14px"></div>
      <p class="err" id="onbErr"></p>`;
    foot = '<button class="btn primary block" data-act="onb-next">다음</button>';
  } else {
    const st = dayStatus({ ...blankState(), settings: d, startDate: today, autoSaved: d.savePerCycle }, today);
    body = `<div class="result-big">
        ${mascot('joy', 160)}
        <span class="muted">이번 ${unit} 자유롭게 쓸 돈</span>
        <span class="big num">${won(st.spendable)}</span>
        <p class="muted" style="margin:0">${unit}마다 ${won(d.allowance)}에서 고정 지출 ${won(fixedPerCycle(d))}${d.cycle === 'monthly' || !d.fixedItems.length ? '' : `(한 달 ${won(fixedMonthly(d))})`}과<br>저축 ${won(d.savePerCycle)}을 먼저 뺐어요.<br>${d.goalDate ? `<b>${fullDate(d.goalDate)}</b>에 ${esc(eul(d.goalName))} 살 수 있어요.<br>` : ''}${hasSpendDays(d) ? `쓰는 날(${d.spendDays.slice().sort().map((i) => DAY_NAMES[i]).join('·')})에 더 많이 나눠 줄게.<br>` : ''}사고 싶은 게 생기면 <b>"살까 말까?"</b>를 눌러 줘.<br>이 돈으로 3초 만에 따져 줄게.</p>
      </div>`;
    foot = '<button class="btn primary block" data-act="onb-finish">돈구리 시작하기</button>';
  }
  return `<div class="onb"><div style="display:grid;gap:14px">${o.step > 0 ? `<div class="row">${back}<span class="small muted">${o.step} / 5</span><span style="width:36px"></span></div>` : ''}${steps}</div>
    <div class="onb-body">${body}</div><div>${foot}</div></div>`;
}

// 온보딩 3단계: 그날 쓰는 돈 버튼과, 쓰는 날 × 그날 쓰는 돈 요약
const SPEND_PRESETS = [1000, 2000, 3000, 5000];
function spendSummary(d) {
  const unit = d.cycle === 'monthly' ? '달' : '주';
  const n = needPerCycle(d);
  const free = d.allowance - fixedPerCycle(d);
  if (!n.custom) return '<span class="muted">요일을 고르지 않으면 매일 똑같이 나눠요.</span>';
  if (n.need <= free) return `<span>쓰는 날 ${n.nDays}일 × ${won(n.perDay)} = ${unit}에 약 <b>${won(n.need)}</b>. 나머지 <b>${won(free - n.need)}</b>까지 저축할 수 있어요.</span>`;
  return `<span class="err">쓰는 날 ${n.nDays}일 × ${won(n.perDay)} = ${won(n.need)}인데, 고정 지출을 빼면 ${won(free)}이라 ${won(n.need - free)} 모자라요. 요일이나 금액을 줄여 볼까요?</span>`;
}

const numIn = (id) => { const el = document.getElementById(id); return el ? Math.floor(Number(String(el.value).replace(/[^\d]/g, '')) || 0) : 0; };

// 목표 금액을 넣으면 빠르게 / 적당히 / 여유 있게 세 기간을 실제 날짜로 추천하고, 날짜를 직접 정할 수도 있다.
function updateOnbPreview() {
  const box = document.getElementById('onbPlans');
  if (!box) return;
  const d = view.onb.draft;
  d.goalName = document.getElementById('onbGoal').value.trim();
  d.goalAmount = numIn('onbGoalAmt');
  const unit = d.cycle === 'monthly' ? '달' : '주';
  if (d.goalAmount < 1000) { box.innerHTML = '<p class="muted small" style="margin:0">목표 금액을 넣으면 언제쯤 살 수 있는지 추천해 줄게요.</p>'; return; }
  const { room, options } = goalOptions(d, today, 0);
  if (!options.length) {
    d.savePerCycle = 0; d.goalDate = null;
    box.innerHTML = `<div class="preview"><span class="err">고정 지출과 쓰는 날 돈을 빼면 저축할 돈이 남지 않아요.</span><span class="muted small">뒤로 가서 쓰는 날이나 그날 쓰는 돈을 줄이거나, 저축 없이 시작해서 받은 돈이 생기면 모아도 돼요.</span></div>`;
    return;
  }
  if (d.plan !== 'custom' && !options.some((o) => o.key === d.plan)) d.plan = options[Math.min(1, options.length - 1)].key;
  let chosen = options.find((o) => o.key === d.plan) || null;
  let note = '';
  if (d.plan === 'custom' && d.customDate) {
    const r = saveForDate(d, today, d.customDate, 0);
    chosen = r.ok ? { savePerCycle: r.savePerCycle, date: d.customDate, times: r.times } : null;
    if (!r.ok) note = `<span class="err">${fullDate(d.customDate)}까지 모으려면 ${unit}마다 ${won(r.savePerCycle)}이 필요한데, 저축할 수 있는 돈은 최대 ${won(room)}이에요. 날짜를 조금 늦춰 볼까요?</span>`;
  }
  d.savePerCycle = chosen ? chosen.savePerCycle : null;
  d.goalDate = chosen ? chosen.date : null;
  const label = d.plan === 'custom' ? '직접 정한 날짜' : `추천 · ${options.find((o) => o.key === d.plan).label}`;
  const main = chosen
    ? `<div class="goal-pick"><span class="small muted">${label}</span><b class="num">${fullDate(chosen.date)}</b><span>${unit}마다 <b>${won(chosen.savePerCycle)}</b>씩 모으면 살 수 있어요</span></div>`
    : `<div class="preview">${note}</div>`;
  const more = view.onb.planOpen ? `<div class="plans">${options.map((o) => `<button class="plan-opt" data-act="onb-plan" data-k="${o.key}" aria-pressed="${d.plan === o.key}">
      <b>${o.label}</b><span class="num">${fullDate(o.date)}</span><small>${unit}마다 ${won(o.savePerCycle)}</small></button>`).join('')}</div>
    <div class="field"><label for="onbGoalDate">날짜 직접 고르기</label><input class="input" type="date" id="onbGoalDate" min="${addDays(today, 1)}" value="${d.plan === 'custom' && d.customDate ? d.customDate : ''}"></div>
    <p class="muted small" style="margin:0">고정 지출과 쓰는 날 돈을 빼면 ${unit}마다 최대 ${won(room)}까지 저축할 수 있어요.</p>`
    : '<button class="btn text" data-act="onb-plan-more" style="justify-self:start;padding:0"><u>다른 기간 보기</u></button>';
  box.innerHTML = `${main}${more}`;
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
    if (!view.onb) view.onb = { step: 0, draft: { cycle: 'weekly', payday: weekday(today), allowance: 0, fixedItems: [], goalName: '', goalAmount: 0, plan: null, customDate: null, savePerCycle: null, goalDate: null, spendDays: [5, 6], spendAmount: DEFAULT_SPEND } };
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
  'open-settings': () => {
    const s = state.settings;
    const items = s.fixedItems || (s.fixed ? [{ name: '고정 지출', amount: Math.round((s.fixed * 52) / 12 / 100) * 100, day: 1, until: null }] : []);
    open({ type: 'settings', spendDays: [...(s.spendDays || [])], fixedItems: items.map((x) => ({ ...x })), form: {} });
  },
  'set-day': (el) => {
    const v = Number(el.dataset.v); const list = view.sheet.spendDays;
    const i = list.indexOf(v);
    if (i >= 0) list.splice(i, 1); else list.push(v);
    render();
  },
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
      const pending = o.fxOpen ? readFxForm() : null;
      if (pending) { d.fixedItems.push(pending); o.fxOpen = false; }
      if (fixedPerCycle(d) >= d.allowance) { render(); return err('매달 나가는 돈이 용돈보다 같거나 많아요.'); }
    }
    if (o.step === 4) {
      updateOnbPreview();
      if (!d.goalName) return err('목표 이름을 적어 주세요.');
      if (d.goalAmount < 1000) return err('목표 금액을 1,000원 이상으로 넣어 주세요.');
      if (d.savePerCycle === null) return err('추천 기간을 고르거나 날짜를 조금 늦춰 주세요.');
    }
    o.step += 1; render();
  },
  'onb-back': () => { view.onb.step = Math.max(0, view.onb.step - 1); render(); },
  'onb-skip': () => { view.onb.draft.fixedItems = []; view.onb.fxOpen = false; view.onb.step = 3; render(); },
  'fx-name': (el) => { const i = document.getElementById('fxName'); i.value = el.dataset.v; document.getElementById('fxAmt').focus(); },
  'fx-open': () => { fxUi().fxOpen = true; fxUi().fxMore = false; render(); document.getElementById('fxName')?.focus(); },
  'fx-more': () => {
    const keep = { name: document.getElementById('fxName').value, amt: document.getElementById('fxAmt').value };
    fxUi().fxMore = true; render();
    document.getElementById('fxName').value = keep.name; document.getElementById('fxAmt').value = keep.amt;
  },
  'fx-cancel': () => { fxUi().fxOpen = false; render(); },
  'fx-add': () => {
    const it = readFxForm();
    if (!it) { document.getElementById('fxAmt').focus(); return; }
    fxList().push(it); fxUi().fxOpen = false; render();
  },
  'fx-del': (el) => { fxList().splice(Number(el.dataset.i), 1); render(); },
  'onb-plan-more': () => { view.onb.planOpen = true; updateOnbPreview(); },
  'onb-plan': (el) => { const d = view.onb.draft; d.plan = el.dataset.k; d.customDate = null; updateOnbPreview(); },
  'onb-spend-day': (el) => {
    const d = view.onb.draft; const v = Number(el.dataset.v);
    const list = d.spendDays || [];
    d.spendDays = list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
    render();
  },
  'onb-spend-amt': (el) => { view.onb.draft.spendAmount = Number(el.dataset.v); view.onb.spendCustom = false; render(); },
  'onb-spend-custom': () => { view.onb.spendCustom = true; render(); document.getElementById('onbSpendAmt')?.focus(); },
  'onb-spend-skip': () => { view.onb.draft.spendDays = null; view.onb.step = 4; render(); },
  'onb-cycle': (el) => { const d = view.onb.draft; d.allowance = numIn('onbAllow'); d.cycle = el.dataset.v; d.payday = d.cycle === 'weekly' ? weekday(today) : Number(today.slice(8)) > 28 ? 1 : Number(today.slice(8)); render(); },
  'onb-payday': (el) => { const d = view.onb.draft; d.allowance = numIn('onbAllow'); d.payday = Number(el.dataset.v); render(); },
  'set-open': (el) => { view.sheet.open = view.sheet.open === el.dataset.k ? null : el.dataset.k; view.sheet.fxOpen = false; render(); },
  'set-apply-save': (el) => {
    view.sheet.form.setSave = el.dataset.v;
    view.sheet.open = 'save'; render();
    updateSettingsPreview();
  },
  'onb-finish': () => {
    const d = view.onb.draft;
    setupBudget(state, { cycle: d.cycle, payday: d.payday, allowance: d.allowance, fixedItems: d.fixedItems, savePerCycle: d.savePerCycle, goalName: d.goalName, goalAmount: d.goalAmount, goalDate: d.goalDate, spendDays: hasSpendDays(d) ? d.spendDays.slice().sort() : null, spendAmount: d.spendAmount || DEFAULT_SPEND }, today);
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
  if (['onbGoalAmt', 'onbGoal'].includes(e.target.id)) updateOnbPreview();
  if (e.target.id === 'onbSpendAmt' && view.onb) {
    view.onb.draft.spendAmount = numIn('onbSpendAmt') || DEFAULT_SPEND;
    document.getElementById('onbSpendSum').innerHTML = spendSummary(view.onb.draft);
  }
  if (view.sheet?.type === 'settings' && e.target.id?.startsWith('set') && e.target.id !== 'setKey') view.sheet.form[e.target.id] = e.target.value;
  if (e.target.id?.startsWith('set') && e.target.id !== 'setKey') updateSettingsPreview();
  if (e.target.id === 'worryName' && view.sheet) view.sheet.name = e.target.value;
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'onbGoalDate' && view.onb) {
    view.onb.draft.plan = 'custom'; view.onb.draft.customDate = e.target.value || null;
    updateOnbPreview();
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && view.sheet) close();
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && todayOf(state) !== today) { startOfDay(true); render(); }
});

startOfDay(true);
render();
