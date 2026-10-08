/* global process */
import assert from 'node:assert/strict'
import { backupPreview, exportBackup, MAX_BACKUP_BYTES, parseBackup } from './backupModel.js'
import { createInitialState, readSavedValue, STORAGE_KEY } from '../../lib/storage.js'
import { createStateStore } from '../../app/stateStore.js'

const stamp = '2026-10-08T10:00:00.000Z'
const state = createInitialState()
state.settings.currency = 'EUR'
state.projects = [{ id: 'p', name: 'Archived work', description: '', status: 'archived', hourlyRateCents: 12550, createdAt: stamp, updatedAt: stamp }]
state.sessions = [{ id: 's', projectId: 'p', startedAt: stamp, endedAt: stamp, durationSeconds: 0, notes: '' }]
state.incomeEntries = [{ id: 'i', amountCents: 1234, description: 'Legacy payment', paidDate: '2026-10-08', createdAt: stamp, projectId: 'p' }]
state.goals = [{ id: 'g', title: 'Legacy goal', targetCents: 2000, status: 'active', createdAt: stamp, updatedAt: stamp }]
state.activeTimer = { id: 't', projectId: 'p', startedAt: stamp }
state.metadata = { preserved: true }
const text = exportBackup(state, stamp)
const backup = parseBackup(text)
assert.deepEqual(backup.state, state)
assert.equal(backup.exportedAt, stamp)
assert.deepEqual(backupPreview(backup), { projects: 1, sessions: 1, payments: 1, goals: 1, currency: 'EUR', runningTimer: true })
assert.deepEqual(parseBackup(exportBackup(createInitialState())).state, createInitialState())
for (const invalid of ['', '{bad', 'null', '[]', JSON.stringify(state), JSON.stringify({ ...backup, version: 2 }), JSON.stringify({ ...backup, format: 'other' }), JSON.stringify({ ...backup, exportedAt: 'bad' }), JSON.stringify({ ...backup, state: { ...state, incomeEntries: [{ ...state.incomeEntries[0], amountCents: -1 }] } }), ' '.repeat(MAX_BACKUP_BYTES + 1)]) assert.throws(() => parseBackup(invalid))
assert.throws(() => exportBackup({ ...state, activeTimer: {} }))
assert.throws(() => exportBackup({ ...state, metadata: 'x'.repeat(MAX_BACKUP_BYTES) }))
assert.throws(() => parseBackup(JSON.stringify({ ...backup, state: { ...state, projects: [state.projects[0], state.projects[0]] } })))

let raw = null
let writes = 0
let failWrite = false
globalThis.window = { localStorage: {
  getItem: () => raw,
  setItem: (key, value) => { assert.equal(key, STORAGE_KEY); if (failWrite) throw new Error('quota'); raw = value; writes++ },
} }
const store = createStateStore()
assert.deepEqual(readSavedValue(), { ok: true, raw: null })
const original = store.getSnapshot()
assert.equal(store.replaceData(state).ok, false)
assert.equal(store.replaceData(state, { confirmed: true }).ok, false)
assert.equal(store.getSnapshot(), original)
assert.equal(writes, 0)
assert.equal(raw, null)
failWrite = true
assert.equal(store.replaceData(state, { confirmed: true, timerChoice: 'discard' }).ok, false)
assert.equal(store.getSnapshot(), original)
assert.equal(raw, null)
failWrite = false
let notifications = 0
store.subscribe(() => {
  notifications++
  assert.deepEqual(JSON.parse(raw), store.getSnapshot().data) // Durable write precedes publication.
})
assert.equal(store.replaceData(state, { confirmed: true, timerChoice: 'discard' }).ok, true)
assert.equal(notifications, 1)
assert.equal(store.getSnapshot().data.activeTimer, null)
assert.equal(state.activeTimer.id, 't') // Caller-owned backup unchanged.
assert.deepEqual(createStateStore().getSnapshot().data, store.getSnapshot().data)
assert.equal(store.replaceData(state, { confirmed: true, timerChoice: 'preserve' }).ok, true)
assert.equal(store.getSnapshot().data.activeTimer.startedAt, stamp)
const running = store.getSnapshot()
const runningRaw = raw
assert.equal(store.replaceData(createInitialState(), { confirmed: true }).ok, false)
assert.equal(store.getSnapshot(), running)
assert.equal(raw, runningRaw)

raw = '{corrupt saved value'
assert.deepEqual(readSavedValue(), { ok: true, raw }) // Recovery download receives the exact original text.
const recovery = createStateStore()
const temporary = recovery.getSnapshot()
assert.equal(recovery.replaceData(state, { confirmed: true, timerChoice: 'discard' }).ok, false)
assert.equal(raw, '{corrupt saved value')
assert.equal(recovery.getSnapshot(), temporary)
failWrite = true
assert.equal(recovery.replaceData(state, { confirmed: true, timerChoice: 'discard', replaceInvalid: true }).ok, false)
assert.equal(raw, '{corrupt saved value')
assert.equal(recovery.getSnapshot(), temporary)
failWrite = false
assert.equal(recovery.replaceData(state, { confirmed: true, timerChoice: 'discard', replaceInvalid: true }).ok, true)
assert.equal(recovery.getSnapshot().notice, '')
recovery.setData(data => ({ ...data, settings: { currency: 'USD' } }))
assert.equal(JSON.parse(raw).settings.currency, 'USD') // Saving is re-enabled after explicit recovery.
const stable = recovery.getSnapshot()
const stableRaw = raw
assert.equal(recovery.replaceData({ ...state, activeTimer: {} }, { confirmed: true, replaceInvalid: true }).ok, false)
assert.equal(raw, stableRaw)
assert.equal(recovery.getSnapshot(), stable)
window.localStorage.getItem = () => { throw new Error('blocked') }
assert.deepEqual(readSavedValue(), { ok: false, raw: null })
assert.equal(recovery.replaceData(createInitialState(), { confirmed: true }).ok, false)
assert.equal(raw, stableRaw)
assert.equal(recovery.getSnapshot(), stable)
process.stdout.write('Backup checks passed: round-trip, format/size/record validation, preview, cancellation, storage-first restore, failure preservation, timer choices, reload, and corrupted-data recovery.\n')
