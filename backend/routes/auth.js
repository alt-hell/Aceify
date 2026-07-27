const express = require('express')
const router  = express.Router()
const authConfig = require('../config/auth')

// Store in memory so it naturally resets when the app (and backend) restarts
let isAuthenticated = false;

router.post('/login', (req, res) => {
  const { userId, password } = req.body

  if (userId === authConfig.USER_ID && password === authConfig.PASSWORD) {
    isAuthenticated = true
    res.json({ success: true, token: 'authenticated' })
  } else {
    res.status(401).json({ success: false, error: 'Invalid User ID or Password' })
  }
})

router.get('/status', (req, res) => {
  res.json({ authenticated: isAuthenticated })
})

module.exports = router
