# 돈구리

"오늘 써도 되는 돈"을 매일 한 숫자로 알려 주는 10대 용돈 관리 앱의 프로토타입이에요. 디지털새싹 문제해결 경진대회 2026 CODE 출품작(팀 0.91, 구일고등학교).

- 설계: `docs/superpowers/specs/2026-10-26-dongguri-prototype-design.md`
- 구현 계획: `docs/superpowers/plans/2026-10-26-dongguri-prototype.md`

## 실행

빌드 과정이 없어요. `app/` 폴더를 아무 정적 서버로 열면 돼요.

```bash
npm start            # http://localhost:8080
npm test             # 계산·저장·퀴즈·코치 테스트
node tests/e2e/walkthrough.mjs http://localhost:8080/ shots   # 화면 스크린샷 (Playwright 필요)
```

## 구조

| 파일 | 하는 일 |
|---|---|
| `app/js/budget.js` | 용돈 주기, 롤링 하루 한도, 목표 진행률, 연속 기록, 은행잎 보상, 퀴즈 순서 (순수 함수) |
| `app/js/store.js` | 기기 저장, 날짜 넘김 처리(무지출 보상·주기 저축·남은 돈 이월), 시연 데이터 |
| `app/js/coach.js` | 코치 답변. 계산은 앱이 하고 Claude는 설명만 함. 키가 없으면 규칙 기반 답변 |
| `app/js/app.js` | 화면과 동작 |
| `app/js/quiz-data.js`, `shop-data.js` | 퀴즈 30문항, 상점 8개(액세서리 4 + 저축 소품 4) |
| `app/assets/mascot/`, `app/assets/items/` | 너구리 돈구리 8컷과 상점 물건 8개 (Higgsfield로 생성). 그림을 바꿀 때는 같은 이름의 파일만 교체하면 돼요 |

## 시연 팁

- 첫 화면의 "시연 데이터로 둘러보기" 또는 설정의 "시연 데이터 불러오기": 김도연(주 용돈 30,000원, 목표 무선 이어폰)의 2주 기록으로 시작해요. 어느 요일에 불러와도 용돈 주기 5일째, 5일 연속 한도 지킴 상태예요.
- 설정의 "하루 넘기기": 날짜를 하루씩 넘겨 롤링 한도, 무지출 보상(은행잎 5장), 새 퀴즈를 바로 보여 줘요.
- 노트북에서 열면 폰 프레임 옆에 시연 도구가 같이 나와요.
- AI 코치: 설정에 Claude API 키를 넣으면 `claude-opus-5-5`가 답해요. 키는 그 기기에만 저장돼요. 키가 없거나 인터넷이 끊겨도 앱이 계산한 예시 답변이 나와요.

## 배포 (GitHub Pages)

`.github/workflows/pages.yml`이 테스트를 돌린 뒤 `app/` 폴더를 배포해요. 처음 한 번은 저장소 Settings → Pages에서 Source를 "GitHub Actions"로 바꿔 주세요.

---

# Claude Code 워크스페이스 설정

이 저장소를 Claude Code로 열면(로컬 또는 클라우드 세션) `.claude/settings.json`에 등록된 플러그인이 로드됩니다.
처음 열 때 마켓플레이스 신뢰/설치 확인이 뜨면 승인하고, 설치 후 Claude Code를 재시작하세요.

| 구분 | 플러그인 / 스킬 | 출처 |
|---|---|---|
| 개발 | `superpowers@superpowers-marketplace` (계획·TDD·디버깅·코드리뷰) | obra/superpowers-marketplace |
| 개발 | `context7@context7-marketplace` (버전 정확한 라이브러리 문서) | upstash/context7 |
| 문서 | `document-skills@anthropic-agent-skills` (docx·xlsx·pptx·pdf) | anthropics/skills |
| 개발·디자인 | `example-skills@anthropic-agent-skills` (skill-creator, mcp-builder, webapp-testing, frontend-design 등) | anthropics/skills |
| 운영 | `operations@knowledge-work-plugins` (런북·프로세스 문서화·상태 보고) | anthropics/knowledge-work-plugins |
| 운영 | `.claude/skills/launch-runbook` (출시 런북, MIT) | rampstackco/claude-skills |

SOP·포스트모템·비즈니스 케이스처럼 조직마다 절차가 다른 업무는 `skill-creator`로 우리 팀 절차를 스킬로 만들어 `.claude/skills/`에 커밋하세요.
