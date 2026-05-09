// AI Mock: 실제 LLM 연동 전 더미 응답을 반환합니다.
// 목표 텍스트에서 도메인·숫자·기간·습관 등 컨텍스트를 추출해 질문을 동적으로 조합합니다.
// 추후 이 파일은 Anthropic SDK 호출로 교체됩니다.

/* ──────────────────────────────────────────
   타입 정의
   ────────────────────────────────────────── */

export type DiagnosisQuestionType = 'single' | 'text'

export interface DiagnosisQuestion {
  id: string
  question: string
  type: DiagnosisQuestionType
  options?: string[]
  placeholder?: string
}

export interface DiagnosisData {
  questions: DiagnosisQuestion[]
  answers: Record<string, string>
}

type Domain = 'english' | 'language' | 'fitness' | 'study' | 'project' | 'creative' | 'finance' | 'general'

interface GoalContext {
  title: string
  domain: Domain
  numbers: { value: number; unit: string }[]
  timeframe: { value: number; unit: string } | null
  isHabit: boolean
  hasQuantitative: boolean
  weightTarget: { value: number; direction: 'up' | 'down' | 'unknown' } | null
}

/* ──────────────────────────────────────────
   1) 목표 텍스트 분석 — 컨텍스트 추출
   ────────────────────────────────────────── */

function extractContext(title: string): GoalContext {
  const t = title.toLowerCase()

  // 도메인 분류
  let domain: Domain = 'general'
  if (/영어|english|토익|토플|오픽|발표/.test(t)) domain = 'english'
  else if (/일본어|중국어|스페인|프랑스|독일|언어/.test(t)) domain = 'language'
  else if (/운동|다이어트|헬스|러닝|체력|감량|증량|근육|살빼|살찌|체중|단백질|식단/.test(t)) domain = 'fitness'
  else if (/공부|시험|자격증|책|독서|학습|배우|마스터|이론|개념/.test(t)) domain = 'study'
  else if (/프로젝트|개발|창업|사이드|매출|고객|런칭|출시|mvp|서비스|앱|웹/.test(t)) domain = 'project'
  else if (/그림|드로잉|음악|디자인|소설|영상|사진|작곡|작사|만화|글쓰기/.test(t)) domain = 'creative'
  else if (/저축|투자|재테크|자산|돈모|부수입|용돈/.test(t)) domain = 'finance'

  // 숫자 + 단위 추출 (한국어 단위 위주)
  const numbers: { value: number; unit: string }[] = []
  const numRegex = /(\d+)\s*(개월|일|년|주|시간|분|kg|명|만원|만 원|원|회|번|페이지|쪽|점|등|편)?/g
  let m: RegExpExecArray | null
  while ((m = numRegex.exec(t)) !== null) {
    numbers.push({ value: parseInt(m[1], 10), unit: (m[2] ?? '').trim() })
  }

  // 타임프레임 (가장 큰 시간 단위)
  const timeUnits = ['년', '개월', '주', '일', '시간']
  let timeframe: GoalContext['timeframe'] = null
  for (const unit of timeUnits) {
    const found = numbers.find((n) => n.unit === unit)
    if (found) { timeframe = { value: found.value, unit }; break }
  }

  // 습관 여부
  const isHabit = /매일|꾸준히|습관|매주|매월|하루도/.test(t)

  // 정량 목표 (시간 단위 외)
  const quantitativeUnits = ['kg', '명', '만원', '만 원', '원', '회', '번', '페이지', '쪽', '점', '등', '편']
  const hasQuantitative = numbers.some((n) => quantitativeUnits.includes(n.unit))

  // 체중 목표 — 도메인이 fitness이고 kg 숫자가 있으면 추출
  let weightTarget: GoalContext['weightTarget'] = null
  if (domain === 'fitness') {
    const kg = numbers.find((n) => n.unit === 'kg')
    if (kg) {
      const dir: 'up' | 'down' | 'unknown' = /감량|빼|줄|다이어트/.test(t) ? 'down'
        : /증량|찌|불|벌크/.test(t) ? 'up' : 'unknown'
      weightTarget = { value: kg.value, direction: dir }
    }
  }

  return { title, domain, numbers, timeframe, isHabit, hasQuantitative, weightTarget }
}

