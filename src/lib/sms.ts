/**
 * SMS 발송 추상화 — provider 교체 가능한 fallback 구조
 *
 * 작동 방식 (LLM 통합과 동일 패턴):
 *   1. SOLAPI_API_KEY + SOLAPI_API_SECRET + SMS_SENDER_NUMBER 모두 있으면 → 실제 SMS 발송
 *   2. 하나라도 없거나 발송 실패 → mock 모드 (콘솔 출력 + 개발 환경에서 클라이언트에 OTP 반환)
 *
 * 환경변수:
 *   SMS_PROVIDER=solapi          (현재 solapi만 지원)
 *   SOLAPI_API_KEY=...           (Solapi 콘솔에서 발급)
 *   SOLAPI_API_SECRET=...
 *   SMS_SENDER_NUMBER=01012345678 (Solapi에 등록한 본인 발신번호)
 *
 * Solapi 가입 → API 키 발급 → 발신번호 등록 → 위 4개 환경변수 추가 → 서버 재시작
 *   완료 후 process.env.NODE_ENV가 무엇이든 실제 SMS 발송됨.
 */

import { SolapiMessageService } from 'solapi'

const provider = (process.env.SMS_PROVIDER || 'solapi').toLowerCase()
const apiKey = process.env.SOLAPI_API_KEY
const apiSecret = process.env.SOLAPI_API_SECRET
const senderNumber = process.env.SMS_SENDER_NUMBER

const solapi =
  provider === 'solapi' && apiKey && apiSecret && senderNumber
    ? new SolapiMessageService(apiKey, apiSecret)
    : null

export const isSmsEnabled = (): boolean => solapi !== null

export const smsProviderInfo = () => ({
  enabled: isSmsEnabled(),
  provider: isSmsEnabled() ? provider : 'mock',
})

// 서버 시작 시 한 번 안내
if (!solapi) {
  console.log(
    '\n[SMS] 발송 비활성 — 콘솔/응답 mock 사용 중. ' +
    '실제 SMS로 전환하려면 SOLAPI_API_KEY/SOLAPI_API_SECRET/SMS_SENDER_NUMBER 환경변수를 추가하세요.\n'
  )
} else {
  console.log(`\n[SMS] Solapi 활성화됨 (발신번호: ${senderNumber})\n`)
}

export interface SendOtpResult {
  success: boolean
  /** 사용자에게 보여줄 메시지 */
  message: string
  /** 개발 모드에서만 — mock 사용 시 클라이언트에 OTP 반환 (UI에 자동 채움) */
  devCode?: string
  /** 발송 실패 시 안내용 (HTTP 503 응답 등에 사용 가능) */
  error?: string
}

/**
 * 인증번호를 SMS로 발송합니다.
 * - 키 미설정/발송 실패 시 콘솔에 코드 출력 + 개발 환경이면 응답에도 포함 (서비스 무중단)
 */
export async function sendOtpSms(
  phone: string,
  code: string
): Promise<SendOtpResult> {
  // 항상 콘솔에 출력 (디버깅·이력 추적용)
  console.log(`[OTP] ${phone} → ${code}`)

  const isDev = process.env.NODE_ENV !== 'production'

  // mock 모드
  if (!solapi) {
    return {
      success: true,
      message: isDev
        ? '개발 모드 — 인증번호를 화면에 표시했어요.'
        : '인증번호를 발송했습니다.',
      devCode: isDev ? code : undefined,
    }
  }

  // 실제 SMS 발송
  try {
    await solapi.send({
      to: phone,
      from: senderNumber!,
      text: `[daily-three] 인증번호 ${code}\n5분 안에 입력해주세요.`,
    })
    return {
      success: true,
      message: '인증번호를 발송했습니다.',
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('[SMS] 발송 실패:', errMsg)
    return {
      success: false,
      message: '인증번호 발송에 실패했습니다. 잠시 후 다시 시도해주세요.',
      error: errMsg,
    }
  }
}
