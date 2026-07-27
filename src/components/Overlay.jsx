import { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'
import { getApiBase, getWsBase } from '../utils/api'
import { LiveOverlay } from './live-overlay';

const INTERVIEW_CONTEXT_PROMPT = [
  'RAG, retrieval augmented generation, LangChain, LlamaIndex, FAISS, vector database,',
  'agentic AI, agentic systems, multi-agent, LangGraph, AutoGen, CrewAI,',
  'embeddings, semantic search, transformer, BERT, GPT, LLM, fine-tuning, prompt engineering,',
  'REST API, GraphQL, microservices, Docker, Kubernetes, CI/CD,',
  'React, Next.js, Node.js, FastAPI, PostgreSQL, MongoDB, Redis, Pinecone,',
  'TypeScript, Python, SQL, NoSQL, JWT, OAuth, agile, scrum,',
  'What is, How does, Can you explain, Tell me about yourself.',
].join(' ')
// Note: Groq Whisper prompt limit is 896 chars — keep this under 850

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"

// ─── Logo ───────────────────────────────────────────────────────────────────
const LogoMark = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" opacity="0.95"/>
  </svg>
)

// ─── Syntax Highlighter ──────────────────────────────────────────────────────
// Applies VS Code–style token colors to code for easy reading.
// Purely CSS color tokens — no external library needed.
function syntaxHighlight(code, lang = 'python') {
  if (!code) return ''

  // Escape HTML first to prevent XSS
  const escaped = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  const COLORS = {
    keyword:    '#C678DD',  // purple  — def, if, for, return, class
    builtin:    '#56B6C2',  // cyan    — print, len, range, console
    string:     '#98C379',  // green   — "text", 'text', 'template'
    comment:    '#7F848E',  // grey    — # comment, // comment
    number:     '#D19A66',  // orange  — 42, 3.14, 0xFF
    decorator:  '#E5C07B',  // yellow  — @decorator, @Override
    fn:         '#61AFEF',  // blue    — function name on call
    type:       '#E5C07B',  // yellow  — int, str, bool, List
    operator:   '#56B6C2',  // cyan    — =, ==, !=, +, -
  }

  const kw = {
    python:     ['def','class','return','if','elif','else','for','while','import','from','as','in','not','and','or','is','None','True','False','try','except','finally','with','yield','lambda','pass','break','continue','raise','del','global','nonlocal','assert'],
    javascript: ['function','const','let','var','return','if','else','for','while','class','import','export','from','as','new','this','typeof','instanceof','null','undefined','true','false','try','catch','finally','throw','async','await','of','in','break','continue','switch','case','default','do','delete','void'],
    typescript: ['function','const','let','var','return','if','else','for','while','class','interface','type','import','export','from','as','new','this','typeof','instanceof','null','undefined','true','false','try','catch','finally','throw','async','await','of','in','break','continue','enum','abstract','implements','extends','public','private','protected','readonly','static'],
    java:       ['public','private','protected','static','final','class','interface','extends','implements','return','if','else','for','while','new','this','super','null','true','false','try','catch','finally','throw','throws','import','package','void','int','long','double','float','boolean','char','byte','short','abstract','synchronized'],
    cpp:        ['int','long','double','float','char','bool','void','auto','const','static','class','struct','return','if','else','for','while','new','delete','this','nullptr','true','false','try','catch','throw','include','using','namespace','public','private','protected','virtual','override'],
    sql:        ['SELECT','FROM','WHERE','JOIN','INNER','LEFT','RIGHT','OUTER','ON','GROUP','BY','ORDER','HAVING','INSERT','INTO','VALUES','UPDATE','SET','DELETE','CREATE','TABLE','INDEX','DROP','ALTER','ADD','COLUMN','PRIMARY','KEY','FOREIGN','REFERENCES','DISTINCT','AS','AND','OR','NOT','NULL','IS','IN','LIKE','BETWEEN','EXISTS','UNION','LIMIT','OFFSET'],
    go:         ['func','var','const','type','struct','interface','return','if','else','for','range','import','package','nil','true','false','break','continue','switch','case','default','go','chan','select','defer','map','make','new','len','cap','append','copy','delete'],
  }

  const builtins = {
    python: ['print','len','range','enumerate','zip','map','filter','sorted','reversed','list','dict','set','tuple','str','int','float','bool','type','isinstance','hasattr','getattr','setattr','open','max','min','sum','abs','round'],
    javascript: ['console','Math','Array','Object','String','Number','Boolean','JSON','Promise','setTimeout','setInterval','clearTimeout','document','window','fetch','parseInt','parseFloat','isNaN','isFinite'],
    typescript: ['console','Math','Array','Object','String','Number','Boolean','JSON','Promise','setTimeout','parseInt','parseFloat'],
    java: ['System','String','Integer','Double','List','ArrayList','HashMap','Map','Arrays','Collections','Math','Optional','Stream'],
    cpp: ['cout','cin','endl','std','vector','map','set','string','printf','scanf','malloc','free'],
    sql: [],
    go: ['fmt','os','strings','strconv','errors','log','http','json','sync','context','io','bufio','filepath'],
  }

  const keywords = kw[lang] || kw.python
  const builtin  = builtins[lang] || builtins.python

  // Order matters — apply most specific patterns first
  const patterns = [
    // Comments
    { re: /(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/|--[^\n]*)/g, color: COLORS.comment },
    // Multi-line strings (Python)
    { re: /("""[\s\S]*?"""|'''[\s\S]*?''')/g, color: COLORS.string },
    // Strings
    { re: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|'(?:[^`\\]|\\.)*`)/g, color: COLORS.string },
    // Decorators
    { re: /(@\w+)/g, color: COLORS.decorator },
    // Numbers
    { re: /\b(\d+\.?\d*(?:[eE][+-]?\d+)?|0[xX][0-9a-fA-F]+)\b/g, color: COLORS.number },
    // Keywords
    { re: new RegExp(`\\b(${keywords.join(`|`)})\\b', 'g`), color: COLORS.keyword },
    // Builtins
    { re: new RegExp(`\\b(${builtin.join(`|`)})\\b', 'g`), color: COLORS.builtin },
    // Function calls
    { re: /\b([a-zA-Z_]\w*)\s*(?=\()/g, color: COLORS.fn },
  ]

  // Apply each pattern using placeholder substitution to avoid double-coloring
  const tokens = []
  let result = escaped
  let i = 0

  patterns.forEach(({ re, color }) => {
    result = result.replace(re, (match) => {
      const key = `\x00${i}\x00`
      tokens.push(`<span style="color:${color}">${match}</span>`)
      i++
      return key
    })
  })

  // Restore tokens
  tokens.forEach((html, idx) => {
    result = result.replace(`\x00${idx}\x00`, html)
  })

  return result
}

// ─── Smart Answer Formatter ──────────────────────────────────────────────────
// Converts plain-text AI answers into structured bullet points when applicable.
// Rules:
//   • Lines starting with "- ", "• ", "* "  → bullet list item
//   • Lines starting with "1. " "2. " etc.  → numbered list item
//   • Lines ending with ":"                  → section header (bold)
//   • Blank lines                            → paragraph break
//   • Everything else                        → plain text span
// Renders inline text with **bold** support — used for section headers like
// "**Technical Examples & Context**" that Groq includes in answers
function renderInline(text) {
  if (!text) return text
  // Split on both **bold** and `inline code` patterns
  const parts = text.split(/(\*\*.*?\*\*|`[^`]+`)/g)
  if (parts.length === 1) return text
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i} style={{ color: '#E5C07B', fontWeight: 700 }}>{part.slice(2, -2)}</strong>
    if (part.startsWith('`') && part.endsWith('`'))
      return <code key={i} style={{
        background: 'rgba(99,102,241,0.18)',
        color: '#A5F3FC',
        fontFamily: 'monospace',
        fontSize: '0.88em',
        padding: '1px 5px',
        borderRadius: '3px',
        letterSpacing: '0.02em'
      }}>{part.slice(1, -1)}</code>
    return part
  })
}

function SmartAnswer({ text, fontSize = 13 }) {
  if (!text) return null

  const rawLines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const elements = []
  let paraBuffer  = []
  let listBuffer  = []
  let listType    = null
  let inCodeBlock = false
  let codeLang    = ''
  let codeLines   = []

  const flushPara = () => {
    if (!paraBuffer.length) return
    const paraText = paraBuffer.join(' ').trim()
    if (paraText) {
      elements.push(
        <p key={elements.length} style={{
          margin: '0 0 8px 0',
          color: 'rgba(255,255,255,0.92)',
          fontSize, lineHeight: 1.75,
          letterSpacing: '0.01em'
        }}>
          {renderInline(paraText)}
        </p>
      )
    }
    paraBuffer = []
  }

  const flushList = () => {
    if (!listBuffer.length) return
    const Tag = listType === 'ol' ? 'ol' : 'ul'
    elements.push(
      <Tag key={elements.length} style={{
        margin: '0 0 8px 0',
        paddingLeft: '18px',
        color: 'rgba(255,255,255,0.9)',
        fontSize,
        lineHeight: 1.75,
        display: 'flex',
        flexDirection: 'column',
        gap: '3px'
      }}>
        {listBuffer.map((item, i) => (
          <li key={i} style={{ paddingLeft: '2px' }}>
            {item.isHeader
              ? <strong style={{ color: '#E5C07B', fontWeight: 700, fontSize: fontSize + 0.5 }}>{renderInline(item.text)}</strong>
              : renderInline(item.text)
            }
            {item.children?.length > 0 && (
              <ul style={{ paddingLeft: '16px', marginTop: '3px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {item.children.map((child, ci) => (
                  <li key={ci} style={{ color: 'rgba(255,255,255,0.82)', fontSize: fontSize - 0.5 }}>{renderInline(child)}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </Tag>
    )
    listBuffer = []
    listType   = null
  }

  const flushCode = () => {
    if (!codeLines.length) return
    const codeText = codeLines.join('\n')
    elements.push(
      <div key={elements.length} style={{
        margin: '4px 0 10px 0',
        borderRadius: '6px',
        background: 'rgba(0,0,0,0.45)',
        border: '1px solid rgba(99,102,241,0.25)',
        overflow: 'hidden'
      }}>
        {codeLang && (
          <div style={{
            padding: '3px 10px',
            background: 'rgba(99,102,241,0.15)',
            fontSize: 9,
            fontFamily: 'monospace',
            color: 'rgba(165,243,252,0.7)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase'
          }}>{codeLang}</div>
        )}
        <pre style={{
          margin: 0,
          padding: '10px 12px',
          overflowX: 'auto',
          fontSize: fontSize - 1,
          fontFamily: "'Fira Code', 'Cascadia Code', 'Consolas', monospace",
          color: '#ABB2BF',
          lineHeight: 1.6,
          whiteSpace: 'pre'
        }}>{syntaxHighlight(codeText, codeLang || 'python')}</pre>
      </div>
    )
    codeLines = []
    codeLang  = ''
  }

  rawLines.forEach((rawLine) => {
    const line = rawLine.trimEnd()

    // ── code fence open/close ──
    const fenceMatch = line.match(/^\s*```(\w*)\s*$/)
    if (fenceMatch) {
      if (!inCodeBlock) {
        flushPara()
        flushList()
        inCodeBlock = true
        codeLang    = fenceMatch[1] || ''
      } else {
        inCodeBlock = false
        flushCode()
      }
      return
    }
    if (inCodeBlock) {
      codeLines.push(rawLine)
      return
    }

    // ── blank line → paragraph break ──
    if (!line.trim()) {
      flushPara()
      flushList()
      return
    }

    // ── numbered list item: "1. " "2. " etc. ──
    const numberedMatch = line.match(/^\s*(\d+)\.\s+(.+)$/)
    if (numberedMatch) {
      flushPara()
      if (listType !== 'ol') { flushList(); listType = 'ol' }
      listBuffer.push({ text: numberedMatch[2].trim(), isHeader: false })
      return
    }

    // ── bullet list item: "- ", "• ", "* ", "→ " ──
    const bulletMatch = line.match(/^\s*[-•*→]\s+(.+)$/)
    if (bulletMatch) {
      flushPara()
      if (listType !== 'ul') { flushList(); listType = 'ul' }
      listBuffer.push({ text: bulletMatch[1].trim(), isHeader: false })
      return
    }

    // ── indented sub-bullet: "  - " "    • " ──
    const subBulletMatch = line.match(/^\s{2,}[-•*→]\s+(.+)$/)
    if (subBulletMatch && listBuffer.length > 0) {
      const last = listBuffer[listBuffer.length - 1]
      if (!last.children) last.children = []
      last.children.push(subBulletMatch[1].trim())
      return
    }

    // ── section header: line is **Header** alone, or ends with ":" and is short ──
    const boldHeaderMatch = line.trim().match(/^\*\*(.+?)\*\*:?$/)
    if (boldHeaderMatch && line.trim().length < 80) {
      flushPara()
      flushList()
      elements.push(
        <div key={elements.length} style={{
          color: '#E5C07B',
          fontWeight: 700,
          fontSize: fontSize + 0.5,
          marginTop: '8px',
          marginBottom: '3px'
        }}>{boldHeaderMatch[1]}</div>
      )
      return
    }

    if (line.trim().endsWith(':') && line.trim().length < 60 && !line.trim().startsWith('-')) {
      flushPara()
      if (!listType) { listType = 'ul' }
      listBuffer.push({ text: line.trim(), isHeader: true })
      return
    }

    // ── plain text — collect into paragraph ──
    flushList()
    paraBuffer.push(line.trim())
  })

  flushPara()
  flushList()
  flushCode()

  return <div style={{ wordBreak: 'break-word' }}>{elements}</div>
}