/* ──────────────────────────────────────────
   2) 질문 빌더들 — 카테고리별 동적 생성
   ────────────────────────────────────────── */

function buildLevelQuestion(ctx: GoalContext): DiagnosisQuestion {
  const map: Record<Domain, () => DiagnosisQuestion> = {
    english: () => ({
      id: 'level',
      question: '현재 영어 수준을 솔직하게 골라주세요.',
      type: 'single',
      options: ['거의 처음 — 단어부터', '간단한 문장 가능', '일상 대화 OK', '비즈니스/전문 영역 가능'],
    }),
    language: () => ({
      id: 'level',
      question: `"${ctx.title.includes('일본') ? '일본어' : ctx.title.includes('중국') ? '중국어' : '해당 언어'}" 수준은?`,
      type: 'single',
      options: ['알파벳/문자부터', '인사·자기소개 정도', '간단한 일상 대화', '꽤 능숙'],
    }),
    fitness: () => {
      if (ctx.weightTarget) {
        return {
          id: 'level',
          question: `최근 ${ctx.weightTarget.direction === 'down' ? '식단·운동 관리' : '운동·식단'}는 어땠어요?`,
          type: 'single',
          options: ['거의 신경 못 씀', '가끔 시도', '주 1~2회는 챙김', '꾸준히 관리 중'],
        }
      }
      return {
        id: 'level',
        question: '최근 한 달간 운동 빈도는?',
        type: 'single',
        options: ['거의 안 함', '주 1~2회', '주 3회 이상', '매일'],
      }
    },
    study: () => ({
      id: 'level',
      question: '이 주제에 대한 사전 지식은?',
      type: 'single',
      options: ['처음 시작', '기초만 알아', '핵심은 이해', '깊이 있게 알고 있음'],
    }),
    project: () => ({
      id: 'level',
      question: '지금 프로젝트는 어느 단계?',
      type: 'single',
      options: ['아이디어만 있음', '계획 수립 중', '시작은 했음', '운영 중 — 개선 필요'],
    }),
    creative: () => ({
      id: 'level',
      question: '이 분야 작업 경험은?',
      type: 'single',
      options: ['거의 처음', '취미로 해봄', '몇 작품 완성', '꾸준히 작업 중'],
    }),
    finance: () => ({
      id: 'level',
      question: '현재 재무 관리 습관은?',
      type: 'single',
      options: ['거의 신경 안 씀', '가끔 가계부 작성', '월별 예산 있음', '체계적 관리 중'],
    }),
    general: () => ({
      id: 'level',
      question: '이 목표와 관련해 지금까지의 경험은?',
      type: 'single',
      options: ['거의 처음', '시도해본 적 있음', '꽤 익숙한 편'],
    }),
  }
  return map[ctx.domain]()
}

function buildTimeQuestion(_ctx: GoalContext): DiagnosisQuestion {
  return {
    id: 'time',
    question: '평일 하루에 이 목표에 쓸 수 있는 시간은?',
    type: 'single',
    options: ['15분 이내', '30분 정도', '1시간', '2시간 이상'],
  }
}

/** 사용자가 직접 명시한 기간이 있으면 → 그게 외부 마감인지 자기 마감인지 묻기 */
function buildTimeframeQuestion(ctx: GoalContext): DiagnosisQuestion | null {
  if (!ctx.timeframe) return null
  return {
    id: 'timeframe_pressure',
    question: `"${ctx.timeframe.value}${ctx.timeframe.unit}"라는 기간, 외부 마감이 정해져 있나요?`,
    type: 'single',
    options: ['네 — 시험/이벤트 등 명확한 마감', '대략적인 자기 마감', '유연하게 해도 됨'],
  }
}

