import { useRef } from 'react'
import { useWorkTracker } from '../../app/WorkTrackerContext.js'
export default function AppShell({ sections, active, onNavigate, children }) {
  const { data, notice } = useWorkTracker()
  const mainRef = useRef(null)
  return <div className="app-shell">
    <a className="skip-link" href={`#${active}`} onClick={event => {
      event.preventDefault()
      mainRef.current?.focus()
      mainRef.current?.scrollIntoView()
    }}>Skip to content</a>
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark" aria-hidden="true">W</span>Work Tracker</div>
      <nav aria-label="Main navigation">{sections.map(({ id, label }, index) =>
        <button key={id} type="button" aria-current={active === id ? 'page' : undefined} onClick={() => onNavigate(id)}>
          <span className="nav-number" aria-hidden="true">0{index + 1}</span>{label}
        </button>)}</nav>
      <p className="sidebar-note">One workspace.<br />Your own pace.</p>
    </aside>
    <div className="workspace">
      <header className="topbar"><span>Personal workspace</span><span className="badge">{data.settings.currency}</span></header>
      <main ref={mainRef} id="main-content" tabIndex={-1}>{notice && <p className="storage-notice" role="status">{notice}</p>}{children}</main>
    </div>
  </div>
}
