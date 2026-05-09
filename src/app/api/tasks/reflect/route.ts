import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * 오늘의 모든 태스크에 대해 사용자 자가 평가(난이도)를 일괄 저장.
 * Body: { goalId: string, difficulty: 1 | 2 | 3 }
 *  - 1 = 어려웠음, 2 = 적절, 3 = 쉬웠음
 *
 * 회고 루프: 다음날 mockGenerateTasks가 이 데이터를 컨텍스트로 받아 분량 ±30% 자동 조정
 */
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const goalId: string = body.goalId ?? ''
  const difficulty: number = body.difficulty

  if (!goalId || ![1, 2, 3].includes(difficulty)) {
    return NextResponse.json(
      { error: '잘못된 요청입니다.' },
      { status: 400 }
    )
  }

  // 본인 소유인지 확인
  const goal = await prisma.goal.findFirst({
    where: { id: goalId, userId: session.userId },
    select: { id: true },
  })
  if (!goal) {
    return NextResponse.json({ error: '목표를 찾을 수 없습니다.' }, { status: 404 })
  }

  // 오늘 범위
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const result = await prisma.dailyTask.updateMany({
    where: { goalId, date: { gte: today, lt: tomorrow } },
    data: { difficulty },
  })

  return NextResponse.json({ updated: result.count })
}
