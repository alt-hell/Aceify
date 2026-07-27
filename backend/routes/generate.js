const express = require('express')
const router  = express.Router()
const { AzureOpenAI } = require('openai')

const azure = new AzureOpenAI({
  apiKey:     process.env.AZURE_OPENAI_API_KEY,
  endpoint:   process.env.AZURE_OPENAI_ENDPOINT,
  apiVersion: process.env.API_VERSION,
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT
})

// ─────────────────────────────────────────────────────────────────────────────
// PARSE RESPONSE — extract JSON array from model output robustly
// ─────────────────────────────────────────────────────────────────────────────
function parseToArray(text) {
  const clean = text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim()

  // Try 1: direct parse
  try {
    const r = JSON.parse(clean)
    if (Array.isArray(r)) return r
    const key = Object.keys(r).find(k => Array.isArray(r[k]))
    if (key) return r[key]
  } catch {}

  // Try 2: extract array from string
  try {
    const start = clean.indexOf('[')
    const end   = clean.lastIndexOf(']')
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(clean.substring(start, end + 1))
    }
  } catch {}

  // Try 3: rescue partial JSON — find all complete objects
  try {
    const objects = []
    const regex = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)?\}/g
    let match
    while ((match = regex.exec(clean)) !== null) {
      try { objects.push(JSON.parse(match[0])) } catch {}
    }
    if (objects.length > 0) {
      console.warn(`[Parse] Rescued ${objects.length} objects from partial JSON`)
      return objects
    }
  } catch {}

  throw new Error('Could not parse model response as JSON array')
}

