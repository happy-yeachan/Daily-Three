import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(goals)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const title: string = (body.title ?? '').trim()
  const deadline: string | null = body.deadline ?? null
  const diagnosis = body.diagnosis ?? null

  if (!title) {
    return NextResponse.json({ error: '목표를 입력해주세요.' }, { status: 400 })
  }

  const goal = await prisma.goal.create({
    data: {
      title,
      deadline: deadline ? new Date(deadline) : null,
      diagnosis: diagnosis ? JSON.stringify(diagnosis) : null,
      userId: session.userId,
    },
  })

  return NextResponse.json(goal, { status: 201 })
}
