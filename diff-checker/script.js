// ===================================
// Text Formatting
// Handles text visualization and HTML
// ===================================

function visualizeSpaces(text, config = {
  showAllSpaces: true,
  showTabs: true,
  showNonBreaking: true
}) {
  let result = text;

  // Handle tabs first
  if (config.showTabs) {
    result = result.replace(/\t/g, '→');
  }

  // Handle spaces based on configuration
  if (config.showAllSpaces) {
    // Show all spaces as dots
    result = result.replace(/ /g, '·');
  } else {
    // Only show trailing spaces as dots (including consecutive spaces)
    result = result.replace(/ +(?=\n|$)/g, match => '·'.repeat(match.length));
    // Keep other spaces as they are
    result = result.replace(/ +(?!\n|$)/g, match => ' '.repeat(match.length));
  }
  
  return result;
}

function escapeHtml(text, config = {
  showAllSpaces: true,
  showTabs: true,
  showNonBreaking: true
}) {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  return visualizeSpaces(escaped, config);
}

function visualizeLineEnding(line) {
  if (line === undefined || line === null || line === '') {
    return '<span class="empty-line">&nbsp;</span>';
  }
  return line;  // Line endings are handled in compareLines
}

function addLineEnding(text) {
  return `${text}<span class="line-ending">¬</span>`;
}

// ===================================
// Diff Algorithm
// Core comparison logic
// ===================================

function checkSimilarity(word1, word2) {
  const clean1 = word1.toLowerCase().replace(/\s+/g, '');
  const clean2 = word2.toLowerCase().replace(/\s+/g, '');
  
  if (!clean1 || !clean2) return false;
  
  // For very short words, require exact match
  if (clean1.length <= 2 || clean2.length <= 2) {
    return clean1 === clean2;
  }
  
  // For longer words, use similarity metrics
  const maxLen = Math.max(clean1.length, clean2.length);
  const minLen = Math.min(clean1.length, clean2.length);
  
  // Length difference check
  if (Math.abs(clean1.length - clean2.length) > maxLen * 0.5) {
    return false;
  }
  
  // Common characters check
  const commonChars = [...clean1].filter(c => clean2.includes(c)).length;
  const charSimilarity = commonChars / maxLen;
  
  // Common prefix check
  let prefixLength = 0;
  while (prefixLength < minLen && clean1[prefixLength] === clean2[prefixLength]) {
    prefixLength++;
  }
  const prefixSimilarity = prefixLength / minLen;
  
  return (
    charSimilarity >= 0.6 || // Many common characters
    prefixSimilarity >= 0.5 || // Significant common prefix
    (charSimilarity >= 0.4 && prefixSimilarity >= 0.3) // Combined partial matches
  );
}

function getPhraseMatcher(text) {
  // Return multiple matches of known patterns
  const patterns = [
    /Line \d+/g,
    /New Line/g,
    /<[^>]+>/g,
    /\s+/g,
    /[^\s<>]+/g
  ];

  const matches = [];
  let lastIndex = 0;

  patterns.forEach(pattern => {
    pattern.lastIndex = 0;  // Reset for global patterns
    let match;
    while ((match = pattern.exec(text)) !== null) {
      matches.push({
        text: match[0],
        index: match.index,
        length: match[0].length
      });
    }
  });

  // Sort by index and filter overlaps
  matches.sort((a, b) => a.index - b.index);
  const filtered = [];
  let currentEnd = 0;

  matches.forEach(match => {
    if (match.index >= currentEnd) {
      filtered.push(match);
      currentEnd = match.index + match.length;
    }
  });

  return filtered.map(m => m.text);
}

