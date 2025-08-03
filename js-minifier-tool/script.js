import { JSMinifier } from './minifier.js';
import { NotificationManager } from '../common/notification-manager.js';
import ClearButton from '../common/clear-button/ClearButton.js';

// Make JSMinifier available globally
window.JSMinifier = JSMinifier;

// Sample JavaScript code
const SAMPLE_CODE = `// Example JavaScript function
function calculateSum(numbers) {
  // This function calculates the sum of all numbers in an array
  let sum = 0;
  
  for (let i = 0; i < numbers.length; i++) {
    // Add each number to the sum
    sum = sum + numbers[i];
  }
  
  // Return the final sum
  return sum;
}

// Example usage
const myNumbers = [1, 2, 3, 4, 5];
const result = calculateSum(myNumbers);
console.log("The sum is: " + result);`;

// UI Functionality
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('js-minifier-input');
  const output = document.getElementById('js-minifier-output');
  const minifyBtn = document.getElementById('js-minifier-minify-btn');
  const copyBtn = document.getElementById('js-minifier-copy-btn');
  const originalSizeEl = document.getElementById('js-minifier-original-size');
  const minifiedSizeEl = document.getElementById('js-minifier-minified-size');
  const compressionRatioEl = document.getElementById('js-minifier-compression-ratio');
  
  // Initialize ClearButton component for the input textarea
  const clearButtonInstance = new ClearButton(input);
  
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
      NotificationManager.show('Please enter JavaScript to minify', 2000, { type: 'error' });
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
      NotificationManager.show(`JavaScript minified successfully! (${compressionRatioEl.textContent} reduction)`, 2000, { type: 'success' });
    } catch (error) {
      output.value = '';
      NotificationManager.show(`Minification error: ${error.message}`, 3000, { type: 'error' });
      console.error('Minification error:', error);
    }
  }

  // Copy to clipboard
  function copyToClipboard() {
    output.select();
    document.execCommand('copy');
    
    // Visual feedback
    NotificationManager.show('Copied to clipboard!', 1500, { type: 'success' });
  }

  // Event listeners
  minifyBtn.addEventListener('click', minifyCode);
  copyBtn.addEventListener('click', copyToClipboard);
  
  // Auto-minify when options change
  removeCommentsCheckbox.addEventListener('change', minifyCode);
  removeWhitespaceCheckbox.addEventListener('change', minifyCode);
  shortenVariablesCheckbox.addEventListener('change', minifyCode);
  manglePropertiesCheckbox.addEventListener('change', minifyCode);
  
  // Add event listener for Load Sample button
  const loadSampleBtn = document.getElementById('js-minifier-load-sample-btn');
  loadSampleBtn.addEventListener('click', () => {
    input.value = SAMPLE_CODE;
    minifyCode();
    NotificationManager.show('Sample code loaded and minified', 1500, { type: 'success' });
    clearButtonInstance.updateVisibility();
  });
  
  // Update stats when input is cleared by ClearButton
  input.addEventListener('input', () => {
    if (input.value === '') {
      output.value = '';
      updateStats('', '');
    }
  });
});
