"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { CodeBlock } from "@/components/code-block"
import type { QAItem } from "@/lib/interview-data"
import { ChevronDown, LayoutList, Search, Sparkles, CheckCircle2, Hash } from "lucide-react"

// ─── Enhanced Markdown Parser ──────────────────────────────────────────────────
// Handles: **bold**, `inline code`, - bullets, 1. numbered lists, ### headings
function FormattedText({ text }: { text: string }) {
  const lines = text.split('\n')

  return (
    <div className="text-[14px] leading-[1.85] text-foreground/85 space-y-1">
      {lines.map((line, i) => {
        const trimmed = line.trim()
        if (!trimmed) return <div key={i} className="h-2" /> // blank line spacer

        // ### Heading
        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={i} className="text-sm font-bold text-foreground mt-3 mb-1 flex items-center gap-1.5">
              <Hash className="size-3 text-primary/50" />
              {trimmed.slice(4)}
            </h4>
          )
        }

        // ## Heading
        if (trimmed.startsWith('## ')) {
          return (
            <h3 key={i} className="text-[15px] font-bold text-foreground mt-3 mb-1">
              {trimmed.slice(3)}
            </h3>
          )
        }

        // Bullet point: - item or * item
        if (/^[-*]\s/.test(trimmed)) {
          return (
            <div key={i} className="flex gap-2.5 pl-2">
              <span className="text-primary/60 mt-[2px] text-xs select-none">•</span>
              <span className="flex-1">{renderInline(trimmed.slice(2))}</span>
            </div>
          )
        }

        // Numbered list: 1. item
        const numMatch = trimmed.match(/^(\d+)\.\s(.*)/)
        if (numMatch) {
          return (
            <div key={i} className="flex gap-2.5 pl-2">
              <span className="text-primary/60 text-xs font-semibold tabular-nums mt-[2px] select-none min-w-[1rem] text-right">{numMatch[1]}.</span>
              <span className="flex-1">{renderInline(numMatch[2])}</span>
            </div>
          )
        }

        // Regular paragraph
        return <p key={i}>{renderInline(trimmed)}</p>
      })}
    </div>
  )
}

