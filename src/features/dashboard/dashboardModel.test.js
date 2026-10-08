/* global process */
import assert from 'node:assert/strict'
import { dashboardOverview, projectLabel } from './dashboardModel.js'
import { createInitialState } from '../../lib/storage.js'
import { goalProgress } from '../goals/goalModel.js'
import { totalIncomeCents } from '../income/incomeModel.js'
import { formatDuration } from '../timer/timerModel.js'

const empty = dashboardOverview(createInitialState())
assert.equal(empty.activeProjectCount, 0)
assert.equal(empty.trackedSeconds, 0n)
assert.equal(empty.receivedCents, 0n)
assert.equal(empty.runningTimer, null)
assert.deepEqual(empty.recentSessions, [])
assert.deepEqual(empty.recentPayments, [])
assert.deepEqual(empty.goals, [])
assert.equal(formatDuration(empty.trackedSeconds), '00:00:00')

const stamp = '2026-10-08T10:00:00.000Z'
const state = createInitialState()
state.projects = [
  { id: 'active', name: 'Current work', status: 'active', hourlyRateCents: 10000 },
  { id: 'archived', name: 'Past work', status: 'archived', hourlyRateCents: 20000 },
]
state.sessions = [
  { id: 'older', projectId: 'archived', startedAt: '2026-10-07T10:00:00.000Z', durationSeconds: 3600 },
  { id: 'newer', projectId: 'active', startedAt: stamp, durationSeconds: 62 },
  { id: 'unassigned', projectId: null, startedAt: '2026-10-06T10:00:00.000Z', durationSeconds: 0 },
]
state.incomeEntries = [
  { id: 'old-payment', paidDate: '2026-10-07', amountCents: 500, description: 'Legacy payment', createdAt: stamp, projectId: 'archived' },
  { id: 'new-payment', receivedDate: '2026-10-08', receivedAt: stamp, amountCents: 2000, notes: 'New payment', createdAt: stamp },
]
state.goals = [
  { id: 'goal-1', title: 'Income target', targetCents: 1000, startDate: '2026-10-07', deadline: '2026-10-08' },
  { id: 'goal-2', title: 'Overlapping target', targetCents: 5000, startDate: '2026-10-08', deadline: '2026-10-09' },
  { id: 'legacy', title: 'Legacy goal', targetCents: 10000 },
]
state.activeTimer = { id: 'running', projectId: 'archived', startedAt: stamp }
const original = structuredClone(state)
const overview = dashboardOverview(state, Date.parse(stamp) + 150000)
assert.equal(overview.activeProjectCount, 1)
assert.equal(overview.trackedSeconds, 3662n)
assert.equal(formatDuration(overview.trackedSeconds), '01:01:02')
assert.equal(overview.receivedCents, totalIncomeCents(state.incomeEntries))
assert.equal(overview.receivedCents, 2500n) // Excludes hourly rates and work sessions.
assert.equal(overview.runningTimer.seconds, 150)
assert.equal(overview.runningTimer.projectName, 'Past work (archived)')
assert.equal(overview.recentSessions[0].id, 'newer')
assert.equal(overview.recentSessions[1].projectName, 'Past work (archived)')
assert.equal(overview.recentSessions[2].projectName, 'Unassigned project')
assert.equal(overview.recentPayments[0].id, 'new-payment')
assert.equal(overview.recentPayments[0].projectName, 'No project')
assert.equal(overview.recentPayments[1].projectName, 'Past work (archived)')
for (let i = 0; i < state.goals.length; i++) assert.deepEqual(overview.goals[i].progress, goalProgress(state.goals[i], state.incomeEntries))
assert.equal(overview.goals[0].progress.percentage, '250.00%')
assert.equal(overview.goals[0].progress.remainingCents, 0n)
assert.equal(overview.goals[1].progress.receivedCents, 2000n)
assert.equal(overview.goals[2].progress, null)
assert.deepEqual(state, original) // Derivation never sorts or writes Context in place.
assert.equal(projectLabel(state.projects, 'missing'), 'Unavailable project (missing)')
assert.equal(projectLabel(state.projects, null), 'No project')
assert.equal(dashboardOverview(state, Date.parse(stamp) - 1).runningTimer.seconds, null)
assert.equal(dashboardOverview(state, Date.parse(stamp) + 86400000).runningTimer.seconds, 86400)
const large = { ...state, sessions: [{ id: 'a', startedAt: stamp, durationSeconds: Number.MAX_SAFE_INTEGER }, { id: 'b', startedAt: stamp, durationSeconds: Number.MAX_SAFE_INTEGER }] }
assert.equal(dashboardOverview(large).trackedSeconds, BigInt(Number.MAX_SAFE_INTEGER) * 2n)
assert.equal(formatDuration(dashboardOverview(large).trackedSeconds), '5003999585967:13:02')
const many = { ...state, sessions: [], incomeEntries: [] }
for (let day = 1; day <= 8; day++) {
  const date = `2026-10-${String(day).padStart(2, '0')}`
  many.sessions.push({ id: `s-${day}`, startedAt: `${date}T00:00:00.000Z`, durationSeconds: 1 })
  many.incomeEntries.push({ id: `p-${day}`, paidDate: date, amountCents: 1, createdAt: stamp })
}
const limited = dashboardOverview(many)
assert.equal(limited.recentSessions.length, 5)
assert.equal(limited.recentSessions[0].id, 's-8')
assert.equal(limited.recentPayments.length, 5)
assert.equal(limited.recentPayments[0].id, 'p-8')
assert.equal(limited.trackedSeconds, 8n) // Totals include every record, not just previews.
assert.equal(limited.receivedCents, 8n)
process.stdout.write('Dashboard checks passed: empty data, exact totals, timer state, archived references, shared goal progress, ordering, preview limits, and immutable derivation.\n')
