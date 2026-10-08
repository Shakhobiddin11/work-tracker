/* global process */
import assert from 'node:assert/strict'
import { createInitialState, isValidState, loadState, saveState, STORAGE_KEY } from './storage.js'
import { createStateStore } from '../app/stateStore.js'

const stamp = '2026-10-08T10:00:00.000Z'
const records = {
  projects: { id: 'project-1', name: 'Website', description: '', status: 'active', hourlyRateCents: 5000, createdAt: stamp, updatedAt: stamp },
  sessions: { id: 'session-1', projectId: 'project-1', startedAt: stamp, endedAt: stamp, durationSeconds: 0, notes: '' },
  incomeEntries: { id: 'payment-1', description: 'Deposit', amountCents: 10000, paidDate: '2026-10-08', createdAt: stamp },
  goals: { id: 'goal-1', title: 'Savings', targetCents: 100000, status: 'active', deadline: '2028-02-29', createdAt: stamp, updatedAt: stamp },
}
const valid = createInitialState()
for (const [key, record] of Object.entries(records)) valid[key] = [record]
assert.equal(isValidState(valid), true)
assert.equal(isValidState(createInitialState()), true)
for (const [key, record] of Object.entries(records)) {
  for (const id of ['', '   ', null, 12]) {
    assert.equal(isValidState({ ...valid, [key]: [{ ...record, id }] }), false, `${key} invalid ID`)
  }
  for (const field of Object.keys(record).filter(field => !['projectId', 'deadline'].includes(field))) {
    const incomplete = { ...record }
    delete incomplete[field]
    assert.equal(isValidState({ ...valid, [key]: [incomplete] }), false, `${key} missing ${field}`)
  }
  assert.equal(isValidState({ ...valid, [key]: [record, { ...record }] }), false, `${key} duplicate IDs`)
  assert.equal(isValidState({ ...valid, [key]: [null] }), false)
}
const invalidFields = {
  projects: { name: [' ', 1], description: [null], status: ['done'], hourlyRateCents: [-1, 1.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1], createdAt: ['2026-02-30T10:00:00.000Z'], updatedAt: ['2026-10-07T10:00:00.000Z'] },
  sessions: { projectId: ['', ' ', 1], notes: [null], startedAt: ['invalid', '2026-10-08T25:00:00.000Z'], endedAt: ['2026-10-07T10:00:00.000Z'], durationSeconds: [-1, 0.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1] },
  incomeEntries: { description: [' ', false], projectId: ['', 1], amountCents: [0, -1, 1.2, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1], paidDate: ['2026-02-29', '2026-04-31', '10/08/2026'], createdAt: ['2026-10-08', '2026-10-08T10:00:00Z'] },
  goals: { title: [' ', null], targetCents: [0, -1, 0.1, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1], status: ['done'], deadline: ['', '2026-02-29'], updatedAt: ['2026-10-07T10:00:00.000Z'] },
}
for (const [key, fields] of Object.entries(invalidFields)) {
  for (const [field, values] of Object.entries(fields)) {
    for (const value of values) assert.equal(isValidState({ ...valid, [key]: [{ ...records[key], [field]: value }] }), false, `${key}.${field}: ${value}`)
  }
}
for (const key of ['sessions', 'incomeEntries']) {
  for (const projectId of [undefined, null, 'historical-project']) {
    assert.equal(isValidState({ ...valid, [key]: [{ ...records[key], projectId }] }), true)
  }
}
for (const deadline of [undefined, null, '2028-02-29']) assert.equal(isValidState({ ...valid, goals: [{ ...records.goals, deadline }] }), true)
for (const status of ['active', 'archived']) assert.equal(isValidState({ ...valid, projects: [{ ...records.projects, status, hourlyRateCents: 0 }] }), true)
for (const status of ['active', 'completed', 'archived']) assert.equal(isValidState({ ...valid, goals: [{ ...records.goals, status, targetCents: Number.MAX_SAFE_INTEGER }] }), true)
assert.equal(isValidState({ ...valid, activeTimer: {} }), false)

let raw = null
let writes = 0
globalThis.window = {
  localStorage: {
    getItem: () => raw,
    setItem: (key, value) => { assert.equal(key, STORAGE_KEY); writes++; raw = value },
  },
}
assert.equal(loadState().canSave, true)
assert.equal(writes, 0)
assert.equal(saveState(valid), true)
assert.deepEqual(loadState().data, valid)
const beforeInvalidSave = raw
assert.equal(saveState({ ...valid, goals: [{ ...records.goals, targetCents: -1 }] }), false)
assert.equal(raw, beforeInvalidSave)
raw = '{broken'
assert.equal(loadState().canSave, false)
assert.equal(raw, '{broken')
raw = JSON.stringify({ settings: { currency: 'USD' } })
assert.equal(loadState().canSave, false)
assert.equal(saveState(createInitialState()), true)
assert.equal(loadState().canSave, true)
const duplicates = createInitialState()
duplicates.projects = [{ id: 'same' }, { id: 'same' }]
assert.equal(isValidState(duplicates), false)
window.localStorage.setItem = () => { throw Error('quota') }
assert.equal(saveState(createInitialState()), false)
window.localStorage.getItem = () => { throw Error('blocked') }
assert.equal(loadState().canSave, false)

// The provider delegates updates directly to this store.
raw = '{broken'
window.localStorage.getItem = () => raw
const preserved = createStateStore()
const writesBefore = writes
preserved.setData(previous => ({ ...previous, settings: { currency: 'EUR' } }))
assert.equal(raw, '{broken')
assert.equal(writes, writesBefore)
assert.match(preserved.getSnapshot().notice, /preserved/)
raw = null
window.localStorage.setItem = (key, value) => { assert.equal(key, STORAGE_KEY); writes++; raw = value }
const store = createStateStore()
const original = store.getSnapshot()
let notifications = 0
const unsubscribe = store.subscribe(() => notifications++)
store.setData(previous => ({ ...previous, projects: [...previous.projects, records.projects] }))
store.setData(previous => ({ ...previous, goals: [...previous.goals, records.goals] }))
assert.equal(store.getSnapshot().data.projects.length, 1)
assert.equal(store.getSnapshot().data.goals.length, 1)
assert.equal(original.data.projects.length, 0)
assert.equal(notifications, 2)
assert.deepEqual(JSON.parse(raw), store.getSnapshot().data)
assert.throws(() => store.getSnapshot().data.projects.push(records.projects), TypeError)
assert.throws(() => { store.getSnapshot().data.settings.currency = 'GBP' }, TypeError)
assert.throws(() => store.setData(previous => { previous.projects[0].name = 'Mutated'; return previous }), TypeError)
const replacement = structuredClone(valid)
store.setData(replacement)
replacement.projects[0].name = 'Caller changed'
assert.equal(store.getSnapshot().data.projects[0].name, 'Website')
const stableSnapshot = store.getSnapshot()
assert.equal(store.setData({ ...valid, activeTimer: {} }), false)
assert.equal(store.getSnapshot(), stableSnapshot)
window.localStorage.setItem = () => { throw Error('quota') }
assert.equal(store.setData(previous => ({ ...previous, settings: { currency: 'GBP' } })), true)
assert.match(store.getSnapshot().notice, /could not be saved/)
assert.equal(store.getSnapshot().data.settings.currency, 'GBP')
unsubscribe()
process.stdout.write('Record validation, storage failure/preservation, and immutable consecutive update checks passed.\n')
