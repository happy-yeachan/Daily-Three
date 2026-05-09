'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface DailyTask {
  id: string
  title: string
  completed: boolean
  difficulty: number | null
}

interface Milestone {
  id: string
  title: string
  description: string | null
  order: number
  targetDays: number
  completed: boolean
}

interface Goal {
  id: string
  title: string
  deadline: string | null
  createdAt: string
  currentDayIndex: number
  currentMilestoneId: string | null
  dailyTasks: DailyTask[]
  milestones: Milestone[]
}

/* ── 진행률 링 ── */
function ProgressRing({ completed, total, size = 72 }: { completed: number; total: number; size?: number }) {
  const r = size * 0.38
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - (total > 0 ? completed / total : 0))
  const allDone = total > 0 && completed === total
  const c = size / 2
  return (
    <svg width={size} height={size} className="flex-shrink-0">
      <circle cx={c} cy={c} r={r} fill="none" stroke="#1f2937" strokeWidth={size * 0.1} />
      <circle cx={c} cy={c} r={r} fill="none"
        stroke={allDone ? '#22c55e' : '#6366f1'}
        strokeWidth={size * 0.1} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        transform={`rotate(-90 ${c} ${c})`} className="ring-progress" />
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
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${cls}`}>{label}</span>
}

/* ──────────────────────────────────────────
   장기 진행도 — 단계(Milestone) 트랙
   사용자 액션 없음. 일수 진척에 따라 시스템이 자동 진행.
   ────────────────────────────────────────── */
function MilestoneTrack({
  milestones,
  currentMilestoneId,
  currentDayIndex,
}: {
  milestones: Milestone[]
  currentMilestoneId: string | null
  currentDayIndex: number
}) {
  if (milestones.length === 0) return null
  const current = milestones.find((m) => m.id === currentMilestoneId)
  const completedCount = milestones.filter((m) => m.completed).length

  const daysLeft = current ? current.targetDays - currentDayIndex + 1 : null
  const pressureColor = daysLeft === null
    ? 'text-gray-500'
    : daysLeft < 0 ? 'text-red-400'
    : daysLeft <= 3 ? 'text-amber-400'
    : 'text-gray-500'

  return (
    <section className="rounded-xl bg-gray-900/30 border border-gray-800/60 px-4 py-3.5 space-y-3">
      {/* 섹션 식별 라벨 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.2em] text-gray-600 font-bold">
            장기 진행
          </span>
          <span className="text-[10px] text-gray-700">·</span>
          <span className="text-[10px] text-gray-500">
            {completedCount}/{milestones.length} 단계 자동 통과
          </span>
        </div>
        {daysLeft !== null && (
          <span className={`text-[10px] font-bold ${pressureColor}`}>
            {daysLeft >= 0 ? `${daysLeft}일 남음` : `${Math.abs(daysLeft)}일 지남`}
          </span>
        )}
      </div>

      {/* 도트 트랙 — 정보 표시만, 클릭 불가 */}
      <div className="flex items-center">
        {milestones.map((m, i) => {
          const isCurrent = m.id === currentMilestoneId
          const isLast = i === milestones.length - 1
          return (
            <div key={m.id} className="flex items-center flex-1 last:flex-initial">
              <div
                title={
                  m.completed
                    ? `${m.order}단계: ${m.title} (자동 통과)`
                    : isCurrent
                    ? `현재 진행 중: ${m.title}`
                    : `예정: ${m.title} (Day ${m.targetDays}까지)`
                }
                className={`relative flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center
                            transition-all duration-300
                            ${m.completed
                              ? 'bg-green-600 border-green-500'
                              : isCurrent
                              ? 'bg-indigo-600 border-indigo-400 ring-4 ring-indigo-600/20'
                              : 'bg-gray-900 border-gray-700'}`}
              >
                {m.completed ? (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className={`text-[9px] font-black ${isCurrent ? 'text-white' : 'text-gray-600'}`}>
                    {m.order}
                  </span>
                )}
              </div>
              {!isLast && (
                <div className={`flex-1 h-0.5 mx-1 transition-colors duration-300
                                 ${m.completed ? 'bg-green-600/60' : 'bg-gray-800'}`} />
              )}
            </div>
          )
        })}
      </div>

      {/* 현재 단계 인라인 */}
      {current && (
        <p className="text-xs leading-relaxed text-gray-400">
          <span className="text-indigo-400 font-bold">현재 {current.order}단계 :</span>{' '}
          <span className="text-gray-300">{current.title}</span>
          {current.description && (
            <span className="text-gray-600"> — {current.description}</span>
          )}
        </p>
      )}

      {!current && completedCount === milestones.length && (
        <p className="text-xs text-green-400 font-bold text-center">🎉 모든 단계 통과!</p>
      )}
    </section>
  )
}

/* ── 태스크 카드 ── */
function TaskCard({ task, index, onToggle }: { task: DailyTask; index: number; onToggle: (id: string) => void }) {
  return (
    <button onClick={() => onToggle(task.id)}
      className={`w-full flex items-start gap-4 px-5 py-4 rounded-2xl text-left border
                  transition-all duration-200 group active:scale-[0.985]
                  ${task.completed
                    ? 'bg-gray-900/25 border-gray-800/30'
                    : 'bg-gray-900 border-gray-800 hover:border-gray-600'}`}>
      <div className={`flex-shrink-0 w-7 h-7 mt-0.5 rounded-full border-2 flex items-center justify-center
                      transition-all duration-200
                      ${task.completed ? 'bg-indigo-600 border-indigo-600' : 'border-gray-600 group-hover:border-gray-400'}`}>
        {task.completed && (
          <svg className="w-3.5 h-3.5 text-white animate-pop-in" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <span className={`text-xs font-bold tracking-widest ${task.completed ? 'text-gray-700' : 'text-indigo-500'}`}>
          {'①②③'[index]}
        </span>
        <p className={`mt-0.5 text-base font-medium leading-snug transition-colors duration-200
                       ${task.completed ? 'text-gray-600 line-through decoration-gray-600/50' : 'text-gray-100'}`}>
          {task.title}
        </p>
      </div>
    </button>
  )
}

/* ── PC 사이드바 목표 항목 ── */
function SidebarGoalItem({ goal, selected, onClick }: { goal: Goal; selected: boolean; onClick: () => void }) {
  const completed = goal.dailyTasks.filter((t) => t.completed).length
  const total = goal.dailyTasks.length
  const allDone = total > 0 && completed === total

  return (
    <button onClick={onClick}
      className={`w-full text-left px-4 py-3.5 rounded-xl transition-all duration-150 group
                  ${selected
                    ? 'bg-indigo-600/20 border border-indigo-600/40'
                    : 'hover:bg-gray-800/60 border border-transparent'}`}>
      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
        {selected && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />}
        <span className="text-[10px] font-bold text-indigo-400">Day {goal.currentDayIndex}</span>
        <DeadlineBadge deadline={goal.deadline} />
      </div>
      <p className={`text-sm font-semibold leading-snug line-clamp-2 ${selected ? 'text-white' : 'text-gray-300'}`}>
        {goal.title}
      </p>
      {/* 미니 진행 바 */}
      <div className="mt-2.5 flex items-center gap-2">
        <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${allDone ? 'bg-green-500' : 'bg-indigo-500'}`}
            style={{ width: total > 0 ? `${(completed / total) * 100}%` : '0%' }}
          />
        </div>
        <span className={`text-xs font-bold flex-shrink-0 ${allDone ? 'text-green-400' : 'text-gray-600'}`}>
          {completed}/{total > 0 ? total : '?'}
        </span>
      </div>
    </button>
  )
}

