'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Step = 'input' | 'deadline' | 'creating'

interface Suggestion {
  estimatedDays: number
  recommendedDeadline: string
  reasoning: string
}

/* ── 단계 표시 바 ── */
function StepBar({ current }: { current: 1 | 2 }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {[1, 2].map((n) => (
        <div key={n} className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black
                        transition-all duration-300
                        ${n <= current ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-600'}`}
          >
            {n < current ? (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            ) : n}
          </div>
          {n === 1 && (
            <div className={`h-0.5 w-12 rounded-full transition-all duration-500
                             ${current >= 2 ? 'bg-indigo-600' : 'bg-gray-800'}`} />
          )}
        </div>
      ))}
      <span className="ml-1 text-xs text-gray-600">{current} / 2단계</span>
    </div>
  )
}

export default function NewGoalPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('input')
  const [title, setTitle] = useState('')
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null)
  const [deadline, setDeadline] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSuggest = async () => {
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

  const handleCreate = async () => {
    setError('')
    setLoading(true)
    setStep('creating')
    try {
      const goalRes = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, deadline: deadline || null }),
      })
      const goal = await goalRes.json()
      if (!goalRes.ok) throw new Error(goal.error)

      const taskRes = await fetch('/api/tasks/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalId: goal.id }),
      })
      if (!taskRes.ok) throw new Error('태스크 생성에 실패했습니다.')

      router.push('/dashboard')
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.')
      setStep('deadline')
      setLoading(false)
    }
  }

  const today = new Date().toISOString().split('T')[0]
  const stepNum: 1 | 2 = step === 'input' ? 1 : 2

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* 헤더 */}
      <header className="px-5 pt-6 pb-2 flex items-center justify-between">
        <button
          onClick={() => (step === 'deadline' ? setStep('input') : router.back())}
          className="text-gray-600 hover:text-white transition-colors text-sm flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          돌아가기
        </button>
      </header>

      <main className="flex-1 flex flex-col px-5 md:px-0 pt-4 pb-10 w-full max-w-xl mx-auto">
        <StepBar current={stepNum} />

        {/* ── STEP 1: 목표 입력 ── */}
        {step === 'input' && (
          <div className="space-y-6 animate-slide-up">
            <div>
              <h2 className="text-2xl font-black text-white">어떤 목표를 이루고 싶나요?</h2>
              <p className="mt-1.5 text-gray-600 text-sm">
                막연해도 괜찮아요. AI가 오늘 바로 실행할 수 있는 행동으로 바꿔드려요.
              </p>
            </div>

            <textarea
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                '예: 3개월 안에 영어로 발표할 수 있는 수준 되기\n' +
                '예: 매일 운동하는 습관 만들기\n' +
                '예: 사이드 프로젝트로 첫 고객 10명 모으기'
              }
              rows={6}
              autoFocus
              className="w-full bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4
                         text-white placeholder-gray-700 text-base resize-none leading-relaxed
                         focus:outline-none focus:border-indigo-500 transition-colors"
            />

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              onClick={handleSuggest}
              disabled={loading || !title.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-500 active:scale-95
                         disabled:opacity-30 disabled:cursor-not-allowed
                         text-white font-bold py-4 rounded-2xl transition-all
                         flex items-center justify-center gap-2"
            >
              {loading ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> AI가 분석 중…</>
              ) : '✨ AI 데드라인 추천받기'}
            </button>
          </div>
        )}

        {/* ── STEP 2: 데드라인 확인 ── */}
        {(step === 'deadline' || step === 'creating') && suggestion && (
          <div className="space-y-5 animate-slide-up">
            <div>
              <h2 className="text-2xl font-black text-white">데드라인을 확인하세요</h2>
              <p className="mt-1.5 text-gray-600 text-sm">수락하거나 직접 수정할 수 있어요.</p>
            </div>

            {/* 목표 요약 */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4">
              <p className="text-xs text-gray-600 uppercase tracking-widest mb-1">나의 목표</p>
              <p className="text-white font-semibold leading-snug">{title}</p>
            </div>

            {/* AI 분석 결과 */}
            <div className="bg-indigo-950/50 border border-indigo-900/50 rounded-2xl px-5 py-4 space-y-3">
              <p className="text-xs text-indigo-400 uppercase tracking-widest font-bold">✨ AI 분석</p>
              <div className="flex gap-8">
                <div>
                  <p className="text-xs text-gray-600">예상 소요</p>
                  <p className="text-3xl font-black text-white">{suggestion.estimatedDays}<span className="text-lg text-gray-500">일</span></p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">추천 데드라인</p>
                  <p className="text-2xl font-black text-white">{suggestion.recommendedDeadline}</p>
                </div>
              </div>
              <p className="text-gray-500 text-sm leading-relaxed border-t border-indigo-900/40 pt-3">
                {suggestion.reasoning}
              </p>
            </div>

            {/* 날짜 수정 */}
            <div>
              <label className="block text-xs text-gray-600 uppercase tracking-widest mb-2">
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
                className="mt-1.5 text-xs text-gray-700 hover:text-gray-500 transition-colors"
              >
                데드라인 없이 진행
              </button>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => { setStep('input'); setError('') }}
                disabled={loading}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold
                           py-4 rounded-2xl transition-colors text-sm disabled:opacity-40"
              >
                목표 수정
              </button>
              <button
                onClick={handleCreate}
                disabled={loading}
                className="flex-[2] bg-indigo-600 hover:bg-indigo-500 active:scale-95
                           disabled:opacity-40 disabled:cursor-not-allowed
                           text-white font-bold py-4 rounded-2xl transition-all
                           flex items-center justify-center gap-2"
              >
                {step === 'creating' ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 할 일 생성 중…</>
                ) : '목표 등록하기 →'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
