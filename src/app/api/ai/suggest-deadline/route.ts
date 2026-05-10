import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { suggestDeadline } from '@/lib/llm'
import { DiagnosisData } from '@/lib/ai-mock'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const goalTitle: string = (body.goalTitle ?? '').trim()
  const diagnosis: DiagnosisData | null = body.diagnosis ?? null

  if (!goalTitle) {
    return NextResponse.json({ error: '목표를 입력해주세요.' }, { status: 400 })
  }
  if (goalTitle.length > 500) {
    return NextResponse.json(
      { error: '목표 제목은 500자 이하로 입력해주세요.' },
      { status: 400 }
    )
  }
  if (diagnosis && JSON.stringify(diagnosis).length > 20_000) {
    return NextResponse.json(
      { error: '진단 정보가 너무 큽니다.' },
      { status: 400 }
    )
  }

  const suggestion = await suggestDeadline(goalTitle, diagnosis)

  return NextResponse.json(suggestion)
}
