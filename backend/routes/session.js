const express         = require('express')
const router          = express.Router()
const { AzureOpenAI } = require('openai')
const session         = require('../utils/sessionMemory')

const azure = new AzureOpenAI({
  apiKey:     process.env.AZURE_OPENAI_API_KEY,
  endpoint:   process.env.AZURE_OPENAI_ENDPOINT,
  apiVersion: process.env.API_VERSION,
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /session/profile/extract
// Reads the current QA store and asks Groq to extract a compact candidate
// profile (name, role, projects, tech stack). Called once after Q&A generation.
// Result is cached in session memory for the entire interview session.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/profile/extract', async (req, res) => {
  try {
    const path = require('path')
    const fs   = require('fs')

    // ── Load raw resume from disk (saved by generate.js) ─────────────────────
    // session_context.json contains the ACTUAL resume text — not reconstructed from Q&As.
    const ctxDir  = process.env.USER_DATA_PATH
      ? path.join(process.env.USER_DATA_PATH, 'vectorStore')
      : path.join(__dirname, '../vectorStore')
    const ctxPath = path.join(ctxDir, 'session_context.json')

    let resumeText = ''
    let jdText     = ''

    if (fs.existsSync(ctxPath)) {
      const ctx = JSON.parse(fs.readFileSync(ctxPath, 'utf-8'))
      resumeText = ctx.resume || ''
      jdText     = ctx.jd     || ''
      console.log(`[Session] ✅ Loaded session context: resume ${resumeText.length} chars, jd ${jdText.length} chars`)
    }

    // Fallback: reconstruct from Q&A store if session_context.json is missing
    // (e.g. first launch before user regenerates Q&As)
    if (!resumeText) {
      const { getStoreInfo } = require('../vectorStore/qaStore')
      const info = getStoreInfo()
      if (!info.loaded) {
        return res.json({ success: false, reason: 'No session context or QA store found. Please generate your Q&A bank first.' })
      }
      const storePath = path.join(__dirname, '../vectorStore/qa_store.json')
      if (!fs.existsSync(storePath)) {
        return res.json({ success: false, reason: 'QA store file not found' })
      }
      const qaArray  = JSON.parse(fs.readFileSync(storePath, 'utf-8'))
      resumeText     = qaArray.slice(0, 30).map(qa => `Q: ${qa.question}\nA: ${qa.answer?.slice(0, 300)}`).join('\n\n')
      console.log('[Session] ⚠️ Falling back to Q&A reconstruction (session_context.json missing)')
    }

    // ── Extract compact profile from ACTUAL resume ────────────────────────────
    const profilePrompt = `You are extracting a structured candidate profile from a real resume.

RESUME:
${resumeText.slice(0, 6000)}

${jdText ? `JOB DESCRIPTION (role being applied for):\n${jdText.slice(0, 1500)}` : ''}

Extract and return ONLY this JSON — be precise, use exact text from resume:
{
  "name": "candidate's full name",
  "currentRole": "most recent job title (exact from resume)",
  "currentCompany": "most recent company name (exact from resume)",
  "previousRole": "second most recent job title",
  "previousCompany": "second most recent company name",
  "yearsOfExperience": "total years (calculate from dates or state explicitly)",
  "targetRole": "role from the job description",
  "domain": "the precise interview domain — pick the SINGLE best match from this list based on the JD and resume: AI/ML Engineering | Data Science | Full Stack Development | Backend Engineering | Frontend Engineering | DevOps/Platform Engineering | Data Engineering | Mobile Development | Cloud Architecture | Cybersecurity | QA/Testing | Embedded Systems | Game Development | Blockchain | Product Management | UX/Design & Creative | Project Management | Business Analysis | Marketing & Growth | Digital Marketing & SEO | Sales & Business Development | Account Management | Human Resources (HR) | Talent Acquisition & Recruiting | Finance & Accounting | Investment & Banking | Operations Management | Supply Chain & Logistics | Consulting & Strategy | Legal & Compliance | Healthcare Management | Education & Training | Real Estate | Customer Success | General Management | General Professional",
  "domainTerms": ["8-12 key domain-specific terms from the JD and resume — for tech: frameworks, tools, architectures; for non-tech: industry jargon, methodologies, metrics (e.g. for Marketing: 'CAC, LTV, conversion rate, A/B testing'; for HR: 'OKR, PIP, HRIS, talent pipeline'; for Finance: 'P&L, EBITDA, DCF, forecasting')"],
  "topProjects": ["project/initiative name + 1 line what it achieved", "project2", "project3"],
  "techStack": ["tools, platforms, software, and methodologies mentioned in resume — include both tech tools AND non-tech tools like Excel, Salesforce, HubSpot, SAP, Tableau, JIRA etc."],
  "keyStrengths": ["strength 1 — specific to their field", "strength 2", "strength 3"],
  "education": "highest degree + institution",
  "notableAchievements": ["specific quantified achievement 1 (revenue, growth %, team size, cost saved)", "achievement 2"]
}`


    const profileRes = await azure.chat.completions.create({
      model:       process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
      messages:    [{ role: 'user', content: profilePrompt }],
      max_tokens:  900,
      temperature: 0.0,
    })

    const rawProfile   = profileRes.choices[0].message.content.trim()
    const cleanProfile = rawProfile.replace(/```json|```/g, '').trim()
    const profile      = JSON.parse(cleanProfile)
    session.setCandidateProfile(profile)
    console.log(`[Session] ✅ Profile extracted: ${profile.name} | ${profile.currentRole} at ${profile.currentCompany}`)

    // ── Build Whisper vocabulary from resume terms ─────────────────────────────
    try {
      const techStr  = (profile.techStack || []).join(', ')
      const projStr  = (profile.topProjects || []).join(', ')
      const nameRole = `${profile.name}, ${profile.currentRole}, ${profile.currentCompany}`
      let whisperPrompt = `${nameRole}, ${techStr}, ${projStr}.`
      if (whisperPrompt.length > 800) whisperPrompt = whisperPrompt.slice(0, 797) + '...'
      session.setWhisperContext(whisperPrompt)
      console.log(`[Session] ✅ Whisper context: ${whisperPrompt.length} chars`)
    } catch (e) {
      console.warn('[Session] Whisper context build failed:', e.message)
    }

    // ── Extract ordered resume structure ──────────────────────────────────────
    try {
      const structurePrompt = `Extract structured work history from this resume. Return ONLY JSON.

RESUME:
${resumeText.slice(0, 6000)}

Return:
{
  "experiences": [
    { "rank": 1, "company": "exact company name", "title": "exact job title", "dates": "start-end", "summary": "one sentence", "achievements": ["quantified achievement 1", "achievement 2"] }
  ],
  "projects": [
    { "rank": 1, "name": "exact project name", "description": "what it does", "tech": ["tech1", "tech2"], "impact": "quantified result" }
  ]
}

RULES:
- rank 1 = MOST RECENT job / FIRST project listed in resume
- Include ALL experiences (up to 5) and ALL projects (up to 5)
- Use EXACT company names and project names from resume — no paraphrasing
- Return ONLY the JSON`

      const structureRes = await azure.chat.completions.create({
        model:       process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
        messages:    [{ role: 'user', content: structurePrompt }],
        max_tokens:  1000,
        temperature: 0.0,
      })

      const rawStruct   = structureRes.choices[0].message.content.trim()
      const cleanStruct = rawStruct.replace(/```json|```/g, '').trim()
      const structure   = JSON.parse(cleanStruct)
      session.setResumeStructure(structure)
      console.log(`[Session] ✅ Resume structure: ${structure.experiences?.length} roles, ${structure.projects?.length} projects`)
    } catch (structErr) {
      console.warn('[Session] Resume structure extraction failed:', structErr.message)
    }

    res.json({ success: true, profile })

  } catch (err) {
    console.error('[Session] Profile extraction failed:', err.message)
    res.json({ success: false, reason: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /session/thread/add
// Records a completed Q&A to the conversation thread.
// Called by both Path A (vector DB) and Path B (Groq) so follow-up questions
// always have full context.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/thread/add', (req, res) => {
  const { question, answer } = req.body
  if (!question || !answer) {
    return res.status(400).json({ error: 'question and answer required' })
  }
  session.addToThread(question, answer)
  res.json({ success: true, threadLength: session.getThreadLength() })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /session/thread/clear
// ─────────────────────────────────────────────────────────────────────────────
router.post('/thread/clear', (req, res) => {
  session.clearThread()
  res.json({ success: true })
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /session/status
// Returns current thread length and profile status
// ─────────────────────────────────────────────────────────────────────────────
router.get('/status', (req, res) => {
  const profile = session.getCandidateProfile()
  res.json({
    threadLength:     session.getThreadLength(),
    hasProfile:       !!profile,
    candidateName:    profile?.name || null,
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /session/thread/add
// Records a completed Q&A to the conversation thread.
// Called by Path A (vector DB direct answers) so Groq knows about prior
// answers when the user asks follow-up questions.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/thread/add', (req, res) => {
  const { question, answer } = req.body
  if (!question || !answer) {
    return res.status(400).json({ error: 'question and answer required' })
  }
  session.addToThread(question, answer)
  res.json({ success: true, threadLength: session.getThreadLength() })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /session/thread/clear
// ─────────────────────────────────────────────────────────────────────────────
router.post('/thread/clear', (req, res) => {
  session.clearThread()
  res.json({ success: true })
})

module.exports = router

