// Core diff functionality
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/ /g, (match, offset, string) => {
      return offset === string.length - 1 || string[offset + 1] === '\n'
        ? '·'
        : ' ';
    });
}

function visualizeLineEnding(line) {
  if (line === undefined || line === null) {
    return '<span class="empty-line">&nbsp;</span>';
  }
  return `${line}<span class="line-ending">¬</span>`;
}

function diff(text1, text2) {
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

  function compareLines(line1, line2) {
    if (line1 === line2) {
      return {
        result1: escapeHtml(line1),
        result2: escapeHtml(line2)
      };
    }

    if (line1 === '' && line2 === '') {
      return {
        result1: '<span class="empty-line">&nbsp;</span>',
        result2: '<span class="empty-line">&nbsp;</span>'
      };
    }

    // Handle empty line cases
    if (line1 === '') {
      return {
        result1: '<span class="empty-line">&nbsp;</span>',
        result2: `<ins>${escapeHtml(line2)}</ins>`
      };
    }
    if (line2 === '') {
      return {
        result1: `<del>${escapeHtml(line1)}</del>`,
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
          result1 += `<del>${escapeHtml(words1[i])}</del>`;
        } else {
          result1 += escapeHtml(words1[i]);
        }
        i++;
        continue;
      }
      
      // Handle remaining words in text2
      if (j < words2.length && i >= words1.length) {
        if (/\S/.test(words2[j])) {
          result2 += `<ins>${escapeHtml(words2[j])}</ins>`;
        } else {
          result2 += escapeHtml(words2[j]);
        }
        j++;
        continue;
      }
      
      // Both texts have words to compare
      const word1 = words1[i];
      const word2 = words2[j];
      
      if (word1 === word2) {
        result1 += escapeHtml(word1);
        result2 += escapeHtml(word2);
      } else if (/^\s+$/.test(word1) && /^\s+$/.test(word2)) {
        result1 += escapeHtml(word1);
        result2 += escapeHtml(word2);
      } else if (checkSimilarity(word1, word2)) {
        result1 += `<span class="mod">${escapeHtml(word1)}</span>`;
        result2 += `<span class="mod">${escapeHtml(word2)}</span>`;
      } else {
        result1 += `<del>${escapeHtml(word1)}</del>`;
        result2 += `<ins>${escapeHtml(word2)}</ins>`;
      }
      i++;
      j++;
    }
    
    return { result1, result2 };
  }

  while (i < lines1.length || j < lines2.length) {
    const paddedNum1 = lineNum1.toString().padStart(lineNumWidth, ' ');
    const paddedNum2 = lineNum2.toString().padStart(lineNumWidth, ' ');

    if (i < lines1.length && j < lines2.length) {
      if (lines1[i] === lines2[j]) {
        original += `<span class="line-num">${paddedNum1}</span>${visualizeLineEnding(escapeHtml(lines1[i]))}\n`;
        modified += `<span class="line-num">${paddedNum2}</span>${visualizeLineEnding(escapeHtml(lines2[j]))}\n`;
      } else {
        const { result1, result2 } = compareLines(lines1[i], lines2[j]);
        original += `<span class="line-num">${paddedNum1}</span>${visualizeLineEnding(result1)}\n`;
        modified += `<span class="line-num">${paddedNum2}</span>${visualizeLineEnding(result2)}\n`;
      }
      lineNum1++;
      lineNum2++;
      i++;
      j++;
    } else if (i < lines1.length) {
      original += `<span class="line-num">${paddedNum1}</span><del>${visualizeLineEnding(escapeHtml(lines1[i]))}</del>\n`;
      modified += `<span class="line-num">${paddedNum2}</span><span class="empty-line">&nbsp;</span>\n`;
      lineNum1++;
      i++;
    } else {
      original += `<span class="line-num">${paddedNum1}</span><span class="empty-line">&nbsp;</span>\n`;
      modified += `<span class="line-num">${paddedNum2}</span><ins>${visualizeLineEnding(escapeHtml(lines2[j]))}</ins>\n`;
      lineNum2++;
      j++;
    }
  }

  return { original, modified };
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { diff };
}
