import { useRef, useState } from 'react'
import { amountToInput, localDateInput } from '../income/incomeModel.js'
import { validateGoalForm } from './goalModel.js'

export default function GoalForm({ goal, onSave, onCancel }) {
  const [input, setInput] = useState({ title: goal?.title ?? '', target: goal ? amountToInput(goal.targetCents) : '', startDate: goal?.startDate ?? localDateInput(), deadline: goal?.deadline ?? '' })
  const [errors, setErrors] = useState({})
  const formRef = useRef(null)
  function change(event) {
    const { name, value } = event.target
    setInput(previous => ({ ...previous, [name]: value }))
  }
  function submit(event) {
    event.preventDefault()
    const result = validateGoalForm(input)
    setErrors(result.errors)
    const invalidField = Object.keys(result.errors)[0]
    if (invalidField) { formRef.current.elements.namedItem(invalidField)?.focus(); return }
    if (!onSave(input)) setErrors({ form: 'The goal could not be saved. Please try again.' })
  }
  const fields = [
    { name: 'title', label: 'Title', type: 'text' },
    { name: 'target', label: 'Target in USD', type: 'text', inputMode: 'decimal' },
    { name: 'startDate', label: 'Start date', type: 'date' },
    { name: 'deadline', label: 'Deadline', type: 'date' },
  ]
  return <form ref={formRef} className="goal-form" onSubmit={submit} noValidate aria-labelledby="goal-form-heading">
    <h2 id="goal-form-heading">{goal ? 'Edit income goal' : 'New income goal'}</h2>
    <div className="goal-fields">{fields.map(field => <div key={field.name}>
      <label htmlFor={`goal-${field.name}`}>{field.label} (required)</label>
      <input id={`goal-${field.name}`} name={field.name} type={field.type} inputMode={field.inputMode} value={input[field.name]} onChange={change} required autoFocus={field.name === 'title'} aria-invalid={Boolean(errors[field.name])} aria-describedby={`goal-${field.name}-error`} />
      <p className="goal-error" id={`goal-${field.name}-error`}>{errors[field.name]}</p>
    </div>)}</div>
    {errors.form && <p className="goal-error" role="alert">{errors.form}</p>}
    <div className="goal-actions"><button className="goal-button primary" type="submit">{goal ? 'Save changes' : 'Create goal'}</button><button className="goal-button" type="button" onClick={onCancel}>Cancel</button></div>
  </form>
}
