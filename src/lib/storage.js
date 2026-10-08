export const STORAGE_KEY = 'work-tracker:v1'
export function createInitialState() {
  return { settings: { currency: 'USD' }, projects: [], sessions: [], incomeEntries: [], goals: [], activeTimer: null }
}
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const text = (value) => typeof value === 'string'
const nonempty = (value) => text(value) && value.trim().length > 0
const integer = (value, minimum = 0) => Number.isSafeInteger(value) && value >= minimum
const optionalId = (value) => value === undefined || value === null || nonempty(value)
const date = (value) => {
  if (!text(value) || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}
const timestamp = (value) => {
  if (!text(value) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value
}
const audit = (item) => timestamp(item.createdAt) && timestamp(item.updatedAt) && item.updatedAt >= item.createdAt
const validators = {
  projects: (item) => nonempty(item.name) && text(item.description)
    && (item.clientName === undefined || text(item.clientName))
    && ['active', 'archived'].includes(item.status) && integer(item.hourlyRateCents) && audit(item),
  sessions: (item) => optionalId(item.projectId) && text(item.notes)
    && timestamp(item.startedAt) && timestamp(item.endedAt) && item.endedAt >= item.startedAt
    && integer(item.durationSeconds),
  incomeEntries: (item) => optionalId(item.projectId) && nonempty(item.description)
    && integer(item.amountCents, 1) && date(item.paidDate) && timestamp(item.createdAt),
  goals: (item) => nonempty(item.title) && integer(item.targetCents, 1)
    && ['active', 'completed', 'archived'].includes(item.status)
    && (item.deadline === undefined || item.deadline === null || date(item.deadline)) && audit(item),
}
export function isValidState(value) {
  if (!object(value) || !object(value.settings) || typeof value.settings.currency !== 'string' || !/^[A-Z]{3}$/.test(value.settings.currency)) return false
  for (const key of ['projects', 'sessions', 'incomeEntries', 'goals']) {
    if (!Array.isArray(value[key]) || !value[key].every(item => object(item) && nonempty(item.id) && validators[key](item))) return false
    if (new Set(value[key].map(item => item.id)).size !== value[key].length) return false
  }
  return value.activeTimer === null
}
export function loadState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null) return { data: createInitialState(), canSave: true, notice: '' }
    const data = JSON.parse(raw)
    if (!isValidState(data)) throw new Error('Invalid state')
    return { data, canSave: true, notice: '' }
  } catch {
    return { data: createInitialState(), canSave: false, notice: 'Saved data could not be loaded. This session uses temporary data; any existing saved data is preserved.' }
  }
}
export function saveState(data) {
  try {
    if (!isValidState(data)) return false
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    return true
  } catch { return false }
}
