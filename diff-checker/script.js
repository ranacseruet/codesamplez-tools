// Plain JavaScript Diff Algorithm
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
    
    while (d > 0) {
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
  const text1 = document.getElementById('text1').value.split('\n');
  const text2 = document.getElementById('text2').value.split('\n');
  const diffResult = document.getElementById('diff-result');
  diffResult.innerHTML = '';

  const diffs = computeDiff(text1, text2);

  diffs.forEach(([type, line]) => {
    const span = document.createElement('span');
    span.textContent = line + '\n';
    if (type === 'added') {
      span.classList.add('diff-added');
    } else if (type === 'removed') {
      span.classList.add('diff-removed');
    }
    diffResult.appendChild(span);
  });
});

// Expose for testing
window.computeDiff = computeDiff;
