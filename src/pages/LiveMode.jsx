import { useState, useCallback, useEffect, useRef } from 'react'
import axios from 'axios'
import AnswerCard from '../components/AnswerCard'
import { useNavigate } from 'react-router-dom'

const MicIcon = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
    <line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
)

const StopIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
  </svg>
)

export default function LiveMode() {
  const navigate = useNavigate()
  const [transcript,   setTranscript]   = useState('')   // Final confirmed transcript
  const [answer,       setAnswer]       = useState(null)
  const [loading,      setLoading]      = useState(false)
  const [loadMsg,      setLoadMsg]      = useState('')
  const [streamText,   setStreamText]   = useState('')   // Live streaming answer
  const [overlayOn,    setOverlayOn]    = useState(true)
  const [indexOk,      setIndexOk]      = useState(false)
  const [indexErr,     setIndexErr]     = useState('')
  const [stats,        setStats]        = useState({ total: 0, instant: 0, live: 0, coding: 0 })
  const abortRef = useRef(null)

  useEffect(() => {
    axios.get('http://localhost:3001/search/status')
      .then(r => {
        if (r.data.loaded && r.data.totalVectors > 0) setIndexOk(true)
        else setIndexErr('No Q&A bank found. Please complete Setup first.')
      })
      .catch(() => setIndexErr('Cannot connect to backend. Is the server running?'))
  }, [])

  // ── Main answer pipeline — fires instantly on transcript ──
  const handleTranscript = useCallback(async (text) => {
    setTranscript(text)
    setInterim('')
    setLoading(true)
    setStreamText('')
    setAnswer(null)

    // Abort any previous streaming request
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()

    try {
      // ── STEP 1: Detect coding question (fast keyword check) ──
      setLoadMsg('Detecting...')
      const { data: detect } = await axios.post(
        'http://localhost:3001/coding/detect',
        { text },
        { timeout: 2000 }
      )

      if (detect.isCoding) {
        // ── CODING: Generate code solution ──
        setLoadMsg('Generating code...')
        const { data: res } = await axios.post('http://localhost:3001/coding', { question: text })
        setAnswer(res.data)
        setStats(s => ({ ...s, total: s.total + 1, coding: s.coding + 1 }))
        if (window.electron) window.electron.showAnswer({ ...res.data, detectedQuestion: text })
        
        // Add to conversation thread for follow-ups
        axios.post('http://localhost:3001/session/thread/add', { question: text, answer: res.data.answer }).catch(e => console.error('[Thread] Error:', e))

      } else {
        // ── STEP 2: BM25 search — instant (<1ms) ──
        setLoadMsg('Searching...')
        const { data: searchRes } = await axios.post(
          'http://localhost:3001/search',
          { question: text },
          { timeout: 3000 }
        )
        const result = searchRes.data

        if (!result.useGroq) {
          // ── INSTANT MATCH: answer comes from Q&A bank ──
          setLoading(false)
          setAnswer(result)
          setStats(s => ({ ...s, total: s.total + 1, instant: s.instant + 1 }))
          if (window.electron) window.electron.showAnswer({ ...result, detectedQuestion: text })

          // Add to conversation thread for follow-ups
          axios.post('http://localhost:3001/session/thread/add', { question: text, answer: result.answer }).catch(e => console.error('[Thread] Error:', e))

        } else {
          // ── GROQ STREAMING: novel question — stream tokens as they arrive ──
          setLoadMsg('Generating live answer...')
          setLoading(false)  // Hide spinner, show streaming card immediately

          const response = await fetch('http://localhost:3001/groq', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ question: text, partialMatch: result.answer, stream: true }),
            signal:  abortRef.current.signal
          })

          const reader = response.body.getReader()
          const dec    = new TextDecoder()
          let fullAnswer = ''
          let finalData  = null

          // Show streaming card immediately
          setStreamText('...')

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = dec.decode(value, { stream: true })
            const lines = chunk.split('\n').filter(l => l.startsWith('data: '))

            for (const line of lines) {
              try {
                const json = JSON.parse(line.replace('data: ', ''))
                if (json.token) {
                  fullAnswer += json.token
                  setStreamText(fullAnswer)   // Update display in real-time
                }
                if (json.done && json.data) {
                  finalData = json.data
                }
              } catch {}
            }
          }

          // Finalize
          if (finalData) {
            setStreamText('')
            setAnswer(finalData)
            setStats(s => ({ ...s, total: s.total + 1, live: s.live + 1 }))
            if (window.electron) window.electron.showAnswer({ ...finalData, detectedQuestion: text })
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('[LiveMode] Error:', err)
        setLoadMsg('Error — please try again')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  function toggleOverlay() {
    const next = !overlayOn; setOverlayOn(next)
    if (window.electron) window.electron.toggleOverlay(next)
  }

  // ── Error state ──
  if (indexErr) return (
    <div>
      <div className="page-header"><h1 className="page-title">Live Mode</h1></div>
      <div className="alert alert-error">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <div>
          <div style={{ fontWeight: 700, marginBottom: '6px' }}>{indexErr}</div>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/')}>Go to Setup</button>
        </div>
      </div>
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h1 className="page-title">Live Mode</h1>
          <p className="page-subtitle">
            Real-time transcription → BM25 instant search → answer on overlay · &lt;1 second for known questions
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button id="overlay-toggle" className="btn btn-secondary btn-sm" onClick={toggleOverlay}>
            {overlayOn ? 'Hide Overlay' : 'Show Overlay'}
          </button>
          <button id="end-interview" className="btn btn-danger btn-sm"
            onClick={() => { setAnswer(null); navigate('/') }}>
            End Session
          </button>
        </div>
      </div>

      <div className="live-grid">
        {/* ── LEFT COLUMN ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Custom Overlay Mic Control Notice */}
          <div className="card" style={{ textAlign: 'center', padding: '28px 20px', border: '1.5px solid var(--indigo-300)', background: '#F8FAFF' }}>
            <div style={{
              width: '48px', height: '48px', margin: '0 auto 16px',
              background: 'rgba(99,102,241,0.1)', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--indigo-500)'
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              </svg>
            </div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-h)', marginBottom: '8px' }}>
              Overlay Microphone Active
            </div>
            <p style={{ fontSize: '12.5px', color: 'var(--text-p)', lineHeight: 1.6, maxWidth: '280px', margin: '0 auto 12px' }}>
              We've moved the recording button directly onto your floating Overlay! 
            </p>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', background: '#FFFFFF', padding: '8px 12px', borderRadius: '6px', border: '1px dashed var(--border)', display: 'inline-block', textAlign: 'left' }}>
              🎙 <strong>How to use:</strong> Click the small mic icon on the floating Overlay header to start listening, and click it again to get an instant answer.
            </div>
          </div>

          {/* Speed indicator */}
          <div className="card" style={{ padding: '14px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-label)', marginBottom: '10px' }}>
              Response Speed
            </div>
            {[
              { dot: 'var(--emerald)',   label: 'Q&A Bank match',   time: '< 0.1s',  sub: 'BM25 instant search' },
              { dot: 'var(--amber)',     label: 'Novel question',   time: '~1-2s',   sub: 'Groq streaming (words appear live)' },
              { dot: 'var(--violet-500)', label: 'Coding question', time: '~3-4s',   sub: 'Code generation + accuracy check' }
            ].map(m => (
              <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: m.dot, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-h)' }}>{m.label}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{m.sub}</div>
                </div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: m.dot }}>{m.time}</div>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="card">
            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-label)', marginBottom: '10px' }}>Session Stats</div>
            <div className="stats-grid">
              {[
                { n: stats.total,   l: 'Total',   c: 'var(--indigo-600)' },
                { n: stats.instant, l: 'Instant',  c: 'var(--emerald)' },
                { n: stats.live,    l: 'Live AI',  c: 'var(--amber)' },
                { n: stats.coding,  l: 'Coding',   c: 'var(--violet-600)' }
              ].map(s => (
                <div key={s.l} className="stat-card">
                  <div className="stat-number" style={{ color: s.c }}>{s.n}</div>
                  <div className="stat-label">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Transcript — shows interim words live */}
          <div className="card">
            <div className="transcript-label">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              </svg>
              Transcript — Real-time
            </div>
            <div id="transcript-box" className="transcript-box" style={{ minHeight: '52px' }}>
              {transcript ? (
                transcript
              ) : (
                <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '13px' }}>
                  No transcript generated yet. Speak to the overlay mic to begin.
                </span>
              )}
            </div>
          </div>

          {/* Loading indicator */}
          {loading && (
            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px' }}>
              <div className="spinner" />
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--indigo-600)' }}>{loadMsg}</div>
            </div>
          )}

          {/* Streaming answer — appears word by word */}
          {streamText && !answer && (
            <div className="answer-card">
              <div className="answer-card-accent live" />
              <div className="answer-card-body">
                <div style={{ display: 'flex', gap: '7px', marginBottom: '10px' }}>
                  <span className="badge badge-amber">Live AI — Streaming</span>
                </div>
                <div className="answer-text">
                  {streamText}
                  <span style={{ opacity: 0.4, animation: 'blink 0.8s infinite' }}>|</span>
                </div>
              </div>
            </div>
          )}

          {/* Final answer */}
          {answer && !streamText && <AnswerCard data={answer} />}

          {/* Empty state */}
          {!answer && !streamText && !loading && indexOk && (
            <div className="card">
              <div className="empty-state" style={{ padding: '32px 20px' }}>
                <div className="empty-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--indigo-500)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                </div>
                <div className="empty-title">Waiting for a Question</div>
                <div className="empty-desc">
                  Answers from your Q&A bank appear in under 0.1 seconds. Novel questions stream word-by-word via Groq.
                </div>
              </div>
            </div>
          )}

          {/* Shortcut row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'var(--bg-white)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
            <kbd style={{ background: '#F1F5F9', border: '1px solid var(--border)', borderRadius: 'var(--r-xs)', padding: '2px 8px', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-p)' }}>Ctrl+H</kbd>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Toggle overlay visibility</span>
            <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--emerald)', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Recording protected
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
