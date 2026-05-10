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

  const suggestion = await suggestDeadline(goalTitle, diagnosis)

  return NextResponse.json(suggestion)
}