/** 정량 목표가 있으면 → 현재 진척도 묻기 */
function buildSpecificsQuestion(ctx: GoalContext): DiagnosisQuestion | null {
  if (ctx.weightTarget) {
    return {
      id: 'specifics',
      question: `"${ctx.weightTarget.value}kg ${ctx.weightTarget.direction === 'down' ? '감량' : ctx.weightTarget.direction === 'up' ? '증량' : '변화'}" — 이게 만만한 수치인가요?`,
      type: 'single',
      options: ['생애 처음 — 도전적', '한 번 해본 수준', '평소 컨디션 회복 정도'],
    }
  }
  if (!ctx.hasQuantitative) return null
  const num = ctx.numbers.find((n) =>
    ['명', '만원', '만 원', '원', '회', '번', '페이지', '쪽', '점', '등', '편'].includes(n.unit)
  )
  if (!num) return null
  const unitLabel: Record<string, string> = {
    명: '명 모집', 만원: '만원', '만 원': '만원',
    회: '회', 번: '번', 페이지: '페이지', 쪽: '쪽', 점: '점', 등: '등', 편: '편',
  }
  return {
    id: 'specifics',
    question: `"${num.value}${num.unit}" 목표 — 지금 어디쯤이세요?`,
    type: 'single',
    options: ['0에서 시작', '약간 진척 (10~30%)', '절반쯤 (30~70%)', '거의 다 옴 (70%+)'],
  }
}

/** 습관성 목표면 → 걸림돌 묻기 */
function buildHabitQuestion(ctx: GoalContext): DiagnosisQuestion | null {
  if (!ctx.isHabit) return null
  return {
    id: 'habit_obstacle',
    question: '꾸준히 하는 데 가장 큰 걸림돌은?',
    type: 'single',
    options: ['시간이 안 남', '자주 까먹음', '의지가 약함', '효과가 안 보여 지침'],
  }
}

/** 프로젝트 + 정량(고객 수, 매출 등) → 타겟 정의 묻기 */
function buildProjectScopeQuestion(ctx: GoalContext): DiagnosisQuestion | null {
  if (ctx.domain !== 'project') return null
  return {
    id: 'project_scope',
    question: '타겟 고객/사용자가 정해져 있나요?',
    type: 'single',
    options: ['아직 — 탐색 단계', '대략 — 가설 수준', '명확 — 인터뷰/검증 진행 중', '확정 — 운영 중'],
  }
}

function buildMotivationQuestion(_ctx: GoalContext): DiagnosisQuestion {
  return {
    id: 'why',
    question: '이 목표가 지금 중요한 이유를 한 줄로 적어주세요.',
    type: 'text',
    placeholder: '예: 6월 사내 발표 / 결혼 전까지 / 사이드 프로젝트 첫 매출',
  }
}

/* ──────────────────────────────────────────
   3) 메인 — 컨텍스트 기반 질문 동적 조합
   ────────────────────────────────────────── */

export function mockGenerateDiagnosisQuestions(goalTitle: string): DiagnosisQuestion[] {
  const ctx = extractContext(goalTitle)
  const questions: DiagnosisQuestion[] = []

  // 항상 들어가는 2개
  questions.push(buildLevelQuestion(ctx))
  questions.push(buildTimeQuestion(ctx))

  // 컨텍스트에 따라 가장 의미있는 동적 질문 1개 추가 (있을 때만)
  // 우선순위: 외부 마감 > 정량 진척도 > 프로젝트 스코프 > 습관 걸림돌
  const candidates: (DiagnosisQuestion | null)[] = [
    buildTimeframeQuestion(ctx),
    buildSpecificsQuestion(ctx),
    buildProjectScopeQuestion(ctx),
    buildHabitQuestion(ctx),
  ]
  const dynamicQuestion = candidates.find((q): q is DiagnosisQuestion => q !== null)
  if (dynamicQuestion) questions.push(dynamicQuestion)

  // 항상 마지막에 동기 질문
  questions.push(buildMotivationQuestion(ctx))

  return questions
}

