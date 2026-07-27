export type QAItem = {
  id: number
  category: string
  question: string
  answer: string
  confidence?: number
  code?: { lang: string; content: string }
}

export const GENERATED_QA: QAItem[] = [
  {
    id: 1,
    category: "React",
    confidence: 96,
    question: "What is the difference between useMemo and useCallback?",
    answer:
      "Both memoize across renders. useMemo caches a computed value, while useCallback caches a function reference. Reach for them to keep referential stability for expensive computations or stable props passed to memoized children.",
    code: {
      lang: "tsx",
      content: `// useMemo caches a value
const sorted = useMemo(
  () => items.sort(byDate),
  [items]
)

// useCallback caches a function
const onClick = useCallback(() => {
  track("click", id)
}, [id])`,
    },
  },
  {
    id: 2,
    category: "JavaScript",
    confidence: 93,
    question: "How would you debounce an expensive search input?",
    answer:
      "Wrap the handler so it only fires after the user pauses typing. A small custom hook stores the latest timer in a ref and clears the previous one on each keystroke, so only the final call runs.",
    code: {
      lang: "ts",
      content: `function useDebounce(fn, delay = 300) {
  const timer = useRef(null)
  return (...args) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(
      () => fn(...args), delay
    )
  }
}`,
    },
  },
  {
    id: 3,
    category: "System Design",
    confidence: 90,
    question: "How do you decide between server and client components in Next.js?",
    answer:
      "Default to Server Components for data fetching, static content, and anything that touches secrets. Switch to Client Components only when you need interactivity, browser APIs, or stateful hooks like useState and useEffect. Keep client boundaries as small and leaf-level as possible.",
  },
  {
    id: 4,
    category: "Behavioral",
    confidence: 88,
    question: "Tell me about a time you improved application performance.",
    answer:
      "Use the STAR format: describe the slow dashboard (Situation), your goal to cut load time (Task), the steps you took — code-splitting, memoization, and moving work to the server (Action) — and the measured 40% LCP improvement (Result). Anchor it in numbers from your resume.",
  },
  {
    id: 5,
    category: "TypeScript",
    confidence: 94,
    question: "What are discriminated unions and when are they useful?",
    answer:
      "A discriminated union is a set of object types sharing a literal 'tag' field. TypeScript narrows the type based on that tag, giving you exhaustive, type-safe branching — ideal for modeling request states or events.",
    code: {
      lang: "ts",
      content: `type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; data: User }

function render(s: State) {
  switch (s.status) {
    case "error": return s.message
    case "done": return s.data.name
  }
}`,
    },
  },
  {
    id: 6,
    category: "CSS",
    confidence: 91,
    question: "How do you center a div both vertically and horizontally?",
    answer:
      "The modern answer uses flexbox: set the parent to display flex with items and content centered. Grid with place-items: center is an equally valid one-line approach.",
    code: {
      lang: "tsx",
      content: `<div className="flex items-center justify-center h-screen">
  <div>Centered</div>
</div>`,
    },
  },
]
