import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ms = await prisma.milestone.findFirst({
    where: { id: params.id, goal: { userId: session.userId } },
  })

  if (!ms) {
    return NextResponse.json({ error: '단계를 찾을 수 없습니다.' }, { status: 404 })
  }

  // 미완료 → 완료로 가는 경우: 첫 번째 미완료 단계인지 확인 (순서 강제)
  if (!ms.completed) {
    const siblings = await prisma.milestone.findMany({
      where: { goalId: ms.goalId },
      orderBy: { order: 'asc' },
      select: { id: true, completed: true },
    })
    const firstUncompleted = siblings.find((s) => !s.completed)
    if (firstUncompleted?.id !== ms.id) {
      return NextResponse.json(
        { error: '이전 단계를 먼저 완료해주세요.' },
        { status: 400 }
      )
    }
  }

  const updated = await prisma.milestone.update({
    where: { id: params.id },
    data: {
      completed: !ms.completed,
      completedAt: !ms.completed ? new Date() : null,
    },
  })

  return NextResponse.json(updated)
}