/* ──────────────────────────────────────────
   4) 데드라인 추천 — 진단 + 컨텍스트 모두 반영
   ────────────────────────────────────────── */

export interface DeadlineSuggestion {
  estimatedDays: number
  recommendedDeadline: string
  reasoning: string
}

export function mockSuggestDeadline(
  goalTitle: string,
  diagnosis?: DiagnosisData | null
): DeadlineSuggestion {
  const ctx = extractContext(goalTitle)
  const ans = diagnosis?.answers ?? {}

  // 사용자가 명시한 timeframe이 있으면 그걸 우선
  let estimatedDays: number
  if (ctx.timeframe) {
    const conv: Record<string, number> = { 년: 365, 개월: 30, 주: 7, 일: 1 }
    estimatedDays = ctx.timeframe.value * (conv[ctx.timeframe.unit] ?? 30)
  } else {
    // 기본값: 텍스트 길이 기반 (이전 로직)
    const len = goalTitle.trim().length
    estimatedDays = len < 15 ? 14 : len < 30 ? 30 : 90
  }

  // 진단 — 수준에 따라 가감
  const level = ans.level ?? ''
  if (/처음|아이디어|알파벳|0에서/.test(level)) estimatedDays = Math.round(estimatedDays * 1.4)
  else if (/익숙|운영|능숙|체계적|꾸준히/.test(level)) estimatedDays = Math.round(estimatedDays * 0.75)

  // 가용 시간 가감
  const time = ans.time ?? ''
  if (time === '15분 이내') estimatedDays = Math.round(estimatedDays * 1.3)
  else if (time === '2시간 이상') estimatedDays = Math.round(estimatedDays * 0.85)

  // 외부 마감이 명확하면 ±0 (사용자 의도 그대로)
  const pressure = ans.timeframe_pressure ?? ''
  if (/명확한 마감/.test(pressure) && ctx.timeframe) {
    const conv: Record<string, number> = { 년: 365, 개월: 30, 주: 7, 일: 1 }
    estimatedDays = ctx.timeframe.value * (conv[ctx.timeframe.unit] ?? 30)
  }

  estimatedDays = Math.max(7, estimatedDays)
  const deadline = new Date()
  deadline.setDate(deadline.getDate() + estimatedDays)

  // 이유 문장 조합
  const parts: string[] = []
  if (ctx.timeframe) parts.push(`목표에 명시된 "${ctx.timeframe.value}${ctx.timeframe.unit}"`)
  if (level) parts.push(`현재 수준`)
  if (time) parts.push(`하루 ${time}`)
  const reasonContext = parts.length ? ` (${parts.join(', ')} 종합)` : ''

  return {
    estimatedDays,
    recommendedDeadline: deadline.toISOString().split('T')[0],
    reasoning: `${estimatedDays}일이 적절해요${reasonContext}. 무리 없이 매일 실천 가능한 수준입니다.`,
  }
}

/* ──────────────────────────────────────────
   5) 마일스톤 자동 생성 — 목표를 2~4 단계로 쪼개기
   ────────────────────────────────────────── */

export interface MilestoneSuggestion {
  title: string
  description?: string
  targetDays: number  // 목표 시작 후 며칠 안에 도달
}

const MILESTONE_PATTERNS: Record<Domain, string[]> = {
  english: ['핵심 표현·문법 익히기', '실전 시도 (대화/작문)', '실제 환경에서 적용', '데드라인 직전 점검·리허설'],
  language: ['기초 문자·발음 익히기', '핵심 표현 200개 외우기', '실전 대화 시도', '능숙도 검증'],
  fitness: ['습관 안착 (매일 빠짐없이)', '강도/볼륨 올리기', '성과 굳히기·식단 정착'],
  study: ['전체 범위 한 번 훑기', '핵심 개념·문제 정리', '약점 보완·실전 풀이', '시험/검증'],
  project: ['스코프·타겟 정의', 'MVP 구축', '실사용자 피드백 받기', '런칭/스케일'],
  creative: ['컨셉 잡기·레퍼런스 정리', '뼈대 완성', '디테일 다듬기', '발표/공개'],
  finance: ['현황 파악·고정비 분석', '예산·자동화 설정', '실행 + 정기 리뷰'],
  general: ['기반 다지기', '본격 실행', '점검 및 다듬기', '마무리·검증'],
}

