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
    return NextResponse.json({ error: '마일스톤을 찾을 수 없습니다.' }, { status: 404 })
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
