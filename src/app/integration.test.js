/* global process */
import assert from 'node:assert/strict'
import { createStateStore } from './stateStore.js'
import { STORAGE_KEY } from '../lib/storage.js'
import { saveProject, changeProjectStatus } from '../features/projects/projectModel.js'
import { startTimer, stopTimer } from '../features/timer/timerModel.js'
import { saveIncome, removeIncome } from '../features/income/incomeModel.js'
import { saveGoal, removeGoal, goalProgress } from '../features/goals/goalModel.js'
import { dashboardOverview } from '../features/dashboard/dashboardModel.js'

let raw = null
let writes = 0
globalThis.window = { localStorage: {
  getItem: () => raw,
  setItem: (key, value) => { assert.equal(key, STORAGE_KEY); raw = value; writes++ },
} }
let store = createStateStore()
const stamp = '2026-10-08T10:00:00.000Z'
const projectInput = { name: ' Client work ', clientName: ' Client ', hourlyRate: '125.50' }
const paymentInput = { amount: '10.29', receivedDate: '2026-10-08', projectId: 'project', notes: ' Payment ' }
const goalInput = { title: ' Income target ', target: '20.58', startDate: '2026-10-08', deadline: '2026-10-09' }
const update = operation => assert.equal(store.setData(operation), true)
const reload = () => {
  const previous = store.getSnapshot().data
  store = createStateStore()
  assert.deepEqual(store.getSnapshot().data, previous)
}
function checkIncome(cents, percentage) {
  const data = store.getSnapshot().data
  const overview = dashboardOverview(data)
  assert.equal(overview.receivedCents, cents)
  assert.deepEqual(overview.goals[0].progress, goalProgress(data.goals[0], data.incomeEntries))
  assert.equal(overview.goals[0].progress.percentage, percentage)
}

update(data => saveProject(data, projectInput, null, { id: 'project', now: stamp }))
update(data => startTimer(data, 'project', { id: 'session', startedAt: stamp }))
reload()
assert.equal(dashboardOverview(store.getSnapshot().data, Date.parse(stamp) + 65000).runningTimer.seconds, 65)
update(data => changeProjectStatus(data, 'project', 'archived', stamp))
assert.throws(() => startTimer(store.getSnapshot().data, 'project'))
update(data => stopTimer(data, 'session', ' Finished ', '2026-10-08T10:01:05.000Z'))
const stoppedWrites = writes
update(data => stopTimer(data, 'session'))
assert.equal(writes, stoppedWrites)
reload()
assert.equal(store.getSnapshot().data.activeTimer, null)
assert.equal(store.getSnapshot().data.sessions.length, 1)
assert.equal(dashboardOverview(store.getSnapshot().data).trackedSeconds, 65n)
assert.equal(dashboardOverview(store.getSnapshot().data).recentSessions[0].projectName, 'Client work (archived)')
update(data => saveIncome(data, paymentInput, null, { id: 'payment', now: stamp }))
update(data => saveGoal(data, goalInput, null, { id: 'goal', now: stamp }))
checkIncome(1029n, '50.00%')
reload()
assert.equal(dashboardOverview(store.getSnapshot().data).recentPayments[0].projectName, 'Client work (archived)')
update(data => saveProject(data, { ...projectInput, name: 'Renamed work' }, 'project', { now: stamp }))
assert.equal(dashboardOverview(store.getSnapshot().data).recentSessions[0].projectName, 'Renamed work (archived)')
update(data => saveIncome(data, { ...paymentInput, amount: '30.87' }, 'payment', { now: stamp }))
checkIncome(3087n, '150.00%')
assert.equal(dashboardOverview(store.getSnapshot().data).goals[0].progress.remainingCents, 0n)
update(data => saveIncome(data, { ...paymentInput, amount: '30.87', receivedDate: '2026-10-10' }, 'payment', { now: stamp }))
checkIncome(3087n, '0.00%') // Outside the goal range, but still recorded income.
update(data => saveIncome(data, { ...paymentInput, receivedDate: '2026-10-09' }, 'payment', { now: stamp }))
checkIncome(1029n, '50.00%') // Deadline is inclusive.
const beforeCancel = store.getSnapshot()
const cancelWrites = writes
update(data => removeIncome(data, 'payment', false))
update(data => removeGoal(data, 'goal', false))
assert.equal(store.getSnapshot(), beforeCancel)
assert.equal(writes, cancelWrites)
update(data => removeIncome(data, 'payment', true))
checkIncome(0n, '0.00%')
reload()
update(data => saveGoal(data, { ...goalInput, title: 'Edited target' }, 'goal', { now: stamp }))
update(data => removeGoal(data, 'goal', true))
update(data => changeProjectStatus(data, 'project', 'active', stamp))
assert.equal(store.getSnapshot().data.sessions[0].projectId, 'project')
assert.equal(dashboardOverview(store.getSnapshot().data).activeProjectCount, 1)
reload()

window.localStorage.setItem = () => { throw new Error('quota') }
const persisted = raw
update(data => saveIncome(data, paymentInput, null, { id: 'temporary', now: stamp }))
assert.match(store.getSnapshot().notice, /could not be saved/)
assert.equal(dashboardOverview(store.getSnapshot().data).receivedCents, 1029n)
assert.equal(raw, persisted)
raw = '{invalid'
store = createStateStore()
update(data => saveProject(data, projectInput, null, { id: 'temporary-project', now: stamp }))
assert.equal(raw, '{invalid')
assert.match(store.getSnapshot().notice, /preserved/)
process.stdout.write('Integration checks passed: full flow, reloads, archived references, duplicate Stop, income/goal/dashboard consistency, cancellation, and storage failures.\n')
