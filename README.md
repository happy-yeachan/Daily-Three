# daily-three

큰 목표를 오늘 실행할 수 있는 마이크로 액션 3가지로 쪼개주는 AI 코치.

## 핵심 흐름

```
큰 목표  →  AI 진단 질문  →  답변 기반 데드라인  →  단계 자동 분할
                                                       ↓
                                  매일 ↳  오늘의 할 일 3개  ↳ 회고
                                  (어제 결과 + 회고 난이도 → 자동 조정)
```

## 로컬 실행

```bash
npm install
npm run setup       # Prisma client 생성 + DB push
npm run dev         # http://localhost:3000
```

## LLM 연동 (선택)

기본은 mock 응답으로 동작합니다. 실제 Claude로 동적 응답을 받으려면:

**1. 환경변수 설정**

프로젝트 루트에 `.env.local` 파일을 만들고 다음을 추가:

```
ANTHROPIC_API_KEY=sk-ant-api03-...    # console.anthropic.com 에서 발급
LLM_MODEL=claude-sonnet-4-6           # 선택, 기본값
```

`LLM_MODEL` 옵션:
- `claude-sonnet-4-6` (권장 — 성능/비용 균형)
- `claude-opus-4-7` (최고 품질, 비용 ~5배)
- `claude-haiku-4-5` (가장 저렴, 빠름)

**2. 서버 재시작**

```bash
npm run dev
```

서버 시작 시 콘솔에 `[LLM] Claude 활성화됨 (모델: ...)` 메시지가 뜹니다.

**3. 동작 방식**

- 키가 있으면 → 진단 질문/데드라인/단계/태스크가 모두 실제 Claude 호출로 동작
- 키가 없거나 호출 실패 → 자동으로 mock fallback (서비스 중단 없음)
- 모든 함수에 prompt caching 적용 → 반복 호출 시 ~90% 비용 절감

**4. 활성화 확인**

로그인 상태에서 `GET /api/ai/status` 호출:
```json
{ "enabled": true, "model": "claude-sonnet-4-6" }
```

## 기술 스택

- **Next.js 14** (App Router) + **TypeScript**
- **Prisma** + **SQLite** (로컬 dev.db)
- **Tailwind CSS**
- **JWT** (httpOnly cookie 인증)
- **@anthropic-ai/sdk** + **zod** (LLM 통합, structured outputs)

## 주요 디렉토리

```
src/
├── app/
│   ├── api/         # 인증, 목표, 태스크, AI, 인사이트 라우트
│   ├── auth/        # OTP 로그인
│   ├── dashboard/   # 메인 화면 (목표 + 단계 + 오늘의 3개)
│   ├── goals/new/   # 3단계 목표 등록 (입력 → 진단 → 데드라인)
│   └── insights/    # 통계·인사이트
└── lib/
    ├── ai-mock.ts   # mock 응답 (LLM fallback)
    ├── llm.ts       # Anthropic Claude 통합
    ├── auth.ts      # JWT 헬퍼
    └── prisma.ts    # Prisma 싱글톤
```
