// Parse decimal USD directly into cents without floating-point multiplication.
export function parseHourlyRate(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return 0
  if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) return null
  const [dollars, fraction = ''] = trimmed.split('.')
  const cents = BigInt(dollars) * 100n + BigInt(fraction.padEnd(2, '0'))
  return cents <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(cents) : null
}

export function rateToInput(cents) {
  const whole = Math.floor(cents / 100)
  return `${whole}.${String(cents % 100).padStart(2, '0')}`
}

export function validateProjectForm(input) {
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  const clientName = typeof input.clientName === 'string' ? input.clientName.trim() : ''
  const hourlyRateCents = parseHourlyRate(input.hourlyRate)
  const errors = {}
  if (!name) errors.name = 'Enter a project name.'
  if (hourlyRateCents === null) errors.hourlyRate = 'Enter a nonnegative USD amount with at most two decimal places, up to 90,071,992,547,409.91.'
  return { errors, fields: { name, clientName, hourlyRateCents } }
}

export function saveProject(state, input, projectId = null, options = {}) {
  const { errors, fields } = validateProjectForm(input)
  if (Object.keys(errors).length) throw new Error('Invalid project fields')
  const now = options.now ?? new Date().toISOString()
  if (projectId !== null) {
    const existing = state.projects.find(project => project.id === projectId)
    if (!existing) throw new Error('Project no longer exists')
    return {
      ...state,
      projects: state.projects.map(project => project.id === projectId
        ? { ...project, ...fields, updatedAt: now > project.updatedAt ? now : project.updatedAt }
        : project),
    }
  }
  const project = {
    id: options.id ?? globalThis.crypto.randomUUID(),
    ...fields,
    description: '',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
  return { ...state, projects: [...state.projects, project] }
}

export function changeProjectStatus(state, projectId, status, now = new Date().toISOString()) {
  if (!['active', 'archived'].includes(status)) throw new Error('Invalid project status')
  if (!state.projects.some(project => project.id === projectId)) throw new Error('Project no longer exists')
  return {
    ...state,
    projects: state.projects.map(project => project.id === projectId
      ? { ...project, status, updatedAt: now > project.updatedAt ? now : project.updatedAt }
      : project),
  }
}
