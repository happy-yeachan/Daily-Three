import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

const DAY_NAMES_KO = ['일', '월', '화', '수', '목', '금', '토']

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = startOfDay(new Date())
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  // archived 외 모든 목표
  const goals = await prisma.goal.findMany({
    where: { userId: session.userId, status: { not: 'archived' } },
    include: { milestones: { orderBy: { order: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  })
  const goalIds = goals.map((g) => g.id)

  // 사용자의 모든 task (해당 목표들 한정)
  const allTasks = await prisma.dailyTask.findMany({
    where: { goalId: { in: goalIds } },
    select: { date: true, completed: true, difficulty: true, goalId: true },
  })

  /* ── 1) 최근 7일 일별 통계 ── */
  const stats7days: Array<{ date: string; dayName: string; total: number; completed: number }> = []
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(today)
    dayStart.setDate(dayStart.getDate() - i)
    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayEnd.getDate() + 1)
    const dayTasks = allTasks.filter((t) => t.date >= dayStart && t.date < dayEnd)
    stats7days.push({
      date: dayStart.toISOString().split('T')[0],
      dayName: DAY_NAMES_KO[dayStart.getDay()],
      total: dayTasks.length,
      completed: dayTasks.filter((t) => t.completed).length,
    })
  }

  /* ── 2) 연속 활동일 (오늘부터 거꾸로) ── */
  let streak = 0
  for (let i = 0; i < 365; i++) {
    const dayStart = new Date(today)
    dayStart.setDate(dayStart.getDate() - i)
    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayEnd.getDate() + 1)
    const dayCompleted = allTasks.filter(
      (t) => t.completed && t.date >= dayStart && t.date < dayEnd
    ).length
    if (dayCompleted > 0) {
      streak++
    } else {
      // 오늘이 0이면 어제부터 카운트, 어제도 0이면 종료
      if (i === 0) continue
      break
    }
  }

  /* ── 3) 회고 분포 (difficulty별 카운트) ── */
  const reflection = { hard: 0, medium: 0, easy: 0 }
  for (const t of allTasks) {
    if (t.difficulty === 1) reflection.hard++
    else if (t.difficulty === 2) reflection.medium++
    else if (t.difficulty === 3) reflection.easy++
  }
  const reflectionTotal = reflection.hard + reflection.medium + reflection.easy

  /* ── 4) 목표별 압축 카드 ── */
  const goalSummaries = goals.map((g) => {
    const goalStart = startOfDay(new Date(g.createdAt))
    const currentDayIndex = Math.max(
      1,
      Math.floor((today.getTime() - goalStart.getTime()) / 86400000) + 1
    )
    const goalTasks = allTasks.filter((t) => t.goalId === g.id)
    const todayTasks = goalTasks.filter((t) => t.date >= today && t.date < tomorrow)
    const totalEver = goalTasks.length
    const completedEver = goalTasks.filter((t) => t.completed).length
    const overallRate = totalEver > 0 ? completedEver / totalEver : 0
    const currentMs = g.milestones.find((m) => !m.completed) ?? null

    return {
      id: g.id,
      title: g.title,
      status: g.status,
      deadline: g.deadline,
      currentDayIndex,
      todayCompleted: todayTasks.filter((t) => t.completed).length,
      todayTotal: todayTasks.length,
      totalEver,
      completedEver,
      overallRate,
      currentMilestone: currentMs ? { order: currentMs.order, title: currentMs.title } : null,
      totalMilestones: g.milestones.length,
      completedMilestones: g.milestones.filter((m) => m.completed).length,
    }
  })

  /* ── 5) 종합 ── */
  const totalTasksEver = allTasks.length
  const totalCompletedEver = allTasks.filter((t) => t.completed).length

  return NextResponse.json({
    stats7days,
    streak,
    reflection: { ...reflection, total: reflectionTotal },
    goals: goalSummaries,
    summary: {
      totalGoals: goals.length,
      activeGoals: goals.filter((g) => g.status === 'active').length,
      completedGoals: goals.filter((g) => g.status === 'completed').length,
      pausedGoals: goals.filter((g) => g.status === 'paused').length,
      totalTasksEver,
      totalCompletedEver,
      overallRate: totalTasksEver > 0 ? totalCompletedEver / totalTasksEver : 0,
    },
  })
}
