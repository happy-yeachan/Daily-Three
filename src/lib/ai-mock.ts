// AI Mock: 실제 LLM 연동 전 더미 응답을 반환합니다.
// 추후 이 함수들을 실제 Claude/GPT API 호출로 교체하면 됩니다.

/* ── 1단계: 목표 분석 — 진단 질문 생성 ── */

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

/**
 * 목표 텍스트를 보고 사용자의 현재 상태를 파악하기 위한 2~4개 질문을 생성합니다.
 * MVP: 키워드 기반 분기 + 공통 질문. 추후 LLM이 동적으로 생성하도록 교체.
 */
export function mockGenerateDiagnosisQuestions(goalTitle: string): DiagnosisQuestion[] {
  const t = goalTitle.toLowerCase()

  // 도메인별 특화 질문
  let domainQuestion: DiagnosisQuestion | null = null

  if (/영어|english|토익|발표|회화/.test(t)) {
    domainQuestion = {
      id: 'level',
      question: '현재 수준을 솔직하게 골라주세요.',
      type: 'single',
      options: ['거의 처음 — 단어부터', '간단한 문장은 가능', '일상 대화 OK', '비즈니스/전문 영역도 가능'],
    }
  } else if (/운동|다이어트|헬스|러닝|체력/.test(t)) {
    domainQuestion = {
      id: 'level',
      question: '최근 한 달간 운동 빈도는?',
      type: 'single',
      options: ['거의 안 함', '주 1~2회', '주 3회 이상', '매일'],
    }
  } else if (/공부|시험|자격증|책|독서/.test(t)) {
    domainQuestion = {
      id: 'level',
      question: '이 주제에 대한 사전 지식은?',
      type: 'single',
      options: ['처음 시작', '기초 정도는 알아', '핵심은 이해', '깊이 있게 알고 있음'],
    }
  } else if (/프로젝트|개발|창업|사이드/.test(t)) {
    domainQuestion = {
      id: 'level',
      question: '지금 프로젝트는 어느 단계인가요?',
      type: 'single',
      options: ['아이디어만 있음', '계획 수립 중', '시작은 했음', '운영 중 — 개선 필요'],
    }
  } else {
    domainQuestion = {
      id: 'level',
      question: '이 목표와 관련해 지금까지의 경험은?',
      type: 'single',
      options: ['거의 처음', '시도해본 적 있음', '꽤 익숙한 편'],
    }
  }

  // 공통 질문: 가용 시간, 동기/이유
  return [
    domainQuestion,
    {
      id: 'time',
      question: '평일 하루에 이 목표에 쓸 수 있는 시간은?',
      type: 'single',
      options: ['15분 이내', '30분 정도', '1시간', '2시간 이상'],
    },
    {
      id: 'why',
      question: '이 목표가 지금 중요한 이유를 한 줄로 적어주세요.',
      type: 'text',
      placeholder: '예: 6월 사내 발표 / 결혼 전까지 5kg 감량 / 사이드 프로젝트로 첫 매출',
    },
  ]
}

/* ── 2단계: 데드라인 추천 (진단 결과 반영) ── */

export interface DeadlineSuggestion {
  estimatedDays: number
  recommendedDeadline: string
  reasoning: string
}

export function mockSuggestDeadline(
  goalTitle: string,
  diagnosis?: DiagnosisData | null
): DeadlineSuggestion {
  const len = goalTitle.trim().length
  const level = diagnosis?.answers?.level ?? ''
  const time = diagnosis?.answers?.time ?? ''

  // 길이 기반 베이스
  let base = len < 15 ? 14 : len < 30 ? 30 : 90

  // 수준에 따라 가감 (초보일수록 더 길게)
  if (/처음|아이디어/.test(level)) base = Math.round(base * 1.5)
  else if (/익숙|운영|깊이|비즈니스|매일/.test(level)) base = Math.round(base * 0.7)

  // 가용 시간에 따라 조정
  if (time === '15분 이내') base = Math.round(base * 1.4)
  else if (time === '2시간 이상') base = Math.round(base * 0.8)

  const estimatedDays = Math.max(7, base)
  const deadline = new Date()
  deadline.setDate(deadline.getDate() + estimatedDays)

  const reasonParts: string[] = []
  if (level) reasonParts.push(`현재 수준(${level.split('—')[0].trim()})`)
  if (time) reasonParts.push(`하루 ${time} 투자`)
  const reasonContext = reasonParts.length ? ` ${reasonParts.join(', ')} 기준으로 계산했어요.` : ''

  return {
    estimatedDays,
    recommendedDeadline: deadline.toISOString().split('T')[0],
    reasoning: `"${goalTitle}" 목표는 ${estimatedDays}일이 적절합니다.${reasonContext} 무리 없이 매일 실천 가능한 수준이에요.`,
  }
}

/* ── 3단계: 오늘의 태스크 3개 생성 (진단 결과 반영) ── */

/**
 * 진단 결과(레벨, 가용 시간 등)를 반영해 사용자 맞춤 태스크 3개를 생성합니다.
 * 항상 정확히 3개. 시간/난이도가 사용자 답변에 따라 조정됩니다.
 */
export function mockGenerateTasks(
  goalTitle: string,
  diagnosis?: DiagnosisData | null
): string[] {
  const level = diagnosis?.answers?.level ?? ''
  const time = diagnosis?.answers?.time ?? ''

  // 가용 시간에 따른 분 단위 결정
  const minutes =
    time === '15분 이내' ? 10 :
    time === '30분 정도' ? 25 :
    time === '1시간'      ? 45 :
    time === '2시간 이상' ? 60 : 25

  const isBeginner = /처음|아이디어/.test(level)
  const isAdvanced = /익숙|운영|깊이|비즈니스|매일/.test(level)

  // 초급자: 작고 쉬운 단계
  if (isBeginner) {
    return [
      `[${goalTitle}] 가장 쉬운 첫 단계 1가지만 ${minutes}분 안에 시도하기`,
      `관련 기초 자료(글/영상) ${Math.max(5, Math.floor(minutes / 3))}분 훑어보고 핵심 키워드 3개 메모`,
      `오늘 한 일 1줄 + 막혔던 점 1줄 기록 — 내일 첫 행동 미리 정하기`,
    ]
  }

  // 고급자: 깊이 있는 작업
  if (isAdvanced) {
    return [
      `[${goalTitle}] 지금 가장 임팩트 큰 작업 1가지에 ${minutes}분 깊게 몰입`,
      `진행 중 막힌 지점 또는 개선 포인트 ${Math.floor(minutes / 3)}분 분석 + 해결안 1개 도출`,
      `오늘 결과물 5줄 회고 + 다음 마일스톤까지의 핵심 단계 1개 결정`,
    ]
  }

  // 중급(기본)
  return [
    `[${goalTitle}] 핵심 작업 1가지를 ${minutes}분 집중 실행`,
    `관련 자료/레퍼런스 ${Math.floor(minutes / 3)}분 리서치 + 인사이트 3줄 메모`,
    `오늘 진행 5줄 회고 + 내일 첫 번째 행동 미리 결정`,
  ]
}
