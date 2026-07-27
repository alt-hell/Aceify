"use client"

import React, { useRef, useState } from "react"
import axios from "axios"
import { getApiBase } from "@/utils/api"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { type QAItem } from "@/lib/interview-data"
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Check,
  CheckCircle2,
  FileText,
  Loader2,
  SlidersHorizontal,
  Sparkles,
  UploadCloud,
  User,
  X,
} from "lucide-react"

type UploadedResume = { name: string; size: string; text: string }

const STEPS = [
  { id: "resume", label: "Resume", icon: FileText },
  { id: "jd", label: "Job Description", icon: Briefcase },
  { id: "experience", label: "Experience", icon: User },
  { id: "generate", label: "Generate", icon: Sparkles },
]

export function SetupView({ onGenerated }: { onGenerated: (qa: QAItem[]) => void }) {
  const [step, setStep] = useState(0)
  const [resume, setResume] = useState<UploadedResume | null>(null)
  const [dragging, setDragging] = useState(false)
  const [jd, setJd] = useState("")
  // Structured experience fields (replace old free-text textarea)
  const [seniority, setSeniority] = useState("")
  const [persona, setPersona] = useState("Default")
  const [focus, setFocus] = useState<string[]>([])
  const [achievement, setAchievement] = useState("")
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState("")
  const [qaCount, setQaCount] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file only.')
      return
    }
    const kb = file.size / 1024
    const sizeStr = kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(kb))} KB`
    
    setError("")
    setGenerating(true)
    try {
      const form = new FormData()
      form.append('resume', file)
      const baseUrl = getApiBase()
      const { data } = await axios.post(`${baseUrl}/parse-resume`, form, { timeout: 30000 })
      setResume({ name: file.name, size: sizeStr, text: data.text })
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to parse PDF.')
    } finally {
      setGenerating(false)
    }
  }

  const canContinue =
    (step === 0 && !!resume) ||
    (step === 1 && jd.trim().length > 20) ||
    (step === 2 && seniority !== '') ||
    step === 3

  const runGenerate = async () => {
    if (!resume?.text || !jd) {
      setError("Resume and JD are required")
      return
    }
    
    setGenerating(true)
    setError("")
    setQaCount(0)

    try {
      const baseUrl = getApiBase()
      const experienceStr = [
        seniority && `Seniority: ${seniority}`,
        persona && `Persona: ${persona}`,
        focus.length > 0 && `Interview Focus: ${focus.join(', ')}`,
        achievement.trim() && `Key Achievement: ${achievement.trim()}`
      ].filter(Boolean).join(' | ')

      const response = await fetch(`${baseUrl}/generate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
        body:    JSON.stringify({ resume: resume.text, jd: jd, experienceYears: experienceStr || 'auto', persona: persona })
      })

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}))
        throw new Error(errJson.error || `Server error: ${response.status}`)
      }

      if (!response.body) throw new Error("No response body")
      const reader  = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer    = ''
      let qaArray: QAItem[]   = []
      let done      = false

      while (!done) {
        const { value, done: streamDone } = await reader.read()
        done = streamDone
        if (value) buffer += decoder.decode(value, { stream: true })

        const parts = buffer.split('\n\n')
        buffer = parts.pop() || ''

        for (const part of parts) {
          const eventLine = part.split('\n').find((l: string) => l.startsWith('event:'))
          const dataLine  = part.split('\n').find((l: string) => l.startsWith('data:'))
          if (!dataLine) continue

          const eventType = eventLine ? eventLine.replace('event:', '').trim() : 'message'
          const payload   = JSON.parse(dataLine.replace('data:', '').trim())

          if (eventType === 'batch') {
            qaArray = [...qaArray, ...payload.questions]
            setQaCount(qaArray.length)
          } else if (eventType === 'error') {
            throw new Error(payload.error)
          } else if (eventType === 'done') {
            qaArray = payload.data
            setQaCount(qaArray.length)
            done = true
          }
        }
      }

      if (!qaArray.length) throw new Error('No questions were generated.')
      localStorage.setItem('qaArray', JSON.stringify(qaArray))

      const embedRes = await axios.post(`${baseUrl}/embed`, { qaArray })
      if (!embedRes.data.success) throw new Error('Indexing failed')

      onGenerated(qaArray)
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Something went wrong.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div 
      className="mx-auto flex h-full max-h-full w-full max-w-3xl flex-col px-8 py-7"
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
          e.preventDefault()
          if (step < 3 && canContinue && !generating) {
            setStep((s) => s + 1)
          } else if (step === 3 && !generating) {
            runGenerate()
          }
        }
      }}
    >
      {/* Header */}
      <div className="mb-5">
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          Engine ready
        </div>
        <h1 className="text-pretty text-2xl font-semibold tracking-tight text-foreground">Set up your session</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add your resume, the job description, and your experience. Aceify builds a tailored Q&amp;A bank.
        </p>
      </div>

      {/* Stepper */}
      <div className="mb-6 flex items-center">
        {STEPS.map((s, i) => {
          const Icon = s.icon
          const done = i < step
          const current = i === step
          return (
            <div key={s.id} className="flex flex-1 items-center last:flex-none">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full border text-sm transition-all",
                    done && "border-primary bg-primary text-primary-foreground",
                    current && "border-primary bg-primary/10 text-primary glow-blue",
                    !done && !current && "border-border bg-card text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-4" /> : <Icon className="size-4" />}
                </div>
                <span
                  className={cn(
                    "hidden text-xs font-medium sm:block",
                    current ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn("mx-2 h-px flex-1 transition-colors", done ? "bg-primary" : "bg-border")} />
              )}
            </div>
          )
        })}
      </div>

      {/* Step body */}
      <div className="flex-1 overflow-y-auto pr-2 pb-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border/50 hover:[&::-webkit-scrollbar-thumb]:bg-border">
        {step === 0 && (
          <ResumeStep
            resume={resume}
            dragging={dragging}
            setDragging={setDragging}
            handleFiles={handleFiles}
            inputRef={inputRef}
            onRemove={() => setResume(null)}
          />
        )}

        {step === 1 && (
          <FieldStep
            label="Paste the job description"
            hint="Copy the full posting so answers map to the exact role and stack."
            placeholder="e.g. We're hiring a Senior Frontend Engineer experienced in React, TypeScript, and Next.js to build performant dashboards…"
            value={jd}
            onChange={setJd}
            minLength={20}
            icon={Briefcase}
          />
        )}

        {step === 2 && (
          <ExperienceStep
            seniority={seniority}
            setSeniority={setSeniority}
            persona={persona}
            setPersona={setPersona}
            focus={focus}
            setFocus={setFocus}
            achievement={achievement}
            setAchievement={setAchievement}
          />
        )}

        {step === 3 && (
          <ReviewStep resume={resume} jd={jd} seniority={seniority} persona={persona} focus={focus} achievement={achievement} generating={generating} qaCount={qaCount} />
        )}
        {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>}
      </div>

      {/* Footer nav */}
      <div className="mt-6 flex items-center justify-between border-t border-border pt-5">
        <Button
          variant="ghost"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0 || generating}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>

        {step < 3 ? (
          <Button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canContinue}
            className="rounded-lg bg-primary px-5 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Continue
            <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button
            onClick={runGenerate}
            disabled={generating}
            className="rounded-lg bg-primary px-5 text-primary-foreground glow-blue hover:bg-primary/90"
          >
            {generating ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                Generate Q&amp;A Bank
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}

function ResumeStep({
  resume,
  dragging,
  setDragging,
  handleFiles,
  inputRef,
  onRemove,
}: {
  resume: UploadedResume | null
  dragging: boolean
  setDragging: (v: boolean) => void
  handleFiles: (f: FileList | null) => void
  inputRef: React.RefObject<HTMLInputElement | null>
  onRemove: () => void
}) {
  if (resume) {
    return (
      <div className="animate-fade-up flex items-center gap-3 rounded-xl border border-border bg-card p-4 glow-soft">
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <FileText className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{resume.name}</p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2 className="size-3.5 text-emerald-500" />
            Parsed successfully · {resume.size}
          </p>
        </div>
        <button
          onClick={onRemove}
          aria-label="Remove resume"
          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    )
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        handleFiles(e.dataTransfer.files)
      }}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
      className={cn(
        "group flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-16 text-center transition-all",
        dragging
          ? "border-primary bg-primary/[0.04] glow-blue"
          : "border-border bg-card hover:border-primary/50 hover:bg-secondary/50",
      )}
    >
      <input ref={inputRef} type="file" accept=".pdf" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
      <div
        className={cn(
          "mb-4 flex size-14 items-center justify-center rounded-2xl border transition-all",
          dragging
            ? "scale-110 border-primary/50 bg-primary/10 text-primary"
            : "border-border bg-secondary text-muted-foreground group-hover:text-primary",
        )}
      >
        <UploadCloud className="size-6" />
      </div>
      <p className="text-sm font-semibold text-foreground">
        {dragging ? "Drop your resume here" : "Drag & drop your resume"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        or <span className="font-medium text-primary">browse files</span> · PDF up to 10MB
      </p>
    </div>
  )
}

