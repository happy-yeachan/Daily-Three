'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Step = 'input' | 'deadline' | 'creating'

interface Suggestion {
  estimatedDays: number
  recommendedDeadline: string
  reasoning: string
}

export default function NewGoalPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('input')
  const [title, setTitle] = useState('')
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null)
  const [deadline, setDeadline] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSuggestDeadline = async () => {
    if (!title.trim()) return
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/ai/suggest-deadline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalTitle: title }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSuggestion(data)
      setDeadline(data.recommendedDeadline)
      setStep('deadline')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateGoal = async () => {
    setError('')
    setLoading(true)
    setStep('creating')
    try {
      // 1. 목표 생성
      const goalRes = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, deadline: deadline || null }),
      })
      const goal = await goalRes.json()
      if (!goalRes.ok) throw new Error(goal.error)

      // 2. 오늘의 태스크 즉시 생성
      const taskRes = await fetch('/api/tasks/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalId: goal.id }),
      })
      if (!taskRes.ok) {
        const err = await taskRes.json()
        throw new Error(err.error)
      }

      router.push('/dashboard')
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.')
      setStep('deadline')
      setLoading(false)
    }
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* 헤더 */}
      <header className="flex items-center justify-between px-5 pt-6 pb-4">
        <button
          onClick={() => router.back()}
          className="text-gray-500 hover:text-white transition-colors text-sm flex items-center gap-1"
        >
          ← 돌아가기
        </button>
        <span className="text-gray-600 text-xs">
          {step === 'input' ? '1 / 2' : '2 / 2'}
        </span>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-5 pb-10">
        <div className="w-full max-w-lg space-y-6">

          {/* STEP 1: 목표 입력 */}
          {step === 'input' && (
            <>
              <div>
                <h2 className="text-2xl font-black text-white">어떤 목표를 이루고 싶나요?</h2>
                <p className="mt-1 text-gray-500 text-sm">
                  막연해도 괜찮아요. AI가 구체적인 계획으로 쪼개 드릴게요.
                </p>
              </div>

              <textarea
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 3개월 안에 영어로 발표할 수 있는 수준 되기&#10;예: 매일 운동하는 습관 만들기&#10;예: 사이드 프로젝트로 첫 번째 고객 10명 모으기"
                rows={5}
                className="w-full bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4
                           text-white placeholder-gray-700 text-base resize-none
                           focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                           transition-colors leading-relaxed"
                autoFocus
              />

              {error && (
                <p className="text-red-400 text-sm">{error}</p>
              )}

              <button
                onClick={handleSuggestDeadline}
                disabled={loading || !title.trim()}
                className="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700
                           disabled:opacity-40 disabled:cursor-not-allowed
                           text-white font-bold py-4 rounded-2xl
                           transition-all duration-150 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="animate-spin text-lg">⟳</span>
                    AI가 분석 중…
                  </>
                ) : (
                  '✨ AI 데드라인 추천받기'
                )}
              </button>
            </>
          )}

          {/* STEP 2: 데드라인 확인 및 확정 */}
          {(step === 'deadline' || step === 'creating') && suggestion && (
            <>
              <div>
                <h2 className="text-2xl font-black text-white">데드라인을 확인하세요</h2>
                <p className="mt-1 text-gray-500 text-sm">AI 추천을 수락하거나 직접 수정할 수 있어요.</p>
              </div>

              {/* 목표 요약 */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4">
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">나의 목표</p>
                <p className="text-white font-semibold leading-snug">{title}</p>
              </div>

              {/* AI 분석 결과 */}
              <div className="bg-indigo-950/60 border border-indigo-900/60 rounded-2xl px-5 py-4 space-y-3">
                <p className="text-xs text-indigo-400 uppercase tracking-widest font-semibold">
                  ✨ AI 분석 결과
                </p>
                <div className="flex gap-6">
                  <div>
                    <p className="text-xs text-gray-500">예상 소요</p>
                    <p className="text-2xl font-black text-white">{suggestion.estimatedDays}일</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">추천 데드라인</p>
                    <p className="text-2xl font-black text-white">{suggestion.recommendedDeadline}</p>
                  </div>
                </div>
                <p className="text-gray-400 text-sm leading-relaxed border-t border-indigo-900/40 pt-3">
                  {suggestion.reasoning}
                </p>
              </div>

              {/* 날짜 직접 수정 */}
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-widest mb-2">
                  데드라인 직접 수정
                </label>
                <input
                  type="date"
                  value={deadline}
                  min={today}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3
                             text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <button
                  onClick={() => setDeadline('')}
                  className="mt-1 text-xs text-gray-600 hover:text-gray-400 transition-colors"
                >
                  데드라인 없이 진행하기
                </button>
              </div>

              {error && (
                <p className="text-red-400 text-sm">{error}</p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => { setStep('input'); setError('') }}
                  disabled={loading}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold
                             py-4 rounded-2xl transition-colors text-sm disabled:opacity-40"
                >
                  목표 수정
                </button>
                <button
                  onClick={handleCreateGoal}
                  disabled={loading}
                  className="flex-[2] bg-indigo-600 hover:bg-indigo-500
                             disabled:opacity-40 disabled:cursor-not-allowed
                             text-white font-bold py-4 rounded-2xl
                             transition-all duration-150 flex items-center justify-center gap-2"
                >
                  {step === 'creating' ? (
                    <>
                      <span className="animate-spin">⟳</span>
                      오늘의 할 일 생성 중…
                    </>
                  ) : (
                    '목표 등록하기 →'
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
