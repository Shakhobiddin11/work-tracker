import { isTimestamp, isValidActiveTimer } from '../../lib/storage.js'

export function elapsedSeconds(startedAt, now = Date.now()) {
  if (!isTimestamp(startedAt) || !Number.isFinite(now)) return null
  const difference = now - Date.parse(startedAt)
  const seconds = Math.floor(difference / 1000)
  return difference >= 0 && Number.isSafeInteger(seconds) ? seconds : null
}

export function formatDuration(seconds) {
  const total = BigInt(seconds)
  const hours = total / 3600n
  const minutes = (total % 3600n) / 60n
  return [hours, minutes, total % 60n].map(part => String(part).padStart(2, '0')).join(':')
}

export function startTimer(state, projectId, options = {}) {
  if (state.activeTimer !== null) throw new Error('A timer is already running. Stop it before starting another.')
  const project = state.projects.find(item => item.id === projectId)
  if (!project || project.status !== 'active') throw new Error('Select an active project to start a timer.')
  const startedAt = options.startedAt === undefined ? new Date().toISOString() : options.startedAt
  if (!isTimestamp(startedAt)) throw new Error('The start time is invalid. The timer was not started.')
  const timer = { id: options.id === undefined ? globalThis.crypto.randomUUID() : options.id, projectId, startedAt }
  if (!isValidActiveTimer(timer) || state.sessions.some(session => session.id === timer.id)) throw new Error('The timer could not be started with this ID.')
  return { ...state, activeTimer: timer }
}

export function stopTimer(state, timerId, note = '', endedAt = new Date().toISOString()) {
  // A stale handler must never stop a newer timer or create another session.
  if (!state.activeTimer || state.activeTimer.id !== timerId) return state
  const timer = state.activeTimer
  const stopped = { ...state, activeTimer: null }
  if (!isValidActiveTimer(timer) || !isTimestamp(endedAt)) return stopped
  const durationSeconds = elapsedSeconds(timer.startedAt, Date.parse(endedAt))
  if (durationSeconds === null || durationSeconds < 1 || typeof note !== 'string') return stopped
  if (state.sessions.some(session => session.id === timerId)) return stopped
  const session = {
    id: timer.id,
    projectId: timer.projectId,
    startedAt: timer.startedAt,
    endedAt,
    durationSeconds,
    notes: note.trim(),
  }
  return { ...stopped, sessions: [...state.sessions, session] }
}
