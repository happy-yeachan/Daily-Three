'use client'

import { useState, KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'

type Step = 'phone' | 'otp'

export default function AuthPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [devCode, setDevCode] = useState('')

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
        setOtp(data.devCode) // 자동 입력
      }
      setStep('otp')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async () => {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code: otp }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      router.push('/dashboard')
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const onPhoneKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && phone) handleRequestOtp()
  }

  const onOtpKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && otp.length === 6) handleVerifyOtp()
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4">
      {/* 로고 */}
      <div className="mb-10 text-center select-none">
        <h1 className="text-5xl font-black tracking-tight">
          <span className="text-white">daily</span>
          <span className="text-indigo-400">·</span>
          <span className="text-white">three</span>
        </h1>
        <p className="mt-3 text-gray-500 text-sm">큰 목표를 오늘의 딱 3가지 행동으로</p>
      </div>

      {/* 카드 */}
      <div className="w-full max-w-sm bg-gray-900 rounded-2xl p-6 border border-gray-800 shadow-2xl">
        {step === 'phone' ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
                휴대폰 번호
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                onKeyDown={onPhoneKeyDown}
                placeholder="01012345678"
                maxLength={11}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3.5
                           text-white text-lg placeholder-gray-600
                           focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                           transition-colors"
                autoFocus
              />
            </div>

            <button
              onClick={handleRequestOtp}
              disabled={loading || phone.length < 10}
              className="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700
                         disabled:opacity-40 disabled:cursor-not-allowed
                         text-white font-bold py-3.5 rounded-xl
                         transition-all duration-150 text-sm tracking-wide"
            >
              {loading ? '요청 중…' : '인증번호 받기'}
            </button>

            <p className="text-center text-xs text-gray-600">
              번호로 간편하게 로그인 · 가입 완료
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {devCode ? (
              <div className="bg-indigo-950/70 border border-indigo-800/60 rounded-xl px-4 py-3 text-center">
                <p className="text-xs text-indigo-400 mb-1">개발 모드 — 인증번호</p>
                <p className="text-3xl font-black tracking-[0.4em] text-indigo-300 font-mono">
                  {devCode}
                </p>
                <p className="text-xs text-indigo-600 mt-1">입력란에 자동으로 채워졌어요</p>
              </div>
            ) : (
              <div className="bg-gray-800/60 rounded-xl px-4 py-3 text-sm">
                <span className="text-gray-400">발송 번호: </span>
                <span className="text-white font-semibold">{phone}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
                인증번호 6자리
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={otp}
                onChange={(e) =>
                  setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
                }
                onKeyDown={onOtpKeyDown}
                placeholder="000000"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3.5
                           text-white text-3xl text-center tracking-[0.6em] placeholder-gray-700
                           focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                           transition-colors font-mono"
                autoFocus
              />
            </div>

            <button
              onClick={handleVerifyOtp}
              disabled={loading || otp.length !== 6}
              className="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700
                         disabled:opacity-40 disabled:cursor-not-allowed
                         text-white font-bold py-3.5 rounded-xl
                         transition-all duration-150 text-sm tracking-wide"
            >
              {loading ? '확인 중…' : '로그인 / 가입하기'}
            </button>

            <button
              onClick={() => {
                setStep('phone')
                setOtp('')
                setError('')
                setDevCode('')
              }}
              className="w-full text-gray-600 hover:text-gray-400 text-xs py-1 transition-colors"
            >
              번호 다시 입력하기
            </button>
          </div>
        )}

        {error && (
          <p className="mt-4 text-center text-sm text-red-400 bg-red-400/10 rounded-lg py-2 px-3">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
