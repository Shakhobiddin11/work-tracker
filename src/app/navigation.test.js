/* global process */
import assert from 'node:assert/strict'
import { getCurrentSection, navigateToSection, sectionFromHash, SECTION_IDS, subscribeToNavigation } from './navigation.js'

for (const section of SECTION_IDS) assert.equal(sectionFromHash(`#${section}`), section)
for (const hash of ['', '#', '#unknown', '#main-content', '#Timer', '#%74imer', 'xtimer', 'timer', null]) assert.equal(sectionFromHash(hash), 'dashboard')

const listeners = new Set()
const history = ['#dashboard']
let index = 0
let hash = history[index]
globalThis.window = {
  location: {
    get hash() { return hash },
    set hash(value) {
      const next = `#${value}`
      if (next === hash) return
      hash = next
      history.splice(index + 1)
      history.push(next)
      index++
      listeners.forEach(listener => listener())
    },
  },
  addEventListener: (event, listener) => { assert.equal(event, 'hashchange'); listeners.add(listener) },
  removeEventListener: (event, listener) => { assert.equal(event, 'hashchange'); listeners.delete(listener) },
}
let observed = getCurrentSection()
const unsubscribe = subscribeToNavigation(() => { observed = getCurrentSection() })
for (const section of SECTION_IDS) {
  navigateToSection(section)
  assert.equal(observed, section)
  assert.equal(getCurrentSection(), section) // Initial snapshot after a reload.
}
index--
hash = history[index]
listeners.forEach(listener => listener())
assert.equal(observed, SECTION_IDS.at(-2))
index++
hash = history[index]
listeners.forEach(listener => listener())
assert.equal(observed, SECTION_IDS.at(-1))
navigateToSection('unknown')
assert.equal(observed, 'dashboard')
unsubscribe()
assert.equal(listeners.size, 0)
process.stdout.write('Hash navigation checks passed: section selection, reload snapshots, history events, fallback, and cleanup.\n')
