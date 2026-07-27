import CodeDisplay from './CodeDisplay'

export default function AnswerCard({ data }) {
  if (!data) return null

  const isInstant  = !data.fromGroq && !data.isCodingRound
  const isCoding   = data.isCodingRound
  const isLive     = data.fromGroq && !data.isCodingRound

  const accentClass = isCoding ? 'coding' : isInstant ? 'instant' : 'live'
  const confColor   = data.confidence >= 80 ? 'var(--emerald)' : data.confidence >= 60 ? 'var(--amber)' : 'var(--red)'

  return (
    <div className="answer-card" id="answer-card">
      {/* Top accent bar */}
      <div className={`answer-card-accent ${accentClass}`} />

      <div className="answer-card-body">
        {/* Meta Row */}
        <div className="answer-card-meta">
          <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap', alignItems: 'center' }}>
            {isInstant && <span className="badge badge-emerald">Instant Match</span>}
            {isLive    && <span className="badge badge-amber">Live AI Answer</span>}
            {isCoding  && <span className="badge badge-violet">Coding Solution</span>}
            {data.category && <span className="badge badge-gray">{data.category}</span>}
            {data.approach && <span className="badge badge-indigo">{data.approach}</span>}
          </div>
          <span style={{ fontSize: '12px', fontWeight: 700, color: confColor, flexShrink: 0 }}>
            {data.confidence}% {isCoding ? 'accuracy' : 'match'}
          </span>
        </div>

        {/* Confidence bar */}
        <div className="progress-track" style={{ marginBottom: '14px' }}>
          <div
            className={`progress-fill ${isInstant ? 'emerald' : isLive ? 'amber' : ''}`}
            style={{ width: `${data.confidence}%` }}
          />
        </div>

        {/* Complexity (coding only) */}
        {isCoding && (data.timeComplexity || data.spaceComplexity) && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
            {data.timeComplexity && (
              <span className="badge badge-violet">Time: {data.timeComplexity}</span>
            )}
            {data.spaceComplexity && (
              <span className="badge badge-indigo">Space: {data.spaceComplexity}</span>
            )}
          </div>
        )}

        {/* Answer Section */}
        <div style={{
          background: '#FAFBFF',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-md)',
          padding: '13px 15px',
          marginBottom: data.isCode ? '14px' : '0'
        }}>
          <div style={{
            fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.8px', color: 'var(--text-label)', marginBottom: '8px'
          }}>
            {isCoding ? 'What to Say' : 'Suggested Answer'}
          </div>
          <div className="answer-text">{data.answer}</div>
        </div>

        {/* Code block */}
        {data.isCode && data.code && (
          <CodeDisplay code={data.code} language={data.codeLanguage || 'python'} />
        )}

        {/* Low confidence warning */}
        {data.confidence < 60 && !isCoding && (
          <div className="alert alert-warn" style={{ marginTop: '12px', marginBottom: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            Low confidence — review and adapt this answer using your own knowledge
          </div>
        )}
      </div>
    </div>
  )
}
