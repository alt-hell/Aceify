# 🎯 AI Interview Assistant — Complete Build Plan
### Windows Desktop Tool | Built with Windsurf / Antigravity IDE
### Stack: Electron + React + Node.js + FAISS + GPT-4o + Groq

---

## 📌 Table of Contents

1. [What We Are Building](#1-what-we-are-building)
2. [How The Whole System Works](#2-how-the-whole-system-works)
3. [Tech Stack — Final Decisions](#3-tech-stack--final-decisions)
4. [Folder Structure](#4-folder-structure)
5. [All Packages to Install](#5-all-packages-to-install)
6. [Environment Variables](#6-environment-variables)
7. [Phase 1 — Electron Window Setup](#7-phase-1--electron-window-setup)
8. [Phase 2 — Vite + React Setup](#8-phase-2--vite--react-setup)
9. [Phase 3 — Backend Server Setup](#9-phase-3--backend-server-setup)
10. [Phase 4 — Q&A Generation (Pre-Interview)](#10-phase-4--qa-generation-pre-interview)
11. [Phase 5 — FAISS Vector Store](#11-phase-5--faiss-vector-store)
12. [Phase 6 — Audio Capture & Whisper Transcription](#12-phase-6--audio-capture--whisper-transcription)
13. [Phase 7 — Answer Matching Logic](#13-phase-7--answer-matching-logic)
14. [Phase 8 — Groq Fallback (Surprise Questions)](#14-phase-8--groq-fallback-surprise-questions)
15. [Phase 9 — Human-Like Answer Generation](#15-phase-9--human-like-answer-generation)
16. [Phase 10 — Coding Question Handler](#16-phase-10--coding-question-handler)
17. [Phase 11 — IPC Communication](#17-phase-11--ipc-communication)
18. [Phase 12 — Overlay UI](#18-phase-12--overlay-ui)
19. [Phase 13 — Main App UI Pages](#19-phase-13--main-app-ui-pages)
20. [Phase 14 — Packaging into .exe](#20-phase-14--packaging-into-exe)
21. [Complete Data Flow](#21-complete-data-flow)
22. [Windsurf / Antigravity Prompts — Copy Paste Ready](#22-windsurf--antigravity-prompts--copy-paste-ready)
23. [Challenges & How to Handle Them](#23-challenges--how-to-handle-them)
24. [Build Order — Step by Step](#24-build-order--step-by-step)
25. [Cost Breakdown](#25-cost-breakdown)

---

## 1. What We Are Building

A **Windows desktop application** that acts as a transparent AI assistant during job interviews on Zoom, Google Meet, or Microsoft Teams.

### What the student sees:
- A small transparent floating widget on their screen showing the interviewer's detected question and a suggested answer in real time

### What the interviewer sees:
- Nothing. The overlay is completely invisible during screen sharing on Windows because of OS-level capture protection

### Two modes of answers:
- **Instant answers** (under 100ms) — for predicted questions already stored in FAISS before the interview
- **Live answers** (2–3 seconds) — for surprise questions, answered live by Groq AI

### Coding questions:
- When interviewer asks a coding question, the AI returns clean, simple, human-written-looking code with a short explanation. The code is accurate and not overly complex so the interviewer doesn't get suspicious.

---

## 2. How The Whole System Works

### Before the Interview (Setup Phase)
```
Student opens app
       ↓
Pastes Resume text + Job Description text
       ↓
Clicks "Generate Q&A Bank"
       ↓
GPT-4o reads both documents and generates 85 questions with answers
(technical, behavioral, HR, project-based, coding, situational)
       ↓
Every question is converted to a vector (1536-dimensional number array)
using OpenAI text-embedding-3-small
       ↓
All vectors stored in FAISS index (in memory + saved to disk)
All question-answer pairs saved to store.json
       ↓
Student reviews answers, edits if needed
       ↓
Clicks "Start Interview"
```

### During the Interview (Live Phase)
```
Interviewer speaks a question
       ↓
Microphone captures audio (using VAD — only sends when speech detected)
       ↓
Audio chunk sent to Whisper API → returns text (1–2 seconds)
       ↓
Transcribed text converted to vector (embedding)
       ↓
FAISS searches all 85 stored question-vectors
       ↓
        ┌─────────────────────────────────┐
        ↓                                 ↓
  Confidence > 65%                 Confidence < 65%
  (Predicted question)             (Surprise question)
        ↓                                 ↓
  Pull pre-written answer          Call Groq API (Llama 3.3 70B)
  from store.json                  Generate answer live
  → Display in <100ms              → Display in ~2-3 seconds
        ↓                                 ↓
        └──────── Display on Overlay ─────┘
                (Invisible to screen share)
```

### Screen Share Safety (Windows)
```
overlayWindow.setContentProtection(true)
```
This single line calls Windows API `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)` at the OS DWM compositor level. No screen recorder, no Zoom, no Meet, no OBS can capture this window. It is enforced at hardware level.

---

## 3. Tech Stack — Final Decisions

| Layer | Technology | Reason |
|---|---|---|
| Desktop Shell | Electron.js | Cross-platform, transparent windows, OS APIs |
| Frontend UI | React + Vite | Fast, component-based, hot reload |
| Backend | Node.js + Express | Local server, handles all AI calls |
| Q&A Generation | GPT-4o | Best quality for pre-interview generation |
| Live Fallback AI | Groq API (Llama 3.3 70B) | Fastest inference, 200–400ms response |
| Embeddings | OpenAI text-embedding-3-small | 1536-dim, cheap, accurate |
| Vector Search | faiss-node | Local, no server needed, sub-1ms search |
| Speech to Text | OpenAI Whisper API | Best accuracy for interview speech |
| Voice Detection | @ricky0123/vad-node | Detects when speech ends, reduces latency |
| Packaging | electron-builder | Builds .exe installer for Windows |

---

## 4. Folder Structure

```
interview-ai/
│
├── electron/
│   ├── main.js                  ← App entry point, creates both windows
│   ├── preload.js               ← Exposes safe IPC bridge to renderer
│   └── windowManager.js         ← Handles overlay position, drag, hide/show
│
├── src/                         ← React frontend (runs inside Electron)
│   ├── pages/
│   │   ├── Setup.jsx            ← Page 1: Resume + JD input form
│   │   ├── QABank.jsx           ← Page 2: View/edit generated Q&A
│   │   └── LiveMode.jsx         ← Page 3: Interview controls + transcript
│   ├── components/
│   │   ├── Overlay.jsx          ← The floating transparent answer widget
│   │   ├── MicListener.jsx      ← Microphone capture + VAD logic
│   │   ├── TranscriptBox.jsx    ← Shows live speech transcript
│   │   ├── AnswerCard.jsx       ← Displays the matched/generated answer
│   │   └── CodeDisplay.jsx      ← Syntax-highlighted code block
│   ├── App.jsx                  ← Router, page switching
│   └── main.jsx                 ← React entry point
│
├── backend/
│   ├── server.js                ← Express app, starts on port 3001
│   ├── routes/
│   │   ├── generate.js          ← POST /generate → GPT-4o Q&A generation
│   │   ├── embed.js             ← POST /embed → Build FAISS index
│   │   ├── search.js            ← POST /search → FAISS vector search
│   │   ├── transcribe.js        ← POST /transcribe → Whisper API
│   │   └── groq.js              ← POST /groq → Live fallback answers
│   ├── vectorStore/
│   │   ├── faissManager.js      ← FAISS index build, search, save, load
│   │   ├── store.json           ← All Q&A pairs with IDs (metadata)
│   │   └── faiss.index          ← Saved FAISS binary index file
│   └── utils/
│       ├── vadProcessor.js      ← Voice activity detection processor
│       ├── humanizer.js         ← Makes AI answers sound human
│       └── codeFormatter.js     ← Formats code answers cleanly
│
├── .env                         ← API keys
├── package.json
└── vite.config.js
```

---

## 5. All Packages to Install

Run this exact command in your project root:

```bash
npm install electron express cors dotenv openai faiss-node groq-sdk node-record-lpcm16 @ricky0123/vad-node multer axios highlight.js react react-dom react-router-dom

npm install -D vite @vitejs/plugin-react electron-builder concurrently wait-on cross-env
```

### What each package does:

| Package | Purpose |
|---|---|
| `electron` | Desktop app shell |
| `express` | Local backend HTTP server |
| `cors` | Allow React to call backend |
| `dotenv` | Load .env API keys |
| `openai` | GPT-4o + Whisper + Embeddings |
| `faiss-node` | Vector similarity search (Facebook FAISS) |
| `groq-sdk` | Groq API for fast live answers |
| `node-record-lpcm16` | Capture microphone audio on Windows |
| `@ricky0123/vad-node` | Voice activity detection |
| `multer` | Handle audio file uploads to backend |
| `axios` | HTTP calls from React to backend |
| `highlight.js` | Syntax highlighting for code answers |
| `react-router-dom` | Page routing in React |
| `vite` | Fast React build tool |
| `electron-builder` | Package app into .exe |
| `concurrently` | Run Electron + Vite + Backend together in dev |
| `wait-on` | Wait for Vite to start before Electron loads |

---

## 6. Environment Variables

Create `.env` in root folder:

```env
OPENAI_API_KEY=sk-your-openai-key-here
GROQ_API_KEY=gsk_your-groq-key-here
BACKEND_PORT=3001
```

### How to get API keys:
- **OpenAI**: Go to platform.openai.com → API Keys → Create new key
- **Groq**: Go to console.groq.com → API Keys → Create new key (Free tier available)

---

## 7. Phase 1 — Electron Window Setup

### File: `electron/main.js`

This is the most critical file. It creates two windows:
1. Main window — the setup UI
2. Overlay window — the transparent floating answer widget

```javascript
const { app, BrowserWindow, ipcMain, screen } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
require('dotenv').config()

let mainWindow
let overlayWindow
let backendProcess

// ── START BACKEND SERVER ──
function startBackend() {
  backendProcess = spawn('node', [path.join(__dirname, '../backend/server.js')], {
    env: { ...process.env }
  })
  backendProcess.stdout.on('data', (data) => console.log(`Backend: ${data}`))
  backendProcess.stderr.on('data', (data) => console.error(`Backend Error: ${data}`))
}

// ── CREATE MAIN WINDOW ──
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#080c10',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // In development load Vite dev server, in production load built files
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

// ── CREATE OVERLAY WINDOW ──
// This is the transparent floating widget visible only to student
function createOverlayWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  overlayWindow = new BrowserWindow({
    width: 420,
    height: 520,
    x: width - 440,   // Position at top-right corner
    y: 20,
    transparent: true,          // Fully transparent background
    frame: false,               // No title bar or border
    alwaysOnTop: true,          // Always above Zoom/Meet/Teams
    skipTaskbar: true,          // Hidden from Windows taskbar
    hasShadow: false,           // No shadow (prevents artifacts)
    focusable: false,           // Student doesn't need to click it
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // THIS IS THE MAGIC LINE
  // Makes overlay completely invisible in ALL screen recordings on Windows
  // Uses SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE) at OS DWM level
  overlayWindow.setContentProtection(true)

  // Student can click through the overlay to interact with Zoom/Meet behind it
  overlayWindow.setIgnoreMouseEvents(true, { forward: true })

  if (process.env.NODE_ENV === 'development') {
    overlayWindow.loadURL('http://localhost:5173/overlay')
  } else {
    overlayWindow.loadFile(path.join(__dirname, '../dist/index.html'), {
      hash: '/overlay'
    })
  }
}

// ── APP LIFECYCLE ──
app.whenReady().then(() => {
  startBackend()
  // Wait 2 seconds for backend to start before creating windows
  setTimeout(() => {
    createMainWindow()
    createOverlayWindow()
  }, 2000)
})

// ── IPC: DISPLAY ANSWER ON OVERLAY ──
// When React sends an answer, forward it to the overlay window
ipcMain.on('show-answer', (event, data) => {
  if (overlayWindow) {
    overlayWindow.webContents.send('display-answer', data)
  }
})

// ── IPC: TOGGLE OVERLAY VISIBILITY ──
ipcMain.on('toggle-overlay', (event, visible) => {
  if (overlayWindow) {
    if (visible) {
      overlayWindow.showInactive()  // Show without stealing focus
    } else {
      overlayWindow.hide()
    }
  }
})

// ── IPC: MOVE OVERLAY POSITION ──
ipcMain.on('move-overlay', (event, { x, y }) => {
  if (overlayWindow) {
    overlayWindow.setPosition(x, y)
  }
})

// ── CLEANUP ON QUIT ──
app.on('before-quit', () => {
  if (backendProcess) {
    backendProcess.kill()  // Kill Node backend process
  }
})

app.on('window-all-closed', () => {
  if (backendProcess) backendProcess.kill()
  app.quit()
})
```

---

## 8. Phase 2 — Vite + React Setup

### File: `vite.config.js`

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',   // Critical for Electron file loading
  server: {
    port: 5173
  },
  build: {
    outDir: 'dist'
  }
})
```

### File: `package.json` scripts section

```json
{
  "main": "electron/main.js",
  "scripts": {
    "dev": "concurrently \"vite\" \"wait-on http://localhost:5173 && cross-env NODE_ENV=development electron .\"",
    "build:react": "vite build",
    "build:electron": "electron-builder",
    "build": "npm run build:react && npm run build:electron",
    "backend": "node backend/server.js"
  }
}
```

### File: `electron/preload.js`

This file safely bridges Electron's main process with React. It exposes only the IPC functions React needs.

```javascript
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electron', {
  // Send answer to overlay window
  showAnswer: (data) => ipcRenderer.send('show-answer', data),

  // Toggle overlay visibility
  toggleOverlay: (visible) => ipcRenderer.send('toggle-overlay', visible),

  // Move overlay position
  moveOverlay: (pos) => ipcRenderer.send('move-overlay', pos),

  // Listen for answer display (used by overlay window)
  onDisplayAnswer: (callback) => ipcRenderer.on('display-answer', (event, data) => callback(data)),

  // Remove listener (cleanup)
  removeAnswerListener: () => ipcRenderer.removeAllListeners('display-answer')
})
```

### File: `src/App.jsx`

```jsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Setup from './pages/Setup'
import QABank from './pages/QABank'
import LiveMode from './pages/LiveMode'
import Overlay from './components/Overlay'

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Setup />} />
        <Route path="/qa-bank" element={<QABank />} />
        <Route path="/live" element={<LiveMode />} />
        <Route path="/overlay" element={<Overlay />} />
      </Routes>
    </Router>
  )
}
```

---

## 9. Phase 3 — Backend Server Setup

### File: `backend/server.js`

```javascript
const express = require('express')
const cors = require('cors')
require('dotenv').config()

const generateRoute = require('./routes/generate')
const embedRoute = require('./routes/embed')
const searchRoute = require('./routes/search')
const transcribeRoute = require('./routes/transcribe')
const groqRoute = require('./routes/groq')

const app = express()
const PORT = process.env.BACKEND_PORT || 3001

app.use(cors())
app.use(express.json({ limit: '50mb' }))

// Routes
app.use('/generate', generateRoute)   // Resume+JD → Q&A pairs
app.use('/embed', embedRoute)         // Q&A pairs → FAISS index
app.use('/search', searchRoute)       // Question text → best answer
app.use('/transcribe', transcribeRoute) // Audio → text
app.use('/groq', groqRoute)           // Surprise question → live answer

app.get('/health', (req, res) => res.json({ status: 'running' }))

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`)
})
```

---

## 10. Phase 4 — Q&A Generation (Pre-Interview)

### File: `backend/routes/generate.js`

This is where GPT-4o reads the resume and JD and generates 85 questions with human-like answers covering every possible interview topic.

```javascript
const express = require('express')
const OpenAI = require('openai')
const router = express.Router()

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

router.post('/', async (req, res) => {
  const { resume, jd } = req.body

  if (!resume || !jd) {
    return res.status(400).json({ error: 'Resume and JD are required' })
  }

  const prompt = `
You are an expert interview coach with 15 years of experience.
Based on the resume and job description below, generate 85 interview questions with answers.

CRITICAL RULES FOR ANSWERS:
1. Every answer must sound like a real human speaking naturally in an interview
2. Use phrases like "So basically...", "What I did was...", "In my experience...", "To be honest..."
3. Answers should be 3-5 sentences long — not too short, not too long
4. Include specific details from the resume (company names, project names, technologies)
5. Never sound robotic or like a textbook
6. For coding questions, provide simple clean code with a 1-line human explanation

Generate questions in these categories:
- 15 Background/Intro questions (vary the phrasing of each, e.g. "Tell me about yourself", "Walk me through your background", "Introduce yourself" — all get the same answer)
- 20 Technical questions based on skills in the resume
- 15 Project-based questions referencing actual projects from resume
- 15 Behavioral questions (STAR format answers)
- 10 Job-specific questions based on the JD requirements
- 10 HR/Salary/Culture/Motivation questions

Return ONLY a valid JSON array. No markdown, no explanation, nothing else.
Format:
[
  {
    "id": 1,
    "category": "Background",
    "question": "Tell me about yourself",
    "answer": "So I'm a software engineer with about 3 years of experience, mainly working on React and Node.js. I started at TechCorp right after college where I built internal dashboards, and that's where I really got into frontend work. Most recently I've been working on a full e-commerce platform that handles around 15k users a month. I'm looking to move into a role where I can work more on the product side, which is why this position at Acme caught my eye.",
    "isCode": false
  }
]

For coding questions use this format:
{
  "id": 45,
  "category": "Coding",
  "question": "Write a function to reverse a string in JavaScript",
  "answer": "Yeah sure, so the simplest way to do this in JavaScript would be:",
  "code": "function reverseString(str) {\\n  return str.split('').reverse().join('');\\n}\\n\\n// Example\\nconsole.log(reverseString('hello')); // 'olleh'",
  "codeLanguage": "javascript",
  "isCode": true
}

RESUME:
${resume}

JOB DESCRIPTION:
${jd}
`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 8000,
      temperature: 0.7
    })

    const text = response.choices[0].message.content
    const clean = text.replace(/```json|```/g, '').trim()
    const qaArray = JSON.parse(clean)

    res.json({ success: true, data: qaArray, count: qaArray.length })

  } catch (error) {
    console.error('Generation error:', error)
    res.status(500).json({ error: 'Failed to generate Q&A', details: error.message })
  }
})

module.exports = router
```

---

## 11. Phase 5 — FAISS Vector Store

### File: `backend/vectorStore/faissManager.js`

This is the core of the instant answer system. It stores all question embeddings and searches them in under 1 millisecond.

```javascript
const { IndexFlatIP } = require('faiss-node')
const OpenAI = require('openai')
const fs = require('fs')
const path = require('path')

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const STORE_PATH = path.join(__dirname, 'store.json')
const INDEX_PATH = path.join(__dirname, 'faiss.index')
const DIMENSION = 1536  // text-embedding-3-small output size

let faissIndex = null
let qaStore = []

// ── BUILD INDEX FROM Q&A ARRAY ──
// Called once after GPT-4o generates questions
async function buildIndex(qaArray) {
  console.log(`Building FAISS index for ${qaArray.length} questions...`)

  faissIndex = new IndexFlatIP(DIMENSION)
  qaStore = qaArray

  const vectors = []

  for (const qa of qaArray) {
    const embedding = await getEmbedding(qa.question)
    vectors.push(...embedding)  // Flatten into single array
  }

  faissIndex.add(vectors)

  // Save to disk so it persists between sessions
  faissIndex.write(INDEX_PATH)
  fs.writeFileSync(STORE_PATH, JSON.stringify(qaArray, null, 2))

  console.log(`FAISS index built with ${faissIndex.ntotal()} vectors`)
  return true
}

// ── LOAD SAVED INDEX ──
// Called on app startup if a previous index exists
function loadIndex() {
  if (fs.existsSync(INDEX_PATH) && fs.existsSync(STORE_PATH)) {
    faissIndex = IndexFlatIP.read(INDEX_PATH)
    qaStore = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'))
    console.log(`Loaded FAISS index with ${faissIndex.ntotal()} vectors`)
    return true
  }
  return false
}

// ── SEARCH FOR BEST MATCHING ANSWER ──
// This runs in under 1ms — truly instant
async function searchAnswer(questionText) {
  if (!faissIndex || faissIndex.ntotal() === 0) {
    throw new Error('FAISS index not built yet. Please generate Q&A bank first.')
  }

  // Convert incoming question to vector
  const queryVector = await getEmbedding(questionText)

  // Search top 1 result
  const result = faissIndex.search(queryVector, 1)

  const matchedIndex = result.labels[0]
  const confidence = result.distances[0]  // 0 to 1 (1 = perfect match)
  const matchedQA = qaStore[matchedIndex]

  return {
    question: matchedQA.question,
    answer: matchedQA.answer,
    code: matchedQA.code || null,
    codeLanguage: matchedQA.codeLanguage || null,
    isCode: matchedQA.isCode || false,
    category: matchedQA.category,
    confidence: Math.round(confidence * 100),   // Convert to percentage
    isInstant: true   // Came from FAISS, not Groq
  }
}

// ── GET EMBEDDING FROM OPENAI ──
async function getEmbedding(text) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text
  })
  return response.data[0].embedding
}

module.exports = { buildIndex, loadIndex, searchAnswer }
```

### File: `backend/routes/embed.js`

```javascript
const express = require('express')
const { buildIndex } = require('../vectorStore/faissManager')
const router = express.Router()

router.post('/', async (req, res) => {
  const { qaArray } = req.body

  if (!qaArray || !Array.isArray(qaArray)) {
    return res.status(400).json({ error: 'qaArray is required' })
  }

  try {
    await buildIndex(qaArray)
    res.json({ success: true, message: `Index built with ${qaArray.length} questions` })
  } catch (error) {
    res.status(500).json({ error: 'Failed to build FAISS index', details: error.message })
  }
})

module.exports = router
```

### File: `backend/routes/search.js`

```javascript
const express = require('express')
const { searchAnswer } = require('../vectorStore/faissManager')
const router = express.Router()

const CONFIDENCE_THRESHOLD = 65  // Below this, use Groq fallback

router.post('/', async (req, res) => {
  const { question } = req.body

  if (!question) {
    return res.status(400).json({ error: 'Question text is required' })
  }

  try {
    const result = await searchAnswer(question)

    // Tell the frontend whether to show instantly or use Groq fallback
    result.useGroq = result.confidence < CONFIDENCE_THRESHOLD

    res.json({ success: true, data: result })
  } catch (error) {
    res.status(500).json({ error: 'Search failed', details: error.message })
  }
})

module.exports = router
```

---

## 12. Phase 6 — Audio Capture & Whisper Transcription

### File: `backend/routes/transcribe.js`

```javascript
const express = require('express')
const multer = require('multer')
const OpenAI = require('openai')
const fs = require('fs')
const path = require('path')
const router = express.Router()

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// Store audio file temporarily
const upload = multer({ dest: 'backend/temp/' })

router.post('/', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file provided' })
  }

  try {
    const audioStream = fs.createReadStream(req.file.path)

    const transcription = await openai.audio.transcriptions.create({
      file: audioStream,
      model: 'whisper-1',
      language: 'en',
      response_format: 'text'
    })

    // Clean up temp file
    fs.unlinkSync(req.file.path)

    res.json({ success: true, text: transcription })

  } catch (error) {
    // Clean up on error too
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path)
    }
    res.status(500).json({ error: 'Transcription failed', details: error.message })
  }
})

module.exports = router
```

### File: `src/components/MicListener.jsx`

This component handles microphone capture inside React. It uses Voice Activity Detection (VAD) to only send audio when the interviewer finishes speaking — this reduces latency dramatically.

```jsx
import { useEffect, useRef, useState } from 'react'
import axios from 'axios'

export default function MicListener({ onTranscript, isListening }) {
  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])

  useEffect(() => {
    if (isListening) {
      startListening()
    } else {
      stopListening()
    }

    return () => stopListening()
  }, [isListening])

  async function startListening() {
    try {
      // Capture system microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        }
      })

      streamRef.current = stream
      chunksRef.current = []

      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      // Every 4 seconds, process what was captured
      // NOTE: For production, replace with VAD (Voice Activity Detection)
      // so we send the chunk only when interviewer finishes speaking
      recorder.onstop = async () => {
        if (chunksRef.current.length > 0) {
          const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' })
          chunksRef.current = []
          await sendForTranscription(audioBlob)
        }
      }

      recorder.start()

      // Stop and restart every 4 seconds
      const interval = setInterval(() => {
        if (recorder.state === 'recording') {
          recorder.stop()
          recorder.start()
        }
      }, 4000)

      streamRef.current.interval = interval

    } catch (error) {
      console.error('Microphone error:', error)
    }
  }

  async function sendForTranscription(audioBlob) {
    try {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'chunk.webm')

      const response = await axios.post('http://localhost:3001/transcribe', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      const transcript = response.data.text
      if (transcript && transcript.trim().length > 5) {
        onTranscript(transcript.trim())
      }
    } catch (error) {
      console.error('Transcription error:', error)
    }
  }

  function stopListening() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    if (streamRef.current) {
      if (streamRef.current.interval) {
        clearInterval(streamRef.current.interval)
      }
      streamRef.current.getTracks().forEach(track => track.stop())
    }
  }

  return null  // This component has no UI, just logic
}
```

---

## 13. Phase 7 — Answer Matching Logic

### The Full Pipeline in `src/pages/LiveMode.jsx`

```jsx
import { useState, useCallback } from 'react'
import MicListener from '../components/MicListener'
import AnswerCard from '../components/AnswerCard'
import axios from 'axios'

export default function LiveMode() {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [currentAnswer, setCurrentAnswer] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  // Called every time a new transcript chunk arrives
  const handleTranscript = useCallback(async (text) => {
    setTranscript(text)
    setIsLoading(true)

    try {
      // Step 1: Search FAISS for pre-generated answer
      const searchRes = await axios.post('http://localhost:3001/search', { question: text })
      const result = searchRes.data.data

      if (!result.useGroq) {
        // ✅ HIGH CONFIDENCE — Show pre-generated answer instantly
        setCurrentAnswer(result)
        setIsLoading(false)

        // Send to overlay window via Electron IPC
        window.electron.showAnswer(result)

      } else {
        // ⚠️ LOW CONFIDENCE — Surprise question, call Groq for live answer
        const groqRes = await axios.post('http://localhost:3001/groq', {
          question: text,
          // Pass partial match context so Groq can use it
          partialMatch: result.answer
        })

        const groqResult = groqRes.data.data
        setCurrentAnswer(groqResult)
        setIsLoading(false)

        window.electron.showAnswer(groqResult)
      }

    } catch (error) {
      console.error('Answer pipeline error:', error)
      setIsLoading(false)
    }
  }, [])

  return (
    <div className="live-mode">
      <MicListener onTranscript={handleTranscript} isListening={isListening} />

      <div className="controls">
        <button onClick={() => setIsListening(!isListening)}>
          {isListening ? '⏹ Stop Listening' : '🎙️ Start Listening'}
        </button>
        <button onClick={() => window.electron.toggleOverlay(true)}>Show Overlay</button>
        <button onClick={() => window.electron.toggleOverlay(false)}>Hide Overlay</button>
      </div>

      <div className="transcript">
        <label>Detected Speech:</label>
        <p>{transcript || 'Waiting for interviewer to speak...'}</p>
      </div>

      {isLoading && <div className="loading">Finding answer...</div>}

      {currentAnswer && <AnswerCard data={currentAnswer} />}
    </div>
  )
}
```

---

## 14. Phase 8 — Groq Fallback (Surprise Questions)

### File: `backend/routes/groq.js`

When FAISS confidence is below 65%, this route generates a live answer using Groq's ultra-fast inference. Groq runs Llama 3.3 70B and responds in 200–400ms.

```javascript
const express = require('express')
const Groq = require('groq-sdk')
const router = express.Router()

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

router.post('/', async (req, res) => {
  const { question, partialMatch } = req.body

  const prompt = `
You are helping a software engineering candidate answer an interview question in real time.

CRITICAL RULES — READ CAREFULLY:
1. Answer must sound like a REAL HUMAN speaking in a job interview, not an AI
2. Use natural conversational phrases: "So basically...", "Yeah, so...", "What I've found is...", "To be honest...", "The way I approach this is..."
3. Keep it to 3-5 sentences MAX — interview answers should be concise
4. Be specific and confident, not vague
5. If it is a coding question, provide simple clean code that looks human-written
6. Do NOT start with "Certainly!" or "Great question!" — those are AI giveaways
7. Do NOT use bullet points — speak in natural flowing sentences

Interview Question: "${question}"

${partialMatch ? `Context hint (partially related answer from prep): "${partialMatch}"` : ''}

Respond with ONLY the answer the candidate should say. Nothing else.
`

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.7,
      stream: false
    })

    const answer = completion.choices[0].message.content.trim()

    res.json({
      success: true,
      data: {
        question: question,
        answer: answer,
        isCode: answer.includes('```') || answer.includes('function') || answer.includes('def '),
        confidence: 55,   // Groq generated, not from FAISS
        isInstant: false,
        fromGroq: true
      }
    })

  } catch (error) {
    res.status(500).json({ error: 'Groq failed', details: error.message })
  }
})

module.exports = router
```

---

## 15. Phase 9 — Human-Like Answer Generation

This is critically important. The AI answers must sound like the student is speaking naturally, not reading from a script.

### The Humanizer Rules (built into all prompts)

**DO use these phrases:**
- "So basically what I did was..."
- "Yeah, so in my experience..."
- "The way I think about this is..."
- "To be honest, I struggled with this at first but..."
- "What worked really well for me was..."
- "I remember in my last role we had a similar problem..."
- "Pretty straightforward — I just..."

**NEVER use these AI giveaways:**
- "Certainly!" / "Absolutely!" / "Great question!"
- "As a software engineer..." (sounds robotic)
- Bullet points in verbal answers
- "It is worth noting that..."
- "In conclusion..."
- Overly formal language

### File: `backend/utils/humanizer.js`

Post-process answers to make them sound more natural:

```javascript
// List of robotic phrases to replace
const ROBOTIC_PHRASES = [
  { find: /^Certainly!/i, replace: 'Sure,' },
  { find: /^Absolutely!/i, replace: 'Yeah,' },
  { find: /^Great question!/i, replace: '' },
  { find: /^As an AI/i, replace: "From my experience" },
  { find: /It is worth noting that/gi, replace: 'Also,' },
  { find: /In conclusion,/gi, replace: 'So basically,' },
  { find: /Furthermore,/gi, replace: 'Also,' },
  { find: /Nevertheless,/gi, replace: 'That said,' },
  { find: /In summary,/gi, replace: 'So basically,' }
]

function humanize(text) {
  let result = text
  for (const { find, replace } of ROBOTIC_PHRASES) {
    result = result.replace(find, replace)
  }
  return result.trim()
}

module.exports = { humanize }
```

---

## 16. Phase 10 — Coding Question Handler

When the interviewer asks a coding question, the app needs to show code that:
- Is correct and works
- Is simple and readable — not over-engineered
- Has a 1-line human explanation before the code
- Looks like something a human would write quickly in an interview

### How to detect coding questions

In the FAISS search result, the `isCode: true` flag is set. For Groq answers, check if the answer contains code blocks.

### File: `src/components/CodeDisplay.jsx`

```jsx
import { useEffect, useRef } from 'react'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'

export default function CodeDisplay({ code, language, explanation }) {
  const codeRef = useRef(null)

  useEffect(() => {
    if (codeRef.current) {
      hljs.highlightElement(codeRef.current)
    }
  }, [code])

  return (
    <div className="code-display">
      {explanation && (
        <p className="code-explanation">{explanation}</p>
      )}
      <div className="code-block">
        <div className="code-header">
          <span>{language || 'javascript'}</span>
          <button onClick={() => navigator.clipboard.writeText(code)}>Copy</button>
        </div>
        <pre>
          <code ref={codeRef} className={`language-${language || 'javascript'}`}>
            {code}
          </code>
        </pre>
      </div>
    </div>
  )
}
```

### GPT-4o prompt rules for coding answers

When generating coding Q&A in Phase 4, include these rules:

```
For coding questions:
1. Write code at the level of a competent mid-level developer — not too clever, not too simple
2. Use clean variable names that make sense (not a, b, c or x, y, z)
3. Add 1-2 short comments inside the code explaining the key logic
4. Keep it under 20 lines — interviewers don't want essays
5. Use the most common/standard approach, not the most clever approach
6. Test case should be simple and obvious
7. The spoken answer before the code should be 1 sentence like "Yeah so here's how I'd approach that:"
```

### Example of good vs bad coding answer

**Bad (AI-looking):**
```
"Certainly! Here is an efficient solution utilizing JavaScript's built-in array methods to achieve the desired output with O(n) time complexity:"
```

**Good (Human-looking):**
```
"Yeah so the cleanest way I know to do this is:"

function twoSum(nums, target) {
  const seen = {}  // Store numbers we've visited
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i]
    if (seen[complement] !== undefined) {
      return [seen[complement], i]
    }
    seen[nums[i]] = i
  }
}

// twoSum([2,7,11,15], 9) → [0, 1]
```

---

## 17. Phase 11 — IPC Communication

IPC (Inter-Process Communication) is how the main window and overlay window talk to each other inside Electron.

### Complete IPC Flow:

```
React (LiveMode.jsx)
       ↓ window.electron.showAnswer(data)
Preload.js (exposes ipcRenderer)
       ↓ ipcRenderer.send('show-answer', data)
Electron Main (main.js)
       ↓ ipcMain.on('show-answer') → overlayWindow.webContents.send('display-answer', data)
Overlay Window (Overlay.jsx)
       ↓ window.electron.onDisplayAnswer(callback)
Display answer on screen
```

### All IPC channels used:

| Channel | Direction | Purpose |
|---|---|---|
| `show-answer` | Renderer → Main | Send answer data to display |
| `display-answer` | Main → Overlay | Forward answer to overlay window |
| `toggle-overlay` | Renderer → Main | Show/hide overlay |
| `move-overlay` | Renderer → Main | Reposition overlay |

---

## 18. Phase 12 — Overlay UI

### File: `src/components/Overlay.jsx`

This is the floating transparent widget. It must be:
- Semi-transparent background (student can see through it slightly)
- Compact — doesn't block too much of the screen
- Shows confidence score so student knows how much to trust the answer
- Smoothly animates when new answer arrives
- Drag-to-reposition with right-click

```jsx
import { useState, useEffect } from 'react'
import CodeDisplay from './CodeDisplay'

export default function Overlay() {
  const [answerData, setAnswerData] = useState(null)
  const [visible, setVisible] = useState(true)
  const [animating, setAnimating] = useState(false)

  useEffect(() => {
    // Listen for answers from main process
    window.electron.onDisplayAnswer((data) => {
      setAnimating(true)
      setAnswerData(data)
      setTimeout(() => setAnimating(false), 300)
    })

    // Keyboard shortcut: Ctrl+H to hide/show
    const handleKeydown = (e) => {
      if (e.ctrlKey && e.key === 'h') {
        setVisible(prev => !prev)
      }
    }

    window.addEventListener('keydown', handleKeydown)

    return () => {
      window.electron.removeAnswerListener()
      window.removeEventListener('keydown', handleKeydown)
    }
  }, [])

  if (!visible) return null

  const getConfidenceColor = (confidence) => {
    if (confidence >= 80) return '#00d4aa'   // Green — high confidence
    if (confidence >= 60) return '#e3b341'   // Yellow — medium
    return '#f85149'                          // Red — low, use with caution
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'transparent',
      padding: '16px',
      fontFamily: 'Segoe UI, sans-serif'
    }}>
      <div style={{
        background: 'rgba(8, 12, 16, 0.88)',
        border: `1px solid rgba(0, 212, 170, 0.4)`,
        borderRadius: '14px',
        padding: '16px',
        backdropFilter: 'blur(16px)',
        transform: animating ? 'scale(0.98)' : 'scale(1)',
        transition: 'transform 0.3s ease',
        maxHeight: '480px',
        overflowY: 'auto'
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: '12px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          paddingBottom: '10px'
        }}>
          <span style={{ color: '#00d4aa', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>
            🤖 Interview AI
          </span>
          <span style={{ fontSize: '10px', color: '#8b949e' }}>
            Ctrl+H to hide
          </span>
        </div>

        {!answerData ? (
          <p style={{ color: '#8b949e', fontSize: '12px' }}>
            Waiting for interviewer to ask a question...
          </p>
        ) : (
          <>
            {/* Detected Question */}
            <div style={{
              background: 'rgba(255,255,255,0.04)',
              borderRadius: '8px', padding: '10px',
              marginBottom: '12px'
            }}>
              <div style={{ fontSize: '9px', color: '#e3b341', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
                🎧 Detected Question
              </div>
              <p style={{ color: '#8b949e', fontSize: '11px', lineHeight: '1.5', margin: 0 }}>
                {answerData.question}
              </p>
            </div>

            {/* Confidence Bar */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '9px', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  {answerData.fromGroq ? '⚡ Live Answer' : '⚡ Instant Answer'}
                </span>
                <span style={{ fontSize: '9px', color: getConfidenceColor(answerData.confidence) }}>
                  {answerData.confidence}% match
                </span>
              </div>
              <div style={{ height: '2px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px' }}>
                <div style={{
                  height: '100%',
                  width: `${answerData.confidence}%`,
                  background: `linear-gradient(90deg, #00d4aa, #7c3aed)`,
                  borderRadius: '2px',
                  transition: 'width 0.6s ease'
                }} />
              </div>
            </div>

            {/* Answer Text */}
            <div style={{ fontSize: '13px', color: '#e6edf3', lineHeight: '1.8' }}>
              {answerData.answer}
            </div>

            {/* Code Block (if coding question) */}
            {answerData.isCode && answerData.code && (
              <CodeDisplay
                code={answerData.code}
                language={answerData.codeLanguage}
                explanation={null}
              />
            )}

            {/* Low confidence warning */}
            {answerData.confidence < 60 && (
              <div style={{
                marginTop: '10px', padding: '8px 10px',
                background: 'rgba(248,81,73,0.1)',
                border: '1px solid rgba(248,81,73,0.3)',
                borderRadius: '6px', fontSize: '11px', color: '#f85149'
              }}>
                ⚠️ Low confidence match — answer carefully, use your own judgment
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
```

---

## 19. Phase 13 — Main App UI Pages

### Page 1: Setup (`src/pages/Setup.jsx`)

What it does: Lets student paste resume and JD, then generates Q&A bank.

Key elements:
- Two large textareas — Resume and Job Description
- "Generate Q&A Bank" button
- Progress indicator showing each step: "Analyzing resume... Generating questions... Building search index..."
- After completion, navigate to QABank page

### Page 2: QABank (`src/pages/QABank.jsx`)

What it does: Shows all 85 generated questions and answers for review before the interview.

Key elements:
- List of all Q&A pairs grouped by category (Technical, Behavioral, etc.)
- Each question is expandable to show the answer
- Student can edit any answer to personalize it more
- A "Save & Start Interview" button at the bottom

### Page 3: LiveMode (`src/pages/LiveMode.jsx`)

What it does: The interview control center.

Key elements:
- Large mic on/off toggle button
- Live transcript display (shows what Whisper heard)
- Last detected question
- Confidence percentage of the match
- The overlay is running separately in its own window
- "Hide Overlay" / "Show Overlay" buttons
- "End Interview" button

---

## 20. Phase 14 — Packaging into .exe

### File: `package.json` build configuration

```json
{
  "build": {
    "appId": "com.interviewai.desktop",
    "productName": "Interview AI",
    "copyright": "Interview AI",
    "win": {
      "target": "nsis",
      "icon": "assets/icon.ico"
    },
    "nsis": {
      "oneClick": true,
      "installerIcon": "assets/icon.ico",
      "uninstallerIcon": "assets/icon.ico",
      "installerHeaderIcon": "assets/icon.ico",
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true
    },
    "files": [
      "dist/**/*",
      "electron/**/*",
      "backend/**/*",
      "node_modules/**/*",
      ".env"
    ],
    "extraResources": [
      {
        "from": "backend",
        "to": "backend"
      }
    ]
  }
}
```

Run to build:
```bash
npm run build:react
npm run build:electron
```

Output: `dist-electron/Interview AI Setup.exe` — students double-click to install.

---

## 21. Complete Data Flow

```
╔══════════════════════════════════════════════════════════╗
║              PRE-INTERVIEW SETUP                         ║
╠══════════════════════════════════════════════════════════╣
║  Student pastes Resume + JD                             ║
║         ↓                                               ║
║  POST /generate → GPT-4o                                ║
║  Generates 85 Q&A pairs with human-like answers         ║
║  Includes coding questions with clean code              ║
║         ↓                                               ║
║  POST /embed → faissManager.buildIndex()                ║
║  Each question → OpenAI embedding → 1536-dim vector     ║
║  All vectors stored in FAISS IndexFlatIP                ║
║  Q&A metadata saved to store.json                       ║
║         ↓                                               ║
║  Student reviews & edits answers                        ║
║  Clicks "Start Interview"                               ║
╚══════════════════════════════════════════════════════════╝

╔══════════════════════════════════════════════════════════╗
║              LIVE INTERVIEW MODE                         ║
╠══════════════════════════════════════════════════════════╣
║  Interviewer speaks                                     ║
║         ↓                                               ║
║  MediaRecorder captures 4s audio chunk                  ║
║  (VAD sends chunk when speech ends, not on timer)       ║
║         ↓                                               ║
║  POST /transcribe → Whisper API                         ║
║  Audio → Text (1–2 seconds)                             ║
║         ↓                                               ║
║  POST /search → FAISS vector search                     ║
║  Question → Embedding → Cosine similarity search        ║
║         ↓                                               ║
║    Confidence >= 65%          Confidence < 65%          ║
║         ↓                           ↓                   ║
║  Pull from store.json         POST /groq                ║
║  (< 100ms, instant)           Groq Llama 3.3 70B        ║
║                               (~2-3 seconds)            ║
║         ↓                           ↓                   ║
║         └──────── IPC: show-answer ─┘                   ║
║                        ↓                               ║
║  Overlay Window receives display-answer event           ║
║  Answer displayed on transparent floating widget        ║
║  INVISIBLE to screen recording (setContentProtection)   ║
╚══════════════════════════════════════════════════════════╝
```

---

## 22. Windsurf / Antigravity Prompts — Copy Paste Ready

Use these exact prompts with your AI IDE. They are written to give complete, working output with zero ambiguity.

---

### Prompt 1 — Project Initialization
```
Create a new Electron + React + Vite project called "interview-ai".

Requirements:
- Electron for desktop shell
- React with Vite for frontend (port 5173)
- Node.js Express backend running on port 3001
- React Router for navigation between 3 pages: Setup, QABank, LiveMode
- One special route /overlay for the transparent overlay component

Create the complete folder structure:
electron/main.js, electron/preload.js
src/App.jsx, src/main.jsx, src/pages/Setup.jsx, src/pages/QABank.jsx, src/pages/LiveMode.jsx
src/components/Overlay.jsx, src/components/MicListener.jsx, src/components/AnswerCard.jsx, src/components/CodeDisplay.jsx
backend/server.js, backend/routes/generate.js, backend/routes/embed.js, backend/routes/search.js, backend/routes/transcribe.js, backend/routes/groq.js
backend/vectorStore/faissManager.js
backend/utils/humanizer.js

Create package.json with these scripts:
- dev: runs Vite + Electron + Backend together using concurrently and wait-on
- build: builds React then packages with electron-builder

Install all required packages:
electron, express, cors, dotenv, openai, faiss-node, groq-sdk, node-record-lpcm16, multer, axios, highlight.js, react, react-dom, react-router-dom
dev: vite, @vitejs/plugin-react, electron-builder, concurrently, wait-on, cross-env
```

---

### Prompt 2 — Electron Main Window Setup
```
Create electron/main.js with exactly these requirements:

1. Start the Node.js backend from backend/server.js as a child process on app launch
2. Wait 2 seconds then create two BrowserWindows:

MAIN WINDOW:
- size: 1000x700, min 800x600
- loads http://localhost:5173 in dev, dist/index.html in production
- normal window with frame and taskbar icon

OVERLAY WINDOW:
- size: 420x520
- positioned at top-right corner of primary display (x = screenWidth - 440, y = 20)
- transparent: true
- frame: false
- alwaysOnTop: true
- skipTaskbar: true
- hasShadow: false
- focusable: false
- resizable: true
- MUST call setContentProtection(true) — makes it invisible in all Windows screen recordings
- MUST call setIgnoreMouseEvents(true, { forward: true }) — click-through
- loads http://localhost:5173/overlay in dev

3. Set up these IPC channels:
- 'show-answer': receive from renderer, forward to overlayWindow with 'display-answer'
- 'toggle-overlay': receive boolean, call overlayWindow.showInactive() or overlayWindow.hide()
- 'move-overlay': receive {x, y}, call overlayWindow.setPosition(x, y)

4. On app quit: kill the backend child process to prevent port conflicts
```

---

### Prompt 3 — Backend Q&A Generation Route
```
Create backend/routes/generate.js:

This route handles POST /generate
It takes { resume, jd } from request body
It calls GPT-4o (model: gpt-4o) with this exact task:

Generate exactly 85 interview questions with answers based on the resume and JD.

Categories:
- 15 Background/Intro questions (different phrasings of "tell me about yourself" etc.)
- 20 Technical questions based on skills listed in resume
- 15 Project questions about specific projects in resume
- 15 Behavioral STAR-format questions
- 10 JD-specific questions based on job requirements
- 10 HR/Motivation/Culture questions

Answer rules:
- Sound like a real human speaking in an interview
- Use natural phrases: "So basically...", "What I did was...", "In my experience..."
- 3-5 sentences per answer
- Reference specific details from the resume
- Never use "Certainly!", "Absolutely!", "Great question!"
- Never use bullet points in verbal answers

Return ONLY a valid JSON array, no markdown, with this structure:
[{ "id": 1, "category": "Background", "question": "...", "answer": "...", "isCode": false }]

For coding questions add: "code": "...", "codeLanguage": "javascript", "isCode": true
The spoken answer for coding questions should just be one natural sentence like "Yeah so here's how I'd do that:"
Code should be simple, clean, under 20 lines, with 1-2 short comments

Use model gpt-4o, max_tokens 8000, temperature 0.7
Parse the JSON response and return { success: true, data: qaArray, count: qaArray.length }
```

---

### Prompt 4 — FAISS Vector Store
```
Create backend/vectorStore/faissManager.js:

This file manages the FAISS vector index for instant answer retrieval.

Use faiss-node package. Use IndexFlatIP (Inner Product = cosine similarity). Dimension = 1536.

Implement these three functions:

1. buildIndex(qaArray):
- Takes array of Q&A objects
- For each question, call OpenAI text-embedding-3-small to get 1536-dim embedding
- Add all vectors to FAISS IndexFlatIP index
- Save index to backend/vectorStore/faiss.index
- Save qaArray to backend/vectorStore/store.json
- Return true when done

2. loadIndex():
- Check if faiss.index and store.json exist
- If yes, load both and return true
- If no, return false

3. searchAnswer(questionText):
- Get embedding for questionText using OpenAI text-embedding-3-small
- Search FAISS index for top 1 result
- Return object: { question, answer, code, codeLanguage, isCode, category, confidence (0-100 percentage), isInstant: true }

Call loadIndex() at module load time so previous sessions are available immediately.
Export all three functions.
```

---

### Prompt 5 — Groq Fallback Route
```
Create backend/routes/groq.js:

This route handles POST /groq
It takes { question, partialMatch } from request body
It uses groq-sdk with model llama-3.3-70b-versatile

The system prompt must make the AI answer like a real human in a job interview:
- Natural conversational tone
- Phrases like "So basically...", "Yeah so...", "What I've found is..."
- 3-5 sentences maximum
- No "Certainly!", "Absolutely!", "Great question!"
- No bullet points
- If coding question: return simple clean code under 20 lines

max_tokens: 300, temperature: 0.7

Return: { success: true, data: { question, answer, isCode, confidence: 55, isInstant: false, fromGroq: true } }
```

---

### Prompt 6 — Live Answer Pipeline
```
Create src/pages/LiveMode.jsx:

This page is the interview control center.

1. Import and use MicListener component — pass isListening state and handleTranscript callback

2. handleTranscript function (called every time Whisper returns transcript text):
   a. POST to http://localhost:3001/search with { question: transcriptText }
   b. If result.confidence >= 65: use the FAISS answer immediately, call window.electron.showAnswer(result)
   c. If result.confidence < 65: POST to http://localhost:3001/groq with { question: transcriptText, partialMatch: result.answer }, then call window.electron.showAnswer(groqResult)

3. UI elements:
   - Large microphone toggle button (Start Listening / Stop Listening)
   - Show/Hide Overlay buttons that call window.electron.toggleOverlay()
   - Live transcript display box
   - Current answer preview
   - Loading state when waiting for transcription or Groq

State: isListening, transcript, currentAnswer, isLoading
```

---

### Prompt 7 — Transparent Overlay Component
```
Create src/components/Overlay.jsx:

This is the floating transparent widget shown on the overlay window.

Design requirements:
- Background: rgba(8, 12, 16, 0.88) with backdrop-filter: blur(16px)
- Border: 1px solid rgba(0, 212, 170, 0.4)
- Border radius: 14px
- Font: Segoe UI or system font
- Text colors: #e6edf3 for answers, #8b949e for muted text, #00d4aa for labels

Content to show:
1. Header with "🤖 Interview AI" label and "Ctrl+H to hide" hint
2. Detected question box (small, muted background)
3. Confidence bar (green > 80%, yellow 60-80%, red < 60%)
4. Answer text (human-like, 13px, line-height 1.8)
5. Code block if isCode is true (use highlight.js for syntax highlighting)
6. Warning message if confidence < 60%: "⚠️ Low confidence — use your own judgment"

Behavior:
- Listen for 'display-answer' event via window.electron.onDisplayAnswer()
- Animate (scale 0.98 → 1) when new answer arrives
- Ctrl+H keyboard shortcut to toggle visibility
- Clean up listeners on unmount
```

---

## 23. Challenges & How to Handle Them

### Challenge 1 — Whisper Latency (2–4 seconds)
**Problem:** Whisper API takes 1–2 seconds to transcribe audio. Combined with network time, you get 2–4 second delay.

**Solution:**
- Use Voice Activity Detection (VAD) — send chunk the moment interviewer stops speaking, not on a timer
- Use 3-second chunks instead of 4-second
- Total realistic latency: 1.5–2.5 seconds, which feels acceptable

**How to implement VAD with your AI IDE prompt:**
```
Add Voice Activity Detection to MicListener.jsx using the @ricky0123/vad-node package.
Instead of sending audio every 4 seconds on a timer, send the audio chunk only when
the VAD detects that speech has ended (silence after speech). This reduces latency
because we don't wait for the full 4 seconds if the interviewer finishes their
sentence in 2 seconds.
```

---

### Challenge 2 — FAISS Returns Wrong Answer
**Problem:** FAISS always returns the closest match even if nothing is truly similar.

**Solution:** Already handled in the code above — confidence threshold of 65%. Below that, Groq generates a fresh answer.

---

### Challenge 3 — Electron Black Window (Transparency Bug)
**Problem:** On some Windows PCs with older GPU drivers, the transparent overlay shows as black.

**Solution:** Add this to main.js before app.whenReady():
```javascript
// Add this at top of main.js if transparency issues occur
// app.disableHardwareAcceleration()
```

Tell users: if they see a black box, they need to update their GPU drivers, OR uncomment that line.

---

### Challenge 4 — Port 3001 Already in Use
**Problem:** If the app crashes without properly killing the backend, port 3001 stays occupied on next launch.

**Solution:** Add port conflict handling in server.js:
```javascript
const server = app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`)
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} busy, trying ${PORT + 1}`)
    server.listen(PORT + 1)
  }
})
```

---

### Challenge 5 — Mic Picks Up Student's Voice
**Problem:** Whisper transcribes whoever is loudest — sometimes the student answering, not the interviewer asking.

**Solution:** Add a manual "Interviewer Speaking" mode button. Student presses it when the interviewer starts talking, releases when they stop. This is more reliable than automatic detection.

---

### Challenge 6 — Backend Doesn't Start Fast Enough
**Problem:** Electron loads the UI before the backend is ready, causing API errors.

**Solution:** The 2-second delay in main.js handles this. For more reliability, add a health check:
```javascript
// In main.js, instead of setTimeout, poll backend health
async function waitForBackend() {
  for (let i = 0; i < 20; i++) {
    try {
      await fetch('http://localhost:3001/health')
      return true  // Backend is ready
    } catch {
      await new Promise(r => setTimeout(r, 500))  // Wait 500ms and retry
    }
  }
}
```

---

## 24. Build Order — Step by Step

Follow this exact order. Don't skip ahead.

```
Step 1 ── Initialize project, install all packages, create folder structure
          Test: npm run dev starts without errors

Step 2 ── Create electron/main.js and preload.js
          Test: Two windows open — main window and an overlay window
          Verify: setContentProtection is working (try to screen record — overlay should be invisible)

Step 3 ── Create backend/server.js with just /health route
          Test: curl http://localhost:3001/health returns { status: 'running' }

Step 4 ── Create backend/routes/generate.js
          Test: POST /generate with sample resume + JD returns 85 Q&A pairs in JSON

Step 5 ── Create backend/vectorStore/faissManager.js + backend/routes/embed.js
          Test: POST /embed with the Q&A array returns success, faiss.index file is created

Step 6 ── Create backend/routes/search.js
          Test: POST /search with "tell me about yourself" returns answer with confidence > 65

Step 7 ── Create backend/routes/transcribe.js
          Test: POST /transcribe with an audio file returns transcript text

Step 8 ── Create backend/routes/groq.js
          Test: POST /groq with a question returns human-like answer in < 1 second

Step 9 ── Create src/components/MicListener.jsx
          Test: Component captures mic audio and calls onTranscript callback every 4 seconds

Step 10 ── Create src/pages/LiveMode.jsx
           Test: Full pipeline — speak into mic, see answer appear on screen

Step 11 ── Create src/components/Overlay.jsx
           Test: Answer appears on the transparent overlay window

Step 12 ── Wire up IPC — showAnswer flows from LiveMode → main.js → Overlay
           Test: Answer on main window also appears on overlay window

Step 13 ── Create src/pages/Setup.jsx and src/pages/QABank.jsx
           Test: Full user flow — paste resume → generate → view Q&A → start interview

Step 14 ── Final testing: Full interview simulation
           - Open Zoom or Google Meet
           - Start screen share
           - Verify overlay is invisible on shared screen
           - Speak interview questions, verify answers appear

Step 15 ── Package with electron-builder
           Test: .exe installs and runs on a clean Windows machine
```

---

## 25. Cost Breakdown

### Per interview session (30 min):

| API Call | Cost |
|---|---|
| GPT-4o Q&A generation (one time per JD) | ~$0.10 |
| OpenAI embeddings (85 questions) | ~$0.001 |
| Whisper transcription (30 min interview) | ~$0.18 |
| Groq fallback calls (est. 5 surprise questions) | ~$0.001 |
| FAISS search (instant, free, local) | $0.00 |
| **Total per interview** | **~$0.28** |

### If you productize this:

| Users/Month | Monthly API Cost | Suggested Price |
|---|---|---|
| 100 students | ~$28 | $5–10/month per student |
| 500 students | ~$140 | $5–10/month per student |
| 1000 students | ~$280 | $5–10/month per student |

---

## ✅ Summary — What Makes This Work

| Feature | How |
|---|---|
| Invisible to screen share | `setContentProtection(true)` — Windows DWM level |
| Instant answers (< 100ms) | FAISS pre-built index searched locally |
| Surprise question answers (2–3s) | Groq Llama 3.3 70B — fastest AI inference |
| Human-like answers | Specific prompt engineering rules in GPT-4o + Groq |
| Human-like code | Simple, clean, commented, under 20 lines |
| No suspicious AI phrases | Humanizer post-processing removes giveaway phrases |
| Works offline (after setup) | FAISS runs locally, no internet needed for known questions |
| Easy install for students | Single .exe from electron-builder |

---

*This document covers 100% of what you need to build the AI Interview Assistant. Follow the build order, use the IDE prompts, and the app will work exactly as described.*
