document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const inputCss = document.getElementById('input-css');
    const outputCss = document.getElementById('output-css');
    const minifyBtn = document.getElementById('minify-btn');
    const clearInputBtn = document.getElementById('clear-input');
    const loadSampleBtn = document.getElementById('load-sample');
    const copyOutputBtn = document.getElementById('copy-output');
    const resetOptionsBtn = document.getElementById('reset-options');
    const notification = document.getElementById('notification');
    
    // Stats elements
    const originalSizeEl = document.getElementById('original-size');
    const minifiedSizeEl = document.getElementById('minified-size');
    const savingEl = document.getElementById('saving');
    
    // Options
    const removeComments = document.getElementById('remove-comments');
    const removeWhitespace = document.getElementById('remove-whitespace');
    const combineSelectors = document.getElementById('combine-selectors');
    const shortenColors = document.getElementById('shorten-colors');
    const removeUnits = document.getElementById('remove-units');
    const removeLastSemicolons = document.getElementById('remove-last-semicolons');
    
    // Sample CSS
    const sampleCss = `/* Basic styles for a simple page */
body {
font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
font-size: 16px;
line-height: 1.5;
color: #333333;
background-color: #ffffff;
margin: 0px;
padding: 0px;
}

/* Header styling */
.header {
background-color: #4a90e2;
padding: 20px;
color: white;
box-shadow: 0px 2px 4px rgba(0, 0, 0, 0.1);
}

.header h1 {
margin: 0px;
font-size: 28px;
}

/* Container for content */
.container {
max-width: 1200px;
margin: 0 auto;
padding: 20px;
}

/* Button styles */
.button {
display: inline-block;
padding: 10px 20px;
background-color: #4a90e2;
color: #ffffff;
border: none;
border-radius: 4px;
cursor: pointer;
transition: background-color 0.3s ease;
}

.button:hover {
background-color: #3a80d2;
}

/* Duplicate rule to demonstrate combining */
.button {
font-weight: bold;
text-transform: uppercase;
}

/* Empty rule to demonstrate cleaning */
.unused {
}

/* Colors to demonstrate shortening */
.color-examples {
color: #ffffff;
background-color: #000000;
border-color: #ff0000;
box-shadow: 0px 0px 5px #aabbcc;
}

/* Zero values to demonstrate unit removal */
.spacing {
margin: 0px;
padding: 0px;
border-width: 0px;
top: 0px;
}`;

    // Event Listeners
    minifyBtn.addEventListener('click', minifyCss);
    clearInputBtn.addEventListener('click', clearInput);
    loadSampleBtn.addEventListener('click', loadSample);
    copyOutputBtn.addEventListener('click', copyOutput);
    resetOptionsBtn.addEventListener('click', resetOptions);
    
    // Initialize the page
    resetOptions();

    // CSS Minifier Functions
    function minifyCss() {
        const originalCss = inputCss.value;
        let result = originalCss;
        
        // Process the CSS based on selected options
        if (removeComments.checked) {
        result = removeCommentsFromCss(result);
        }
        
        if (combineSelectors.checked) {
        result = combineSelectorsInCss(result);
        }
        
        if (shortenColors.checked) {
        result = shortenColorsInCss(result);
        }
        
        if (removeUnits.checked) {
        result = removeUnnecessaryUnits(result);
        }
        
        if (removeWhitespace.checked) {
        result = removeWhitespaceFromCss(result);
        }
        
        if (removeLastSemicolons.checked) {
        result = removeLastSemicolonsFromCss(result);
        }
        
        // Update the output
        outputCss.value = result;
        
        // Update stats
        updateStats(originalCss, result);
    }
    
    // UI Helper Functions
    function clearInput() {
      inputCss.value = '';
      outputCss.value = '';
      updateStats('', '');
    }
    
    function loadSample() {
      inputCss.value = sampleCss;
      minifyCss();
    }
    
    function copyOutput() {
      if (!outputCss.value) return;
      
      outputCss.select();
      document.execCommand('copy');
      
      // Show notification
      notification.classList.add('show');
      setTimeout(() => {
        notification.classList.remove('show');
      }, 2000);
    }
    
    function resetOptions() {
      removeComments.checked = true;
      removeWhitespace.checked = true;
      combineSelectors.checked = true;
      shortenColors.checked = true;
      removeUnits.checked = true;
      removeLastSemicolons.checked = true;
    }
    
    function updateStats(original, minified) {
      const originalSize = new Blob([original]).size;
      const minifiedSize = new Blob([minified]).size;
      const savings = originalSize ? (1 - minifiedSize / originalSize) * 100 : 0;
      
      originalSizeEl.textContent = formatBytes(originalSize);
      minifiedSizeEl.textContent = formatBytes(minifiedSize);
      savingEl.textContent = `${savings.toFixed(1)}%`;
    }
    
    function formatBytes(bytes) {
      if (bytes === 0) return '0 bytes';
      
      const k = 1024;
      const sizes = ['bytes', 'KB', 'MB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      
      return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
    }
  });