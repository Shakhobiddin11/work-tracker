/* global process */
import assert from 'node:assert/strict'
import { elapsedSeconds, formatDuration, startTimer, stopTimer } from './timerModel.js'
import { createInitialState, isValidActiveTimer, isValidState, loadState, STORAGE_KEY } from '../../lib/storage.js'
import { createStateStore } from '../../app/stateStore.js'
import { changeProjectStatus } from '../projects/projectModel.js'

const startedAt = '2026-10-08T10:00:00.000Z'
const endedAt = '2026-10-08T11:01:02.900Z'
const initial = createInitialState()
initial.projects = [{ id: 'project-1', name: 'Website', description: '', status: 'active', hourlyRateCents: 5000, createdAt: startedAt, updatedAt: startedAt }]
const options = { id: 'timer-1', startedAt }
const running = startTimer(initial, 'project-1', options)
assert.equal(initial.activeTimer, null)
assert.deepEqual(running.activeTimer, { id: 'timer-1', projectId: 'project-1', startedAt })
assert.equal(isValidState(initial), true)
assert.equal(isValidState(running), true)
assert.equal(elapsedSeconds(startedAt, Date.parse(endedAt)), 3662)
assert.equal(formatDuration(3662), '01:01:02')
assert.equal(formatDuration(360000), '100:00:00')
// A single read after a long background delay is enough; no interval count needed.
assert.equal(elapsedSeconds(startedAt, Date.parse(startedAt) + 86400123), 86400)
assert.equal(formatDuration(86400), '24:00:00')
assert.equal(elapsedSeconds(startedAt, Date.parse(startedAt)), 0)
assert.equal(elapsedSeconds(startedAt, Date.parse(startedAt) - 1), null)
for (const invalid of ['bad', '2026-02-30T10:00:00.000Z', '2026-10-08T25:00:00.000Z', null, 123]) {
  assert.equal(elapsedSeconds(invalid, Date.parse(endedAt)), null)
  assert.equal(isValidActiveTimer({ ...running.activeTimer, startedAt: invalid }), false)
  assert.throws(() => startTimer(initial, 'project-1', { ...options, startedAt: invalid }))
}
assert.equal(elapsedSeconds(startedAt, Infinity), null)
assert.equal(elapsedSeconds(startedAt, NaN), null)
assert.throws(() => startTimer(running, 'project-1'), /already running/)
assert.throws(() => startTimer(initial, 'missing'), /active project/)
const archived = changeProjectStatus(running, 'project-1', 'archived', endedAt)
assert.throws(() => startTimer({ ...archived, activeTimer: null }, 'project-1'), /active project/)
assert.equal(archived.activeTimer, running.activeTimer)
const stopped = stopTimer(archived, 'timer-1', '  Finished the homepage \n', endedAt)
assert.equal(isValidState(stopped), true)
assert.equal(stopped.activeTimer, null)
assert.equal(stopped.projects[0].status, 'archived')
assert.deepEqual(stopped.sessions[0], {
  id: 'timer-1', projectId: 'project-1', startedAt, endedAt, durationSeconds: 3662, notes: 'Finished the homepage',
})
assert.equal(running.sessions.length, 0)
assert.equal(stopTimer(stopped, 'timer-1', '', endedAt), stopped)
assert.equal(stopTimer(running, 'old-timer', '', endedAt), running)
for (const ended of ['bad', '2026-10-08T09:59:59.999Z']) {
  const result = stopTimer(running, 'timer-1', '', ended)
  assert.equal(result.activeTimer, null)
  assert.equal(result.sessions.length, 0)
}
assert.equal(stopTimer({ ...running, activeTimer: { ...running.activeTimer, startedAt: 'bad' } }, 'timer-1', '', endedAt).activeTimer, null)
assert.equal(running.activeTimer.startedAt, startedAt)
for (const ended of ['2026-10-08T10:00:00.000Z', '2026-10-08T10:00:00.500Z', '2026-10-08T10:00:00.999Z']) {
  const result = stopTimer(running, 'timer-1', '', ended)
  assert.equal(result.activeTimer, null)
  assert.equal(result.sessions, running.sessions)
  assert.equal(isValidState(result), true)
  assert.equal(stopTimer(result, 'timer-1', '', ended), result)
  assert.equal(running.activeTimer.id, 'timer-1')
  assert.equal(running.sessions.length, 0)
}
const oneSecond = stopTimer(running, 'timer-1', ' Boundary ', '2026-10-08T10:00:01.000Z')
assert.equal(oneSecond.sessions.length, 1)
assert.equal(oneSecond.sessions[0].durationSeconds, 1)
assert.equal(oneSecond.sessions[0].notes, 'Boundary')
assert.equal(isValidState(oneSecond), true)
assert.equal(stopTimer(oneSecond, 'timer-1'), oneSecond)
// Existing v1 zero-duration sessions still load; only new stops have a minimum.
assert.equal(isValidState({ ...oneSecond, sessions: [{ ...oneSecond.sessions[0], durationSeconds: 0 }] }), true)
assert.equal(isValidState({ ...stopped, activeTimer: running.activeTimer }), false)
for (const field of ['id', 'projectId', 'startedAt']) {
  const incomplete = { ...running.activeTimer }
  delete incomplete[field]
  assert.equal(isValidState({ ...running, activeTimer: incomplete }), false)
}
for (const id of ['', ' ', null, 3]) {
  assert.equal(isValidState({ ...running, activeTimer: { ...running.activeTimer, id } }), false)
  assert.equal(isValidState({ ...running, activeTimer: { ...running.activeTimer, projectId: id } }), false)
}
// Missing or archived projects do not invalidate a persisted running timer.
assert.equal(isValidState({ ...running, projects: [] }), true)
assert.equal(stopTimer({ ...running, projects: [] }, 'timer-1', '', endedAt).sessions[0].projectId, 'project-1')

