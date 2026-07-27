const path = require('path')
const fs   = require('fs')
// In packaged .exe, resources/ is read-only — write to the user's writable AppData folder instead.
// USER_DATA_PATH is injected by electron/main.js only when app.isPackaged === true.
const STORE_DIR  = process.env.USER_DATA_PATH
  ? path.join(process.env.USER_DATA_PATH, 'vectorStore')
  : path.join(__dirname)
if (!fs.existsSync(STORE_DIR)) fs.mkdirSync(STORE_DIR, { recursive: true })
const STORE_PATH = path.join(STORE_DIR, 'qa_store.json')

let qaArray  = []
let isLoaded = false
let extractorPromise = null;
let transformersMod = null;

async function getExtractor() {
  if (!transformersMod) {
    transformersMod = await import('@xenova/transformers');
  }
  if (!extractorPromise) {
    extractorPromise = transformersMod.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { quantized: true });
  }
  return extractorPromise;
}

// ─────────────────────────────────────────────────────────────────────────────
function loadFromDisk() {
  try {
    if (fs.existsSync(STORE_PATH)) {
      qaArray  = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'))
      isLoaded = true
      console.log(`[QAStore] Loaded ${qaArray.length} Q&A pairs (with embeddings) from disk`)
      // Pre-warm the extractor in the background so the first search is fast
      getExtractor().catch(err => console.error("Failed to load transformer model:", err))
    }
  } catch (e) {
    console.warn('[QAStore] Could not load from disk:', e.message)
  }
}

async function buildIndex(items) {
  const extractor = await getExtractor();
  console.log(`[QAStore] Generating embeddings for ${items.length} items...`);
  
  qaArray = [];
  for (let item of items) {
    if (item.question) {
      const res = await extractor(item.question, { pooling: 'mean', normalize: true });
      item.embedding = Array.from(res.data);
      qaArray.push(item);
    }
  }
  
  isLoaded = true
  fs.writeFileSync(STORE_PATH, JSON.stringify(qaArray, null, 2), 'utf-8')
  console.log(`[QAStore] Semantic Index built: ${qaArray.length} questions saved`)
  return { count: qaArray.length }
}

function clearStore() {
  qaArray = []
  isLoaded = false
  if (fs.existsSync(STORE_PATH)) {
    fs.unlinkSync(STORE_PATH)
  }
  console.log(`[QAStore] Semantic Index wiped by user request.`)
  return { success: true }
}


