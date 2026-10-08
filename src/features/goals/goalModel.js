import { isDate } from '../../lib/storage.js'
import { entryDate, parseIncomeAmount } from '../income/incomeModel.js'

export function validateGoalForm(input) {
  const title = typeof input.title === 'string' ? input.title.trim() : ''
  const targetCents = parseIncomeAmount(input.target)
  const errors = {}
  if (!title) errors.title = 'Enter a goal title.'
  if (targetCents === null) errors.target = 'Enter a positive USD target with up to two decimal places (maximum 90,071,992,547,409.91).'
  if (!isDate(input.startDate)) errors.startDate = 'Choose a valid start date.'
  if (!isDate(input.deadline)) errors.deadline = 'Choose a valid deadline.'
  else if (isDate(input.startDate) && input.deadline < input.startDate) errors.deadline = 'Deadline must be on or after the start date.'
  return { errors, fields: { title, targetCents, startDate: input.startDate, deadline: input.deadline } }
}

export function saveGoal(state, input, goalId = null, options = {}) {
  const { errors, fields } = validateGoalForm(input)
  if (Object.keys(errors).length) throw new Error('Invalid goal fields')
  const now = options.now ?? new Date().toISOString()
  if (goalId !== null) {
    if (!state.goals.some(goal => goal.id === goalId)) throw new Error('Goal no longer exists')
    return { ...state, goals: state.goals.map(goal => goal.id === goalId
      ? { ...goal, ...fields, updatedAt: now > goal.updatedAt ? now : goal.updatedAt }
      : goal) }
  }
  return { ...state, goals: [...state.goals, { id: options.id ?? globalThis.crypto.randomUUID(), ...fields, status: 'active', createdAt: now, updatedAt: now }] }
}

export function removeGoal(state, goalId, confirmed = false) {
  if (confirmed !== true || !state.goals.some(goal => goal.id === goalId)) return state
  return { ...state, goals: state.goals.filter(goal => goal.id !== goalId) }
}

export function goalProgress(goal, incomeEntries) {
  if (!isDate(goal.startDate) || !isDate(goal.deadline) || goal.deadline < goal.startDate) return null
  const receivedCents = incomeEntries.reduce((sum, entry) => {
    const receivedDate = entryDate(entry)
    return receivedDate >= goal.startDate && receivedDate <= goal.deadline ? sum + BigInt(entry.amountCents) : sum
  }, 0n)
  const targetCents = BigInt(goal.targetCents)
  const remainingCents = targetCents > receivedCents ? targetCents - receivedCents : 0n
  const basisPoints = receivedCents * 10000n / targetCents
  return {
    receivedCents, targetCents, remainingCents,
    percentage: `${basisPoints / 100n}.${String(basisPoints % 100n).padStart(2, '0')}%`,
    barPercent: Number(basisPoints > 10000n ? 10000n : basisPoints) / 100,
    reached: receivedCents >= targetCents,
  }
}

export function deadlineStatus(deadline, today) {
  if (!isDate(deadline)) return 'No deadline'
  return deadline < today ? 'Deadline past' : deadline === today ? 'Deadline today' : 'Deadline upcoming'
}

export function displayGoalDate(value) {
  return isDate(value) ? new Date(`${value}T12:00:00.000Z`).toLocaleDateString(undefined, { timeZone: 'UTC' }) : 'Not set'
}