// ─── FieldStep — still used for the Job Description step ─────────────────────
function FieldStep({
  label,
  hint,
  placeholder,
  value,
  onChange,
  minLength,
  icon: Icon,
}: {
  label: string
  hint: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  minLength: number
  icon: typeof Briefcase
}) {
  return (
    <div className="animate-fade-up flex flex-col">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="size-4 text-primary" />
        <label className="text-sm font-semibold text-foreground">{label}</label>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">{hint}</p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={9}
        className="w-full resize-none rounded-xl border border-border bg-card p-4 text-sm leading-relaxed text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/15"
      />
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{value.trim().length} characters</span>
        <span className={cn(value.trim().length >= minLength ? "text-emerald-600" : "")}>
          {value.trim().length >= minLength ? "Looks good" : `Add at least ${minLength} characters`}
        </span>
      </div>
    </div>
  )
}

// ─── ExperienceStep ──────────────────────────────────────────────────────────
const SENIORITY_LEVELS = [
  { label: "Fresher",   desc: "0 – 1 yr",   color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
  { label: "Junior",    desc: "1 – 3 yrs",  color: "text-blue-600",    bg: "bg-blue-50 border-blue-200"    },
  { label: "Mid-Level", desc: "3 – 6 yrs",  color: "text-violet-600",  bg: "bg-violet-50 border-violet-200"},
  { label: "Senior",    desc: "6 – 10 yrs", color: "text-orange-600",  bg: "bg-orange-50 border-orange-200"},
  { label: "Lead / Architect", desc: "10+ yrs", color: "text-rose-600", bg: "bg-rose-50 border-rose-200" },
]

const PERSONA_LEVELS = [
  { label: "Default", desc: "Balanced & professional", color: "text-slate-600", bg: "bg-slate-50 border-slate-200" },
  { label: "Concise", desc: "No fluff, direct", color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
  { label: "Eager", desc: "Enthusiastic", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
  { label: "Consultant", desc: "Structured, framework", color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-200" },
  { label: "Storyteller", desc: "Engaging narrative", color: "text-orange-600", bg: "bg-orange-50 border-orange-200" },
]

const FOCUS_OPTIONS = [
  "Coding / DSA",
  "System Design",
  "Behavioral / HR",
  "Leadership",
  "Domain / Product",
]

function ExperienceStep({
  seniority,
  setSeniority,
  persona,
  setPersona,
  focus,
  setFocus,
  achievement,
  setAchievement,
}: {
  seniority: string
  setSeniority: (v: string) => void
  persona: string
  setPersona: (v: string) => void
  focus: string[]
  setFocus: (v: string[]) => void
  achievement: string
  setAchievement: (v: string) => void
}) {
  const toggleFocus = (f: string) =>
    setFocus(focus.includes(f) ? focus.filter((x) => x !== f) : [...focus, f])

  return (
    <div className="animate-fade-up flex flex-col gap-6">

      {/* Seniority Level */}
      <div>
        <div className="mb-1 flex items-center gap-2">
          <User className="size-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Your seniority level</span>
          <span className="ml-auto text-[11px] text-rose-500 font-medium">Required</span>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          This calibrates answer depth — a senior's answer is completely different from a fresher's.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
          {SENIORITY_LEVELS.map((s) => {
            const active = seniority === s.label
            return (
              <button
                key={s.label}
                onClick={() => setSeniority(s.label)}
                className={cn(
                  "group flex flex-col items-center gap-1.5 rounded-xl border-2 p-3.5 text-center transition-all duration-300",
                  active
                    ? `${s.bg} border-current ${s.color} shadow-md scale-[1.02] ring-1 ring-current/20`
                    : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:bg-secondary/50 hover:-translate-y-0.5 hover:shadow-sm"
                )}
              >
                <span className={cn("text-xs font-bold leading-tight", active && s.color)}>
                  {s.label}
                </span>
                <span className="text-[10px] opacity-70">{s.desc}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Persona Level */}
      <div>
        <div className="mb-1 flex items-center gap-2">
          <User className="size-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">AI Speaking Persona</span>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          This changes the tone and style of the AI answers during the live interview.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
          {PERSONA_LEVELS.map((s) => {
            const active = persona === s.label
            return (
              <button
                key={s.label}
                onClick={() => setPersona(s.label)}
                className={cn(
                  "group flex flex-col items-center gap-1.5 rounded-xl border-2 p-3.5 text-center transition-all duration-300",
                  active
                    ? `${s.bg} border-current ${s.color} shadow-md scale-[1.02] ring-1 ring-current/20`
                    : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:bg-secondary/50 hover:-translate-y-0.5 hover:shadow-sm"
                )}
              >
                <span className={cn("text-xs font-bold leading-tight", active && s.color)}>
                  {s.label}
                </span>
                <span className="text-[10px] opacity-70">{s.desc}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Interview Focus */}
      <div>
        <div className="mb-1 flex items-center gap-2">
          <SlidersHorizontal className="size-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Interview focus</span>
          <span className="ml-auto text-[11px] text-muted-foreground">Select all that apply</span>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Tells the AI which type of questions to prioritize and how deep to go.
        </p>
        <div className="flex flex-wrap gap-2">
          {FOCUS_OPTIONS.map((f) => {
            const active = focus.includes(f)
            return (
              <button
                key={f}
                onClick={() => toggleFocus(f)}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-xs font-medium transition-all duration-300",
                  active
                    ? "border-primary bg-primary text-primary-foreground shadow-md ring-2 ring-primary/20 scale-[1.02]"
                    : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground hover:-translate-y-0.5 hover:shadow-sm"
                )}
              >
                {active && <Check className="mr-1 inline size-3" />}{f}
              </button>
            )
          })}
        </div>
      </div>

      {/* Key Achievement */}
      <div>
        <div className="mb-1 flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">One key achievement</span>
          <span className="ml-auto text-[11px] text-muted-foreground">Optional but powerful</span>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          The AI weaves this into behavioral answers. Keep it specific and measurable.
        </p>
        <input
          type="text"
          maxLength={150}
          value={achievement}
          onChange={(e) => setAchievement(e.target.value)}
          placeholder="e.g. Reduced API latency by 60%, improving checkout conversion by 12%"
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/15"
        />
        <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
          <span>{achievement.length}/150 characters</span>
          {achievement.trim().length > 0 && (
            <span className="text-emerald-600 font-medium">✓ Looks great</span>
          )}
        </div>
      </div>
    </div>
  )
}

function ReviewStep({
  qaCount,
  resume,
  jd,
  seniority,
  persona,
  focus,
  achievement,
  generating,
}: {
  resume: UploadedResume | null
  jd: string
  seniority: string
  persona: string
  focus: string[]
  achievement: string
  generating: boolean
  qaCount?: number
}) {
  const summary = [
    { icon: FileText, label: "Resume", value: resume?.name ?? "Not added", ok: !!resume },
    { icon: Briefcase, label: "Job Description", value: `${jd.trim().length} characters`, ok: jd.trim().length > 20 },
    { icon: User, label: "Seniority", value: seniority || "Not selected", ok: !!seniority },
    { icon: User, label: "Persona", value: persona || "Not selected", ok: !!persona },
    { icon: SlidersHorizontal, label: "Interview Focus", value: focus.length > 0 ? focus.join(", ") : "Not selected", ok: focus.length > 0 },
  ]

  return (
    <div className="animate-fade-up flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Review your inputs. Aceify will generate a personalized Q&amp;A bank and open it in the sidebar.
      </p>
      <div className="grid gap-2">
        {summary.map((s) => {
          const Icon = s.icon
          return (
            <div
              key={s.label}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 glow-soft"
            >
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-foreground">{s.label}</p>
                <p className="truncate text-xs text-muted-foreground">{s.value}</p>
              </div>
              {s.ok ? (
                <CheckCircle2 className="size-4 text-emerald-500" />
              ) : (
                <span className="text-[11px] text-amber-600">Missing</span>
              )}
            </div>
          )
        })}
        {achievement.trim() && (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
              <Sparkles className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground">Key Achievement</p>
              <p className="text-xs text-muted-foreground">{achievement}</p>
            </div>
            <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
          </div>
        )}
      </div>

      {generating && (
        <div className="mt-2 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/[0.04] p-4">
          <Loader2 className="size-5 animate-spin text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">{qaCount ? `Generated ${qaCount} questions...` : "Analyzing your profile…"}</p>
            <p className="text-xs text-muted-foreground">Matching the job description against your experience.</p>
          </div>
        </div>
      )}
    </div>
  )
}
