import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { llmModelInfo } from '@/lib/llm'
import { smsProviderInfo } from '@/lib/sms'

/**
 * 외부 통합 (LLM, SMS) 활성화 여부를 반환합니다.
 * UI 헤더에서 "Mock 모드" / "실 발송" 같은 안내에 사용 가능.
 */
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return NextResponse.json({
    llm: llmModelInfo(),
    sms: smsProviderInfo(),
  })
}
