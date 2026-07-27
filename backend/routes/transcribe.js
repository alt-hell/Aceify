const express         = require('express')
const router          = express.Router()
const busboy          = require('busboy')
const fs              = require('fs')
const path            = require('path')
const { AzureOpenAI } = require('openai')
const session         = require('../utils/sessionMemory')

const azure = new AzureOpenAI({
  apiKey:     process.env.AZURE_OPENAI_API_KEY,
  endpoint:   process.env.AZURE_OPENAI_ENDPOINT,
  apiVersion: process.env.API_VERSION,
  deployment: process.env.AZURE_WHISPER_DEPLOYMENT || process.env.AZURE_OPENAI_DEPLOYMENT,
})
// In packaged .exe, resources/ is read-only — write temp audio files to writable AppData folder.
// USER_DATA_PATH is injected by electron/main.js only when app.isPackaged === true.
const TEMP = process.env.USER_DATA_PATH
  ? path.join(process.env.USER_DATA_PATH, 'temp')
  : path.join(__dirname, '../temp/')

if (!fs.existsSync(TEMP)) fs.mkdirSync(TEMP, { recursive: true })

// CRITICAL: Use KEYWORD-ONLY format — never use sentences/paragraphs.
// When Whisper receives unclear audio (noise, silence), it "completes" the prompt
// as if it were speech. A sentence prompt gets transcribed literally.
// A keyword list CANNOT be hallucinated as speech because it has no grammar.
// ─────────────────────────────────────────────────────────────────────────────
const GENERIC_INTERVIEW_PROMPT =
  'React, Next.js, Node.js, Python, FastAPI, PostgreSQL, MongoDB, Redis, Docker, Kubernetes, ' +
  'machine learning, LLM, RAG, LangChain, LlamaIndex, vector database, embeddings, transformer, ' +
  'GPT, BERT, fine-tuning, prompt engineering, REST API, GraphQL, microservices, CI/CD, ' +
  'candidate, interviewer, resume, experience, project, software engineer, GenAI, Groq.'

// ─────────────────────────────────────────────────────────────────────────────
// Get the best available Whisper prompt:
//   1. Dynamic context from QA store (most accurate — knows your exact tech stack)
//   2. Generic fallback (used before first answer triggers profile extraction)
// ─────────────────────────────────────────────────────────────────────────────
function getWhisperPrompt() {
  const dynamic = session.getWhisperContext()
  if (dynamic) {
    return dynamic   // Interview-specific vocabulary — best accuracy
  }
  return GENERIC_INTERVIEW_PROMPT  // Generic fallback
}



