import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { mockGenerateTasks, DiagnosisData } from '@/lib/ai-mock'

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

  // 오늘 이미 생성된 태스크 삭제 (재생성 허용)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  await prisma.dailyTask.deleteMany({
    where: { goalId, date: { gte: today, lt: tomorrow } },
  })

  // 진단 데이터를 파싱해 mock에 전달
  const diagnosis: DiagnosisData | null = goal.diagnosis
    ? (JSON.parse(goal.diagnosis) as DiagnosisData)
    : null

  // MVP: AI 목업 — 항상 정확히 3개, 진단 결과 반영
  const taskTitles = mockGenerateTasks(goal.title, diagnosis)

  const tasks = await prisma.$transaction(
    taskTitles.map((title) =>
      prisma.dailyTask.create({
        data: { title, goalId, date: new Date() },
      })
    )
  )

  return NextResponse.json(tasks, { status: 201 })
}