/**
 * 일수와 도메인을 보고 2~4개 마일스톤을 자동 생성합니다.
 * 목표 등록 시 1회 호출되어 DB에 저장됨.
 */
export function mockGenerateMilestones(
  goalTitle: string,
  estimatedDays: number,
  diagnosis?: DiagnosisData | null
): MilestoneSuggestion[] {
  const ctx = extractContext(goalTitle)
  const pool = MILESTONE_PATTERNS[ctx.domain]

  // 일수에 따라 마일스톤 개수 결정
  const count = estimatedDays < 14 ? 2 : estimatedDays < 30 ? 3 : Math.min(4, pool.length)

  // 누적 비율 (마지막은 항상 100%)
  const ratios: number[][] = {
    2: [[0.5, 1.0]],
    3: [[0.3, 0.65, 1.0]],
    4: [[0.2, 0.45, 0.75, 1.0]],
  }[count] || [[0.3, 0.65, 1.0]]
  const ratio = ratios[0]

  const titles = pool.slice(0, count)
  const lastIndex = count - 1

  // 마지막 마일스톤은 데드라인까지 — 만약 데드라인이 없으면 estimatedDays 자체
  return titles.map((title, i) => {
    const targetDays = i === lastIndex ? estimatedDays : Math.max(1, Math.round(estimatedDays * ratio[i]))
    return {
      title,
      description: i === 0
        ? '시작 부담을 줄이고 흐름 만들기'
        : i === lastIndex
        ? '마무리 단계 — 결과 확정'
        : undefined,
      targetDays,
    }
  })
}

/* ──────────────────────────────────────────
   6) 오늘의 태스크 3개 — 진단 + 어제 + 현재 마일스톤 반영
   ────────────────────────────────────────── */

export interface CurrentMilestone {
  title: string
  order: number
  totalCount: number
  daysLeft: number  // 마일스톤 데드라인까지 남은 일수 (음수면 지남)
}

export interface PreviousTaskSnapshot {
  title: string
  completed: boolean
  difficulty?: number | null  // 1=어려움, 2=적절, 3=쉬움 (회고 루프)
}

export interface TaskGenerationResult {
  titles: string[]
  /** 어제 회고 데이터를 반영해 사용자에게 보여줄 짧은 안내 (없으면 null) */
  adjustmentNote: string | null
}

