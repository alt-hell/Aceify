"use client"

import { Clock, MoreHorizontal, Cpu, Bell, Shield, Palette, ChevronRight } from "lucide-react"

const SESSIONS = [
  { role: "Senior Frontend Engineer", company: "Vercel", date: "Today · 2:14 PM", q: 24, score: 92 },
  { role: "Full-Stack Developer", company: "Linear", date: "Yesterday", q: 18, score: 88 },
  { role: "React Engineer", company: "Stripe", date: "Jun 9", q: 31, score: 95 },
  { role: "Platform Engineer", company: "Neon", date: "Jun 6", q: 12, score: 81 },
]

export function HistoryView() {
  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-8 py-7">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">History</h1>
      <p className="mt-1 text-sm text-muted-foreground">Review past sessions and your answer performance.</p>

      <div className="mt-6 flex flex-col gap-2">
        {SESSIONS.map((s) => (
          <div
            key={s.role + s.date}
            className="group flex items-center gap-4 rounded-xl border border-border bg-card p-3.5 transition-colors hover:border-primary/30 hover:bg-secondary/40"
          >
            <div className="flex size-10 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
              <Clock className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{s.role}</p>
              <p className="text-xs text-muted-foreground">
                {s.company} · {s.date} · {s.q} questions
              </p>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-mono text-sm font-semibold text-emerald-600">{s.score}</span>
              <span className="text-[10px] text-muted-foreground">/100</span>
            </div>
            <button
              aria-label="More options"
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-secondary group-hover:opacity-100"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

const SETTINGS = [
  { icon: Cpu, title: "AI Model", desc: "Frontier model · Balanced latency", value: "Pro" },
  { icon: Palette, title: "Overlay appearance", desc: "Glass · Light theme", value: "Light" },
  { icon: Bell, title: "Notifications", desc: "Session reminders & summaries", value: "On" },
  { icon: Shield, title: "Privacy", desc: "Audio processed locally first", value: "Strict" },
]

export function SettingsView() {
  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-8 py-7">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">Configure how Aceify behaves during your interviews.</p>

      <div className="mt-6 flex flex-col gap-2">
        {SETTINGS.map((s) => {
          const Icon = s.icon
          return (
            <button
              key={s.title}
              className="group flex items-center gap-4 rounded-xl border border-border bg-card p-3.5 text-left transition-colors hover:border-primary/30 hover:bg-secondary/40"
            >
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{s.title}</p>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
              </div>
              <span className="rounded-md border border-border bg-secondary px-2 py-1 text-[11px] font-medium text-muted-foreground">
                {s.value}
              </span>
              <ChevronRight className="size-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
            </button>
          )
        })}
      </div>
    </div>
  )
}
