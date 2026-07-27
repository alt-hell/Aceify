import { useState } from 'react'

function CodeDisplay({ code, language }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="code-block">
      <div className="code-block-header">
        <span className="code-lang">{language?.toUpperCase() || 'CODE'}</span>
        <button className="code-copy-btn" onClick={copy}>
          {copied ? 'Copied!' : 'Copy code'}
        </button>
      </div>
      <pre><code style={{ color: '#E2E8F0', fontFamily: 'var(--font-mono)' }}>{code}</code></pre>
    </div>
  )
}

export default CodeDisplay
