const { app, BrowserWindow, ipcMain, screen, session, desktopCapturer, globalShortcut, Tray, Menu, nativeImage } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
require('dotenv').config({ path: path.join(__dirname, '../.env') })

let mainWindow
let overlayWindow
let backendProcess
let tray = null
let isQuitting = false
let actualBackendPort = 3001 // Default, updated when backend logs its real port

// ── SINGLE INSTANCE LOCK ──────────────────────────────────────────────────────
// This is the CRITICAL fix that prevents multiple invisible screens.
// If the user clicks the app icon while it is already running, this code
// kills the new copy immediately and brings the existing window to focus.
// Without this, every launch stacks another invisible overlay on the screen.
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  // A copy is already running — quit this new instance immediately
  app.quit()
} else {
  // We are the first (and only) instance. If another instance tries to launch,
  // focus our existing main window instead.
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

// Uncomment below if overlay appears black on your PC:
// app.disableHardwareAcceleration()

// ── START BACKEND SERVER ──
function startBackend() {
  // Backend is now uniformly located inside the app package in both dev and prod
  const backendPath = path.join(__dirname, '../backend/server.js')

  const backend = spawn(process.execPath, [backendPath], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      ...(app.isPackaged ? { USER_DATA_PATH: app.getPath('userData') } : {})
    },
    detached: false
  })

  backendProcess = backend

  backend.stdout.on('data', (d) => {
    const msg = d.toString()
    console.log(`[Backend]: ${msg}`)
    // Detect the actual port the backend bound to
    const portMatch = msg.match(/Server running on port (\d+)/)
    if (portMatch) {
      actualBackendPort = parseInt(portMatch[1], 10)
      console.log(`[Electron] Backend port detected: ${actualBackendPort}`)
      // Notify all open renderer windows of the real port
      if (mainWindow) mainWindow.webContents.send('backend-port', actualBackendPort)
      if (overlayWindow) overlayWindow.webContents.send('backend-port', actualBackendPort)
    }
  })
  backend.stderr.on('data', (d) => console.error(`[Backend Error]: ${d}`))
  backend.on('error', (err) => console.error(`[Backend Spawn Error]:`, err))
  backend.on('exit', (code, signal) => console.log(`[Backend Exited] Code: ${code}, Signal: ${signal}`))
}

// ── WAIT FOR BACKEND TO BE READY ──
async function waitForBackend() {
  const { default: fetch } = await import('node-fetch')
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://localhost:${actualBackendPort}/health`)
      if (res.ok) { console.log('[Electron] Backend ready!'); return true }
    } catch {}
    await new Promise(r => setTimeout(r, 500))
  }
  return false
}

// ── CREATE MAIN WINDOW ──
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 650,
    backgroundColor: '#EFF4FF',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#ffffff',
      symbolColor: '#2563EB',
      height: 32
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // ✅ NO DevTools auto-open — interviewer cannot see debug windows
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    // DevTools disabled — open manually with Ctrl+Shift+I if needed
  } else {
    // CRITICAL: We MUST load from localhost (via the Express backend) instead of file://
    // This allows relative `fetch('/auth/login')` calls to succeed in the packaged app!
    mainWindow.loadURL(`http://localhost:${actualBackendPort}/index.html`)
  }

  mainWindow.on('closed', () => { mainWindow = null })
}

