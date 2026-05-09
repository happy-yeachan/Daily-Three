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

  // MVP: 실제 SMS 대신 서버 터미널에 출력
  console.log('\n' + '='.repeat(50))
  console.log('📱  [OTP Mock] 인증번호 발송 (SMS 미연동 상태)')
  console.log(`    번호     : ${phone}`)
  console.log(`    인증번호 : \x1b[33m${code}\x1b[0m`)
  console.log(`    만료     : 5분`)
  console.log('='.repeat(50) + '\n')

  return NextResponse.json({
    success: true,
    message: '인증번호를 발송했습니다. 서버 터미널을 확인하세요.',
  })
}
