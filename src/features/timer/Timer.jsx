import { useEffect, useRef, useState } from 'react'
import { useWorkTracker } from '../../app/WorkTrackerContext.js'
import { elapsedSeconds, formatDuration, startTimer, stopTimer } from './timerModel.js'
import './timer.css'

export default function Timer() {
  const { data, setData, notice } = useWorkTracker()
  const [projectId, setProjectId] = useState('')
  const [note, setNote] = useState('')
  const [now, setNow] = useState(Date.now)
  const [message, setMessage] = useState('')
  const selectRef = useRef(null)
  const stopRef = useRef(null)
  const focusStop = useRef(false)
  const returnFocus = useRef(false)
  const timer = data.activeTimer
  useEffect(() => {
    const refresh = () => setNow(Date.now())
    const interval = window.setInterval(refresh, 500)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])
  useEffect(() => {
    if (timer && focusStop.current) {
      stopRef.current?.focus()
      focusStop.current = false
    }
    if (!timer && returnFocus.current) {
      selectRef.current?.focus()
      returnFocus.current = false
    }
  }, [timer])
  const activeProjects = data.projects.filter(project => project.status === 'active')
  const runningProject = timer && data.projects.find(project => project.id === timer.projectId)
  const seconds = timer ? elapsedSeconds(timer.startedAt, now) : 0
  const recent = [...data.sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 10)
  const clockWarning = timer && seconds === null
    ? 'The start time is invalid or ahead of the current clock. You can stop the timer, but no session will be saved unless the elapsed time is valid and at least one second.'
    : ''
  function start(event) {
    event.preventDefault()
    try {
      const currentTime = Date.now()
      setNow(currentTime)
      if (!setData(previous => startTimer(previous, projectId, { startedAt: new Date(currentTime).toISOString() }))) throw new Error('The timer could not be started. Please try again.')
      focusStop.current = true
      setNote('')
      setMessage('Timer started.')
    } catch (error) {
      setMessage(error.message)
    }
  }
  function stop() {
    try {
      const endedAt = new Date().toISOString()
      if (!setData(previous => stopTimer(previous, timer.id, note, endedAt))) throw new Error('The session could not be saved. The timer is still running.')
      returnFocus.current = true
      setNote('')
      const elapsed = elapsedSeconds(timer.startedAt, Date.parse(endedAt))
      setMessage(elapsed === null ? 'Timer stopped; its timestamp was invalid or in the future, so no session was saved.'
        : elapsed < 1 ? 'Timer stopped; session was too short to save.'
          : 'Session recorded. Check any storage warning above before reloading.')
    } catch (error) {
      setMessage(error.message)
    }
  }
  return <section aria-labelledby="timer-heading">
    <p className="eyebrow">Your workspace</p>
    <h1 id="timer-heading">Work Timer</h1>
    <p className="description">Make room for focused work.</p>
    <p className="timer-help">Use one Work Tracker tab for timing. Multiple tabs do not synchronize their changes.</p>
    <p className="timer-feedback" role="status">{message}</p>
    <div className="timer-panel">
      {timer ? <>
        <p className="timer-project">{runningProject?.name ?? `Project unavailable (${timer.projectId})`}</p>
        {runningProject?.status === 'archived' && <p className="timer-help">This project is archived. You can finish this timer; its project reference will be retained.</p>}
        <div className="timer-display" role="timer" aria-label="Elapsed time" aria-live="off">{seconds === null ? '--:--:--' : formatDuration(seconds)}</div>
        <p className="timer-help">Hours : minutes : seconds · Calculated from the start timestamp.</p>
        {clockWarning && <p className="timer-error" role="alert">{clockWarning}</p>}
        <label className="timer-label" htmlFor="session-note">Session note (optional)</label>
        <textarea id="session-note" value={note} onChange={event => setNote(event.target.value)} rows={3} />
        <p className="timer-help">Stop ends the timer immediately. Sessions under one second are not saved.</p>
        <button ref={stopRef} className="timer-button primary" type="button" onClick={stop}>Stop timer</button>
      </> : <form onSubmit={start}>
        <label className="timer-label" htmlFor="timer-project">Project</label>
        <select ref={selectRef} id="timer-project" value={projectId} onChange={event => setProjectId(event.target.value)} aria-describedby="timer-project-help" required>
          <option value="">Select an active project</option>
          {activeProjects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
        <p className="timer-help" id="timer-project-help">{activeProjects.length ? 'Only active projects can start a new timer.' : 'Create or restore a project in Projects before starting a timer.'}</p>
        <button className="timer-button primary" type="submit" disabled={!activeProjects.some(project => project.id === projectId)}>Start timer</button>
      </form>}
      {notice && <p className="timer-help">Storage is unavailable for these changes. Your timer and sessions may not survive a reload; see the warning above.</p>}
    </div>
    <section className="sessions-section" aria-labelledby="sessions-heading">
      <h2 id="sessions-heading">Recent sessions</h2>
      <p className="timer-help">The 10 most recent sessions, with start times in your local timezone.</p>
      {!recent.length ? <p className="sessions-empty">No sessions yet. Start a timer to record your work.</p>
        : <ul className="session-list">{recent.map(session => {
          const project = data.projects.find(item => item.id === session.projectId)
          return <li className="session-card" key={session.id}>
            <div className="session-header"><h3>{project?.name ?? (session.projectId ? `Project unavailable (${session.projectId})` : 'Unassigned project')}</h3>
              <span className="session-duration">{formatDuration(session.durationSeconds)}</span></div>
            <time dateTime={session.startedAt}>{new Date(session.startedAt).toLocaleString()}</time>
            <p className="session-note">{session.notes || 'No note'}</p>
          </li>
        })}</ul>}
    </section>
  </section>
}
