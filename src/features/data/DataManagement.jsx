import { useRef, useState } from 'react'
import { useWorkTracker } from '../../app/WorkTrackerContext.js'
import { readSavedValue } from '../../lib/storage.js'
import { backupPreview, exportBackup, MAX_BACKUP_BYTES, parseBackup } from './backupModel.js'
import './data.css'

function download(text, filename) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function DataManagement() {
  const { data, notice, replaceData } = useWorkTracker()
  const [backup, setBackup] = useState(null)
  const [timerChoice, setTimerChoice] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [replaceInvalid, setReplaceInvalid] = useState(false)
  const [message, setMessage] = useState('')
  const [reading, setReading] = useState(false)
  const inputRef = useRef(null)
  const previewRef = useRef(null)
  const request = useRef(0)
  function clear() {
    request.current++
    setBackup(null); setTimerChoice(''); setConfirmed(false); setReplaceInvalid(false); setReading(false)
    if (inputRef.current) inputRef.current.value = ''
  }
  async function choose(event) {
    const file = event.target.files?.[0]
    clear(); setMessage('')
    if (!file) return
    const current = request.current
    setReading(true)
    try {
      if (!file.name.toLowerCase().endsWith('.json') || file.size > MAX_BACKUP_BYTES) throw new Error('Choose a .json backup no larger than 5 MiB.')
      const parsed = parseBackup(await file.text())
      if (request.current !== current) return
      setBackup(parsed)
      setMessage('Backup validated. Review the preview before confirming replacement.')
      window.setTimeout(() => previewRef.current?.focus(), 0)
    } catch (error) { if (request.current === current) setMessage(error.message) }
    finally { if (request.current === current) setReading(false) }
  }
  function restore(event) {
    event.preventDefault()
    const result = replaceData(backup.state, { confirmed, timerChoice, replaceInvalid })
    setMessage(result.message)
    if (result.ok) { clear(); inputRef.current?.focus() }
  }
  const preview = backup && backupPreview(backup)
  return <section aria-labelledby="data-heading">
    <p className="eyebrow">Your workspace</p><h1 id="data-heading">Data Management</h1>
    <p className="description">Download and restore local backups. Files stay in your browser; nothing is uploaded.</p>
    <p role="status" className="data-message">{message}</p>
    <section className="data-panel" aria-labelledby="export-heading"><h2 id="export-heading">Export current data</h2>
      <p>Includes settings, projects, sessions, received payments, goals, and any active timer. This exports the current session, including changes that a storage failure may have left unsaved.</p>
      <button type="button" onClick={() => { try { download(exportBackup(data), `work-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`); setMessage('Backup download requested. Keep it somewhere safe.') } catch (error) { setMessage(error.message) } }}>Download backup</button>
    </section>
    <section className="data-panel" aria-labelledby="recovery-heading"><h2 id="recovery-heading">Saved-data recovery</h2>
      <p>If saved data is corrupted, download its exact raw value before replacing it. This recovery file is not necessarily a valid backup. Keep it for troubleshooting.</p>
      <button type="button" onClick={() => {
        const saved = readSavedValue()
        if (!saved.ok) setMessage('Browser storage cannot be read. No data was changed.')
        else if (saved.raw === null) setMessage('There is no saved value to download.')
        else { try { download(saved.raw, 'work-tracker-raw-saved-data.json'); setMessage('Raw saved-value download requested. No data was changed.') } catch { setMessage('The raw saved value could not be downloaded. No data was changed.') } }
      }}>Download raw saved value</button>
      {notice && <p>The storage warning above still applies. A successful restore will enable saving again.</p>}
    </section>
    <section className="data-panel" aria-labelledby="import-heading"><h2 id="import-heading">Restore a backup</h2>
      <label htmlFor="backup-file">JSON backup file (maximum 5 MiB)</label>
      <input ref={inputRef} id="backup-file" type="file" accept=".json,application/json" onChange={choose} aria-describedby="backup-help" />
      <p id="backup-help">Only version 1 Work Tracker backups are accepted. Restore replaces records rather than merging them.</p>
      {reading && <p role="status">Reading backup…</p>}
      {data.activeTimer && <p className="data-warning">Stop your current timer in <a href="#timer">Timer</a> before replacing data. You can still export or preview a backup.</p>}
      {backup && <form onSubmit={restore}>
        <h3 ref={previewRef} tabIndex={-1}>Backup preview</h3>
        <p>Exported <time dateTime={backup.exportedAt}>{new Date(backup.exportedAt).toLocaleString()}</time></p>
        <dl className="data-counts">{Object.entries({ Projects: preview.projects, Sessions: preview.sessions, Payments: preview.payments, Goals: preview.goals, Currency: preview.currency, 'Running timer': preview.runningTimer ? 'Yes' : 'No' }).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        {preview.runningTimer && <fieldset><legend>Backup timer (choose one)</legend>
          <p>Preserving the timer uses its original start time, {backup.state.activeTimer.startedAt}. Time since that start, including time while the app was closed, counts toward elapsed time. Future start times follow the existing Timer clock warning.</p>
          <label><input type="radio" name="backup-timer" value="preserve" checked={timerChoice === 'preserve'} onChange={() => setTimerChoice('preserve')} required /> Preserve running timer</label>
          <label><input type="radio" name="backup-timer" value="discard" checked={timerChoice === 'discard'} onChange={() => setTimerChoice('discard')} required /> Discard running timer (no session is created)</label>
        </fieldset>}
        <p className="data-warning">Replacement affects all existing Work Tracker records in this browser. Export current data first if you may need it later. There is no undo.</p>
        <label><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} required /> I confirm replacement of this browser’s current records.</label>
        <label><input type="checkbox" checked={replaceInvalid} onChange={event => setReplaceInvalid(event.target.checked)} /> Recovery only: I authorize replacing invalid saved data after having the option to download its raw value.</label>
        <div className="data-actions"><button type="submit" disabled={Boolean(data.activeTimer) || !confirmed || (preview.runningTimer && !timerChoice)}>Replace data with backup</button>
          <button type="button" onClick={() => { clear(); setMessage('Restore cancelled. Current data is unchanged.'); inputRef.current?.focus() }}>Cancel</button></div>
      </form>}
    </section>
  </section>
}
