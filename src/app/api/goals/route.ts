import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateMilestones } from '@/lib/llm'
import { DiagnosisData } from '@/lib/ai-mock'

function getTodayBounds() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  return { today, tomorrow }
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { today, tomorrow } = getTodayBounds()

  // archived 외 모든 status 반환 (active, paused, completed)
  const goals = await prisma.goal.findMany({
    where: { userId: session.userId, status: { not: 'archived' } },
    include: {
      dailyTasks: {
        where: { date: { gte: today, lt: tomorrow } },
        orderBy: { createdAt: 'asc' },
      },
      milestones: {
        orderBy: { order: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  // 활동률 계산용: 각 목표의 모든 태스크를 한 번에 조회 (N+1 회피)
  const goalIds = goals.map((g) => g.id)
  const allTasks = await prisma.dailyTask.findMany({
    where: { goalId: { in: goalIds } },
    select: { goalId: true, date: true, completed: true },
  })
  const tasksByGoal = new Map<string, typeof allTasks>()
  for (const t of allTasks) {
    const arr = tasksByGoal.get(t.goalId) ?? []
    arr.push(t)
    tasksByGoal.set(t.goalId, arr)
  }

  // ── 단계 자동 진행 ──
  const milestonesToComplete: { id: string }[] = []
  for (const g of goals) {
    const goalStart = new Date(g.createdAt)
    goalStart.setHours(0, 0, 0, 0)
    const currentDayIndex = Math.max(
      1,
      Math.floor((today.getTime() - goalStart.getTime()) / 86400000) + 1
    )
    for (const m of g.milestones) {
      if (!m.completed && m.targetDays < currentDayIndex) {
        milestonesToComplete.push({ id: m.id })
      }
    }
  }

  if (milestonesToComplete.length > 0) {
    await prisma.milestone.updateMany({
      where: { id: { in: milestonesToComplete.map((m) => m.id) } },
      data: { completed: true, completedAt: new Date() },
    })
    const ids = new Set(milestonesToComplete.map((m) => m.id))
    for (const g of goals) {
      for (const m of g.milestones) {
        if (ids.has(m.id)) {
          m.completed = true
          m.completedAt = new Date()
        }
      }
    }
  }

  // ── derived fields: dayIndex, currentMilestoneId, milestone별 achievementRate ──
  const enriched = goals.map((g) => {
    const goalStart = new Date(g.createdAt)
    goalStart.setHours(0, 0, 0, 0)
    const currentDayIndex = Math.max(
      1,
      Math.floor((today.getTime() - goalStart.getTime()) / 86400000) + 1
    )
    const currentMilestone = g.milestones.find((m) => !m.completed) ?? null

    const goalTasks = tasksByGoal.get(g.id) ?? []

    // 각 단계의 활동률 계산
    const milestonesWithStats = g.milestones.map((m, i) => {
      const prevTargetDay = i > 0 ? g.milestones[i - 1].targetDays : 0
      // 단계 기간: dayIndex가 prevTargetDay+1 ~ targetDays 인 task들
      const periodTasks = goalTasks.filter((t) => {
        const td = new Date(t.date)
        td.setHours(0, 0, 0, 0)
        const dayIdx = Math.floor((td.getTime() - goalStart.getTime()) / 86400000) + 1
        return dayIdx > prevTargetDay && dayIdx <= m.targetDays
      })
      const completedCount = periodTasks.filter((t) => t.completed).length
      const totalCount = periodTasks.length
      const rate = totalCount > 0 ? completedCount / totalCount : 0
      return {
        ...m,
        completedTasks: completedCount,
        totalTasks: totalCount,
        achievementRate: rate,
      }
    })

    return {
      ...g,
      milestones: milestonesWithStats,
      currentDayIndex,
      currentMilestoneId: currentMilestone?.id ?? null,
    }
  })

  return NextResponse.json(enriched)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const title: string = (body.title ?? '').trim()
  const deadline: string | null = body.deadline ?? null
  const diagnosis: DiagnosisData | null = body.diagnosis ?? null

  if (!title) {
    return NextResponse.json({ error: '목표를 입력해주세요.' }, { status: 400 })
  }
  if (title.length > 500) {
    return NextResponse.json(
      { error: '목표 제목은 500자 이하로 입력해주세요.' },
      { status: 400 }
    )
  }
  if (diagnosis && JSON.stringify(diagnosis).length > 20_000) {
    return NextResponse.json(
      { error: '진단 정보가 너무 큽니다.' },
      { status: 400 }
    )
  }

  // 데드라인이 있으면 일수 계산, 없으면 기본 30일
  const estimatedDays = deadline
    ? Math.max(7, Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000))
    : 30

  // 단계 자동 생성 (LLM 또는 mock fallback)
  const milestones = await generateMilestones(title, estimatedDays, diagnosis)

  // 트랜잭션: 목표 + 마일스톤 한 번에 생성
  const goal = await prisma.goal.create({
    data: {
      title,
      deadline: deadline ? new Date(deadline) : null,
      diagnosis: diagnosis ? JSON.stringify(diagnosis) : null,
      userId: session.userId,
      milestones: {
        create: milestones.map((m, i) => ({
          title: m.title,
          description: m.description,
          order: i + 1,
          targetDays: m.targetDays,
        })),
      },
    },
    include: { milestones: { orderBy: { order: 'asc' } } },
  })

  return NextResponse.json(goal, { status: 201 })
}
