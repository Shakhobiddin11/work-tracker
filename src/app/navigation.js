export const SECTION_IDS = ['dashboard', 'timer', 'projects', 'income', 'goals']

export function sectionFromHash(hash) {
  const section = typeof hash === 'string' && hash.startsWith('#') ? hash.slice(1) : ''
  return SECTION_IDS.includes(section) ? section : 'dashboard'
}

export const getCurrentSection = () => sectionFromHash(window.location.hash)

export function subscribeToNavigation(listener) {
  window.addEventListener('hashchange', listener)
  return () => window.removeEventListener('hashchange', listener)
}

export function navigateToSection(section) {
  window.location.hash = SECTION_IDS.includes(section) ? section : 'dashboard'
}
