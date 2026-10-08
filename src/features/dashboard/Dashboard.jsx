import { useEffect, useState } from 'react'
import { useWorkTracker } from '../../app/WorkTrackerContext.js'
import { formatDuration } from '../timer/timerModel.js'
import { displayReceivedDate, entryDate, entryNote, formatUsd, localDateInput } from '../income/incomeModel.js'
import { deadlineStatus, displayGoalDate } from '../goals/goalModel.js'
import { dashboardOverview } from './dashboardModel.js'
import './dashboard.css'

export default function Dashboard() {
  const { data, notice } = useWorkTracker()
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const refresh = () => setNow(Date.now())
    const interval = window.setInterval(refresh, 1000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => { window.clearInterval(interval); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [])
  const overview = dashboardOverview(data, now)
  const today = localDateInput(new Date(now))
  const timer = overview.runningTimer
  return <section aria-labelledby="dashboard-heading">
    <p className="eyebrow">Your workspace</p>
    <h1 id="dashboard-heading">Dashboard</h1>
    <p className="description">Your work, recorded time, and income received in one place.</p>
    <div className="dashboard-summary">
      <section className="dashboard-card" aria-labelledby="active-projects-summary"><h2 id="active-projects-summary">Active projects</h2><strong>{overview.activeProjectCount}</strong><a href="#projects">Manage projects</a></section>
      <section className="dashboard-card" aria-labelledby="tracked-time-summary"><h2 id="tracked-time-summary">Total tracked time</h2><strong>{formatDuration(overview.trackedSeconds)}</strong><p>Recorded sessions · HH:MM:SS<br />The live timer is shown separately below.</p></section>
      <section className="dashboard-card" aria-labelledby="received-income-summary"><h2 id="received-income-summary">Total received income</h2><strong>{formatUsd(overview.receivedCents)} USD</strong><p>Recorded payments only.</p><a href="#income">View income</a></section>
    </div>
    <section className={`dashboard-panel dashboard-timer${timer ? ' is-running' : ''}`} aria-labelledby="dashboard-timer-heading">
      <div className="dashboard-panel-header"><h2 id="dashboard-timer-heading">{timer ? 'Timer running' : 'No timer running'}</h2><a className="dashboard-action" href="#timer">{timer ? 'Open Timer' : 'Start a timer'}</a></div>
      {timer ? <>
        <p className="dashboard-project-name">{timer.projectName}</p>
        <div className="dashboard-clock" role="timer" aria-label="Running timer elapsed time" aria-live="off">{timer.seconds === null ? '--:--:--' : formatDuration(timer.seconds)}</div>
        <p className="dashboard-help">Started <time dateTime={timer.startedAt}>{new Date(timer.startedAt).toLocaleString()}</time>. Elapsed time is calculated from this timestamp.</p>
        {timer.seconds === null && <p className="dashboard-warning">The start time is invalid or ahead of the current clock. Open Timer to stop it without recording invalid time.</p>}
      </> : <p className="dashboard-help">Choose an active project in Timer when you are ready to work.</p>}
    </section>
    <section className="dashboard-panel" aria-labelledby="quick-links-heading"><h2 id="quick-links-heading">Quick links</h2>
      <div className="dashboard-quick-links"><a className="dashboard-action" href="#projects">Projects</a><a className="dashboard-action" href="#timer">Timer</a><a className="dashboard-action" href="#income">Income</a><a className="dashboard-action" href="#goals">Goals</a></div>
    </section>
    {notice && <p className="dashboard-help">This overview includes changes in the current session. Check the storage warning above before reloading.</p>}
    <div className="dashboard-activity">
      <section className="dashboard-panel" aria-labelledby="recent-work-heading"><div className="dashboard-panel-header"><h2 id="recent-work-heading">Recent work</h2><a href="#timer">View sessions</a></div>
        {!overview.recentSessions.length ? <p className="dashboard-empty">No sessions recorded yet. <a href="#timer">Start a timer</a> to track work.</p>
          : <ul className="dashboard-list">{overview.recentSessions.map(session => <li key={session.id}>
            <div className="dashboard-row"><strong>{session.projectName}</strong><span>{formatDuration(session.durationSeconds)}</span></div>
            <time dateTime={session.startedAt}>{new Date(session.startedAt).toLocaleString()}</time>
            {session.notes && <p className="dashboard-note">{session.notes}</p>}
          </li>)}</ul>}
      </section>
      <section className="dashboard-panel" aria-labelledby="recent-payments-heading"><div className="dashboard-panel-header"><h2 id="recent-payments-heading">Recent payments</h2><a href="#income">View income</a></div>
        {!overview.recentPayments.length ? <p className="dashboard-empty">No received payments yet. <a href="#income">Record a payment</a> when it arrives.</p>
          : <ul className="dashboard-list">{overview.recentPayments.map(entry => <li key={entry.id}>
            <div className="dashboard-row"><strong>{formatUsd(entry.amountCents)} USD</strong><time dateTime={entryDate(entry)}>{displayReceivedDate(entry)}</time></div>
            <p className="dashboard-help">{entry.projectName}</p>{entryNote(entry) && <p className="dashboard-note">{entryNote(entry)}</p>}
          </li>)}</ul>}
      </section>
    </div>
    <section className="dashboard-panel" aria-labelledby="dashboard-goals-heading"><div className="dashboard-panel-header"><h2 id="dashboard-goals-heading">Financial goals</h2><a href="#goals">Manage goals</a></div>
      <p className="dashboard-help">Progress is income received, not savings. Overlapping goals can count the same payment.</p>
      {!overview.goals.length ? <p className="dashboard-empty">No income targets yet. <a href="#goals">Create a goal</a> to follow progress.</p>
        : <ul className="dashboard-list">{overview.goals.map(goal => <li key={goal.id}>
          <div className="dashboard-row"><h3>{goal.title}</h3><span className="badge">{deadlineStatus(goal.deadline, today)}</span></div>
          {goal.progress ? <>
            <p>{formatUsd(goal.progress.receivedCents)} income received / {formatUsd(goal.progress.targetCents)} USD target</p>
            <p className="dashboard-help">{goal.progress.percentage} · {formatUsd(goal.progress.remainingCents)} USD remaining · {displayGoalDate(goal.startDate)} through {displayGoalDate(goal.deadline)}</p>
            <progress max="100" value={goal.progress.barPercent} aria-label={`Income received toward ${goal.title}`} aria-valuetext={`${goal.progress.percentage} of income target`} />
          </> : <p className="dashboard-help">Target: {formatUsd(goal.targetCents)} USD. <a href="#goals">Set a complete date range</a> to calculate income received.</p>}
        </li>)}</ul>}
    </section>
  </section>
}
