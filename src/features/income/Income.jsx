import { useEffect, useRef, useState } from 'react'
import { useWorkTracker } from '../../app/WorkTrackerContext.js'
import IncomeForm from './IncomeForm.jsx'
import { displayReceivedDate, entryDate, entryNote, formatUsd, removeIncome, saveIncome, sortedIncome, totalIncomeCents } from './incomeModel.js'
import './income.css'

export default function Income() {
  const { data, setData, notice } = useWorkTracker()
  const [editor, setEditor] = useState(null)
  const [removing, setRemoving] = useState(null)
  const [message, setMessage] = useState('')
  const addRef = useRef(null)
  const trigger = useRef(null)
  const restoreFocus = useRef(false)
  useEffect(() => {
    if (editor === null && removing === null && restoreFocus.current) {
      (trigger.current?.isConnected ? trigger.current : addRef.current)?.focus()
      restoreFocus.current = false
    }
  }, [editor, removing])
  function close() {
    restoreFocus.current = true
    setEditor(null)
    setRemoving(null)
  }
  function save(input) {
    try {
      if (!setData(previous => saveIncome(previous, input, editor.id))) return false
      setMessage(editor.id ? 'Payment updated.' : 'Payment recorded.')
      close()
      return true
    } catch { return false }
  }
  function confirmRemoval() {
    try {
      if (!setData(previous => removeIncome(previous, removing, true))) throw new Error('Update rejected')
      setMessage('Payment removed.')
      close()
    } catch { setMessage('Payment could not be removed. Please try again.') }
  }
  const busy = editor !== null || removing !== null
  const entries = sortedIncome(data.incomeEntries)
  const editing = editor?.id ? data.incomeEntries.find(entry => entry.id === editor.id) : null
  return <section aria-labelledby="income-heading">
    <p className="eyebrow">Your workspace</p>
    <div className="income-header"><div><h1 id="income-heading">Income</h1><p className="description">Payments you have actually received.</p></div>
      <button ref={addRef} className="income-button primary" type="button" disabled={busy} onClick={() => { trigger.current = null; setEditor({ id: null }); setMessage('') }}>Record payment</button></div>
    <div className="income-total"><span>Total recorded income</span><strong>{formatUsd(totalIncomeCents(data.incomeEntries))} USD</strong><p>Only recorded payments count. Work sessions and hourly rates are not income.</p></div>
    <p className="income-feedback" role="status">{message}</p>
    {editor && <IncomeForm key={editor.id ?? 'new'} entry={editing} projects={data.projects} onSave={save} onCancel={close} />}
    {removing !== null && <section className="income-confirm" role="alertdialog" aria-labelledby="remove-income-heading" aria-describedby="remove-income-description">
      <h2 id="remove-income-heading">Remove this payment?</h2>
      <p id="remove-income-description">Remove {formatUsd(data.incomeEntries.find(entry => entry.id === removing).amountCents)} from recorded income? This cannot be undone.</p>
      <div className="income-actions"><button className="income-button" type="button" autoFocus onClick={close}>Cancel</button><button className="income-button danger" type="button" onClick={confirmRemoval}>Confirm removal</button></div>
    </section>}
    {notice && <p className="income-help">Changes are available in this session. Check the storage warning above before reloading.</p>}
    <h2>Received payments</h2>
    {!entries.length ? <p className="income-empty">No payments recorded yet. Record a payment when it is received.</p>
      : <ul className="income-list">{entries.map(entry => {
        const project = data.projects.find(item => item.id === entry.projectId)
        return <li className="income-card" key={entry.id}>
          <div className="income-card-header"><strong>{formatUsd(entry.amountCents)} USD</strong><time dateTime={entryDate(entry)}>{displayReceivedDate(entry)}</time></div>
          <p className="income-project">{project ? `${project.name}${project.status === 'archived' ? ' (archived)' : ''}` : entry.projectId ? `Unavailable project (${entry.projectId})` : 'No project'}</p>
          <p className="income-note">{entryNote(entry) || 'No note'}</p>
          <div className="income-actions">
            <button className="income-button" type="button" disabled={busy} aria-label={`Edit payment of ${formatUsd(entry.amountCents)} received ${entryDate(entry)}`} onClick={event => { trigger.current = event.currentTarget; setEditor({ id: entry.id }); setMessage('') }}>Edit</button>
            <button className="income-button" type="button" disabled={busy} aria-label={`Remove payment of ${formatUsd(entry.amountCents)} received ${entryDate(entry)}`} onClick={event => { trigger.current = event.currentTarget; setRemoving(entry.id); setMessage('') }}>Remove</button>
          </div>
        </li>
      })}</ul>}
  </section>
}
