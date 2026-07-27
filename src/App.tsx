import { HashRouter as Router, Routes, Route } from 'react-router-dom'
import { useState, useEffect, useCallback } from "react"
import Overlay from './components/Overlay'
import { cn } from "./lib/utils"

// New Modern UI Components
import { AppSidebar, type NavItem } from "./components/app-sidebar"
import { SetupView } from "./components/setup-view"
import { QABankView } from "./components/qabank-view"
import { HistoryView, SettingsView, saveSession } from "./components/secondary-views"
import { ThemeProvider } from "./components/theme-provider"

import { type QAItem } from "./lib/interview-data"
import { Login } from "./pages/login"

function MainWindow({
  nav,
  setNav,
  qa,
  onGenerated,
  onClearHistory,
}: {
  nav: NavItem
  setNav: (n: NavItem) => void
  qa: QAItem[] | null
  onGenerated: (items: QAItem[]) => void
  onClearHistory: () => void
}) {
  // Track previous nav for transition direction
  const [animKey, setAnimKey] = useState(0)
  const handleNavChange = useCallback((n: NavItem) => {
    setAnimKey(k => k + 1)
    setNav(n)
  }, [setNav])

  // Keyboard shortcuts: Ctrl+1..4
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      const items: NavItem[] = ["setup", "qabank", "history", "settings"]
      const idx = parseInt(e.key) - 1
      if (idx >= 0 && idx < items.length) {
        if (items[idx] === "qabank" && !qa) return // can't switch to qabank if no data
        handleNavChange(items[idx])
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleNavChange, qa])

  return (
    <div className="relative z-10 flex h-full min-h-0 w-full flex-col overflow-hidden bg-card">
      {/* Window title bar (Drag Handle) */}
      <div className="flex h-[32px] shrink-0 items-center justify-center border-b border-border bg-secondary/40" style={{ WebkitAppRegion: 'drag' } as any}>
        <span className="text-xs font-medium text-muted-foreground">Aceify — Interview Assistant</span>
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1 overflow-hidden" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <AppSidebar active={nav} onChange={handleNavChange} hasQaBank={!!qa} qaCount={qa?.length ?? 0} />
        <div className="min-h-0 flex-1 overflow-hidden aurora-bg" key={animKey}>
          <div className={nav === "setup" ? "block h-full animate-fade-up" : "hidden"}>
            <SetupView onGenerated={onGenerated} />
          </div>
          <div className={nav === "qabank" && qa ? "block h-full animate-fade-up" : "hidden"}>
            {qa && <QABankView qa={qa} />}
          </div>
          <div className={nav === "history" ? "block h-full animate-fade-up" : "hidden"}>
            <HistoryView />
          </div>
          <div className={nav === "settings" ? "block h-full animate-fade-up" : "hidden"}>
            <SettingsView onClearHistory={onClearHistory} />
          </div>
        </div>
      </div>
    </div>
  )
}

function MainApp() {
  const [nav, setNav] = useState<NavItem>("setup")
  const [qa, setQa] = useState<QAItem[] | null>(null)

  // Attempt to load existing QA from local storage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('qaArray')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed && parsed.length > 0) {
          setQa(parsed)
          setNav("qabank")
        }
      }
    } catch(e) {}
  }, [])

  return (
    <main className="relative flex h-screen w-screen flex-col bg-background">
      <MainWindow
        nav={nav}
        setNav={setNav}
        qa={qa}
        onGenerated={(items) => {
          setQa(items)
          setNav("qabank")

          // Save session to history
          const categories = Array.from(new Set(items.map(q => q.category)))
          saveSession(items.length, categories)

          // Close the main setup window after Q&A is generated.
          setTimeout(() => {
            if (window.electron?.closeMainWindow) {
              window.electron.closeMainWindow()
            }
          }, 1500)
        }}
        onClearHistory={() => {
          setQa(null)
          setNav("setup")
        }}
      />
    </main>
  )
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const isDev = (import.meta as any).env.MODE === 'development'
        const baseUrl = isDev ? 'http://localhost:3001' : ''
        const res = await fetch(`${baseUrl}/auth/status`)
        const data = await res.json()
        setIsAuthenticated(data.authenticated)
      } catch (e) {
        setIsAuthenticated(false)
      } finally {
        setIsChecking(false)
      }
    }
    checkAuth()

    // Poll every 5 seconds for overlay window to sync auth status
    const interval = setInterval(checkAuth, 5000)
    return () => clearInterval(interval)
  }, [])

  if (isChecking) {
    return (
      <div className="h-screen w-screen bg-background flex flex-col items-center justify-center gap-3">
        <div className="size-8 rounded-xl bg-primary/20 animate-pulse flex items-center justify-center">
          <span className="text-primary text-sm">✦</span>
        </div>
        <span className="text-sm text-muted-foreground">Loading Aceify…</span>
      </div>
    )
  }

  return (
    <ThemeProvider defaultTheme="dark" storageKey="aceify-ui-theme">
      <Router>
        <Routes>
          <Route path="/overlay" element={isAuthenticated ? <Overlay /> : null} />
          <Route
            path="/"
            element={isAuthenticated ? <MainApp /> : <Login onLogin={() => setIsAuthenticated(true)} />}
          />
        </Routes>
      </Router>
    </ThemeProvider>
  )
}
