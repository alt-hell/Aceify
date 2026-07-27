const express         = require('express')
const router          = require('express').Router()
const { AzureOpenAI } = require('openai')

const azure = new AzureOpenAI({
  apiKey:     process.env.AZURE_OPENAI_API_KEY,
  endpoint:   process.env.AZURE_OPENAI_ENDPOINT,
  apiVersion: process.env.API_VERSION,
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /coding/detect
// ─────────────────────────────────────────────────────────────────────────────
router.post('/detect', async (req, res) => {
  const { text } = req.body
  if (!text) return res.json({ isCoding: false })

  try {
    // Prompt asks Groq to decide if it is a coding task AND return the list of
    // technical keywords it sees (functions, classes, patterns, language names, etc.)
    const prompt = `You are an expert at classifying interview questions and identifying programming keywords.

Given the following interview utterance, answer ONLY with valid JSON containing two fields:
- "isCoding": true if the request requires writing actual code (function, program, pattern, script, query, etc.), otherwise false.
- "keywords": an array of distinct technical terms the request mentions (e.g. "python", "binary search", "diamond pattern", "SQL query", "hash map", "react component", etc.). If none, return an empty array.

Utterance: "${text}"`

    const response = await azure.chat.completions.create({
      model:       process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
      messages:    [{ role: 'user', content: prompt }],
      max_tokens:  100,
      temperature: 0.0,
    })

    const raw  = response.choices[0].message.content.trim()
    const clean = raw.replace(/```json|```/g, '').trim()
    const json = JSON.parse(clean)
    console.log(`[Coding/Detect] "${text.substring(0, 60)}" → isCoding: ${json.isCoding}, keywords: ${json.keywords.join(', ')}`)
    res.json({ isCoding: !!json.isCoding, keywords: json.keywords })

  } catch (err) {
    console.warn('[Coding/Detect] Groq failed, using fallback heuristic:', err.message)
    const lower = text.toLowerCase()
    const isCoding = /write|implement|code|function|algorithm|program|solve|pattern|pyramid|diamond|print|sql query|regex|class|module|script|generate|build|create|construct/.test(lower)
    // Simple keyword extraction for the fallback case
    const extractKeywordsFallback = (txt) => {
      const known = [
        'python', 'javascript', 'typescript', 'java', 'c++', 'cpp', 'go', 'rust',
        'sql', 'regex', 'hash map', 'binary search', 'linked list', 'tree', 'graph',
        'dynamic programming', 'diamond pattern', 'pyramid pattern', 'loop', 'array',
        'string', 'function', 'class', 'module', 'script', 'api', 'rest', 'graphql',
        'react component', 'vue component', 'angular component', 'fastapi', 'flask',
        'django', 'node', 'express', 'lambda', 'aws', 'azure', 'gcp', 'kafka', 'redis',
        'docker', 'kubernetes',
      ]
      const found = []
      for (const term of known) {
        const pattern = new RegExp('\\b' + term.replace(/\+/g, '\\+') + '\\b', 'i')
        if (pattern.test(txt)) found.push(term)
      }
      return found
    }
    const keywords = extractKeywordsFallback(lower)
    res.json({ isCoding, keywords })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /coding
//
// KEY DESIGN DECISION — why we DON'T use JSON for the response:
//
// JSON.parse() crashes on "bad control characters" — literal \n, \t, \x00
// inside strings. When Groq returns Python/JS code inside a JSON string,
// those characters break the parser (exactly the error we saw with the
// diamond pattern: position 733, line 8).
//
// Fix: Use a DELIMITER FORMAT — plain text with unique markers. Completely
// immune to any characters inside the code. Parsed with string splitting.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { question, preferredLanguage } = req.body

  if (!question) {
    return res.status(400).json({ error: 'Question is required' })
  }

  const langHint = preferredLanguage || detectLanguageFromQuestion(question)

  // ── Delimiter-based prompt — NO JSON, no escaping problems ───────────────
  // Each section is wrapped in unique markers so we can split reliably.
  // The model never has to worry about escaping code — it just writes it.
  const prompt = `You are a senior software engineer helping a candidate in a LIVE coding interview.

The interviewer asked: "${question}"
${langHint !== 'auto' ? `Use: ${langHint}` : 'Choose the most appropriate language (prefer Python unless specified).'}

Produce a COMPLETE, CORRECT solution. Format your response using EXACTLY these markers:

##SPOKEN##
What the candidate says out loud while thinking (2-3 sentences, natural and confident).
Example: "Right, so for a diamond pattern, I'll use two loops — one for the upper half and one for the lower half, controlling spaces and stars based on the row index."

##APPROACH##
- bullet 1: key insight or data structure choice
- bullet 2: how the algorithm works
- bullet 3: edge case handling

##LANGUAGE##
python

##ALGORITHM##
Name of pattern/algorithm used (e.g. "Nested Loops", "Hash Map", "Sliding Window")

##TIME##
O(n)

##SPACE##
O(1)

##CODE##
Write ONLY the RAW, RUNNABLE code here.
DO NOT use markdown formatting.
DO NOT use code blocks or backticks (e.g. \`\`\`python).
DO NOT include any conversational text or explanations. 
Just write the raw code as it would appear in a standard text editor.
Include comments on non-obvious logic.
Include example usage at the bottom as a comment.

##END##`

  try {
    const response = await azure.chat.completions.create({
      model:       process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
      messages:    [{ role: 'user', content: prompt }],
      max_tokens:  2000,
      temperature: 0.1,
    })

    const raw = response.choices[0].message.content.trim()

    // ── Parse delimiter sections — robust to any content inside ──────────────
    function extractSection(text, marker, nextMarker) {
      const start = text.indexOf(`##${marker}##`)
      if (start === -1) return ''
      const contentStart = start + `##${marker}##`.length
      const end = nextMarker ? text.indexOf(`##${nextMarker}##`, contentStart) : text.length
      return (end === -1 ? text.slice(contentStart) : text.slice(contentStart, end)).trim()
    }

    const spokenIntro    = extractSection(raw, 'SPOKEN',    'APPROACH')
    const approachRaw    = extractSection(raw, 'APPROACH',  'LANGUAGE')
    const language       = extractSection(raw, 'LANGUAGE',  'ALGORITHM').toLowerCase().trim() || langHint || 'python'
    const algorithmName  = extractSection(raw, 'ALGORITHM', 'TIME')
    const timeComplexity = extractSection(raw, 'TIME',      'SPACE')
    const spaceComplexity= extractSection(raw, 'SPACE',     'CODE')
    let code             = extractSection(raw, 'CODE',      'END')

    // Fallback: forcefully strip any markdown backticks the model might have stubbornly included
    code = code.replace(/^```[a-zA-Z]*\n?/g, '').replace(/```$/g, '').trim()

    // Parse approach bullets
    const approach = approachRaw
      .split('\n')
      .map(l => l.replace(/^[-•*]\s*/, '').replace(/^bullet\s*\d+:\s*/i, '').trim())
      .filter(l => l.length > 5)

    if (!code) {
      throw new Error('Model did not return code section — try again')
    }

    // ── Build answer text ──────────────────────────────────────────────────
    const approachText = approach.length > 0
      ? '\n\nApproach:\n' + approach.map(b => `- ${b}`).join('\n')
      : ''

    const metaParts = []
    if (algorithmName)   metaParts.push(`📌 ${algorithmName}`)
    if (timeComplexity)  metaParts.push(`⏱ Time: ${timeComplexity}`)
    if (spaceComplexity) metaParts.push(`💾 Space: ${spaceComplexity}`)
    const metaText = metaParts.length > 0 ? '\n\n' + metaParts.join('  •  ') : ''

    const fullAnswer = spokenIntro + approachText + metaText

    console.log(`[Coding] ✅ "${question.substring(0, 50)}" | ${language} | ${timeComplexity}`)

    res.json({
      success: true,
      data: {
        answer:          fullAnswer,
        code:            code.trim(),
        codeLanguage:    language,
        algorithmName,
        timeComplexity,
        spaceComplexity,
        approach,
        question,
        confidence:      95,
        isCode:          true,
        fromGroq:        true,
        isCodingRound:   true,
        category:        'Coding',
      }
    })

  } catch (err) {
    console.error('[Coding] Error:', err.message)
    res.status(500).json({ error: 'Coding engine failed', details: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
function detectLanguageFromQuestion(question) {
  const q = question.toLowerCase()
  if (/\bin python\b|\busing python\b|\bwith python\b/.test(q))     return 'python'
  if (/\bin javascript\b|\busing javascript\b|\bin js\b/.test(q))   return 'javascript'
  if (/\bin typescript\b|\busing typescript\b|\bin ts\b/.test(q))   return 'typescript'
  if (/\bin java\b|\busing java\b/.test(q))                         return 'java'
  if (/\bin c\+\+\b|\busing c\+\+\b|\bcpp\b/.test(q))              return 'cpp'
  if (/\bin sql\b|\bsql query\b|\bwrite.*sql\b/.test(q))            return 'sql'
  if (/\bin go\b|\busing golang\b/.test(q))                         return 'go'
  return 'auto'
}

module.exports = router
