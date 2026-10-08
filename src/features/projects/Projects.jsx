import { useEffect, useRef, useState } from 'react'
import { useWorkTracker } from '../../app/WorkTrackerContext.js'
import ProjectForm from './ProjectForm.jsx'
import { changeProjectStatus, rateToInput, saveProject } from './projectModel.js'
import './projects.css'

export default function Projects() {
  const { data, setData, notice } = useWorkTracker()
  const [editor, setEditor] = useState(null)
  const [message, setMessage] = useState('')
  const newButton = useRef(null)
  const editTrigger = useRef(null)
  const returnFocus = useRef(false)
  useEffect(() => {
    if (editor === null && returnFocus.current) {
      (editTrigger.current ?? newButton.current)?.focus()
      returnFocus.current = false
    }
  }, [editor])
  const editingProject = editor?.id ? data.projects.find(project => project.id === editor.id) : null
  function closeEditor() {
    returnFocus.current = true
    setEditor(null)
  }
  function save(input) {
    try {
      const accepted = setData(previous => saveProject(previous, input, editor.id))
      if (!accepted) return false
      setMessage(editor.id ? 'Project updated.' : 'Project created.')
      closeEditor()
      return true
    } catch {
      return false
    }
  }
  function changeStatus(project) {
    const status = project.status === 'active' ? 'archived' : 'active'
    try {
      const accepted = setData(previous => changeProjectStatus(previous, project.id, status))
      if (!accepted) throw new Error('Update rejected')
      setMessage(status === 'archived' ? 'Project archived. Its history and references are retained.' : 'Project restored.')
      newButton.current?.focus()
    } catch {
      setMessage('The project status could not be updated. Please try again.')
    }
  }
  return <section aria-labelledby="projects-heading">
    <p className="eyebrow">Your workspace</p>
    <div className="projects-header">
      <div><h1 id="projects-heading">Projects</h1><p className="description">Keep your work organized in one place.</p></div>
      <button ref={newButton} className="button primary" type="button" onClick={() => {
        editTrigger.current = null
        setEditor({ id: null })
        setMessage('')
      }} disabled={editor !== null}>New project</button>
    </div>
    <p className="project-feedback" role="status">{message}</p>
    {editor && <ProjectForm key={editor.id ?? 'new'} project={editingProject} onSave={save} onCancel={closeEditor} />}
    {['active', 'archived'].map(status => {
      const projects = data.projects.filter(project => project.status === status)
      return <section className="project-group" key={status} aria-labelledby={`${status}-projects-heading`}>
        <h2 id={`${status}-projects-heading`}>{status === 'active' ? 'Active projects' : 'Archived projects'} <span className="badge">{projects.length}</span></h2>
        {status === 'archived' && <p className="field-help">Archived projects stay available for past sessions and payments.</p>}
        {projects.length === 0 ? <div className="project-empty">
          <p>{status === 'active' ? 'No active projects yet. Create a project to get started.' : 'No archived projects. Projects you archive will appear here.'}</p>
        </div> : <ul className="project-grid">{projects.map(project => <li className="project-card" key={project.id}>
          <div className="project-card-header"><h3>{project.name}</h3><span className={`badge status-${status}`}>{status === 'active' ? 'Active' : 'Archived'}</span></div>
          <p className="project-client">{project.clientName || 'No client specified'}</p>
          <p className="project-rate">${rateToInput(project.hourlyRateCents)} <span>USD / hour</span></p>
          <div className="project-actions">
            <button className="button" type="button" disabled={editor !== null} aria-label={`Edit ${project.name}`} onClick={event => {
              editTrigger.current = event.currentTarget
              setEditor({ id: project.id })
              setMessage('')
            }}>Edit</button>
            <button className="button" type="button" disabled={editor !== null} aria-label={`${status === 'active' ? 'Archive' : 'Restore'} ${project.name}`} onClick={() => changeStatus(project)}>
              {status === 'active' ? 'Archive' : 'Restore'}
            </button>
          </div>
        </li>)}</ul>}
      </section>
    })}
    {notice && <p className="field-help">Project changes remain available in this session. See the storage warning above for saving details.</p>}
  </section>
}