/* ── 모바일 탭 칩 ── */
function MobileTabChip({ goal, selected, onClick }: { goal: Goal; selected: boolean; onClick: () => void }) {
  const completed = goal.dailyTasks.filter((t) => t.completed).length
  const total = goal.dailyTasks.length
  const allDone = total > 0 && completed === total

  return (
    <button onClick={onClick}
      className={`flex-shrink-0 flex flex-col items-start px-4 py-2.5 rounded-xl border
                  transition-all duration-150
                  ${selected
                    ? 'bg-indigo-600/20 border-indigo-600/50 text-white'
                    : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700'}`}>
      <span className="text-sm font-semibold max-w-[120px] truncate">{goal.title}</span>
      <span className={`text-xs mt-0.5 font-bold ${allDone ? 'text-green-400' : selected ? 'text-indigo-300' : 'text-gray-600'}`}>
        {allDone ? '완료 🎉' : `${completed}/${total > 0 ? total : '?'}`}
      </span>
    </button>
  )
}

/* ── 선택된 목표의 태스크 영역 ── */
function GoalTaskPanel({
  goal,
  onToggle,
  onGenerate,
  onDelete,
  isGenerating,
}: {
  goal: Goal
  onToggle: (taskId: string, goalId: string) => void
  onGenerate: (goalId: string) => void
  onDelete: (goalId: string) => void
  isGenerating: boolean
}) {
  const completed = goal.dailyTasks.filter((t) => t.completed).length
  const total = goal.dailyTasks.length
  const allDone = total > 0 && completed === total

  return (
    <div className="flex flex-col h-full animate-slide-up">
      {/* 목표 헤더 */}
      <div className={`rounded-2xl border p-5 mb-5 transition-all duration-700 flex items-center gap-5
                       ${allDone
                         ? 'bg-gradient-to-r from-green-950/40 to-gray-900/60 border-green-900/40'
                         : 'bg-gradient-to-r from-indigo-950/30 to-gray-900/60 border-indigo-900/30'}`}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-bold text-indigo-400 bg-indigo-950/60 border border-indigo-900/40 px-2 py-0.5 rounded-full">
              Day {goal.currentDayIndex}
            </span>
            <DeadlineBadge deadline={goal.deadline} />
          </div>
          <p className="text-white font-black text-lg leading-snug">{goal.title}</p>
          {allDone && (
            <p className="text-sm mt-1.5 font-medium text-green-400">🎉 오늘 완료!</p>
          )}
        </div>
        {total > 0 && <ProgressRing completed={completed} total={total} size={72} />}
      </div>

      {/* ───── 보조: 장기 진행도(단계) ───── */}
      {goal.milestones.length > 0 && (
        <div className="mb-8">
          <MilestoneTrack
            milestones={goal.milestones}
            currentMilestoneId={goal.currentMilestoneId}
            currentDayIndex={goal.currentDayIndex}
          />
        </div>
      )}

      {/* ───── 메인: 오늘의 할 일 ───── */}
      <section>
        <div className="flex items-baseline justify-between mb-3 px-1">
          <h3 className="text-base font-black text-white flex items-center gap-2">
            🎯 오늘의 할 일
          </h3>
          {total > 0 && (
            <span className="text-xs text-gray-500 font-semibold">
              <span className={completed === total ? 'text-green-400' : 'text-indigo-400'}>
                {completed}
              </span>
              <span className="text-gray-700"> / {total} 완료</span>
            </span>
          )}
        </div>

        {/* 태스크 없음 */}
        {total === 0 && (
          <div className="flex flex-col items-center justify-center border border-dashed border-gray-800 rounded-2xl gap-4 py-12">
            <p className="text-gray-600 text-sm">아직 오늘의 할 일이 없어요.</p>
            <button onClick={() => onGenerate(goal.id)} disabled={isGenerating}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40
                         text-white font-bold text-sm px-6 py-3 rounded-xl
                         transition-all active:scale-95 flex items-center gap-2">
              {isGenerating
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />생성 중…</>
                : '✨ 오늘의 할 일 3개 생성하기'}
            </button>
          </div>
        )}

        {/* 태스크 목록 */}
        {total > 0 && (
          <div className="space-y-2.5">
            {goal.dailyTasks.map((task, i) => (
              <TaskCard key={task.id} task={task} index={i}
                onToggle={(id) => onToggle(id, goal.id)} />
            ))}
          </div>
        )}
      </section>

      {/* 하단 컨트롤 */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-800/50">
        <button onClick={() => onGenerate(goal.id)} disabled={isGenerating}
          className="text-xs text-gray-600 hover:text-gray-300 transition-colors disabled:opacity-40
                     flex items-center gap-1.5">
          {isGenerating ? '생성 중…' : '↻ 오늘 할 일 다시 생성'}
        </button>
        <button onClick={() => onDelete(goal.id)}
          className="text-xs text-gray-700 hover:text-red-500 transition-colors">
          목표 삭제
        </button>
      </div>
    </div>
  )
}

/* ── 회고 모달 ── */
function ReflectionModal({
  open,
  onSubmit,
  onSkip,
}: {
  open: boolean
  onSubmit: (difficulty: 1 | 2 | 3) => void
  onSkip: () => void
}) {
  if (!open) return null
  const options: { value: 1 | 2 | 3; emoji: string; label: string; desc: string }[] = [
    { value: 1, emoji: '😰', label: '어려웠어요', desc: '내일은 분량을 줄여드릴게요' },
    { value: 2, emoji: '😊', label: '적당했어요', desc: '이 페이스 그대로' },
    { value: 3, emoji: '😎', label: '쉬웠어요',   desc: '내일 더 도전적으로' },
  ]
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center p-4 animate-pop-in">
      <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-2xl">
        <div className="text-center mb-5">
          <div className="text-4xl mb-2">🎉</div>
          <h2 className="text-xl font-black text-white mb-1">오늘 3개 모두 완료!</h2>
          <p className="text-sm text-gray-500">오늘 페이스, 어땠어요?</p>
        </div>
        <div className="space-y-2.5">
          {options.map((o) => (
            <button
              key={o.value}
              onClick={() => onSubmit(o.value)}
              className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl
                         bg-gray-800 hover:bg-gray-700 active:scale-[0.98]
                         border border-gray-700 hover:border-indigo-500
                         transition-all text-left"
            >
              <span className="text-3xl">{o.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold">{o.label}</p>
                <p className="text-xs text-gray-500">{o.desc}</p>
              </div>
            </button>
          ))}
        </div>
        <button
          onClick={onSkip}
          className="w-full mt-4 text-xs text-gray-600 hover:text-gray-400 transition-colors py-1"
        >
          나중에 답할게요
        </button>
      </div>
    </div>
  )
}

/* ── 토스트 ── */
function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4500)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <div className="fixed left-1/2 bottom-8 z-40 -translate-x-1/2 animate-pop-in">
      <div className="bg-indigo-600 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-2xl shadow-indigo-900/50 flex items-center gap-2 max-w-[90vw]">
        <span>✨</span>
        <span>{message}</span>
      </div>
    </div>
  )
}

