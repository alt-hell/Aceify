"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { CodeBlock } from "@/components/code-block"
import type { QAItem } from "@/lib/interview-data"
import {
  Check,
  ChevronDown,
  Copy,
  Droplet,
  Eye,
  EyeOff,
  GripVertical,
  Minus,
  Plus,
  ScanLine,
  SlidersHorizontal,
  Sparkles,
  Square,
  ThumbsUp,
  Type,
  Wand2,
} from "lucide-react"

type View = "answer" | "analyse"

const MIN_W = 360
const MIN_H = 240

export function LiveOverlay({
  script,
  open,
  onOpenChange,
}: {
  script: QAItem[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 20 })
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 560, h: 440 })
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [view, setView] = useState<View>("answer")
  const [recording, setRecording] = useState(true)
  const [elapsed, setElapsed] = useState(0)

  // User-adjustable appearance.
  const [opacity, setOpacity] = useState(0.95) // overall transparency of the widget
  const [textScale, setTextScale] = useState(1) // readability / font scale
  const [showControls, setShowControls] = useState(false)

  // Answer streaming
  const [visibleCount, setVisibleCount] = useState(0)
  const [typingQuestion, setTypingQuestion] = useState(false)

  // Analyse
  const [scanning, setScanning] = useState(false)
  const [analysed, setAnalysed] = useState(false)

  const rootRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ dx: number; dy: number; active: boolean }>({ dx: 0, dy: 0, active: false })
  const resize = useRef<{ x: number; y: number; w: number; h: number; active: boolean }>({
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    active: false,
  })

  // Center horizontally on mount.
  useEffect(() => {
    const el = toolbarRef.current
    if (!el) return
    setPos({ x: Math.max(16, (window.innerWidth - el.offsetWidth) / 2), y: 20 })
  }, [])

  // Session timer.
  useEffect(() => {
    if (!recording) return
    const t = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(t)
  }, [recording])

  // Simulate questions being detected over time (only when expanded on answer view + recording).
  useEffect(() => {
    if (!open || view !== "answer" || !recording) return
    let mounted = true
    let timer: ReturnType<typeof setTimeout>

    const step = (i: number) => {
      if (!mounted || i >= script.length) return
      timer = setTimeout(
        () => {
          if (!mounted) return
          setTypingQuestion(true)
          timer = setTimeout(() => {
            if (!mounted) return
            setTypingQuestion(false)
            setVisibleCount((c) => Math.max(c, i + 1))
            step(i + 1)
          }, 1100)
        },
        i === 0 ? 700 : 3800,
      )
    }

    setVisibleCount((current) => {
      step(current)
      return current
    })

    return () => {
      mounted = false
      clearTimeout(timer)
    }
  }, [script, open, view, recording])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [visibleCount, typingQuestion, analysed])

  // Keyboard shortcut: Cmd/Ctrl + Shift + A toggles the panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "a") {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onOpenChange])

  /* ---------- Dragging the whole widget ---------- */
  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, active: true }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    setIsDragging(true)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current.active) return
    const el = toolbarRef.current
    const w = el?.offsetWidth ?? 0
    const maxX = window.innerWidth - w
    const maxY = window.innerHeight - 48
    const x = Math.min(Math.max(0, e.clientX - drag.current.dx), Math.max(0, maxX))
    const y = Math.min(Math.max(0, e.clientY - drag.current.dy), Math.max(0, maxY))
    setPos({ x, y })
  }

  const endDrag = (e: React.PointerEvent) => {
    drag.current.active = false
    setIsDragging(false)
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
  }

  /* ---------- Resizing the panel (drag the corner) ---------- */
  const onResizeDown = (e: React.PointerEvent) => {
    e.stopPropagation()
    resize.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h, active: true }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    setIsResizing(true)
  }

  const onResizeMove = (e: React.PointerEvent) => {
    if (!resize.current.active) return
    const maxW = Math.min(960, window.innerWidth - pos.x - 16)
    const maxH = Math.min(window.innerHeight - pos.y - 80, 720)
    const w = Math.min(Math.max(MIN_W, resize.current.w + (e.clientX - resize.current.x)), maxW)
    const h = Math.min(Math.max(MIN_H, resize.current.h + (e.clientY - resize.current.y)), maxH)
    setSize({ w, h })
  }

  const endResize = (e: React.PointerEvent) => {
    resize.current.active = false
    setIsResizing(false)
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
  }

  const openView = (v: View) => {
    setView(v)
    onOpenChange(true)
    if (v === "analyse" && !analysed && !scanning) runAnalyse()
  }

  const runAnalyse = () => {
    setScanning(true)
    setAnalysed(false)
    setTimeout(() => {
      setScanning(false)
      setAnalysed(true)
    }, 1800)
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0")
  const ss = String(elapsed % 60).padStart(2, "0")

  return (
    <div
      ref={rootRef}
      style={{ left: pos.x, top: pos.y, opacity }}
      className="fixed z-50 flex select-none flex-col transition-opacity duration-150"
    >
      {/* Toolbar (always visible, auto-fits its content so nothing spills out) */}
      <div
        ref={toolbarRef}
        className={cn(
          "flex w-auto items-center gap-1.5 rounded-2xl border border-white/10 bg-slate-900/90 px-2 py-1.5 text-white shadow-2xl shadow-slate-950/50 ring-1 ring-white/5 backdrop-blur-2xl transition-transform duration-200",
          isDragging && "scale-[1.01]",
        )}
      >
        {/* Drag handle + brand */}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className={cn(
            "flex touch-none items-center gap-1.5 rounded-xl py-1 pl-1 pr-2",
            isDragging ? "cursor-grabbing" : "cursor-grab",
          )}
        >
          <GripVertical className="size-4 text-white/30" />
          <div className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-indigo-500/30">
            <Sparkles className="size-4 text-white" />
          </div>
          <span className="hidden text-[13px] font-bold tracking-tight sm:block">Aceify</span>
        </div>

        <span className="mx-0.5 h-6 w-px bg-white/10" />

        {/* Actions */}
        <ToolButton icon={Wand2} label="Answer" active={open && view === "answer"} onClick={() => openView("answer")} />
        <ToolButton
          icon={ScanLine}
          label="Analyse Screen"
          active={open && view === "analyse"}
          onClick={() => openView("analyse")}
        />
        <ToolButton icon={open ? EyeOff : Eye} label={open ? "Hide" : "Show"} onClick={() => onOpenChange(!open)} />
        <ToolButton
          icon={SlidersHorizontal}
          label="Adjust"
          active={showControls}
          onClick={() => setShowControls((s) => !s)}
        />

        <span className="mx-0.5 h-6 w-px bg-white/10" />

        <span className="flex items-center gap-1.5">
          <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 font-mono text-[11px] font-semibold tabular-nums">
            <span className={cn("size-1.5 rounded-full", recording ? "animate-pulse bg-red-500" : "bg-white/40")} />
            {mm}:{ss}
          </span>
          <button
            onClick={() => setRecording((r) => !r)}
            aria-label={recording ? "Stop session" : "Resume session"}
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-full text-white transition-transform hover:scale-105",
              recording ? "bg-red-500 shadow-lg shadow-red-500/40" : "bg-white/15 hover:bg-white/25",
            )}
          >
            <Square className={cn("size-3", recording && "fill-white")} />
          </button>
        </span>
      </div>

      {/* Appearance controls (transparency + readability) */}
      {showControls && (
        <div className="animate-fade-up mt-2 w-72 rounded-2xl border border-white/10 bg-slate-900/90 p-4 text-white shadow-2xl shadow-slate-950/50 ring-1 ring-white/5 backdrop-blur-2xl">
          <div className="mb-3 flex items-center gap-2">
            <SlidersHorizontal className="size-3.5 text-blue-400" />
            <span className="text-[12px] font-semibold">Appearance</span>
          </div>

          {/* Transparency */}
          <div className="mb-4">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-white/70">
                <Droplet className="size-3.5" /> Transparency
              </span>
              <span className="font-mono text-[11px] tabular-nums text-white/50">
                {Math.round((1 - opacity) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0.4}
              max={1}
              step={0.01}
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              aria-label="Adjust overlay transparency"
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-blue-500"
            />
          </div>

          {/* Text size */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-white/70">
                <Type className="size-3.5" /> Text size
              </span>
              <span className="font-mono text-[11px] tabular-nums text-white/50">{Math.round(textScale * 100)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTextScale((s) => Math.max(0.85, Math.round((s - 0.05) * 100) / 100))}
                aria-label="Decrease text size"
                className="flex size-7 items-center justify-center rounded-lg bg-white/10 text-white/80 transition-colors hover:bg-white/20"
              >
                <Minus className="size-3.5" />
              </button>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"
                  style={{ width: `${((textScale - 0.85) / (1.3 - 0.85)) * 100}%` }}
                />
              </div>
              <button
                onClick={() => setTextScale((s) => Math.min(1.3, Math.round((s + 0.05) * 100) / 100))}
                aria-label="Increase text size"
                className="flex size-7 items-center justify-center rounded-lg bg-white/10 text-white/80 transition-colors hover:bg-white/20"
              >
                <Plus className="size-3.5" />
              </button>
            </div>
          </div>

          <p className="mt-3 border-t border-white/10 pt-2.5 text-[10px] leading-relaxed text-white/40">
            {"Tip: drag the bottom-right corner of the panel to resize it. Press "}
            <kbd className="rounded bg-white/10 px-1 font-mono text-white/60">⌘/Ctrl ⇧ A</kbd>
            {" to hide instantly."}
          </p>
        </div>
      )}

      {/* Expandable, resizable panel */}
      {open && (
        <div
          style={{ width: size.w, height: size.h, fontSize: `${textScale}rem` }}
          className="animate-fade-up group relative mt-2 flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900/85 text-slate-100 shadow-2xl shadow-slate-950/50 ring-1 ring-white/5 backdrop-blur-2xl"
        >
          {/* Panel header */}
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-blue-400" />
              <span className="text-[13px] font-semibold">
                {view === "answer" && "AI Response"}
                {view === "analyse" && "Screen Analysis"}
              </span>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              aria-label="Collapse panel"
              className="flex size-7 items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              <ChevronDown className="size-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
            {view === "answer" && <AnswerView script={script} visibleCount={visibleCount} typing={typingQuestion} />}
            {view === "analyse" && <AnalyseView scanning={scanning} analysed={analysed} onRescan={runAnalyse} />}
          </div>

          {/* Resize handle — hover the corner and drag to resize */}
          <div
            onPointerDown={onResizeDown}
            onPointerMove={onResizeMove}
            onPointerUp={endResize}
            onPointerCancel={endResize}
            className={cn(
              "absolute bottom-0 right-0 z-10 flex size-7 cursor-nwse-resize touch-none items-end justify-end rounded-tl-xl p-1.5 transition-colors hover:bg-white/10",
              isResizing && "bg-white/10",
            )}
            aria-label="Resize panel"
            role="separator"
            title="Drag to resize"
          >
            <svg
              viewBox="0 0 12 12"
              className={cn(
                "size-3 transition-colors",
                isResizing ? "text-blue-400" : "text-white/40 group-hover:text-white/70",
              )}
            >
              <path
                d="M11 1 L1 11 M11 5 L5 11 M11 9 L9 11"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </div>
        </div>
      )}
    </div>
  )
}

function ToolButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof Wand2
  label: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[12px] font-medium transition-colors",
        active ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white",
      )}
    >
      <Icon className="size-3.5" />
      <span className="hidden md:inline">{label}</span>
    </button>
  )
}

function AnswerView({
  script,
  visibleCount,
  typing,
}: {
  script: QAItem[]
  visibleCount: number
  typing: boolean
}) {
  if (visibleCount === 0 && !typing) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="mb-3 flex size-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
          <Sparkles className="size-5 text-blue-400" />
        </div>
        <p className="text-[13px] font-semibold text-white">Listening for the first question…</p>
        <p className="mt-1 max-w-[260px] text-xs leading-relaxed text-white/60">
          Suggested answers appear here the moment a question is detected.
        </p>
      </div>
    )
  }
  return (
    <div className="space-y-5">
      {script.slice(0, visibleCount).map((ex) => (
        <Bubble key={ex.id} exchange={ex} />
      ))}
      {typing && (
        <div className="animate-fade-up flex flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">Detected question</span>
          <div className="flex w-fit items-center gap-1.5 rounded-2xl rounded-tl-sm border border-white/10 bg-white/5 px-3.5 py-3">
            <Dot /> <Dot delay="0.15s" /> <Dot delay="0.3s" />
          </div>
        </div>
      )}
    </div>
  )
}