// ─────────────────────────────────────────────────────────────────────────────
// POST /transcribe
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', (req, res) => {
  const contentType = req.headers['content-type'] || ''
  if (!contentType.includes('multipart/form-data')) {
    return res.status(400).json({ error: 'Expected multipart/form-data.' })
  }

  let responded    = false
  let fileReceived = false
  let tempPath     = null

  const bb = busboy({
    headers: req.headers,
    limits:  { files: 1, fileSize: 25 * 1024 * 1024 }
  })

  bb.on('file', (fieldname, fileStream, info) => {
    fileReceived = true
    const { filename } = info
    const ext     = path.extname(filename || 'audio.webm') || '.webm'
    tempPath      = path.join(TEMP, `audio-${Date.now()}${ext}`)

    console.log(`[Transcribe] Receiving: ${path.basename(tempPath)}, field: ${fieldname}`)

    const writeStream = fs.createWriteStream(tempPath)
    let   truncated   = false

    fileStream.on('limit', () => {
      truncated = true
      writeStream.destroy()
      try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath) } catch {}
      if (!responded) { responded = true; res.status(400).json({ error: 'File too large (max 25 MB).' }) }
    })

    fileStream.pipe(writeStream)

    writeStream.on('close', async () => {
      if (responded || truncated) return
      try {
        const stat = fs.statSync(tempPath)
        console.log(`[Transcribe] Written: ${stat.size} bytes`)

        if (stat.size < 100) {
          responded = true
          return res.status(400).json({ error: 'Audio too short. Please speak for at least 2 seconds.' })
        }

        // ── Groq Whisper with timeout + 1 auto-retry ─────────────────────
        // whisper-large-v3-turbo: 4x faster than v3, same accuracy for English
        // Explicit 30s timeout prevents the silent 60s+ hang.
        // Auto-retry once covers Groq's occasional slow cold-starts.
        const whisperPrompt = getWhisperPrompt()
        const isDynamic     = !!session.getWhisperContext()
        console.log(`[Transcribe] Sending to Groq Whisper (large-v3)... [${isDynamic ? '🎯 dynamic context' : '📋 generic context'}]`)

        const buildWhisperParams = (deploymentOverride) => ({
          file:            fs.createReadStream(tempPath),
          model:           deploymentOverride || process.env.AZURE_WHISPER_DEPLOYMENT || 'whisper-1',
          language:        'en',
          response_format: 'verbose_json',
          temperature:     0.0,
          prompt:          whisperPrompt,
        })

        let transcription
        try {
          transcription = await azure.audio.transcriptions.create(buildWhisperParams(), { timeout: 30000 })
        } catch (firstErr) {
          const isTimeout = firstErr.message?.toLowerCase().includes('timeout') ||
                            firstErr.message?.toLowerCase().includes('timed out') ||
                            firstErr.code === 'ETIMEDOUT' ||
                            firstErr.status === 408
          if (isTimeout) {
            console.warn('[Transcribe] ⏱ Whisper timed out — retrying once (40s window)...')
            try {
              transcription = await azure.audio.transcriptions.create(buildWhisperParams(), { timeout: 40000 })
              console.log('[Transcribe] ✅ Retry succeeded')
            } catch (retryErr) {
              throw new Error('Azure Whisper timed out twice. The audio may be too long — please keep questions under 15 seconds and try again.')
            }
          } else {
            throw firstErr
          }
        }

        // verbose_json gives an object with .text and .segments[]
        const rawText = (transcription.text || '').trim()

        if (!rawText) {
          responded = true
          return res.json({ success: true, text: '' })
        }

        // ── Hallucination detection ───────────────────────────────────────────
        // Whisper hallucinates the prompt text when audio is unclear/noisy/silent.
        // If the transcription heavily overlaps with the prompt or starts with
        // known hallucination phrases, discard it silently.
        //
        // How to detect:
        //  1. Known starter phrases Whisper uses when hallucinating
        //  2. Word overlap ratio > 40% with the prompt text
        const textLower   = rawText.toLowerCase()
        const promptLower = whisperPrompt.toLowerCase()

        const HALLUCINATION_STARTERS = [
          'thank you for watching',
          'thank you for listening',
          'the candidate and interviewer',
          'the following is a transcript',
          'subscribe to',
          'please like and',
          'in this video',
          'thanks for watching',
          'technical job interview for',
        ]

        const starterMatch = HALLUCINATION_STARTERS.some(s => textLower.includes(s))

        // Word overlap — if >40% of transcription words came from the prompt, it's hallucinated
        const promptWords  = new Set(promptLower.split(/\W+/).filter(w => w.length > 4))
        const textWordArr  = textLower.split(/\W+/).filter(w => w.length > 4)
        const overlapCount = textWordArr.filter(w => promptWords.has(w)).length
        const overlapRatio = textWordArr.length > 0 ? overlapCount / textWordArr.length : 0
        const isHallucination = starterMatch || overlapRatio > 0.40

        if (isHallucination) {
          console.warn(`[Transcribe] 🚫 Hallucination detected (overlap: ${(overlapRatio*100).toFixed(0)}%, starter: ${starterMatch}) — discarding`)
          responded = true
          return res.json({ success: true, text: '' })
        }

        // ── Post-process: clean up common Whisper quirks ─────────────────
        const cleaned = rawText
          .replace(/\s+/g, ' ')                  // collapse multiple spaces
          .replace(/^\s*\[.*?\]\s*/g, '')         // remove [Music] [Applause] etc.
          .replace(/^\s*\(.*?\)\s*/g, '')         // remove (inaudible) etc.
          .trim()

        // ── Whisper confidence log (informational only) ───────────────────
        let avgLogprob = 0
        if (transcription.segments?.length) {
          avgLogprob = transcription.segments.reduce((s, seg) => s + (seg.avg_logprob || 0), 0) / transcription.segments.length
          console.log(`[Transcribe] Whisper: "${cleaned.substring(0, 70)}" | logprob: ${avgLogprob.toFixed(2)}`)
        }

        // Use Whisper result directly — no additional LLM correction call
        responded = true
        res.json({ success: true, text: cleaned, rawText: cleaned, corrected: false })

      } catch (err) {
        console.error('[Transcribe] Error:', err.message)
        if (!responded) {
          responded = true
          res.status(500).json({ error: 'Transcription failed.', details: err.message })
        }
      } finally {
        try { if (tempPath && fs.existsSync(tempPath)) fs.unlinkSync(tempPath) } catch {}
      }
    })

    writeStream.on('error', (err) => {
      console.error('[Transcribe] Write error:', err.message)
      if (!responded) { responded = true; res.status(500).json({ error: 'Failed to save audio: ' + err.message }) }
    })
  })

  bb.on('finish', () => {
    if (!responded && !fileReceived) {
      responded = true
      console.warn('[Transcribe] No file field in request.')
      res.status(400).json({ error: 'No audio file received. Field name must be "audio".' })
    }
  })

  bb.on('error', (err) => {
    console.error('[Transcribe] Busboy error:', err.message)
    if (!responded) { responded = true; res.status(500).json({ error: 'Upload failed: ' + err.message }) }
  })

  req.pipe(bb)
})

module.exports = router
