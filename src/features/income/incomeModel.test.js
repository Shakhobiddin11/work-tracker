/* global process */
import assert from 'node:assert/strict'
import { amountToInput, dateToReceivedAt, displayReceivedDate, entryDate, entryNote, formatUsd, localDateInput, parseIncomeAmount, removeIncome, saveIncome, sortedIncome, totalIncomeCents, validateIncomeForm } from './incomeModel.js'
import { createInitialState, isValidState, loadState, STORAGE_KEY } from '../../lib/storage.js'
import { createStateStore } from '../../app/stateStore.js'

for (const [value, expected] of [['0.01', 1], [' 12.34 ', 1234], ['1.2', 120], ['001.29', 129], ['90071992547409.91', Number.MAX_SAFE_INTEGER]]) {
  assert.equal(parseIncomeAmount(value), expected)
  assert.equal(parseIncomeAmount(amountToInput(expected)), expected)
}
for (const value of ['', ' ', '0', '0.00', '-1', '+1', '1e3', '1,000', '1.234', 'Infinity', 'NaN', '90071992547409.92', null, 1]) assert.equal(parseIncomeAmount(value), null)
for (const date of ['', '2026-02-29', '2026-04-31', '2026-13-01', '10/08/2026', null]) assert.equal(dateToReceivedAt(date), null)
for (const date of ['2028-02-29', '2026-03-08', '2026-11-01', '2026-10-08']) {
  assert.equal(localDateInput(new Date(dateToReceivedAt(date))), date)
  assert.equal(displayReceivedDate({ receivedDate: date, receivedAt: dateToReceivedAt(date) }), new Date(dateToReceivedAt(date)).toLocaleDateString())
}
assert.equal(localDateInput(new Date(2026, 9, 8, 0, 1)), '2026-10-08')
assert.equal(localDateInput(new Date(2026, 9, 8, 23, 59)), '2026-10-08')
const initial = createInitialState()
const stamp = '2026-10-08T10:00:00.000Z'
initial.projects = [{ id: 'archived', name: 'Past project', description: '', status: 'archived', hourlyRateCents: 10000, createdAt: stamp, updatedAt: stamp }]
initial.sessions = [{ id: 'session', projectId: 'archived', startedAt: stamp, endedAt: stamp, durationSeconds: 100, notes: '' }]
const input = { amount: ' 10.29 ', receivedDate: '2026-10-08', projectId: 'archived', notes: ' Deposit \n' }
const created = saveIncome(initial, input, null, { id: 'payment-1', now: stamp })
assert.equal(initial.incomeEntries.length, 0)
assert.equal(isValidState(created), true)
const payment = created.incomeEntries[0]
assert.equal(payment.amountCents, 1029)
assert.equal(payment.notes, 'Deposit')
assert.equal(payment.projectId, 'archived')
assert.equal(payment.receivedDate, input.receivedDate)
assert.equal(localDateInput(new Date(payment.receivedAt)), input.receivedDate)
assert.equal(totalIncomeCents(created.incomeEntries), 1029n)
assert.equal(totalIncomeCents(initial.incomeEntries), 0n) // Sessions and rates are excluded.
assert.equal(formatUsd(totalIncomeCents(created.incomeEntries)), '$10.29')
assert.equal(formatUsd(totalIncomeCents([{ amountCents: Number.MAX_SAFE_INTEGER }, { amountCents: Number.MAX_SAFE_INTEGER }])), '$180,143,985,094,819.82')
assert.throws(() => saveIncome(initial, { ...input, amount: '0' }))
assert.throws(() => saveIncome(initial, { ...input, receivedDate: '2026-02-30' }))
assert.throws(() => saveIncome(initial, { ...input, projectId: 'missing' }))
assert.throws(() => saveIncome(created, input, 'missing'))
assert.deepEqual(Object.keys(validateIncomeForm({ ...input, amount: '-1', receivedDate: '', projectId: 'missing' }, []).errors).sort(), ['amount', 'projectId', 'receivedDate'])
const edited = saveIncome(created, { ...input, amount: '20.50', projectId: '', notes: ' Revised ', receivedDate: '2026-10-09' }, 'payment-1', { now: '2026-10-09T10:00:00.000Z' })
assert.equal(edited.incomeEntries[0].id, payment.id)
assert.equal(edited.incomeEntries[0].createdAt, stamp)
assert.equal(edited.incomeEntries[0].updatedAt, '2026-10-09T10:00:00.000Z')
assert.equal(edited.incomeEntries[0].amountCents, 2050)
assert.equal(edited.incomeEntries[0].projectId, null)
assert.equal(edited.incomeEntries[0].notes, 'Revised')
assert.equal(payment.amountCents, 1029)
assert.equal(isValidState(edited), true)
assert.equal(removeIncome(edited, 'payment-1', false), edited)
assert.equal(removeIncome(edited, 'payment-1'), edited)
assert.equal(removeIncome(edited, 'payment-1', 'false'), edited)
const removed = removeIncome(edited, 'payment-1', true)
assert.equal(removed.incomeEntries.length, 0)
assert.equal(removed.sessions, initial.sessions)
assert.equal(removed.projects, initial.projects)
assert.equal(totalIncomeCents(removed.incomeEntries), 0n)
assert.equal(removeIncome(removed, 'payment-1', true), removed)
assert.equal(saveIncome({ ...created, projects: [] }, input, 'payment-1').incomeEntries[0].projectId, 'archived')
const second = saveIncome(created, { ...input, receivedDate: '2026-10-09' }, null, { id: 'payment-2', now: stamp })
assert.equal(sortedIncome(second.incomeEntries)[0].id, 'payment-2')
assert.equal(second.incomeEntries[0].id, 'payment-1')
const legacy = { id: 'legacy', amountCents: 500, paidDate: '2026-10-07', description: 'Legacy payment', createdAt: stamp, projectId: 'archived' }
const legacyState = { ...initial, incomeEntries: [legacy] }
assert.equal(isValidState(legacyState), true)
assert.equal(entryDate(legacy), '2026-10-07')
assert.equal(entryNote(legacy), 'Legacy payment')
assert.equal(entryDate({ ...legacy, receivedDate: 'unrelated legacy metadata' }), legacy.paidDate)
assert.equal(entryNote({ ...legacy, notes: { unrelated: 'legacy metadata' } }), legacy.description)
const converted = saveIncome(legacyState, input, 'legacy')
assert.equal(isValidState(converted), true)
assert.equal(converted.incomeEntries[0].receivedDate, input.receivedDate)
assert.equal(converted.incomeEntries[0].id, 'legacy')
for (const [field, values] of Object.entries({ receivedAt: ['bad', '2026-02-30T00:00:00.000Z'], receivedDate: ['2026-02-29', ''], notes: [null], amountCents: [0, -1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1], updatedAt: ['bad', '2026-10-07T00:00:00.000Z'] })) {
  for (const value of values) assert.equal(isValidState({ ...created, incomeEntries: [{ ...payment, [field]: value }] }), false)
}
let raw = JSON.stringify(legacyState)
let writes = 0
globalThis.window = { localStorage: { getItem: () => raw, setItem: (key, value) => { assert.equal(key, STORAGE_KEY); raw = value; writes++ } } }
const store = createStateStore()
assert.equal(writes, 0)
assert.equal(store.getSnapshot().data.incomeEntries[0].id, 'legacy')
store.setData(state => saveIncome(state, input, null, { id: 'new', now: stamp }))
assert.deepEqual(createStateStore().getSnapshot().data, store.getSnapshot().data)
const snapshot = store.getSnapshot()
const beforeCancel = raw
store.setData(state => removeIncome(state, 'new', false))
assert.equal(store.getSnapshot(), snapshot)
assert.equal(raw, beforeCancel)
assert.equal(writes, 1)
store.setData(state => saveIncome(state, { ...input, amount: '50' }, 'new'))
assert.equal(loadState().data.incomeEntries.find(entry => entry.id === 'new').amountCents, 5000)
store.setData(state => removeIncome(state, 'new', true))
assert.equal(loadState().data.incomeEntries.length, 1)
raw = '{broken'
const invalidStore = createStateStore()
invalidStore.setData(() => created)
assert.equal(raw, '{broken')
assert.match(invalidStore.getSnapshot().notice, /preserved/)
raw = JSON.stringify(initial)
window.localStorage.setItem = () => { throw Error('quota') }
const blocked = createStateStore()
blocked.setData(state => saveIncome(state, input, null, { id: 'temporary', now: stamp }))
assert.equal(blocked.getSnapshot().data.incomeEntries.length, 1)
assert.match(blocked.getSnapshot().notice, /could not be saved/)
process.stdout.write('Income checks passed: amounts, local dates, lifecycle/confirmation, archived references, exact totals, legacy data, reload, and storage failures.\n')
