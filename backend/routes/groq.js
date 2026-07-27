const express = require('express')
const router  = express.Router()
const Groq    = require('groq-sdk')
const session = require('../utils/sessionMemory')

// Groq: fastest LLM inference in the world (LPU hardware).
// First token: ~200ms. Full 150-word answer: ~0.8s.
// Used ONLY for Path B — fresh questions NOT found in the vector DB.
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// ─────────────────────────────────────────────────────────────────────────────
// BUILD PROMPT — 4-Layer Intelligence System
//
// LAYER 1 — CANDIDATE PROFILE
//   Groq knows who this person is: name, role, projects, tech stack.
//   Every answer is deeply personalised — no generic filler.
//
// LAYER 2 — RESUME HIERARCHY
//   Preserves the ORDER of the resume: rank 1 = most recent job/first project.
//   Fixes "recent project" and "latest role" questions correctly every time.
//
// LAYER 3 — CONVERSATION THREAD
//   Groq sees the last 1-4 Q&A pairs so it:
//   - Stays 100% consistent (same facts, numbers, project names)
//   - Handles follow-ups ("Why did you use that?" → knows what "that" is)
//   - Never contradicts itself across a multi-hour interview
//
// LAYER 4 — DYNAMIC WORD COUNT
//   Computed per-question:
//   - Follow-ups get shorter answers (context already established)
//   - Multi-part questions get longer answers
//   - Technical vs personal questions get different structures
// ─────────────────────────────────────────────────────────────────────────────
function buildPrompt(question, contextAnswer, contextQuestion) {
  const hasContext   = contextAnswer && contextAnswer.trim().length > 40
  const isFollowUpQ  = session.isFollowUp(question)

  // isTechnical = question is asking about domain knowledge/process (works for both tech AND non-tech)
  // e.g. tech: "What is RAG?" | non-tech: "What is your approach to stakeholder management?"
  const isTechnical  = /what is|what are|explain|how does|how do|difference|compare|define|describe|types of|advantages|disadvantages|when would|why do|what does|how many|calculate/i.test(question)

  // Needs resume context: covers ALL questions that need the candidate's actual experience
  // Works for: tech engineers, marketers, HR, finance, sales, operations, consulting — everyone
  const isResumeQuestion = /recent(ly)?|latest|most recent|current(ly)?|first project|tell me about your(self| project| experience| work| role| background| campaign| client| team| case| deal| initiative)|walk me through|what (project|campaign|initiative|deal|case|have you worked|did you build|did you make|did you manage|have you handled)|describe your (experience|background|project|work|approach|process|style|campaign|team|client|role)|your (last|previous|current) (project|job|role|company|work|team|client|campaign)|tell me about a time|give me an example|describe a situation|weakness|strength|biggest flaw|achievement|accomplishment|motivation|why (do you want|are you interested|this (company|role|job))|where.*see yourself|5 year|five year|career goal|salary|compensation|what would you do|how would you handle|how do you (manage|handle|approach|deal with|prioritize|lead|motivate|measure|report|present|negotiate|close|recruit|coach|develop|align|communicate)|introduce yourself|who are you|your background|managed a team|led a project|worked with (a client|stakeholder|cross-functional|leadership|c-suite|executive)/i.test(question)

  // Needs JD: motivation, culture fit, goals, salary — MUST know the role and company
  const needsJD = /why (do you want|are you interested|this (company|role|job|team|organization|opportunity))|what (attract|drew|motivate|excite)|why should we hire|salary|compensation|ctc|package|where.*see yourself|5 year|five year|career goal|what makes you (a good fit|different|stand out|unique)|this (position|opportunity|role)|growth (opportunity|potential|path)|culture|values|mission/i.test(question) || isTechnical


  // ── Domain context — fully dynamic from profile (NOT hardcoded) ───────────
  // profile.domain is extracted by GPT-4o from the actual JD + resume.
  // Works for ANY job domain: AI/ML, DevOps, Java Backend, Mobile, etc.
  const whisperCtx     = session.getWhisperContext() || ''
  const profile        = session.getCandidateProfile()
  const detectedDomain = profile?.domain || 'Software Engineering'
  const domainTerms    = (profile?.domainTerms || []).join(', ')
                      || whisperCtx.slice(0, 300)

  const domainBlock = `
INTERVIEW DOMAIN: This is a "${detectedDomain}" interview.
Key technical terms in scope: ${domainTerms || 'general software engineering'}

Interpret EVERY question through the lens of "${detectedDomain}".
${domainTerms ? `These domain terms should NOT be taken in everyday meaning: ${domainTerms}` : ''}
Answer from the perspective of an experienced ${detectedDomain} professional.
`


  // ── Load raw resume text for direct injection ─────────────────────────────
  // Groq reads the ACTUAL resume: exact company names, dates, every project.

  let rawResumeText = ''
  let rawJDText     = ''
  let rawPersona    = 'Default'
  try {
    const path   = require('path')
    const fs     = require('fs')
    const ctxDir = process.env.USER_DATA_PATH
      ? path.join(process.env.USER_DATA_PATH, 'vectorStore')
      : path.join(__dirname, '../vectorStore')
    const ctxPath = path.join(ctxDir, 'session_context.json')
    if (fs.existsSync(ctxPath)) {
      const ctx    = JSON.parse(fs.readFileSync(ctxPath, 'utf-8'))
      rawResumeText = ctx.resume || ''
      rawJDText     = ctx.jd     || ''
      rawPersona    = ctx.persona || 'Default'
    }
  } catch (e) { /* non-critical */ }

  const profileBlock = profile ? `
CANDIDATE PROFILE:
- Name: ${profile.name}
- Current Role: ${profile.currentRole} at ${profile.currentCompany}
- Previous Role: ${profile.previousRole || 'N/A'} at ${profile.previousCompany || 'N/A'}
- Experience: ${profile.yearsOfExperience}
- Target Role: ${profile.targetRole || 'Not specified'}
- Top Projects: ${(profile.topProjects || []).join(' | ')}
- Tech Stack: ${(profile.techStack || []).join(', ')}
- Strengths: ${(profile.keyStrengths || []).join(', ')}
- Education: ${profile.education || 'Not specified'}
- Achievements: ${(profile.notableAchievements || []).join(' | ')}
` : ''

  // Inject the raw resume for personal/experience questions
  const resumeRawBlock = (rawResumeText && isResumeQuestion) ? `
FULL RESUME (use EXACT company names, project names, and dates from this):
${rawResumeText.slice(0, 4000)}
` : ''

  // Inject JD for technical AND motivation/goals/salary questions
  const jdBlock = (rawJDText && needsJD) ? `
JOB DESCRIPTION (role being applied for — use this to tailor answers to THIS specific role):
${rawJDText.slice(0, 1200)}
` : ''

  // ── LAYER 2: Resume hierarchy ──────────────────────────────────────────────
  const resumeStructure = session.getResumeStructure()
  const resumeBlock = (isResumeQuestion && resumeStructure) ? (() => {
    const expLines = (resumeStructure.experiences || []).map(e =>
      `  [Rank ${e.rank} — ${e.rank === 1 ? 'MOST RECENT' : `rank ${e.rank}`}] ${e.title} at ${e.company} (${e.dates})\n    Summary: ${e.summary}\n    Key achievements: ${e.achievements?.join('; ')}`
    ).join('\n')

    const projLines = (resumeStructure.projects || []).map(p =>
      `  [Rank ${p.rank} — ${p.rank === 1 ? 'FIRST/MOST PROMINENT' : `rank ${p.rank}`}] ${p.name}\n    Description: ${p.description}\n    Tech: ${p.tech?.join(', ')}\n    Impact: ${p.impact}`
    ).join('\n')

    return `
RESUME HIERARCHY (rank 1 = most recent job / first project on resume):
Work Experience (most recent first):
${expLines || '  (no experiences extracted)'}

Projects (as listed on resume — rank 1 is first/most prominent):
${projLines || '  (no projects extracted)'}

CRITICAL:
- "Recent project" / "latest project" → ALWAYS describe Rank 1 project
- "Recent experience" / "current role" → ALWAYS describe Rank 1 experience
- Never mix up the order — rank 1 is definitively the most recent/first
`
  })() : ''

  // ── LAYER 3: Conversation thread ───────────────────────────────────────────
  const threadContext = session.getThreadContext(question)
  const threadBlock   = threadContext ? `
CONVERSATION HISTORY (stay 100% consistent with everything said before):
${threadContext}
` : ''

  // ── LAYER 4: Dynamic word count ────────────────────────────────────────────
  const { min, max, label } = session.getWordCountTarget(question, isFollowUpQ)

  // ── Comprehensive intent detection ─────────────────────────────────────────
  // Covers every question type an interviewer can ask.
  const q = question.toLowerCase().trim()

  const questionIntent = (() => {
    // Pushback / stress interview — interviewer challenges or disagrees
    if (/i don.t think|are you sure|that.s not right|that.s wrong|but actually|i disagree|wouldn.t it be|isn.t it actually|challenge you|push back|that doesn.t make sense/i.test(question)) return 'PUSHBACK'

    // Multi-part — multiple questions in one (check BEFORE DEFINITION to catch "What is X and also what is Y?")
    const qMarks = (question.match(/\?/g) || []).length
    if (qMarks >= 2) return 'MULTI_PART'
    if (/\band\b.*\b(what|how|why|when|explain|describe|give|also)\b/i.test(question) && qMarks >= 1) return 'MULTI_PART'
    if (/\band also\b/i.test(question) && qMarks >= 1) return 'MULTI_PART'

    // Behavioral — STAR format needed
    if (/tell me about a time|give me an example|describe a situation|describe a time|walk me through a time|have you ever (had to|dealt|faced|managed|handled)|tell me when you/i.test(question)) return 'BEHAVIORAL'

    // Situational — hypothetical scenarios
    if (/what would you do|how would you (handle|approach|deal|manage|respond)|if you (were|had to|found yourself)|imagine you|suppose you|hypothetically/i.test(question)) return 'SITUATIONAL'

    // Weakness / challenge / failure
    if (/weakness|weaknesses|biggest flaw|area.*(improvement|develop|grow)|what.*(struggle|difficult for you)|failure|failed|mistake you made|biggest challenge you face/i.test(question)) return 'WEAKNESS'

    // Motivation / culture fit / why this role
    if (/why (do you want|are you interested|this (company|role|position|job|team|organization))|what (attract|drew|motivate|excite).*you|why should we hire|why (us|our company)|what makes you (a good fit|different)|passion/i.test(question)) return 'MOTIVATION'

    // Salary / compensation
    if (/salary|compensation|package|ctc|pay|remuneration|expect.*(pay|earn|salary)/i.test(question)) return 'SALARY'

    // Strengths
    if (/strength|biggest strength|what are you (good at|best at)|what do you (excel|thrive)|superpower/i.test(question)) return 'STRENGTH'

    // Goals / future
    if (/where.*see yourself|5 year|five year|long.?term goal|career goal|future|plan.*next/i.test(question)) return 'GOALS'

    // Leadership / people management — critical for managers, HR, ops, consulting, sales leads
    if (/manage a team|managing a team|lead a team|leading a team|team (management|leader|building|culture|performance|size)|how (many|large) (a team|your team)|people management|direct report|subordinate|underperformer|performance review|coaching|mentoring|conflict (between|resolution|management)|stakeholder (management|alignment|buy-in|communication)|cross.functional|c-suite|executive (stakeholder|communication|presentation)|how do you (motivate|inspire|delegate|develop|hold.*accountable|give feedback|handle conflict|build.*team)/i.test(question)) return 'LEADERSHIP'

    // Opinion / preference
    if (/what do you think|in your opinion|your thoughts on|do you (prefer|believe|think)|what.s your (take|view|opinion|perspective)/i.test(question)) return 'OPINION'

    // Estimation — covers tech (Fermi), non-tech (market sizing, budget, headcount planning)
    if (/how many|estimate|how long would it take|how much (storage|traffic|data|budget|revenue|cost)|calculate approximately|capacity|market size|size.*market|headcount|forecast/i.test(question)) return 'ESTIMATION'

    // Personal intro
    if (/tell me about yourself|introduce yourself|walk me through your (background|resume|career|journey)|who are you|about yourself/i.test(question)) return 'PERSONAL'

    // Experience / project / initiative — works for tech projects AND non-tech campaigns, deals, cases
    if (/tell me about your (most recent|latest|current|last|first|recent|project|work|role|experience|campaign|initiative|deal|case)|describe your|what (did you|have you|was your)|most (challenging|interesting|complex) (project|campaign|deal|case|client)|proudest (achievement|accomplishment)/i.test(question)) return 'EXPERIENCE'

    // COMPARISON must come before DEFINITION — "What is the difference..." starts with "What is"
    if (/what.s the difference|difference between|compare|vs |versus|contrast/i.test(q)) return 'COMPARISON'

    // Definition / concept questions (tech AND non-tech: "What is OKR?", "What is EBITDA?")
    if (/^(what is|what are|what does|define|definition|explain what|meaning of)/.test(q)) return 'DEFINITION'
    if (/^(why (use|do we|should|would|is)|what (are the advantages|benefits|reasons)|when (to use|would you use))/.test(q)) return 'RATIONALE'
    if (/^(how (does|do|is|would|can|to)|what (happens|is the process|steps|mechanism|approach))/.test(q) || /design|architect|build.*system|approach to|framework for/i.test(question)) return 'MECHANISM'

    // Short follow-up
    if (isFollowUpQ) return 'FOLLOWUP'

    return 'GENERAL'
  })()


  // ── Format block per intent ────────────────────────────────────────────────
  const formatBlock = (() => {
    switch (questionIntent) {

      case 'DEFINITION':
        return `
QUESTION TYPE: DEFINITION — "What is X?"
Answer: what it is in plain language (1-2 sentences) + one real-world example relevant to your field.
DO NOT explain why it's useful, its history, or its advantages — that was NOT asked.
Works for both technical concepts (RAG, microservices) and non-technical ones (OKR, EBITDA, NPS, A/B testing).
Target: 60–90 words. Stop as soon as the definition is complete.
`
      case 'RATIONALE':
        return `
QUESTION TYPE: RATIONALE — "Why use X?" or "Why is X important?"
Answer: 1-2 specific reasons + your real experience using it. Start with the core benefit.
DO NOT define X from scratch — the interviewer already knows what it is.
Works for both tech rationale (why Kafka?) and non-tech (why OKRs over KPIs? why STAR for interviews?).
Target: 80–110 words. 2 paragraphs.
`
      case 'MECHANISM':
        return `
QUESTION TYPE: MECHANISM — "How does X work?" or "How do you approach X?"
Answer: explain how it works or how you approach it — simply and clearly. Use ONE analogy.
End with a real example from your actual work.
Works for tech (how does attention work?) AND non-tech (how do you run a performance review? how does your sales process work?).
Target: 90–120 words. 2–3 paragraphs.
`
      case 'COMPARISON':
        return `
QUESTION TYPE: COMPARISON — "X vs Y"
Structure (exactly this order):
  1. The core difference in one sentence
  2. When you'd pick X (specific criterion)
  3. When you'd pick Y (specific criterion)
  4. Which one you've used and in what context
Works for tech comparisons (SQL vs NoSQL) AND non-tech (OKR vs KPI, in-house vs agency, Agile vs Waterfall).
Target: 80–110 words.
`
      case 'BEHAVIORAL':
        return `
QUESTION TYPE: BEHAVIORAL — "Tell me about a time..."
Use the STAR framework — spoken naturally, NOT as bullet points:
  Situation: set the scene briefly (what was the context and stakes?)
  Task: what was YOUR specific responsibility in this situation?
  Action: what exactly did YOU do? (specific actions, methods, tools, or decisions — and why)
  Result: what was the outcome? Use a real number, metric, or concrete result.
CRITICAL: Use a REAL story from the resume. Never invent a generic example.
Works for any field: tech (fixed a production bug), non-tech (won a client, resolved a team conflict, exceeded a sales target).
Target: 130–180 words.
`
      case 'SITUATIONAL':
        return `
QUESTION TYPE: SITUATIONAL — "What would you do if...?"
Structure:
  1. Your immediate first reaction (shows instinct and priority)
  2. Your step-by-step process/approach
  3. Connect to a REAL time you handled something similar
  4. End with the outcome or lesson learned
DO NOT give a purely theoretical answer — always anchor to real experience.
Works for both tech scenarios (production outage, model degradation) AND non-tech (difficult client, team conflict, missed deadline, budget cut).
Target: 100–140 words.
`
      case 'WEAKNESS':
        return `
QUESTION TYPE: WEAKNESS
The interviewer wants genuine self-awareness + growth mindset. "I work too hard" is NOT acceptable.
Structure:
  1. ONE real weakness — something you genuinely work on
  2. Specific steps you are actively taking to address it
  3. Evidence of actual improvement (a concrete example)
CRITICAL: Choose a weakness that is real but not a dealbreaker for this specific role.
Target: 90–120 words.
`
      case 'STRENGTH':
        return `
QUESTION TYPE: STRENGTH
Structure:
  1. Name ONE core strength with confidence
  2. Prove it with a specific result or project from the resume (metric or outcome)
  3. Connect it directly to what THIS role needs
Target: 80–110 words.
`
      case 'MOTIVATION':
        return `
QUESTION TYPE: MOTIVATION — "Why this company / role?"
Structure:
  1. One specific aspect of THIS company/role that genuinely excites you (use JD details)
  2. How it connects to your career direction and what you've already done
  3. The specific value you would bring to THEM
CRITICAL: Do NOT be generic. Use a specific detail from the JD or company context.
Target: 90–120 words.
`
      case 'SALARY':
        return `
QUESTION TYPE: SALARY EXPECTATION
Strategy: anchor confidently, stay flexible, don't give a single number first.
Structure:
  1. Express openness while anchoring to market rate
  2. Give a range if pressed (high end of fair market for your experience)
  3. Signal openness to discuss the total package (bonus, equity, perks)
Framing: "Based on my experience and current market rates for this role, I'm targeting X–Y. That said, I'm open to discussing the full package."
Target: 50–80 words. Calm and professional.
`
      case 'GOALS':
        return `
QUESTION TYPE: CAREER GOALS
Structure:
  1. Short-term (1-2 years): specific skill, milestone, or level you want to reach
  2. Long-term (3-5 years): the impact or leadership position you're building toward
  3. Why THIS role is the natural next step toward that goal
Sound ambitious but grounded — no fantasy goals.
Target: 90–120 words.
`
      case 'LEADERSHIP':
        return `
QUESTION TYPE: LEADERSHIP / PEOPLE MANAGEMENT
This question is about your ability to lead, manage, develop, or align people.
Structure:
  1. Your leadership philosophy in one sentence (how you think about managing people)
  2. A specific real example: team size, the challenge, what you did, the outcome
  3. What you learned or how your style has evolved
CRITICAL: Be specific — name the team size, the situation, the actions, the result.
DO NOT give generic platitudes like "I believe in empowering my team."
Target: 110–150 words.
`
      case 'OPINION':
        return `
QUESTION TYPE: OPINION — "What do you think about X?"
Give a clear, confident opinion. Do NOT hedge with "well, it depends..."
Structure: Your clear stance → your main reason → a real example from your experience.
Target: 70–100 words.
`
      case 'ESTIMATION':
        return `
QUESTION TYPE: ESTIMATION
This could be a Fermi estimate (tech), market sizing (marketing/consulting), budget estimation (finance/ops), or headcount planning (HR).
Structure:
  1. State your key assumptions upfront (shows structured thinking)
  2. Break into components and estimate each part
  3. Arrive at a final number with a confidence range
Think out loud — your reasoning process matters more than the exact number.
Target: 100–140 words.
`
      case 'PUSHBACK':
        return `
QUESTION TYPE: PUSHBACK / STRESS — Interviewer is challenging your previous answer
This tests confidence and composure. Do NOT crumble or completely reverse without reason.
Structure:
  1. Acknowledge calmly: "That's a fair point to raise..."
  2. If you were right: defend with a clear reason or real example
  3. If they have a valid point: acknowledge it gracefully, refine your view
  4. Close with confidence — never sound rattled or apologetic
DO NOT apologise excessively.
Target: 80–110 words. Calm, confident, precise.
`
      case 'MULTI_PART':
        return `
QUESTION TYPE: MULTI-PART — multiple questions in one
CRITICAL: Answer EVERY part in the exact order they were asked. Do not skip any.
Transition naturally: "So on the first point... and then on your second question..."
Target: ${min}–${max} words. One focused paragraph per sub-question.
`
      case 'PERSONAL':
        return `
QUESTION TYPE: PERSONAL INTRODUCTION — spoken story
Structure: Who you are professionally → your key experience and what you've accomplished (real names, real results) → why you're the right fit for THIS role.
Use contractions. Sound human, not like you're reading a CV.
Works for both tech ("I've built ML pipelines...") and non-tech ("I've led marketing teams of 12...").
Target: ${min}–${max} words.
`
      case 'EXPERIENCE':
        return `
QUESTION TYPE: EXPERIENCE
Name the real project, company, tech stack. Give a specific outcome or metric.
Structure: Context → what you did → specific result.
Target: ${min}–${max} words.
`
      case 'FOLLOWUP':
        return `
QUESTION TYPE: FOLLOW-UP
The interviewer is digging deeper into the previous topic. Reference your previous answer naturally ("As I mentioned...").
Add depth, specifics, or a different angle. Don't repeat what you already said.
Target: 50–90 words. Keep it tight.
`
      default:
        return `
Answer the exact question asked. Nothing more, nothing less.
If technical: definition + one real example. If personal: situation → action → outcome.
Target: ${min}–${max} words.
`
    }
  })()

  // ── Knowledge base context ─────────────────────────────────────────────────
  const knowledgeBlock = hasContext ? `
KNOWLEDGE BASE — PRIMARY SOURCE (treat this as ground truth):
Stored answer for "${contextQuestion}":
${contextAnswer}

Rules for knowledge base:
- This is your authoritative source — do NOT contradict it
- Keep ALL personal details: project names, company names, specific numbers
- Adapt the framing to match the exact question asked
- Extend using profile if the question asks for more than what's stored
` : `No stored answer found — generate using the candidate profile. Be specific, use real details from the resume.`

  // ── Consistency enforcement ────────────────────────────────────────────────
  const consistencyBlock = threadContext ? `
CONSISTENCY (critical for cross-questioning resistance):
- Any number you mentioned before (e.g. "80% accuracy", "512 tokens") — use the SAME number
- Any project name you mentioned before — use the SAME name
- Any follow-up question — reference the previous answer: "As I mentioned..."
` : ''

  // ── LAYER 5: Persona & Tone ────────────────────────────────────────────────
  const personaBlock = (() => {
    switch (rawPersona) {
      case 'Concise':
        return `
PERSONA & TONE: CONCISE & DIRECT
- Be extremely brief and straight to the point. No fluff, no long introductions.
- Use sharp, definitive language.
- Keep sentences short and punchy.
`
      case 'Eager':
        return `
PERSONA & TONE: EAGER & ENERGETIC
- Sound highly enthusiastic, passionate, and energetic.
- Express genuine excitement about the work and technologies.
- Use an upbeat and positive tone.
`
      case 'Consultant':
        return `
PERSONA & TONE: CONSULTANT / FRAMEWORK-DRIVEN
- Be highly structured. Use clear logical steps (e.g., "First...", "Second...").
- Sound analytical, objective, and strategic.
- Focus heavily on business impact, metrics, and structured problem solving.
`
      case 'Storyteller':
        return `
PERSONA & TONE: ENGAGING STORYTELLER
- Frame your answers as engaging narratives.
- Set the scene, build a little tension, and resolve it gracefully.
- Use vivid analogies and paint a picture with your words.
`
      default:
        return `
PERSONA & TONE: BALANCED & PROFESSIONAL
- Sound like a confident, experienced professional.
- Balanced, articulate, and natural.
`
    }
  })()

  return `You are the world's most capable real-time interview assistant. A candidate is in a LIVE job interview RIGHT NOW.
You have read their full resume, know their complete work history, and understand the job they're applying for.
Your job: generate the PERFECT spoken answer to whatever the interviewer just asked.
${domainBlock}${profileBlock}${resumeRawBlock}${jdBlock}${resumeBlock}${threadBlock}${knowledgeBlock}${personaBlock}
ANSWER PRECISION:
- Answer EXACTLY what was asked — the correct intent, the correct scope
- "What is X?" → definition only. "Why X?" → rationale only. "Tell me about a time..." → STAR story.
- NEVER mix intents. Do not define when asked why. Do not elaborate when asked to define.
- For behavioral questions: always use a REAL story from the resume — never make up a generic tale
- For pushback: stay calm and confident — don't crumble, don't flip without reason
- For multi-part: answer EVERY sub-question in order

TONE (absolute, non-negotiable):
- Spoken English — contractions, natural flow, NOT essay writing
- NO bullet points, NO numbered lists, NO markdown anywhere
- NO "Certainly", "Absolutely", "Great question", "Of course", "As an AI"
- NO "In conclusion", "To summarise", "Overall"
- Sound like the candidate is actually talking, not reading
- Use real names: exact company, exact project, exact metric — never [placeholder]

${formatBlock}${consistencyBlock}
BANNED:
- Bullet points or headers of any kind in the answer body
- Starting with "I have X years of experience" (boring opener)
- Contradicting the conversation history
- Inventing facts not in the profile or resume
- Template placeholders

Interview question: "${question}"

Answer (start speaking immediately — no preamble, no labels):`
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /groq — SSE streaming answer via Groq (Path B: fresh questions only)
// Called only when vector DB has NO match for the question.

// First token: ~200ms. Full answer: ~0.8-1.5 seconds.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const {
    question,
    contextAnswer,
    contextQuestion,
    matchedCategory,
    stream: wantStream
  } = req.body

  const ctxAnswer   = contextAnswer || ''
  const ctxQuestion = contextQuestion || question
  const category    = matchedCategory || (ctxAnswer ? 'Knowledge Base' : 'Live AI')

  const prompt = buildPrompt(question, ctxAnswer, ctxQuestion)

  // ── STREAMING (default) ──────────────────────────────────────────────────
  if (wantStream !== false) {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders()

    try {
      const streamResp = await groq.chat.completions.create({
        model:       process.env.GROQ_LLAMA_MODEL || 'llama-3.3-70b-versatile',
        messages:    [{ role: 'user', content: prompt }],
        max_tokens:  750,      // Enough for complete answers without over-explaining
        temperature: 0.50,
        top_p:       0.90,     // Quality token sampling
        stream:      true
      })

      let fullAnswer = ''

      for await (const chunk of streamResp) {
        const token = chunk.choices[0]?.delta?.content || ''
        if (token) {
          fullAnswer += token
          res.write(`data: ${JSON.stringify({ token, done: false })}\n\n`)
        }
      }

      const adapted = !!(ctxAnswer && ctxAnswer.trim().length > 40)

      // Record this Q&A to conversation thread for future follow-ups
      session.addToThread(question, fullAnswer)

      res.write(`data: ${JSON.stringify({
        token: '',
        done:  true,
        data: {
          answer:        fullAnswer.trim(),
          question:      adapted ? ctxQuestion : question,
          askedQuestion: question,
          confidence:    adapted ? 92 : 75,
          isCode:        false,
          fromGroq:      true,
          adapted,
          category,
          threadLength:  session.getThreadLength(),
        }
      })}\n\n`)
      res.end()

    } catch (err) {
      console.error('[Groq Stream] Error:', err.message)
      res.write(`data: ${JSON.stringify({ error: err.message, done: true })}\n\n`)
      res.end()
    }
    return
  }

  // ── NON-STREAMING fallback ────────────────────────────────────────────────
  try {
    const response = await groq.chat.completions.create({
      model:       process.env.GROQ_LLAMA_MODEL || 'llama-3.3-70b-versatile',
      messages:    [{ role: 'user', content: prompt }],
      max_tokens:  750,
      temperature: 0.50,
      top_p:       0.90,
    })
    const answer  = response.choices[0].message.content.trim()
    const adapted = !!(ctxAnswer && ctxAnswer.trim().length > 40)

    session.addToThread(question, answer)

    res.json({
      success: true,
      data: {
        answer,
        question:      adapted ? ctxQuestion : question,
        askedQuestion: question,
        confidence:    adapted ? 92 : 75,
        isCode:        false,
        fromGroq:      true,
        adapted,
        category,
        threadLength:  session.getThreadLength(),
      }
    })
  } catch (err) {
    console.error('[Groq] Error:', err.message)
    res.status(500).json({ error: 'Groq failed', details: err.message })
  }
})

module.exports = router
