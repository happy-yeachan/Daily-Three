/**
 * Claude LLM 통합 — daily-three의 AI 응답을 실제 Claude API로 처리합니다.
 *
 * 작동 방식:
 *   1. process.env.ANTHROPIC_API_KEY가 있으면 → 실제 Claude 호출
 *   2. 키가 없거나 호출 실패 → mock fallback (서비스 중단 없음)
 *
 * 환경변수:
 *   ANTHROPIC_API_KEY  (필수, LLM 활성화)
 *   LLM_MODEL          (선택, 기본 'claude-sonnet-4-6')
 *
 * 모든 함수는 prompt caching을 적용해 시스템 프롬프트를 캐싱 → 반복 호출 시 ~90% 비용 절감.
 */

import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import {
  mockGenerateDiagnosisQuestions,
  mockSuggestDeadline,
  mockGenerateMilestones,
  mockGenerateTasks,
  DiagnosisQuestion,
  DiagnosisData,
  DeadlineSuggestion,
  MilestoneSuggestion,
  PreviousTaskSnapshot,
  CurrentMilestone,
  TaskGenerationResult,
} from './ai-mock'

const apiKey = process.env.ANTHROPIC_API_KEY
const MODEL = process.env.LLM_MODEL || 'claude-sonnet-4-6'

const client = apiKey ? new Anthropic({ apiKey }) : null

export const isLlmEnabled = (): boolean => client !== null
export const llmModelInfo = () => ({ enabled: isLlmEnabled(), model: MODEL })

if (!client) {
  // 서버 시작 시 한 번만 안내
  console.log(
    '\n[LLM] ANTHROPIC_API_KEY 미설정 — mock 응답 사용 중. ' +
    '실제 Claude로 전환하려면 환경변수에 키를 추가하세요.\n'
  )
} else {
  console.log(`\n[LLM] Claude 활성화됨 (모델: ${MODEL})\n`)
}

/* ──────────────────────────────────────────
   공통 헬퍼
   ────────────────────────────────────────── */

/** 프롬프트 캐싱이 적용된 system 블록 — 함수마다 고정 텍스트만 들어가야 함 */
function cachedSystem(text: string) {
  return [
    {
      type: 'text' as const,
      text,
      cache_control: { type: 'ephemeral' as const },
    },
  ]
}

/** 호출 실패 시 mock으로 fallback — 에러 로깅 + 콘솔 안내 */
async function withFallback<T>(
  label: string,
  llmCall: () => Promise<T>,
  mockCall: () => T | Promise<T>
): Promise<T> {
  if (!client) return mockCall()
  try {
    return await llmCall()
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      console.error(`[LLM] ${label} failed (${err.status}): ${err.message}`)
    } else {
      console.error(`[LLM] ${label} failed:`, err)
    }
    console.error('[LLM] mock fallback 사용')
    return mockCall()
  }
}

/* ──────────────────────────────────────────
   1) 진단 질문 생성
   ────────────────────────────────────────── */

const QuestionSchema = z.object({
  id: z.string().describe('영문 snake_case 식별자 (예: level, time, why)'),
  question: z.string().describe('사용자에게 보여줄 질문 (한국어, 자연스럽게)'),
  type: z.enum(['single', 'text']).describe('single = 객관식, text = 자유 입력'),
  options: z.array(z.string()).optional().describe('single 타입일 때 3~4개 옵션'),
  placeholder: z.string().optional().describe('text 타입일 때 입력 예시'),
})
const DiagnosisSchema = z.object({
  questions: z.array(QuestionSchema).describe('3~4개의 진단 질문'),
})

const DIAGNOSIS_SYSTEM = `당신은 사용자의 큰 목표를 분석해 적절한 진단 질문을 생성하는 코칭 전문가입니다.

목표:
- 사용자의 현재 상태를 파악해 맞춤형 행동 계획을 만들기 위한 정보 수집
- 각 질문은 후속 단계(데드라인 추천, 일일 태스크 생성)에서 실제 컨텍스트로 사용됨

질문 작성 원칙:
1. 사용자 입력 목표 텍스트의 도메인·기간·정량 목표·습관성을 분석해 맞춤 질문 생성
2. 항상 포함: 현재 수준(level), 가용 시간(time), 동기/이유(why)
3. 도메인 특화: 영어/언어, 운동/체중, 공부/시험, 프로젝트/창업, 창작, 재무 등에 맞춰 옵션 변형
4. 컨텍스트 기반 1개 추가: 명시된 기간이 있으면 외부 마감 여부, 정량 목표면 진척도, 습관 목표면 걸림돌
5. 총 3~4개 질문, 그 이상 X (사용자 부담)
6. single 타입 옵션은 3~4개로 명확하게 차별화
7. 한국어로 자연스럽고 친근한 톤

답변 형식: JSON schema에 맞춰 questions 배열 반환`

