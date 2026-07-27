class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.buffer = new Float32Array(2048)
    this.bufferIndex = 0
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0]
    if (input.length > 0) {
      const channelData = input[0] // Left channel only (mono)
      for (let i = 0; i < channelData.length; i++) {
        this.buffer[this.bufferIndex++] = channelData[i]

        // When buffer is full, send to main thread
        if (this.bufferIndex >= this.buffer.length) {
          // Send a copy
          this.port.postMessage(this.buffer.slice(0))
          this.bufferIndex = 0
        }
      }
    }
    return true // Keep processor alive
  }
}

registerProcessor('audio-processor', AudioProcessor)