export function mockGenerateTasks(
  goalTitle: string,
  diagnosis?: DiagnosisData | null,
  previous?: PreviousTaskSnapshot[] | null,
  dayIndex?: number,
  milestone?: CurrentMilestone | null
): TaskGenerationResult {
  const ans = diagnosis?.answers ?? {}
  const time = ans.time ?? ''
  const level = ans.level ?? ''
  const day = Math.max(1, dayIndex ?? 1)
  const prev = previous ?? []

  const baseMinutes =
    time === '15분 이내' ? 10 :
    time === '30분 정도' ? 25 :
    time === '1시간'      ? 45 :
    time === '2시간 이상' ? 60 : 25

  // ── 회고 루프: 어제 평균 난이도로 분량 미세 조정 ──
  const rated = prev.filter((t): t is PreviousTaskSnapshot & { difficulty: number } =>
    typeof t.difficulty === 'number'
  )
  let minutes = baseMinutes
  let reflectionNote = ''
  if (rated.length > 0) {
    const avg = rated.reduce((s, t) => s + t.difficulty, 0) / rated.length
    if (avg <= 1.4) {
      minutes = Math.max(5, Math.round(baseMinutes * 0.7))
      reflectionNote = '어제 어려우셨다고 해서 분량을 줄였어요'
    } else if (avg >= 2.6) {
      minutes = Math.round(baseMinutes * 1.3)
      reflectionNote = '어제 여유로우셨다고 해서 좀 더 도전적으로'
    }
  }

  const isBeginner = /처음|아이디어|알파벳|0에서|거의 안|거의 신경/.test(level)
  const isAdvanced = /익숙|운영|능숙|체계적|꾸준히|매일|깊이/.test(level)

  // 단계 컨텍스트 prefix — 모든 시나리오에 일관 적용
  const msPrefix = milestone
    ? `[${milestone.order}단계: ${milestone.title}]`
    : `[${goalTitle}]`

  const note = reflectionNote || null
  const ok = (titles: string[]): TaskGenerationResult => ({ titles, adjustmentNote: note })

  // ── Day 1 또는 이전 데이터 없음: 진단만 반영 ──
  if (day === 1 || prev.length === 0) {
    if (isBeginner) {
      return ok([
        `${msPrefix} 가장 쉬운 첫 단계 1가지만 ${minutes}분 안에 시도하기`,
        `관련 기초 자료(글/영상) ${Math.max(5, Math.floor(minutes / 3))}분 훑어보고 핵심 키워드 3개 메모`,
        `오늘 한 일 1줄 + 막혔던 점 1줄 기록 — 내일 첫 행동 미리 정하기`,
      ])
    }
    if (isAdvanced) {
      return ok([
        `${msPrefix} 가장 임팩트 큰 작업 1가지에 ${minutes}분 깊게 몰입`,
        `진행 중 막힌 지점 또는 개선 포인트 ${Math.floor(minutes / 3)}분 분석 + 해결안 1개 도출`,
        `오늘 결과물 5줄 회고 + 이 단계 마무리에 필요한 핵심 단계 1개 결정`,
      ])
    }
    return ok([
      `${msPrefix} 핵심 작업 1가지를 ${minutes}분 집중 실행`,
      `관련 자료/레퍼런스 ${Math.floor(minutes / 3)}분 리서치 + 인사이트 3줄 메모`,
      `오늘 진행 5줄 회고 + 내일 첫 번째 행동 미리 결정`,
    ])
  }

  // ── Day 2+: 어제 결과 기반 동적 생성 ──
  const completed = prev.filter((t) => t.completed)
  const failed = prev.filter((t) => !t.completed)
  const half = Math.max(5, Math.floor(minutes / 2))
  const tiny = Math.max(5, Math.floor(minutes / 3))

  const pressure = milestone && milestone.daysLeft <= 3 && milestone.daysLeft >= 0
    ? ` (단계 마감 ${milestone.daysLeft}일 남음)`
    : ''

  if (failed.length === 0) {
    return ok([
      `${msPrefix} 어제 3개 모두 완료! 한 단계 더 도전적인 작업 ${minutes}분${pressure}`,
      `흐름을 이어 이전보다 깊이 있는 부분 ${half}분 — 막히면 일부만 진행 OK`,
      `여기까지 진행을 5줄 회고 + 다음 도약 포인트 1가지 결정`,
    ])
  }

  if (completed.length === 0) {
    return ok([
      `${msPrefix} 어제는 잠깐 어려웠죠. 오늘은 단 ${tiny}분만, 가장 작은 행동 하나만`,
      `완료 후 잠시 쉬고 — 어제 막혔던 이유 1줄 + 오늘 다른 시도 1줄 적기`,
      `오늘 한 작은 한 걸음을 1줄로 기록 — 내일은 여기서 다시 시작`,
    ])
  }

  const focusFailed = failed[0]
  const truncated = focusFailed.title.length > 35 ? focusFailed.title.slice(0, 35) + '…' : focusFailed.title
  return ok([
    `${msPrefix} [이어서] 어제 못 끝낸 "${truncated}" — 짧게 ${half}분만 다시 시도`,
    `[다음 단계] ${goalTitle}의 새로운 작업 ${minutes}분 실행${pressure}`,
    `[회고] 어제 ${completed.length}개 완료한 흐름 정리 + 오늘 1가지 더 잘 할 점 결정`,
  ])
}