// ─────────────────────────────────────────────────────────────────────────────
// CALL AI — Azure primary, Groq fallback
// ─────────────────────────────────────────────────────────────────────────────
async function callAI(prompt, batchLabel) {
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT

  // Try Azure
  try {
    console.log(`[Generate] ${batchLabel} → Azure ${deployment}...`)
    const resp = await azure.chat.completions.create({
      model:       deployment,
      messages:    [
        {
          role: 'system',
          content: 'You are an expert interview coach. You ONLY output valid JSON arrays. Never output markdown wrappers. Only output a raw JSON array starting with [ and ending with ]. CRITICAL: Every answer MUST be at least 150 words. For technical answers, you MAY use bullet points ("- item") and inline code with backticks. For code examples, use fenced blocks (```python ... ```) with 3-6 lines max, correct working code only.'
        },
        { role: 'user', content: prompt }
      ],
      max_tokens:  8000,
      temperature: 0.70
    })

    const raw = resp.choices[0].message.content.trim()
    const arr = parseToArray(raw)
    console.log(`[Generate] ${batchLabel} ✅ Azure — ${arr.length} questions`)
    return arr

  } catch (azureErr) {
    console.warn(`[Generate] ${batchLabel} Azure failed: ${azureErr.message}`)

    // Groq fallback
    try {
      console.log(`[Generate] ${batchLabel} → Groq fallback...`)
      const resp = await groq.chat.completions.create({
        model:    process.env.GROQ_LLAMA_MODEL || 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are an expert interview coach. You ONLY output valid JSON arrays. Never output markdown wrappers. Only output a raw JSON array starting with [ and ending with ]. CRITICAL: Every answer MUST be at least 150 words. For technical answers, you MAY use bullet points ("- item") and inline code with backticks. For code examples, use fenced blocks (```python ... ```) with 3-6 lines max, correct working code only.'
          },
          { role: 'user', content: prompt }
        ],
        max_tokens:  8000,
        temperature: 0.70
      })

      const raw = resp.choices[0].message.content.trim()
      const arr = parseToArray(raw)
      console.log(`[Generate] ${batchLabel} ✅ Groq — ${arr.length} questions`)
      return arr

    } catch (groqErr) {
      console.error(`[Generate] ${batchLabel} ❌ Both failed. Azure: ${azureErr.message} | Groq: ${groqErr.message}`)
      throw new Error(`Batch ${batchLabel} failed: ${azureErr.message}`)
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED RULES — injected into every batch prompt
// ─────────────────────────────────────────────────────────────────────────────
const RULES = `
===========================================================================
YOU ARE A SENIOR TECHNICAL INTERVIEWER with 12+ years of hiring experience.
Think and write EXACTLY like a real human interviewer.
===========================================================================

QUESTION LENGTH RULE:
  Maximum 15 words per question. Real interviewers speak in SHORT sentences.
  BAD: "Can you explain how you implemented the retrieval-augmented generation pipeline in your previous projects?"
  GOOD: "Walk me through how RAG works. What does the retrieval step actually do?"

NEVER say "in your projects" or "in your work" (vague/generic).
When referencing resume experience, ALWAYS name the specific company or project.

⚠️  EXPERIENCE LEVEL OVERRIDE: The EXPERIENCE LEVEL section above defines what question types are BANNED
and REQUIRED. Those rules OVERRIDE everything else. Read them carefully before generating every question.

ANSWER RULES:
1. SPOKEN ENGLISH ONLY. Real person talking, highly detailed explanations.
2. ULTRA-SPECIFIC: real company names, real project names, real tech, real numbers.
   If resume lacks exact numbers, use realistic approximates ("around 87% accuracy", "under 200ms").
   NEVER a generic answer that could apply to any candidate.
3. NATURAL OPENERS (rotate — never repeat same opener):
   "So the way we built it...", "Honestly...", "Yeah so at [company]...",
   "The thing is...", "I'll be real with you...", "Looking back...",
   "From what I saw there...", "To give you the full details..."
4. SHOW IMPERFECTION: "which honestly took us longer than expected",
   "the first version actually failed in production",
   "if I'm being real, I'd approach it differently now"
5. LENGTH: AT LEAST 150 words per answer. Explain the "Why" and "How" deeply. Complete sentences. Never cut mid-thought.
6. STRUCTURE: Use clear paragraph breaks. For technical answers, you MAY use bullet points for mechanism lists.
   Use backtick inline code (e.g. \`torch.nn.Module\`, \`df.groupby()\`) for specific API or function names.
   If code is absolutely necessary to illustrate a point, use a fenced block: \`\`\`python ... \`\`\`
   Keep code blocks to 3-6 lines max, and ONLY include code you are 100% sure is correct.
7. BANNED in any answer:
   "Certainly!" / "Absolutely!" / "Great question!" / "Of course!" / "As an AI"
   "As a [job title]..." / "I have X years of experience..."
   "In conclusion" / "To summarize"
8. PROJECT QUESTIONS: For any question about a specific project, MUST extract and use the exact Project
   Headline from the resume. Base the entire answer on the bullet points under that headline.
   Answer MUST be AT LEAST 180 words for project questions.
9. EVERY ANSWER IS UNIQUE — different opener, different structure every time.
`

// ─────────────────────────────────────────────────────────────────────────────
// EXPERIENCE TIER CONTEXT — injected based on years of experience required
// ─────────────────────────────────────────────────────────────────────────────
function experienceContext(yrs) {
  const y = parseInt(yrs) || 3

  if (!yrs || yrs === 'auto') return `
EXPERIENCE LEVEL: Auto-detect from resume
Read both the JD and the resume to determine the appropriate experience level, then apply the matching rules below.
- 0-2 years → foundational concepts only
- 3-5 years → production experience, trade-offs, real decisions — NO "What is X?" questions
- 6-8 years → architecture, scale, failure postmortems — NO basic conceptual questions at all
- 9+ years  → systems thinking, org-wide impact — only hard architecture and leadership questions
`

  if (y <= 2) return `
EXPERIENCE LEVEL: JUNIOR (0–2 years)
✅ ALLOWED: "What is X?", "How does X work?", "Difference between X and Y?", "How would you build a basic X?"
❌ BANNED: Questions about distributed systems, scale, architecture decisions, team leadership, production failures at scale
DEPTH: Can they explain what the technology IS and what they've built with it? Focus on fundamentals.
`

  if (y <= 5) return `
EXPERIENCE LEVEL: MID-LEVEL (${y} years experience)

❌ BANNED — DO NOT GENERATE THESE (they are junior-level):
  - "What is X?" — a ${y}-year engineer already knows all definitions
  - "What are the types of X?" — too basic
  - "Define X" or "Explain what X means" — too junior
  - Any question answerable by a first-year developer from a textbook

✅ REQUIRED question types for ${y} years:
  - "How would you debug X when [specific symptom] appears in production?"
  - "What trade-off did you make choosing X over Y for [specific constraint]?"
  - "Walk me through designing X from scratch given [real constraint]."
  - "What breaks first when X scales to 10x load — and how would you fix it?"
  - "What specific optimization did you apply to X, and what was the measured outcome?"
  - "Why would you pick X over Y in [specific scenario]? Give a real, practical reason."
  - "What would you instrument to monitor X in production — what metrics matter most?"
  - "What's the hardest bug you debugged in X — what did it turn out to be?"
  - "If you rebuilt [specific thing] today, what would you do fundamentally differently?"

DEPTH: Assume they know ALL definitions. Test REAL production experience — real numbers, real failures, real trade-offs. Every question should be impossible to answer well without actual hands-on work.
`

  if (y <= 8) return `
EXPERIENCE LEVEL: SENIOR (${y} years experience)

❌ BANNED — DO NOT GENERATE:
  - "What is X?" — completely inappropriate for ${y} years
  - "How does X work?" as a standalone question — too introductory
  - Any question answerable by someone with 1-2 years of experience
  - Questions without a real scale, production, or architecture context

✅ REQUIRED question types for ${y} years:
  - "Design a system for X at Y scale. Walk me through your architecture and why."
  - "You inherit a monolithic X. How do you migrate it to Y with zero downtime?"
  - "What failure have you personally led the recovery from? What systemic change came after?"
  - "How do you decide when technical debt MUST be paid down immediately vs. tolerated?"
  - "What's your framework for build vs buy for a new system component?"
  - "P99 latency spikes under load — walk me through your investigation process."
  - "How would you design X to be fully observable — metrics, traces, and alert thresholds?"
  - "What's the hardest architecture decision you've made that you'd approach differently now?"
  - "How do you mentor junior engineers on [complex topic] without just giving them the answer?"

DEPTH: Expert-level assumed. Test systems thinking, architectural judgment, and real lessons from production failures and hard decisions.
`

  return `
EXPERIENCE LEVEL: STAFF / PRINCIPAL (${y}+ years)

❌ BANNED: Any basic, conceptual, or definitional question — completely inappropriate at this level.

✅ REQUIRED:
  - "How do you drive technical standards and code quality across an entire engineering org?"
  - "What's your framework for making irreversible technology bets with high uncertainty?"
  - "Walk me through a system you designed that needed to scale 100x beyond initial estimates."
  - "How have you navigated a situation where the correct technical decision was deeply unpopular?"
  - "How do you balance technical debt reduction against feature velocity at the organisation level?"
  - "What's the highest-impact technical mistake you've made at scale, and what changed because of it?"
  - "How do you evaluate whether a technical platform is worth building internally vs. adopting externally?"

DEPTH: Technical strategy, org-wide impact, navigating ambiguity, making hard calls with incomplete information.
`
}

// ─────────────────────────────────────────────────────────────────────────────
// BATCH 1 — Background(1) + Technical(19) — IDs 1-20
// Technical split:  16 PURE CONCEPTUAL  +  3 PROJECT-ANCHORED
// ─────────────────────────────────────────────────────────────────────────────
function batch1Prompt(resume, jd, yrs) {
  return `${RULES}
${experienceContext(yrs)}

TASK: Generate EXACTLY 20 interview Q&A pairs as a JSON array. IDs 1-20.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUESTION 1 — "Tell me about yourself."
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Natural spoken 2-minute answer. MANDATORY steps:
  STEP 1 — NAME:       "So, my name is [Full Name], let me walk you through..."
  STEP 2 — EDUCATION:  Degree + institution + field + year + why they chose this path
  STEP 3 — EXPERIENCE: Every role chronologically. Company + title + 1 key achievement each.
  STEP 4 — RECENT PROJECT: Most JD-relevant project from most recent job. Real name, tech, metric.
  STEP 5 — LONG-TERM GOAL: 3-5 year goal that connects directly to this JD role.
Length: 8-12 sentences. Confident spoken English. Zero markdown.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUESTIONS 2-20 — Technical (19 questions)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BEFORE GENERATING: Read the JD and extract EVERY technology, framework, and tool listed.
Prioritise those JD technologies for the conceptual questions below.

━━━ BLOCK A — TECHNICAL QUESTIONS (Q2 to Q17, exactly 16 questions) ━━━━━━━━━━━━
RULE: These 16 questions MUST NOT reference any specific project or company from the resume.
They test understanding of the JD TECHNOLOGIES — but at the depth appropriate for the EXPERIENCE LEVEL above.

⚠️  CRITICAL: The question types you use MUST match the experience level defined at the top.
    - If JUNIOR: use "What is X?", "How does X work?", "Difference between X and Y?"
    - If MID-LEVEL: use production debugging, trade-off, optimization questions — NO "What is X?"
    - If SENIOR: use architecture design, system migration, failure recovery, scaling questions ONLY

BEFORE GENERATING Q2-Q17:
  1. Extract ALL technologies, frameworks, and tools mentioned in the JD
  2. Identify which 16 JD technologies you will cover (no repeats)
  3. For each, write a question at the correct experience depth per the rules above
  4. Vary the question angles: some about debugging, some about trade-offs, some about design decisions, some about production behaviour — DO NOT repeat the same question format more than 3 times

━━━ BLOCK B — PROJECT ANCHORED (Q18, Q19, Q20, exactly 3 questions) ━━━━━━━━
RULE: These 3 questions MUST reference specific projects or companies from the resume.
Each must demand a specific number, a failure, or a hard lesson learned.
  Q18: Ask for a SPECIFIC METRIC (accuracy %, latency, FPS, users, dataset size) from a named project.
  Q19: Ask what BROKE or FAILED in a specific project. What was their response?
  Q20: Ask what they would DO DIFFERENTLY if rebuilding a named project from scratch today.

OUTPUT: Return ONLY this raw JSON array — no markdown, no explanation:
[
  { "id": 1,  "category": "Background", "question": "Tell me about yourself.", "answer": "[AT LEAST 120 words highly detailed spoken answer following 5-step structure]", "isCode": false },
  { "id": 2,  "category": "Technical",  "question": "[experience-appropriate question about JD tech]", "answer": "[AT LEAST 120 words highly detailed spoken answer, specific to this resume/JD]", "isCode": false },
  { "id": 3,  "category": "Technical",  "question": "[experience-appropriate question about different JD tech]", "answer": "[AT LEAST 120 words]", "isCode": false },
  { "id": 4,  "category": "Technical",  "question": "[experience-appropriate question about different JD tech]", "answer": "[AT LEAST 120 words]", "isCode": false },
  { "id": 5,  "category": "Technical",  "question": "[experience-appropriate question about different JD tech]", "answer": "[AT LEAST 120 words]", "isCode": false },
  { "id": 6,  "category": "Technical",  "question": "[experience-appropriate question about different JD tech]", "answer": "[AT LEAST 120 words]", "isCode": false },
  { "id": 7,  "category": "Technical",  "question": "[experience-appropriate question about different JD tech]", "answer": "[AT LEAST 120 words]", "isCode": false },
  { "id": 8,  "category": "Technical",  "question": "[experience-appropriate question about different JD tech]", "answer": "[AT LEAST 120 words]", "isCode": false },
  { "id": 9,  "category": "Technical",  "question": "[experience-appropriate question about different JD tech]", "answer": "[AT LEAST 120 words]", "isCode": false },
  { "id": 10, "category": "Technical",  "question": "[experience-appropriate question about different JD tech]", "answer": "[AT LEAST 120 words]", "isCode": false },
  { "id": 11, "category": "Technical",  "question": "[experience-appropriate question about different JD tech]", "answer": "[AT LEAST 120 words]", "isCode": false },
  { "id": 12, "category": "Technical",  "question": "[experience-appropriate question about different JD tech]", "answer": "[AT LEAST 120 words]", "isCode": false },
  { "id": 13, "category": "Technical",  "question": "[experience-appropriate question about different JD tech]", "answer": "[AT LEAST 120 words]", "isCode": false },
  { "id": 14, "category": "Technical",  "question": "[experience-appropriate question about different JD tech]", "answer": "[AT LEAST 120 words]", "isCode": false },
  { "id": 15, "category": "Technical",  "question": "[experience-appropriate question about different JD tech]", "answer": "[AT LEAST 120 words]", "isCode": false },
  { "id": 16, "category": "Technical",  "question": "[experience-appropriate question about different JD tech]", "answer": "[AT LEAST 120 words]", "isCode": false },
  { "id": 17, "category": "Technical",  "question": "[experience-appropriate question about different JD tech]", "answer": "[AT LEAST 120 words]", "isCode": false },
  { "id": 18, "category": "Technical",  "question": "[specific metric question referencing named project from resume]", "answer": "[AT LEAST 120 words highly detailed spoken answer]", "isCode": false },
  { "id": 19, "category": "Technical",  "question": "[what broke/failed in specific named project from resume]", "answer": "[AT LEAST 120 words highly detailed spoken answer]", "isCode": false },
  { "id": 20, "category": "Technical",  "question": "[what would you redo in specific named project from resume]", "answer": "[AT LEAST 120 words highly detailed spoken answer]", "isCode": false }
]

Replace ALL bracketed labels with REAL questions. IDs 1-20. Generate ALL 20.

RESUME:
${resume}

JOB DESCRIPTION:
${jd}`
}

// ─────────────────────────────────────────────────────────────────────────────
// BATCH 2 — Technical(20) — IDs 21-40
// Technical split:  14 PURE CONCEPTUAL  +  6 PROJECT-ANCHORED
// ─────────────────────────────────────────────────────────────────────────────
function batch2Prompt(resume, jd, prevQuestions, yrs) {
  return `${RULES}
${experienceContext(yrs)}

TASK: Generate EXACTLY 20 TECHNICAL Q&A pairs as a JSON array. IDs 21-40.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DO NOT REPEAT — CHECK BEFORE EACH QUESTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Already asked questions — generate ZERO similar questions to any of these:
${prevQuestions}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BEFORE GENERATING: Identify JD technologies NOT covered in the previous batch.
Prioritise those uncovered JD technologies for the conceptual block below.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━ BLOCK A — TECHNICAL QUESTIONS (Q21 to Q34, exactly 14 questions) ━━━━━━━━━━━━
RULE: Questions 21-34 MUST NOT reference any specific project or company.
They test JD technologies at the depth required for the EXPERIENCE LEVEL defined above.

⚠️  CRITICAL: Follow the EXPERIENCE LEVEL question-type rules exactly.
    - JUNIOR: "What is X?", "How does X work?", comparison questions — OK
    - MID-LEVEL: Production debugging, trade-off, optimization — NO "What is X?"
    - SENIOR: Architecture design, failure recovery, scale migration ONLY

BEFORE GENERATING Q21-Q34:
  1. Identify JD technologies NOT yet covered in the previous batch
  2. Prioritise those uncovered technologies
  3. Write 14 questions at the correct experience depth
  4. Vary question angles — NO single format used more than 3 times

━━━ BLOCK B — PROJECT ANCHORED (Q35 to Q40, exactly 6 questions) ━━━━━━━━━━
RULE: These 6 questions MUST reference specific projects/companies from the resume.
Vary the style — no two questions should follow the same format.

Mix these styles (use each style at most once):
  METRIC DEMAND: "[Project/Company] — what was the [accuracy/latency/FPS/users]?"
  FAILURE PROBE: "What was the hardest failure at [Company]? How did you recover?"
  DECISION CHALLENGE: "At [Company], why did you choose [tech] over [alternative]?"
  SCALE QUESTION: "If [Project] needed to handle 50x the load, what breaks first?"
  CONTRIBUTION: "In [Project], what was your specific technical contribution?"
  HONEST CHECK: "What's the part of [Project] you're least proud of technically?"

OUTPUT: Return ONLY this raw JSON array:
[
  { "id": 21, "category": "Technical", "question": "[experience-appropriate question — JD tech not yet covered]", "answer": "[AT LEAST 120 words highly detailed spoken answer]", "isCode": false },
  { "id": 22, "category": "Technical", "question": "[experience-appropriate question — different JD tech]", "answer": "[AT LEAST 120 words]", "isCode": false },
  { "id": 23, "category": "Technical", "question": "[experience-appropriate question — different JD tech]", "answer": "[AT LEAST 120 words]", "isCode": false },
  { "id": 24, "category": "Technical", "question": "[experience-appropriate question — different JD tech]", "answer": "[AT LEAST 120 words]", "isCode": false },
  { "id": 25, "category": "Technical", "question": "[experience-appropriate question — different JD tech]", "answer": "[AT LEAST 120 words]", "isCode": false },
  { "id": 26, "category": "Technical", "question": "[experience-appropriate question — different JD tech]", "answer": "[AT LEAST 120 words]", "isCode": false },
  { "id": 27, "category": "Technical", "question": "[experience-appropriate question — different JD tech]", "answer": "[AT LEAST 120 words]", "isCode": false },
  { "id": 28, "category": "Technical", "question": "[experience-appropriate question — different JD tech]", "answer": "[AT LEAST 120 words]", "isCode": false },
  { "id": 29, "category": "Technical", "question": "[experience-appropriate question — different JD tech]", "answer": "[AT LEAST 120 words]", "isCode": false },
  { "id": 30, "category": "Technical", "question": "[experience-appropriate question — different JD tech]", "answer": "[AT LEAST 120 words]", "isCode": false },
  { "id": 31, "category": "Technical", "question": "[experience-appropriate question — different JD tech]", "answer": "[AT LEAST 120 words]", "isCode": false },
  { "id": 32, "category": "Technical", "question": "[experience-appropriate question — different JD tech]", "answer": "[AT LEAST 120 words]", "isCode": false },
  { "id": 33, "category": "Technical", "question": "[experience-appropriate question — different JD tech]", "answer": "[AT LEAST 120 words]", "isCode": false },
  { "id": 34, "category": "Technical", "question": "[experience-appropriate question — different JD tech]", "answer": "[AT LEAST 120 words]", "isCode": false },
  { "id": 35, "category": "Technical", "question": "[METRIC DEMAND — specific named project from resume]", "answer": "[AT LEAST 150 words highly detailed spoken answer based on resume project]", "isCode": false },
  { "id": 36, "category": "Technical", "question": "[FAILURE PROBE — specific company from resume]", "answer": "[AT LEAST 150 words highly detailed spoken answer based on resume project]", "isCode": false },
  { "id": 37, "category": "Technical", "question": "[DECISION CHALLENGE — specific project + tech choice from resume]", "answer": "[AT LEAST 150 words highly detailed spoken answer based on resume project]", "isCode": false },
  { "id": 38, "category": "Technical", "question": "[SCALE QUESTION — specific project from resume]", "answer": "[AT LEAST 150 words highly detailed spoken answer based on resume project]", "isCode": false },
  { "id": 39, "category": "Technical", "question": "[CONTRIBUTION — specific project from resume]", "answer": "[AT LEAST 150 words highly detailed spoken answer based on resume project]", "isCode": false },
  { "id": 40, "category": "Technical", "question": "[HONEST CHECK — specific project from resume]", "answer": "[AT LEAST 150 words highly detailed spoken answer based on resume project]", "isCode": false }
]

Replace ALL bracketed labels with REAL questions. IDs 21-40. Generate ALL 20.

RESUME:
${resume}

JOB DESCRIPTION:
${jd}`
}

// ─────────────────────────────────────────────────────────────────────────────
// BATCH 3 — Technical(11) + Project(9) — IDs 41-60
// Technical split:  8 PURE CONCEPTUAL  +  3 PROJECT-ANCHORED
// ─────────────────────────────────────────────────────────────────────────────
function batch3Prompt(resume, jd, prevQuestions, yrs) {
  return `${RULES}
${experienceContext(yrs)}

TASK: Generate EXACTLY 20 Q&A pairs as a JSON array. IDs 41-60.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DO NOT REPEAT — CHECK BEFORE EACH QUESTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${prevQuestions}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUESTIONS 41-51 — Advanced Technical (11 questions)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FIRST: Find JD technologies not yet covered in the previous 40 questions. Cover them.
SECOND: Use harder, more advanced versions of question types.

━━━ BLOCK A — ADVANCED TECHNICAL (Q41 to Q48, exactly 8 questions) ━━━━━━━━
Questions 41-48 MUST NOT reference specific projects. Focus on JD technologies not yet covered.

⚠️  CRITICAL: Apply the EXPERIENCE LEVEL rules. For MID-LEVEL (3-5 yrs): NO "What is X?" questions.
For SENIOR (6-8 yrs): Only architecture, migration, failure, scale, and observability questions.

Generate 8 questions using these harder angles (pick angles matching experience level):
  - "How would you handle [specific edge case] in [JD tech] at production scale?"
  - "What breaks first in [JD tech] under [specific load condition] — and how do you fix it?"
  - "Walk me through designing [JD feature] for [specific constraint]."
  - "What would you instrument to monitor [JD tech] in production?"
  - "What's the hardest production failure caused by [JD tech]? How do you prevent it?"
  - "Why would [JD tech A] outperform [JD tech B] specifically under [these constraints]?"
  - "How do you migrate from [X] to [Y] without downtime?"
  - "What trade-off did the creators of [JD tech] accept, and when does it hurt you?"

━━━ BLOCK B — PROJECT ANCHORED (Q49, Q50, Q51, exactly 3 questions) ━━━━━━━━
Most recent company/project. Each must be a DIFFERENT style from each other
and from all previous project questions.
  Q49: Ask about the ARCHITECTURE decision — why they built it the way they did.
  Q50: Ask what ADVANCED FEATURE they'd add if they had 3 more months on the project.
  Q51: Ask about the BIGGEST TECHNICAL RISK they took in a specific project.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUESTIONS 52-60 — Project Deep Dives (9 questions)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Read EVERY project from the resume. Cover as many different projects as possible.
Use a DIFFERENT STYLE for each question — no two questions follow the same format.

Rotate through these 9 styles (use each exactly once):
  A. Architecture walkthrough:  "Walk me through [PROJECT]. Architecture first, then the hardest part."
  B. Business impact:           "What was the actual business impact of [PROJECT]? Give me numbers."
  C. Failure analysis:          "What broke first in [PROJECT] when it hit real users?"
  D. Rebuild from scratch:      "If you rebuilt [PROJECT] today, what would you change fundamentally?"
  E. Personal contribution:     "What was YOUR specific technical contribution to [PROJECT] vs the team?"
  F. Impressive decision:       "What's the most technically impressive design choice in [PROJECT]?"
  G. JD connection:             "How does [PROJECT] connect to what this specific JD role needs?"
  H. Hardest decision:          "What was the hardest technical trade-off you made in [PROJECT]?"
  I. Career lesson:             "What did [PROJECT] teach you that no other project could have?"

Use REAL project names from the resume. NEVER use "[PROJECT]" literally in output.
Answers must give specific tech, specific challenges, specific outcomes.

OUTPUT: Return ONLY this raw JSON array. IDs 41-60. Generate ALL 20.
[
  { "id": 41, "category": "Technical", "question": "...", "answer": "[AT LEAST 100 to 120 words highly detailed spoken answer]", "isCode": false },
  ...
  { "id": 52, "category": "Project",   "question": "...", "answer": "[AT LEAST 150 to 200 words highly detailed spoken answer based entirely on the resume project headline]", "isCode": false },
  ...
  { "id": 60, "category": "Project",   "question": "...", "answer": "[AT LEAST 150 to 200 words highly detailed spoken answer based entirely on the resume project headline]", "isCode": false }
]

RESUME:
${resume}

JOB DESCRIPTION:
${jd}`
}

// ─────────────────────────────────────────────────────────────────────────────
// BATCH 4 — Behavioral(9) + JD-Specific(5) + HR(5) + Real-talk(1) — IDs 61-80
// ─────────────────────────────────────────────────────────────────────────────
function batch4Prompt(resume, jd, prevQuestions, yrs) {
  return `${RULES}
${experienceContext(yrs)}

TASK: Generate EXACTLY 20 Q&A pairs as a JSON array. IDs 61-80.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DO NOT REPEAT: ${prevQuestions.slice(0, 800)}...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━ QUESTIONS 61-69 — Behavioral (9 questions) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Short questions. Real stories in answers. Reference real companies from resume.
Answers sound like a real conversation — STAR structure but NEVER say "Situation, Task, Action, Result".

Generate EXACTLY these 9 questions (one for each scenario):
  61. A project or feature that genuinely failed. What happened, what was their role?
  62. A time they pushed back on a manager or team's technical decision. Real story.
  63. The tightest deadline they actually hit. What was skipped? How did it end?
  64. The biggest technology they had to pick up in under a month on the job. How?
  65. A teammate not pulling weight. What did they actually do?
  66. Something they built that wasn't in their job description. Why did they do it?
  67. The hardest piece of feedback they received at work. Did it change anything?
  68. A time requirements changed completely mid-project. What did they do?
  69. The single work achievement they're actually proud of. Specific and real.

━━━ QUESTIONS 70-74 — JD-Specific (5 questions) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Read the JD very carefully. Find the 5 most specific requirements in THIS JD.
Questions must ONLY make sense for this exact job — they break if you swap the JD.
Answers must connect resume experience to that specific JD requirement honestly.
If there's a gap: acknowledge it directly and explain how they'd close it quickly.

━━━ QUESTIONS 75-79 — HR / Honest Conversation (5 questions) ━━━━━━━━━━━━━━━━
Short. Direct. Not corporate. Real answers — no canned phrases.
  75. "Why are you leaving [current company from resume]? Be straight with me."
  76. "Why this specific company and this role? What do you actually know about us?"
  77. "Where do you see yourself in 3 years? Realistically."
  78. "What do you need from a manager to do your best work?"
  79. "What's one thing about your background that might give us pause?"

━━━ QUESTION 80 — The Real-Talk Question ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Pick the most relevant of these for this resume and JD:
  A. "What's on your resume that you're least confident talking about?"
  B. "If your last manager were on this call, what weakness would they name?"
  C. "What are you genuinely bad at professionally? Not a humble-brag."
Answer must be honest, self-aware, and specific — not deflective.

OUTPUT: Return ONLY this raw JSON array. IDs 61-80. Generate ALL 20.
[
  { "id": 61, "category": "Behavioral",    "question": "...", "answer": "[AT LEAST 100 to 120 words highly detailed spoken answer]", "isCode": false },
  { "id": 70, "category": "JD-Specific",   "question": "...", "answer": "[AT LEAST 100 to 120 words highly detailed spoken answer]", "isCode": false },
  { "id": 75, "category": "HR",            "question": "...", "answer": "[AT LEAST 100 to 120 words highly detailed spoken answer]", "isCode": false },
  { "id": 80, "category": "Real-Talk",     "question": "...", "answer": "[AT LEAST 100 to 120 words highly detailed spoken answer]", "isCode": false }
]

RESUME:
${resume}

JOB DESCRIPTION:
${jd}`
}

// ─────────────────────────────────────────────────────────────────────────────
// BATCH 5 — Technical (20) — IDs 81-100
// ─────────────────────────────────────────────────────────────────────────────
function batch5Prompt(resume, jd, prevQuestions, yrs) {
  return `${RULES}
${experienceContext(yrs)}

TASK: Generate EXACTLY 20 TECHNICAL Q&A pairs as a JSON array. IDs 81-100.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DO NOT REPEAT — CHECK BEFORE EACH QUESTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Already asked questions — generate ZERO similar questions to any of these:
${prevQuestions.slice(0, 1000)}...

Generate EXACTLY 20 new Technical Questions based on the JD technologies not sufficiently covered, or deeper edge cases.
Mix "What is", "How does", "Why", and "Difference between".
No project questions here.

OUTPUT: Return ONLY this raw JSON array. IDs 81-100. Generate ALL 20.
[
  { "id": 81, "category": "Technical", "question": "...", "answer": "[AT LEAST 100 to 120 words highly detailed spoken answer]", "isCode": false },
  ...
  { "id": 100, "category": "Technical", "question": "...", "answer": "[AT LEAST 100 to 120 words highly detailed spoken answer]", "isCode": false }
]

RESUME:
${resume}

JOB DESCRIPTION:
${jd}`
}

// ─────────────────────────────────────────────────────────────────────────────
// BATCH 6 — Technical(10) + Project(10) — IDs 101-120
// ─────────────────────────────────────────────────────────────────────────────
function batch6Prompt(resume, jd, prevQuestions, yrs) {
  return `${RULES}
${experienceContext(yrs)}

TASK: Generate EXACTLY 20 Q&A pairs as a JSON array. IDs 101-120.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DO NOT REPEAT — CHECK BEFORE EACH QUESTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${prevQuestions.slice(0, 1000)}...

Generate EXACTLY 10 new Technical Questions (IDs 101-110).
Generate EXACTLY 10 new Project Questions (IDs 111-120).

For the Project Questions (111-120), you MUST extract and use exact Project Headlines from the resume. The explanation MUST be 150-200 words.

OUTPUT: Return ONLY this raw JSON array. IDs 101-120. Generate ALL 20.
[
  { "id": 101, "category": "Technical", "question": "...", "answer": "[AT LEAST 100 to 120 words highly detailed spoken answer]", "isCode": false },
  ...
  { "id": 111, "category": "Project", "question": "...", "answer": "[AT LEAST 150 to 200 words highly detailed spoken answer based entirely on the resume project headline]", "isCode": false },
  ...
  { "id": 120, "category": "Project", "question": "...", "answer": "[AT LEAST 150 to 200 words highly detailed spoken answer based entirely on the resume project headline]", "isCode": false }
]

RESUME:
${resume}

JOB DESCRIPTION:
${jd}`
}

// ─────────────────────────────────────────────────────────────────────────────
// DEDUPLICATION — Jaccard similarity, removes near-identical questions
// ─────────────────────────────────────────────────────────────────────────────
function deduplicateQuestions(questions) {
  const stopWords = new Set(['the','a','an','is','are','was','were','you','your','did',
    'do','does','how','what','why','where','when','which','who','would','could','should',
    'have','has','had','in','on','at','to','for','of','and','or','but','with','this',
    'that','it','be','been','being','me','my','our','their','its','we','they','he','she',
    'can','will','just','use','used','using'])

  function tokenize(q) {
    return q.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/s+/)
      .filter(w => w.length > 2 && !stopWords.has(w))
  }

  function jaccard(a, b) {
    const setA = new Set(tokenize(a))
    const setB = new Set(tokenize(b))
    const intersection = [...setA].filter(w => setB.has(w)).length
    const union = new Set([...setA, ...setB]).size
    return union === 0 ? 0 : intersection / union
  }

  const kept = []
  for (const q of questions) {
    const isDup = kept.some(k => jaccard(k.question, q.question) > 0.52)
    if (!isDup) kept.push(q)
    else console.warn(`[Dedup] Removed duplicate: "${q.question.slice(0,60)}"`)
  }
  return kept
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /generate — SSE streaming: sends each batch to client as it completes
// No timeout issues: data flows continuously instead of one giant wait
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { resume, jd, experienceYears } = req.body
  const yrs = experienceYears || '3'

  if (!resume?.trim() || !jd?.trim()) {
    return res.status(400).json({ error: 'Both resume and job description are required.' })
  }
  if (resume.trim().length < 100) {
    return res.status(400).json({ error: 'Resume too short — paste your full resume.' })
  }

  const r = resume.trim()
  const j = jd.trim()

  // ── SSE headers — keeps the connection alive forever, no timeout ──
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  const send = (event, payload) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`)
    if (res.flush) res.flush()
  }

  let all = []

  function prevList(qs) {
    if (!qs.length) return '(none yet)'
    return qs.map((q, i) => `${i + 1}. ${q.question}`).join('\n')
  }

  console.log(`[Generate] Starting SSE — experience level: ${yrs} years`)
  send('status', { message: 'Starting generation...', total: 0 })

  const batches = [
    { label: 'Batch1[1-20]',    promptFn: () => batch1Prompt(r, j, yrs) },
    { label: 'Batch2[21-40]',   promptFn: () => batch2Prompt(r, j, prevList(all), yrs) },
    { label: 'Batch3[41-60]',   promptFn: () => batch3Prompt(r, j, prevList(all), yrs) },
    { label: 'Batch4[61-80]',   promptFn: () => batch4Prompt(r, j, prevList(all), yrs) },
    { label: 'Batch5[81-100]',  promptFn: () => batch5Prompt(r, j, prevList(all), yrs) },
    { label: 'Batch6[101-120]', promptFn: () => batch6Prompt(r, j, prevList(all), yrs) },
  ]

  for (let i = 0; i < batches.length; i++) {
    const { label, promptFn } = batches[i]
    const batchNum = i + 1
    try {
      send('status', { message: `Generating batch ${batchNum} of ${batches.length}...`, total: all.length })
      const questions = await callAI(promptFn(), label)
      all = [...all, ...questions]
      console.log(`[Generate] ${label} done — ${all.length} total`)
      // Stream this batch to the client immediately
      send('batch', { batchNum, questions, total: all.length })
    } catch (e) {
      console.error(`[Generate] ${label} failed:`, e.message)
      if (batchNum <= 4) {
        // First 4 batches are critical — abort on failure
        send('error', { error: `Batch ${batchNum} failed: ${e.message}` })
        return res.end()
      }
      // Batches 5-6 are bonus — warn and continue
      send('status', { message: `Batch ${batchNum} skipped (non-critical): ${e.message}`, total: all.length })
    }
  }

  // Dedup + re-index
  const before = all.length
  all = deduplicateQuestions(all)
  all.forEach((q, idx) => { q.id = idx + 1 })
  console.log(`[Generate] ✅ Complete — Dedup: ${before} → ${all.length} questions`)

  // ── Save raw resume + JD to disk ───────────────────────────────────────────
  // This is the SINGLE SOURCE OF TRUTH for Groq and profile extraction.
  // Now Groq knows EXACTLY what company, role, projects are in the resume —
  // no more guessing from Q&A pairs.
  try {
    const path = require('path')
    const fs   = require('fs')
    const ctxDir = process.env.USER_DATA_PATH
      ? path.join(process.env.USER_DATA_PATH, 'vectorStore')
      : path.join(__dirname, '../vectorStore')
    if (!fs.existsSync(ctxDir)) fs.mkdirSync(ctxDir, { recursive: true })
    const ctxPath = path.join(ctxDir, 'session_context.json')
    fs.writeFileSync(ctxPath, JSON.stringify({
      resume:    r,
      jd:        j,
      yrs,
      persona:   req.body.persona || 'Default',
      savedAt:   new Date().toISOString()
    }, null, 2), 'utf-8')
    console.log(`[Generate] ✅ Session context saved (resume: ${r.length} chars, jd: ${j.length} chars)`)
  } catch (saveErr) {
    console.warn('[Generate] Could not save session context (non-critical):', saveErr.message)
  }

  send('done', {
    success: true,
    data:    all,
    count:   all.length,
    model:   process.env.AZURE_OPENAI_DEPLOYMENT || 'groq-fallback'
  })

  res.end()
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /generate/check — health check
// ─────────────────────────────────────────────────────────────────────────────

// GET /generate/check
router.get('/check', async (req, res) => {
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT
  try {
    await azure.chat.completions.create({
      model: deployment, messages: [{ role: 'user', content: 'Say OK' }], max_tokens: 5
    })
    res.json({ status: 'ok', deployment })
  } catch (err) {
    res.json({ status: 'error', deployment, error: err.message })
  }
})

module.exports = router
