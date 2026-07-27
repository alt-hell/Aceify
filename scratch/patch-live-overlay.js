const fs = require('fs');
let code = fs.readFileSync('src/components/live-overlay.tsx', 'utf8');

// 1. Imports
code = code.replace('@/lib/utils', '../lib/utils');
code = code.replace('@/components/code-block', '../components/code-block');

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

// 2. Signature
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

// 3. Remove simulation states
code = code.replace(
  /  \/\/ Answer streaming\n  const \[visibleCount, setVisibleCount\] = useState\(0\)\n  const \[typingQuestion, setTypingQuestion\] = useState\(false\)/,
  '  // Answer streaming\n  const visibleCount = script.length'
);

// 4. Remove simulation useEffects
// The simulation useEffects are:
// "Simulate detecting a question" and "Simulate typing an answer"
const simStart = code.indexOf('  // Simulate detecting a question');
const simEnd = code.indexOf('  /* ---------- Dragging the whole widget ---------- */');
if (simStart !== -1 && simEnd !== -1) {
  code = code.substring(0, simStart) + code.substring(simEnd);
}

// 5. Drag and Resize logic
// We need to patch the electron movement if available.
code = code.replace(
  `    if ((window as any).electron?.moveByDelta) {`,
  `    if ((window as any).electron?.moveByDelta) {`
); // wait, it's already there in the new UI! 
// Let's check if the new UI already had electron dragging logic!
// Let's print out what is there.
