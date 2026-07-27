"use client"

import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { CodeBlock } from "@/components/code-block"
import type { QAItem } from "@/lib/interview-data"
import { ChevronDown, Search, Sparkles } from "lucide-react"

export function QABankView({ qa }: { qa: QAItem[] }) {
  const [query, setQuery] = useState("")
  const [active, setActive] = useState<string>("All")
  const [open, setOpen] = useState<number | null>(qa[0]?.id ?? null)

  const categories = useMemo(() => ["All", ...Array.from(new Set(qa.map((q) => q.category)))], [qa])

  const filtered = qa.filter((q) => {
    const matchesCat = active === "All" || q.category === active
    const matchesQuery =
      query.trim() === "" ||
      q.question.toLowerCase().includes(query.toLowerCase()) ||
      q.answer.toLowerCase().includes(query.toLowerCase())
    return matchesCat && matchesQuery
  })

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-8 py-7">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/[0.06] px-2.5 py-1 text-[11px] font-medium text-primary">
            <Sparkles className="size-3" />
            Generated for your role
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Q&amp;A Bank</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {qa.length} tailored questions with suggested answers. Your live overlay is already running above.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.08] px-3.5 py-2 text-sm font-medium text-emerald-600">
          <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
          Live overlay active
        </div>
      </div>

      {/* Search + filters */}
      <div className="mb-4 flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search questions and answers…"
            className="w-full rounded-lg border border-border bg-card py-2.5 pl-9 pr-3 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setActive(c)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active === c
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex flex-col gap-2.5">
        {filtered.map((item) => {
          const isOpen = open === item.id
          return (
            <div
              key={item.id}
              className="overflow-hidden rounded-xl border border-border bg-card glow-soft transition-shadow"
            >
              <button
                onClick={() => setOpen(isOpen ? null : item.id)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
              >
                <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                  {item.category}
                </span>
                <span className="flex-1 text-sm font-medium text-foreground">{item.question}</span>
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-transform",
                    isOpen && "rotate-180",
                  )}
                />
              </button>
              {isOpen && (
                <div className="animate-fade-up border-t border-border px-4 py-4">
                  <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                    <Sparkles className="size-3" />
                    Suggested answer
                  </div>
                  <p className="text-sm leading-relaxed text-foreground/90">{item.answer}</p>
                  {item.code && (
                    <div className="mt-3">
                      <CodeBlock code={item.code.content} language={item.code.lang} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-12 text-center">
            <Search className="mb-2 size-5 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">No matches</p>
            <p className="text-xs text-muted-foreground">Try a different search or category.</p>
          </div>
        )}
      </div>
    </div>
  )
}
