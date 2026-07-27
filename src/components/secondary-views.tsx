"use client"

import { useEffect, useState } from "react"
import { getApiBase } from "@/utils/api"
import { useTheme } from "./theme-provider"

import { Clock, MoreHorizontal, Cpu, Bell, Shield, Palette, ChevronRight, Trash2, History, Sparkles, Moon, Sun, Laptop } from "lucide-react"

// ─── Session History Entry ────────────────────────────────────────────────────
type SessionEntry = {
  id: string
  date: string
  questionCount: number
  categories: string[]
  seniority?: string
}

function getStoredSessions(): SessionEntry[] {
  try {
    const raw = localStorage.getItem('aceify_sessions')
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function saveSession(questionCount: number, categories: string[], seniority?: string) {
  const sessions = getStoredSessions()
  const entry: SessionEntry = {
    id: crypto.randomUUID?.() ?? Date.now().toString(),
    date: new Date().toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true
    }),
    questionCount,
    categories,
    seniority,
  }
  sessions.unshift(entry) // newest first
  // Keep last 20 sessions
  if (sessions.length > 20) sessions.length = 20
  localStorage.setItem('aceify_sessions', JSON.stringify(sessions))
}

// ─── History View ─────────────────────────────────────────────────────────────
export function HistoryView() {
  const [sessions, setSessions] = useState<SessionEntry[]>([])

  useEffect(() => {
    setSessions(getStoredSessions())
  }, [])

  const removeSession = (id: string) => {
    const updated = sessions.filter(s => s.id !== id)
    setSessions(updated)
    localStorage.setItem('aceify_sessions', JSON.stringify(updated))
  }

  return (
    <div className="mx-auto flex h-full max-h-full w-full max-w-3xl flex-col px-8 pt-7 pb-4">
      <div className="shrink-0 mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">History</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {sessions.length > 0
            ? `${sessions.length} past session${sessions.length > 1 ? 's' : ''} · Your preparation journey`
            : 'Review past sessions and your preparation history.'
          }
        </p>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 pb-4 flex flex-col gap-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border/50 hover:[&::-webkit-scrollbar-thumb]:bg-border">
        {sessions.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card py-20 text-center">
            <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary/10">
              <History className="size-7 text-primary/50" />
            </div>
            <p className="text-sm font-semibold text-foreground">No sessions yet</p>
            <p className="mt-1.5 max-w-[260px] text-xs text-muted-foreground leading-relaxed">
              Generate your first Q&A bank from the Setup tab. Each session will be recorded here automatically.
            </p>
          </div>
        ) : (
          sessions.map((s) => (
            <div
              key={s.id}
              className="group flex items-center gap-4 rounded-xl border border-border bg-card p-3.5 transition-all hover:border-primary/30 hover:bg-secondary/40 hover:shadow-sm"
            >
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {s.questionCount} questions generated
                  {s.seniority && <span className="text-muted-foreground font-normal"> · {s.seniority}</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {s.date} · {s.categories.length > 0 ? s.categories.slice(0, 3).join(', ') : 'Mixed categories'}
                  {s.categories.length > 3 && ` +${s.categories.length - 3} more`}
                </p>
              </div>
              <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1">
                <span className="text-xs font-bold tabular-nums text-primary">{s.questionCount}</span>
                <span className="text-[9px] text-primary/60">Q&A</span>
              </div>
              <button
                onClick={() => removeSession(s.id)}
                aria-label="Remove session"
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export function SettingsView({ onClearHistory }: { onClearHistory?: () => void }) {
  const [clearing, setClearing] = useState(false)
  const { theme, setTheme } = useTheme()

  const [aiModel, setAiModel] = useState(() => localStorage.getItem("aceify_model") || "GPT-4o")
  const [notifications, setNotifications] = useState(() => localStorage.getItem("aceify_notif") || "On")
  const [privacy, setPrivacy] = useState(() => localStorage.getItem("aceify_privacy") || "Strict")

  const toggleModel = () => {
    const next = aiModel === "GPT-4o" ? "Claude 3.5" : "GPT-4o"
    setAiModel(next)
    localStorage.setItem("aceify_model", next)
  }

  const toggleNotif = () => {
    const next = notifications === "On" ? "Off" : "On"
    setNotifications(next)
    localStorage.setItem("aceify_notif", next)
  }

  const togglePrivacy = () => {
    const next = privacy === "Strict" ? "Standard" : "Strict"
    setPrivacy(next)
    localStorage.setItem("aceify_privacy", next)
  }

  const handleClearHistory = async () => {
    if (!window.confirm("Are you sure you want to clear the Q&A bank? You will need to regenerate your questions.")) return;
    setClearing(true)
    try {
      localStorage.removeItem('qaArray')
      localStorage.removeItem('aceify_sessions')
      const baseUrl = getApiBase()
      await fetch(`${baseUrl}/embed/clear`, { method: 'POST' })
      if (onClearHistory) onClearHistory()
    } catch (e) {
      console.error(e)
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className="mx-auto flex h-full max-h-full w-full max-w-3xl flex-col px-8 pt-7 pb-4">
      <div className="shrink-0 mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Configure how Aceify behaves during your interviews.</p>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 pb-4 flex flex-col gap-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border/50 hover:[&::-webkit-scrollbar-thumb]:bg-border">
        {/* Dynamic Theme Toggle */}
        <button
          onClick={() => {
            if (theme === 'dark') setTheme('light')
            else if (theme === 'light') setTheme('system')
            else setTheme('dark')
          }}
          className="group flex items-center gap-4 rounded-xl border border-border bg-card p-3.5 text-left transition-all hover:border-primary/30 hover:bg-secondary/40 hover:shadow-sm"
        >
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {theme === 'dark' ? <Moon className="size-4" /> : theme === 'light' ? <Sun className="size-4" /> : <Laptop className="size-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">App appearance</p>
            <p className="text-xs text-muted-foreground">Toggle light, dark, or system theme</p>
          </div>
          <span className="rounded-lg border border-border bg-secondary/60 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground capitalize">
            {theme}
          </span>
          <ChevronRight className="size-4 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
        </button>

        {/* AI Model Toggle */}
        <button
          onClick={toggleModel}
          className="group flex items-center gap-4 rounded-xl border border-border bg-card p-3.5 text-left transition-all hover:border-primary/30 hover:bg-secondary/40 hover:shadow-sm"
        >
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Cpu className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">AI Model</p>
            <p className="text-xs text-muted-foreground">Frontier model · Balanced latency</p>
          </div>
          <span className="rounded-lg border border-border bg-secondary/60 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
            {aiModel}
          </span>
          <ChevronRight className="size-4 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
        </button>

        {/* Notifications Toggle */}
        <button
          onClick={toggleNotif}
          className="group flex items-center gap-4 rounded-xl border border-border bg-card p-3.5 text-left transition-all hover:border-primary/30 hover:bg-secondary/40 hover:shadow-sm"
        >
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bell className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Notifications</p>
            <p className="text-xs text-muted-foreground">Session reminders & summaries</p>
          </div>
          <span className="rounded-lg border border-border bg-secondary/60 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
            {notifications}
          </span>
          <ChevronRight className="size-4 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
        </button>

        {/* Privacy Toggle */}
        <button
          onClick={togglePrivacy}
          className="group flex items-center gap-4 rounded-xl border border-border bg-card p-3.5 text-left transition-all hover:border-primary/30 hover:bg-secondary/40 hover:shadow-sm"
        >
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Shield className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Privacy</p>
            <p className="text-xs text-muted-foreground">Audio processed locally first</p>
          </div>
          <span className="rounded-lg border border-border bg-secondary/60 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
            {privacy}
          </span>
          <ChevronRight className="size-4 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
        </button>

        {/* Danger zone */}
        <div className="mt-6 pt-4 border-t border-border">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Danger Zone</p>
          <button
            onClick={handleClearHistory}
            disabled={clearing}
            className="group flex w-full items-center gap-4 rounded-xl border border-red-500/20 bg-red-500/[0.03] p-3.5 text-left transition-all hover:bg-red-500/10 hover:border-red-500/40 disabled:opacity-50"
          >
            <div className="flex size-10 items-center justify-center rounded-lg bg-red-500/15 text-red-500">
              <Trash2 className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-red-500">Reset everything</p>
              <p className="text-xs text-red-500/60">Wipe the Q&A bank, session history, and reset to fresh</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
