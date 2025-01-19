const diffButton = document.getElementById('diff-button');
const clearButton = document.getElementById('clear-button');
const text1Input = document.getElementById('diff-text1');
const text2Input = document.getElementById('diff-text2');
const diffOriginal = document.getElementById('diff-original');
const diffModified = document.getElementById('diff-modified');

diffButton.addEventListener('click', async function () {
  diffButton.classList.add('loading');
  diffButton.textContent = '';

  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 300));

  const text1 = text1Input.value;
  const text2 = text2Input.value;
  const { original, modified } = diff(text1, text2);
  diffOriginal.innerHTML = original;
  diffModified.innerHTML = modified;

  diffButton.classList.remove('loading');
  diffButton.textContent = 'Compare Texts';
});

clearButton.addEventListener('click', function() {
  text1Input.value = '';
  text2Input.value = '';
  diffOriginal.innerHTML = '';
  diffModified.innerHTML = '';
  text1Input.dispatchEvent(new Event('input'));
  text2Input.dispatchEvent(new Event('input'));
});

// Update floating labels on input
[text1Input, text2Input].forEach(input => {
  input.addEventListener('input', () => {
    const label = input.nextElementSibling;
    if (input.value) {
      label.classList.add('active');
    } else {
      label.classList.remove('active');
    }
  });
});

function escapeHtml(text) {
  return text
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;')
    .replace(/ /g, function(match, offset, string) {
      // Mark trailing spaces
      return offset === string.length - 1 || string[offset + 1] === '\n'
        ? '·'
        : ' ';
    });
}

