import { useState, useRef } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'

const STEPS = [
  { id: 'gen',   label: 'Generating 120 personalized Q&A pairs via Azure GPT-4o' },
  { id: 'embed', label: 'Building instant search index (BM25)' },
  { id: 'done',  label: 'Complete — opening your Q&A Bank' }
]

const DocIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
)

const BriefcaseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
  </svg>
)

const SparkIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="currentColor"/>
  </svg>
)

const UploadIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
)

const PdfIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="9" y1="13" x2="15" y2="13"/>
    <line x1="9" y1="17" x2="12" y2="17"/>
  </svg>
)

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

const XIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

export default function Setup() {
  const navigate  = useNavigate()
  const fileRef   = useRef(null)

  // Resume — can be either PDF-extracted or text-pasted
  const [resume,      setResume]      = useState('')
  const [resumeMode,  setResumeMode]  = useState('pdf')   // 'pdf' | 'text'
  const [pdfFile,     setPdfFile]     = useState(null)    // File object
  const [pdfLoading,  setPdfLoading]  = useState(false)
  const [pdfError,    setPdfError]    = useState('')

  const [jd,             setJd]            = useState('')
  const [experienceYears, setExperienceYears] = useState('auto')
  const [loading,  setLoading]  = useState(false)
  const [step,     setStep]     = useState(-1)
  const [error,    setError]    = useState('')
  const [qaCount,  setQaCount]  = useState(0)

  // ── PDF upload handler ──
  async function handlePdfUpload(file) {
    if (!file) return
    if (file.type !== 'application/pdf') {
      setPdfError('Please upload a PDF file only.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setPdfError('File is too large. Maximum size is 10 MB.')
      return
    }

    setPdfFile(file)
    setPdfError('')
    setPdfLoading(true)
    setResume('')

    try {
      const form = new FormData()
      form.append('resume', file)

      // Do NOT set Content-Type manually — axios auto-sets it with the
      // required multipart boundary (e.g. boundary=----WebKitFormBoundaryXXX).
      // Setting it manually strips the boundary and breaks all uploads.
      const { data } = await axios.post('http://localhost:3001/parse-resume', form, {
        timeout: 30000
      })

      setResume(data.text)
      console.log(`[Setup] PDF parsed: ${data.chars} characters, ${data.pages} pages`)
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to parse PDF. Please try the text option instead.'
      setPdfError(msg)
      setPdfFile(null)
    } finally {
      setPdfLoading(false)
    }
  }

  // ── Drag & drop ──
  function handleDrop(e) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handlePdfUpload(file)
  }

  function handleDragOver(e) { e.preventDefault() }

  function removePdf() {
    setPdfFile(null)
    setResume('')
    setPdfError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  function getStepStatus(idx) {
    if (step < 0)      return 'pending'
    if (idx < step)    return 'done'
    if (idx === step)  return 'active'
    return 'pending'
  }

  async function handleGenerate() {
    if (!resume.trim()) {
      setError(resumeMode === 'pdf'
        ? 'Please upload your resume PDF first.'
        : 'Please paste your resume text first.')
      return
    }
    if (resume.trim().length < 100) {
      setError('Resume looks too short. Please provide your complete resume.')
      return
    }
    if (!jd.trim()) {
      setError('Please paste the job description.')
      return
    }

    setError(''); setLoading(true); setStep(0)

    try {
      // ── Step 1: SSE streaming generation — NO TIMEOUT ───────────────────────
      // We POST the body via fetch (to carry the request body), then parse SSE lines
      const response = await fetch('http://localhost:3001/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
        body:    JSON.stringify({ resume: resume.trim(), jd: jd.trim(), experienceYears })
      })

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}))
        throw new Error(errJson.error || `Server error: ${response.status}`)
      }

      const reader  = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer    = ''
      let qaArray   = []
      let done      = false

      while (!done) {
        const { value, done: streamDone } = await reader.read()
        done = streamDone
        if (value) buffer += decoder.decode(value, { stream: true })

        // Parse SSE — each message ends with \n\n
        const parts = buffer.split('\n\n')
        buffer = parts.pop() // keep incomplete tail

        for (const part of parts) {
          const eventLine = part.split('\n').find(l => l.startsWith('event:'))
          const dataLine  = part.split('\n').find(l => l.startsWith('data:'))
          if (!dataLine) continue

          const eventType = eventLine ? eventLine.replace('event:', '').trim() : 'message'
          const payload   = JSON.parse(dataLine.replace('data:', '').trim())

          if (eventType === 'batch') {
            qaArray = [...qaArray, ...payload.questions]
            setQaCount(qaArray.length) // live counter update
          } else if (eventType === 'error') {
            throw new Error(payload.error)
          } else if (eventType === 'done') {
            qaArray = payload.data    // use final deduped list
            setQaCount(qaArray.length)
            done = true
          }
        }
      }

      if (!qaArray.length) throw new Error('No questions were generated.')
      localStorage.setItem('qaArray', JSON.stringify(qaArray))

      // ── Step 2: Build BM25 index ─────────────────────────────────────────────
      setStep(1)
      const embedRes = await axios.post('http://localhost:3001/embed', { qaArray })
      if (!embedRes.data.success) throw new Error('Indexing failed')

      // Done
      setStep(2)
      setTimeout(() => navigate('/qa-bank'), 1400)

    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Something went wrong. Please try again.')
      setLoading(false)
      setStep(-1)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Interview Setup</h1>
        <p className="page-subtitle">
          Upload your resume PDF and paste the job description. The AI reads every word and generates 120 personalised, human-sounding Q&amp;A pairs.
        </p>
      </div>

      {/* Hero Banner */}
      <div className="hero-banner">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <div style={{ width: '28px', height: '28px', background: 'rgba(255,255,255,0.15)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <SparkIcon />
          </div>
          <div className="hero-banner-title">Powered by Azure GPT-4o</div>
        </div>
        <div className="hero-banner-sub">
          Reads your resume word-by-word and the job description in full. Generates 120 hyper-personalised Q&amp;As — every answer sounds like a real human, not an AI.
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
          {[
            '1 Background', '50 Technical', '9 Project',
            '9 Behavioral', '5 JD-Specific', '5 HR', '1 Real-Talk'
          ].map(c => (
            <span key={c} style={{
              background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)',
              fontSize: '11px', fontWeight: 600, padding: '4px 10px',
              borderRadius: '100px', border: '1px solid rgba(255,255,255,0.15)'
            }}>{c}</span>
          ))}
        </div>
      </div>

      {/* Input Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>

        {/* ── RESUME CARD ── */}
        <div className="card">
          <div className="card-header" style={{ marginBottom: '14px' }}>
            <div className="card-header-icon" style={{ color: 'var(--indigo-600)' }}><DocIcon /></div>
            Your Resume
            {/* Mode toggle */}
            <div style={{ marginLeft: 'auto', display: 'flex', background: 'var(--bg-page)', borderRadius: '8px', padding: '3px', border: '1px solid var(--border)', gap: '2px' }}>
              {[
                { key: 'pdf',  label: 'Upload PDF' },
                { key: 'text', label: 'Paste Text' }
              ].map(m => (
                <button
                  key={m.key}
                  onClick={() => { setResumeMode(m.key); if (m.key === 'text') { setPdfFile(null); setPdfError('') } }}
                  disabled={loading}
                  style={{
                    padding: '4px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                    fontSize: '11px', fontWeight: 600, transition: 'all 0.15s',
                    background: resumeMode === m.key ? 'white' : 'transparent',
                    color:      resumeMode === m.key ? 'var(--indigo-600)' : 'var(--text-muted)',
                    boxShadow:  resumeMode === m.key ? '0 1px 3px rgba(0,0,0,0.12)' : 'none'
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* PDF DROP ZONE */}
          {resumeMode === 'pdf' && (
            <div>
              {/* No file yet */}
              {!pdfFile && !pdfLoading && (
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onClick={() => fileRef.current?.click()}
                  style={{
                    border: '2px dashed var(--indigo-300)',
                    borderRadius: '12px',
                    padding: '40px 24px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.03), rgba(124,58,237,0.03))',
                    transition: 'all 0.2s',
                    minHeight: '280px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px'
                  }}
                  onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--indigo-500)'; e.currentTarget.style.background = 'rgba(99,102,241,0.06)' }}
                  onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--indigo-300)'; e.currentTarget.style.background = 'linear-gradient(135deg, rgba(99,102,241,0.03), rgba(124,58,237,0.03))' }}
                >
                  <div style={{ color: 'var(--indigo-400)', opacity: 0.7 }}><UploadIcon /></div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-h)', marginBottom: '6px' }}>
                      Drop your resume PDF here
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      or <span style={{ color: 'var(--indigo-600)', fontWeight: 600 }}>click to browse</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                      PDF only · Max 10 MB · All content extracted automatically
                    </div>
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    style={{ display: 'none' }}
                    onChange={e => handlePdfUpload(e.target.files[0])}
                  />
                </div>
              )}

              {/* Parsing spinner */}
              {pdfLoading && (
                <div style={{
                  border: '2px solid var(--indigo-200)',
                  borderRadius: '12px', padding: '40px 24px', textAlign: 'center',
                  minHeight: '280px', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: '14px'
                }}>
                  <div className="spinner" style={{ width: '28px', height: '28px', borderWidth: '3px' }} />
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--indigo-600)' }}>
                    Reading your resume...
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Extracting every word from your PDF
                  </div>
                </div>
              )}

              {/* File uploaded successfully */}
              {pdfFile && !pdfLoading && resume && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* File badge */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 14px', background: '#ECFDF5',
                    border: '1px solid rgba(16,185,129,0.25)', borderRadius: '10px'
                  }}>
                    <div style={{ color: 'var(--emerald)' }}><PdfIcon /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#065F46', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {pdfFile.name}
                      </div>
                      <div style={{ fontSize: '11px', color: '#047857' }}>
                        {resume.length.toLocaleString()} characters extracted · Ready
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <div style={{ width: '22px', height: '22px', background: 'var(--emerald)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                        <CheckIcon />
                      </div>
                      <button onClick={removePdf} style={{ width: '22px', height: '22px', background: '#FEE2E2', border: 'none', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DC2626' }}>
                        <XIcon />
                      </button>
                    </div>
                  </div>

                  {/* Preview of extracted text */}
                  <div style={{
                    background: 'var(--bg-page)', borderRadius: '10px', padding: '12px 14px',
                    border: '1px solid var(--border)', maxHeight: '240px', overflowY: 'auto'
                  }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-label)', marginBottom: '8px' }}>
                      Extracted Text Preview
                    </div>
                    <pre style={{ fontSize: '11px', color: 'var(--text-p)', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, fontFamily: 'inherit' }}>
                      {resume.substring(0, 600)}{resume.length > 600 ? `\n\n... (+${(resume.length - 600).toLocaleString()} more characters)` : ''}
                    </pre>
                  </div>

                  {/* Change file */}
                  <button
                    onClick={() => fileRef.current?.click()}
                    style={{ fontSize: '12px', color: 'var(--indigo-600)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', textAlign: 'left', padding: 0, fontFamily: 'inherit' }}
                  >
                    Upload a different PDF
                  </button>
                  <input ref={fileRef} type="file" accept=".pdf,application/pdf" style={{ display: 'none' }} onChange={e => handlePdfUpload(e.target.files[0])} />
                </div>
              )}

              {/* PDF error */}
              {pdfError && (
                <div className="alert alert-error" style={{ marginTop: '10px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <div>
                    {pdfError}
                    <button onClick={() => setResumeMode('text')} style={{ display: 'block', marginTop: '6px', fontSize: '11px', color: 'var(--indigo-600)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', fontFamily: 'inherit' }}>
                      Switch to text paste instead
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TEXT PASTE MODE */}
          {resumeMode === 'text' && (
            <div className="form-group">
              <textarea
                id="resume-input"
                className="form-textarea"
                rows={16}
                placeholder={"Paste your full resume here...\n\nInclude:\n• Full name & contact info\n• Education (degree, institution, year)\n• Work experience (company, role, responsibilities, achievements)\n• Technical skills & tools\n• Projects (name, description, tech used, outcome)\n• Certifications"}
                value={resume}
                onChange={e => setResume(e.target.value)}
                disabled={loading}
                style={{ minHeight: '340px' }}
              />
              <div className="form-hint">{resume.length.toLocaleString()} characters · {resume.length < 500 ? '⚠️ Too short — paste full resume for best results' : '✓ Good length'}</div>
            </div>
          )}
        </div>

        {/* ── JOB DESCRIPTION CARD ── */}
        <div className="card">
          <div className="card-header">
            <div className="card-header-icon" style={{ color: 'var(--violet-600)' }}><BriefcaseIcon /></div>
            Job Description
            <span style={{ marginLeft: 'auto', fontSize: '10px', background: 'var(--indigo-50)', color: 'var(--indigo-600)', padding: '3px 8px', borderRadius: '100px', fontWeight: 600, border: '1px solid var(--indigo-200)' }}>
              Text only
            </span>
          </div>
          <div className="form-group">
            <textarea
              id="jd-input"
              className="form-textarea"
              rows={16}
              placeholder={"Paste the full job description here...\n\nInclude everything:\n• Job title & company name\n• Role responsibilities\n• Required skills & technologies\n• Nice-to-have skills\n• Company description & culture\n• Team size & work environment\n\nThe more detail, the more targeted your Q&As will be."}
              value={jd}
              onChange={e => setJd(e.target.value)}
              disabled={loading}
              style={{ minHeight: '340px' }}
            />
            <div className="form-hint">{jd.length.toLocaleString()} characters · {jd.length < 200 ? '⚠️ Add more detail for targeted questions' : '✓ Good'}</div>
          </div>
        </div>
      </div>

      {/* ── EXPERIENCE REQUIRED CARD ── */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header" style={{ marginBottom: '14px' }}>
          <div className="card-header-icon" style={{ color: 'var(--amber)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
              <line x1="8" y1="21" x2="16" y2="21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
          </div>
          Experience Required by Company
          <span style={{ marginLeft: 'auto', fontSize: '10px', background: 'var(--amber-light, #FEF3C7)', color: '#92400E', padding: '3px 10px', borderRadius: '100px', fontWeight: 700, border: '1px solid #FDE68A' }}>
            Adjusts question depth
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-p)', fontWeight: 500, minWidth: '200px' }}>
            How many years of experience does this role require?
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flex: 1 }}>
            {[
              { value: 'auto', label: 'Auto',      sub: 'AI decides' },
              { value: '1',    label: '0 – 1 yr',  sub: 'Junior'    },
              { value: '2',    label: '1 – 2 yrs', sub: 'Junior'    },
              { value: '3',    label: '2 – 3 yrs', sub: 'Mid-level' },
              { value: '4',    label: '3 – 5 yrs', sub: 'Mid-level' },
              { value: '6',    label: '5 – 7 yrs', sub: 'Senior'    },
              { value: '8',    label: '7 – 10 yrs',sub: 'Senior'    },
              { value: '12',   label: '10+ yrs',   sub: 'Staff/Principal' }
            ].map(opt => {
              const active = experienceYears === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => !loading && setExperienceYears(opt.value)}
                  disabled={loading}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '10px',
                    border: active ? '2px solid var(--indigo-600)' : '1.5px solid var(--border)',
                    background: active ? 'var(--indigo-50)' : 'var(--bg-white)',
                    color: active ? 'var(--indigo-700)' : 'var(--text-p)',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: '12px', fontWeight: active ? 700 : 500,
                    textAlign: 'center', transition: 'all 0.15s',
                    boxShadow: active ? '0 0 0 3px rgba(99,102,241,0.15)' : 'none'
                  }}
                >
                  <div>{opt.label}</div>
                  <div style={{ fontSize: '10px', color: active ? 'var(--indigo-500)' : 'var(--text-muted)', marginTop: '2px' }}>{opt.sub}</div>
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
          {experienceYears === 'auto'
            ? '🤖 Auto mode — AI reads the JD and resume to decide question depth automatically'
            : experienceYears <= 2
            ? '⚡ Junior mode — foundational concepts, learning focus, no architecture questions'
            : experienceYears <= 5
            ? '⚡ Mid-level mode — design decisions, trade-offs, production experience'
            : experienceYears <= 8
            ? '⚡ Senior mode — architecture, scale, failure postmortems, leadership'
            : '⚡ Staff/Principal mode — systems thinking, extreme scale, org-wide decisions'
          }
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: '16px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </div>
      )}

      {/* Progress Steps */}
      {loading && (
        <div className="card" style={{ marginBottom: '18px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-label)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '14px' }}>
            Generating your interview prep — please wait...
          </div>
          {STEPS.map((s, idx) => {
            const status = getStepStatus(idx)
            return (
              <div key={s.id} className="step-row">
                <div className={`step-circle ${status}`}>
                  {status === 'done' ? (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                  ) : status === 'active' ? (
                    <div className="spinner" style={{ width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white' }} />
                  ) : idx + 1}
                </div>
                <span className={`step-label ${status}`}>{s.label}</span>
              </div>
            )
          })}
          {qaCount > 0 && (
            <div style={{ marginTop: '12px', padding: '10px 14px', background: '#ECFDF5', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 'var(--r-md)', fontSize: '12px', color: '#065F46', fontWeight: 600 }}>
              ✓ {qaCount} questions generated — building search index...
            </div>
          )}
          <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            This takes 90–180 seconds. The AI reads your entire resume and JD across 6 batches to ensure all 120 questions are complete and accurate.
          </div>
        </div>
      )}

      {/* CTA */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <button
          id="generate-btn"
          className="btn btn-primary btn-lg"
          onClick={handleGenerate}
          disabled={loading || pdfLoading}
        >
          {loading ? (
            <><div className="spinner" style={{ width: '14px', height: '14px', borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} /> Generating 120 Questions...</>
          ) : (
            <><SparkIcon /> Generate Q&amp;A Bank</>
          )}
        </button>
        {!loading && (
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            ~90–180 seconds · 120 personalised questions · Azure GPT-4o
          </span>
        )}
      </div>
    </div>
  )
}
