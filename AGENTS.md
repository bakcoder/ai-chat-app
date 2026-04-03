# AI Chat App AGENTS

## Project Context & Operations

- 비즈니스 목표: Next.js 기반의 간단한 AI 채팅 앱을 구현하고, Gemini 연동과 로컬 세션 저장을 중심으로 MVP를 발전시킨다.
- 현재 확인된 스택: `Next.js 16`, `React 19`, `TypeScript`, `Tailwind CSS v4`, `ESLint`, `@google/genai`
- 현재 구조: 앱 런타임은 `app/` 중심이며, 에이전트 설정과 MCP 구성은 `.cursor/` 아래에서 관리한다.
- 패키지 매니저: `pnpm`
- 환경 변수 파일: `.env.local`
- 권장 런타임: Node.js LTS

### Operational Commands

- 의존성 설치: `pnpm install`
- 개발 서버 실행: `pnpm dev`
- 프로덕션 빌드: `pnpm build`
- 프로덕션 실행: `pnpm start`
- 린트 확인: `pnpm lint`

## Golden Rules

### Immutable

- 비밀값은 `.env.local`에만 두고 커밋하지 않는다.
- Gemini API 키는 서버에서만 사용한다. 클라이언트 코드에 하드코딩하지 않는다.
- 외부 API와 MCP 호출은 명시적인 서버 경계 또는 설정 파일을 통해 관리한다.
- 존재하지 않는 스크립트, 라이브러리, 인프라를 이미 도입된 것처럼 문서화하지 않는다.
- 모든 `AGENTS.md`는 500줄 미만으로 유지한다.

### Do's

- 현재 코드 구조와 실제 의존성을 기준으로 규칙을 작성한다.
- 루트 `AGENTS.md`는 관제 문서로 유지하고, 고유한 작업 영역은 하위 `AGENTS.md`로 위임한다.
- App Router 규칙에 맞춰 서버 컴포넌트와 클라이언트 컴포넌트를 분리한다.
- Tailwind 유틸리티 중심으로 UI를 구성하고, 복잡도가 커지면 컴포넌트로 분리한다.
- 규칙과 코드가 어긋나면 문서 또는 구현을 업데이트하도록 제안한다.

### Don'ts

- `pages/api` 기반 전제를 두지 않는다. 이 저장소는 `app/` 기반이다.
- 테스트, 포맷터, 상태 관리 도구가 아직 없는데 이미 운영 중인 것처럼 적지 않는다.
- `.cursor` 설정을 앱 런타임 규칙과 혼합하지 않는다.
- 하위 폴더가 아직 없는데 불필요하게 `AGENTS.md`를 남발하지 않는다.

## Standards & References

- 코딩 기준: 간결한 TypeScript, 함수형 React 컴포넌트, 읽기 쉬운 Tailwind 클래스
- 구조 기준: 파일이 커지면 분리하고, 역할이 다른 규칙은 하위 `AGENTS.md`로 위임한다.
- Git 전략: 기본 브랜치는 `main`을 사용한다.
- 커밋 메시지: 명령형 한 줄 요약과 변경 이유를 우선한다.
- 유지보수 정책: 규칙과 실제 구현 사이에 괴리가 생기면 해당 `AGENTS.md` 또는 코드를 갱신한다.
- 참조 문서: `CLAUDE.md`는 이 파일을 참조하는 진입점으로 유지한다.

## Context Map (Action-Based Routing)

- **[App Router UI 및 페이지 작업](./app/AGENTS.md)** — `app/page.tsx`, `app/layout.tsx`, `app/globals.css` 및 향후 `app/` 하위 세그먼트 수정 시.
- **[Cursor 설정 및 스킬 작업](./.cursor/AGENTS.md)** — MCP 설정, Cursor 스킬, 에이전트 보조 설정 수정 시.

### Future Delegation

- `app/api/`가 생기면 Route Handler, 스트리밍, 서버 측 Gemini 연동 규칙을 별도 `AGENTS.md`로 분리한다.
- `components/`가 생기면 재사용 UI 규칙을 별도 `AGENTS.md`로 분리한다.
- `lib/` 또는 유사한 서버 유틸 폴더가 생기면 API 클라이언트, 어댑터, 공용 유틸 규칙을 별도 `AGENTS.md`로 분리한다.

## Output Style

- 짧고 명확한 문장을 사용한다.
- 결론과 실행 방안을 먼저 적는다.
- 표와 이모지는 사용하지 않는다.