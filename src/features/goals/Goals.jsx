import { useEffect, useRef, useState } from 'react'
import { useWorkTracker } from '../../app/WorkTrackerContext.js'
import { formatUsd, localDateInput } from '../income/incomeModel.js'
import { deadlineStatus, displayGoalDate, goalProgress, removeGoal, saveGoal } from './goalModel.js'
import GoalForm from './GoalForm.jsx'
import './goals.css'

export default function Goals() {
  const { data, setData, notice } = useWorkTracker()
  const [editor, setEditor] = useState(null)
  const [removing, setRemoving] = useState(null)
  const [message, setMessage] = useState('')
  const [today, setToday] = useState(localDateInput)
  const addRef = useRef(null)
  const trigger = useRef(null)
  const restoreFocus = useRef(false)
  useEffect(() => {
    const refresh = () => setToday(localDateInput())
    const interval = window.setInterval(refresh, 60000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => { window.clearInterval(interval); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [])
  useEffect(() => {
    if (editor === null && removing === null && restoreFocus.current) {
      (trigger.current?.isConnected ? trigger.current : addRef.current)?.focus()
      restoreFocus.current = false
    }
  }, [editor, removing])
  function close() { restoreFocus.current = true; setEditor(null); setRemoving(null) }
  function save(input) {
    try {
      if (!setData(previous => saveGoal(previous, input, editor.id))) return false
      setMessage(editor.id ? 'Income goal updated.' : 'Income goal created.')
      close()
      return true
    } catch { return false }
  }
  function confirmRemoval() {
    try {
      if (!setData(previous => removeGoal(previous, removing, true))) throw new Error('Update rejected')
      setMessage('Goal removed. Recorded payments are unchanged.')
      close()
    } catch { setMessage('Goal could not be removed. Please try again.') }
  }
  const busy = editor !== null || removing !== null
  const editing = editor?.id ? data.goals.find(goal => goal.id === editor.id) : null
  const removingGoal = data.goals.find(goal => goal.id === removing)
  return <section aria-labelledby="goals-heading">
    <p className="eyebrow">Your workspace</p>
    <div className="goals-header"><div><h1 id="goals-heading">Financial Goals</h1><p className="description">Independent targets for income received.</p></div>
      <button ref={addRef} className="goal-button primary" type="button" disabled={busy} onClick={() => { trigger.current = null; setEditor({ id: null }); setMessage('') }}>New income goal</button></div>
    <p className="goals-explanation">Each goal counts payments received from its start date through its deadline, including both days. Overlapping ranges can count the same payment toward more than one goal. Progress is income received, not money saved.</p>
    <p className="goal-feedback" role="status">{message}</p>
    {editor && <GoalForm key={editor.id ?? 'new'} goal={editing} onSave={save} onCancel={close} />}
    {removingGoal && <section className="goal-confirm" role="alertdialog" aria-labelledby="remove-goal-heading" aria-describedby="remove-goal-description">
      <h2 id="remove-goal-heading">Remove this goal?</h2><p id="remove-goal-description">Remove “{removingGoal.title}”? This cannot be undone. Your recorded payments will stay unchanged.</p>
      <div className="goal-actions"><button className="goal-button" type="button" autoFocus onClick={close}>Cancel</button><button className="goal-button danger" type="button" onClick={confirmRemoval}>Confirm removal</button></div>
    </section>}
    {notice && <p className="goal-help">Changes are available in this session. Check the storage warning above before reloading.</p>}
    {!data.goals.length ? <p className="goals-empty">No income goals yet. Create a target and choose its date range.</p>
      : <ul className="goals-list">{data.goals.map(goal => {
        const progress = goalProgress(goal, data.incomeEntries)
        return <li className="goal-card" key={goal.id}>
          <div className="goal-card-header"><h2>{goal.title}</h2><span className="badge">{deadlineStatus(goal.deadline, today)}</span></div>
          <p className="goal-help">{displayGoalDate(goal.startDate)} through {displayGoalDate(goal.deadline)}</p>
          {progress ? <>
            <dl className="goal-stats"><div><dt>Income received</dt><dd>{formatUsd(progress.receivedCents)} USD</dd></div><div><dt>Target</dt><dd>{formatUsd(progress.targetCents)} USD</dd></div><div><dt>Remaining</dt><dd>{formatUsd(progress.remainingCents)} USD</dd></div></dl>
            <p className="goal-percent">{progress.percentage} of target{progress.reached ? ' · Target reached' : ''}</p>
            <progress max="100" value={progress.barPercent} aria-label={`Income received toward ${goal.title}`} aria-valuetext={`${progress.percentage} of income target`} />
          </> : <><p>Target: {formatUsd(goal.targetCents)} USD</p><p className="goal-help">This existing goal has no complete date range. Edit it to set a start date and deadline before calculating income received.</p></>}
          <div className="goal-actions">
            <button className="goal-button" type="button" disabled={busy} aria-label={`Edit goal ${goal.title}`} onClick={event => { trigger.current = event.currentTarget; setEditor({ id: goal.id }); setMessage('') }}>Edit</button>
            <button className="goal-button" type="button" disabled={busy} aria-label={`Remove goal ${goal.title}`} onClick={event => { trigger.current = event.currentTarget; setRemoving(goal.id); setMessage('') }}>Remove</button>
          </div>
        </li>
      })}</ul>}
  </section>
}
