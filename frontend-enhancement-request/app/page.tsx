"use client"

import { useState } from "react"
import { AppSidebar, type NavItem } from "@/components/app-sidebar"
import { SetupView } from "@/components/setup-view"
import { QABankView } from "@/components/qabank-view"
import { HistoryView, SettingsView } from "@/components/secondary-views"
import { LiveOverlay } from "@/components/live-overlay"
import { GENERATED_QA, type QAItem } from "@/lib/interview-data"
import { Maximize2, Minus, X } from "lucide-react"

export default function Page() {
  const [nav, setNav] = useState<NavItem>("setup")
  const [qa, setQa] = useState<QAItem[] | null>(null)
  const [overlayOpen, setOverlayOpen] = useState(true)

  return (
    <main className="grid-bg relative flex min-h-dvh flex-col items-center bg-background p-6 pt-24">
      <div className="my-auto w-full max-w-5xl">
        <MainWindow
          nav={nav}
          setNav={setNav}
          qa={qa}
          onGenerated={(result) => {
            setQa(result)
            setNav("qabank")
            setOverlayOpen(true)
          }}
        />
      </div>

      {/* The always-on-top, draggable invisible screen / live overlay */}
      <LiveOverlay script={qa ?? GENERATED_QA} open={overlayOpen} onOpenChange={setOverlayOpen} />
    </main>
  )
}

function MainWindow({
  nav,
  setNav,
  qa,
  onGenerated,
}: {
  nav: NavItem
  setNav: (n: NavItem) => void
  qa: QAItem[] | null
  onGenerated: (items: QAItem[]) => void
}) {
  return (
    <div className="relative z-10 flex h-[660px] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-slate-900/10">
      {/* Window title bar */}
      <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="size-3 rounded-full bg-red-400" />
          <span className="size-3 rounded-full bg-amber-400" />
          <span className="size-3 rounded-full bg-emerald-400" />
        </div>
        <span className="text-xs font-medium text-muted-foreground">Aceify — Interview Assistant</span>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Minus className="size-3.5" />
          <Maximize2 className="size-3" />
          <X className="size-3.5" />
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar active={nav} onChange={setNav} hasQaBank={!!qa} qaCount={qa?.length ?? 0} />
        <div className="flex-1 overflow-y-auto bg-background">
          {nav === "setup" && <SetupView onGenerated={onGenerated} />}
          {nav === "qabank" && qa && <QABankView qa={qa} />}
          {nav === "history" && <HistoryView />}
          {nav === "settings" && <SettingsView />}
        </div>
      </div>
    </div>
  )
}