export async function generateDiagnosisQuestions(
  goalTitle: string
): Promise<DiagnosisQuestion[]> {
  return withFallback(
    'generateDiagnosisQuestions',
    async () => {
      const response = await client!.messages.parse({
        model: MODEL,
        max_tokens: 2048,
        thinking: { type: 'adaptive' },
        system: cachedSystem(DIAGNOSIS_SYSTEM),
        messages: [
          {
            role: 'user',
            content: `목표: "${goalTitle}"\n\n이 목표에 가장 적합한 진단 질문 3~4개를 생성해주세요.`,
          },
        ],
        output_config: { format: zodOutputFormat(DiagnosisSchema) },
      })
      const parsed = response.parsed_output
      if (!parsed?.questions || parsed.questions.length === 0) {
        throw new Error('빈 응답')
      }
      return parsed.questions as DiagnosisQuestion[]
    },
    () => mockGenerateDiagnosisQuestions(goalTitle)
  )
}

/* ──────────────────────────────────────────
   2) 데드라인 추천
   ────────────────────────────────────────── */

const DeadlineSchema = z.object({
  estimatedDays: z.number().int().describe('예상 소요 일수 (최소 7)'),
  recommendedDeadline: z
    .string()
    .describe('추천 데드라인 날짜 (YYYY-MM-DD 형식)'),
  reasoning: z
    .string()
    .describe('한국어로 한두 문장의 추천 이유. 진단 답변을 인용해 자연스럽게.'),
})

const DEADLINE_SYSTEM = `당신은 사용자의 큰 목표와 진단 답변을 바탕으로 현실적인 데드라인을 추천하는 코치입니다.

판단 기준:
1. 사용자가 명시한 기간이 있으면 (예: "3개월 안에") 그것을 1차 기준으로
2. 현재 수준이 초보면 +30~50% 여유, 숙련자면 -20~30% 단축
3. 가용 시간 (15분/하루 vs 2시간/하루) 차이 반영
4. 외부 마감(시험 등)이 명확하면 사용자 의도 그대로
5. 최소 7일, 최대 365일 권장

이유 작성:
- 한두 문장, 한국어, 친근한 톤
- 진단 답변의 핵심을 인용해 "왜 이 일수가 적절한지" 구체적으로 설명
- 무리 없는 페이스라는 점 안심 메시지 포함

답변 형식: JSON schema에 맞춰 estimatedDays, recommendedDeadline (오늘 기준 + estimatedDays일), reasoning 반환`

function todayPlusDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export async function suggestDeadline(
  goalTitle: string,
  diagnosis: DiagnosisData | null
): Promise<DeadlineSuggestion> {
  return withFallback(
    'suggestDeadline',
    async () => {
      const today = new Date().toISOString().split('T')[0]
      const userContent = formatGoalAndDiagnosis(goalTitle, diagnosis, today)
      const response = await client!.messages.parse({
        model: MODEL,
        max_tokens: 1024,
        thinking: { type: 'adaptive' },
        system: cachedSystem(DEADLINE_SYSTEM),
        messages: [{ role: 'user', content: userContent }],
        output_config: { format: zodOutputFormat(DeadlineSchema) },
      })
      const parsed = response.parsed_output
      if (!parsed) throw new Error('빈 응답')

      // 모델이 잘못된 날짜를 반환할 수 있으니 estimatedDays로 재계산 (안전성)
      const days = Math.max(7, Math.min(365, parsed.estimatedDays))
      return {
        estimatedDays: days,
        recommendedDeadline: todayPlusDays(days),
        reasoning: parsed.reasoning,
      }
    },
    () => mockSuggestDeadline(goalTitle, diagnosis)
  )
}

/* ──────────────────────────────────────────
   3) 마일스톤(단계) 자동 분할
   ────────────────────────────────────────── */

