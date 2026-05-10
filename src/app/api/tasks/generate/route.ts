import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateTasks } from '@/lib/llm'
import {
  DiagnosisData,
  PreviousTaskSnapshot,
  CurrentMilestone,
} from '@/lib/ai-mock'

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const goalId: string = body.goalId ?? ''

  const goal = await prisma.goal.findFirst({
    where: { id: goalId, userId: session.userId },
    include: { milestones: { orderBy: { order: 'asc' } } },
  })

  if (!goal) {
    return NextResponse.json({ error: '목표를 찾을 수 없습니다.' }, { status: 404 })
  }

  const todayStart = startOfDay(new Date())
  const tomorrowStart = new Date(todayStart)
  tomorrowStart.setDate(tomorrowStart.getDate() + 1)

  // 1. dayIndex
  const goalStart = startOfDay(new Date(goal.createdAt))
  const dayIndex = Math.max(
    1,
    Math.floor((todayStart.getTime() - goalStart.getTime()) / 86400000) + 1
  )

  // 2. 오늘 기존 태스크 삭제
  await prisma.dailyTask.deleteMany({
    where: { goalId, date: { gte: todayStart, lt: tomorrowStart } },
  })

  // 3. 어제 또는 가장 최근 이전 묶음
  const lastPrev = await prisma.dailyTask.findFirst({
    where: { goalId, date: { lt: todayStart } },
    orderBy: { date: 'desc' },
    select: { date: true },
  })

  let previousTasks: PreviousTaskSnapshot[] = []
  if (lastPrev) {
    const prevStart = startOfDay(lastPrev.date)
    const prevEnd = new Date(prevStart)
    prevEnd.setDate(prevEnd.getDate() + 1)
    previousTasks = await prisma.dailyTask.findMany({
      where: { goalId, date: { gte: prevStart, lt: prevEnd } },
      orderBy: { createdAt: 'asc' },
      select: { title: true, completed: true, difficulty: true },
    })
  }

  // 4. 현재 마일스톤 = 첫 미완료
  const currentMs = goal.milestones.find((m) => !m.completed)
  let milestoneCtx: CurrentMilestone | null = null
  if (currentMs) {
    const daysLeft = currentMs.targetDays - dayIndex + 1
    milestoneCtx = {
      title: currentMs.title,
      order: currentMs.order,
      totalCount: goal.milestones.length,
      daysLeft,
    }
  }

  // 5. 진단
  const diagnosis: DiagnosisData | null = goal.diagnosis
    ? (JSON.parse(goal.diagnosis) as DiagnosisData)
    : null

  // 6. 모든 컨텍스트로 태스크 생성 (LLM 또는 mock fallback)
  const result = await generateTasks(
    goal.title,
    diagnosis,
    previousTasks,
    dayIndex,
    milestoneCtx
  )

  // 7. 저장
  const tasks = await prisma.$transaction(
    result.titles.map((title) =>
      prisma.dailyTask.create({
        data: { title, goalId, date: new Date(), dayIndex },
      })
    )
  )

  return NextResponse.json({ tasks, adjustmentNote: result.adjustmentNote }, { status: 201 })
}
