'use client'

import { useState, useRef, KeyboardEvent, ClipboardEvent } from 'react'
import { useRouter } from 'next/navigation'

type Step = 'phone' | 'otp'

/* ── OTP 6칸 입력 ── */
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
      if (value[i]?.trim()) {
        const arr = value.padEnd(6, ' ').split('')
        arr[i] = ' '
        onChange(arr.join('').trimEnd())
      } else if (i > 0) focus(i - 1)
    } else if (e.key === 'ArrowLeft' && i > 0) focus(i - 1)
    else if (e.key === 'ArrowRight' && i < 5) focus(i + 1)
    else if (e.key === 'Enter' && value.trim().length === 6) onComplete()
  }

  const handlePaste = (e: ClipboardEvent) => {
    e.preventDefault()
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    onChange(digits)
    focus(Math.min(digits.length, 5))
    if (digits.length === 6) onComplete()
  }

  return (
    /* 최대 너비를 고정해 박스가 지나치게 커지지 않도록 */
    <div className="grid grid-cols-6 gap-2 w-full max-w-[288px]" onPaste={handlePaste}>
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
          className={`h-12 w-full text-center text-xl font-black font-mono rounded-xl
                      border-2 bg-gray-800 text-white outline-none
                      transition-all duration-150
                      ${value[i]?.trim()
                        ? 'border-indigo-500'
                        : 'border-gray-700 focus:border-indigo-500'}`}
        />
      ))}
    </div>
  )
}

/* ── 브랜딩 패널 (PC 전용 좌측) ── */
function BrandPanel() {
  const features = [
    { icon: '🎯', text: '큰 목표를 오늘 할 수 있는 3가지로 분해' },
    { icon: '✨', text: 'AI가 데드라인과 행동을 자동 추천' },
    { icon: '✅', text: '매일 딱 3가지만 — 부담 없는 실천' },
  ]
  return (
    <div className="hidden md:flex flex-col justify-center px-14 lg:px-20
                    bg-gradient-to-br from-indigo-950/60 to-gray-950 border-r border-gray-800">
      <div className="max-w-sm">
        <h1 className="text-4xl lg:text-5xl font-black tracking-tight mb-3">
          <span className="text-white">daily</span>
          <span className="text-indigo-400">·</span>
          <span className="text-white">three</span>
        </h1>
        <p className="text-gray-400 text-base mb-10 leading-relaxed">
          막연한 꿈을 <span className="text-indigo-400 font-semibold">오늘 당장 실행 가능한 3가지</span>로
          쪼개드립니다.
        </p>
        <ul className="space-y-4">
          {features.map((f) => (
            <li key={f.text} className="flex items-start gap-3">
              <span className="text-xl">{f.icon}</span>
              <span className="text-gray-400 text-sm leading-snug">{f.text}</span>
            </li>
          ))}
        </ul>
      </div>
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
      if (data.devCode) { setDevCode(data.devCode); setOtp(data.devCode) }
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
    /* 모바일: 단일 컬럼 중앙 정렬 / PC: 좌우 분할 */
    <div className="min-h-screen bg-gray-950 flex flex-col md:flex-row">

      <BrandPanel />

      {/* 오른쪽: 폼 영역 */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 md:px-10 lg:px-16">

        {/* 모바일 전용 로고 */}
        <div className="md:hidden mb-10 text-center animate-slide-up">
          <h1 className="text-4xl font-black tracking-tight">
            <span className="text-white">daily</span>
            <span className="text-indigo-400">·</span>
            <span className="text-white">three</span>
          </h1>
          <p className="mt-2 text-gray-600 text-sm">큰 목표를 오늘의 딱 3가지 행동으로</p>
        </div>

        {/* 카드 */}
        <div className="w-full max-w-sm animate-slide-up" style={{ animationDelay: '60ms' }}>
          <div className="bg-gray-900 rounded-2xl p-7 border border-gray-800 shadow-2xl shadow-black/60">

            {step === 'phone' ? (
              <div className="space-y-5">
                <div>
                  <p className="text-lg font-black text-white mb-0.5">로그인 / 가입</p>
                  <p className="text-xs text-gray-600">비밀번호 없이 번호로 간편 인증</p>
                </div>

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
                               text-white text-lg placeholder-gray-700 tracking-widest
                               focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>

                <button
                  onClick={handleRequestOtp}
                  disabled={loading || phone.length < 10}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 active:scale-95
                             disabled:opacity-30 disabled:cursor-not-allowed
                             text-white font-bold py-3.5 rounded-xl transition-all"
                >
                  {loading
                    ? <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        요청 중…
                      </span>
                    : '인증번호 받기'}
                </button>
              </div>

            ) : (
              <div className="space-y-5">
                <div>
                  <p className="text-lg font-black text-white mb-0.5">인증번호 확인</p>
                  <p className="text-xs text-gray-500">
                    <span className="text-gray-300 font-semibold">{phone}</span>으로 발송
                  </p>
                </div>

                {/* 개발 모드 OTP 표시 */}
                {devCode && (
                  <div className="bg-indigo-950/70 border border-indigo-900/50 rounded-xl px-4 py-3 text-center animate-pop-in">
                    <p className="text-xs text-indigo-400 font-semibold mb-1">개발 모드 — 인증번호</p>
                    <p className="text-2xl font-black tracking-[0.4em] text-indigo-200 font-mono">{devCode}</p>
                    <p className="text-xs text-indigo-700 mt-1">아래 칸에 자동 입력됐어요</p>
                  </div>
                )}

                {/* OTP 입력 — 최대 너비 제한으로 박스 크기 통일 */}
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
                             text-white font-bold py-3.5 rounded-xl transition-all"
                >
                  {loading
                    ? <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        확인 중…
                      </span>
                    : '로그인 / 가입하기'}
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
              <div className="mt-4 text-sm text-red-400 bg-red-900/20 rounded-xl py-2.5 px-3 text-center animate-pop-in">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
