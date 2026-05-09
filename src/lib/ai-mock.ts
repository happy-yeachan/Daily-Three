// AI Mock: 실제 LLM 연동 전 더미 응답을 반환합니다.
// 추후 이 함수들을 실제 Claude/GPT API 호출로 교체하면 됩니다.

export interface DeadlineSuggestion {
  estimatedDays: number
  recommendedDeadline: string // YYYY-MM-DD
  reasoning: string
}

export function mockSuggestDeadline(goalTitle: string): DeadlineSuggestion {
  const len = goalTitle.trim().length

  let estimatedDays: number
  if (len < 15) {
    estimatedDays = 14
  } else if (len < 30) {
    estimatedDays = 30
  } else {
    estimatedDays = 90
  }

  const deadline = new Date()
  deadline.setDate(deadline.getDate() + estimatedDays)
  const recommendedDeadline = deadline.toISOString().split('T')[0]

  return {
    estimatedDays,
    recommendedDeadline,
    reasoning: `"${goalTitle}" 목표를 분석했습니다. 난이도와 범위를 고려했을 때 ${estimatedDays}일이 적절한 목표 기간입니다. 매일 꾸준히 실천하면 충분히 달성 가능합니다.`,
  }
}

export function mockGenerateTasks(goalTitle: string): string[] {
  // 항상 정확히 3개만 반환 (AI 연동 시 프롬프트에 동일하게 제약)
  return [
    `[${goalTitle}] 핵심 행동 1가지를 선택해 25분 집중 실행하기`,
    `관련 자료 또는 레퍼런스 15분 리서치 후 핵심 인사이트 3줄 메모`,
    `오늘 진행한 내용 5줄 회고 + 내일 첫 번째 행동 미리 결정하기`,
  ]
}
