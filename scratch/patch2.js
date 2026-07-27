const fs = require('fs');
const code = fs.readFileSync('src/components/Overlay.jsx', 'utf8');
const lines = code.split('\n');

let startIndex = -1;
for (let i = 1090; i < lines.length; i++) {
  if (lines[i].startsWith('  return (')) {
    startIndex = i;
    break;
  }
}

if (startIndex !== -1) {
  const before = lines.slice(0, startIndex).join('\n');
  const replacement = `  return (
    <LiveOverlay
      script={answerHistory}
      open={expanded}
      onOpenChange={setExpanded}
      recording={recording}
      onToggleRecording={() => {
        if (recording) stopRecording();
        else startRecording();
      }}
      elapsed={0}
      typingQuestion={processing || interimText.length > 0}
      interimText={interimText}
    />
  )
}
`;
  fs.writeFileSync('src/components/Overlay.jsx', before + '\n' + replacement);
  console.log("Patched successfully via slicing!");
} else {
  console.log("Could not find start index");
}
