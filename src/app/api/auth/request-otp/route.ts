import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const MAX_REQUESTS_PER_WINDOW = 5      // 5분 내 최대 발송 요청
const WINDOW_MS = 5 * 60 * 1000

export async function POST(req: NextRequest) {
  const body = await req.json()
  const phone: string = (body.phone ?? '').replace(/[-\s]/g, '')

  if (!/^01[0-9]{8,9}$/.test(phone)) {
    return NextResponse.json(
      { error: '유효한 휴대폰 번호를 입력해주세요. (예: 01012345678)' },
      { status: 400 }
    )
  }

  // ── Rate limit: 같은 번호로 5분 내 5회 초과 발송 차단 ──
  const recent = await prisma.otpCode.count({
    where: {
      phone,
      createdAt: { gt: new Date(Date.now() - WINDOW_MS) },
    },
  })
  if (recent >= MAX_REQUESTS_PER_WINDOW) {
    return NextResponse.json(
      { error: '너무 많은 요청입니다. 잠시 후 다시 시도해주세요.' },
      { status: 429 }
    )
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

  // 기존 미사용 OTP 만료 처리 (중복 방지)
  await prisma.otpCode.updateMany({
    where: { phone, used: false },
    data: { used: true },
  })

  await prisma.otpCode.create({
    data: { phone, code, expiresAt },
  })

  console.log(`[OTP Mock] ${phone} → ${code}`)

  const isDev = process.env.NODE_ENV !== 'production'

  return NextResponse.json({
    success: true,
    message: isDev ? null : '인증번호를 발송했습니다.',
    devCode: isDev ? code : undefined,
  })
}
