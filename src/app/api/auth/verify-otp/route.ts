import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createToken } from '@/lib/auth'

const MAX_VERIFY_ATTEMPTS = 5

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

  // 6자리 숫자가 아니면 즉시 거부 (검증 시도 카운터 절약)
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { error: '인증번호는 6자리 숫자입니다.' },
      { status: 400 }
    )
  }

  // 활성 OTP 조회 — 코드 일치 여부와 무관하게 시도 카운트를 위해 먼저 가져옴
  const activeOtp = await prisma.otpCode.findFirst({
    where: {
      phone,
      used: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!activeOtp) {
    return NextResponse.json(
      { error: '인증번호가 올바르지 않거나 만료되었습니다.' },
      { status: 400 }
    )
  }

  // 무차별 대입 방어 — 시도 횟수 초과면 OTP를 즉시 폐기
  if (activeOtp.attempts >= MAX_VERIFY_ATTEMPTS) {
    await prisma.otpCode.update({
      where: { id: activeOtp.id },
      data: { used: true },
    })
    return NextResponse.json(
      { error: '인증 시도 횟수를 초과했습니다. 인증번호를 다시 받아주세요.' },
      { status: 429 }
    )
  }

  // 코드 불일치 — 시도 카운트 증가 후 거부
  if (activeOtp.code !== code) {
    await prisma.otpCode.update({
      where: { id: activeOtp.id },
      data: { attempts: { increment: 1 } },
    })
    const remaining = MAX_VERIFY_ATTEMPTS - (activeOtp.attempts + 1)
    return NextResponse.json(
      {
        error:
          remaining > 0
            ? `인증번호가 올바르지 않습니다. ${remaining}회 시도 가능합니다.`
            : '인증번호가 올바르지 않습니다. 인증번호를 다시 받아주세요.',
      },
      { status: 400 }
    )
  }

  // 코드 일치 — 사용 처리
  await prisma.otpCode.update({
    where: { id: activeOtp.id },
    data: { used: true },
  })

  let user = await prisma.user.findUnique({ where: { phone } })
  if (!user) {
    user = await prisma.user.create({ data: { phone } })
    console.log(`\n✅  신규 사용자 가입: ${phone}\n`)
  }

  const token = await createToken(user.id, user.phone)

  const response = NextResponse.json({ success: true })
  response.cookies.set('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })

  return response
}
