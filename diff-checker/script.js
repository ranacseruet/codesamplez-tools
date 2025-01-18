const diffButton = document.getElementById('diff-button');
const clearButton = document.getElementById('clear-button');
const text1Input = document.getElementById('diff-text1');
const text2Input = document.getElementById('diff-text2');
const diffResult = document.getElementById('diff-result');

diffButton.addEventListener('click', async function () {
  diffButton.classList.add('loading');
  diffButton.textContent = '';
  
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 300));
  
  const text1 = text1Input.value;
  const text2 = text2Input.value;
  diffResult.innerHTML = diff(text1, text2);
  
  diffButton.classList.remove('loading');
  diffButton.textContent = 'Compare Texts';
});

clearButton.addEventListener('click', function() {
  text1Input.value = '';
  text2Input.value = '';
  diffResult.innerHTML = '';
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
  let result = '';
  let i = 0, j = 0;

  while (i < lines1.length || j < lines2.length) {
    if (i < lines1.length && j < lines2.length && lines1[i] === lines2[j]) {
      result += lines1[i] + '\n';
      i++;
      j++;
    } else {
      if (j < lines2.length && (i >= lines1.length || lines1.indexOf(lines2[j], i) === -1)) {
        result += `<ins>${lines2[j]}</ins>\n`;
        j++;
      } else if (i < lines1.length && (j >= lines2.length || lines2.indexOf(lines1[i], j) === -1)) {
        result += `<del>${lines1[i]}</del>\n`;
        i++;
      } else {
        result += `<del>${lines1[i]}</del>\n`;
        result += `<ins>${lines2[j]}</ins>\n`;
        i++;
        j++;
      }
    }
  }

  return result;
}
