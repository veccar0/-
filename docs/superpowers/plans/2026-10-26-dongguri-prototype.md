# 돈구리 프로토타입 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 빌드 없는 모바일 웹앱으로 돈구리 Must 7개 기능을 동작하게 만든다.

**Architecture:** `app/`의 ES 모듈. 돈 계산·보상·퀴즈 로테이션은 `budget.js`의 순수 함수로 두고 Node 테스트로 검증한다. 화면은 `app.js`가 상태를 받아 다시 그리는 단순 렌더 루프다.

**Tech Stack:** HTML, CSS, 바닐라 JS(ES2022 모듈), Node 20+ `node:test`, Playwright(스크린샷 확인), `@anthropic-ai/sdk@0.133.0`(jsDelivr ESM).

**Spec:** `docs/superpowers/specs/2026-10-26-dongguri-prototype-design.md`

## Global Constraints

- 색: 바탕 `#F2F4F7`, 카드 `#FFFFFF`, 글자 `#191F28`, 보조 `#6B7684`, 파랑 `#2F6FED`, 개성1 `#F6CA51`(위 글자 `#2A1A08`), 개성2 `#2BEED4`(글자 `#16776A`).
- 보상 단위 "잎". 금액은 정수 원, 표시 `toLocaleString('ko-KR')`+"원".
- 날짜는 기기 로컬 날짜 문자열 `YYYY-MM-DD`(UTC 변환 금지).
- 모든 문구는 허용형("써도 괜찮아요"), 금지형 금지.
- 모델 `claude-opus-5-5`, effort `low`, `fallbacks: "default"` + 베타 `server-side-fallback-2026-07-01`.

## Review Focus

1. 월 주기에서 받는 날이 29~31일인 달 → 받는 날은 1~28로 제한, 주기 계산이 어긋나지 않아야 함.
2. 지출이 주기 쓸 돈을 넘은 상태 → 한도 0원, 음수 표시 없음.
3. 하루 넘기기를 여러 번 눌러 주기가 바뀜 → 새 주기에서 저축 목표가 다시 저축통에 들어감(중복 없이 주기당 1회).
4. localStorage 차단 → 앱이 메모리로 계속 동작.
5. 코치 호출 실패(키 없음·네트워크·거절) → 규칙 기반 답변으로 대체.

---

### Task 1: 계산 모듈

**Files:** Create `app/js/budget.js`, Test `tests/budget.test.mjs`

**Interfaces — Produces:**
- `ymd(date: Date) -> string`, `addDays(ymd, n) -> string`, `diffDays(a, b) -> number`
- `cycleRange(settings, today) -> {start, end, days}` (settings: `{cycle:'weekly'|'monthly', payday:number, allowance, fixed, savePerCycle}`)
- `dayStatus(state, today) -> {limit, spentToday, savedToday, left, baseLimit, bonus, cycle, spendable, daysLeft}`
- `goalProgress(state) -> {saved, amount, ratio, remaining}`
- `streak(state, today) -> number`, `level(streak) -> number`
- `rewardFor(state, action, today) -> number` (action: `'quiz'|'retry'|'record'|'save'|'nospend'`) 
- `quizIndexes(today, total=30, perDay=5) -> number[]`

- [ ] Step 1: 테스트 작성 — 주 주기(월요일 payday=1) 2026-11-04 → start 11-02, end 11-08, days 7; 월 주기 payday 25, today 11-03 → start 10-25, end 11-24; 시연 값(30000/10000/15000)에서 첫날 한도 714, 월 3000 지출 후 화요일 한도 (5000−3000)/6=333; 지출이 5000 초과 시 limit 0; 추가 저축 2000이 다음날 한도를 줄임; 스트릭·레벨(스트릭 5 → Lv.2); 기록 보상 하루 5 상한, 100원 미만 0; 저축 보상 하루 1회; 퀴즈 로테이션 6일 주기에 겹침 없음.
- [ ] Step 2: `node --test tests/` 실패 확인
- [ ] Step 3: 구현
- [ ] Step 4: 통과 확인
- [ ] Step 5: 커밋

### Task 2: 상태 저장·시연 데이터

**Files:** Create `app/js/store.js`; Test `tests/store.test.mjs`

**Interfaces — Consumes:** Task 1. **Produces:** `load() -> state`, `save(state)`, `today(state) -> ymd`(devOffset 반영), `newDay(state) -> {state, events}`(무지출 보상·주기 저축 반영, 처리한 날짜 기록), `demoState(realToday) -> state`, `blankState() -> state`, `addEntry(state, entry)`, `removeEntry(state, id)`.

- [ ] Step 1: 테스트 — 저장소 없는 환경에서 load가 빈 상태 반환; demoState 은행잎 42·스트릭 5; newDay 두 번 호출해도 무지출 보상 1회; 주기 바뀌면 savePerCycle이 저축통에 1회만 더해짐.
- [ ] Step 2~4: 실패 확인 → 구현 → 통과
- [ ] Step 5: 커밋

### Task 3: 데이터(퀴즈 30문항, 상점, 캐릭터 그림)

**Files:** Create `app/js/quiz-data.js`, `app/js/shop-data.js`, `app/assets/char/*.png`(시트에서 잘라 냄)

- 퀴즈: `{id, area, q, choices[3], answer, explain}` × 30, 7개 영역(예산·저축, 이자·금융상품, 신용·카드, 소비 판단, 금융 사기, 노동·세금, 투자 기초). 매년 바뀌는 수치는 넣지 않는다.
- 상점: 액세서리 4(은행잎 20, 노리개 45, 거울 70, 갓 120), 한복 4(산책 30, 수련 60, 축제 90, 학자 150).
- [ ] Step 1: 퀴즈 데이터 무결성 테스트(30개, answer 0~2, 영역 7개 모두) 추가 → 통과 → 커밋

### Task 4: 앱 화면

**Files:** Create `app/index.html`, `app/css/app.css`, `app/js/ui.js`, `app/js/app.js`

- 화면: 온보딩 4단계, 홈, 지출 기록 시트, 저축 시트, 퀴즈·오답 노트, 상점, 설정. 넓은 화면에서는 폰 프레임 + 옆에 시연 안내.
- [ ] Step 1: 구현
- [ ] Step 2: Playwright로 390×844 스크린샷: 온보딩 → 홈 → 기록 → 저축 → 퀴즈 → 상점, 콘솔 오류 0
- [ ] Step 3: 커밋

### Task 5: AI 코치

**Files:** Create `app/js/coach.js`; Test `tests/coach.test.mjs`

**Interfaces — Produces:** `planWeek(status) -> [{date, label, amount}]`, `ruleAnswer(question, status, goal) -> {text, plan}`, `askClaude({apiKey, question, status, goal, history}) -> Promise<{text, plan, source:'claude'|'rule'}>`

- [ ] Step 1: 테스트 — planWeek 합계가 남은 쓸 돈을 넘지 않음; "떡볶이" 질문 규칙 답변에 금액 포함
- [ ] Step 2~4 → Step 5: 코치 화면 연결, 스크린샷, 커밋

### Task 6: 마무리

- [ ] GitHub Pages 워크플로(`.github/workflows/pages.yml`, `app/` 배포), README 사용법
- [ ] 전체 테스트·스크린샷 재확인(verification-before-completion), 커밋·푸시
