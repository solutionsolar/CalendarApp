import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import CameraCapture from './components/CameraCapture.jsx'

const API_BASE = (typeof window !== 'undefined' && window.location && window.location.hostname !== 'localhost')
  ? ''
  : (import.meta.env.VITE_API_BASE || 'http://localhost:4000')

function useAuthed() {
  const [authed, setAuthed] = useState(false)
  useEffect(() => {
    fetch(`${API_BASE}/auth/me`, { credentials: 'include' })
      .then(r => r.json()).then(d => setAuthed(!!d.authed))
      .catch(() => setAuthed(false))
  }, [])
  return [authed, setAuthed]
}

function App() {
  const [authed, setAuthed] = useAuthed()
  const [weekStartISO, setWeekStartISO] = useState(() => new Date().toISOString().slice(0,10))
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
  const [files, setFiles] = useState([])
  const [rawText, setRawText] = useState('')
  const [blocks, setBlocks] = useState([])
  const [loading, setLoading] = useState(false)
  const [warnings, setWarnings] = useState([])
  const [showCamera, setShowCamera] = useState(false)

  const onLogin = async () => {
    const r = await fetch(`${API_BASE}/auth/google`, { credentials: 'include' })
    const { url } = await r.json()
    window.location.href = url
  }

  const onFiles = (e) => {
    const incoming = Array.from(e.target.files || [])
    setFiles(prev => [...prev, ...incoming].slice(0, 10))
  }

  const onDrop = (e) => {
    e.preventDefault()
    const incoming = Array.from(e.dataTransfer?.files || [])
    setFiles(prev => [...prev, ...incoming].slice(0, 10))
  }

  const removeFile = (idx) => {
    setFiles(prev => prev.filter((_, i) => i !== idx))
  }

  const onUpload = async () => {
    if (!files.length) return
    setLoading(true)
    try {
      const form = new FormData()
      for (const f of files) form.append('images', f)
      form.append('weekStartISO', weekStartISO)
      form.append('timezone', timezone)
      const r = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        credentials: 'include',
        body: form
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Upload failed')
      setRawText(d.rawText || '')
      setBlocks(d.blocks || [])
      setWarnings(d.warnings || [])
    } catch (e) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  const onCreateBlocks = async () => {
    if (!blocks.length) return
    setLoading(true)
    try {
      const r = await fetch(`${API_BASE}/api/block`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocks })
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Failed to create events')
      alert(`Created ${d.created?.length || 0} events.`)
      setBlocks([])
    } catch (e) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <h2>Calendar Blocker</h2>
      {!authed ? (
        <div className="card">
          <p>Connect your Google Calendar to continue.</p>
          <button onClick={onLogin}>Connect Google</button>
        </div>
      ) : (
        <>
          <div className="grid two">
            <div className="card">
              <div className="section-title">Week</div>
              <div className="row">
                <div>
                  <label>Week start (Mon)</label>
                  <input type="date" value={weekStartISO} onChange={e => setWeekStartISO(e.target.value)} />
                </div>
                <div>
                  <label>Timezone</label>
                  <input value={timezone} onChange={e => setTimezone(e.target.value)} placeholder="America/Los_Angeles" />
                  <div className="muted" style={{ marginTop: 6 }}>IANA timezone</div>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="section-title">Capture</div>
              <div className="row">
                <button className="btn" onClick={() => setShowCamera(true)}>
                  Use Camera
                </button>
                <label className="btn secondary" htmlFor="file-input">Choose Photos</label>
                <input id="file-input" type="file" multiple accept="image/*" capture="environment" onChange={onFiles} style={{ display: 'none' }} />
              </div>
              <div
                className="dropzone"
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
              >
                Drag & drop screenshots or photos here (max 10)
              </div>
              {!!files.length && (
                <div className="thumbs">
                  {files.map((f, i) => {
                    const url = URL.createObjectURL(f)
                    return (
                      <div className="thumb" key={i}>
                        <img src={url} alt={f.name} onLoad={() => URL.revokeObjectURL(url)} />
                        <button className="x" onClick={() => removeFile(i)}>×</button>
                      </div>
                    )
                  })}
                </div>
              )}
              <div className="row" style={{marginTop: 12}}>
                <button onClick={onUpload} className="btn" disabled={loading || !files.length}>{loading ? 'Processing…' : 'Process Images'}</button>
                <button className="btn secondary" onClick={() => { setFiles([]); setBlocks([]); setRawText(''); setWarnings([]) }} disabled={loading}>Reset</button>
              </div>
            </div>
          </div>

          

          {!!warnings.length && (
            <div className="card">
              <b>Warnings</b>
              <ul>
                {warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

          {!!rawText && (
            <div className="card">
              <b>OCR Text</b>
              <div className="muted" style={{whiteSpace: 'pre-wrap'}}>{rawText}</div>
            </div>
          )}

          {!!blocks.length && (
            <div className="card">
              <b>Detected Blocks</b>
              <div className="blocks">
                <ul>
                  {blocks.map((b, i) => (
                    <li key={i}>{new Date(b.start).toLocaleString()} → {new Date(b.end).toLocaleString()} ({b.timezone})</li>
                  ))}
                </ul>
              </div>
              <div className="row" style={{marginTop: 12}}>
                <button className="btn" onClick={onCreateBlocks} disabled={loading}>{loading ? 'Creating…' : 'Create Calendar Blocks'}</button>
              </div>
            </div>
          )}
        </>
      )}
      <div className="card">
        <b>Tips</b>
        <ul>
          <li>Take straight, well-lit photos; avoid skew/blur.</li>
          <li>Use weekday headers (Mon, Tue…) to improve parsing.</li>
          <li>Time formats like "9-5", "9am-5pm", or "10:30-2:15pm".</li>
        </ul>
      </div>
      {showCamera && (
        <CameraCapture
          onClose={() => setShowCamera(false)}
          onCapture={(file) => {
            setFiles(prev => [...prev, file].slice(0, 10))
          }}
        />
      )}
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