// ─── Main Overlay Component ──────────────────────────────────────────────────
export default function Overlay() {
  const [answerData,    setAnswerData]    = useState(null)
  const [flash,         setFlash]         = useState(false)
  const [visible,       setVisible]       = useState(true)
  const [recording,     setRecording]     = useState(false)
  const [processing,    setProcessing]    = useState(false)
  const [threadLen,     setThreadLen]     = useState(0)
  const [hasProfile,    setHasProfile]    = useState(false)
  const [audioMode,     setAudioMode]     = useState('mic')  // 'mic' | 'system'
  const [vadStatus,     setVadStatus]     = useState('off')  // 'off' | 'listening' | 'speaking'
  const [answerHistory, setAnswerHistory] = useState([])     // all final answers this session
  const [historyIndex,  setHistoryIndex]  = useState(-1)     // which answer is currently shown
  const [interimText,   setInterimText]   = useState('')     // live partial transcript (Web Speech API)
  const [micEnergy,     setMicEnergy]     = useState(0)      // live mic energy 0-128 for energy bar
  const [hasFirstAnswer, setHasFirstAnswer] = useState(false)
  const [panelOpen,     setPanelOpen]     = useState(false)  // controls whether the panel is expanded

  const audioStreamRef      = useRef(null)
  const systemStreamRef     = useRef(null)
  const audioChunksRef      = useRef([])
  const recordingTimeoutRef = useRef(null)
  // VAD refs (MEET/system audio mode)
  const audioContextRef     = useRef(null)
  const analyserRef         = useRef(null)
  const vadRecorderRef      = useRef(null)
  const vadChunksRef        = useRef([])
  const vadIntervalRef      = useRef(null)
  const vadStateRef         = useRef({ speaking: false, speechStart: 0, silenceTimer: null })
  // Sarvam WS / Streaming Refs
  const sarvamWsRef         = useRef(null)
  const lastSearchTimeRef   = useRef(0)
  const isProcessingRef     = useRef(false)   // Prevents concurrent audio processing
  const lastQuestionRef     = useRef('')      // de-duplicate: last processed question
  const lastQuestionTimeRef = useRef(0)       // de-duplicate: timestamp
  const answeredPartialRef  = useRef('')      // to skip final if answered early
  const sarvamAccumulatedRef   = useRef('')   // latest Sarvam transcript chunk
  const sarvamSilenceTimerRef  = useRef(null) // debounce timer for silence detection
  const prefetchedSearchRef    = useRef(null) // pre-fetched vector search result (starts on first chunk)
  const prefetchQueryRef       = useRef('')   // which query was pre-fetched

  const lastExpandedSize = useRef({ width: 420, height: 560 })
  const hasFirstAnswerRef   = useRef(false)

  function markFirstAnswerReceived() {
    setHasFirstAnswer(true)
    hasFirstAnswerRef.current = true
  }


  // ── Push a completed answer to history + auto-expand + flash ─────────────────
  // Called only when we have the FINAL answer (streaming done or coding answer).
  // Streaming tokens in-flight do NOT push to history — only the complete answer does.
  function pushToHistory(data) {
    if (!data?.answer || !data?.question) return
    setAnswerHistory(prev => {
      const next = [...prev, data]
      setHistoryIndex(next.length - 1)
      return next
    })
    setPanelOpen(true)  // auto-expand when answer arrives
    setFlash(true)
    markFirstAnswerReceived()
    setTimeout(() => setFlash(false), 900)
  }

  // Listen to window resizing to keep track of user-resized bounds
  useEffect(() => {
    function handleResize() {
      if (visible && panelOpen) {
        lastExpandedSize.current = {
          width: window.innerWidth,
          height: window.innerHeight
        }
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [visible, panelOpen])

  // ── Extract candidate profile on mount ─────────────────────────────────
  // Fire this immediately so Groq has profile context BEFORE any question.
  // Previously this only ran after Path B (Groq) answers, so when questions
  // came from Path A (vector DB direct return), Groq never got the profile.
  useEffect(() => {
    fetch(`${getApiBase()}/session/profile/extract`, { method: 'POST' })
      .then(r => r.json())
      .then(r => { if (r.success) setHasProfile(true) })
      .catch(() => {})
  }, [])

  // Sync window dimensions, min-size bounds, and resizable properties with visual state
  useEffect(() => {
    if (!window.electron) return

    if (!visible) {
      // Minimized pill state
      window.electron.setMinSize?.({ width: 100, height: 64 })
      window.electron.setOverlaySize?.({ width: 230, height: 64 })
      window.electron.setResizable?.(false)
    } else if (!panelOpen) {
      // Collapsed header state
      window.electron.setMinSize?.({ width: 100, height: 64 })
      window.electron.setOverlaySize?.({ width: lastExpandedSize.current.width, height: 64 })
      window.electron.setResizable?.(false)
    } else {
      // Expanded state
      window.electron.setResizable?.(true)
      window.electron.setMinSize?.({ width: 280, height: 160 })
      window.electron.setOverlaySize?.({ width: lastExpandedSize.current.width, height: lastExpandedSize.current.height })
    }
  }, [visible, panelOpen])

  // ── Drag state ──────────────────────────────────────────────────────────────
  // We use a ref (not state) so drag doesn't trigger re-renders on every pixel
  const dragRef = useRef({ active: false, startX: 0, startY: 0, lastX: 0, lastY: 0, moved: false })

  // Global mousemove / mouseup listeners — only active while dragging
  useEffect(() => {
    function onMove(e) {
      if (!dragRef.current.active) return
      const dx = Math.round(e.screenX - dragRef.current.lastX)
      const dy = Math.round(e.screenY - dragRef.current.lastY)
      
      const dist = Math.hypot(e.screenX - dragRef.current.startX, e.screenY - dragRef.current.startY)
      if (dist > 3) {
        dragRef.current.moved = true
      }

      if (dx !== 0 || dy !== 0) {
        dragRef.current.lastX = e.screenX
        dragRef.current.lastY = e.screenY
        if (window.electron?.moveByDelta) {
          window.electron.moveByDelta({ dx, dy })
        }
      }
    }
    function onUp() {
      if (!dragRef.current.active) return
      const wasMoved = dragRef.current.moved
      dragRef.current.active = false
      document.body.style.cursor = 'default'
      
      if (!wasMoved && !visible) {
        setVisible(true)
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }
  }, [visible])

  async function startRecording() {
    // ── MIC mode → getUserMedia + same VAD+Whisper pipeline as MEET mode
    // More reliable in Electron than Web Speech API (no Google API keys needed).
    // Mic physically picks up sound from any speaker in the room — laptop OR external.
    if (audioMode !== 'system') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,  // OFF — we WANT to hear interviewer’s voice from speakers
            noiseSuppression: false,  // OFF — let Whisper handle noise reduction
            autoGainControl:  true,   // ON — normalize quiet mic levels automatically
            channelCount:     1,
            // NOTE: no sampleRate constraint — browser’s native 48kHz creates valid WebM
            // Setting 16000Hz causes non-standard headers that Whisper’s API rejects
          }
        })
        audioStreamRef.current = stream
        console.log('[Overlay] 🎤 Mic stream started:', stream.getAudioTracks()[0].label)
        startSarvamStreaming(stream)
      } catch (err) {
        console.error('[Overlay] Mic capture error:', err)
        if (err.name === 'NotAllowedError') {
          setAnswerData({
            question: 'Microphone access denied',
            answer:   'Please allow microphone access in Windows Settings → Privacy → Microphone, then restart the app.'
          })
          setPanelOpen(true)
        } else {
          alert('Could not access microphone: ' + err.message)
        }
      }
      return
    }

    // ── SYSTEM AUDIO MODE (MEET) ──────────────────────────────────────────────
    // getDisplayMedia + loopback captures Google Meet audio from the OS mixer.
    try {
      let stream

      // Reuse existing stream if still alive — dialog only appears ONCE per session
      if (systemStreamRef.current) {
        const tracks = systemStreamRef.current.getAudioTracks()
        if (tracks.length > 0 && tracks[0].readyState === 'live') {
          stream = systemStreamRef.current
          console.log('[Overlay] 🔊 Reusing existing system audio stream')
        } else {
          systemStreamRef.current = null
        }
      }

      // First time or stream died — request getDisplayMedia
      if (!stream) {
        try {
          const displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl:  false,
              sampleRate:       48000,
            }
          })

          displayStream.getVideoTracks().forEach(t => t.stop())

          const audioTracks = displayStream.getAudioTracks()
          if (audioTracks.length === 0) {
            displayStream.getTracks().forEach(t => t.stop())
            setAnswerData({
              question: 'No system audio captured',
              answer:   'When sharing your screen, make sure to check the "Share system audio" or "Share tab audio" checkbox. Then try again.'
            })
            setPanelOpen(true)
            return
          }

          stream = new MediaStream(audioTracks)
          systemStreamRef.current = stream

          audioTracks[0].addEventListener('ended', () => {
            console.log('[Overlay] System audio track ended — stream released')
            systemStreamRef.current = null
          })

          console.log('[Overlay] 🔊 System audio capture started:', audioTracks[0].label)
        } catch (displayErr) {
          if (displayErr.name === 'NotAllowedError' || displayErr.name === 'AbortError') {
            return  // User cancelled — silent exit
          }
          throw displayErr
        }
      }

      audioStreamRef.current = stream
      startSarvamStreaming(stream)

    } catch (err) {
      console.error('[Overlay] System audio capture error:', err)
      if (err.name !== 'NotAllowedError' && err.name !== 'AbortError') {
        alert('Could not capture system audio: ' + err.message)
      }
    }
  }

  function stopRecording() {
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current)
      recordingTimeoutRef.current = null
    }
    stopSarvamStreaming()
    if (audioMode !== 'system' && audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(t => t.stop())
      audioStreamRef.current = null
    }
    setRecording(false)
  }

  // Called when user switches from MEET → MIC mode, or component unmounts
  function releaseMeetStream() {
    stopSarvamStreaming()
    if (systemStreamRef.current) {
      systemStreamRef.current.getTracks().forEach(t => t.stop())
      systemStreamRef.current = null
      console.log('[Overlay] System audio stream released')
    }
  }

  // ── shouldProcessAsQuestion ─────────────────────────────────────────────────
  function shouldProcessAsQuestion(text) {
    const t     = text.trim()
    const words = t.split(/\s+/)

    // No minimum word count — interviewer's choice how long the question is

    const now = Date.now()
    if (t.toLowerCase() === lastQuestionRef.current.toLowerCase() &&
        now - lastQuestionTimeRef.current < 8000) {
      console.log('[STT] Skipping (duplicate):', t.substring(0, 60))
      return false
    }

    const QUESTION_PATTERNS = [
      /\?/,
      /^(what|how|why|when|where|who|which)\b/i,
      /^(tell me|explain|describe|walk me|walk us|can you|could you|would you|do you|have you|are you|is there|what's|whats)\b/i,
      /\b(introduce yourself|tell me about yourself|walk me through your|talk me through)\b/i,
      /\b(difference between|compare|define|example of|talk about|discuss|elaborate)\b/i,
      /\b(what is|what are|how does|how do|how would|how can|why is|why do|why does|when do|where do)\b/i,
    ]
    const isQuestion = QUESTION_PATTERNS.some(p => p.test(t))
    const isLong = words.length >= 15

    if (!isQuestion && !isLong) {
      console.log('[STT] Not a question — skipping:', t.substring(0, 60))
      return false
    }

    lastQuestionRef.current     = t
    lastQuestionTimeRef.current = now
    console.log('[STT] ✅ Question detected:', t)
    return true
  }

  // ── Sarvam Streaming — Real-time AudioWorklet + WebSocket ──────────────
  async function startSarvamStreaming(stream) {
    try {
      const ctx = new AudioContext({ sampleRate: 16000 })

      // ── CRITICAL FIX: audio-processor.js is inside the ASAR archive in the
      // packaged .exe. Browser-native AudioWorklet fetch cannot read ASAR files,
      // so addModule('./audio-processor.js') silently throws and setRecording(true)
      // is never reached. Fix: inline the processor code as a Blob URL — this
      // bypasses the file system entirely and works in both dev and packaged app.
      const AUDIO_PROCESSOR_CODE = `
class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.buffer = new Float32Array(2048)
    this.bufferIndex = 0
  }
  process(inputs, outputs, parameters) {
    const input = inputs[0]
    if (input.length > 0) {
      const channelData = input[0]
      for (let i = 0; i < channelData.length; i++) {
        this.buffer[this.bufferIndex++] = channelData[i]
        if (this.bufferIndex >= this.buffer.length) {
          this.port.postMessage(this.buffer.slice(0))
          this.bufferIndex = 0
        }
      }
    }
    return true
  }
}
registerProcessor('audio-processor', AudioProcessor)
`
      const blob = new Blob([AUDIO_PROCESSOR_CODE], { type: 'application/javascript' })
      const blobUrl = URL.createObjectURL(blob)
      await ctx.audioWorklet.addModule(blobUrl)
      URL.revokeObjectURL(blobUrl)
      const source = ctx.createMediaStreamSource(stream)
      
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.6
      source.connect(analyser)
      
      audioContextRef.current = ctx
      analyserRef.current = analyser

      const workletNode = new AudioWorkletNode(ctx, 'audio-processor')
      source.connect(workletNode)
      workletNode.connect(ctx.destination) // Required in some browsers to keep worklet alive

      const ws = new WebSocket(`${getWsBase()}/stt-stream`)
      sarvamWsRef.current = ws

      ws.onopen = () => {
        console.log('[Overlay] ⚡ Connected to Sarvam STT WebSocket proxy')
      }

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data)
          
          if (data.type === 'server_ready') {
             workletNode.port.onmessage = (e) => {
               if (ws.readyState === WebSocket.OPEN) {
                 const float32Array = e.data
                 const int16Array = new Int16Array(float32Array.length)
                 for (let i = 0; i < float32Array.length; i++) {
                   let s = Math.max(-1, Math.min(1, float32Array[i]))
                   int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
                 }
                 ws.send(int16Array.buffer)
               }
             }
          }
          // ── Sarvam sends type:"data" for every processed audio chunk.
          // There is NO is_final flag. Each response contains the transcript
          // of what was said so far. We accumulate and use a silence timer
          // to detect when the interviewer finishes speaking.
          else if (data.type === 'data' && data.data && data.data.transcript) {
             const text = (data.data.transcript || '').trim()
             if (!text) return

             // Show live text on overlay immediately
             setInterimText('⚡ ' + text)
             console.log('[Sarvam] Transcript chunk:', text)

             // Accumulate — keep the longest/latest transcript
             if (text.length > (sarvamAccumulatedRef.current || '').length) {
               sarvamAccumulatedRef.current = text
             }

             // ── PRE-FETCH: start vector search immediately on first chunk ────
             // The interviewer is still speaking. By starting search now,
             // when the silence timer fires the answer is already ready.
             const currentAccumulated = sarvamAccumulatedRef.current
             if (currentAccumulated !== prefetchQueryRef.current && currentAccumulated.length > 3) {
               prefetchQueryRef.current = currentAccumulated
               prefetchedSearchRef.current = null  // Reset old result
               axios.post(`${getApiBase()}/search`, { question: currentAccumulated })
                 .then(r => { prefetchedSearchRef.current = r })
                 .catch(() => {})
             }

             // Clear existing silence timer and restart it
             if (sarvamSilenceTimerRef.current) {
               clearTimeout(sarvamSilenceTimerRef.current)
             }

             // 1000ms silence = interviewer finished speaking
             // Pre-fetch runs in parallel so answer is ready instantly when timer fires
             sarvamSilenceTimerRef.current = setTimeout(() => {
               const finalQuestion = (sarvamAccumulatedRef.current || '').trim()
               sarvamAccumulatedRef.current = ''
               sarvamSilenceTimerRef.current = null
               setInterimText('')

               if (finalQuestion.length > 1 && !isProcessingRef.current) {
                 // Deduplicate only
                 const now = Date.now()
                 const isDup = finalQuestion.toLowerCase() === lastQuestionRef.current.toLowerCase()
                               && now - lastQuestionTimeRef.current < 8000
                 if (!isDup) {
                   lastQuestionRef.current = finalQuestion
                   lastQuestionTimeRef.current = now
                   console.log('[Overlay] 🔒 Final question:', finalQuestion)
                   processText(finalQuestion)
                 }
               }
             }, 1000)
          }
          // Fallback for transcript_partial/transcript_final if Sarvam adds them
          else if (data.type === 'transcript_partial') {
             const text = data.transcript || ''
             setInterimText('⚡ ' + text)
             sarvamAccumulatedRef.current = text
          } 
          else if (data.type === 'transcript_final') {
             const finalQuestion = (data.transcript || '').trim()
             setInterimText('') 
             sarvamAccumulatedRef.current = ''
             if (sarvamSilenceTimerRef.current) clearTimeout(sarvamSilenceTimerRef.current)
             if (finalQuestion.length > 3 && !isProcessingRef.current) {
               processText(finalQuestion)
             }
          }
        } catch (err) {
          console.error('[WS] Parse error:', err)
        }
      }

      // ── ws.onclose: Sarvam closed connection from server side ─────────────
      // When Sarvam closes the WS (e.g. after silence timeout on their end),
      // process any accumulated text immediately — don't lose the question.
      ws.onclose = () => {
        console.log('[Overlay] Sarvam WS closed — checking for pending question')
        const pending = (sarvamAccumulatedRef.current || '').trim()
        if (pending.length > 2 && !isProcessingRef.current) {
          sarvamAccumulatedRef.current = ''
          if (sarvamSilenceTimerRef.current) {
            clearTimeout(sarvamSilenceTimerRef.current)
            sarvamSilenceTimerRef.current = null
          }
          setInterimText('')
          if (shouldProcessAsQuestion(pending)) {
            console.log('[Overlay] 🔒 Processing on WS close:', pending)
            processText(pending)
          }
        }
      }

      ws.onerror = (err) => {
        console.error('[Overlay] Sarvam WS error:', err)
      }

      // Keep the UI energy bar running
      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      vadIntervalRef.current = setInterval(() => {
        if (!analyserRef.current) return
        analyserRef.current.getByteFrequencyData(dataArray)
        const bands = dataArray.slice(0, 40)
        const energy = bands.reduce((a, b) => a + b, 0) / bands.length
        setMicEnergy(Math.round(energy))
      }, 50)

      setVadStatus('listening')
      setRecording(true)
      console.log('[Overlay] 🎙 Sarvam streaming started')
    } catch (err) {
      console.error('[Overlay] Streaming start error:', err)
    }
  }

  function stopSarvamStreaming() {
    clearInterval(vadIntervalRef.current)
    vadIntervalRef.current = null

    // ── CRITICAL: process any pending question BEFORE clearing everything ──
    // If the user stops recording manually while a question was accumulating,
    // we must fire processText now — otherwise the question is lost forever.
    const pendingOnStop = (sarvamAccumulatedRef.current || '').trim()
    if (pendingOnStop.length > 2 && !isProcessingRef.current) {
      if (sarvamSilenceTimerRef.current) {
        clearTimeout(sarvamSilenceTimerRef.current)
        sarvamSilenceTimerRef.current = null
      }
      sarvamAccumulatedRef.current = ''
      setInterimText('')
      if (shouldProcessAsQuestion(pendingOnStop)) {
        console.log('[Overlay] 🔒 Processing on stop:', pendingOnStop)
        processText(pendingOnStop)
      }
    } else {
      // Nothing to process — just clear normally
      if (sarvamSilenceTimerRef.current) {
        clearTimeout(sarvamSilenceTimerRef.current)
        sarvamSilenceTimerRef.current = null
      }
      sarvamAccumulatedRef.current = ''
    }

    if (sarvamWsRef.current) {
      sarvamWsRef.current.close()
      sarvamWsRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }
    analyserRef.current = null
    setMicEnergy(0)
    setVadStatus('off')
    setRecording(false)
    setInterimText('')
    console.log('[Overlay] Sarvam streaming stopped')
  }

  // ── processText ─────────────────────────────────────────────────────────────
  // SPEED ARCHITECTURE:
  //   Path A (< 200ms): Vector DB match found → return stored answer instantly, NO LLM
  //   Path B (5-10s):   No DB match → call GPT-4o for fresh answer
  //
  // The pre-fetch mechanism starts vector search when Sarvam sends the first
  // transcript chunk. By the time the silence timer fires (1000ms later),
  // the search result is already cached → total latency ≈ 1000ms + 10ms.
  async function processText(text) {
    if (isProcessingRef.current) {
      console.log('[processText] Skipping — already processing')
      return
    }
    isProcessingRef.current = true
    setProcessing(true)
    setAnswerData(null)
    setVisible(true)
    setInterimText('')

    try {
      console.log('[Overlay] Processing question:', text)

      // Show detected question instantly — user sees it in < 100ms
      setAnswerData({ question: text, answer: '◍', confidence: null, category: 'Searching knowledge base...' })
      setPanelOpen(true)
      markFirstAnswerReceived()
      setProcessing(false)

      // ── PATH A: use pre-fetched search result if available ─────────────────
      // The prefetch ran in parallel while interviewer was still speaking.
      // If the cached query matches what we just finalized → use it instantly.
      const hasPrefetch = prefetchedSearchRef.current &&
                          prefetchQueryRef.current.toLowerCase().includes(text.toLowerCase().slice(0, 20))

      const searchPromise = hasPrefetch
        ? Promise.resolve(prefetchedSearchRef.current)
        : axios.post(`${getApiBase()}/search`, { question: text }).catch(() => ({ data: { data: {} } }))

      // Run coding detect + search in parallel
      const [detectResult, searchResult] = await Promise.all([
        axios.post(`${getApiBase()}/coding/detect`, { text }),
        searchPromise
      ])

      // Clear pre-fetch cache
      prefetchedSearchRef.current = null
      prefetchQueryRef.current = ''

      const detect = detectResult.data
      if (detect.isCoding) {
        const { data: res } = await axios.post(`${getApiBase()}/coding`, { question: text })
        const codingAnswer = {
          ...res.data,
          detectedQuestion: text,
          code: res.data.code ? { content: res.data.code, lang: res.data.codeLanguage || 'python' } : undefined,
        }
        setAnswerData(codingAnswer)
        pushToHistory(codingAnswer)
        return
      }

      const result = searchResult?.data?.data || {}
      const storedAnswer = (result.contextAnswer || '').trim()
      const hasKnowledge = storedAnswer.length > 30

      // ── PATH A: Vector DB match → INSTANT answer, ZERO LLM calls ──────────
      // Any match returns immediately — sub-1.3 second path.
      if (hasKnowledge) {
        console.log(`[Overlay] ⚡ INSTANT answer from vector DB (${result.confidence || '?'}% match)`)
        const directAnswer = {
          question:      result.contextQuestion || text,
          askedQuestion: text,
          answer:        storedAnswer,
          confidence:    result.confidence || 85,
          category:      result.matchedCategory || 'Knowledge Base',
          adapted:       false,
          isCode:        false,
          fromVectorDB:  true,
        }
        setAnswerData(directAnswer)
        pushToHistory(directAnswer)
        // Record to thread so Groq knows about this answer for follow-ups
        try {
          axios.post(`${getApiBase()}/session/thread/add`, {
            question: text,
            answer:   storedAnswer.slice(0, 400)
          }).catch(() => {})
        } catch {}
        return
      }

      // ── PATH B: No DB match → call GPT-4o for fresh answer ────────────────
      // Only reaches here if the question is NOT in the Q&A bank at all.
      console.log('[Overlay] No KB match — calling GPT-4o for fresh answer')
      setAnswerData(prev => ({
        ...prev,
        answer:     '',
        category:   'Generating live answer...',
        confidence: 60,
      }))

      const groqResponse = await fetch(`${getApiBase()}/groq`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          question:        text,
          contextAnswer:   '',
          contextQuestion: '',
          matchedCategory: '',
          stream:          true
        })
      })

      const reader  = groqResponse.body.getReader()
      const decoder = new TextDecoder()
      let buffer    = ''
      let streaming = true

      while (streaming) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop()
        for (const part of parts) {
          const dataLine = part.split('\n').find(l => l.startsWith('data:'))
          if (!dataLine) continue
          const payload = JSON.parse(dataLine.replace('data:', '').trim())
          if (payload.error) throw new Error(payload.error)
          if (payload.done && payload.data) {
            const finalAnswer = { ...payload.data, detectedQuestion: text }
            setAnswerData(finalAnswer)
            pushToHistory(finalAnswer)
            if (payload.data.threadLength !== undefined) setThreadLen(payload.data.threadLength)
            if (!hasProfile) {
              fetch(`${getApiBase()}/session/profile/extract`, { method: 'POST' })
                .then(r => r.json()).then(r => { if (r.success) setHasProfile(true) }).catch(() => {})
            }
            streaming = false
          } else if (payload.token) {
            setAnswerData(prev => ({ ...prev, answer: (prev?.answer || '') + payload.token }))
          }
        }
      }
    } catch (err) {
      console.error('[Overlay] processText error:', err)
      setAnswerData({
        question: 'Error processing question',
        answer:   `${err.message || 'Unknown error'}. Check the backend is running on port 3001.`
      })
    } finally {
      setProcessing(false)
      isProcessingRef.current = false
    }
  }

  async function processAudio(blob, ext) {
    // MEET mode only: transcribe the audio blob via Whisper, then hand off to processText.
    // MIC mode bypasses this entirely — Web Speech API sends text directly to processText.
    if (isProcessingRef.current) return
    isProcessingRef.current = true
    setProcessing(true)
    setAnswerData(null)
    setVisible(true)
    try {
      console.log('[Overlay] Transcribing audio blob:', blob.size, 'bytes')
      const form = new FormData()
      form.append('audio', blob, `overlay_chunk.${ext}`)

      const transcribeResponse = await fetch(`${getApiBase()}/transcribe`, {
        method: 'POST',
        body:   form
      })
      if (!transcribeResponse.ok) {
        let msg = 'Transcription failed'
        try { const e = await transcribeResponse.json(); msg = e.error || e.details || msg } catch {}
        throw new Error(msg)
      }
      const transcribeRes = await transcribeResponse.json()
      const text = transcribeRes.text?.trim()
      if (!text) {
        setAnswerData({ question: 'No speech detected', answer: 'Please try speaking clearly.' })
        return
      }
      console.log('[Overlay] Transcription:', text)

      // MIC mode: mic captures BOTH the interviewer (questions) AND the candidate (answers).
      // Filter out the candidate's own spoken responses — only process interviewer questions.
      // MEET mode skips this: system audio is mostly the interviewer's voice from the call.
      if (audioMode !== 'system' && !shouldProcessAsQuestion(text)) {
        console.log('[processAudio] MIC: not a question, skipping:', text.substring(0, 60))
        isProcessingRef.current = false
        setProcessing(false)
        return
      }

      // Release lock — processText will acquire it
      isProcessingRef.current = false
      setProcessing(false)
      processText(text)   // hand off — not awaited intentionally

    } catch (err) {
      console.error('[Overlay] processAudio error:', err)
      setAnswerData({
        question: 'Transcription error',
        answer:   `${err.message || 'Unknown error'}. Check the backend is running on port 3001.`
      })
    } finally {
      setProcessing(false)
      isProcessingRef.current = false
    }
  }

  // Called when user presses mouse button on the drag handle
  function startDrag(e) {
    // Only left-click drag
    if (e.button !== 0) return
    dragRef.current = {
      active: true,
      startX: e.screenX,
      startY: e.screenY,
      lastX: e.screenX,
      lastY: e.screenY,
      moved: false
    }
    document.body.style.cursor = `default`
    e.preventDefault()
  }

  // Transparent body
  useEffect(() => {
    document.body.style.background    = 'transparent'
    document.body.style.overflow      = 'hidden'
    document.body.style.margin        = '0'
    document.body.style.padding       = '0'
    document.documentElement.style.background = 'transparent'
  }, [])

  // Receive answers + keyboard shortcut
  useEffect(() => {
    if (window.electron) {
      window.electron.onDisplayAnswer((data) => {
        setAnswerData(data)
        setPanelOpen(true)       // Auto-expand when new answer arrives
        setFlash(true)
        markFirstAnswerReceived()
        setTimeout(() => setFlash(false), 800)
      })
      
      if (window.electron.onToggleVisibilityGlobal) {
        window.electron.onToggleVisibilityGlobal(() => {
          setVisible(v => !v)
        })
      }
    }
    const onKey = (e) => {
      if (e.ctrlKey && e.key === 'h') {
        if (hasFirstAnswerRef.current) return
        e.preventDefault()
        setVisible(v => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      if (window.electron) {
        window.electron.removeAnswerListener?.()
        if (window.electron.removeToggleVisibilityGlobalListener) {
          window.electron.removeToggleVisibilityGlobalListener()
        }
      }
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  const confColor = (c) => c >= 80 ? '#34D399' : c >= 60 ? '#FBBF24' : '#F87171'

  const scriptArray = [...answerHistory]
  if (answerData && answerData !== answerHistory[answerHistory.length - 1]) {
    scriptArray.push(answerData)
  }

  return (
    <div style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none', transition: 'opacity 0.2s' }}>
      <LiveOverlay 
        script={scriptArray}
        open={panelOpen}
        onOpenChange={setPanelOpen}
        recording={recording}
        onToggleRecording={() => recording ? stopRecording() : startRecording()}
        elapsed={0}
        typingQuestion={processing}
        interimText={interimText}
        audioMode={audioMode}
        onToggleAudioMode={() => setAudioMode(m => m === 'mic' ? 'system' : 'mic')}
      />
    </div>
  )
}