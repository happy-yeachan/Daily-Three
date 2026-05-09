'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Step = 'input' | 'diagnose' | 'deadline' | 'creating'

interface DiagnosisQuestion {
  id: string
  question: string
  type: 'single' | 'text'
  options?: string[]
  placeholder?: string
}

interface Suggestion {
  estimatedDays: number
  recommendedDeadline: string
  reasoning: string
}

/* ── 단계 표시 바 (3단계) ── */
function StepBar({ current }: { current: 1 | 2 | 3 }) {
  const labels = ['목표 입력', '상태 진단', '데드라인']
  return (
    <div className="flex items-center mb-8">
      {[1, 2, 3].map((n, idx) => (
        <div key={n} className="flex items-center flex-1 last:flex-initial">
          <div className="flex flex-col items-center gap-1">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black
                          transition-all duration-300
                          ${n < current ? 'bg-indigo-600 text-white'
                            : n === current ? 'bg-indigo-600 text-white ring-4 ring-indigo-600/20'
                            : 'bg-gray-800 text-gray-600'}`}
            >
              {n < current ? (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : n}
            </div>
            <span className={`text-[10px] font-semibold ${n === current ? 'text-indigo-400' : 'text-gray-700'}`}>
              {labels[idx]}
            </span>
          </div>
          {idx < 2 && (
            <div className={`flex-1 h-0.5 mx-2 mb-4 rounded-full transition-all duration-500
                             ${current > n ? 'bg-indigo-600' : 'bg-gray-800'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

/* ── 진단 질문 카드 ── */
function DiagnosisQuestionCard({
  q,
  value,
  onChange,
}: {
  q: DiagnosisQuestion
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-3">
      <p className="text-white font-semibold leading-snug">{q.question}</p>

      {q.type === 'single' && q.options && (
        <div className="space-y-2">
          {q.options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium
                          transition-all duration-150
                          ${value === opt
                            ? 'bg-indigo-600/20 border-indigo-500 text-white'
                            : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-600 hover:text-gray-200'}`}
            >
              <span className="inline-flex items-center gap-2">
                <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center
                                  ${value === opt ? 'border-indigo-400' : 'border-gray-600'}`}>
                  {value === opt && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />}
                </span>
                {opt}
              </span>
            </button>
          ))}
        </div>
      )}

      {q.type === 'text' && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={q.placeholder}
          className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3
                     text-white placeholder-gray-700 text-sm
                     focus:outline-none focus:border-indigo-500 transition-colors"
        />
      )}
    </div>
  )
}

/* ── 메인 페이지 ── */
export default function NewGoalPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('input')
  const [title, setTitle] = useState('')

  // 진단
  const [questions, setQuestions] = useState<DiagnosisQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})

  // 데드라인
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null)
  const [deadline, setDeadline] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  /* ── Step 1 → 2: 진단 질문 받아오기 ── */
  const handleStartDiagnosis = async () => {
    if (!title.trim()) return
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/ai/diagnose-goal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalTitle: title }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setQuestions(data.questions)
      setAnswers({})
      setStep('diagnose')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  /* ── Step 2 → 3: 진단 결과로 데드라인 추천 ── */
  const handleSuggestDeadline = async () => {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/ai/suggest-deadline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goalTitle: title,
          diagnosis: { questions, answers },
        }),
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

  /* ── Step 3 → 완료: 목표 등록 + 태스크 생성 ── */
  const handleCreate = async () => {
    setError('')
    setLoading(true)
    setStep('creating')
    try {
      const goalRes = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          deadline: deadline || null,
          diagnosis: { questions, answers },
        }),
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

  /* ── 진단 단계 검증 ── */
  const allAnswered = questions.length > 0 && questions.every((q) => answers[q.id]?.trim())

  const today = new Date().toISOString().split('T')[0]
  const stepNum: 1 | 2 | 3 =
    step === 'input' ? 1 : step === 'diagnose' ? 2 : 3

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <header className="px-5 pt-6 pb-2 flex items-center">
        <button
          onClick={() => {
            if (step === 'diagnose') setStep('input')
            else if (step === 'deadline') setStep('diagnose')
            else router.back()
          }}
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
                막연해도 괜찮아요. 다음 단계에서 AI가 당신의 상태에 맞춰 조정해 드려요.
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
              onClick={handleStartDiagnosis}
              disabled={loading || !title.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-500 active:scale-95
                         disabled:opacity-30 disabled:cursor-not-allowed
                         text-white font-bold py-4 rounded-2xl transition-all
                         flex items-center justify-center gap-2"
            >
              {loading
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />AI가 질문 만드는 중…</>
                : '✨ 다음 — AI가 상태 진단 →'}
            </button>
          </div>
        )}

        {/* ── STEP 2: 진단 답변 ── */}
        {step === 'diagnose' && (
          <div className="space-y-6 animate-slide-up">
            <div>
              <h2 className="text-2xl font-black text-white">잠깐만요 — 지금 어디쯤이세요?</h2>
              <p className="mt-1.5 text-gray-600 text-sm">
                현재 상태를 알아야 진짜 맞춤 태스크를 드릴 수 있어요.
              </p>
            </div>

            {/* 목표 컨텍스트 */}
            <div className="bg-gray-900/60 border border-gray-800 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-600 mb-0.5">분석 중인 목표</p>
              <p className="text-gray-300 text-sm font-semibold leading-snug line-clamp-2">{title}</p>
            </div>

            {/* 질문 카드들 */}
            <div className="space-y-6">
              {questions.map((q, i) => (
                <div key={q.id} className="space-y-3">
                  <span className="text-xs text-indigo-400 font-bold uppercase tracking-widest">
                    Q{i + 1} / {questions.length}
                  </span>
                  <DiagnosisQuestionCard
                    q={q}
                    value={answers[q.id] || ''}
                    onChange={(v) => setAnswers({ ...answers, [q.id]: v })}
                  />
                </div>
              ))}
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              onClick={handleSuggestDeadline}
              disabled={loading || !allAnswered}
              className="w-full bg-indigo-600 hover:bg-indigo-500 active:scale-95
                         disabled:opacity-30 disabled:cursor-not-allowed
                         text-white font-bold py-4 rounded-2xl transition-all
                         flex items-center justify-center gap-2"
            >
              {loading
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />분석 중…</>
                : !allAnswered ? '모든 질문에 답해주세요' : '다음 — AI 데드라인 추천 →'}
            </button>
          </div>
        )}

        {/* ── STEP 3: 데드라인 ── */}
        {(step === 'deadline' || step === 'creating') && suggestion && (
          <div className="space-y-5 animate-slide-up">
            <div>
              <h2 className="text-2xl font-black text-white">데드라인을 확인하세요</h2>
              <p className="mt-1.5 text-gray-600 text-sm">진단 결과를 반영해 추천된 일정이에요.</p>
            </div>

            {/* 목표 + 진단 요약 */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4 space-y-3">
              <div>
                <p className="text-xs text-gray-600 uppercase tracking-widest mb-0.5">나의 목표</p>
                <p className="text-white font-semibold leading-snug">{title}</p>
              </div>
              <div className="border-t border-gray-800/60 pt-3 space-y-1.5">
                <p className="text-xs text-gray-600 uppercase tracking-widest">진단 결과</p>
                {questions.map((q) => (
                  <p key={q.id} className="text-xs text-gray-400">
                    <span className="text-gray-600">{q.question.length > 25 ? q.question.slice(0, 25) + '…' : q.question}</span>{' '}
                    <span className="text-gray-200 font-medium">{answers[q.id]}</span>
                  </p>
                ))}
              </div>
            </div>

            {/* AI 분석 */}
            <div className="bg-indigo-950/50 border border-indigo-900/50 rounded-2xl px-5 py-4 space-y-3">
              <p className="text-xs text-indigo-400 uppercase tracking-widest font-bold">✨ AI 추천</p>
              <div className="flex gap-8">
                <div>
                  <p className="text-xs text-gray-600">예상 소요</p>
                  <p className="text-3xl font-black text-white">
                    {suggestion.estimatedDays}<span className="text-lg text-gray-500">일</span>
                  </p>
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

            {/* 날짜 직접 수정 */}
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
                onClick={() => setStep('diagnose')}
                disabled={loading}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold
                           py-4 rounded-2xl transition-colors text-sm disabled:opacity-40"
              >
                진단 수정
              </button>
              <button
                onClick={handleCreate}
                disabled={loading}
                className="flex-[2] bg-indigo-600 hover:bg-indigo-500 active:scale-95
                           disabled:opacity-40 disabled:cursor-not-allowed
                           text-white font-bold py-4 rounded-2xl transition-all
                           flex items-center justify-center gap-2"
              >
                {step === 'creating'
                  ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />할 일 생성 중…</>
                  : '목표 등록 → 오늘의 3개 받기'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
