const fs = require('fs');
let code = fs.readFileSync('src/components/Overlay.jsx', 'utf8');

const targetStr = "  return (\n    <div style={{\n      position: 'fixed'";
const idx = code.indexOf(targetStr);

if (idx !== -1) {
  const newCode = code.substring(0, idx) + `  return (
    <LiveOverlay
      script={answerHistory}
      open={expanded}
      onOpenChange={setExpanded}
      recording={recording}
      onToggleRecording={() => recording ? stopRecording() : startRecording()}
      elapsed={0}
      typingQuestion={processing || interimText.length > 0}
      interimText={interimText}
    />
  )
}
`;
  fs.writeFileSync('src/components/Overlay.jsx', newCode);
  console.log("Patched successfully!");
} else {
  console.log("Could not find the target string!");
}