const MilestoneSuggestionSchema = z.object({
  title: z.string().describe('단계 제목 (한국어, 명사형, 10~25자)'),
  description: z.string().optional().describe('한 줄 부연 설명 (선택)'),
  targetDays: z.number().int().describe('목표 시작 후 며칠째 도달 예정인지'),
})
const MilestonesSchema = z.object({
  milestones: z.array(MilestoneSuggestionSchema).describe('2~4개의 단계'),
})

const MILESTONE_SYSTEM = `당신은 큰 목표를 의미있는 중간 단계(마일스톤)로 분할하는 전략 코치입니다.

원칙:
1. 일수에 따라 단계 개수 결정: < 14일 → 2개, < 30일 → 3개, 그 이상 → 4개
2. 각 단계는 자연스러운 진행 흐름: 기반 다지기 → 핵심 실행 → 적용/검증 → 마무리
3. 사용자의 진단 답변(현재 수준)을 반영해 첫 단계의 난이도 조정
4. 각 단계 제목은 명사형, 짧고 명확하게 (10~25자 한국어)
5. targetDays는 누적: 1단계 < 2단계 < ... < 마지막(=전체 일수)
6. 마지막 단계는 "데드라인 직전 점검·리허설" 같은 마무리 단계

답변 형식: JSON schema에 맞춰 milestones 배열 반환 (각 요소: title, description?, targetDays)`

export async function generateMilestones(
  goalTitle: string,
  estimatedDays: number,
  diagnosis: DiagnosisData | null
): Promise<MilestoneSuggestion[]> {
  return withFallback(
    'generateMilestones',
    async () => {
      const userContent =
        `목표: "${goalTitle}"\n전체 기간: ${estimatedDays}일\n\n` +
        formatDiagnosis(diagnosis)
      const response = await client!.messages.parse({
        model: MODEL,
        max_tokens: 2048,
        thinking: { type: 'adaptive' },
        system: cachedSystem(MILESTONE_SYSTEM),
        messages: [{ role: 'user', content: userContent }],
        output_config: { format: zodOutputFormat(MilestonesSchema) },
      })
      const parsed = response.parsed_output
      if (!parsed?.milestones || parsed.milestones.length === 0) {
        throw new Error('빈 응답')
      }
      // 마지막 마일스톤의 targetDays는 estimatedDays에 맞춤 (안전성)
      const ms = parsed.milestones
      ms[ms.length - 1].targetDays = estimatedDays
      return ms as MilestoneSuggestion[]
    },
    () => mockGenerateMilestones(goalTitle, estimatedDays, diagnosis)
  )
}

/* ──────────────────────────────────────────
   4) 오늘의 태스크 3개 생성
   ────────────────────────────────────────── */

const TasksSchema = z.object({
  titles: z
    .array(z.string())
    .describe('정확히 3개의 태스크 제목. 각각 한국어로 구체적·실행 가능하게.'),
  adjustmentNote: z
    .string()
    .nullable()
    .describe(
      '어제 회고 데이터를 반영해 분량/난이도를 조정한 경우 한 줄 안내. 조정 없으면 null.'
    ),
})

const TASKS_SYSTEM = `당신은 사용자의 큰 목표·진단·이전 활동·현재 단계를 모두 고려해 오늘 할 마이크로 액션 3개를 생성하는 일일 코치입니다.

엄격한 제약:
1. 정확히 3개의 태스크를 생성. 더 많거나 적으면 안 됨.
2. 각 태스크는 오늘 즉시 실행 가능한 작은 단위 (사용자 가용 시간 안에 완료 가능)
3. 첫 태스크는 단계(마일스톤) 컨텍스트 prefix 포함: "[N단계: 단계제목] 작업..." 형태
4. 두 번째는 [다음 단계] 또는 [심화] 같은 라벨로 그날의 흐름 보강
5. 세 번째는 [회고] 라벨로 짧은 정리·다음날 준비

핵심 컨텍스트 활용:
- 진단의 가용 시간(time): 분 단위로 태스크 분량 조정 (15분/하루 → 매우 짧게, 1시간+ → 깊게)
- 진단의 수준(level): 초보면 가장 쉬운 첫 단계, 숙련자면 임팩트 큰 작업
- 이전 활동(previous): 어제 결과 직접 반영
  · 모두 완료 → 한 단계 도전적
  · 일부 미완료 → 미완료 인용해 [이어서] 짧게 재시도 + 새 단계
  · 모두 미완료 → 더 작은 단위 + 격려
- 회고 난이도(difficulty 평균):
  · 1.4 이하(어려웠음) → 분량 30% 감소, adjustmentNote에 "어제 어려우셨다고 해서 분량을 줄였어요"
  · 2.6 이상(쉬웠음) → 분량 30% 증가, adjustmentNote에 "어제 여유로우셨다고 해서 좀 더 도전적으로"
  · 그 외 → adjustmentNote = null
- 단계 마감 임박(daysLeft ≤ 3): 태스크에 "(단계 마감 N일 남음)" 같은 압박 메시지 추가

답변 형식: JSON schema에 맞춰 titles 배열(정확히 3개)과 adjustmentNote(string 또는 null)`

