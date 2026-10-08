/* global process */
import assert from 'node:assert/strict'
import { changeProjectStatus, parseHourlyRate, rateToInput, saveProject, validateProjectForm } from './projectModel.js'
import { createInitialState, isValidState, STORAGE_KEY } from '../../lib/storage.js'
import { createStateStore } from '../../app/stateStore.js'

for (const [input, expected] of [['', 0], ['  ', 0], ['0', 0], ['0.00', 0], ['12.34', 1234], [' 0.29 ', 29], ['001.2', 120], ['90071992547409.91', Number.MAX_SAFE_INTEGER]]) {
  assert.equal(parseHourlyRate(input), expected)
  assert.equal(parseHourlyRate(rateToInput(expected)), expected)
}
for (const input of ['-1', '+1', '1.234', '1e3', 'Infinity', 'NaN', '1,000', '1,50', '1.', '.5', '$5', '90071992547409.92', null, 5]) {
  assert.equal(parseHourlyRate(input), null, `Invalid rate: ${input}`)
}
assert.equal(validateProjectForm({ name: '  ', clientName: '', hourlyRate: '' }).errors.name, 'Enter a project name.')
assert.ok(validateProjectForm({ name: 'Project', hourlyRate: '-5' }).errors.hourlyRate)
assert.deepEqual(validateProjectForm({ name: ' Website ', clientName: ' Client ', hourlyRate: ' 50.25 ' }).fields,
  { name: 'Website', clientName: 'Client', hourlyRateCents: 5025 })

const initial = createInitialState()
const input = { name: ' Website ', clientName: ' Client ', hourlyRate: '50.25' }
const createdAt = '2026-10-08T10:00:00.000Z'
const editedAt = '2026-10-08T11:00:00.000Z'
const archivedAt = '2026-10-08T12:00:00.000Z'
const restoredAt = '2026-10-08T13:00:00.000Z'
const created = saveProject(initial, input, null, { id: 'project-1', now: createdAt })
assert.equal(initial.projects.length, 0)
assert.equal(isValidState(created), true)
assert.deepEqual(created.projects[0], { id: 'project-1', name: 'Website', clientName: 'Client', hourlyRateCents: 5025, description: '', status: 'active', createdAt, updatedAt: createdAt })
assert.throws(() => saveProject(created, { ...input, hourlyRate: '1.234' }))
assert.throws(() => saveProject(created, { ...input, name: ' ' }))
assert.throws(() => saveProject(created, input, 'missing'))
const original = { ...created.projects[0], description: 'Existing notes', metadata: 'preserved' }
const withReferences = {
  ...created,
  projects: [original],
  sessions: [{ id: 'session-1', projectId: 'project-1', startedAt: createdAt, endedAt: createdAt, durationSeconds: 0, notes: '' }],
  incomeEntries: [{ id: 'income-1', projectId: 'project-1', description: 'Payment', amountCents: 500, paidDate: '2026-10-08', createdAt }],
}
const edited = saveProject(withReferences, { name: ' Revised ', clientName: '', hourlyRate: '' }, 'project-1', { now: editedAt })
assert.equal(edited.projects[0].name, 'Revised')
assert.equal(edited.projects[0].clientName, '')
assert.equal(edited.projects[0].hourlyRateCents, 0)
assert.equal(edited.projects[0].description, 'Existing notes')
assert.equal(edited.projects[0].metadata, 'preserved')
assert.equal(edited.projects[0].createdAt, createdAt)
assert.equal(edited.projects[0].updatedAt, editedAt)
assert.equal(original.name, 'Website')
const archived = changeProjectStatus(edited, 'project-1', 'archived', archivedAt)
assert.equal(archived.projects[0].status, 'archived')
assert.equal(archived.projects[0].updatedAt, archivedAt)
assert.equal(archived.projects.length, 1)
assert.equal(archived.sessions, withReferences.sessions)
assert.equal(archived.incomeEntries, withReferences.incomeEntries)
assert.equal(archived.sessions[0].projectId, 'project-1')
const restored = changeProjectStatus(archived, 'project-1', 'active', restoredAt)
assert.equal(restored.projects[0].status, 'active')
assert.equal(restored.projects[0].updatedAt, restoredAt)
assert.equal(restored.projects[0].id, 'project-1')
assert.equal(isValidState(restored), true)
assert.equal(changeProjectStatus(restored, 'project-1', 'archived', createdAt).projects[0].updatedAt, restoredAt)
assert.throws(() => changeProjectStatus(restored, 'project-1', 'deleted'))
assert.throws(() => changeProjectStatus(restored, 'missing', 'active'))
assert.equal(isValidState({ ...created, projects: [{ ...original, clientName: null }] }), false)
const legacy = { ...original }
delete legacy.clientName
assert.equal(isValidState({ ...created, projects: [legacy] }), true)

let raw = null
let writes = 0
globalThis.window = { localStorage: {
  getItem: () => raw,
  setItem: (key, value) => { assert.equal(key, STORAGE_KEY); raw = value; writes++ },
} }
const store = createStateStore()
assert.equal(writes, 0)
store.setData(state => saveProject(state, input, null, { id: 'persisted', now: createdAt }))
store.setData(state => saveProject(state, { ...input, name: 'Edited' }, 'persisted', { now: editedAt }))
store.setData(state => changeProjectStatus(state, 'persisted', 'archived', archivedAt))
assert.equal(createStateStore().getSnapshot().data.projects[0].status, 'archived')
store.setData(state => changeProjectStatus(state, 'persisted', 'active', restoredAt))
assert.deepEqual(createStateStore().getSnapshot().data, store.getSnapshot().data)
assert.equal(writes, 4)
raw = '{invalid saved data'
const invalidStore = createStateStore()
invalidStore.setData(state => saveProject(state, input, null, { id: 'temporary', now: createdAt }))
assert.equal(raw, '{invalid saved data')
assert.equal(writes, 4)
assert.match(invalidStore.getSnapshot().notice, /preserved/)
raw = null
window.localStorage.setItem = () => { throw Error('quota') }
const blockedStore = createStateStore()
blockedStore.setData(state => saveProject(state, input, null, { id: 'temporary', now: createdAt }))
assert.equal(blockedStore.getSnapshot().data.projects.length, 1)
assert.match(blockedStore.getSnapshot().notice, /could not be saved/)
process.stdout.write('Projects checks passed: rates, validation, create/edit/archive/restore, references, reload, and storage warnings.\n')
