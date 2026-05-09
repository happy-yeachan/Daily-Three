import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { mockSuggestDeadline } from '@/lib/ai-mock'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const goalTitle: string = (body.goalTitle ?? '').trim()

  if (!goalTitle) {
    return NextResponse.json({ error: '목표를 입력해주세요.' }, { status: 400 })
  }

  // MVP: AI 목업 — 추후 실제 LLM API 호출로 교체
  const suggestion = mockSuggestDeadline(goalTitle)

  return NextResponse.json(suggestion)
}
