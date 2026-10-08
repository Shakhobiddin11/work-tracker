import { isValidState, loadState, readSavedValue, saveState } from '../lib/storage.js'

function freeze(value) {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}

// One authoritative snapshot also supports multiple updates before React renders.
export function createStateStore(loaded = loadState()) {
  let snapshot = Object.freeze({ data: freeze(structuredClone(loaded.data)), notice: loaded.notice })
  const listeners = new Set()
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    replaceData(next, options = {}) {
      if (options.confirmed !== true) return { ok: false, message: 'Replacement was not confirmed.' }
      if (snapshot.data.activeTimer) return { ok: false, message: 'Stop the current timer in Timer before replacing data.' }
      if (!isValidState(next)) return { ok: false, message: 'The backup state is invalid.' }
      if (next.activeTimer && !['preserve', 'discard'].includes(options.timerChoice)) return { ok: false, message: 'Choose whether to preserve or discard the backup timer.' }
      try {
        const data = freeze(structuredClone({ ...next, activeTimer: options.timerChoice === 'discard' ? null : next.activeTimer }))
        const saved = readSavedValue()
        if (!saved.ok) return { ok: false, message: 'Browser storage cannot be read. Current data is unchanged.' }
        let invalidSaved = false
        if (saved.raw !== null) {
          try { invalidSaved = !isValidState(JSON.parse(saved.raw)) }
          catch { invalidSaved = true }
        }
        if (invalidSaved && options.replaceInvalid !== true) return { ok: false, message: 'Saved data is invalid. Download its raw value and explicitly authorize recovery replacement.' }
        if (!saveState(data)) return { ok: false, message: 'The backup could not be saved to browser storage. Current data is unchanged.' }
        // Restore is storage-first; ordinary edits retain their existing in-memory behavior.
        loaded = { data, canSave: true, notice: '' }
        snapshot = Object.freeze({ data, notice: '' })
        listeners.forEach(listener => listener())
        return { ok: true, message: 'Backup restored in this browser.' }
      } catch { return { ok: false, message: 'The backup could not be restored. Current data is unchanged.' } }
    },
    setData(update) {
      const next = typeof update === 'function' ? update(snapshot.data) : update
      if (next === snapshot.data) return true
      if (!isValidState(next)) return false
      // Clone caller-owned objects before freezing, so they cannot mutate stored state.
      const data = freeze(structuredClone(next))
      const saved = loaded.canSave && saveState(data)
      snapshot = Object.freeze({
        data,
        notice: loaded.notice || (saved ? '' : 'Changes could not be saved. Your data is available only in this session.'),
      })
      listeners.forEach(listener => listener())
      return true
    },
  }
}
