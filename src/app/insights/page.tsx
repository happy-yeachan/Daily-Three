'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface DayStat { date: string; dayName: string; total: number; completed: number }
interface GoalSummary {
  id: string
  title: string
  status: 'active' | 'paused' | 'completed' | 'archived'
  deadline: string | null
  currentDayIndex: number
  todayCompleted: number
  todayTotal: number
  totalEver: number
  completedEver: number
  overallRate: number
  currentMilestone: { order: number; title: string } | null
  totalMilestones: number
  completedMilestones: number
}
interface InsightsResponse {
  stats7days: DayStat[]
  streak: number
  reflection: { hard: number; medium: number; easy: number; total: number }
  goals: GoalSummary[]
  summary: {
    totalGoals: number
    activeGoals: number
    completedGoals: number
    pausedGoals: number
    totalTasksEver: number
    totalCompletedEver: number
    overallRate: number
  }
}

/* ── 7일 막대 그래프 ── */
function WeeklyChart({ stats }: { stats: DayStat[] }) {
  const maxTotal = Math.max(3, ...stats.map((s) => s.total))
  const todayDate = new Date().toISOString().split('T')[0]

  return (
    <div className="flex items-end justify-between gap-1.5 h-40 lg:h-56 px-1">
      {stats.map((s) => {
        const totalH = (s.total / maxTotal) * 100
        const completedH = s.total > 0 ? (s.completed / s.total) * totalH : 0
        const isToday = s.date === todayDate
        const allDone = s.total > 0 && s.completed === s.total
        return (
          <div key={s.date} className="flex-1 flex flex-col items-center justify-end gap-1.5 group">
            {/* 막대 */}
            <div className="relative w-full flex-1 flex items-end">
              <div
                className="w-full bg-gray-800 rounded-t-md relative transition-all duration-500"
                style={{ height: `${Math.max(2, totalH)}%` }}
              >
                <div
                  className={`absolute bottom-0 left-0 right-0 rounded-t-md transition-all duration-700
                              ${allDone ? 'bg-green-500' : 'bg-indigo-500'}`}
                  style={{ height: `${(completedH / Math.max(1, totalH)) * 100}%` }}
                />
                {/* 호버 툴팁 */}
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block
                                bg-gray-800 text-white text-[10px] font-bold px-2 py-1 rounded whitespace-nowrap">
                  {s.completed}/{s.total}
                </div>
              </div>
            </div>
            {/* 요일 */}
            <span className={`text-xs font-bold ${isToday ? 'text-indigo-400' : 'text-gray-600'}`}>
              {s.dayName}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/* ── 회고 분포 막대 ── */
function ReflectionBars({ data }: { data: { hard: number; medium: number; easy: number; total: number } }) {
  if (data.total === 0) {
    return (
      <p className="text-xs text-gray-600 text-center py-6">
        아직 회고 데이터가 없어요. 오늘 3개를 모두 완료하면 평가를 남길 수 있어요.
      </p>
    )
  }
  const rows = [
    { key: 'hard',   emoji: '😰', label: '어려웠음', count: data.hard,   color: 'bg-amber-500' },
    { key: 'medium', emoji: '😊', label: '적당',    count: data.medium, color: 'bg-indigo-500' },
    { key: 'easy',   emoji: '😎', label: '쉬웠음',   count: data.easy,   color: 'bg-green-500' },
  ]
  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const pct = data.total > 0 ? (r.count / data.total) * 100 : 0
        return (
          <div key={r.key} className="flex items-center gap-3">
            <span className="text-xl flex-shrink-0">{r.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-xs text-gray-400">{r.label}</span>
                <span className="text-xs font-bold text-gray-300">
                  {Math.round(pct)}% <span className="text-gray-600">({r.count})</span>
                </span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full ${r.color} transition-all duration-700 rounded-full`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── 메인 페이지 ── */
export default function InsightsPage() {
  const router = useRouter()
  const [data, setData] = useState<InsightsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/insights')
        if (res.status === 401) { router.push('/auth'); return }
        setData(await res.json())
      } finally {
        setLoading(false)
      }
    })()
  }, [router])

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <header className="sticky top-0 z-10 bg-gray-950/80 backdrop-blur-md
                         border-b border-gray-800/40 px-5 md:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard"
            className="text-gray-500 hover:text-white transition-colors text-sm flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            대시보드
          </Link>
        </div>
        <h1 className="text-base lg:text-lg font-black text-white">📊 인사이트</h1>
        <div className="w-16" />
      </header>

      <main className="flex-1 px-5 md:px-8 py-6 lg:py-8 max-w-3xl lg:max-w-6xl mx-auto w-full">
        {loading && (
          <div className="flex items-center justify-center py-32">
            <div className="w-9 h-9 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
          </div>
        )}

        {!loading && data && data.summary.totalGoals === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
            <div className="text-6xl">📊</div>
            <p className="text-white font-bold">아직 데이터가 없어요</p>
            <p className="text-gray-600 text-sm">목표를 만들고 며칠 진행하면 인사이트가 쌓여요.</p>
            <Link href="/dashboard"
              className="mt-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold
                         px-6 py-3 rounded-xl text-sm transition-colors">
              대시보드로 가기
            </Link>
          </div>
        )}

        {!loading && data && data.summary.totalGoals > 0 && (
          <div className="animate-slide-up space-y-5 lg:space-y-6">

            {/* ━━━━━━━ ROW 1: 요약 + 스트릭 ━━━━━━━ */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-5">

              {/* Summary 3카드 — PC: 7col, 모바일: full */}
              <div className="lg:col-span-7 grid grid-cols-3 gap-3">
                <SummaryCard
                  label="활성 목표"
                  value={`${data.summary.activeGoals}개`}
                  sub={data.summary.completedGoals > 0 ? `달성 ${data.summary.completedGoals}` : null}
                />
                <SummaryCard
                  label="누적 완료"
                  value={`${data.summary.totalCompletedEver}개`}
                  sub={`전체 ${data.summary.totalTasksEver}개 중`}
                />
                <SummaryCard
                  label="전체 완료율"
                  value={`${Math.round(data.summary.overallRate * 100)}%`}
                  accent={data.summary.overallRate >= 0.6 ? 'green' : data.summary.overallRate >= 0.3 ? 'amber' : 'gray'}
                />
              </div>

              {/* Streak — PC: 5col, 모바일: full */}
              <div className="lg:col-span-5 bg-gradient-to-br from-orange-950/40 to-gray-900/60
                              border border-orange-900/30 rounded-2xl p-5 lg:p-6
                              flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-1">연속 활동</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl lg:text-4xl font-black text-white">{data.streak}</span>
                    <span className="text-sm text-gray-400 font-medium">일 연속</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    {data.streak === 0 ? '오늘 한 가지라도 완료해보세요' :
                     data.streak < 3 ? '좋은 시작이에요' :
                     data.streak < 7 ? '리듬이 만들어지고 있어요' :
                     data.streak < 30 ? '정말 꾸준하시네요' :
                     '습관이 되었어요!'}
                  </p>
                </div>
                <div className="text-5xl lg:text-6xl">🔥</div>
              </div>
            </section>

            {/* ━━━━━━━ ROW 2: 7일 차트 + 회고 분포 ━━━━━━━ */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-5">

              {/* 7일 차트 — PC: 8col */}
              <div className="lg:col-span-8 bg-gray-900/40 border border-gray-800/60 rounded-2xl p-5 lg:p-6">
                <div className="flex items-baseline justify-between mb-4 lg:mb-5">
                  <h2 className="text-sm lg:text-base font-black text-white">최근 7일</h2>
                  <span className="text-[10px] text-gray-600 uppercase tracking-widest">
                    완료 / 전체
                  </span>
                </div>
                <WeeklyChart stats={data.stats7days} />
                <p className="text-[10px] text-gray-700 mt-3 text-center">
                  인디고 = 진행 중 · 초록 = 그날 모두 완료
                </p>
              </div>

              {/* 회고 분포 — PC: 4col */}
              <div className="lg:col-span-4 bg-gray-900/40 border border-gray-800/60 rounded-2xl p-5 lg:p-6">
                <h2 className="text-sm lg:text-base font-black text-white mb-4 lg:mb-5">
                  자가 평가 분포
                </h2>
                <ReflectionBars data={data.reflection} />
              </div>
            </section>

            {/* ━━━━━━━ ROW 3: 목표별 진행 ━━━━━━━ */}
            {data.goals.length > 0 && (
              <section>
                <div className="flex items-baseline justify-between mb-3 px-1">
                  <h2 className="text-sm lg:text-base font-black text-white">목표별 진행</h2>
                  <span className="text-[10px] text-gray-600 uppercase tracking-widest">
                    {data.goals.length}개
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5 lg:gap-3">
                  {data.goals.map((g) => (
                    <GoalSummaryCard key={g.id} goal={g} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

/* ── 요약 카드 ── */
function SummaryCard({ label, value, sub, accent }: {
  label: string; value: string; sub?: string | null; accent?: 'green' | 'amber' | 'gray'
}) {
  const valueCls = accent === 'green' ? 'text-green-400'
                  : accent === 'amber' ? 'text-amber-400'
                  : accent === 'gray' ? 'text-gray-500'
                  : 'text-white'
  return (
    <div className="bg-gray-900/40 border border-gray-800/60 rounded-2xl px-4 py-3.5">
      <p className="text-[10px] text-gray-600 uppercase tracking-widest font-bold mb-1">{label}</p>
      <p className={`text-2xl font-black ${valueCls}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-700 mt-0.5">{sub}</p>}
    </div>
  )
}

/* ── 목표별 카드 ── */
function GoalSummaryCard({ goal }: { goal: GoalSummary }) {
  const days = goal.deadline
    ? Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / 86400000)
    : null
  const dimmed = goal.status !== 'active'
  const ratePct = Math.round(goal.overallRate * 100)
  const rateColor = goal.overallRate >= 0.6 ? 'text-green-400'
                  : goal.overallRate >= 0.3 ? 'text-amber-400' : 'text-gray-500'

  return (
    <div className={`rounded-2xl border border-gray-800 bg-gray-900 px-4 py-3.5 ${dimmed ? 'opacity-60' : ''}`}>
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <p className="text-sm font-bold text-white truncate">{goal.title}</p>
        {goal.status === 'completed' && (
          <span className="text-[10px] font-bold text-green-400 flex-shrink-0">✓ 달성</span>
        )}
        {goal.status === 'paused' && (
          <span className="text-[10px] font-bold text-amber-400 flex-shrink-0">일시정지</span>
        )}
        {goal.status === 'active' && days !== null && (
          <span className="text-[10px] font-bold text-gray-500 flex-shrink-0">
            {days > 0 ? `D-${days}` : days === 0 ? 'D-DAY' : `D+${Math.abs(days)}`}
          </span>
        )}
      </div>
      {goal.currentMilestone && (
        <p className="text-xs text-gray-500 mb-2.5">
          <span className="text-indigo-400 font-bold">{goal.currentMilestone.order}/{goal.totalMilestones}단계</span>
          <span className="text-gray-700"> · </span>
          {goal.currentMilestone.title}
        </p>
      )}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              goal.overallRate >= 0.6 ? 'bg-green-500'
              : goal.overallRate >= 0.3 ? 'bg-amber-500' : 'bg-gray-600'
            }`}
            style={{ width: `${ratePct}%` }}
          />
        </div>
        <span className="text-[10px] text-gray-600 font-bold whitespace-nowrap">
          <span className={rateColor}>{goal.completedEver}</span>
          <span className="text-gray-700">/{goal.totalEver}</span>
        </span>
      </div>
      {goal.status === 'active' && goal.todayTotal > 0 && (
        <p className="text-[10px] text-gray-600 mt-2">
          오늘 {goal.todayCompleted}/{goal.todayTotal} 완료
        </p>
      )}
    </div>
  )
}
