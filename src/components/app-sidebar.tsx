"use client"

import { cn } from "@/lib/utils"
import { History, Library, Settings, Sparkles, UploadCloud, Zap } from "lucide-react"

export type NavItem = "setup" | "qabank" | "history" | "settings"

export function AppSidebar({
  active,
  onChange,
  hasQaBank,
  qaCount,
}: {
  active: NavItem
  onChange: (item: NavItem) => void
  hasQaBank: boolean
  qaCount: number
}) {
  const nav: { id: NavItem; label: string; icon: typeof UploadCloud; show: boolean; badge?: number; shortcut: string }[] = [
    { id: "setup", label: "Setup", icon: UploadCloud, show: true, shortcut: "1" },
    { id: "qabank", label: "Q&A Bank", icon: Library, show: hasQaBank, badge: qaCount, shortcut: "2" },
    { id: "history", label: "History", icon: History, show: true, shortcut: "3" },
    { id: "settings", label: "Settings", icon: Settings, show: true, shortcut: "4" },
  ]

  return (
    <aside className="flex w-[230px] shrink-0 flex-col border-r border-border bg-sidebar">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 py-4">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary glow-blue">
          <Sparkles className="size-4 text-primary-foreground" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-tight text-foreground">Aceify</p>
          <p className="text-[11px] text-muted-foreground">Interview Copilot</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 px-3 py-2">
        <p className="px-2 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          Workspace
        </p>
        {nav
          .filter((i) => i.show)
          .map((item) => {
            const Icon = item.icon
            const isActive = active === item.id
            return (
              <button
                key={item.id}
                onClick={() => onChange(item.id)}
                className={cn(
                  "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                {/* Active indicator bar */}
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-primary shadow-[0_0_8px_2px_rgba(var(--primary),0.3)] transition-all" />
                )}
                <Icon className={cn("size-4 transition-colors", isActive && "text-primary")} />
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge ? (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums transition-colors",
                      isActive ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
                    )}
                  >
                    {item.badge}
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground/30 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                    ⌘{item.shortcut}
                  </span>
                )}
              </button>
            )
          })}
      </nav>

      <div className="mt-auto p-3">
        <div className="rounded-xl border border-border bg-gradient-to-br from-primary/[0.06] to-accent/[0.05] p-3">
          <div className="mb-1 flex items-center gap-1.5">
            <Zap className="size-3.5 text-primary" />
            <span className="text-xs font-semibold text-foreground">Pro Plan</span>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Unlimited live sessions and frontier-model suggestions.
          </p>
        </div>
        <div className="mt-3 flex items-center gap-2 px-1">
          <div className="flex size-8 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
            AH
          </div>
          <div className="leading-tight">
            <p className="text-xs font-semibold text-foreground">alt-hell</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
