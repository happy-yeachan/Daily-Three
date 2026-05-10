import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const ALLOWED_STATUS = ['active', 'paused', 'completed', 'archived'] as const

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const goal = await prisma.goal.findFirst({
    where: { id: params.id, userId: session.userId },
  })

  if (!goal) {
    return NextResponse.json({ error: '목표를 찾을 수 없습니다.' }, { status: 404 })
  }

  await prisma.goal.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const goal = await prisma.goal.findFirst({
    where: { id: params.id, userId: session.userId },
  })

  if (!goal) {
    return NextResponse.json({ error: '목표를 찾을 수 없습니다.' }, { status: 404 })
  }

  const body = await req.json()
  const data: {
    title?: string
    deadline?: Date | null
    status?: string
    completedAt?: Date | null
  } = {}

  if (typeof body.title === 'string') {
    const trimmed = body.title.trim()
    if (!trimmed) {
      return NextResponse.json({ error: '목표 제목은 비울 수 없습니다.' }, { status: 400 })
    }
    data.title = trimmed
  }

  if ('deadline' in body) {
    data.deadline = body.deadline ? new Date(body.deadline) : null
  }

  if (typeof body.status === 'string') {
    if (!ALLOWED_STATUS.includes(body.status as typeof ALLOWED_STATUS[number])) {
      return NextResponse.json({ error: '유효하지 않은 상태입니다.' }, { status: 400 })
    }
    data.status = body.status
    // completed 마킹/해제 시 completedAt 자동 처리
    if (body.status === 'completed' && !goal.completedAt) {
      data.completedAt = new Date()
    } else if (body.status !== 'completed') {
      data.completedAt = null
    }
  }

  const updated = await prisma.goal.update({
    where: { id: params.id },
    data,
  })

  return NextResponse.json(updated)
}
