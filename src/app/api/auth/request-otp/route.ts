import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const phone: string = (body.phone ?? '').replace(/[-\s]/g, '')

  if (!/^01[0-9]{8,9}$/.test(phone)) {
    return NextResponse.json(
      { error: '유효한 휴대폰 번호를 입력해주세요. (예: 01012345678)' },
      { status: 400 }
    )
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

  // 기존 미사용 OTP 만료 처리
  await prisma.otpCode.updateMany({
    where: { phone, used: false },
    data: { used: true },
  })

  await prisma.otpCode.create({
    data: { phone, code, expiresAt },
  })

  console.log(`[OTP Mock] ${phone} → ${code}`)

  // 개발 환경에서는 응답에 OTP를 포함해 브라우저에서 바로 확인 가능
  const isDev = process.env.NODE_ENV !== 'production'

  return NextResponse.json({
    success: true,
    message: isDev ? null : '인증번호를 발송했습니다.',
    devCode: isDev ? code : undefined,
  })
}
