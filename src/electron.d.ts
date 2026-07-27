// Global type declaration for the Electron contextBridge API
// This matches exactly what is exposed in electron/preload.js

export {}

declare global {
  interface Window {
    electron?: {
      // ── Overlay Window Controls ──
      showAnswer:        (data: unknown) => void
      toggleOverlay:     (visible: boolean) => void
      closeOverlay:      () => void
      moveOverlay:       (pos: { x: number; y: number }) => void
      moveByDelta:       (delta: { dx: number; dy: number }) => void
      resizeOverlay:     (size: { width: number; height: number }) => void
      resizeByDelta:     (delta: { dx: number; dy: number }) => void
      setOverlaySize:    (size: { width: number; height: number }) => void
      setMouseEvents:    (ignore: boolean) => void
      setMinSize:        (size: { width: number; height: number }) => void
      setResizable:      (resizable: boolean) => void

      // ── Main Window Controls ──
      closeMainWindow:   () => void
      launchOverlay:     () => void

      // ── Desktop Capturer ──
      getDesktopSources: () => Promise<Array<{ id: string; name: string }>>

      // ── Answer Events ──
      onDisplayAnswer:      (callback: (data: unknown) => void) => void
      removeAnswerListener: () => void

      // ── Global Visibility Toggle ──
      onToggleVisibilityGlobal:             (callback: () => void) => void
      removeToggleVisibilityGlobalListener: () => void

      // ── Backend Port Discovery ──
      getBackendPort:  () => Promise<number>
      onBackendPort:   (callback: (port: number) => void) => void
    }
  }
}
