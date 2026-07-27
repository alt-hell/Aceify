const fs = require('fs');

const path = 'c:/Interview tool/src/components/Overlay.jsx';
const content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');

// Find the line that starts with "  // ── Invisible overlay"
const targetIndex = lines.findIndex(line => line.includes('// ── Invisible overlay'));

if (targetIndex !== -1) {
  // Keep everything before the target
  const newLines = lines.slice(0, targetIndex);
  
  // Add the LiveOverlay import at the top
  newLines.splice(3, 0, "import { LiveOverlay } from './live-overlay';");
  
  // Add the new render block
  newLines.push(`  return (
    <LiveOverlay 
      script={answerData ? [answerData] : []}
      open={visible}
      onOpenChange={setVisible}
      recording={recording}
      onToggleRecording={() => recording ? stopRecording() : startRecording()}
      elapsed={0}
      typingQuestion={processing}
      interimText={interimTranscript}
      audioMode={audioMode}
      onToggleAudioMode={() => setAudioMode(m => m === 'mic' ? 'system' : 'mic')}
    />
  )
}`);

  fs.writeFileSync(path, newLines.join('\n'));
  console.log('Successfully patched Overlay.jsx');
} else {
  console.log('Could not find the target line');
}
