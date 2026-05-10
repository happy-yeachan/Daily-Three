import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { generateDiagnosisQuestions } from '@/lib/llm'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const goalTitle: string = (body.goalTitle ?? '').trim()

  if (!goalTitle) {
    return NextResponse.json({ error: '목표를 입력해주세요.' }, { status: 400 })
  }

  // ANTHROPIC_API_KEY가 있으면 실제 Claude, 없으면 mock으로 자동 fallback
  const questions = await generateDiagnosisQuestions(goalTitle)

  return NextResponse.json({ questions })
}
