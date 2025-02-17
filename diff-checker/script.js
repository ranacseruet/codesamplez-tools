function computeDiff(oldLines, newLines) {
  // Implementation of Myers Diff Algorithm
  function buildGraph(a, b) {
    const n = a.length;
    const m = b.length;
    const max = n + m;
    const v = new Array(2 * max + 1).fill(0);
    const trace = [];

    for (let d = 0; d <= max; d++) {
      trace.push([...v]);
      for (let k = -d; k <= d; k += 2) {
        let x;
        if (k === -d || (k !== d && v[k - 1 + max] < v[k + 1 + max])) {
          x = v[k + 1 + max];
        } else {
          x = v[k - 1 + max] + 1;
        }
        
        let y = x - k;
        
        while (x < n && y < m && a[x] === b[y]) {
          x++;
          y++;
        }
        
        v[k + max] = x;
        
        if (x >= n && y >= m) {
          return trace;
        }
      }
    }
    return trace;
  }

  function backtrack(a, b, trace) {
    const n = a.length;
    const m = b.length;
    const max = n + m;
    let x = n;
    let y = m;
    
    const path = [];
    let d = trace.length - 1;
    
    // Process any unchanged lines at the end
    while (x > 0 && y > 0 && a[x - 1] === b[y - 1]) {
      path.unshift(['unchanged', a[x - 1]]);
      x--;
      y--;
    }
    
    while (d >= 0) {
      const v = trace[d];
      const k = x - y;
      let prevk;
      
      if (k === -d || (k !== d && v[k - 1 + max] < v[k + 1 + max])) {
        prevk = k + 1;
      } else {
        prevk = k - 1;
      }
      
      const prevx = v[prevk + max];
      const prevy = prevx - prevk;
      
      while (x > prevx && y > prevy) {
        path.unshift(['unchanged', a[x - 1]]);
        x--;
        y--;
      }
      
      if (d > 0) {
        if (x === prevx) {
          path.unshift(['added', b[y - 1]]);
          y--;
        } else {
          path.unshift(['removed', a[x - 1]]);
          x--;
        }
      }
      
      d--;
    }
    
    return path;
  }

  // Handle empty input cases
  if (oldLines.length === 0) {
    return newLines.map(line => ['added', line]);
  }
  if (newLines.length === 0) {
    return oldLines.map(line => ['removed', line]);
  }

  // Main diff computation
  const trace = buildGraph(oldLines, newLines);
  const diffs = backtrack(oldLines, newLines, trace);
  
  return diffs;
}

document.getElementById('compare-button').addEventListener('click', function () {
  const text1 = document.getElementById('text1').value;
  const text2 = document.getElementById('text2').value;

  const diffResult = document.getElementById('diff-result');
  diffResult.innerHTML = '';

  const text1Lines = text1.split('\n');
  const text2Lines = text2.split('\n');

  // Detect if text is code (simple heuristic)
  const isCode1 = detectCode(text1);
  const isCode2 = detectCode(text2);

  // Compute diff on plain text lines
  const diffs = computeDiff(text1Lines, text2Lines);

  let oldLineNumber = 1;
  let newLineNumber = 1;
  diffs.forEach(([type, line]) => {
    const lineSpan = document.createElement('span');
    let outputLine;
    if (isCode1 || isCode2) {
      outputLine = Prism.highlight(line, Prism.languages.javascript, 'javascript') + '\n';
    } else {
      outputLine = line + '\n';
    }
    
    // Create line number display with proper padding
    let lineNumberHTML = '';
    const maxLineNumberLength = Math.max(
      oldLineNumber.toString().length,
      newLineNumber.toString().length
    );
    
    if (type === 'added') {
      const paddedNew = newLineNumber.toString().padStart(maxLineNumberLength, ' ');
      lineNumberHTML = `<span class="diff-line-number">${' '.repeat(maxLineNumberLength)} | ${paddedNew}</span> `;
      newLineNumber++;
    } else if (type === 'removed') {
      const paddedOld = oldLineNumber.toString().padStart(maxLineNumberLength, ' ');
      lineNumberHTML = `<span class="diff-line-number">${paddedOld} | ${' '.repeat(maxLineNumberLength)}</span> `;
      oldLineNumber++;
    } else {
      const paddedOld = oldLineNumber.toString().padStart(maxLineNumberLength, ' ');
      const paddedNew = newLineNumber.toString().padStart(maxLineNumberLength, ' ');
      lineNumberHTML = `<span class="diff-line-number">${paddedOld} | ${paddedNew}</span> `;
      oldLineNumber++;
      newLineNumber++;
    }
    
    lineSpan.innerHTML = lineNumberHTML + outputLine;
    lineSpan.classList.add(`diff-${type}`);
    diffResult.appendChild(lineSpan);
  });
});

function detectCode(text) {
  const codeKeywords = ['function', 'const', 'let', 'var', 'import', 'export', 'class', 'return', '{', '}'];
  const codeChars = ['{', '}', '(', ')', ';', '=', '=>', '.'];
  let keywordCount = 0;
  let charCount = 0;

  codeKeywords.forEach(keyword => {
    keywordCount += (text.split(keyword).length - 1);
  });
  codeChars.forEach(char => {
    charCount += (text.split(char).length - 1);
  });

  return keywordCount > 2 || charCount > 5; // Simple heuristic: more than 2 keywords or 5 code chars
}

// Expose for testing
window.computeDiff = computeDiff;
