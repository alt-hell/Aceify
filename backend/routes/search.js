const express = require('express')
const router  = express.Router()
const { searchAnswer, getStoreInfo } = require('../vectorStore/qaStore')

// POST /search — semantic search with Groq re-ranker
// searchAnswer is now async (it calls Groq re-ranker internally)
router.post('/', async (req, res) => {
  const { question, isPartial } = req.body

  if (!question || question.trim().length < 3) {
    return res.status(400).json({ error: 'Question text is required (min 3 chars)' })
  }

  const info = getStoreInfo()
  if (!info.loaded || info.totalVectors === 0) {
    return res.status(400).json({
      error:      'No Q&A bank found. Please generate your Q&A bank first.',
      needsSetup: true
    })
  }

  try {
    // await is critical — searchAnswer now calls Groq re-ranker async
    const result = await searchAnswer(question.trim(), isPartial)
    // If result is null (e.g. partial query but no high confidence match), return success: false
    if (!result) {
      return res.json({ success: false })
    }
    res.json({ success: true, data: result })
  } catch (error) {
    console.error('[Search] Error:', error)
    res.status(500).json({ error: 'Search failed', details: error.message })
  }
})

// GET /search/status — check if Q&A bank is ready
router.get('/status', (req, res) => {
  res.json(getStoreInfo())
})

module.exports = router
