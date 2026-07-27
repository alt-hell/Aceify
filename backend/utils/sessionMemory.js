/**
 * Session Memory — Conversation thread manager
 *
 * Stores the live interview conversation thread so Groq can:
 *  1. Stay consistent (same numbers, projects, facts across the session)
 *  2. Handle follow-up questions ("Why did you use that?", "Tell me more")
 *  3. Handle deep cross-questioning chains without losing context
 *
 * Architecture:
 *  - Thread: rolling window of last 6 Q&A exchanges
 *  - Topic detection: heuristic (fast, no extra Groq call for obvious cases)
 *  - Candidate profile: extracted once from QA store, cached for session
 *  - All state is in-memory — resets when server restarts (fine for interviews)
 */

const THREAD_MAX = 6

const state = {
  thread:           [],    // [{question, answer, timestamp}, ...]
  candidateProfile: null,  // Extracted once from QA store
  whisperContext:   null,  // Dynamic Whisper prompt built from QA store keywords
  resumeStructure:  null,  // Ordered experiences + projects (rank 1 = most recent)
}

// ─────────────────────────────────────────────────────────────────────────────
// Follow-up question detection — no Groq call needed for obvious cases
// Returns true if the current question is a follow-up to the previous topic
// ─────────────────────────────────────────────────────────────────────────────
function isFollowUp(question) {
  if (!question || state.thread.length === 0) return false

  const q     = question.toLowerCase().trim()
  const words = q.split(/\s+/).length

  // ── New topic signals checked FIRST — these always win ───────────────────
  const newTopicSignals = [
    /^(what is|what are|explain|describe|define|tell me about)\b/,  // definition = new topic
    /^(now let.s|moving on|next question|different topic|let.s talk about)/,
    /^(how does|how do|how would)\b/,                                // new concept
    /\b(completely different|unrelated|another area|new topic)\b/,
  ]
  if (newTopicSignals.some(re => re.test(q))) return false

  // ── Very short questions are almost always follow-ups ─────────────────────
  if (words <= 6) return true

  // ── Follow-up signals ─────────────────────────────────────────────────────
  const followUpSignals = [
    /\b(it|that|this|those|these|them|they|same|similar)\b/,
    /^(and |but |so |then |also |what about |how about |why did |why not |what if )/,
    /\b(more|further|deeper|elaborate|explain more|tell me more|go on|continue)\b/,
    /\b(why did you|how did you|when did you|where did you)\b/,
    /\b(the same|another|different approach|alternative)\b/,
    /\b(what were|what was|how was|how were)\b/,
    /\b(challenge|problem|issue|difficulty|trade.?off)\b/,
    /\b(specifically|exactly|precisely|in detail)\b/,
  ]
  if (followUpSignals.some(re => re.test(q))) return true

  return false
}

// ─────────────────────────────────────────────────────────────────────────────
// Add a completed Q&A to the thread
// ─────────────────────────────────────────────────────────────────────────────
function addToThread(question, answer) {
  if (!question || !answer) return

  state.thread.push({
    question: question.trim(),
    answer:   answer.slice(0, 400).trim(),   // Cap at 400 chars to keep tokens small
    timestamp: Date.now()
  })

  // Rolling window — drop oldest when over limit
  if (state.thread.length > THREAD_MAX) {
    state.thread.shift()
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Get the relevant thread context for the current question
// Returns formatted string for Groq prompt injection, or '' if not a follow-up
// ─────────────────────────────────────────────────────────────────────────────
function getThreadContext(currentQuestion) {
  if (state.thread.length === 0) return ''

  const followUp = isFollowUp(currentQuestion)

  if (!followUp) {
    // New topic — still pass last 1 for consistency (but don't force it as context)
    const last = state.thread[state.thread.length - 1]
    if (!last) return ''
    return `[Previous exchange for consistency only — new topic detected]\nQ: "${last.question}"\nA: "${last.answer}"\n`
  }

  // Follow-up — pass relevant thread (up to last 4 exchanges)
  const relevant = state.thread.slice(-4)
  const formatted = relevant.map((ex, i) =>
    `[${i + 1}] Q: "${ex.question}"\n    A: "${ex.answer}"`
  ).join('\n\n')

  return `[Conversation thread — ${relevant.length} previous exchange(s)]\n${formatted}\n`
}

// ─────────────────────────────────────────────────────────────────────────────
// Detect question complexity → dynamic word count target
// ─────────────────────────────────────────────────────────────────────────────
function getWordCountTarget(question, isFollowUpQ) {
  const q = question.toLowerCase()

  // Count distinct question marks and "and" conjunctions to estimate parts
  const parts = (question.match(/\?/g) || []).length
              + (question.match(/\band\b.*\b(what|how|why|when|where|who|which)\b/gi) || []).length
              + (question.match(/\balso\b.*\?(.*\b(what|how|why)\b)?/gi) || []).length

  const distinctParts = Math.max(1, parts)

  // Simple/clarification questions
  if (isFollowUpQ && question.split(' ').length <= 8) {
    return { min: 40, max: 80, label: 'brief follow-up' }
  }

  // Single concept
  if (distinctParts === 1) {
    if (/^(what is|what are|define|who is)/i.test(q)) {
      return { min: 70, max: 110, label: 'single concept' }
    }
    if (/tell me about yourself|walk me through|introduce yourself/i.test(q)) {
      return { min: 150, max: 200, label: 'personal intro' }
    }
    return { min: 90, max: 130, label: 'single question' }
  }

  // Two parts
  if (distinctParts === 2) {
    return { min: 120, max: 170, label: 'two-part question' }
  }

  // Three or more parts
  return { min: 160, max: 230, label: 'multi-part question' }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cache and retrieve candidate profile
// ─────────────────────────────────────────────────────────────────────────────
function setCandidateProfile(profile) {
  state.candidateProfile = profile
}

function getCandidateProfile() {
  return state.candidateProfile
}

// ─────────────────────────────────────────────────────────────────────────────
// Clear thread (called when "New Topic" button pressed or session ends)
// ─────────────────────────────────────────────────────────────────────────────
function clearThread() {
  state.thread = []
  console.log('[Session] Thread cleared')
}

function getThreadLength() {
  return state.thread.length
}

// ─────────────────────────────────────────────────────────────────────────────
// Whisper context — dynamic interview-specific vocabulary prompt
// Built from QA store topics so Whisper knows exact terms being discussed
// ─────────────────────────────────────────────────────────────────────────────
function setWhisperContext(contextString) {
  state.whisperContext = contextString
  console.log(`[Session] Whisper context set: ${contextString.length} chars`)
}

function getWhisperContext() {
  return state.whisperContext  // null if not yet built
}

// ─────────────────────────────────────────────────────────────────────────────────
// Resume structure — ordered experiences + projects extracted from the resume
// rank 1 = most recent / first listed in resume
// Used by Groq to answer "recent project", "latest role", "first project" etc.
// ─────────────────────────────────────────────────────────────────────────────────
function setResumeStructure(structure) {
  state.resumeStructure = structure
  console.log(`[Session] Resume structure stored: ${structure.experiences?.length || 0} experiences, ${structure.projects?.length || 0} projects`)
}

function getResumeStructure() {
  return state.resumeStructure
}

module.exports = {
  addToThread,
  getThreadContext,
  getWordCountTarget,
  isFollowUp,
  setCandidateProfile,
  getCandidateProfile,
  setWhisperContext,
  getWhisperContext,
  setResumeStructure,
  getResumeStructure,
  clearThread,
  getThreadLength,
}
