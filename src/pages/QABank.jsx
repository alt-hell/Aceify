import { useState, useEffect } from 'react'
import axios from 'axios'

const CATEGORY_META = {
  'Background':   { color: '#6366F1', dot: '#6366F1', bg: '#EEF2FF' },
  'Technical':    { color: '#0EA5E9', dot: '#0EA5E9', bg: '#F0F9FF' },
  'Project':      { color: '#10B981', dot: '#10B981', bg: '#ECFDF5' },
  'Behavioral':   { color: '#F59E0B', dot: '#F59E0B', bg: '#FFFBEB' },
  'Job-specific': { color: '#8B5CF6', dot: '#8B5CF6', bg: '#F5F3FF' },
  'HR':           { color: '#EF4444', dot: '#EF4444', bg: '#FEF2F2' },
}

const DEFAULT_META = { color: '#94A3B8', dot: '#94A3B8', bg: '#F1F5F9' }

const ChevronIcon = ({ open }) => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points={open ? "18 15 12 9 6 15" : "6 9 12 15 18 9"} />
  </svg>
)

const SearchIcon = () => (
  <svg className="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)

const SaveIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
  </svg>
)

function QAItem({ item, onUpdate }) {
  const [open, setOpen]         = useState(false)
  const [editing, setEditing]   = useState(false)
  const [draft, setDraft]       = useState(item.answer)
  const [saved, setSaved]       = useState(false)

  const meta = CATEGORY_META[item.category] || DEFAULT_META

  function handleSave() {
    onUpdate({ ...item, answer: draft })
    setEditing(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="qa-item">
      <div className="qa-item-header" onClick={() => setOpen(o => !o)}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1 }}>
          <div style={{ marginTop: '2px', flexShrink: 0 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: '22px', height: '22px', borderRadius: '50%',
              background: meta.bg, fontSize: '10px', fontWeight: 700, color: meta.color
            }}>
              {item.id}
            </span>
          </div>
          <span className="qa-question">{item.question}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {saved && <span className="badge badge-emerald">Saved</span>}
          <span className={`qa-chevron ${open ? 'open' : ''}`}>
            <ChevronIcon open={open} />
          </span>
        </div>
      </div>

      {open && (
        <div className="qa-answer-body">
          {editing ? (
            <div>
              <textarea
                className="qa-answer-textarea"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                rows={5}
                autoFocus
              />
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button className="btn btn-primary btn-sm" onClick={handleSave} style={{ gap: '6px' }}>
                  <SaveIcon /> Save Answer
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(false); setDraft(item.answer) }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p style={{ color: 'var(--text-p)', fontSize: '13.5px', lineHeight: '1.85', marginBottom: '12px' }}>
                {item.answer}
              </p>
              <button className="btn btn-secondary btn-xs" onClick={() => setEditing(true)}>
                Edit answer
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function QABank() {
  const [qaArray, setQaArray] = useState([])
  const [filter, setFilter]   = useState('All')
  const [search, setSearch]   = useState('')

  useEffect(() => {
    const raw = localStorage.getItem('qaArray')
    if (raw) setQaArray(JSON.parse(raw))
  }, [])

  function handleUpdate(updated) {
    const next = qaArray.map(q => q.id === updated.id ? updated : q)
    setQaArray(next)
    localStorage.setItem('qaArray', JSON.stringify(next))
  }

  async function handleReEmbed() {
    try {
      await axios.post('http://localhost:3001/embed', { qaArray })
    } catch {}
  }

  const categories = ['All', ...Object.keys(
    qaArray.reduce((acc, q) => { acc[q.category] = true; return acc }, {})
  )]

  const filtered = qaArray.filter(q => {
    const matchCat = filter === 'All' || q.category === filter
    const matchSearch = !search || q.question.toLowerCase().includes(search.toLowerCase()) ||
      q.answer.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const grouped = filtered.reduce((acc, q) => {
    const cat = q.category || 'Other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(q)
    return acc
  }, {})

  if (qaArray.length === 0) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">Q&A Bank</h1>
        </div>
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--indigo-500)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <div className="empty-title">No Q&A Bank Generated</div>
            <div className="empty-desc">
              Complete the Setup step first — paste your resume and job description, then generate your personalized question bank.
            </div>
            <a href="#/" className="btn btn-primary" style={{ marginTop: '8px' }}>
              Go to Setup
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="page-title">Q&A Bank</h1>
          <p className="page-subtitle">
            {qaArray.length} questions generated and indexed · Click any question to expand · Edit answers to personalize them
          </p>
        </div>
        <button id="re-embed-btn" className="btn btn-secondary btn-sm" onClick={handleReEmbed}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          Re-index
        </button>
      </div>

      {/* Hero Banner */}
      <div className="hero-banner" style={{ padding: '18px 24px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div className="hero-banner-title" style={{ fontSize: '15px' }}>
              {qaArray.length} Questions Ready
            </div>
            <div className="hero-banner-sub" style={{ fontSize: '12px', marginTop: '2px' }}>
              Indexed in FAISS vector store · Real-time semantic search · Ready for Live Mode
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {Object.entries(
              qaArray.reduce((acc, q) => { acc[q.category] = (acc[q.category] || 0) + 1; return acc }, {})
            ).map(([cat, count]) => {
              const m = CATEGORY_META[cat] || DEFAULT_META
              return (
                <span key={cat} style={{
                  background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)',
                  fontSize: '11px', fontWeight: 600, padding: '4px 10px',
                  borderRadius: '100px', border: '1px solid rgba(255,255,255,0.15)'
                }}>{count} {cat}</span>
              )
            })}
          </div>
        </div>
      </div>

      {/* Filters + Search */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="search-wrap" style={{ flex: 1, minWidth: '200px', maxWidth: '340px' }}>
          <SearchIcon />
          <input
            className="search-input"
            id="qa-search"
            placeholder="Search questions or answers..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {categories.map(cat => {
            const m = CATEGORY_META[cat] || DEFAULT_META
            const active = filter === cat
            return (
              <button key={cat}
                className="btn btn-xs"
                onClick={() => setFilter(cat)}
                style={{
                  background: active ? m.color : 'var(--bg-white)',
                  color: active ? 'white' : 'var(--text-p)',
                  border: `1px solid ${active ? m.color : 'var(--border)'}`,
                  borderRadius: 'var(--r-full)',
                  fontWeight: active ? 700 : 500
                }}
              >{cat}</button>
            )
          })}
        </div>
      </div>

      {/* Q&A List by Category */}
      {Object.entries(grouped).length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--indigo-500)" strokeWidth="1.8">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </div>
            <div className="empty-title">No results found</div>
            <div className="empty-desc">Try a different search term or category filter.</div>
          </div>
        </div>
      ) : (
        Object.entries(grouped).map(([cat, items]) => {
          const m = CATEGORY_META[cat] || DEFAULT_META
          return (
            <div key={cat} className="category-section">
              <div className="category-header">
                <div className="category-dot" style={{ background: m.dot }} />
                <span className="category-name">{cat}</span>
                <span className="category-count">{items.length}</span>
              </div>
              {items.map(item => (
                <QAItem key={item.id} item={item} onUpdate={handleUpdate} />
              ))}
            </div>
          )
        })
      )}
    </div>
  )
}
