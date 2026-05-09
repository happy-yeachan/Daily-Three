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

/* ── 진행률 링 (SVG) ── */
function ProgressRing({
  completed,
  total,
  size = 96,
}: {
  completed: number
  total: number
  size?: number
}) {
  const radius = size * 0.38
  const circumference = 2 * Math.PI * radius
  const progress = total > 0 ? completed / total : 0
  const offset = circumference * (1 - progress)
  const allDone = total > 0 && completed === total
  const cx = size / 2
  const cy = size / 2

  return (
    <svg width={size} height={size} className="drop-shadow-lg">
      {/* 배경 트랙 */}
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#1f2937" strokeWidth={size * 0.09} />
      {/* 진행 호 */}
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke={allDone ? '#22c55e' : '#6366f1'}
        strokeWidth={size * 0.09}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${cx} ${cy})`}
        className="ring-progress"
      />
      {/* 중앙 텍스트 */}
      <text
        x={cx}
        y={cy - size * 0.04}
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-white"
        style={{ fontSize: size * 0.22, fontWeight: 900, fontFamily: 'inherit' }}
      >
        {completed}
      </text>
      <text
        x={cx}
        y={cy + size * 0.16}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fontSize: size * 0.12, fill: '#6b7280', fontFamily: 'inherit' }}
      >
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
  const cls =
    days > 14 ? 'text-indigo-400 bg-indigo-950/60 border-indigo-900/50' :
    days > 3  ? 'text-amber-400  bg-amber-950/60  border-amber-900/50'  :
                'text-red-400   bg-red-950/60    border-red-900/50'
  return (
    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${cls}`}>
      {label}
    </span>
  )
}

/* ── 동기부여 메시지 ── */
function Motivation({ completed, total }: { completed: number; total: number }) {
  if (total === 0) return <p className="text-gray-600 text-sm">할 일을 생성해보세요.</p>
  if (completed === 0) return <p className="text-gray-400 text-sm">첫 번째 할 일을 완료해볼까요?</p>
  if (completed === total) return (
    <p className="text-green-400 text-sm font-semibold animate-celebrate">
      🎉 오늘 목표 완전 달성!
    </p>
  )
  const left = total - completed
  return <p className="text-gray-400 text-sm">{left}개만 더 완료하면 오늘 끝!</p>
}

