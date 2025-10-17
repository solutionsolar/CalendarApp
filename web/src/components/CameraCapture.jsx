import React, { useEffect, useRef, useState } from 'react'

export default function CameraCapture({ onCapture, onClose }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
        if (cancelled) return
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          setReady(true)
        }
      } catch (e) {
        setError('Camera access denied or unavailable.')
      }
    }
    start()
    return () => {
      cancelled = true
      if (streamRef.current) {
        for (const t of streamRef.current.getTracks()) t.stop()
      }
    }
  }, [])

  const capture = async () => {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    const ratio = video.videoWidth / video.videoHeight
    const width = Math.min(1280, video.videoWidth || 1280)
    const height = Math.round(width / ratio)
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, width, height)
    canvas.toBlob((blob) => {
      if (!blob) return
      const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' })
      onCapture?.(file)
    }, 'image/jpeg', 0.92)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 520, borderRadius: 14, border: '1px solid #2a2a31', background: '#111116', overflow: 'hidden' }}>
        <div style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #2a2a31' }}>
          <div style={{ color: '#a6a7ad', fontWeight: 600 }}>Camera</div>
          <button className="btn secondary" onClick={onClose}>Close</button>
        </div>
        <div style={{ padding: 12 }}>
          {error ? (
            <div className="muted">{error}</div>
          ) : (
            <>
              <video ref={videoRef} playsInline style={{ width: '100%', borderRadius: 12, background: '#000' }} />
              <div className="row" style={{ marginTop: 12, justifyContent: 'space-between' }}>
                <button className="btn secondary" onClick={onClose}>Cancel</button>
                <button className="btn" onClick={capture} disabled={!ready}>Take Photo</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

