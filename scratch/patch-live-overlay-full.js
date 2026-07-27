const fs = require('fs');

let code = fs.readFileSync('src/components/live-overlay.tsx', 'utf8');

// 1. Fix standard imports and add lucide-react icons
code = code.replace('@/lib/utils', '../lib/utils');
code = code.replace('@/components/code-block', '../components/code-block');
code = code.replace(
  'import type { QAItem } from "@/lib/interview-data"',
  `export type QAItem = {
  id?: string;
  question: string;
  answer: string;
  confidence?: number;
  code?: { content: string; lang: string };
};`
);
// In case the path was ../lib/interview-data
code = code.replace(
  'import type { QAItem } from "../lib/interview-data"',
  `export type QAItem = {
  id?: string;
  question: string;
  answer: string;
  confidence?: number;
  code?: { content: string; lang: string };
};`
);

code = code.replace(
  '  Wand2,\n} from "lucide-react"',
  '  Wand2,\n  Mic,\n  MonitorSpeaker,\n} from "lucide-react"'
);

// 2. Change signature
const oldSig = `export function LiveOverlay({
  script,
  open,
  onOpenChange,
}: {
  script: QAItem[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {`;

const newSig = `export function LiveOverlay({
  script,
  open,
  onOpenChange,
  recording,
  onToggleRecording,
  elapsed,
  typingQuestion,
  interimText,
  audioMode,
  onToggleAudioMode,
}: {
  script: QAItem[]
  open: boolean
  onOpenChange: (open: boolean) => void
  recording: boolean
  onToggleRecording: () => void
  elapsed: number
  typingQuestion: boolean
  interimText?: string
  audioMode: "mic" | "system"
  onToggleAudioMode: () => void
}) {`;

code = code.replace(oldSig, newSig);

// 3. Delete simulation code completely
const simState = `  // Answer streaming
  const [visibleCount, setVisibleCount] = useState(0)
  const [typingQuestion, setTypingQuestion] = useState(false)`;
code = code.replace(simState, `  // Answer streaming\n  const visibleCount = script.length`);

const simEffect1 = `  // Simulate detecting a question
  useEffect(() => {
    if (!open || view !== "answer" || !recording) return

    let timer: NodeJS.Timeout
    let mounted = true

    const step = (i: number) => {
      if (i >= script.length) return
      timer = setTimeout(
        () => {
          if (!mounted) return
          setTypingQuestion(true)

          // Simulate typing an answer
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
  }, [script, open, view, recording])`;
code = code.replace(simEffect1, '');


// 4. Center horizontally on mount patch (add Electron zero pos)
const mountEffect = `  // Center horizontally on mount.
  useEffect(() => {
    const el = toolbarRef.current
    if (!el) return
    setPos({ x: Math.max(16, (window.innerWidth - el.offsetWidth) / 2), y: 20 })
  }, [])`;
const newMountEffect = `  // Center horizontally on mount.
  useEffect(() => {
    if ((window as any).electron) {
      setPos({ x: 0, y: 0 })
    } else {
      const el = toolbarRef.current
      if (!el) return
      setPos({ x: Math.max(16, (window.innerWidth - el.offsetWidth) / 2), y: 20 })
    }
  }, [])`;
code = code.replace(mountEffect, newMountEffect);

// 5. Drag and Resize references
code = code.replace(
  `const drag = useRef<{ dx: number; dy: number; active: boolean }>({ dx: 0, dy: 0, active: false })`,
  `const drag = useRef<{ dx: number; dy: number; active: boolean; lastX: number; lastY: number }>({ dx: 0, dy: 0, active: false, lastX: 0, lastY: 0 })`
);
code = code.replace(
  `const resize = useRef<{ x: number; y: number; w: number; h: number; active: boolean }>({`,
  `const resize = useRef<{ x: number; y: number; w: number; h: number; active: boolean; lastX: number; lastY: number }>({`
);


// Drag logic
code = code.replace(
  `  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, active: true }`,
  `  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, active: true, lastX: e.screenX, lastY: e.screenY }`
);

const onPointerMove = `  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current.active) return
    const el = toolbarRef.current
    const w = el?.offsetWidth ?? 0
    const maxX = window.innerWidth - w
    const maxY = window.innerHeight - 48
    const x = Math.min(Math.max(0, e.clientX - drag.current.dx), Math.max(0, maxX))
    const y = Math.min(Math.max(0, e.clientY - drag.current.dy), Math.max(0, maxY))
    setPos({ x, y })
  }`;
const newOnPointerMove = `  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current.active) return
    if ((window as any).electron?.moveByDelta) {
      const dx = Math.round(e.screenX - drag.current.lastX)
      const dy = Math.round(e.screenY - drag.current.lastY)
      drag.current.lastX = e.screenX
      drag.current.lastY = e.screenY
      if (dx !== 0 || dy !== 0) {
        (window as any).electron.moveByDelta({ dx, dy })
      }
    } else {
      const el = toolbarRef.current
      const w = el?.offsetWidth ?? 0
      const maxX = window.innerWidth - w
      const maxY = window.innerHeight - 48
      const x = Math.min(Math.max(0, e.clientX - drag.current.dx), Math.max(0, maxX))
      const y = Math.min(Math.max(0, e.clientY - drag.current.dy), Math.max(0, maxY))
      setPos({ x, y })
    }
  }`;
