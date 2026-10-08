import { isDate, isTimestamp } from '../../lib/storage.js'

export function parseIncomeAmount(value) {
  if (typeof value !== 'string' || !/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return null
  const [whole, fraction = ''] = value.trim().split('.')
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
  return cents > 0n && cents <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(cents) : null
}

export function amountToInput(cents) {
  const amount = BigInt(cents)
  return `${amount / 100n}.${String(amount % 100n).padStart(2, '0')}`
}

export function formatUsd(cents) {
  const amount = BigInt(cents)
  return `$${(amount / 100n).toLocaleString('en-US')}.${String(amount % 100n).padStart(2, '0')}`
}

export function localDateInput(date = new Date()) {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function dateToReceivedAt(value) {
  if (!isDate(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(0)
  date.setFullYear(year, month - 1, day)
  date.setHours(12, 0, 0, 0)
  // Noon avoids most DST boundaries. Reject a date skipped by a timezone change.
  const timestamp = date.toISOString()
  return localDateInput(date) === value && isTimestamp(timestamp) ? timestamp : null
}

export const entryDate = (entry) => entry.receivedAt === undefined ? entry.paidDate : entry.receivedDate
export const entryNote = (entry) => entry.receivedAt === undefined ? entry.description : entry.notes

export function displayReceivedDate(entry) {
  const stamp = dateToReceivedAt(entryDate(entry))
  return stamp ? new Date(stamp).toLocaleDateString() : entryDate(entry)
}

export function totalIncomeCents(entries) {
  return entries.reduce((total, entry) => total + BigInt(entry.amountCents), 0n)
}

export function sortedIncome(entries) {
  return [...entries].sort((a, b) => entryDate(b).localeCompare(entryDate(a)) || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
}

export function validateIncomeForm(input, projects, previousProjectId = null) {
  const errors = {}
  const amountCents = parseIncomeAmount(input.amount)
  const receivedAt = dateToReceivedAt(input.receivedDate)
  const projectId = input.projectId || null
  if (amountCents === null) errors.amount = 'Enter a positive USD amount with up to two decimal places (maximum 90,071,992,547,409.91).'
  if (!receivedAt) errors.receivedDate = 'Choose a valid received date.'
  if (projectId && !projects.some(project => project.id === projectId) && projectId !== previousProjectId) errors.projectId = 'Choose an available project or No project.'
  return { errors, fields: { amountCents, receivedAt, receivedDate: input.receivedDate, projectId, notes: typeof input.notes === 'string' ? input.notes.trim() : '' } }
}

export function saveIncome(state, input, entryId = null, options = {}) {
  const existing = entryId === null ? null : state.incomeEntries.find(entry => entry.id === entryId)
  if (entryId !== null && !existing) throw new Error('Income entry no longer exists')
  const { errors, fields } = validateIncomeForm(input, state.projects, existing?.projectId)
  if (Object.keys(errors).length) throw new Error('Invalid income fields')
  const now = options.now ?? new Date().toISOString()
  if (existing) return {
    ...state,
    incomeEntries: state.incomeEntries.map(entry => entry.id === entryId
      ? { ...entry, ...fields, updatedAt: now > (entry.updatedAt ?? entry.createdAt) ? now : (entry.updatedAt ?? entry.createdAt) }
      : entry),
  }
  return { ...state, incomeEntries: [...state.incomeEntries, { id: options.id ?? globalThis.crypto.randomUUID(), ...fields, createdAt: now, updatedAt: now }] }
}

export function removeIncome(state, entryId, confirmed = false) {
  if (confirmed !== true || !state.incomeEntries.some(entry => entry.id === entryId)) return state
  return { ...state, incomeEntries: state.incomeEntries.filter(entry => entry.id !== entryId) }
}
