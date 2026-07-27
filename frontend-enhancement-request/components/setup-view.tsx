"use client"

import type React from "react"

import { useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { GENERATED_QA, type QAItem } from "@/lib/interview-data"
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Check,
  CheckCircle2,
  FileText,
  Loader2,
  Sparkles,
  UploadCloud,
  User,
  X,
} from "lucide-react"

type UploadedResume = { name: string; size: string }

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
  const [experience, setExperience] = useState("")
  const [generating, setGenerating] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    const kb = file.size / 1024
    setResume({
      name: file.name,
      size: kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(kb))} KB`,
    })
  }

  const canContinue =
    (step === 0 && !!resume) ||
    (step === 1 && (jd.trim().length === 0 || jd.trim().length >= 20)) ||
    (step === 2 && (experience.trim().length === 0 || experience.trim().length >= 10)) ||
    step === 3

  const runGenerate = async () => {
    setGenerating(true)
    await new Promise((r) => setTimeout(r, 2400))
    setGenerating(false)
    onGenerated(GENERATED_QA)
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-8 py-7">
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
      <div className="flex-1">
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
          <FieldStep
            label="Describe your experience"
            hint="Years, key projects, and standout achievements. We ground answers in this."
            placeholder="e.g. 5 years building React apps. Led a dashboard rewrite that cut LCP by 40%. Strong in TypeScript, testing, and design systems…"
            value={experience}
            onChange={setExperience}
            minLength={10}
            icon={User}
          />
        )}

        {step === 3 && (
          <ReviewStep resume={resume} jd={jd} experience={experience} generating={generating} />
        )}
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
          {value.trim().length === 0 
            ? "Optional" 
            : value.trim().length >= minLength 
              ? "Looks good" 
              : `Add at least ${minLength} characters`}
        </span>
      </div>
    </div>
  )
}

function ReviewStep({
  resume,
  jd,
  experience,
  generating,
}: {
  resume: UploadedResume | null
  jd: string
  experience: string
  generating: boolean
}) {
  const summary = [
    { icon: FileText, label: "Resume", value: resume?.name ?? "Not added", ok: !!resume },
    { icon: Briefcase, label: "Job Description", value: `${jd.trim().length} characters`, ok: jd.trim().length > 20 },
    {
      icon: User,
      label: "Experience",
      value: `${experience.trim().length} characters`,
      ok: experience.trim().length > 10,
    },
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
                <span className="text-[11px] text-amber-600">Optional</span>
              )}
            </div>
          )
        })}
      </div>

      {generating && (
        <div className="mt-2 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/[0.04] p-4">
          <Loader2 className="size-5 animate-spin text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">Analyzing your profile…</p>
            <p className="text-xs text-muted-foreground">Matching the job description against your experience.</p>
          </div>
        </div>
      )}
    </div>
  )
}