function Bubble({ exchange }: { exchange: QAItem }) {
  const [copied, setCopied] = useState(false)
  const copyAnswer = async () => {
    try {
      const text = exchange.code ? `${exchange.answer}\n\n${exchange.code.content}` : exchange.answer
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  return (
    <div className="animate-fade-up flex flex-col gap-2.5">
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">Detected question</span>
        <div className="w-fit max-w-[88%] rounded-2xl rounded-tl-sm border border-white/10 bg-white/5 px-3.5 py-2.5 text-[13px] font-medium leading-relaxed text-white">
          {exchange.question}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-blue-400">
          <Sparkles className="size-3" /> Suggested answer
        </span>
        <div className="rounded-2xl rounded-tl-sm border border-blue-400/20 bg-blue-400/[0.08] px-3.5 py-3 text-[13px] leading-relaxed text-slate-100">
          <p>{exchange.answer}</p>
          {exchange.code && (
            <div className="mt-3">
              <CodeBlock code={exchange.code.content} language={exchange.code.lang} />
            </div>
          )}
          <div className="mt-3 flex items-center gap-1 border-t border-white/10 pt-2.5">
            <button className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white">
              <ThumbsUp className="size-3.5" /> Helpful
            </button>
            <button
              onClick={copyAnswer}
              className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
            <span className="ml-auto rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
              {exchange.confidence ?? 95}% match
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function AnalyseView({
  scanning,
  analysed,
  onRescan,
}: {
  scanning: boolean
  analysed: boolean
  onRescan: () => void
}) {
  if (scanning) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="relative mb-4 flex size-14 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <ScanLine className="size-6 text-blue-400" />
          <span className="absolute inset-x-0 top-0 h-0.5 animate-[scanline_1.4s_ease-in-out_infinite] bg-blue-400 shadow-[0_0_8px_2px] shadow-blue-400/60" />
        </div>
        <p className="text-[13px] font-semibold text-white">Analysing your screen…</p>
        <p className="mt-1 text-xs text-white/60">Reading the question shared by the interviewer.</p>
      </div>
    )
  }
  if (analysed) {
    return (
      <div className="animate-fade-up space-y-3">
        <div className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">Detected on screen</span>
          <p className="mt-1 text-[13px] font-medium text-white">
            {'"Implement a function to debounce an expensive search input."'}
          </p>
        </div>
        <div className="rounded-2xl border border-blue-400/20 bg-blue-400/[0.08] px-3.5 py-3">
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-blue-400">
            <Sparkles className="size-3" /> Suggested approach
          </span>
          <ul className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-slate-100">
            <li>{"• Wrap the handler in a timer that resets on every keystroke."}</li>
            <li>{"• Only fire the request after the user pauses (e.g. 300ms)."}</li>
            <li>{"• Clean up the timer on unmount to avoid stale calls."}</li>
          </ul>
        </div>
        <button
          onClick={onRescan}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          <ScanLine className="size-3.5" /> Re-analyse screen
        </button>
      </div>
    )
  }
  return null
}

function Dot({ delay = "0s" }: { delay?: string }) {
  return (
    <span
      className="size-1.5 animate-bounce rounded-full bg-white/50"
      style={{ animationDelay: delay, animationDuration: "1s" }}
    />
  )
}