// ── CREATE OVERLAY WINDOW ──
function createOverlayWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  overlayWindow = new BrowserWindow({
    width: 230,
    height: 64,
    x: width - 250,
    y: 60,
    transparent: true,       // True transparency — see through the window
    frame: false,            // No OS border/titlebar
    alwaysOnTop: true,       // Always above Zoom, Meet, Teams
    skipTaskbar: true,       // Hidden from taskbar
    hasShadow: false,        // CRITICAL: Must be false to prevent Windows OS from drawing a visible ghost border/shadow around the invisible window
    focusable: true,
    resizable: false,        // CRITICAL: Setting this to true causes Windows to draw invisible resize borders (the <-> cursor ghost edges you are seeing)
    movable: true,           // Native OS drag to move
    minWidth: 100,
    minHeight: 38,
    maxWidth: 900,
    maxHeight: 1000,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // ── SCREEN SHARE PROTECTION ──
  // Makes overlay 100% invisible to Zoom, Meet, Teams, OBS at Windows DWM level
  // Interviewee CANNOT see this window even on screen share
  overlayWindow.setContentProtection(true)

  // ✅ DO NOT call setIgnoreMouseEvents — overlay must behave like a normal desktop app
  // User drags it by header, resizes from edges, clicks buttons freely

  if (process.env.NODE_ENV === 'development') {
    overlayWindow.loadURL('http://localhost:5173/#/overlay')
  } else {
    // ── CRITICAL: Must load via http://localhost, NOT file:// ──────────────────
    // Chromium only grants navigator.mediaDevices + AudioWorklet to 'secure contexts'.
    // file:// is NOT a secure context. http://localhost IS always treated as secure.
    // The Express backend serves the built React files via express.static.
    overlayWindow.loadURL(`http://localhost:${actualBackendPort}/index.html#/overlay`)
  }

  // ── ALLOW getDisplayMedia IN OVERLAY (system audio capture for Meet/Zoom) ──
  // Without this handler, Electron blocks getDisplayMedia with "Not supported".
  // This grants permission and lets the browser's native screen picker appear.
  overlayWindow.webContents.session.setDisplayMediaRequestHandler(
    (request, callback) => {
      desktopCapturer.getSources({ types: ['screen'] }).then(sources => {
        // Pass the first screen source — browser's native audio picker still appears
        callback({ video: sources[0], audio: 'loopback' })
      }).catch(() => {
        callback({})
      })
    },
    { useSystemPicker: true }  // Use native OS screen picker (more reliable)
  )
}

// ── APP LIFECYCLE ──
// Single whenReady block — permissions MUST be set before windows are created.
app.whenReady().then(async () => {
  try {
    // ── GRANT MICROPHONE / CAMERA PERMISSIONS ──
    // Without these handlers, Chromium blocks getUserMedia even with webSecurity:false.
    const GRANTED = ['media', 'microphone', 'camera', 'audioCapture', 'videoCapture']

    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      callback(GRANTED.includes(permission))
    })

    session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
      return GRANTED.includes(permission)
    })

    session.defaultSession.setDevicePermissionHandler(() => {
      return true
    })

    // Start backend, then create ONLY the main window.
    // The overlay window is created ONLY after Q&A is generated (via IPC from the renderer).
    // This guarantees there is NEVER more than 1 window on screen at any given time.
    startBackend()
    const ready = await waitForBackend()
    if (ready) {
      createMainWindow()
    } else {
      setTimeout(() => {
        createMainWindow()
      }, 5000)
    }

    // ── SYSTEM TRAY ──
    // Create an empty icon (or you could load a real one from path.join(__dirname, 'icon.png'))
    const icon = nativeImage.createEmpty()
    tray = new Tray(icon)
    tray.setToolTip('Aceify Interview Assistant')

    const contextMenu = Menu.buildFromTemplate([
      { label: 'Show Main Window', click: () => {
          if (!mainWindow) createMainWindow()
          else mainWindow.show()
      }},
      { label: 'Show Overlay Toolbar (Ctrl+Shift+H)', click: () => {
          if (overlayWindow) {
            if (overlayWindow.isVisible()) overlayWindow.hide()
            else overlayWindow.show()
          }
      }},
      { type: 'separator' },
      { label: 'Quit', click: () => {
          isQuitting = true
          app.quit()
      }}
    ])
    tray.setContextMenu(contextMenu)

    // Register global shortcut to completely hide/show the invisible overlay screen
    globalShortcut.register('CommandOrControl+Shift+H', () => {
      if (overlayWindow) {
        if (overlayWindow.isVisible()) {
          overlayWindow.hide()
        } else {
          overlayWindow.show()
        }
      }
    })
  } catch (error) {
    console.error("[Electron] CRITICAL STARTUP ERROR:", error)
  }
})

