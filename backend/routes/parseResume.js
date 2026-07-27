const express  = require('express')
const router   = express.Router()
const busboy   = require('busboy')
// pdf-parse runs an internal self-test on require() that crashes in packaged Electron
// because the test PDF path no longer exists in resources/. Importing from lib/pdf.js
// bypasses the self-test while keeping full functionality.
const pdfParse = require('pdf-parse/lib/pdf-parse.js')

/**
 * POST /parse-resume
 *
 * Accepts a PDF file uploaded as multipart/form-data (field name: "resume").
 * Extracts all text from the PDF using pdf-parse and returns it as JSON.
 *
 * Limits:
 *   - File type: PDF only (validated by MIME type AND magic bytes)
 *   - File size: 10 MB max
 *
 * Returns:
 *   { success: true, text, pages, chars, filename }
 */
router.post('/', (req, res) => {
  // Reject non-multipart requests immediately
  const contentType = req.headers['content-type'] || ''
  if (!contentType.includes('multipart/form-data')) {
    return res.status(400).json({ error: 'Request must be multipart/form-data.' })
  }

  let responded = false

  const bb = busboy({
    headers: req.headers,
    limits:  {
      files:    1,                    // Accept exactly one file
      fileSize: 10 * 1024 * 1024     // 10 MB hard limit
    }
  })

  // ── Handle incoming file ──
  bb.on('file', (fieldname, fileStream, info) => {
    const { filename, mimeType } = info

    // MIME type validation — reject non-PDFs before reading any bytes
    if (mimeType !== 'application/pdf' && !filename?.toLowerCase().endsWith('.pdf')) {
      if (!responded) {
        responded = true
        res.status(400).json({ error: 'Only PDF files are accepted. Please upload a PDF resume.' })
      }
      fileStream.resume()  // Drain the stream to avoid hanging
      return
    }

    // Collect file bytes in memory
    const chunks = []
    let truncated = false

    fileStream.on('data', (chunk) => chunks.push(chunk))

    fileStream.on('limit', () => {
      truncated = true
      if (!responded) {
        responded = true
        res.status(400).json({ error: 'File too large. Maximum allowed size is 10 MB.' })
      }
    })

    fileStream.on('close', async () => {
      if (responded || truncated) return

      const fileBuffer = Buffer.concat(chunks)

      // Validate PDF magic bytes (%PDF-) — defence in depth
      if (!fileBuffer.slice(0, 5).toString('ascii').startsWith('%PDF')) {
        responded = true
        return res.status(400).json({ error: 'The uploaded file is not a valid PDF.' })
      }

      if (fileBuffer.length < 200) {
        responded = true
        return res.status(400).json({ error: 'The PDF appears to be empty or corrupted.' })
      }

      // ── Set responded=true BEFORE await to prevent race with bb.on('finish') ──
      // bb.on('finish') fires while pdfParse() is still running (async).
      // Without this, finish handler sends "No file received" while parse is in-flight.
      responded = true

      try {
        console.log(`[ParseResume] Parsing "${filename}" (${Math.round(fileBuffer.length / 1024)} KB)`)

        const data = await pdfParse(fileBuffer)

        // Normalise whitespace in extracted text
        const text = data.text
          .replace(/\r\n/g, '\n')
          .replace(/\r/g, '\n')
          .replace(/\n{4,}/g, '\n\n\n')
          .replace(/[ \t]{3,}/g, '  ')
          .trim()

        if (!text || text.length < 80) {
          return res.status(400).json({
            error: 'Could not extract readable text from this PDF. It may be a scanned image or password-protected. Please use the "Paste Text" option instead.'
          })
        }

        console.log(`[ParseResume] ✅ "${filename}" → ${text.length} chars, ${data.numpages} pages`)

        return res.json({
          success:  true,
          text,
          pages:    data.numpages,
          chars:    text.length,
          filename: filename || 'resume.pdf'
        })

      } catch (err) {
        console.error('[ParseResume] pdf-parse error:', err.message)
        res.status(500).json({
          error:   'Failed to read this PDF. Please use the "Paste Text" option and paste your resume manually.',
          details: err.message
        })
      }
    })
  })

  // ── Busboy errors ──
  bb.on('error', (err) => {
    console.error('[ParseResume] Busboy error:', err.message)
    if (!responded) {
      responded = true
      res.status(500).json({ error: 'File upload failed. Please try again.' })
    }
  })

  // ── All parts received ──
  bb.on('finish', () => {
    if (!responded) {
      // No file field was found in the form
      responded = true
      res.status(400).json({ error: 'No file received. Please select a PDF file and upload it.' })
    }
  })

  // Pipe request stream into busboy
  req.pipe(bb)
})

module.exports = router
