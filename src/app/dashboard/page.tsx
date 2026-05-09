'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface DailyTask {
  id: string
  title: string
  completed: boolean
}

interface Goal {
  id: string
  title: string
  deadline: string | null
  createdAt: string
  dailyTasks: DailyTask[]
}

/* ── 진행률 링 ── */
function ProgressRing({ completed, total, size = 80 }: { completed: number; total: number; size?: number }) {
  const r = size * 0.38
  const circ = 2 * Math.PI * r
  const progress = total > 0 ? completed / total : 0
  const offset = circ * (1 - progress)
  const allDone = total > 0 && completed === total
  const c = size / 2

  return (
    <svg width={size} height={size}>
      <circle cx={c} cy={c} r={r} fill="none" stroke="#1f2937" strokeWidth={size * 0.1} />
      <circle
        cx={c} cy={c} r={r}
        fill="none"
        stroke={allDone ? '#22c55e' : '#6366f1'}
        strokeWidth={size * 0.1}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${c} ${c})`}
        className="ring-progress"
      />
      <text x={c} y={c - size * 0.04} textAnchor="middle" dominantBaseline="middle"
        className="fill-white" style={{ fontSize: size * 0.24, fontWeight: 900, fontFamily: 'inherit' }}>
        {completed}
      </text>
      <text x={c} y={c + size * 0.18} textAnchor="middle" dominantBaseline="middle"
        style={{ fontSize: size * 0.13, fill: '#6b7280', fontFamily: 'inherit' }}>
        / {total}
      </text>
    </svg>
  )
}

/* ── D-day 뱃지 ── */
function DeadlineBadge({ deadline }: { deadline: string | null }) {
  if (!deadline) return null
  const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000)
  const label = days > 0 ? `D-${days}` : days === 0 ? 'D-DAY' : `D+${Math.abs(days)}`
  const cls = days > 14
    ? 'text-indigo-400 bg-indigo-950/60 border-indigo-900/40'
    : days > 3
    ? 'text-amber-400 bg-amber-950/60 border-amber-900/40'
    : 'text-red-400 bg-red-950/60 border-red-900/40'
  return (
    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${cls}`}>{label}</span>
  )
}

