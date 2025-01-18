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

  while (i < lines1.length || j < lines2.length) {
    if (i < lines1.length && j < lines2.length && lines1[i] === lines2[j]) {
      original += `<span class="line-num">${lineNum1++}</span>${lines1[i]}\n`;
      modified += `<span class="line-num">${lineNum2++}</span>${lines2[j]}\n`;
      i++;
      j++;
    } else if (i < lines1.length) {
      original += `<span class="line-num">${lineNum1++}</span><del>${lines1[i]}</del>\n`;
      modified += `<span class="line-num">${lineNum2++}</span>\n`; // Increment lineNum2 here
      i++;
    } else {
      original += `<span class="line-num">${lineNum1++}</span>\n`; // Increment lineNum1 here
      modified += `<span class="line-num">${lineNum2++}</span><ins>${lines2[j]}</ins>\n`;
      j++;
    }
  }
  return { original, modified };
}
