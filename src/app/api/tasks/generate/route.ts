import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { mockGenerateTasks, DiagnosisData, PreviousTaskSnapshot } from '@/lib/ai-mock'

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
  })

  if (!goal) {
    return NextResponse.json({ error: '목표를 찾을 수 없습니다.' }, { status: 404 })
  }

  const todayStart = startOfDay(new Date())
  const tomorrowStart = new Date(todayStart)
  tomorrowStart.setDate(tomorrowStart.getDate() + 1)

  // ── 1. 오늘이 며칠째인지 계산 (목표 등록 후) ──
  const goalStart = startOfDay(new Date(goal.createdAt))
  const dayIndex = Math.max(
    1,
    Math.floor((todayStart.getTime() - goalStart.getTime()) / 86400000) + 1
  )

  // ── 2. 오늘 이미 생성된 태스크 삭제 (재생성 허용) ──
  await prisma.dailyTask.deleteMany({
    where: { goalId, date: { gte: todayStart, lt: tomorrowStart } },
  })

  // ── 3. 가장 최근 이전 묶음(어제 또는 마지막 활동일) 조회 ──
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
      select: { title: true, completed: true },
    })
  }

  // ── 4. 진단 데이터 파싱 ──
  const diagnosis: DiagnosisData | null = goal.diagnosis
    ? (JSON.parse(goal.diagnosis) as DiagnosisData)
    : null

  // ── 5. mock에 컨텍스트 모두 전달 ──
  const taskTitles = mockGenerateTasks(goal.title, diagnosis, previousTasks, dayIndex)

  // ── 6. dayIndex와 함께 저장 ──
  const tasks = await prisma.$transaction(
    taskTitles.map((title) =>
      prisma.dailyTask.create({
        data: { title, goalId, date: new Date(), dayIndex },
      })
    )
  )

  return NextResponse.json(tasks, { status: 201 })
}
