const WebSocket = require('ws')

// Helper to wrap raw 16-bit PCM in a valid WAV header
function wrapWavHeader(pcmBuffer, sampleRate = 16000) {
  const numChannels = 1
  const bitsPerSample = 16
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
  const blockAlign = numChannels * (bitsPerSample / 8)
  const dataSize = pcmBuffer.length
  const fileSize = 36 + dataSize

  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(fileSize, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16) // Subchunk1Size
  header.writeUInt16LE(1, 20)  // AudioFormat (PCM)
  header.writeUInt16LE(numChannels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitsPerSample, 34)
  header.write('data', 36)
  header.writeUInt32LE(dataSize, 40)

  return Buffer.concat([header, pcmBuffer])
}

function setupSarvamWebSocket(server) {
  // Create a WebSocket Server attached to the Express HTTP server
  const wss = new WebSocket.Server({ server, path: '/stt-stream' })

  wss.on('connection', (ws) => {
    console.log('[WS] Client connected for STT stream')

    let sarvamWs = null
    let isSarvamReady = false

    // 1. Establish connection to Sarvam (model/mode passed as query params)
    const SARVAM_API_KEY = process.env.SARVAM_API_KEY
    if (!SARVAM_API_KEY) {
      console.error('[WS] SARVAM_API_KEY is missing in .env')
      ws.close(1011, 'Server configuration error')
      return
    }

    const sarvamUrl = 'wss://api.sarvam.ai/speech-to-text-translate/ws?model=saaras:v3&mode=transcribe&language_code=en-IN'
    sarvamWs = new WebSocket(sarvamUrl, {
      headers: { 'api-subscription-key': SARVAM_API_KEY }
    })

    sarvamWs.on('open', () => {
      console.log('✅ Connected to Sarvam Saaras V3')
      isSarvamReady = true
      
      // Tell frontend we are ready
      ws.send(JSON.stringify({ type: 'server_ready' }))
    })

    sarvamWs.on('message', (data) => {
      try {
        const response = JSON.parse(data.toString())
        console.log('[Sarvam WS] Received:', JSON.stringify(response))
        
        // Pass relevant events back to the frontend.
        // Sarvam usually sends "type": "data" or "transcript_partial"
        ws.send(JSON.stringify(response))
      } catch (err) {
        console.error('[WS] Error parsing Sarvam message:', err)
      }
    })

    sarvamWs.on('close', () => {
      console.log('🔌 Sarvam connection closed.')
      isSarvamReady = false
      if (ws.readyState === WebSocket.OPEN) {
        ws.close()
      }
    })

    sarvamWs.on('error', (err) => {
      console.error('❌ Sarvam error:', err)
    })

    // 2. Handle audio binary data from the frontend
    ws.on('message', (message) => {
      if (Buffer.isBuffer(message)) {
        if (isSarvamReady && sarvamWs.readyState === WebSocket.OPEN) {
          // Pipe audio to Sarvam as base64 JSON
          const wavBuffer = wrapWavHeader(message, 16000)
          const payload = {
            audio: {
              data: wavBuffer.toString('base64'),
              sample_rate: 16000,
              encoding: "audio/wav"
            }
          }
          sarvamWs.send(JSON.stringify(payload))
        }
      }
    })

    ws.on('close', () => {
      console.log('[WS] Client disconnected')
      if (sarvamWs && sarvamWs.readyState === WebSocket.OPEN) {
        sarvamWs.close()
      }
    })
  })

  console.log('[WS] WebSocket server attached on /stt-stream')
}

module.exports = { setupSarvamWebSocket }
