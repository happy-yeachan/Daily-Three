// 개발 검증용: 지정된 goalId의 createdAt을 2일 전으로,
// 오늘 생성된 태스크들을 어제로 옮기고 [완료, 미완료, 미완료]로 셋업.
// 그 후 /api/tasks/generate를 호출하면 Day 2 연속성 로직이 작동.
//
// 사용:  node scripts/simulate-yesterday.mjs <goalId>

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const goalId = process.argv[2]

if (!goalId) {
  console.error('Usage: node scripts/simulate-yesterday.mjs <goalId>')
  process.exit(1)
}

const yesterday = new Date()
yesterday.setDate(yesterday.getDate() - 1)
yesterday.setHours(12, 0, 0, 0)

const twoDaysAgo = new Date()
twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
twoDaysAgo.setHours(9, 0, 0, 0)

await prisma.goal.update({
  where: { id: goalId },
  data: { createdAt: twoDaysAgo },
})

const tasks = await prisma.dailyTask.findMany({
  where: { goalId },
  orderBy: { createdAt: 'asc' },
})

if (tasks.length === 0) {
  console.error('No tasks found for this goal')
  await prisma.$disconnect()
  process.exit(1)
}

await prisma.$transaction(
  tasks.map((t, i) =>
    prisma.dailyTask.update({
      where: { id: t.id },
      data: {
        date: yesterday,
        completed: i === 0,
        dayIndex: 1,
      },
    })
  )
)

console.log(`✓ Goal ${goalId}: createdAt → 2일 전`)
console.log(`✓ ${tasks.length}개 태스크 → 어제로 이동`)
console.log(`✓ 완료 상태: [✅ ${tasks[0].title.slice(0, 30)}...] [❌] [❌]`)
console.log(`\n이제 /api/tasks/generate 호출하면 Day 2 연속성 로직이 동작합니다.`)
await prisma.$disconnect()