/* ── 태스크 카드 ── */
function TaskCard({ task, index, onToggle }: { task: DailyTask; index: number; onToggle: (id: string) => void }) {
  const NUMS = ['①', '②', '③']
  return (
    <button
      onClick={() => onToggle(task.id)}
      className={`w-full flex items-start gap-4 px-5 py-4 rounded-2xl text-left border
                  transition-all duration-300 group active:scale-[0.985]
                  ${task.completed
                    ? 'bg-gray-900/25 border-gray-800/30'
                    : 'bg-gray-900 border-gray-800 hover:border-gray-600'}`}
    >
      {/* 체크 원 */}
      <div className={`flex-shrink-0 w-7 h-7 mt-0.5 rounded-full border-2 flex items-center justify-center
                      transition-all duration-200
                      ${task.completed
                        ? 'bg-indigo-600 border-indigo-600'
                        : 'border-gray-600 group-hover:border-gray-400'}`}>
        {task.completed && (
          <svg className="w-3.5 h-3.5 text-white animate-pop-in" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      {/* 텍스트 */}
      <div className="flex-1 min-w-0">
        <span className={`text-xs font-bold tracking-widest ${task.completed ? 'text-gray-700' : 'text-indigo-500'}`}>
          {NUMS[index]}
        </span>
        <p className={`mt-0.5 text-base font-medium leading-snug transition-all duration-200
                       ${task.completed ? 'text-gray-600 line-through decoration-gray-600/50' : 'text-gray-100'}`}>
          {task.title}
        </p>
      </div>
    </button>
  )
}

/* ── 목표 사이드 패널 (PC) ── */
function GoalSidebar({
  goal,
  onGenerate,
  onDelete,
  generatingId,
}: {
  goal: Goal
  onGenerate: (id: string) => void
  onDelete: (id: string) => void
  generatingId: string | null
}) {
  const completed = goal.dailyTasks.filter((t) => t.completed).length
  const total = goal.dailyTasks.length
  const allDone = total > 0 && completed === total
  const isGenerating = generatingId === goal.id

  return (
    <aside className={`flex flex-col gap-5 p-6 rounded-2xl border h-fit
                       transition-all duration-700 sticky top-24
                       ${allDone
                         ? 'bg-gradient-to-b from-green-950/40 to-gray-900/60 border-green-900/40'
                         : 'bg-gradient-to-b from-indigo-950/40 to-gray-900/60 border-indigo-900/30'}`}>
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-gray-600 uppercase tracking-widest">목표</span>
          <DeadlineBadge deadline={goal.deadline} />
        </div>
        <p className="text-white font-black leading-snug text-base">{goal.title}</p>
      </div>

      {total > 0 && (
        <div className="flex flex-col items-center gap-2 py-2">
          <ProgressRing completed={completed} total={total} size={88} />
          {allDone
            ? <p className="text-green-400 text-xs font-bold animate-celebrate">🎉 오늘 완료!</p>
            : <p className="text-gray-500 text-xs">{total - completed}개 남음</p>
          }
        </div>
      )}

      <div className="space-y-2 pt-1 border-t border-gray-800/60">
        <button
          onClick={() => onGenerate(goal.id)}
          disabled={isGenerating}
          className="w-full text-xs text-gray-500 hover:text-gray-300 transition-colors
                     py-2 border border-gray-800 hover:border-gray-700 rounded-xl disabled:opacity-40"
        >
          {isGenerating ? '생성 중…' : '↻ 할 일 다시 생성'}
        </button>
        <button
          onClick={() => onDelete(goal.id)}
          className="w-full text-xs text-gray-700 hover:text-red-500 transition-colors py-1"
        >
          목표 삭제
        </button>
      </div>
    </aside>
  )
}

/* ── 목표 히어로 (모바일) ── */
function GoalHero({
  goal,
  onGenerate,
  onDelete,
  generatingId,
}: {
  goal: Goal
  onGenerate: (id: string) => void
  onDelete: (id: string) => void
  generatingId: string | null
}) {
  const completed = goal.dailyTasks.filter((t) => t.completed).length
  const total = goal.dailyTasks.length
  const allDone = total > 0 && completed === total
  const isGenerating = generatingId === goal.id

  return (
    <div className={`rounded-2xl border p-5 transition-all duration-700
                     ${allDone
                       ? 'bg-gradient-to-br from-green-950/40 to-gray-900/60 border-green-900/40'
                       : 'bg-gradient-to-br from-indigo-950/40 to-gray-900/60 border-indigo-900/30'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs text-gray-600 uppercase tracking-widest">목표</span>
            <DeadlineBadge deadline={goal.deadline} />
          </div>
          <p className="text-white font-black leading-snug text-base">{goal.title}</p>
          {total > 0 && (
            <p className={`mt-2 text-sm font-medium ${allDone ? 'text-green-400' : 'text-gray-500'}`}>
              {allDone ? '🎉 오늘 목표 달성!' : `${total - completed}개 남았어요`}
            </p>
          )}
        </div>
        {total > 0 && (
          <div className="flex-shrink-0">
            <ProgressRing completed={completed} total={total} size={72} />
          </div>
        )}
      </div>
      <div className="flex gap-2 mt-4 pt-4 border-t border-gray-800/40">
        <button
          onClick={() => onGenerate(goal.id)}
          disabled={isGenerating}
          className="flex-1 text-xs text-gray-500 hover:text-gray-300 py-2
                     border border-gray-800 hover:border-gray-700 rounded-xl transition-colors disabled:opacity-40"
        >
          {isGenerating ? '생성 중…' : '↻ 할 일 다시 생성'}
        </button>
        <button
          onClick={() => onDelete(goal.id)}
          className="text-xs text-gray-700 hover:text-red-500 transition-colors px-3 py-2
                     border border-gray-800 hover:border-red-900/50 rounded-xl"
        >
          삭제
        </button>
      </div>
    </div>
  )
}

/* ── 메인 페이지 ── */
export default function DashboardPage() {
  const router = useRouter()
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [generatingId, setGeneratingId] = useState<string | null>(null)

  const fetchGoals = useCallback(async () => {
    try {
      const res = await fetch('/api/goals')
      if (res.status === 401) { router.push('/auth'); return }
      setGoals(await res.json())
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { fetchGoals() }, [fetchGoals])

  const handleToggle = async (taskId: string, goalId: string) => {
    setGoals((prev) => prev.map((g) =>
      g.id !== goalId ? g : {
        ...g,
        dailyTasks: g.dailyTasks.map((t) =>
          t.id === taskId ? { ...t, completed: !t.completed } : t
        ),
      }
    ))
    const res = await fetch(`/api/tasks/${taskId}/toggle`, { method: 'PATCH' })
    if (!res.ok) {
      setGoals((prev) => prev.map((g) =>
        g.id !== goalId ? g : {
          ...g,
          dailyTasks: g.dailyTasks.map((t) =>
            t.id === taskId ? { ...t, completed: !t.completed } : t
          ),
        }
      ))
    }
  }

  const handleGenerate = async (goalId: string) => {
    setGeneratingId(goalId)
    try {
      const res = await fetch('/api/tasks/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalId }),
      })
      if (res.ok) await fetchGoals()
    } finally {
      setGeneratingId(null)
    }
  }

  const handleDelete = async (goalId: string) => {
    if (!confirm('이 목표와 할 일을 모두 삭제할까요?')) return
    const res = await fetch(`/api/goals/${goalId}`, { method: 'DELETE' })
    if (res.ok) setGoals((prev) => prev.filter((g) => g.id !== goalId))
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/auth')
  }

  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
  })

  const primaryGoal = goals[0] ?? null

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* 헤더 */}
      <header className="sticky top-0 z-10 bg-gray-950/80 backdrop-blur-md
                         border-b border-gray-800/40 px-5 md:px-8 py-4
                         flex items-center justify-between">
        <span className="text-xl font-black tracking-tight select-none">
          <span className="text-white">daily</span>
          <span className="text-indigo-400">·</span>
          <span className="text-white">three</span>
        </span>
        <div className="flex items-center gap-3">
          <Link
            href="/goals/new"
            className="hidden md:flex items-center gap-1.5 text-xs text-gray-400 hover:text-white
                       border border-gray-800 hover:border-gray-600 px-3 py-1.5 rounded-lg transition-all"
          >
            + 목표 추가
          </Link>
          <button
            onClick={handleLogout}
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors
                       px-3 py-1.5 rounded-lg hover:bg-gray-800/60"
          >
            로그아웃
          </button>
        </div>
      </header>

      <main className="flex-1 px-5 md:px-8 lg:px-12 pt-6 pb-12">

        {/* ── 로딩 ── */}
        {loading && (
          <div className="flex items-center justify-center py-32">
            <div className="w-9 h-9 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
          </div>
        )}

        {/* ── 빈 상태 ── */}
        {!loading && goals.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-5 animate-slide-up">
            <div className="text-6xl">🎯</div>
            <div>
              <p className="text-xl font-black text-white">첫 번째 목표를 만들어보세요</p>
              <p className="text-gray-600 text-sm mt-1.5">
                큰 꿈을 입력하면 AI가 오늘의 3가지 행동으로 바꿔드려요.
              </p>
            </div>
            <Link
              href="/goals/new"
              className="bg-indigo-600 hover:bg-indigo-500 active:scale-95
                         text-white font-bold px-8 py-4 rounded-2xl transition-all text-sm"
            >
              + 목표 시작하기
            </Link>
          </div>
        )}

        {/* ── 목표 있음: PC 2단 / 모바일 단일 컬럼 ── */}
        {!loading && primaryGoal && (
          <div className="max-w-5xl mx-auto">
            {/* 날짜 */}
            <p className="text-sm text-gray-600 font-medium mb-6">{today}</p>

            {/* PC: grid 2단, 모바일: 단일 컬럼 */}
            <div className="md:grid md:grid-cols-[280px_1fr] md:gap-8 lg:grid-cols-[300px_1fr] lg:gap-10">

              {/* 사이드바 (PC) / 히어로 카드 (모바일) */}
              <div>
                {/* 모바일 히어로 */}
                <div className="md:hidden mb-5">
                  <GoalHero
                    goal={primaryGoal}
                    onGenerate={handleGenerate}
                    onDelete={handleDelete}
                    generatingId={generatingId}
                  />
                </div>
                {/* PC 사이드바 */}
                <div className="hidden md:block">
                  <GoalSidebar
                    goal={primaryGoal}
                    onGenerate={handleGenerate}
                    onDelete={handleDelete}
                    generatingId={generatingId}
                  />
                </div>
              </div>

              {/* 태스크 영역 */}
              <div className="space-y-3 animate-slide-up">
                {primaryGoal.dailyTasks.length === 0 ? (
                  <div className="border border-dashed border-gray-800 rounded-2xl
                                  p-10 md:p-16 text-center space-y-4">
                    <p className="text-gray-600">아직 오늘의 할 일이 없어요.</p>
                    <button
                      onClick={() => handleGenerate(primaryGoal.id)}
                      disabled={generatingId === primaryGoal.id}
                      className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40
                                 text-white font-bold text-sm px-6 py-3.5 rounded-xl
                                 transition-all flex items-center gap-2 mx-auto active:scale-95"
                    >
                      {generatingId === primaryGoal.id
                        ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 생성 중…</>
                        : '✨ 오늘의 할 일 3개 생성하기'}
                    </button>
                  </div>
                ) : (
                  primaryGoal.dailyTasks.map((task, i) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      index={i}
                      onToggle={(id) => handleToggle(id, primaryGoal.id)}
                    />
                  ))
                )}
              </div>
            </div>

            {/* 추가 목표 목록 (2번째 이후) */}
            {goals.length > 1 && (
              <div className="mt-10 space-y-4">
                <p className="text-xs text-gray-600 uppercase tracking-widest">다른 목표</p>
                {goals.slice(1).map((goal) => (
                  <div key={goal.id} className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4
                                                flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <DeadlineBadge deadline={goal.deadline} />
                      </div>
                      <p className="text-white font-semibold text-sm truncate">{goal.title}</p>
                      <p className="text-gray-600 text-xs mt-0.5">
                        오늘의 할 일 {goal.dailyTasks.filter((t) => t.completed).length}/{goal.dailyTasks.length}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleGenerate(goal.id)}
                        disabled={generatingId === goal.id}
                        className="text-xs text-gray-500 hover:text-white border border-gray-800
                                   hover:border-gray-600 px-3 py-1.5 rounded-lg transition-all disabled:opacity-40"
                      >
                        {generatingId === goal.id ? '생성 중…' : '할 일 생성'}
                      </button>
                      <button
                        onClick={() => handleDelete(goal.id)}
                        className="text-xs text-gray-700 hover:text-red-500 transition-colors
                                   border border-gray-800 hover:border-red-900/50 px-3 py-1.5 rounded-lg"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 모바일 전용: 새 목표 추가 버튼 */}
            <div className="md:hidden mt-6">
              <Link
                href="/goals/new"
                className="flex items-center justify-center w-full
                           border border-gray-800 border-dashed
                           text-gray-700 hover:text-gray-400 hover:border-gray-700
                           rounded-2xl py-4 text-sm transition-all"
              >
                + 새 목표 추가하기
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
