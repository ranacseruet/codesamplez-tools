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

function diff(text1, text2) {
  const lines1 = text1.split('\n');
  const lines2 = text2.split('\n');
  let original = '';
  let modified = '';
  let lineNum1 = 1;
  let lineNum2 = 1;
  let i = 0;
  let j = 0;

  function compareLines(line1, line2) {
    let result1 = '';
    let result2 = '';
    let k = 0;
    let l = 0;
    let inMod = false;
    let modStart1 = 0;
    let modStart2 = 0;
    
    while (k < line1.length || l < line2.length) {
      if (k < line1.length && l < line2.length && line1[k] === line2[l]) {
        if (inMod) {
          result1 += `</span>${line1[k]}`;
          result2 += `</span>${line2[l]}`;
          inMod = false;
        } else {
          result1 += line1[k];
          result2 += line2[l];
        }
        k++;
        l++;
      } else {
        // Only mark as modification if both lines have content at current position
        if (k < line1.length && l < line2.length) {
          if (!inMod) {
            result1 += '<span class="mod">';
            result2 += '<span class="mod">';
            inMod = true;
          }
          result1 += line1[k];
          result2 += line2[l];
          k++;
          l++;
        } else {
          // Handle pure insertions/deletions
          if (k < line1.length) {
            result1 += `<del>${line1[k]}</del>`;
            k++;
          }
          if (l < line2.length) {
            result2 += `<ins>${line2[l]}</ins>`;
            l++;
          }
        }
      }
    }
    
    if (inMod) {
      result1 += '</span>';
      result2 += '</span>';
    }
    
    return { result1, result2 };
  }

  while (i < lines1.length || j < lines2.length) {
    if (i < lines1.length && j < lines2.length && lines1[i] === lines2[j]) {
      original += `<span class="line-num">${lineNum1++}</span>${lines1[i]}\n`;
      modified += `<span class="line-num">${lineNum2++}</span>${lines2[j]}\n`;
      i++;
      j++;
    } else if (i < lines1.length && j < lines2.length) {
      const { result1, result2 } = compareLines(lines1[i], lines2[j]);
      original += `<span class="line-num">${lineNum1++}</span>${result1}\n`;
      modified += `<span class="line-num">${lineNum2++}</span>${result2}\n`;
      i++;
      j++;
    } else if (i < lines1.length) {
      original += `<span class="line-num">${lineNum1++}</span><del>${lines1[i]}</del>\n`;
      modified += `<span class="line-num">${lineNum2++}</span>\n`;
      i++;
    } else {
      original += `<span class="line-num">${lineNum1++}</span>\n`;
      modified += `<span class="line-num">${lineNum2++}</span><ins>${lines2[j]}</ins>\n`;
      j++;
    }
  }
  return { original, modified };
}
