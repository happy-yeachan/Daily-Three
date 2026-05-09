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

function getDaysLeft(deadline: string | null): number | null {
  if (!deadline) return null
  const diff = new Date(deadline).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function DeadlineBadge({ deadline }: { deadline: string | null }) {
  if (!deadline) {
    return (
      <span className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full">
        기한 없음
      </span>
    )
  }
  const days = getDaysLeft(deadline)!
  const label =
    days > 0 ? `D-${days}` : days === 0 ? 'D-DAY' : `D+${Math.abs(days)}`
  const color =
    days > 14
      ? 'text-indigo-400 bg-indigo-950/60'
      : days > 3
      ? 'text-yellow-400 bg-yellow-950/60'
      : 'text-red-400 bg-red-950/60'

  return (
    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${color}`}>
      {label}
    </span>
  )
}

function TaskCard({
  task,
  index,
  onToggle,
}: {
  task: DailyTask
  index: number
  onToggle: (id: string) => void
}) {
  return (
    <button
      onClick={() => onToggle(task.id)}
      className={`w-full flex items-start gap-4 p-5 rounded-2xl border text-left
                  transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]
                  ${
                    task.completed
                      ? 'bg-gray-900/40 border-gray-800/40'
                      : 'bg-gray-900 border-gray-800 hover:border-gray-700'
                  }`}
    >
      {/* 체크박스 */}
      <div
        className={`flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center mt-0.5
                    transition-all duration-200
                    ${
                      task.completed
                        ? 'bg-indigo-600 border-indigo-600'
                        : 'border-gray-600'
                    }`}
      >
        {task.completed && (
          <svg
            className="w-4 h-4 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M5 13l4 4L19 7"
            />
          </svg>
        )}
      </div>

      {/* 태스크 번호 + 내용 */}
      <div className="flex-1 min-w-0">
        <span
          className={`text-xs font-semibold uppercase tracking-widest ${
            task.completed ? 'text-gray-700' : 'text-indigo-500'
          }`}
        >
          Task {index + 1}
        </span>
        <p
          className={`mt-0.5 text-base leading-snug font-medium ${
            task.completed ? 'text-gray-600 line-through' : 'text-gray-100'
          }`}
        >
          {task.title}
        </p>
      </div>
    </button>
  )
}

function GoalSection({
  goal,
  onToggleTask,
  onGenerateTasks,
  onDeleteGoal,
  generatingId,
}: {
  goal: Goal
  onToggleTask: (taskId: string, goalId: string) => void
  onGenerateTasks: (goalId: string) => void
  onDeleteGoal: (goalId: string) => void
  generatingId: string | null
}) {
  const completedCount = goal.dailyTasks.filter((t) => t.completed).length
  const totalCount = goal.dailyTasks.length
  const isGenerating = generatingId === goal.id
  const allDone = totalCount > 0 && completedCount === totalCount

  return (
    <div className="space-y-4">
      {/* 목표 헤더 */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-gray-500 uppercase tracking-widest">목표</span>
            <DeadlineBadge deadline={goal.deadline} />
          </div>
          <h2 className="text-xl font-black text-white leading-snug">{goal.title}</h2>
        </div>
        <button
          onClick={() => onDeleteGoal(goal.id)}
          className="flex-shrink-0 text-gray-700 hover:text-red-500 transition-colors text-xs p-1"
          title="목표 삭제"
        >
          ✕
        </button>
      </div>

      {/* 태스크 목록 */}
      {totalCount > 0 ? (
        <>
          <div className="space-y-3">
            {goal.dailyTasks.map((task, i) => (
              <TaskCard
                key={task.id}
                task={task}
                index={i}
                onToggle={(id) => onToggleTask(id, goal.id)}
              />
            ))}
          </div>

          {/* 완료 상태 */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {goal.dailyTasks.map((t) => (
                  <div
                    key={t.id}
                    className={`w-2 h-2 rounded-full ${
                      t.completed ? 'bg-indigo-500' : 'bg-gray-700'
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs text-gray-500">
                {completedCount} / {totalCount} 완료
              </span>
            </div>
            {allDone && (
              <span className="text-xs text-indigo-400 font-semibold animate-pulse">
                🎉 오늘도 해냈어요!
              </span>
            )}
          </div>

          <button
            onClick={() => onGenerateTasks(goal.id)}
            disabled={isGenerating}
            className="w-full text-xs text-gray-600 hover:text-gray-400
                       border border-gray-800 hover:border-gray-700
                       rounded-xl py-2.5 transition-colors disabled:opacity-40"
          >
            {isGenerating ? '⟳ 생성 중…' : '↻ 오늘의 할 일 다시 생성하기'}
          </button>
        </>
      ) : (
        <div className="bg-gray-900/60 border border-gray-800 border-dashed rounded-2xl p-6 text-center space-y-3">
          <p className="text-gray-500 text-sm">아직 오늘의 할 일이 없어요.</p>
          <button
            onClick={() => onGenerateTasks(goal.id)}
            disabled={isGenerating}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40
                       text-white font-bold text-sm px-5 py-3 rounded-xl
                       transition-colors flex items-center gap-2 mx-auto"
          >
            {isGenerating ? (
              <>
                <span className="animate-spin">⟳</span> 생성 중…
              </>
            ) : (
              '✨ 오늘의 할 일 3개 생성하기'
            )}
          </button>
        </div>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [generatingId, setGeneratingId] = useState<string | null>(null)

  const fetchGoals = useCallback(async () => {
    try {
      const res = await fetch('/api/goals')
      if (res.status === 401) {
        router.push('/auth')
        return
      }
      const data = await res.json()
      setGoals(data)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchGoals()
  }, [fetchGoals])

  const handleToggleTask = async (taskId: string, goalId: string) => {
    // 낙관적 업데이트
    setGoals((prev) =>
      prev.map((g) =>
        g.id === goalId
          ? {
              ...g,
              dailyTasks: g.dailyTasks.map((t) =>
                t.id === taskId ? { ...t, completed: !t.completed } : t
              ),
            }
          : g
      )
    )

    const res = await fetch(`/api/tasks/${taskId}/toggle`, { method: 'PATCH' })
    if (!res.ok) {
      // 실패 시 롤백
      setGoals((prev) =>
        prev.map((g) =>
          g.id === goalId
            ? {
                ...g,
                dailyTasks: g.dailyTasks.map((t) =>
                  t.id === taskId ? { ...t, completed: !t.completed } : t
                ),
              }
            : g
        )
      )
    }
  }

  const handleGenerateTasks = async (goalId: string) => {
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

  const handleDeleteGoal = async (goalId: string) => {
    if (!confirm('이 목표와 관련된 모든 할 일이 삭제됩니다. 계속할까요?')) return
    const res = await fetch(`/api/goals/${goalId}`, { method: 'DELETE' })
    if (res.ok) setGoals((prev) => prev.filter((g) => g.id !== goalId))
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/auth')
  }

  // 오늘 날짜 포맷
  const todayLabel = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* 헤더 */}
      <header className="sticky top-0 z-10 bg-gray-950/80 backdrop-blur-md border-b border-gray-800/50 px-5 py-4 flex items-center justify-between">
        <span className="text-xl font-black tracking-tight">
          <span className="text-white">daily</span>
          <span className="text-indigo-400">·</span>
          <span className="text-white">three</span>
        </span>

        <button
          onClick={handleLogout}
          className="text-xs text-gray-600 hover:text-gray-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-800"
        >
          로그아웃
        </button>
      </header>

      <main className="flex-1 max-w-lg w-full mx-auto px-5 py-6 space-y-8">
        {/* 날짜 */}
        <div>
          <p className="text-xs text-gray-600 uppercase tracking-widest">Today</p>
          <h1 className="text-lg font-bold text-gray-300 mt-0.5">{todayLabel}</h1>
        </div>

        {/* 로딩 */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
            <p className="text-gray-600 text-sm">불러오는 중…</p>
          </div>
        )}

        {/* 빈 상태 */}
        {!loading && goals.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
            <div className="text-6xl">🎯</div>
            <div>
              <p className="text-white font-bold text-xl">첫 번째 목표를 만들어보세요</p>
              <p className="text-gray-500 text-sm mt-1">
                큰 꿈을 입력하면 AI가 오늘의 3가지 행동으로 쪼개드릴게요.
              </p>
            </div>
            <Link
              href="/goals/new"
              className="mt-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold
                         px-7 py-3.5 rounded-2xl transition-colors text-sm"
            >
              + 목표 시작하기
            </Link>
          </div>
        )}

        {/* 목표 섹션들 */}
        {!loading &&
          goals.map((goal, i) => (
            <div key={goal.id}>
              {i > 0 && <div className="border-t border-gray-800/60" />}
              <div className={i > 0 ? 'pt-8' : ''}>
                <GoalSection
                  goal={goal}
                  onToggleTask={handleToggleTask}
                  onGenerateTasks={handleGenerateTasks}
                  onDeleteGoal={handleDeleteGoal}
                  generatingId={generatingId}
                />
              </div>
            </div>
          ))}

        {/* 새 목표 추가 버튼 */}
        {!loading && goals.length > 0 && (
          <div className="pt-4">
            <Link
              href="/goals/new"
              className="flex items-center justify-center gap-2 w-full
                         border border-gray-800 border-dashed text-gray-600
                         hover:text-gray-400 hover:border-gray-700
                         rounded-2xl py-4 text-sm transition-colors"
            >
              + 새 목표 추가하기
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}