code = code.replace(onPointerMove, newOnPointerMove);

// Resize logic
code = code.replace(
  `  const onResizeDown = (e: React.PointerEvent) => {
    e.stopPropagation()
    resize.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h, active: true }`,
  `  const onResizeDown = (e: React.PointerEvent) => {
    e.stopPropagation()
    resize.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h, active: true, lastX: e.screenX, lastY: e.screenY }`
);

const onResizeMove = `  const onResizeMove = (e: React.PointerEvent) => {
    if (!resize.current.active) return
    const maxW = 960
    const maxH = 720
    const w = Math.min(Math.max(MIN_W, resize.current.w + (e.clientX - resize.current.x)), maxW)
    const h = Math.min(Math.max(MIN_H, resize.current.h + (e.clientY - resize.current.y)), maxH)
    setSize({ w, h })
  }`;
const newOnResizeMove = `  const onResizeMove = (e: React.PointerEvent) => {
    if (!resize.current.active) return
    const maxW = 960
    const maxH = 720
    const w = Math.min(Math.max(MIN_W, resize.current.w + (e.clientX - resize.current.x)), maxW)
    const h = Math.min(Math.max(MIN_H, resize.current.h + (e.clientY - resize.current.y)), maxH)
    setSize({ w, h })
    if ((window as any).electron?.setOverlaySize) {
      (window as any).electron.setOverlaySize({ width: w, height: h })
    }
  }`;
code = code.replace(onResizeMove, newOnResizeMove);

// 6. Fix elapsed time format
const mmss = `  const [recording, setRecording] = useState(false)
  const mm = "00"
  const ss = "00"`;
const newMmss = `  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0")
  const ss = String(elapsed % 60).padStart(2, "0")`;
code = code.replace(mmss, newMmss);

// 7. Inject Audio mode toggle and fix record button
const toolButtonsOld = `        <ToolButton
          icon={ScanLine}
          label="Analyse Screen"
          active={open && view === "analyse"}
          onClick={() => openView("analyse")}
        />
        <ToolButton icon={open ? EyeOff : Eye} label={open ? "Hide" : "Show"} onClick={() => onOpenChange(!open)} />`;
const toolButtonsNew = `        <ToolButton
          icon={ScanLine}
          label="Analyse Screen"
          active={open && view === "analyse"}
          onClick={() => openView("analyse")}
        />
        <ToolButton
          icon={audioMode === "mic" ? Mic : MonitorSpeaker}
          label={audioMode === "mic" ? "Mic Audio" : "Sys Audio"}
          onClick={onToggleAudioMode}
        />
        <ToolButton icon={open ? EyeOff : Eye} label={open ? "Hide" : "Show"} onClick={() => onOpenChange(!open)} />`;
code = code.replace(toolButtonsOld, toolButtonsNew);

// Fix setRecording to onToggleRecording
code = code.replace(
  `onClick={() => setRecording((r) => !r)}`,
  `onClick={() => onToggleRecording()}`
);

// 8. Fix AnswerView
code = code.replace(
  `{view === "answer" && <AnswerView script={script} visibleCount={visibleCount} typing={typingQuestion} />}`,
  `{view === "answer" && <AnswerView script={script} visibleCount={visibleCount} typing={typingQuestion} interimText={interimText} />}`
);

const ansViewOld = `function AnswerView({
  script,
  visibleCount,
  typing,
}: {
  script: QAItem[]
  visibleCount: number
  typing: boolean
}) {`;
const ansViewNew = `function AnswerView({
  script,
  visibleCount,
  typing,
  interimText,
}: {
  script: QAItem[]
  visibleCount: number
  typing: boolean
  interimText?: string
}) {`;
code = code.replace(ansViewOld, ansViewNew);

// Fix keys in AnswerView mapping
code = code.replace(
  `{script.slice(0, visibleCount).map((ex) => (
        <Bubble key={ex.id} exchange={ex} />
      ))}`,
  `{script.slice(0, visibleCount).map((ex, i) => (
        <Bubble key={ex.id || i} exchange={ex} />
      ))}`
);

// Add interimText visualization
const typingBlockOld = `{typing && (
        <div className="animate-fade-up flex flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">Detected question</span>
          <div className="flex w-fit items-center gap-1.5 rounded-2xl rounded-tl-sm border border-white/10 bg-white/5 px-3.5 py-3 text-[13px] text-white">
            <Dot /> <Dot delay="0.15s" /> <Dot delay="0.3s" />
          </div>
        </div>
      )}`;
const typingBlockNew = `{typing && (
        <div className="animate-fade-up flex flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">Detected question</span>
          <div className="flex w-fit items-center gap-1.5 rounded-2xl rounded-tl-sm border border-white/10 bg-white/5 px-3.5 py-3 text-[13px] text-white">
            {interimText ? (
              <span>{interimText} <span className="animate-pulse">|</span></span>
            ) : (
              <><Dot /> <Dot delay="0.15s" /> <Dot delay="0.3s" /></>
            )}
          </div>
        </div>
      )}`;
code = code.replace(typingBlockOld, typingBlockNew);

fs.writeFileSync('src/components/live-overlay.tsx', code);
console.log("Full patch successfully applied!");
