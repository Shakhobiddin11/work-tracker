import { isTimestamp, isValidState } from '../../lib/storage.js'

export const MAX_BACKUP_BYTES = 5 * 1024 * 1024
export const BACKUP_FORMAT = 'work-tracker-backup'
export function exportBackup(state, exportedAt = new Date().toISOString()) {
  if (!isValidState(state) || !isTimestamp(exportedAt)) throw new Error('Current data cannot be exported as a valid backup.')
  const text = JSON.stringify({ format: BACKUP_FORMAT, version: 1, exportedAt, state }, null, 2)
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES) throw new Error('Backup exceeds the supported 5 MiB limit.')
  return text
}
export function parseBackup(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_BACKUP_BYTES) throw new Error('Choose a JSON backup no larger than 5 MiB.')
  let backup
  try { backup = JSON.parse(text) } catch { throw new Error('The file is not valid JSON.') }
  if (!backup || backup.format !== BACKUP_FORMAT || backup.version !== 1 || !isTimestamp(backup.exportedAt) || !isValidState(backup.state)) throw new Error('Unsupported backup format or invalid Work Tracker data.')
  return backup
}
export function backupPreview(backup) {
  const { state } = backup
  return { projects: state.projects.length, sessions: state.sessions.length, payments: state.incomeEntries.length, goals: state.goals.length, currency: state.settings.currency, runningTimer: state.activeTimer !== null }
}
