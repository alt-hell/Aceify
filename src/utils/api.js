// Shared utility — returns the correct backend base URL and WebSocket URL
// Works in both browser (dev) and Electron (prod) modes

let _port = 3001

// In Electron, get the real port from main process
if (window.electron?.getBackendPort) {
  window.electron.getBackendPort().then(port => {
    if (port) _port = port
  })
  window.electron.onBackendPort?.((port) => {
    _port = port
    console.log(`[api] Backend port updated to ${port}`)
  })
}

export function getApiBase() {
  return `http://localhost:${_port}`
}

export function getWsBase() {
  return `ws://localhost:${_port}`
}
