/**
 * humanizer.js
 * Post-processes AI-generated answers to remove robotic giveaway phrases
 * and replace them with natural human speech patterns.
 */

const ROBOTIC_REPLACEMENTS = [
  // Opening giveaways
  { find: /^Certainly[,!]/i, replace: 'Sure,' },
  { find: /^Absolutely[,!]/i, replace: 'Yeah,' },
  { find: /^Great question[,!]/i, replace: '' },
  { find: /^Of course[,!]/i, replace: 'Sure,' },
  { find: /^I'd be happy to[^.]*\./i, replace: '' },
  { find: /^As an AI[^.]*\./i, replace: '' },
  { find: /^As a software engineer,/i, replace: 'So in my experience,' },
  { find: /^That's a great/i, replace: 'So' },
  { find: /^Excellent question[,!]/i, replace: '' },
  { find: /^Thank you for asking[,!]/i, replace: '' },

  // Mid-sentence formal language
  { find: /It is worth noting that/gi, replace: 'Also,' },
  { find: /It is important to note that/gi, replace: 'The key thing is' },
  { find: /In conclusion,/gi, replace: 'So basically,' },
  { find: /Furthermore,/gi, replace: 'Also,' },
  { find: /Moreover,/gi, replace: 'And also,' },
  { find: /Nevertheless,/gi, replace: 'That said,' },
  { find: /In summary,/gi, replace: 'So basically,' },
  { find: /To summarize,/gi, replace: 'So,' },
  { find: /As previously mentioned,/gi, replace: 'Like I said,' },
  { find: /In order to/gi, replace: 'To' },
  { find: /utilize/gi, replace: 'use' },
  { find: /leverage/gi, replace: 'use' },
  { find: /implement/gi, replace: 'build' },
  { find: /facilitate/gi, replace: 'help with' },
  { find: /endeavor/gi, replace: 'try' },
  { find: /commence/gi, replace: 'start' }
]

function humanize(text) {
  if (!text) return text

  let result = text.trim()

  for (const { find, replace } of ROBOTIC_REPLACEMENTS) {
    result = result.replace(find, replace)
  }

  // Clean up double spaces and leading commas after replacements
  result = result.replace(/^[,\s]+/, '').replace(/  +/g, ' ').trim()

  // Capitalize first letter
  if (result.length > 0) {
    result = result.charAt(0).toUpperCase() + result.slice(1)
  }

  return result
}

module.exports = { humanize }
