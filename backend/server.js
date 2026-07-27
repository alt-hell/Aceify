const express = require('express')
const cors    = require('cors')
const path    = require('path')
const fs      = require('fs')
require('dotenv').config({ path: path.join(__dirname, '../.env') })

const generateRoute    = require('./routes/generate')
const embedRoute       = require('./routes/embed')
const searchRoute      = require('./routes/search')
const transcribeRoute  = require('./routes/transcribe')
const groqRoute        = require('./routes/groq')
const codingRoute      = require('./routes/coding')
const parseResumeRoute = require('./routes/parseResume')
const sessionRoute     = require('./routes/session')
const authRoute        = require('./routes/auth')

const app = express()

// Parse as integer — process.env values are always strings.
// Without parseInt: "3001" + 1 = "30011" (string concat, not math).
const PORT = parseInt(process.env.BACKEND_PORT, 10) || 3001

app.use(cors({
  origin: (origin, callback) => {
    // In a local Electron app, origin is usually null (file://) or http://localhost:*
    if (!origin || origin.startsWith('http://localhost')) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true
}))
app.use(express.json({ limit: '50mb' }))

// In packaged .exe, resources/ is read-only.
// USER_DATA_PATH (writable AppData) is set by electron/main.js when app.isPackaged === true.
const BASE_WRITE_PATH = process.env.USER_DATA_PATH || null

// Ensure temp directory exists (for audio uploads)
const tempDir = BASE_WRITE_PATH
  ? path.join(BASE_WRITE_PATH, 'temp')
  : path.join(__dirname, 'temp')
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })

// Ensure vectorStore directory exists
const vsDir = BASE_WRITE_PATH
  ? path.join(BASE_WRITE_PATH, 'vectorStore')
  : path.join(__dirname, 'vectorStore')
if (!fs.existsSync(vsDir)) fs.mkdirSync(vsDir, { recursive: true })

// Routes
app.use('/generate',     generateRoute)     // Resume+JD → Q&A pairs
app.use('/embed',        embedRoute)        // Q&A pairs → BM25 index
app.use('/search',       searchRoute)       // Question text → best answer
app.use('/transcribe',   transcribeRoute)   // Audio → text via Groq Whisper
app.use('/groq',         groqRoute)         // Surprise question → live answer
app.use('/coding',       codingRoute)       // Live coding round
app.use('/parse-resume', parseResumeRoute)  // PDF resume upload → extracted text
app.use('/session',      sessionRoute)      // Conversation thread + candidate profile
app.use('/auth',         authRoute)         // Authentication

// ── Serve frontend static files ──────────────────────────────────────────────
// CRITICAL: The overlay window must load from http://localhost (not file://) so
// that Chromium treats it as a secure context. Without a secure context,
// navigator.mediaDevices and AudioWorklet are both completely blocked.
// express.static serves the built React app so Electron can loadURL('http://localhost:PORT/').
const distPath = path.join(__dirname, '../dist')
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath))
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'running', timestamp: new Date().toISOString() })
})

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err)
  res.status(500).json({ error: 'Internal server error', details: err.message })
})

const { setupSarvamWebSocket } = require('./sarvamWs')

// Start server with proper port conflict handling.
let currentPort = PORT

function startServer(port) {
  // CRITICAL FIX: Bind to 127.0.0.1 to prevent local network exposure
  const server = app.listen(port, '127.0.0.1', () => {
    console.log(`[Backend] Server running on port ${port} (Localhost only)`)
    setupSarvamWebSocket(server)
  })

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`[Backend] Port ${port} busy, trying ${port + 1}`)
      startServer(port + 1)
    } else {
      console.error('[Backend] Server error:', err)
    }
  })
}

startServer(currentPort)

module.exports = app