function visualizeLineEnding(line) {
  return line ? `${line}<span class="line-ending">¬</span>` : '<span class="empty-line">&nbsp;</span>';
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

  function compareLines(line1, line2) {
    // Split into words but preserve spaces
    const words1 = line1.trimEnd().split(/(\s+)/).filter(w => w.length > 0);
    const words2 = line2.trimEnd().split(/(\s+)/).filter(w => w.length > 0);
    
    let result1 = '';
    let result2 = '';
    let i = 0;
    let j = 0;
    
    // Find common prefix
    let prefixLength = 0;
    while (prefixLength < words1.length && prefixLength < words2.length && 
           words1[prefixLength] === words2[prefixLength]) {
      result1 += escapeHtml(words1[prefixLength]);
      result2 += escapeHtml(words2[prefixLength]);
      prefixLength++;
    }
    
    i = prefixLength;
    j = prefixLength;
    
    while (i < words1.length || j < words2.length) {
      if (i >= words1.length) {
        // Only insertions remaining
        result2 += `<ins>${escapeHtml(words2[j++])}</ins>`;
        continue;
      }
      if (j >= words2.length) {
        // Only deletions remaining
        result1 += `<del>${escapeHtml(words1[i++])}</del>`;
        continue;
      }
      
      const word1 = words1[i];
      const word2 = words2[j];
      
      if (word1 === word2) {
        // Exact match
        result1 += escapeHtml(word1);
        result2 += escapeHtml(word2);
        i++;
        j++;
        continue;
      }
      
      if (word1.match(/\s+/) && word2.match(/\s+/)) {
        // Both are whitespace
        result1 += escapeHtml(word1);
        result2 += escapeHtml(word2);
        i++;
        j++;
        continue;
      }
      
      // Collect phrases until next matching word or whitespace
      let phrase1 = '';
      let phrase2 = '';
      let tempI = i;
      let tempJ = j;
      let nextMatch = -1;
      const lookAhead = 3;
      
      // Find next matching word or whitespace
      for (let k = 1; k <= lookAhead && tempI + k < words1.length && tempJ + k < words2.length; k++) {
        if (words1[tempI + k] === words2[tempJ + k]) {
          nextMatch = k;
          break;
        }
      }
      
      // If no match found, just take the current word
      const phraseLengthI = nextMatch > 0 ? nextMatch : 1;
      const phraseLengthJ = nextMatch > 0 ? nextMatch : 1;
      
      // Collect phrases
      for (let k = 0; k < phraseLengthI; k++) {
        if (tempI < words1.length) phrase1 += words1[tempI++];
      }
      for (let k = 0; k < phraseLengthJ; k++) {
        if (tempJ < words2.length) phrase2 += words2[tempJ++];
      }
      
      // Check if phrases are similar
      const similar = (() => {
        // Clean and normalize phrases
        const clean = str => str.toLowerCase().replace(/\s+/g, '');
        const p1 = clean(phrase1);
        const p2 = clean(phrase2);
        
        if (!p1 || !p2) return false;
        
        // For very short phrases (1-2 chars), require exact match
        if (p1.length <= 2 || p2.length <= 2) {
          return p1 === p2;
        }
        
        // For longer phrases, use various similarity metrics
        const maxLen = Math.max(p1.length, p2.length);
        const minLen = Math.min(p1.length, p2.length);
        
        // Length similarity check
        if (Math.abs(p1.length - p2.length) > maxLen * 0.5) {
          return false;
        }
        
        // Common characters check
        const commonChars = [...p1].filter(c => p2.includes(c)).length;
        const charSimilarity = commonChars / maxLen;
        
        // Common prefix check
        const prefixLength = (() => {
          let len = 0;
          while (len < minLen && p1[len] === p2[len]) len++;
          return len;
        })();
        const prefixSimilarity = prefixLength / minLen;
        
        // Combine metrics
        return (
          charSimilarity >= 0.6 || // Many common characters
          prefixSimilarity >= 0.5 || // Significant common prefix
          (charSimilarity >= 0.4 && prefixSimilarity >= 0.3) // Combined partial matches
        );
      })();
      
      // Apply highlighting
      if (similar) {
        result1 += `<span class="mod">${escapeHtml(phrase1)}</span>`;
        result2 += `<span class="mod">${escapeHtml(phrase2)}</span>`;
        i = tempI;
        j = tempJ;
      } else {
        // Just handle the current word
        result1 += `<del>${escapeHtml(words1[i++])}</del>`;
        result2 += `<ins>${escapeHtml(words2[j++])}</ins>`;
      }
    }
    
    return { result1, result2 };
  }

  while (i < lines1.length || j < lines2.length) {
    if (i < lines1.length && j < lines2.length && lines1[i] === lines2[j]) {
      // Add padding to line numbers for alignment
      const paddedNum1 = lineNum1.toString().padStart(lineNumWidth, ' ');
      const paddedNum2 = lineNum2.toString().padStart(lineNumWidth, ' ');

      original += `<span class="line-num">${paddedNum1}</span>${visualizeLineEnding(escapeHtml(lines1[i]))}\n`;
      modified += `<span class="line-num">${paddedNum2}</span>${visualizeLineEnding(escapeHtml(lines2[j]))}\n`;
      lineNum1++;
      lineNum2++;
      i++;
      j++;
    } else if (i < lines1.length && j < lines2.length) {
      const { result1, result2 } = compareLines(lines1[i], lines2[j]);
      const paddedNum1 = lineNum1.toString().padStart(lineNumWidth, ' ');
      const paddedNum2 = lineNum2.toString().padStart(lineNumWidth, ' ');

      original += `<span class="line-num">${paddedNum1}</span>${visualizeLineEnding(result1)}\n`;
      modified += `<span class="line-num">${paddedNum2}</span>${visualizeLineEnding(result2)}\n`;
      lineNum1++;
      lineNum2++;
      i++;
      j++;
    } else if (i < lines1.length) {
      const paddedNum1 = lineNum1.toString().padStart(lineNumWidth, ' ');
      const paddedNum2 = lineNum2.toString().padStart(lineNumWidth, ' ');

      original += `<span class="line-num">${paddedNum1}</span><del>${visualizeLineEnding(escapeHtml(lines1[i]))}</del>\n`;
      modified += `<span class="line-num">${paddedNum2}</span><span class="empty-line">&nbsp;</span>\n`;
      lineNum1++;
      i++;
    } else if (j < lines2.length) {
      const paddedNum1 = lineNum1.toString().padStart(lineNumWidth, ' ');
      const paddedNum2 = lineNum2.toString().padStart(lineNumWidth, ' ');

      original += `<span class="line-num">${paddedNum1}</span><span class="empty-line">&nbsp;</span>\n`;
      modified += `<span class="line-num">${paddedNum2}</span><ins>${visualizeLineEnding(escapeHtml(lines2[j]))}</ins>\n`;
      lineNum2++;
      j++;
    }
  }
  return { original, modified };
}
