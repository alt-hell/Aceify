const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electron', {
  showAnswer:        (data)      => ipcRenderer.send('show-answer', data),
  toggleOverlay:     (visible)   => ipcRenderer.send('toggle-overlay', visible),
  closeOverlay:      ()          => ipcRenderer.send('close-overlay'),
  moveOverlay:       (pos)       => ipcRenderer.send('move-overlay', pos),
  moveByDelta:       (delta)     => ipcRenderer.send('move-by-delta', delta),
  resizeOverlay:     (size)      => ipcRenderer.send('resize-overlay', size),
  resizeByDelta:     (delta)     => ipcRenderer.send('resize-by-delta', delta),
  setOverlaySize:    (size)      => ipcRenderer.send('set-overlay-size', size),
  setMouseEvents:    (ignore)    => ipcRenderer.send('set-mouse-events', ignore),
  setMinSize:        (size)      => ipcRenderer.send('set-overlay-min-size', size),
  setResizable:      (resizable) => ipcRenderer.send('set-overlay-resizable', resizable),
  closeMainWindow:   ()          => ipcRenderer.send('close-main-window'),
  launchOverlay:     ()          => ipcRenderer.send('launch-overlay'),

  // ── Desktop Capturer — used to get screen sources for system audio capture ──
  // Renderer calls this to get sourceId, then uses getUserMedia with chromeMediaSource
  getDesktopSources: () => ipcRenderer.invoke('get-desktop-sources'),

  onDisplayAnswer:      (callback) => {
    ipcRenderer.removeAllListeners('display-answer')
    ipcRenderer.on('display-answer', (event, data) => callback(data))
  },
  removeAnswerListener: () => ipcRenderer.removeAllListeners('display-answer'),

  onToggleVisibilityGlobal: (callback) => {
    ipcRenderer.removeAllListeners('toggle-visibility-global')
    ipcRenderer.on('toggle-visibility-global', () => callback())
  },
  removeToggleVisibilityGlobalListener: () => ipcRenderer.removeAllListeners('toggle-visibility-global'),

  // ── Backend Port — dynamic port discovery ──
  getBackendPort:   ()         => ipcRenderer.invoke('get-backend-port'),
  onBackendPort:    (callback) => {
    ipcRenderer.removeAllListeners('backend-port')
    ipcRenderer.on('backend-port', (event, port) => callback(port))
  }
})

