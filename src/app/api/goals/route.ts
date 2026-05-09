import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { mockGenerateMilestones, DiagnosisData } from '@/lib/ai-mock'

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

  const goals = await prisma.goal.findMany({
    where: { userId: session.userId, isActive: true },
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

  // ── 단계 자동 진행: 현재 dayIndex가 단계의 targetDays를 넘었으면 completed 자동 마킹 ──
  // 한 번에 다 처리하기 위해 변경 필요한 마일스톤만 모음
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
    // 메모리상 객체에도 반영
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

  // derived fields
  const enriched = goals.map((g) => {
    const goalStart = new Date(g.createdAt)
    goalStart.setHours(0, 0, 0, 0)
    const currentDayIndex = Math.max(
      1,
      Math.floor((today.getTime() - goalStart.getTime()) / 86400000) + 1
    )
    const currentMilestone = g.milestones.find((m) => !m.completed) ?? null
    return {
      ...g,
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

  // 데드라인이 있으면 일수 계산, 없으면 기본 30일
  const estimatedDays = deadline
    ? Math.max(7, Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000))
    : 30

  // 마일스톤 자동 생성
  const milestones = mockGenerateMilestones(title, estimatedDays, diagnosis)

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
