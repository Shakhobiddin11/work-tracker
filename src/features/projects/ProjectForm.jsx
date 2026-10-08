import { useRef, useState } from 'react'
import { rateToInput, validateProjectForm } from './projectModel.js'

export default function ProjectForm({ project, onSave, onCancel }) {
  const [input, setInput] = useState({
    name: project?.name ?? '',
    clientName: project?.clientName ?? '',
    hourlyRate: project ? rateToInput(project.hourlyRateCents) : '',
  })
  const [errors, setErrors] = useState({})
  const nameRef = useRef(null)
  const rateRef = useRef(null)
  function submit(event) {
    event.preventDefault()
    const result = validateProjectForm(input)
    setErrors(result.errors)
    if (Object.keys(result.errors).length) {
      if (result.errors.name) nameRef.current.focus()
      else rateRef.current.focus()
      return
    }
    if (!onSave(input)) setErrors({ form: 'The project could not be updated. Please try again.' })
  }
  function change(event) {
    setInput(previous => ({ ...previous, [event.target.name]: event.target.value }))
  }
  return <form className="project-form" onSubmit={submit} noValidate aria-labelledby="project-form-heading">
    <h2 id="project-form-heading">{project ? 'Edit project' : 'New project'}</h2>
    <div className="form-fields">
      <div className="field">
        <label htmlFor="project-name">Project name <span>(required)</span></label>
        <input ref={nameRef} id="project-name" name="name" value={input.name} onChange={change} required autoFocus
          aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'project-name-error' : undefined} />
        {errors.name && <p className="field-error" id="project-name-error">{errors.name}</p>}
      </div>
      <div className="field">
        <label htmlFor="project-client">Client name <span>(optional)</span></label>
        <input id="project-client" name="clientName" value={input.clientName} onChange={change} />
      </div>
      <div className="field">
        <label htmlFor="project-rate">Hourly rate in USD <span>(optional)</span></label>
        <input ref={rateRef} id="project-rate" name="hourlyRate" type="text" inputMode="decimal" value={input.hourlyRate}
          onChange={change} placeholder="e.g. 50.00" aria-invalid={Boolean(errors.hourlyRate)}
          aria-describedby={`project-rate-help${errors.hourlyRate ? ' project-rate-error' : ''}`} />
        <p className="field-help" id="project-rate-help">Use a decimal point and up to two decimal places. Blank means $0.00/hour.</p>
        {errors.hourlyRate && <p className="field-error" id="project-rate-error">{errors.hourlyRate}</p>}
      </div>
    </div>
    {errors.form && <p className="field-error" role="alert">{errors.form}</p>}
    <div className="form-actions">
      <button className="button primary" type="submit">{project ? 'Save changes' : 'Create project'}</button>
      <button className="button" type="button" onClick={onCancel}>Cancel</button>
    </div>
  </form>
}