let raw = JSON.stringify(initial)
let writes = 0
globalThis.window = { localStorage: {
  getItem: () => raw,
  setItem: (key, value) => { assert.equal(key, STORAGE_KEY); writes++; raw = value },
} }
const store = createStateStore()
assert.equal(writes, 0)
store.setData(state => startTimer(state, 'project-1', options))
assert.equal(writes, 1)
const afterRefresh = createStateStore()
assert.deepEqual(afterRefresh.getSnapshot().data.activeTimer, running.activeTimer)
assert.equal(elapsedSeconds(afterRefresh.getSnapshot().data.activeTimer.startedAt, Date.parse(endedAt)), 3662)
const beforeFailure = afterRefresh.getSnapshot()
const rawBeforeFailure = raw
for (const ended of ['2026-10-08T10:00:00.000Z', '2026-10-08T10:00:00.999Z']) {
  raw = rawBeforeFailure
  const shortStore = createStateStore()
  const writesBefore = writes
  shortStore.setData(state => stopTimer(state, 'timer-1', 'discard note', ended))
  assert.equal(shortStore.getSnapshot().data.activeTimer, null)
  assert.equal(shortStore.getSnapshot().data.sessions.length, 0)
  assert.equal(writes, writesBefore + 1)
  assert.equal(createStateStore().getSnapshot().data.activeTimer, null)
  shortStore.setData(state => stopTimer(state, 'timer-1', '', endedAt))
  assert.equal(writes, writesBefore + 1)
}
raw = rawBeforeFailure
const boundaryStore = createStateStore()
boundaryStore.setData(state => stopTimer(state, 'timer-1', '', '2026-10-08T10:00:01.000Z'))
const boundaryWrites = writes
boundaryStore.setData(state => stopTimer(state, 'timer-1', '', '2026-10-08T10:00:01.000Z'))
assert.equal(writes, boundaryWrites)
assert.equal(loadState().data.sessions.length, 1)
assert.equal(loadState().data.sessions[0].durationSeconds, 1)
raw = rawBeforeFailure
const discardedFuture = stopTimer(afterRefresh.getSnapshot().data, 'timer-1', '', '2026-10-08T09:00:00.000Z')
assert.equal(discardedFuture.activeTimer, null)
assert.equal(discardedFuture.sessions.length, 0)
assert.equal(afterRefresh.getSnapshot(), beforeFailure)
assert.equal(raw, rawBeforeFailure)
afterRefresh.setData(state => changeProjectStatus(state, 'project-1', 'archived', endedAt))
afterRefresh.setData(state => stopTimer(state, 'timer-1', ' Saved ', endedAt))
const writesAfterStop = writes
afterRefresh.setData(state => stopTimer(state, 'timer-1', 'Repeated', endedAt))
assert.equal(writes, writesAfterStop)
const persisted = loadState()
assert.equal(persisted.canSave, true)
assert.equal(persisted.data.activeTimer, null)
assert.equal(persisted.data.sessions.length, 1)
assert.equal(persisted.data.sessions[0].notes, 'Saved')
// A stale Stop from timer 1 cannot stop a subsequently started timer 2.
const another = startTimer(changeProjectStatus(stopped, 'project-1', 'active', endedAt), 'project-1', { id: 'timer-2', startedAt: endedAt })
assert.equal(another.activeTimer.id, 'timer-2')
assert.equal(stopTimer(another, 'timer-1', '', endedAt), another)
assert.throws(() => startTimer(initial, 'project-1', { id: 'timer-1', startedAt: 'bad' }))
assert.throws(() => startTimer({ ...stopped, projects: initial.projects }, 'project-1', options), /ID/)
// Valid future timestamps load; Stop can always discard them without a session.
raw = JSON.stringify(running)
const futureStore = createStateStore()
assert.equal(futureStore.getSnapshot().data.activeTimer.startedAt, startedAt)
assert.equal(elapsedSeconds(startedAt, Date.parse(startedAt) - 10000), null)
futureStore.setData(state => stopTimer(state, 'timer-1', '', '2026-10-08T09:59:59.000Z'))
assert.equal(futureStore.getSnapshot().data.activeTimer, null)
assert.equal(futureStore.getSnapshot().data.sessions.length, 0)
assert.equal(elapsedSeconds(startedAt, Date.parse(startedAt) + 1000), 1)
raw = JSON.stringify({ ...running, activeTimer: { ...running.activeTimer, startedAt: 'invalid' } })
const malformedRaw = raw
const invalidLoad = loadState()
assert.equal(invalidLoad.canSave, false)
assert.match(invalidLoad.notice, /preserved/)
assert.equal(raw, malformedRaw)
const invalidStore = createStateStore()
const beforeInvalidWrites = writes
invalidStore.setData(() => running)
assert.equal(raw, malformedRaw)
assert.equal(writes, beforeInvalidWrites)
raw = JSON.stringify(initial)
window.localStorage.setItem = () => { throw Error('quota') }
const failingStore = createStateStore()
failingStore.setData(state => startTimer(state, 'project-1', options))
assert.match(failingStore.getSnapshot().notice, /could not be saved/)
failingStore.setData(state => stopTimer(state, 'timer-1', '', endedAt))
assert.equal(failingStore.getSnapshot().data.sessions.length, 1)
assert.match(failingStore.getSnapshot().notice, /could not be saved/)
assert.equal(JSON.parse(raw).sessions.length, 0)

process.stdout.write('Timer checks passed: elapsed/background/refresh, lifecycle, duplicate Stop, archived references, validation, and persistence.\n')
