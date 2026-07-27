const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../src/components/setup-view.tsx');
let code = fs.readFileSync(file, 'utf8');

// 1. Add axios import
if (!code.includes('import axios')) {
  code = code.replace('import { useRef, useState } from "react"', 'import { useRef, useState } from "react"\nimport axios from "axios"');
}

// 2. Change UploadedResume type to include text
code = code.replace(
  'type UploadedResume = { name: string; size: string }',
  'type UploadedResume = { name: string; size: string; text: string }'
);

// 3. Add error and qaCount state
if (!code.includes('const [error, setError]')) {
  code = code.replace(
    'const [generating, setGenerating] = useState(false)',
    `const [generating, setGenerating] = useState(false)
  const [error, setError] = useState("")
  const [qaCount, setQaCount] = useState(0)`
  );
}

// 4. Update handleFiles to actually upload to backend
const oldHandleFiles = `  const handleFiles = (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    const kb = file.size / 1024
    setResume({
      name: file.name,
      size: kb > 1024 ? \`\${(kb / 1024).toFixed(1)} MB\` : \`\${Math.max(1, Math.round(kb))} KB\`,
    })
  }`;

const newHandleFiles = `  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file only.')
      return
    }
    const kb = file.size / 1024
    const sizeStr = kb > 1024 ? \`\${(kb / 1024).toFixed(1)} MB\` : \`\${Math.max(1, Math.round(kb))} KB\`
    
    setError("")
    setGenerating(true)
    try {
      const form = new FormData()
      form.append('resume', file)
      const { data } = await axios.post('http://localhost:3001/parse-resume', form, { timeout: 30000 })
      setResume({ name: file.name, size: sizeStr, text: data.text })
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to parse PDF.')
    } finally {
      setGenerating(false)
    }
  }`;

code = code.replace(oldHandleFiles, newHandleFiles);

// 5. Update runGenerate to use real backend SSE
const oldRunGenerate = `  const runGenerate = async () => {
    setGenerating(true)
    await new Promise((r) => setTimeout(r, 2400))
    setGenerating(false)
    onGenerated(GENERATED_QA)
  }`;

const newRunGenerate = `  const runGenerate = async () => {
    if (!resume?.text || !jd) {
      setError("Resume and JD are required")
      return
    }
    
    setGenerating(true)
    setError("")
    setQaCount(0)

    try {
      const response = await fetch('http://localhost:3001/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
        body:    JSON.stringify({ resume: resume.text, jd: jd, experienceYears: experience || 'auto' })
      })

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}))
        throw new Error(errJson.error || \`Server error: \${response.status}\`)
      }

      if (!response.body) throw new Error("No response body")
      const reader  = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer    = ''
      let qaArray: QAItem[]   = []
      let done      = false

      while (!done) {
        const { value, done: streamDone } = await reader.read()
        done = streamDone
        if (value) buffer += decoder.decode(value, { stream: true })

        const parts = buffer.split('\\n\\n')
        buffer = parts.pop() || ''

        for (const part of parts) {
          const eventLine = part.split('\\n').find((l: string) => l.startsWith('event:'))
          const dataLine  = part.split('\\n').find((l: string) => l.startsWith('data:'))
          if (!dataLine) continue

          const eventType = eventLine ? eventLine.replace('event:', '').trim() : 'message'
          const payload   = JSON.parse(dataLine.replace('data:', '').trim())

          if (eventType === 'batch') {
            qaArray = [...qaArray, ...payload.questions]
            setQaCount(qaArray.length)
          } else if (eventType === 'error') {
            throw new Error(payload.error)
          } else if (eventType === 'done') {
            qaArray = payload.data
            setQaCount(qaArray.length)
            done = true
          }
        }
      }

      if (!qaArray.length) throw new Error('No questions were generated.')
      localStorage.setItem('qaArray', JSON.stringify(qaArray))

      const embedRes = await axios.post('http://localhost:3001/embed', { qaArray })
      if (!embedRes.data.success) throw new Error('Indexing failed')

      onGenerated(qaArray)
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Something went wrong.')
    } finally {
      setGenerating(false)
    }
  }`;

code = code.replace(oldRunGenerate, newRunGenerate);

// 6. Display Error message
const reviewStepTarget = `{step === 3 && (
          <ReviewStep resume={resume} jd={jd} experience={experience} generating={generating} />
        )}`;
const reviewStepWithErr = `{step === 3 && (
          <ReviewStep resume={resume} jd={jd} experience={experience} generating={generating} qaCount={qaCount} />
        )}
        {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>}`;
code = code.replace(reviewStepTarget, reviewStepWithErr);

// 7. Pass qaCount to ReviewStep to show progress
code = code.replace(
  'function ReviewStep({',
  'function ReviewStep({\n  qaCount,'
);
code = code.replace(
  'generating: boolean\n}) {',
  'generating: boolean\n  qaCount?: number\n}) {'
);
code = code.replace(
  '<p className="text-sm font-medium text-foreground">Analyzing your profile…</p>',
  '<p className="text-sm font-medium text-foreground">{qaCount ? `Generated ${qaCount} questions...` : "Analyzing your profile…"}</p>'
);

fs.writeFileSync(file, code);
console.log("Successfully patched setup-view.tsx");