// Inline formatter: **bold** and `code`
function renderInline(text: string) {
  // Split on **bold** and `code` patterns
  const parts = text.split(/(\*\*.*?\*\*|`[^`]+`)/g)
  return parts.map((part, j) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={j} className="text-foreground font-semibold">{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={j} className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[12px] font-mono text-primary">
          {part.slice(1, -1)}
        </code>
      )
    }
    return part
  })
}


export function QABankView({ qa }: { qa: QAItem[] }) {
  const [query, setQuery] = useState("")
  const [active, setActive] = useState<string>("All")
  const headerRef = useRef<HTMLDivElement>(null)
  const [headerHeight, setHeaderHeight] = useState(280)

  // Track header height dynamically so the scroll panel always fits
  useEffect(() => {
    if (!headerRef.current) return
    const observer = new ResizeObserver(([entry]) => {
      setHeaderHeight(entry.contentRect.height)
    })
    observer.observe(headerRef.current)
    // Set initial height immediately
    setHeaderHeight(headerRef.current.offsetHeight)
    return () => observer.disconnect()
  }, [])

  // Allow multiple items to be open
  const [openItems, setOpenItems] = useState<Set<number>>(
    new Set(qa.length > 0 ? [qa[0].id] : [])
  )

  const [overlayLaunched, setOverlayLaunched] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)

  const categories = useMemo(() => ["All", ...Array.from(new Set(qa.map((q) => q.category)))], [qa])

  const filtered = qa.filter((q) => {
    const matchesCat = active === "All" || q.category === active
    const matchesQuery =
      query.trim() === "" ||
      q.question.toLowerCase().includes(query.toLowerCase()) ||
      q.answer.toLowerCase().includes(query.toLowerCase())
    return matchesCat && matchesQuery
  })

  const allOpen = filtered.length > 0 && filtered.every((q) => openItems.has(q.id))

  const toggleExpandAll = () => {
    if (allOpen) {
      setOpenItems(new Set())
    } else {
      setOpenItems(new Set(filtered.map((q) => q.id)))
    }
  }

  const toggleItem = (id: number) => {
    const newOpen = new Set(openItems)
    if (newOpen.has(id)) {
      newOpen.delete(id)
    } else {
      newOpen.add(id)
    }
    setOpenItems(newOpen)
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* ── Fixed Header Zone ── */}
      <div ref={headerRef} className="relative z-10 mx-auto w-full max-w-3xl px-8 pt-7 pb-2">
        {/* Header */}
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/[0.06] px-2.5 py-1 text-[11px] font-medium text-primary">
              <Sparkles className="size-3" />
              Generated for your role
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Q&amp;A Bank</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {qa.length} tailored questions · {categories.length - 1} categories · Scroll to explore
            </p>
          </div>
          {/* Launch Overlay Button */}
          <div className="relative shrink-0">
            <button
              onClick={() => {
                window.electron?.launchOverlay()
                setOverlayLaunched(true)
              }}
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-all",
                overlayLaunched
                  ? "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-500 cursor-default"
                  : "border-primary/30 bg-primary/[0.08] text-primary hover:bg-primary/[0.15] hover:border-primary/50 cursor-pointer"
              )}
            >
              <span className={cn(
                "size-2 rounded-full",
                overlayLaunched ? "bg-emerald-500 animate-pulse" : "bg-primary animate-pulse"
              )} />
              {overlayLaunched ? "Overlay Active" : "Launch Invisible Screen"}
            </button>

            {/* Tooltip on hover */}
            {showTooltip && (
              <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-border bg-card p-3 shadow-xl backdrop-blur-md">
                <p className="text-xs font-semibold text-foreground mb-1">
                  {overlayLaunched ? "✓ Invisible screen is running" : "Click to launch your invisible screen"}
                </p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {overlayLaunched
                    ? "Only you can see it. Hidden from Zoom, Meet & Teams screen share. Use Ctrl+Shift+H to hide/show."
                    : "Launches a floating AI toolbar visible only to you. Completely hidden from screen share software like Zoom and Meet."}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Search + filters */}
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search questions and answers…"
              className="w-full rounded-xl border border-border bg-card py-2.5 pl-9 pr-3 text-sm text-foreground shadow-sm outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:shadow-[0_0_20px_-8px_rgba(var(--primary),0.3)]"
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setActive(c)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-all duration-200",
                    active === c
                      ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
            <button
              onClick={toggleExpandAll}
              className="group flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-foreground backdrop-blur-sm transition-all hover:bg-secondary hover:border-foreground/30 shadow-sm"
            >
              <LayoutList className="size-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
              {allOpen ? "Collapse All" : "Expand All"}
            </button>
          </div>
        </div>

        {/* Matching count */}
        <div className="mt-3 mb-1 text-[11px] text-muted-foreground/60">
          {filtered.length === qa.length
            ? `Showing all ${qa.length} questions`
            : `${filtered.length} of ${qa.length} questions`}
        </div>
      </div>

      {/* ── Scrollable Question List ── */}
      {/* This is the BULLETPROOF scroll container. It uses absolute positioning */}
      {/* so it ALWAYS gets a computed height equal to the remaining space. */}
      <div
        className="absolute left-0 right-0 bottom-0 overflow-y-auto px-8"
        style={{ top: headerHeight }}
      >
        <div className="mx-auto w-full max-w-3xl flex flex-col gap-3 pb-8">
          {filtered.map((item, idx) => {
            const isOpen = openItems.has(item.id)
            return (
              <div
                key={item.id}
                className={cn(
                  "overflow-hidden rounded-2xl border bg-card transition-all duration-300",
                  isOpen
                    ? "border-primary/30 shadow-lg shadow-primary/5"
                    : "border-border hover:border-foreground/20 hover:shadow-md"
                )}
                style={{ animationDelay: `${idx * 30}ms` }}
              >
                <button
                  onClick={() => toggleItem(item.id)}
                  className={cn(
                    "flex w-full items-center gap-4 px-5 py-4 text-left transition-all duration-200",
                    isOpen ? "bg-primary/[0.04]" : "hover:bg-secondary/30"
                  )}
                >
                  <div className={cn(
                    "flex h-7 shrink-0 items-center rounded-md px-2.5 text-[10px] font-bold uppercase tracking-wider transition-colors",
                    isOpen ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
                  )}>
                    {item.category}
                  </div>
                  <span className={cn(
                    "flex-1 text-[15px] font-medium transition-colors leading-snug",
                    isOpen ? "text-primary" : "text-foreground"
                  )}>
                    {item.question}
                  </span>
                  <div className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full transition-all duration-300",
                    isOpen ? "bg-primary/20 text-primary" : "bg-transparent text-muted-foreground"
                  )}>
                    <ChevronDown
                      className={cn(
                        "size-4 transition-transform duration-300",
                        isOpen && "rotate-180"
                      )}
                    />
                  </div>
                </button>
                {isOpen && (
                  <div className="animate-fade-up border-t border-border/50 bg-primary/[0.015] px-5 py-6">
                    <div className="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-primary/80">
                      <CheckCircle2 className="size-4 text-primary" />
                      Suggested Answer
                    </div>
                    <div className="pl-5 border-l-2 border-primary/20">
                      <FormattedText text={item.answer} />
                    </div>
                    {item.code && (
                      <div className="mt-5 pl-5">
                        <CodeBlock code={item.code.content} language={item.code.lang} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card py-16 text-center">
              <Search className="mb-3 size-6 text-muted-foreground/50" />
              <p className="text-sm font-semibold text-foreground">No matches found</p>
              <p className="mt-1 text-xs text-muted-foreground">Try a different search term or category filter.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
