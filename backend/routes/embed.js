const express = require('express')
const router  = express.Router()
const { buildIndex, clearStore } = require('../vectorStore/qaStore')

router.post('/', async (req, res) => {
  const { qaArray } = req.body

  if (!qaArray || !Array.isArray(qaArray) || qaArray.length === 0) {
    return res.status(400).json({ error: 'qaArray is required and must be a non-empty array' })
  }

  try {
    console.log(`[Embed] Building Semantic index for ${qaArray.length} Q&A pairs...`)
    const result = await buildIndex(qaArray)  // Generates embeddings
    console.log(`[Embed] Done — ${result.count} questions indexed`)

    res.json({
      success: true,
      message: `BM25 index built with ${result.count} questions`,
      count:   result.count,
      engine:  'BM25 (offline)'
    })
  } catch (error) {
    console.error('[Embed] Error:', error)
    res.status(500).json({ error: 'Failed to build index', details: error.message })
  }
})

router.post('/clear', (req, res) => {
  try {
    const result = clearStore()
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear store', details: error.message })
  }
})

module.exports = router
