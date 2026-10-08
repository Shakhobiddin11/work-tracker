import { useRef, useState } from 'react'
import { amountToInput, entryDate, entryNote, localDateInput, validateIncomeForm } from './incomeModel.js'

export default function IncomeForm({ entry, projects, onSave, onCancel }) {
  const [input, setInput] = useState({ amount: entry ? amountToInput(entry.amountCents) : '', receivedDate: entry ? entryDate(entry) : localDateInput(), projectId: entry?.projectId ?? '', notes: entry ? entryNote(entry) : '' })
  const [errors, setErrors] = useState({})
  const amountRef = useRef(null)
  const dateRef = useRef(null)
  const projectRef = useRef(null)
  function change(event) {
    const { name, value } = event.target
    setInput(previous => ({ ...previous, [name]: value }))
  }
  function submit(event) {
    event.preventDefault()
    const result = validateIncomeForm(input, projects, entry?.projectId)
    setErrors(result.errors)
    if (Object.keys(result.errors).length) {
      (result.errors.amount ? amountRef : result.errors.receivedDate ? dateRef : projectRef).current?.focus()
      return
    }
    if (!onSave(input)) setErrors({ form: 'The payment could not be saved. Please try again.' })
  }
  return <form className="income-form" onSubmit={submit} noValidate aria-labelledby="income-form-heading">
    <h2 id="income-form-heading">{entry ? 'Edit payment' : 'Record payment'}</h2>
    <div className="income-fields">
      <div><label htmlFor="income-amount">Amount in USD (required)</label>
        <input ref={amountRef} id="income-amount" name="amount" inputMode="decimal" value={input.amount} onChange={change} autoFocus required aria-invalid={Boolean(errors.amount)} aria-describedby="income-amount-help income-amount-error" />
        <p className="income-help" id="income-amount-help">Record payments actually received, not estimated earnings.</p>
        <p className="income-error" id="income-amount-error">{errors.amount}</p></div>
      <div><label htmlFor="income-date">Received date (required)</label>
        <input ref={dateRef} id="income-date" name="receivedDate" type="date" value={input.receivedDate} onChange={change} required aria-invalid={Boolean(errors.receivedDate)} aria-describedby="income-date-error" />
        <p className="income-error" id="income-date-error">{errors.receivedDate}</p></div>
      <div><label htmlFor="income-project">Project (optional)</label>
        <select ref={projectRef} id="income-project" name="projectId" value={input.projectId} onChange={change} aria-invalid={Boolean(errors.projectId)} aria-describedby="income-project-error">
          <option value="">No project</option>
          {entry?.projectId && !projects.some(project => project.id === entry.projectId) && <option value={entry.projectId}>Unavailable project ({entry.projectId})</option>}
          {projects.map(project => <option key={project.id} value={project.id}>{project.name}{project.status === 'archived' ? ' (archived)' : ''}</option>)}
        </select><p className="income-error" id="income-project-error">{errors.projectId}</p></div>
      <div><label htmlFor="income-note">Note (optional)</label>
        <textarea id="income-note" name="notes" value={input.notes} onChange={change} rows={3} /></div>
    </div>
    {errors.form && <p className="income-error" role="alert">{errors.form}</p>}
    <div className="income-actions"><button className="income-button primary" type="submit">{entry ? 'Save changes' : 'Record payment'}</button><button className="income-button" type="button" onClick={onCancel}>Cancel</button></div>
  </form>
}
