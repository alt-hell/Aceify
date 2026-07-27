/**
 * codeFormatter.js
 * Cleans and formats code snippets to ensure they look human-written
 * in an interview context — simple, readable, not over-engineered.
 */

function formatCode(code, language = 'javascript') {
  if (!code) return code

  let formatted = code

  // Remove excessive blank lines (max 1 consecutive blank line)
  formatted = formatted.replace(/\n{3,}/g, '\n\n')

  // Remove trailing whitespace on each line
  formatted = formatted.split('\n').map(line => line.trimEnd()).join('\n')

  // Trim leading/trailing blank lines
  formatted = formatted.trim()

  return formatted
}

/**
 * Detects if a block of text contains a code snippet
 */
function containsCode(text) {
  if (!text) return false
  return (
    text.includes('```') ||
    (text.includes('function ') && text.includes('{')) ||
    text.includes('def ') ||
    text.includes('class ') ||
    /^\s*(const|let|var|import|export)\s/m.test(text) ||
    text.includes('->') ||
    text.includes('=>')
  )
}

/**
 * Extracts code block from a markdown-formatted string
 */
function extractCode(text) {
  const match = text.match(/```(?:\w+)?\n?([\s\S]*?)```/)
  if (match) {
    return match[1].trim()
  }
  return null
}

module.exports = { formatCode, containsCode, extractCode }
