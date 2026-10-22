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
