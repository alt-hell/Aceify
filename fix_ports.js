const fs = require('fs');
let content = fs.readFileSync('src/components/Overlay.jsx', 'utf8');
const original = content;

// Fix pattern: value: `something' (backtick open, single-quote close inside JSX style objects)
// This is a known corruption from the regex replacement
// Pattern appears in JSX style objects like: fontSize: `11px', color: `#34D399`, etc.

// Fix backtick-started, single-quote-ended CSS value strings in JSX style objects
// These are short strings like `11px' `flex' `row' `center' `none' `hidden' etc.
content = content.replace(/: `([^`'\n${}]{1,40})'/g, ": '$1'");

// Fix single-quote-started, backtick-ended CSS value strings
content = content.replace(/: '([^`'\n${}]{1,40})`/g, ": '$1'");

// Fix mixed in display/position/etc values that got corrupted
// e.g. display: `flex', alignItems: `center'
content = content.replace(/`(flex|row|column|center|none|block|hidden|absolute|relative|fixed|wrap|nowrap|auto|bold|pointer|default|ellipsis|normal|pre|inherit|initial|unset|start|end|space-between|space-around|baseline|stretch|transparent)'/g, "'$1'");
content = content.replace(/'(flex|row|column|center|none|block|hidden|absolute|relative|fixed|wrap|nowrap|auto|bold|pointer|default|ellipsis|normal|pre|inherit|initial|unset|start|end|space-between|space-around|baseline|stretch|transparent)`/g, "'$1'");

fs.writeFileSync('src/components/Overlay.jsx', content);
console.log('Fixed! Lines changed:', (content !== original) ? 'YES' : 'NO');
