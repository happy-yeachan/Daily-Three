import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const phone: string = (body.phone ?? '').replace(/[-\s]/g, '')
  const code: string = (body.code ?? '').trim()

  if (!phone || !code) {
    return NextResponse.json(
      { error: '휴대폰 번호와 인증번호를 입력해주세요.' },
      { status: 400 }
    )
  }

  const otp = await prisma.otpCode.findFirst({
    where: {
      phone,
      code,
      used: false,
      expiresAt: { gt: new Date() },
    },
  })

  if (!otp) {
    return NextResponse.json(
      { error: '인증번호가 올바르지 않거나 만료되었습니다.' },
      { status: 400 }
    )
  }

  await prisma.otpCode.update({
    where: { id: otp.id },
    data: { used: true },
  })

  let user = await prisma.user.findUnique({ where: { phone } })
  if (!user) {
    user = await prisma.user.create({ data: { phone } })
    console.log(`\n✅  신규 사용자 가입: ${phone}\n`)
  }

  const token = await createToken(user.id, user.phone)

  const response = NextResponse.json({ success: true, isNew: !user })
  response.cookies.set('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })

  return response
}