// ── IPC: GET DESKTOP SOURCES (for system audio capture fallback) ──
ipcMain.handle('get-desktop-sources', async () => {
  const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] })
  return sources.map(s => ({ id: s.id, name: s.name }))
})

// ── IPC: GET BACKEND PORT ──
ipcMain.handle('get-backend-port', () => actualBackendPort)

// ── IPC: SEND ANSWER TO OVERLAY ──
ipcMain.on('show-answer', (event, data) => {
  if (overlayWindow) overlayWindow.webContents.send('display-answer', data)
})

// ── IPC: TOGGLE OVERLAY VISIBILITY ──
ipcMain.on('toggle-overlay', (event, visible) => {
  if (overlayWindow) {
    visible ? overlayWindow.showInactive() : overlayWindow.hide()
  }
})

// ── IPC: MOVE OVERLAY ──
ipcMain.on('move-overlay', (event, { x, y }) => {
  if (overlayWindow) overlayWindow.setPosition(x, y)
})

// ── IPC: MOVE OVERLAY BY DELTA ──
ipcMain.on('move-by-delta', (event, { dx, dy }) => {
  if (overlayWindow) {
    const [x, y] = overlayWindow.getPosition()
    overlayWindow.setPosition(Math.round(x + dx), Math.round(y + dy))
  }
})

// IPC: set-mouse-events kept for backward compat but not used in normal flow
ipcMain.on('set-mouse-events', (event, ignore) => {
  // No-op: overlay is always interactive (full desktop app behavior)
})

// ── IPC: CLOSE OVERLAY FROM BUTTON ──
ipcMain.on('close-overlay', () => {
  if (overlayWindow) overlayWindow.hide()
})

// ── IPC: CLOSE MAIN WINDOW AFTER QA GENERATED ──
// Closes the setup window and THEN creates the overlay toolbar for the first time.
// From this point there is exactly ONE window: the floating toolbar.
ipcMain.on('close-main-window', () => {
  if (mainWindow) {
    mainWindow.close()
    mainWindow = null
  }
  // Now create the overlay toolbar for the first time
  if (!overlayWindow) {
    createOverlayWindow()
  }
})

// ── IPC: LAUNCH OVERLAY (triggered by the "Live overlay active" button in QA Bank) ──
// Creates the floating toolbar if it doesn't exist yet.
// This is the MANUAL trigger — user clicks the button to launch the invisible screen.
ipcMain.on('launch-overlay', () => {
  if (!overlayWindow) {
    createOverlayWindow()
  } else {
    // Already exists — just make sure it is visible
    overlayWindow.show()
  }
})

// ── IPC: RESIZE OVERLAY BY DELTA (used by corner grip drag) ──
ipcMain.on('resize-by-delta', (event, { dx, dy }) => {
  if (overlayWindow) {
    const [w, h] = overlayWindow.getSize()
    const newW = Math.max(280, Math.min(900, w + dx))
    const newH = Math.max(180, Math.min(1000, h + dy))
    overlayWindow.setSize(newW, newH)
  }
})

// ── IPC: SET OVERLAY TO PRESET SIZE ──
ipcMain.on('set-overlay-size', (event, { width, height }) => {
  if (overlayWindow) {
    overlayWindow.setSize(width, height)
  }
})

// ── IPC: SET OVERLAY MIN SIZE ──
ipcMain.on('set-overlay-min-size', (event, { width, height }) => {
  if (overlayWindow) {
    overlayWindow.setMinimumSize(width, height)
  }
})

// ── IPC: SET OVERLAY RESIZABLE ──
ipcMain.on('set-overlay-resizable', (event, resizable) => {
  if (overlayWindow) {
    overlayWindow.setResizable(resizable)
  }
})

// ── CLEANUP ──
app.on('before-quit', () => {
  globalShortcut.unregisterAll()
  if (backendProcess) backendProcess.kill()
})
app.on('window-all-closed', () => {
  // If the user hasn't explicitly clicked Quit, keep the app alive in the Tray!
  if (isQuitting) {
    if (backendProcess) backendProcess.kill()
    app.quit()
  }
})
app.on('activate', () => {
  if (!mainWindow) createMainWindow()
})
