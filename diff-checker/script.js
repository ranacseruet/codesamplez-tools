 // Plain JavaScript Diff Algorithm
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

  diffResult.innerHTML = ''; // Clear previous result

  diffs.forEach(([type, line]) => {
    const lineSpan = document.createElement('span');
    let highlightedLine = line;
    let outputLine;
    if (isCode1 || isCode2) {
      outputLine = Prism.highlight(line, Prism.languages.javascript, 'javascript') + '\n';
      lineSpan.innerHTML = outputLine; // Use innerHTML for highlighted code
    } else {
      outputLine = line + '\n';
      lineSpan.textContent = outputLine; // Use textContent for plain text
    }

    if (type === 'added') {
      lineSpan.classList.add('diff-added');
    } else if (type === 'removed') {
      lineSpan.classList.add('diff-removed');
    }
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

function computeDiff(oldLines, newLines) {
  const diffs = [];
  let oldIndex = 0;
  let newIndex = 0;

  while (oldIndex < oldLines.length || newIndex < newLines.length) {
    if (oldIndex < oldLines.length && newIndex < newLines.length && oldLines[oldIndex] === newLines[newIndex]) {
      diffs.push(['unchanged', oldLines[oldIndex]]);
      oldIndex++;
      newIndex++;
    } else {
      if (newIndex < newLines.length && (oldIndex >= oldLines.length || !oldLines.includes(newLines[newIndex]))) {
        diffs.push(['added', newLines[newIndex]]);
        newIndex++;
      } else if (oldIndex < oldLines.length && (newIndex >= newLines.length || !newLines.includes(oldLines[oldIndex]))) {
        diffs.push(['removed', oldLines[oldIndex]]);
        oldIndex++;
      } else {
        oldIndex++;
        newIndex++;
      }
    }
  }

  return diffs;
}
