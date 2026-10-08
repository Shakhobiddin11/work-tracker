import { isValidState, loadState, saveState } from '../lib/storage.js'

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
    setData(update) {
      const next = typeof update === 'function' ? update(snapshot.data) : update
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