/* ── 메인 페이지 ── */
export default function DashboardPage() {
  const router = useRouter()
  const [goals, setGoals] = useState<Goal[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [generatingId, setGeneratingId] = useState<string | null>(null)

  // 회고 모달 상태
  const [reflectingGoalId, setReflectingGoalId] = useState<string | null>(null)

  // 토스트 (조정 안내)
  const [toast, setToast] = useState<string | null>(null)

  const fetchGoals = useCallback(async () => {
    try {
      const res = await fetch('/api/goals')
      if (res.status === 401) { router.push('/auth'); return }
      const data: Goal[] = await res.json()
      setGoals(data)
      // 선택된 목표가 없거나 삭제됐으면 첫 번째로
      setSelectedId((prev) =>
        data.length === 0 ? null
        : data.find((g) => g.id === prev) ? prev
        : data[0].id
      )
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
      return
    }

    // 회고 모달 트리거 — 오늘 3개 모두 완료 + 아직 평가 안 됨
    setGoals((latest) => {
      const target = latest.find((g) => g.id === goalId)
      if (target && target.dailyTasks.length > 0) {
        const allDone = target.dailyTasks.every((t) => t.completed)
        const notReflected = target.dailyTasks.every((t) => t.difficulty == null)
        if (allDone && notReflected) {
          // 살짝 딜레이 — 체크 애니메이션 보고 모달
          setTimeout(() => setReflectingGoalId(goalId), 350)
        }
      }
      return latest
    })
  }

  const handleReflect = async (difficulty: 1 | 2 | 3) => {
    if (!reflectingGoalId) return
    const goalId = reflectingGoalId
    setReflectingGoalId(null)
    // 낙관적 업데이트
    setGoals((prev) => prev.map((g) =>
      g.id !== goalId ? g : {
        ...g,
        dailyTasks: g.dailyTasks.map((t) => ({ ...t, difficulty })),
      }
    ))
    await fetch('/api/tasks/reflect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goalId, difficulty }),
    })
    const messages = {
      1: '내일은 분량을 가볍게 조정해드릴게요',
      2: '좋아요! 이 페이스 그대로',
      3: '내일은 더 도전적인 작업으로 준비할게요',
    }
    setToast(messages[difficulty])
  }

  const handleGenerate = async (goalId: string) => {
    setGeneratingId(goalId)
    try {
      const res = await fetch('/api/tasks/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalId }),
      })
      if (res.ok) {
        const data = await res.json()
        await fetchGoals()
        if (data?.adjustmentNote) {
          setToast(data.adjustmentNote)
        }
      }
    } finally {
      setGeneratingId(null)
    }
  }

  const handleDelete = async (goalId: string) => {
    if (!confirm('이 목표와 할 일을 모두 삭제할까요?')) return
    const res = await fetch(`/api/goals/${goalId}`, { method: 'DELETE' })
    if (res.ok) await fetchGoals()
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/auth')
  }

  const selected = goals.find((g) => g.id === selectedId) ?? null
  const today = new Date().toLocaleDateString('ko-KR', {
    month: 'long', day: 'numeric', weekday: 'short',
  })

  return (
    <div className="h-screen flex flex-col bg-gray-950 overflow-hidden">

      {/* ── 헤더 ── */}
      <header className="flex-shrink-0 border-b border-gray-800/50
                         px-5 md:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-xl font-black tracking-tight select-none">
            <span className="text-white">daily</span>
            <span className="text-indigo-400">·</span>
            <span className="text-white">three</span>
          </span>
          <span className="hidden md:block text-xs text-gray-600">{today}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/goals/new"
            className="text-xs text-gray-400 hover:text-white border border-gray-800
                       hover:border-gray-600 px-3 py-1.5 rounded-lg transition-all">
            + 목표 추가
          </Link>
          <button onClick={handleLogout}
            className="text-xs text-gray-600 hover:text-gray-400 px-3 py-1.5
                       rounded-lg hover:bg-gray-800/60 transition-all">
            로그아웃
          </button>
        </div>
      </header>

      {/* ── 로딩 ── */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-9 h-9 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
        </div>
      )}

      {/* ── 빈 상태 ── */}
      {!loading && goals.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center px-6 animate-slide-up">
          <div className="text-6xl">🎯</div>
          <div>
            <p className="text-xl font-black text-white">첫 번째 목표를 만들어보세요</p>
            <p className="text-gray-600 text-sm mt-1.5">
              큰 꿈을 입력하면 AI가 오늘의 3가지 행동으로 바꿔드려요.
            </p>
          </div>
          <Link href="/goals/new"
            className="bg-indigo-600 hover:bg-indigo-500 active:scale-95
                       text-white font-bold px-8 py-4 rounded-2xl transition-all text-sm">
            + 목표 시작하기
          </Link>
        </div>
      )}

      {/* ── 목표 있음 ── */}
      {!loading && goals.length > 0 && (
        <>
          {/* ━━━ 모바일: 탭 칩 ━━━ */}
          <div className="md:hidden flex-shrink-0 flex gap-2 px-5 py-3
                          overflow-x-auto border-b border-gray-800/50
                          [&::-webkit-scrollbar]:hidden">
            {goals.map((goal) => (
              <MobileTabChip
                key={goal.id}
                goal={goal}
                selected={selectedId === goal.id}
                onClick={() => setSelectedId(goal.id)}
              />
            ))}
          </div>

          {/* ━━━ 콘텐츠 영역 ━━━ */}
          <div className="flex-1 flex overflow-hidden">

            {/* PC 사이드바 */}
            <aside className="hidden md:flex flex-col w-72 flex-shrink-0
                               border-r border-gray-800/50 overflow-y-auto
                               [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-gray-800">
              <div className="p-3 space-y-1.5">
                {goals.map((goal) => (
                  <SidebarGoalItem
                    key={goal.id}
                    goal={goal}
                    selected={selectedId === goal.id}
                    onClick={() => setSelectedId(goal.id)}
                  />
                ))}
              </div>
              <div className="p-3 mt-auto border-t border-gray-800/50">
                <Link href="/goals/new"
                  className="flex items-center justify-center gap-1.5 w-full
                             text-xs text-gray-600 hover:text-gray-300
                             border border-gray-800 border-dashed hover:border-gray-700
                             rounded-xl py-3 transition-all">
                  + 새 목표 추가하기
                </Link>
              </div>
            </aside>

            {/* 메인: 선택된 목표 태스크 */}
            <main className="flex-1 overflow-y-auto px-5 md:px-8 lg:px-12 py-6">
              <div className="max-w-xl mx-auto h-full">
                {/* 모바일 날짜 */}
                <p className="md:hidden text-xs text-gray-600 mb-4">{today}</p>

                {selected ? (
                  <GoalTaskPanel
                    key={selected.id}
                    goal={selected}
                    onToggle={handleToggle}
                    onGenerate={handleGenerate}
                    onDelete={handleDelete}
                    isGenerating={generatingId === selected.id}
                  />
                ) : null}
              </div>
            </main>

          </div>
        </>
      )}

      {/* 회고 모달 — 오늘 3개 모두 완료 시 */}
      <ReflectionModal
        open={reflectingGoalId !== null}
        onSubmit={handleReflect}
        onSkip={() => setReflectingGoalId(null)}
      />

      {/* 토스트 — 회고 응답 또는 다음날 조정 안내 */}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
