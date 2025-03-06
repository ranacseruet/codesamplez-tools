// UI Functionality
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('input');
  const output = document.getElementById('output');
  const minifyBtn = document.getElementById('minify');
  const copyBtn = document.getElementById('copy');
  const clearBtn = document.getElementById('clear');
  const originalSizeEl = document.getElementById('originalSize');
  const minifiedSizeEl = document.getElementById('minifiedSize');
  const compressionRatioEl = document.getElementById('compressionRatio');
  
  // Option checkboxes
  const removeCommentsCheckbox = document.getElementById('removeComments');
  const removeWhitespaceCheckbox = document.getElementById('removeWhitespace');
  const shortenVariablesCheckbox = document.getElementById('shortenVariables');
  const manglePropertiesCheckbox = document.getElementById('mangleProperties');

  // Update statistics
  function updateStats(original, minified) {
    const originalBytes = new Blob([original]).size;
    const minifiedBytes = new Blob([minified]).size;
    const ratio = originalBytes ? ((1 - minifiedBytes / originalBytes) * 100).toFixed(2) : 0;
    
    originalSizeEl.textContent = `${originalBytes.toLocaleString()} bytes`;
    minifiedSizeEl.textContent = `${minifiedBytes.toLocaleString()} bytes`;
    compressionRatioEl.textContent = `${ratio}%`;
  }

  // Minify the code
  function minifyCode() {
    const code = input.value;
    
    if (!code.trim()) {
      output.value = '';
      updateStats('', '');
      return;
    }
    
    const options = {
      removeComments: removeCommentsCheckbox.checked,
      removeWhitespace: removeWhitespaceCheckbox.checked,
      shortenVariables: shortenVariablesCheckbox.checked,
      mangleProperties: manglePropertiesCheckbox.checked
    };
    
    const minifier = new JSMinifier(options);
    
    try {
      const minified = minifier.minify(code);
      output.value = minified;
      updateStats(code, minified);
    } catch (error) {
      output.value = `Error during minification: ${error.message}`;
      console.error('Minification error:', error);
    }
  }

  // Copy to clipboard
  function copyToClipboard() {
    output.select();
    document.execCommand('copy');
    
    // Visual feedback
    const originalText = copyBtn.textContent;
    copyBtn.textContent = 'Copied!';
    setTimeout(() => {
      copyBtn.textContent = originalText;
    }, 1500);
  }

  // Clear all fields
  function clearAll() {
    input.value = '';
    output.value = '';
    updateStats('', '');
  }

  // Event listeners
  minifyBtn.addEventListener('click', minifyCode);
  copyBtn.addEventListener('click', copyToClipboard);
  clearBtn.addEventListener('click', clearAll);
  
  // Auto-minify when options change
  removeCommentsCheckbox.addEventListener('change', minifyCode);
  removeWhitespaceCheckbox.addEventListener('change', minifyCode);
  shortenVariablesCheckbox.addEventListener('change', minifyCode);
  manglePropertiesCheckbox.addEventListener('change', minifyCode);
  
  // Initial minification
  minifyCode();
});