import { JSMinifier } from './minifier.js';

// Make JSMinifier available globally
window.JSMinifier = JSMinifier;

// UI Functionality
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('js-minifier-input');
  const output = document.getElementById('js-minifier-output');
  const minifyBtn = document.getElementById('js-minifier-minify-btn');
  const copyBtn = document.getElementById('js-minifier-copy-btn');
  const clearBtn = document.getElementById('js-minifier-clear-btn');
  const originalSizeEl = document.getElementById('js-minifier-original-size');
  const minifiedSizeEl = document.getElementById('js-minifier-minified-size');
  const compressionRatioEl = document.getElementById('js-minifier-compression-ratio');
  
  // Option checkboxes
  const removeCommentsCheckbox = document.getElementById('js-minifier-remove-comments');
  const removeWhitespaceCheckbox = document.getElementById('js-minifier-remove-whitespace');
  const shortenVariablesCheckbox = document.getElementById('js-minifier-shorten-variables');
  const manglePropertiesCheckbox = document.getElementById('js-minifier-mangle-properties');

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
