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
  const nav: { id: NavItem; label: string; icon: typeof UploadCloud; show: boolean; badge?: number }[] = [
    { id: "setup", label: "Setup", icon: UploadCloud, show: true },
    { id: "qabank", label: "Q&A Bank", icon: Library, show: hasQaBank, badge: qaCount },
    { id: "history", label: "History", icon: History, show: true },
    { id: "settings", label: "Settings", icon: Settings, show: true },
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
                  "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-all",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge ? (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                      isActive ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
                    )}
                  >
                    {item.badge}
                  </span>
                ) : null}
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
            AS
          </div>
          <div className="leading-tight">
            <p className="text-xs font-semibold text-foreground">alt-hell</p>
            <p className="text-[10px] text-muted-foreground">[sohail14581@gmail.com]</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
