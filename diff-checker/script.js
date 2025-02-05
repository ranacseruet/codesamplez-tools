// Plain JavaScript Diff Algorithm
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