export async function generateTasks(
  goalTitle: string,
  diagnosis: DiagnosisData | null,
  previous: PreviousTaskSnapshot[] | null,
  dayIndex: number,
  milestone: CurrentMilestone | null
): Promise<TaskGenerationResult> {
  return withFallback(
    'generateTasks',
    async () => {
      const userContent = formatTaskContext(
        goalTitle,
        diagnosis,
        previous,
        dayIndex,
        milestone
      )
      const response = await client!.messages.parse({
        model: MODEL,
        max_tokens: 2048,
        thinking: { type: 'adaptive' },
        system: cachedSystem(TASKS_SYSTEM),
        messages: [{ role: 'user', content: userContent }],
        output_config: { format: zodOutputFormat(TasksSchema) },
      })
      const parsed = response.parsed_output
      if (!parsed?.titles || parsed.titles.length !== 3) {
        throw new Error('정확히 3개 태스크가 아님')
      }
      return {
        titles: parsed.titles,
        adjustmentNote: parsed.adjustmentNote,
      }
    },
    () => mockGenerateTasks(goalTitle, diagnosis, previous, dayIndex, milestone)
  )
}

/* ──────────────────────────────────────────
   user content 포맷팅 헬퍼 — 가변 정보를 system이 아닌 user 메시지에 모음
   (system 프롬프트 캐싱을 망가뜨리지 않기 위해)
   ────────────────────────────────────────── */

function formatDiagnosis(diagnosis: DiagnosisData | null): string {
  if (!diagnosis || !diagnosis.questions || diagnosis.questions.length === 0) {
    return '진단 정보: 없음'
  }
  const lines = ['진단 답변:']
  for (const q of diagnosis.questions) {
    const answer = diagnosis.answers[q.id] ?? '(답변 없음)'
    lines.push(`  - ${q.question}: ${answer}`)
  }
  return lines.join('\n')
}

function formatGoalAndDiagnosis(
  goalTitle: string,
  diagnosis: DiagnosisData | null,
  today: string
): string {
  return [
    `오늘 날짜: ${today}`,
    `목표: "${goalTitle}"`,
    '',
    formatDiagnosis(diagnosis),
    '',
    '이 사용자에게 적절한 데드라인을 추천해주세요.',
  ].join('\n')
}

function formatTaskContext(
  goalTitle: string,
  diagnosis: DiagnosisData | null,
  previous: PreviousTaskSnapshot[] | null,
  dayIndex: number,
  milestone: CurrentMilestone | null
): string {
  const parts: string[] = [
    `목표: "${goalTitle}"`,
    `오늘은 시작 후 ${dayIndex}일째`,
    '',
    formatDiagnosis(diagnosis),
    '',
  ]

  if (milestone) {
    parts.push(
      `현재 단계: ${milestone.order}단계 / 전체 ${milestone.totalCount}단계`,
      `현재 단계 제목: ${milestone.title}`,
      `현재 단계 마감까지: ${milestone.daysLeft}일`,
      ''
    )
  }

  if (previous && previous.length > 0) {
    parts.push('어제(또는 가장 최근 활동일) 태스크:')
    for (const t of previous) {
      const status = t.completed ? '✓ 완료' : '✗ 미완료'
      const diff =
        t.difficulty === 1
          ? ' [어려웠음]'
          : t.difficulty === 2
            ? ' [적절]'
            : t.difficulty === 3
              ? ' [쉬웠음]'
              : ''
      parts.push(`  ${status}${diff}: ${t.title}`)
    }
    parts.push('')
  } else {
    parts.push('어제 데이터: 없음 (오늘이 첫날이거나 첫 태스크 생성)', '')
  }

  parts.push('이 컨텍스트로 오늘의 마이크로 액션 3개를 생성해주세요.')
  return parts.join('\n')
}