/* ── 태스크 카드 ── */
function TaskCard({
  task,
  index,
  onToggle,
}: {
  task: DailyTask
  index: number
  onToggle: (id: string) => void
}) {
  const NUMS = ['①', '②', '③']

  return (
    <button
      onClick={() => onToggle(task.id)}
      className={`w-full flex items-start gap-4 px-5 py-4 rounded-2xl text-left
                  border transition-all duration-300 group active:scale-[0.985]
                  ${task.completed
                    ? 'bg-gray-900/30 border-gray-800/30'
                    : 'bg-gray-900 border-gray-800 hover:border-gray-600 hover:bg-gray-900/80'
                  }`}
    >
      {/* 체크 원 */}
      <div
        className={`flex-shrink-0 w-7 h-7 mt-0.5 rounded-full border-2 flex items-center justify-center
                    transition-all duration-300
                    ${task.completed
                      ? 'bg-indigo-600 border-indigo-600 animate-pop-in'
                      : 'border-gray-600 group-hover:border-gray-400'
                    }`}
      >
        {task.completed && (
          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>

      {/* 텍스트 */}
      <div className="flex-1 min-w-0">
        <span className={`text-xs font-bold tracking-widest ${task.completed ? 'text-gray-700' : 'text-indigo-500'}`}>
          {NUMS[index]}
        </span>
        <p className={`mt-0.5 text-base font-medium leading-snug transition-all duration-300
                       ${task.completed ? 'text-gray-600 line-through decoration-gray-600/50' : 'text-gray-100'}`}>
          {task.title}
        </p>
      </div>
    </button>
  )
}

/* ── 목표 섹션 ── */
function GoalSection({
  goal,
  isPrimary,
  onToggle,
  onGenerate,
  onDelete,
  generatingId,
}: {
  goal: Goal
  isPrimary: boolean
  onToggle: (taskId: string, goalId: string) => void
  onGenerate: (goalId: string) => void
  onDelete: (goalId: string) => void
  generatingId: string | null
}) {
  const completed = goal.dailyTasks.filter((t) => t.completed).length
  const total = goal.dailyTasks.length
  const isGenerating = generatingId === goal.id
  const allDone = total > 0 && completed === total

  return (
    <div className="space-y-4 animate-slide-up">
      {/* 히어로 카드 (첫 번째 목표만) */}
      {isPrimary && (
        <div className={`rounded-2xl border p-5 transition-all duration-700
                         ${allDone
                           ? 'bg-gradient-to-br from-green-950/40 to-gray-900 border-green-900/50'
                           : 'bg-gradient-to-br from-indigo-950/40 to-gray-900 border-indigo-900/30'
                         }`}>
          <div className="flex items-center justify-between">
            {/* 목표 정보 */}
            <div className="flex-1 min-w-0 pr-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-500 uppercase tracking-widest">목표</span>
                <DeadlineBadge deadline={goal.deadline} />
              </div>
              <h2 className="text-lg font-black text-white leading-snug line-clamp-2">
                {goal.title}
              </h2>
              <div className="mt-3">
                <Motivation completed={completed} total={total} />
              </div>
            </div>

            {/* 진행률 링 */}
            {total > 0 && (
              <div className="flex-shrink-0">
                <ProgressRing completed={completed} total={total} size={88} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* 두 번째 이후 목표 헤더 (간략) */}
      {!isPrimary && (
        <div className="flex items-center gap-2 px-1">
          <span className="text-xs text-gray-500 uppercase tracking-widest">목표</span>
          <DeadlineBadge deadline={goal.deadline} />
          <h3 className="flex-1 text-sm font-bold text-gray-300 truncate">{goal.title}</h3>
        </div>
      )}

      {/* 태스크 없음 */}
      {total === 0 && (
        <div className="border border-dashed border-gray-800 rounded-2xl p-8 text-center space-y-3">
          <p className="text-gray-600 text-sm">아직 오늘의 할 일이 없어요.</p>
          <button
            onClick={() => onGenerate(goal.id)}
            disabled={isGenerating}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40
                       text-white font-bold text-sm px-5 py-3 rounded-xl
                       transition-all flex items-center gap-2 mx-auto active:scale-95"
          >
            {isGenerating
              ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 생성 중…</>
              : '✨ 오늘의 할 일 3개 생성하기'
            }
          </button>
        </div>
      )}

      {/* 태스크 목록 */}
      {total > 0 && (
        <div className="space-y-2.5">
          {goal.dailyTasks.map((task, i) => (
            <TaskCard
              key={task.id}
              task={task}
              index={i}
              onToggle={(id) => onToggle(id, goal.id)}
            />
          ))}
        </div>
      )}

      {/* 하단 컨트롤 */}
      <div className="flex items-center justify-between pt-1">
        <button
          onClick={() => onGenerate(goal.id)}
          disabled={isGenerating}
          className="text-xs text-gray-700 hover:text-gray-400 transition-colors disabled:opacity-40 py-1"
        >
          {isGenerating ? '생성 중…' : '↻ 오늘 할 일 다시 생성'}
        </button>
        <button
          onClick={() => onDelete(goal.id)}
          className="text-xs text-gray-800 hover:text-red-500 transition-colors py-1"
        >
          목표 삭제
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
    // 낙관적 업데이트
    setGoals((prev) =>
      prev.map((g) =>
        g.id !== goalId ? g : {
          ...g,
          dailyTasks: g.dailyTasks.map((t) =>
            t.id === taskId ? { ...t, completed: !t.completed } : t
          ),
        }
      )
    )
    const res = await fetch(`/api/tasks/${taskId}/toggle`, { method: 'PATCH' })
    if (!res.ok) {
      // 롤백
      setGoals((prev) =>
        prev.map((g) =>
          g.id !== goalId ? g : {
            ...g,
            dailyTasks: g.dailyTasks.map((t) =>
              t.id === taskId ? { ...t, completed: !t.completed } : t
            ),
          }
        )
      )
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
    month: 'long', day: 'numeric', weekday: 'short',
  })

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* 헤더 */}
      <header className="sticky top-0 z-10 bg-gray-950/80 backdrop-blur-md border-b border-gray-800/40 px-5 py-4 flex items-center justify-between">
        <span className="text-xl font-black tracking-tight select-none">
          <span className="text-white">daily</span>
          <span className="text-indigo-400">·</span>
          <span className="text-white">three</span>
        </span>
        <button
          onClick={handleLogout}
          className="text-xs text-gray-600 hover:text-gray-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-800/60"
        >
          로그아웃
        </button>
      </header>

      <main className="flex-1 max-w-lg w-full mx-auto px-5 pt-5 pb-10 space-y-8">
        {/* 날짜 */}
        <p className="text-sm text-gray-600 font-medium">{today}</p>

        {/* 로딩 */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-9 h-9 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
          </div>
        )}

        {/* 빈 상태 */}
        {!loading && goals.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-5 animate-slide-up">
            <div className="text-6xl">🎯</div>
            <div>
              <p className="text-xl font-black text-white">첫 번째 목표를 만들어보세요</p>
              <p className="text-gray-600 text-sm mt-1.5">
                큰 꿈을 입력하면 AI가 오늘의 3가지 행동으로 쪼개드려요.
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

        {/* 목표 목록 */}
        {!loading && goals.map((goal, i) => (
          <div key={goal.id}>
            {i > 0 && <hr className="border-gray-800/60" />}
            <div className={i > 0 ? 'pt-2' : ''}>
              <GoalSection
                goal={goal}
                isPrimary={i === 0}
                onToggle={handleToggle}
                onGenerate={handleGenerate}
                onDelete={handleDelete}
                generatingId={generatingId}
              />
            </div>
          </div>
        ))}

        {/* 새 목표 추가 */}
        {!loading && goals.length > 0 && (
          <Link
            href="/goals/new"
            className="flex items-center justify-center w-full
                       border border-gray-800 border-dashed
                       text-gray-700 hover:text-gray-400 hover:border-gray-700
                       rounded-2xl py-4 text-sm transition-all"
          >
            + 새 목표 추가하기
          </Link>
        )}
      </main>
    </div>
  )
}