// ─────────────────────────────────────────────────────────────────────────────
// Return single best answer — always use top-1 match only.
// Previously combined multiple answers into [Knowledge 1] + [Knowledge 2] blocks
// which caused the tool to dump multiple Q&As at the user.
// Now: one question → one clean answer. That's it.
// ─────────────────────────────────────────────────────────────────────────────
function buildCombinedContext(matchedItems) {
  if (!matchedItems || matchedItems.length === 0) return { contextAnswer: '', contextQuestion: '' }

  // ALWAYS use only the top-1 (highest scoring) match — no combining
  const best = matchedItems[0]
  return {
    contextAnswer:   best.answer   || '',
    contextQuestion: best.question || '',
    multiPart:       false,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// searchAnswer — Semantic search over pre-computed embeddings
// ─────────────────────────────────────────────────────────────────────────────
async function searchAnswer(query, isPartial = false) {
  if (!isLoaded || qaArray.length === 0) {
    throw new Error('Q&A index not loaded. Please generate your Q&A bank first.')
  }

  // 1. Generate embedding for query
  const extractor = await getExtractor();
  const queryRes = await extractor(query, { pooling: 'mean', normalize: true });
  const queryEmb = queryRes.data;

  // 2. Calculate cosine similarity against all items
  const scored = qaArray.map(item => ({
    ...item,
    _score: transformersMod.cos_sim(queryEmb, item.embedding)
  })).sort((a, b) => b._score - a._score);

  const topScore = scored[0]._score;
  console.log(`[QAStore] Semantic: top score ${topScore.toFixed(3)} for "${query}" (Partial: ${isPartial})`);

  // Fast-path early exit for PARTIAL queries (> 0.85 indicates strong intent match on a half sentence)
  if (isPartial) {
    if (topScore > 0.85) {
       console.log(`[QAStore] ⚡ INSTANT PARTIAL MATCH (${topScore.toFixed(3)})`);
       return {
         useGroq: true,
         ...buildCombinedContext([scored[0]]),
         matchedCategory: scored[0].category || 'General',
         question: query,
         confidence: Math.round(topScore * 100),
         fastPath: true,
       }
    }
    // Partial but no high match -> do nothing, wait for final
    return null; 
  }

  // ── Question-type intent extraction ────────────────────────────────────────
  // Prevents "What is RAG?" from matching "Why use RAG?" — wrong answer.
  // We classify the question intent and only allow DB matches with same intent.
  function getIntent(q) {
    const t = q.toLowerCase().trim()
    if (/^(what is|what are|what does|define|definition of|explain what|meaning of|what do you mean)/.test(t)) return 'DEFINITION'
    if (/^(why (use|do we|should|would|is)|what (are the advantages|benefits|reasons)|when (to use|would you use))/.test(t)) return 'RATIONALE'
    if (/^(how (does|do|is|would|can|to)|what (happens|is the process|steps|mechanism))/.test(t)) return 'MECHANISM'
    if (/^(what.s the difference|difference between|compare|vs |versus)/.test(t)) return 'COMPARISON'
    if (/tell me about yourself|introduce yourself|walk me through|your background|your experience/.test(t)) return 'PERSONAL'
    if (/^(what (did you|have you|was your)|describe your|tell me about your (project|work|role))/.test(t)) return 'EXPERIENCE'
    return 'GENERAL'
  }

  const queryIntent = getIntent(query)
  console.log(`[QAStore] Query intent: ${queryIntent} | top score: ${topScore.toFixed(3)}`)

  // ── Final Query Path ─────────────────────────────────────────────────────
  // HIGH confidence (> 0.70): trust the match regardless of intent
  if (topScore > 0.70) {
    const best = scored[0]
    const context = buildCombinedContext([best])
    console.log(`[QAStore] ⚡ HIGH CONFIDENCE (${topScore.toFixed(3)}) → instant DB answer`)
    return {
      useGroq:         true,
      ...context,
      matchedCategory: best.category || 'General',
      question:        query,
      confidence:      Math.round(topScore * 100),
      fastPath:        true,
    }
  }

  // MEDIUM confidence (0.55–0.70): only use DB if question intent matches stored question
  if (topScore > 0.55) {
    const best         = scored[0]
    const storedIntent = getIntent(best.question || '')
    const intentMatch  = queryIntent === storedIntent || queryIntent === 'GENERAL' || storedIntent === 'GENERAL'

    if (intentMatch) {
      const context = buildCombinedContext([best])
      console.log(`[QAStore] ✅ MEDIUM CONFIDENCE + intent match (${queryIntent}=${storedIntent}, score ${topScore.toFixed(3)}) → DB answer`)
      return {
        useGroq:         true,
        ...context,
        matchedCategory: best.category || 'General',
        question:        query,
        confidence:      Math.round(topScore * 100),
        fastPath:        true,
      }
    } else {
      // Intent mismatch at medium confidence → wrong answer would be returned
      // Route to Groq which will answer the EXACT question asked correctly
      console.log(`[QAStore] ⚠️ Intent mismatch (asked: ${queryIntent}, stored: ${storedIntent}) → Groq`)
      return { useGroq: true, contextAnswer: '', contextQuestion: '', question: query }
    }
  }

  // LOW score → Groq handles it fresh
  console.log(`[QAStore] Score too low (${topScore.toFixed(2)}) → Groq fresh`)
  return { useGroq: true, contextAnswer: '', contextQuestion: '', question: query }

}

// ─────────────────────────────────────────────────────────────────────────────
function getStoreInfo() {
  return {
    loaded:       isLoaded,
    totalVectors: qaArray.length,
    engine:       'all-MiniLM-L6-v2 Embeddings + Cosine Similarity',
    storePath:    STORE_PATH
  }
}

loadFromDisk()
module.exports = { buildIndex, searchAnswer, getStoreInfo, clearStore }
