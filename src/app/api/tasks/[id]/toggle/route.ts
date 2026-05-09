import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const task = await prisma.dailyTask.findFirst({
    where: { id: params.id, goal: { userId: session.userId } },
  })

  if (!task) {
    return NextResponse.json({ error: '태스크를 찾을 수 없습니다.' }, { status: 404 })
  }

  const updated = await prisma.dailyTask.update({
    where: { id: params.id },
    data: { completed: !task.completed },
  })

  return NextResponse.json(updated)
}
