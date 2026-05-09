'use client'

import { useState, useRef, KeyboardEvent, ClipboardEvent } from 'react'
import { useRouter } from 'next/navigation'

type Step = 'phone' | 'otp'

/* ── 6칸 OTP 박스 ── */
function OtpBoxes({
  value,
  onChange,
  onComplete,
}: {
  value: string
  onChange: (v: string) => void
  onComplete: () => void
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([])

  const focus = (i: number) => refs.current[i]?.focus()

  const handleChange = (i: number, raw: string) => {
    const digit = raw.replace(/\D/g, '').slice(-1)
    const arr = value.padEnd(6, ' ').split('')
    arr[i] = digit || ' '
    const next = arr.join('').trimEnd()
    onChange(next)
    if (digit && i < 5) focus(i + 1)
    if (digit && i === 5 && next.trim().length === 6) onComplete()
  }

  const handleKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (value[i]) {
        const arr = value.padEnd(6, ' ').split('')
        arr[i] = ' '
        onChange(arr.join('').trimEnd())
      } else if (i > 0) {
        focus(i - 1)
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      focus(i - 1)
    } else if (e.key === 'ArrowRight' && i < 5) {
      focus(i + 1)
    } else if (e.key === 'Enter' && value.trim().length === 6) {
      onComplete()
    }
  }

  const handlePaste = (e: ClipboardEvent) => {
    e.preventDefault()
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    onChange(digits)
    focus(Math.min(digits.length, 5))
    if (digits.length === 6) onComplete()
  }

  return (
    <div className="flex gap-2" onPaste={handlePaste}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i]?.trim() || ''}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          autoFocus={i === 0}
          className={`flex-1 aspect-square text-center text-2xl font-black font-mono rounded-xl
                      border-2 bg-gray-800 text-white outline-none
                      transition-all duration-150
                      ${value[i]?.trim()
                        ? 'border-indigo-500 bg-gray-800'
                        : 'border-gray-700 focus:border-indigo-500'
                      }`}
        />
      ))}
    </div>
  )
}

/* ── 메인 페이지 ── */
export default function AuthPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [devCode, setDevCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleRequestOtp = async () => {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (data.devCode) {
        setDevCode(data.devCode)
        setOtp(data.devCode)
      }
      setStep('otp')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async () => {
    if (otp.trim().length !== 6) return
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code: otp.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      router.push('/dashboard')
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4">
      {/* 로고 */}
      <div className="mb-10 text-center select-none animate-slide-up">
        <h1 className="text-5xl font-black tracking-tight">
          <span className="text-white">daily</span>
          <span className="text-indigo-400">·</span>
          <span className="text-white">three</span>
        </h1>
        <p className="mt-2 text-gray-600 text-sm">큰 목표를 오늘의 딱 3가지 행동으로</p>
      </div>

      {/* 카드 */}
      <div className="w-full max-w-sm animate-slide-up" style={{ animationDelay: '60ms' }}>
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 shadow-2xl shadow-black/50">

          {step === 'phone' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
                  휴대폰 번호
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && phone.length >= 10 && handleRequestOtp()}
                  placeholder="01012345678"
                  maxLength={11}
                  autoFocus
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3.5
                             text-white text-xl placeholder-gray-700 tracking-widest
                             focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <button
                onClick={handleRequestOtp}
                disabled={loading || phone.length < 10}
                className="w-full bg-indigo-600 hover:bg-indigo-500 active:scale-95
                           disabled:opacity-30 disabled:cursor-not-allowed
                           text-white font-bold py-4 rounded-xl transition-all duration-150"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    요청 중…
                  </span>
                ) : (
                  '인증번호 받기'
                )}
              </button>

              <p className="text-center text-xs text-gray-700">
                번호로 간편 로그인 · 가입 — 비밀번호 없음
              </p>
            </div>

          ) : (
            <div className="space-y-5">
              {/* 발송 안내 */}
              <div>
                <p className="text-xs text-gray-500 mb-0.5">인증번호 발송</p>
                <p className="text-white font-bold tracking-wider">{phone}</p>
              </div>

              {/* 개발 모드 OTP 표시 */}
              {devCode && (
                <div className="bg-indigo-950/80 border border-indigo-900/60 rounded-xl px-4 py-3 text-center animate-pop-in">
                  <p className="text-xs text-indigo-400 mb-1 font-semibold">개발 모드 — 인증번호</p>
                  <p className="text-3xl font-black tracking-[0.5em] text-indigo-200 font-mono">
                    {devCode}
                  </p>
                  <p className="text-xs text-indigo-700 mt-1">아래 칸에 자동 입력됐어요</p>
                </div>
              )}

              {/* 6칸 OTP 입력 */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
                  인증번호 6자리
                </label>
                <OtpBoxes value={otp} onChange={setOtp} onComplete={handleVerifyOtp} />
              </div>

              <button
                onClick={handleVerifyOtp}
                disabled={loading || otp.trim().length !== 6}
                className="w-full bg-indigo-600 hover:bg-indigo-500 active:scale-95
                           disabled:opacity-30 disabled:cursor-not-allowed
                           text-white font-bold py-4 rounded-xl transition-all duration-150"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    확인 중…
                  </span>
                ) : (
                  '로그인 / 가입하기'
                )}
              </button>

              <button
                onClick={() => { setStep('phone'); setOtp(''); setDevCode(''); setError('') }}
                className="w-full text-gray-600 hover:text-gray-400 text-xs py-1 transition-colors"
              >
                번호 다시 입력
              </button>
            </div>
          )}

          {error && (
            <div className="mt-4 text-center text-sm text-red-400 bg-red-900/20 rounded-xl py-2.5 px-3 animate-pop-in">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
