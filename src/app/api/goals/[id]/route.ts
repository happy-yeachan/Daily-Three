import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
  const updated = await prisma.goal.update({
    where: { id: params.id },
    data: {
      ...(body.isActive !== undefined && { isActive: body.isActive }),
    },
  })

  return NextResponse.json(updated)
}
