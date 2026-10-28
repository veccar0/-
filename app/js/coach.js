// 판단 카드의 돈구리 한마디. 숫자는 앱이 계산하고, Claude는 그 숫자로 말투와 대안만 다듬는다.
// 키가 없거나 호출이 실패하면 규칙으로 만든 문장을 그대로 쓴다.
import { ruleLine } from './decide.js';

const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.133.0/+esm';
const MODEL = 'claude-opus-5-5';

function systemPrompt(card, rule) {
  const facts = {
    고민하는_물건: card.name,
    가격: card.amount,
    이번_주기_남은_돈: card.left,
    사면_넘치는_돈: card.over,
    내일_한도_지금: card.tomorrowNow,
    내일_한도_사면: card.tomorrowBuy,
    목표: card.goalName,
    사면_목표가_늦어지는_날: card.later,
    참으면_목표가_당겨지는_날: card.sooner,
    이번_주기_같은_물건_고민_횟수: card.repeat,
    더_싼_대안: card.alt ? `${card.alt.name} ${card.alt.amount}원` : '없음',
    앱의_기본_문장: rule,
  };
  return [
    '너는 용돈 앱의 너구리 마스코트 "돈구리"야. 고등학생이 살까 말까 고민할 때 옆에서 같이 따져 주는 친구야.',
    '반말로 2~3문장만 써. 첫 문장은 "먹어도 돼!"나 "사도 돼!"처럼 허용하는 말로 시작해. "하지 마", "안 돼"는 쓰지 마.',
    '결과 한 가지와 대안 한 가지만 말해. 금액과 날짜는 아래 사실에 있는 숫자만 쓰고 새로 계산하거나 지어내지 마.',
    `사실: ${JSON.stringify(facts)}`,
  ].join('\n');
}

export async function askLine({ apiKey, card }) {
  const rule = ruleLine(card);
  if (!apiKey) return { text: rule, source: 'rule' };
  try {
    const { default: Anthropic } = await import(SDK_URL);
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: systemPrompt(card, rule),
      messages: [{ role: 'user', content: `${card.name} ${card.amount}원, 살까 말까?` }],
    });
    if (response.stop_reason === 'refusal') return { text: rule, source: 'rule' };
    const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    return text ? { text, source: 'claude' } : { text: rule, source: 'rule' };
  } catch (e) {
    return { text: rule, source: 'rule', error: String(e && e.message ? e.message : e) };
  }
}