function compareLines(line1, line2, config) {
  if (line1 === line2) {
    return {
      result1: addLineEnding(escapeHtml(line1, config)),
      result2: addLineEnding(escapeHtml(line2, config))
    };
  }

  if (line1 === '' && line2 === '') {
    const emptyLine = '<span class="empty-line">&nbsp;</span>';
    return { result1: emptyLine, result2: emptyLine };
  }

  // Handle empty line cases
  if (line1 === '') {
    return {
      result1: '<span class="empty-line">&nbsp;</span>',
      result2: `<ins>${addLineEnding(escapeHtml(line2, config))}</ins>`
    };
  }
  if (line2 === '') {
    return {
      result1: `<del>${addLineEnding(escapeHtml(line1, config))}</del>`,
      result2: '<span class="empty-line">&nbsp;</span>'
    };
  }

  const words1 = getPhraseMatcher(line1);
  const words2 = getPhraseMatcher(line2);
  
  let result1 = '';
  let result2 = '';
  let i = 0;
  let j = 0;
  
  while (i < words1.length || j < words2.length) {
    // Handle remaining words in text1
    if (i < words1.length && j >= words2.length) {
      if (/\S/.test(words1[i])) {
        result1 += `<del>${escapeHtml(words1[i], config)}</del>`;
      } else {
        result1 += escapeHtml(words1[i], config);
      }
      i++;
      continue;
    }
    
    // Handle remaining words in text2
    if (j < words2.length && i >= words1.length) {
      if (/\S/.test(words2[j])) {
        result2 += `<ins>${escapeHtml(words2[j], config)}</ins>`;
      } else {
        result2 += escapeHtml(words2[j], config);
      }
      j++;
      continue;
    }
    
    // Both texts have words to compare
    const word1 = words1[i];
    const word2 = words2[j];
    
    if (word1 === word2) {
      result1 += escapeHtml(word1, config);
      result2 += escapeHtml(word2, config);
    } else if (/^\s+$/.test(word1) && /^\s+$/.test(word2)) {
      // Handle whitespace differences more precisely
      if (word1 === word2) {
        result1 += escapeHtml(word1, config);
        result2 += escapeHtml(word2, config);
      } else {
        result1 += `<del>${escapeHtml(word1, config)}</del>`;
        result2 += `<ins>${escapeHtml(word2, config)}</ins>`;
      }
    } else if (checkSimilarity(word1, word2)) {
      result1 += `<span class="mod">${escapeHtml(word1, config)}</span>`;
      result2 += `<span class="mod">${escapeHtml(word2, config)}</span>`;
    } else {
      result1 += `<del>${escapeHtml(word1, config)}</del>`;
      result2 += `<ins>${escapeHtml(word2, config)}</ins>`;
    }
    i++;
    j++;
  }
  
  // Always apply line endings after all the comparison logic
  return {
    result1: addLineEnding(result1),
    result2: addLineEnding(result2)
  };
}

// ===================================
// Main Diff Implementation
// Core public function
// ===================================

function diff(text1, text2, config = {
  showAllSpaces: true,
  showTabs: true,
  showNonBreaking: true
}) {
  // Split and ensure empty lines are preserved
  const lines1 = text1.split('\n');
  const lines2 = text2.split('\n');
  let original = '';
  let modified = '';
  let lineNum1 = 1;
  let lineNum2 = 1;
  let i = 0;
  let j = 0;

  // Track max line number width for alignment
  const maxLineNum = Math.max(lines1.length, lines2.length);
  const lineNumWidth = maxLineNum.toString().length;

  while (i < lines1.length || j < lines2.length) {
    const paddedNum1 = lineNum1.toString().padStart(lineNumWidth, ' ');
    const paddedNum2 = lineNum2.toString().padStart(lineNumWidth, ' ');

    if (i < lines1.length && j < lines2.length) {
      if (lines1[i] === lines2[j]) {
        const visualized = addLineEnding(escapeHtml(lines1[i], config));
        original += `<span class="line-num">${paddedNum1}</span>${visualized}\n`;
        modified += `<span class="line-num">${paddedNum2}</span>${visualized}\n`;
      } else {
        const { result1, result2 } = compareLines(lines1[i], lines2[j], config);
        original += `<span class="line-num">${paddedNum1}</span>${result1}\n`;
        modified += `<span class="line-num">${paddedNum2}</span>${result2}\n`;
      }
      lineNum1++;
      lineNum2++;
      i++;
      j++;
    } else if (i < lines1.length) {
      original += `<span class="line-num">${paddedNum1}</span><del>${addLineEnding(escapeHtml(lines1[i], config))}</del>\n`;
      modified += `<span class="line-num">${paddedNum2}</span><span class="empty-line">&nbsp;</span>\n`;
      lineNum1++;
      i++;
    } else {
      original += `<span class="line-num">${paddedNum1}</span><span class="empty-line">&nbsp;</span>\n`;
      modified += `<span class="line-num">${paddedNum2}</span><ins>${addLineEnding(escapeHtml(lines2[j], config))}</ins>\n`;
      lineNum2++;
      j++;
    }
  }

  return { original, modified };
}

// ===================================
// UI Integration
// DOM handling and events
// ===================================

// Only run DOM-related code in browser environments
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const diffButton = document.getElementById('diff-button');
    const clearButton = document.getElementById('clear-button');
    const diffText1 = document.getElementById('diff-text1');
    const diffText2 = document.getElementById('diff-text2');
    const diffOriginal = document.getElementById('diff-original');
    const diffModified = document.getElementById('diff-modified');

    diffButton.addEventListener('click', () => {
      const text1 = diffText1.value;
      const text2 = diffText2.value;
      const { original, modified } = diff(text1, text2);
      diffOriginal.innerHTML = original;
      diffModified.innerHTML = modified;
    });

    clearButton.addEventListener('click', () => {
      diffText1.value = '';
      diffText2.value = '';
      diffOriginal.innerHTML = '';
      diffModified.innerHTML = '';
    });
  });
}

// ===================================
// Public API
// Exports for testing
// ===================================

export { diff, visualizeSpaces, escapeHtml };
