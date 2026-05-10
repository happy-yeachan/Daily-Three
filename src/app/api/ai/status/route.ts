import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { llmModelInfo } from '@/lib/llm'

/**
 * 현재 LLM 활성화 여부 + 사용 모델을 반환합니다.
 * UI 헤더에서 "Mock 모드" / "Claude 모드" 같은 안내에 사용 가능.
 */
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return NextResponse.json(llmModelInfo())
}
