import { elapsedSeconds } from '../timer/timerModel.js'
import { sortedIncome, totalIncomeCents } from '../income/incomeModel.js'
import { goalProgress } from '../goals/goalModel.js'

export function projectLabel(projects, projectId, fallback = 'No project') {
  const project = projects.find(item => item.id === projectId)
  return project ? `${project.name}${project.status === 'archived' ? ' (archived)' : ''}`
    : projectId ? `Unavailable project (${projectId})` : fallback
}

export function dashboardOverview(data, now = Date.now()) {
  return {
    activeProjectCount: data.projects.filter(project => project.status === 'active').length,
    trackedSeconds: data.sessions.reduce((total, session) => total + BigInt(session.durationSeconds), 0n),
    receivedCents: totalIncomeCents(data.incomeEntries),
    runningTimer: data.activeTimer ? {
      ...data.activeTimer,
      projectName: projectLabel(data.projects, data.activeTimer.projectId),
      seconds: elapsedSeconds(data.activeTimer.startedAt, now),
    } : null,
    recentSessions: [...data.sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt) || b.id.localeCompare(a.id)).slice(0, 5)
      .map(session => ({ ...session, projectName: projectLabel(data.projects, session.projectId, 'Unassigned project') })),
    recentPayments: sortedIncome(data.incomeEntries).slice(0, 5)
      .map(entry => ({ ...entry, projectName: projectLabel(data.projects, entry.projectId) })),
    goals: data.goals.map(goal => ({ ...goal, progress: goalProgress(goal, data.incomeEntries) })),
  }
}
