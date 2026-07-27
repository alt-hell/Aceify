"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"

const KEYWORDS = new Set([
  "const",
  "let",
  "var",
  "function",
  "return",
  "if",
  "else",
  "for",
  "while",
  "new",
  "class",
  "extends",
  "import",
  "from",
  "export",
  "default",
  "async",
  "await",
  "try",
  "catch",
  "throw",
  "typeof",
  "instanceof",
  "in",
  "of",
  "void",
  "yield",
  "this",
  "super",
  "switch",
  "case",
  "break",
  "type",
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

const COLOR: Record<string, string> = {
  comment: "text-slate-400 italic",
  string: "text-emerald-600",
  number: "text-amber-600",
  keyword: "text-violet-600",
  literal: "text-amber-600",
  function: "text-blue-600",
  ident: "text-slate-700",
  punct: "text-slate-500",
  space: "",
}

export function CodeBlock({ code, language = "tsx" }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  const lines = code.replace(/\n$/, "").split("\n")

  return (
    <div className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white/60 px-3 py-1.5">
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-red-400/70" />
          <span className="size-2.5 rounded-full bg-amber-400/70" />
          <span className="size-2.5 rounded-full bg-emerald-400/70" />
          <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-slate-400">{language}</span>
        </div>
        <button
          onClick={copy}
          aria-label="Copy code"
          className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-[12.5px] leading-relaxed">
        <code>
          {lines.map((line, i) => (
            <div key={i} className="table-row">
              <span className="table-cell select-none pr-4 text-right text-slate-300">{i + 1}</span>
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
