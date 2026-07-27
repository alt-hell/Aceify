"use client"

import { useState, useEffect } from "react"
import { Check, Copy, Terminal } from "lucide-react"
import { useTheme } from "./theme-provider"

const KEYWORDS = new Set([
  "const", "let", "var", "function", "return", "if", "else", "for", "while",
  "new", "class", "extends", "import", "from", "export", "default", "async",
  "await", "try", "catch", "throw", "typeof", "instanceof", "in", "of",
  "void", "yield", "this", "super", "switch", "case", "break", "type",
])

const LITERALS = new Set(["true", "false", "null", "undefined", "NaN"])

type Token = { text: string; type: string }

// Lightweight tokenizer good enough for short JS/TS snippets.
function tokenize(line: string): Token[] {
  const tokens: Token[] = []
  const regex =
    /(\/\/[^\n]*)|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][A-Za-z0-9_$]*)|(\s+)|([^\s])/g

  let match: RegExpExecArray | null
  while ((match = regex.exec(line)) !== null) {
    const [full, comment, str, num, ident, space] = match
    if (comment) {
      tokens.push({ text: comment, type: "comment" })
    } else if (str) {
      tokens.push({ text: str, type: "string" })
    } else if (num) {
      tokens.push({ text: num, type: "number" })
    } else if (ident) {
      if (KEYWORDS.has(ident)) tokens.push({ text: ident, type: "keyword" })
      else if (LITERALS.has(ident)) tokens.push({ text: ident, type: "literal" })
      else {
        const next = line[regex.lastIndex]
        tokens.push({ text: ident, type: next === "(" ? "function" : "ident" })
      }
    } else if (space) {
      tokens.push({ text: space, type: "space" })
    } else {
      tokens.push({ text: full, type: "punct" })
    }
  }
  return tokens
}

// Dark theme syntax colors (GitHub Dark inspired)
const DARK_COLOR: Record<string, string> = {
  comment:  "text-slate-500 italic",
  string:   "text-emerald-400",
  number:   "text-amber-300",
  keyword:  "text-violet-400",
  literal:  "text-amber-400",
  function: "text-blue-400",
  ident:    "text-slate-200",
  punct:    "text-slate-400",
  space:    "",
}

// Light theme syntax colors (GitHub Light inspired)
const LIGHT_COLOR: Record<string, string> = {
  comment:  "text-slate-400 italic",
  string:   "text-emerald-600",
  number:   "text-amber-600",
  keyword:  "text-violet-600",
  literal:  "text-amber-700",
  function: "text-blue-600",
  ident:    "text-slate-800",
  punct:    "text-slate-500",
  space:    "",
}

export function CodeBlock({ code, language = "tsx" }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false)
  const { theme } = useTheme()
  const [actualTheme, setActualTheme] = useState<"light" | "dark">("dark")

  useEffect(() => {
    if (theme === "system") {
      setActualTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    } else {
      setActualTheme(theme as "light" | "dark")
    }
  }, [theme])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  const lines = (code || "").replace(/\n$/, "").split("\n")
  const COLOR = actualTheme === "light" ? LIGHT_COLOR : DARK_COLOR

  return (
    <div className={`group relative overflow-hidden rounded-xl border shadow-lg transition-colors duration-500 ease-in-out ${actualTheme === 'light' ? 'border-slate-200 bg-slate-50' : 'border-border/60 bg-[#0d1117]'}`}>
      {/* Header bar */}
      <div className={`flex items-center justify-between border-b px-4 py-2 transition-colors duration-500 ease-in-out ${actualTheme === 'light' ? 'border-slate-200 bg-slate-100/50' : 'border-white/[0.06] bg-white/[0.03]'}`}>
        <div className="flex items-center gap-2">
          <Terminal className={`size-3.5 ${actualTheme === 'light' ? 'text-slate-400' : 'text-slate-500'}`} />
          <span className={`font-mono text-[10px] uppercase tracking-wider ${actualTheme === 'light' ? 'text-slate-500' : 'text-slate-500'}`}>{language}</span>
        </div>
        <button
          onClick={copy}
          aria-label="Copy code"
          className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-medium transition-all ${actualTheme === 'light' ? 'text-slate-500 hover:bg-slate-200 hover:text-slate-700' : 'text-slate-500 hover:bg-white/[0.06] hover:text-slate-300'}`}
        >
          {copied ? <Check className={`size-3 ${actualTheme === 'light' ? 'text-emerald-600' : 'text-emerald-400'}`} /> : <Copy className="size-3" />}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      {/* Code body */}
      <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-relaxed">
        <code>
          {lines.map((line, i) => (
            <div key={i} className="table-row">
              <span className={`table-cell select-none pr-4 text-right text-[11px] ${actualTheme === 'light' ? 'text-slate-400' : 'text-slate-600'}`}>{i + 1}</span>
              <span className="table-cell whitespace-pre">
                {line.length === 0
                  ? " "
                  : tokenize(line).map((t, j) => (
                      <span key={j} className={COLOR[t.type] ?? ""}>
                        {t.text}
                      </span>
                    ))}
              </span>
            </div>
          ))}
        </code>
      </pre>
    </div>
  )
}
