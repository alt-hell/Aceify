const fs = require('fs');

let code = fs.readFileSync('src/components/live-overlay.tsx', 'utf8');

// 1. Replace the missing import with an inline type
code = code.replace(
  `import type { QAItem } from "../lib/interview-data"`,
  `export type QAItem = {
  id?: string;
  question: string;
  answer: string;
  confidence?: number;
  code?: { content: string; lang: string };
}`
);

// 2. Fix the LiveOverlay function signature to include the missing destructured props and use QAItem[]
const oldSignature = `export function LiveOverlay({
  script,
  open,
  onOpenChange,
  recording,
  onToggleRecording,
  elapsed,
  typingQuestion,
}: {
  script: any[]
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

const newSignature = `export function LiveOverlay({
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

code = code.replace(oldSignature, newSignature);

// 3. Fix AnswerView's map to use index for the key
code = code.replace(
  `{script.slice(0, visibleCount).map((ex) => (
        <Bubble key={ex.id} exchange={ex} />
      ))}`,
  `{script.slice(0, visibleCount).map((ex, i) => (
        <Bubble key={ex.id || i} exchange={ex} />
      ))}`
);

// 4. Fix AnswerView's script type
code = code.replace(
  `  script: any[]
  visibleCount: number`,
  `  script: QAItem[]
  visibleCount: number`
);

fs.writeFileSync('src/components/live-overlay.tsx', code);
console.log("Fixed live-overlay.tsx types and arguments!");
