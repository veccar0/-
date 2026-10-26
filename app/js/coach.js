// 돈구리 코치. 계산은 앱이 하고, Claude는 그 숫자를 돈구리 말투로 설명만 한다.
// 키가 없거나 호출이 실패하면 같은 계산으로 만든 규칙 기반 답변을 돌려준다.
import { addDays, diffDays, weekday, goalProgress } from './budget.js';

const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.133.0/+esm';
const MODEL = 'claude-opus-5-5';
const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
const PRICES = [['떡볶이', 4000], ['분식', 4000], ['노래방', 4000], ['영화', 14000], ['카페', 3000], ['음료', 2000], ['과자', 1500]];

const won = (n) => `${Math.max(0, Math.round(n)).toLocaleString('ko-KR')}원`;
export const dayLabel = (d, today) => (d === today ? '오늘' : `${DAY_NAMES[weekday(d)]}요일`);

export function readQuestion(q) {
  const dayMatch = q.match(/([월화수목금토일])요일/);
  const numMatch = q.match(/(\d[\d,]*)\s*원/);
  let amount = numMatch ? Number(numMatch[1].replace(/,/g, '')) : null;
  if (amount === null) {
    const hit = PRICES.find(([word]) => q.includes(word));
    if (hit) amount = hit[1];
  }
  if (dayMatch && amount !== null) return { weekday: DAY_NAMES.indexOf(dayMatch[1]), amount, topic: 'reserve' };
  if (/목표|빨리|모으|저축/.test(q)) return { topic: 'goal' };
  return { topic: 'plan' };
}

// 오늘부터 주기 끝까지 하루별 금액. reserve가 있으면 그날 먼저 떼고 나머지를 고르게 나눈다.
export function planWeek(status, today, reserve = null) {
  const days = Array.from({ length: diffDays(today, status.cycle.end) + 1 }, (_, i) => addDays(today, i));
  const total = Math.max(0, status.cycleLeft);
  const fixed = reserve ? Math.min(reserve.amount, total) : 0;
  const others = days.filter((d) => !reserve || d !== reserve.date);
  const each = others.length ? Math.floor((total - fixed) / others.length) : 0;
  return days.map((d) => ({ date: d, label: dayLabel(d, today), amount: reserve && d === reserve.date ? fixed : each }));
}

function findDay(status, today, wd) {
  for (let d = today; d <= status.cycle.end; d = addDays(d, 1)) if (weekday(d) === wd) return d;
  return null;
}

export function ruleAnswer(question, status, today, state) {
  const ask = readQuestion(question);
  const left = Math.max(0, status.cycleLeft);
  const nDays = diffDays(today, status.cycle.end) + 1;

  if (ask.topic === 'reserve') {
    const date = findDay(status, today, ask.weekday);
    const name = `${DAY_NAMES[ask.weekday]}요일`;
    if (!date) {
      const plan = planWeek(status, today);
      return { text: `${name}은 이번 용돈 주기가 끝난 뒤야. 새 용돈을 받으면 다시 계산해 줄게! 지금은 남은 ${nDays}일 동안 하루 ${won(plan[0].amount)}씩 쓰면 돼.`, plan };
    }
    if (ask.amount <= left) {
      const plan = planWeek(status, today, { date, amount: ask.amount });
      const rest = plan.find((d) => d.date !== date);
      const restText = rest ? ` 나머지 ${nDays - 1}일은 하루 ${won(rest.amount)}씩 쓰면 딱 맞아.` : '';
      return { text: `써도 돼! 이번 주기에 남은 돈은 ${won(left)}이야. ${name}에 ${won(ask.amount)}을 쓰고${restText}`, plan };
    }
    const plan = planWeek(status, today, { date, amount: left });
    return { text: `${won(ask.amount)}은 이번 주기에 남은 ${won(left)}보다 많아. ${name}에 최대 ${won(left)}까지 쓸 수 있지만, 그러면 다른 날은 0원이야. 친구랑 나눠 내거나 다음 용돈 뒤로 미루는 방법도 있어.`, plan };
  }

  if (ask.topic === 'goal') {
    const g = goalProgress(state);
    const per = state.settings.savePerCycle;
    const unit = state.settings.cycle === 'monthly' ? '달' : '주';
    const now = per > 0 ? Math.ceil(g.remaining / per) : Infinity;
    const faster = Math.ceil(g.remaining / (per + 2000));
    const plan = planWeek(status, today);
    const nowText = Number.isFinite(now) ? `지금처럼 모으면 ${now}${unit} 뒤에` : '지금은 주기마다 모으는 돈이 없어서';
    return { text: `${state.settings.goalName}까지 ${won(g.remaining)} 남았어. ${nowText} 살 수 있어. ${unit}마다 2,000원만 더 아끼면 ${faster}${unit}로 줄어들어! 저녁에 남은 돈을 "저축할게요"로 옮겨 봐.`, plan };
  }

  const plan = planWeek(status, today);
  const lines = plan.map((d) => `${d.label} ${won(d.amount)}`).join(', ');
  return { text: `이번 주기에 남은 돈은 ${won(left)}이고 ${nDays}일 남았어. ${lines}로 나눠 쓰면 돼. 하루 덜 쓰면 그만큼 다음 날로 넘어가!`, plan };
}

function systemPrompt(status, today, state, rule) {
  const g = goalProgress(state);
  const facts = {
    오늘: `${today} (${DAY_NAMES[weekday(today)]}요일)`,
    용돈_주기_끝: status.cycle.end,
    이번_주기_남은_돈: status.cycleLeft,
    오늘_한도: status.limit,
    오늘_남은_돈: status.left,
    목표: state.settings.goalName,
    목표_금액: g.amount,
    모은_돈: g.saved,
    앱이_계산한_계획: rule.plan.map((d) => `${d.label} ${d.amount}원`).join(', '),
    앱의_기본_답: rule.text,
  };
  return [
    '너는 "돈구리"야. 은행나무 숲을 지키는 너구리 영혼이고, 용돈을 관리하는 고등학생의 친구 같은 코치야.',
    '반말로, 따뜻하고 짧게(4문장 이하) 답해. 금지하거나 혼내지 말고, 선택하면 숫자가 어떻게 바뀌는지 보여 줘.',
    '금액과 날짜는 아래 사실과 "앱이 계산한 계획"에 있는 숫자만 써. 새 숫자를 계산하거나 지어내지 마.',
    '돈 관리와 상관없는 질문이면 한 문장으로 답하고 용돈 이야기로 부드럽게 돌아와.',
    `사실: ${JSON.stringify(facts)}`,
  ].join('\n');
}

export async function askClaude({ apiKey, question, status, today, state, history = [] }) {
  const rule = ruleAnswer(question, status, today, state);
  if (!apiKey) return { ...rule, source: 'rule' };
  try {
    const { default: Anthropic } = await import(SDK_URL);
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: systemPrompt(status, today, state, rule),
      messages: [...history.slice(-6), { role: 'user', content: question }],
    });
    if (response.stop_reason === 'refusal') return { ...rule, source: 'rule' };
    const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    return text ? { text, plan: rule.plan, source: 'claude' } : { ...rule, source: 'rule' };
  } catch (e) {
    return { ...rule, source: 'rule', error: String(e && e.message ? e.message : e) };
  }
}
