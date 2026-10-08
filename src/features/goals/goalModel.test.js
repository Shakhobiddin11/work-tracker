/* global process */
import assert from 'node:assert/strict'
import { deadlineStatus, displayGoalDate, goalProgress, removeGoal, saveGoal, validateGoalForm } from './goalModel.js'
import { createInitialState, isValidState, loadState, STORAGE_KEY } from '../../lib/storage.js'
import { createStateStore } from '../../app/stateStore.js'

const stamp = '2026-10-08T10:00:00.000Z'
const input = { title: ' October income ', target: '100.00', startDate: '2026-10-01', deadline: '2026-10-31' }
const initial = createInitialState()
const created = saveGoal(initial, input, null, { id: 'goal-1', now: stamp })
const goal = created.goals[0]
assert.equal(goal.title, 'October income')
assert.equal(goal.targetCents, 10000)
assert.equal(goal.status, 'active')
assert.equal(isValidState(created), true)
assert.equal(initial.goals.length, 0)
for (const [field, values] of Object.entries({ title: ['', ' ', null], target: ['', '0', '-1', '1.234', '1e3', '90071992547409.92'], startDate: ['', '2026-02-29'], deadline: ['', '2026-02-30', '2026-09-30'] })) {
  for (const value of values) {
    assert.ok(validateGoalForm({ ...input, [field]: value }).errors[field])
    assert.throws(() => saveGoal(initial, { ...input, [field]: value }))
  }
}
assert.deepEqual(validateGoalForm({ ...input, startDate: '2028-02-29', deadline: '2028-02-29' }).errors, {})
assert.equal(validateGoalForm({ ...input, target: '0.01' }).fields.targetCents, 1)
assert.equal(validateGoalForm({ ...input, target: '90071992547409.91' }).fields.targetCents, Number.MAX_SAFE_INTEGER)
const legacyPayment = (id, paidDate, amountCents) => ({ id, paidDate, amountCents, description: 'Payment', createdAt: stamp })
const payment = (id, receivedDate, amountCents) => ({ id, receivedDate, receivedAt: `${receivedDate}T23:59:59.000Z`, amountCents, notes: '', createdAt: stamp, updatedAt: stamp })
const entries = [
  legacyPayment('before', '2026-09-30', 100000),
  legacyPayment('start', '2026-10-01', 2500),
  payment('middle', '2026-10-15', 3000),
  payment('end', '2026-10-31', 4500),
  payment('after', '2026-11-01', 100000),
]
const progress = goalProgress(goal, entries)
assert.equal(progress.receivedCents, 10000n)
assert.equal(progress.remainingCents, 0n)
assert.equal(progress.percentage, '100.00%')
assert.equal(progress.reached, true)
assert.equal(goalProgress(goal, []).percentage, '0.00%')
assert.equal(goalProgress(goal, []).remainingCents, 10000n)
assert.equal(goalProgress(goal, [entries[1]]).percentage, '25.00%')
assert.equal(goalProgress(goal, [entries[1]]).remainingCents, 7500n)
const over = goalProgress(goal, [...entries, payment('extra', '2026-10-31', 5000)])
assert.equal(over.percentage, '150.00%')
assert.equal(over.barPercent, 100)
assert.equal(over.remainingCents, 0n)
const sameDay = { ...goal, startDate: '2026-10-31', deadline: '2026-10-31' }
assert.equal(goalProgress(sameDay, entries).receivedCents, 4500n)
assert.equal(goalProgress({ ...goal, startDate: '2026-10-15' }, entries).receivedCents, 7500n)
assert.equal(goalProgress(goal, entries).receivedCents, 10000n) // Independent overlapping targets.
const large = goalProgress({ ...goal, targetCents: Number.MAX_SAFE_INTEGER }, [payment('large-1', '2026-10-31', Number.MAX_SAFE_INTEGER), payment('large-2', '2026-10-31', Number.MAX_SAFE_INTEGER)])
assert.equal(large.receivedCents, BigInt(Number.MAX_SAFE_INTEGER) * 2n)
assert.equal(large.percentage, '200.00%')
assert.equal(deadlineStatus('2026-10-31', '2026-10-30'), 'Deadline upcoming')
assert.equal(deadlineStatus('2026-10-31', '2026-10-31'), 'Deadline today')
assert.equal(deadlineStatus('2026-10-31', '2026-11-01'), 'Deadline past')
assert.equal(deadlineStatus(null, '2026-10-31'), 'No deadline')
assert.equal(displayGoalDate('2026-10-31'), new Date('2026-10-31T12:00:00.000Z').toLocaleDateString(undefined, { timeZone: 'UTC' }))
const state = { ...created, incomeEntries: entries }
assert.equal(isValidState(state), true)
const edited = saveGoal(state, { ...input, title: ' Revised ', target: '200', startDate: '2026-10-15' }, 'goal-1', { now: '2026-10-09T10:00:00.000Z' })
assert.equal(edited.goals[0].title, 'Revised')
assert.equal(edited.goals[0].id, goal.id)
assert.equal(edited.goals[0].createdAt, stamp)
assert.equal(edited.goals[0].updatedAt, '2026-10-09T10:00:00.000Z')
assert.equal(goalProgress(edited.goals[0], entries).receivedCents, 7500n)
assert.equal(goal.title, 'October income')
assert.equal(removeGoal(edited, 'goal-1'), edited)
assert.equal(removeGoal(edited, 'goal-1', false), edited)
assert.equal(removeGoal(edited, 'goal-1', 'true'), edited)
const removed = removeGoal(edited, 'goal-1', true)
assert.equal(removed.goals.length, 0)
assert.equal(removed.incomeEntries, entries)
assert.equal(removeGoal(removed, 'goal-1', true), removed)
assert.throws(() => saveGoal(initial, input, 'missing'))
const legacy = { id: 'legacy', title: 'Existing goal', targetCents: 20000, status: 'archived', createdAt: stamp, updatedAt: stamp }
assert.equal(isValidState({ ...initial, goals: [legacy] }), true)
assert.equal(isValidState({ ...initial, goals: [{ ...legacy, deadline: null }] }), true)
assert.equal(goalProgress(legacy, entries), null)
assert.equal(goalProgress({ ...legacy, deadline: '2026-10-31' }, entries), null)
const upgraded = saveGoal({ ...initial, goals: [legacy] }, input, 'legacy')
assert.equal(upgraded.goals[0].id, 'legacy')
assert.equal(upgraded.goals[0].status, 'archived')
assert.equal(isValidState(upgraded), true)
for (const overrides of [{ startDate: null }, { startDate: '2026-02-30' }, { deadline: null }, { deadline: '2026-09-30' }, { targetCents: 0 }]) assert.equal(isValidState({ ...created, goals: [{ ...goal, ...overrides }] }), false)
let raw = JSON.stringify({ ...state, goals: [legacy] })
let writes = 0
globalThis.window = { localStorage: { getItem: () => raw, setItem: (key, value) => { assert.equal(key, STORAGE_KEY); raw = value; writes++ } } }
const store = createStateStore()
assert.equal(writes, 0)
assert.equal(store.getSnapshot().data.goals[0].id, 'legacy')
store.setData(previous => saveGoal(previous, input, 'legacy'))
assert.equal(loadState().data.goals[0].startDate, input.startDate)
assert.equal(goalProgress(loadState().data.goals[0], entries).receivedCents, 10000n)
const beforeCancel = raw
const beforeWrites = writes
store.setData(previous => removeGoal(previous, 'legacy', false))
assert.equal(raw, beforeCancel)
assert.equal(writes, beforeWrites)
store.setData(previous => removeGoal(previous, 'legacy', true))
assert.equal(loadState().data.goals.length, 0)
assert.equal(loadState().data.incomeEntries.length, entries.length)
raw = '{broken'
const invalidStore = createStateStore()
invalidStore.setData(() => created)
assert.equal(raw, '{broken')
assert.match(invalidStore.getSnapshot().notice, /preserved/)
raw = JSON.stringify(initial)
window.localStorage.setItem = () => { throw Error('quota') }
const blockedStore = createStateStore()
blockedStore.setData(previous => saveGoal(previous, input, null, { id: 'temporary', now: stamp }))
assert.equal(blockedStore.getSnapshot().data.goals.length, 1)
assert.match(blockedStore.getSnapshot().notice, /could not be saved/)
assert.equal(JSON.parse(raw).goals.length, 0)
process.stdout.write('Goals checks passed: validation, inclusive boundaries, independent/over-target progress, deadlines, lifecycle, legacy compatibility, persistence, and preservation.\n')
