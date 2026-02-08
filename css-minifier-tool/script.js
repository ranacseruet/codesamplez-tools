import { removeCommentsFromCss, removeWhitespaceFromCss, shortenColorsInCss, removeUnnecessaryUnits, removeLastSemicolonsFromCss, combineSelectorsInCss, isValidCSS } from './minifier.js';
import { NotificationManager } from '../common/notification-manager.js';
import { formatBytes } from '../common/format-utils.js';
import ClearButton from '../common/clear-button/ClearButton.js';
import CopyButton from '../common/copy-button/CopyButton.js';
import { scheduleTask } from '../common/scheduler-utils.js';

// Make functions available globally for webpack bundling
window.removeCommentsFromCss = removeCommentsFromCss;
window.removeWhitespaceFromCss = removeWhitespaceFromCss;
window.shortenColorsInCss = shortenColorsInCss;
window.removeUnnecessaryUnits = removeUnnecessaryUnits;
window.removeLastSemicolonsFromCss = removeLastSemicolonsFromCss;
window.combineSelectorsInCss = combineSelectorsInCss;
window.isValidCSS = isValidCSS; // Expose for testing

document.addEventListener('DOMContentLoaded', function () {
    // Elements
    const inputCss = document.getElementById('input-css');
    const outputCss = document.getElementById('output-css');
    const minifyBtn = document.getElementById('minify-btn');
    const loadSampleBtn = document.getElementById('load-sample');
    const resetOptionsBtn = document.getElementById('reset-options');

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
    minifyBtn.addEventListener('click', () => minifyCss().catch(error => {
        NotificationManager.show('Error: ' + error.message, 3000, { type: 'error' });
    }));
    loadSampleBtn.addEventListener('click', loadSample);
    resetOptionsBtn.addEventListener('click', resetOptions);

    // Initialize ClearButton component
    const clearButtonInstance = new ClearButton(inputCss);

    // Initialize CopyButton component
    const copyButtonInstance = new CopyButton(outputCss);
    inputCss.addEventListener('textCleared', (e) =>
        copyButtonInstance.updateVisibility()); {
    }
    outputCss.addEventListener('contentCopied', (e) => {
        NotificationManager.show('Copied to clipboard!', 2000, { type: 'success' });
    });

    // Add event listener to clear output when input is cleared
    inputCss.addEventListener('input', () => {
        if (inputCss.value === '') {
            outputCss.value = '';
            updateStats('', '');
        }
    });

    // Initialize the page
    resetOptions();

    // CSS Minifier Functions
    async function minifyCss() {
        const originalCss = inputCss.value.trim();

        if (!originalCss) {
            outputCss.value = '';
            updateStats('', '');
            NotificationManager.show('Error: Please enter CSS to minify', 3000, { type: 'error' });
            return;
        }

        // UI Feedback: Show loading state
        minifyBtn.textContent = 'Minifying...';
        minifyBtn.disabled = true;
        outputCss.classList.add('processing');

        try {
            // Yield to main thread
            await scheduleTask(20);

            const isValid = await isValidCSS(originalCss);
            if (!isValid) {
                outputCss.value = '';
                updateStats(originalCss, '');
                NotificationManager.show('Error: Invalid CSS input. Please check your CSS syntax.', 3000, { type: 'error' });
                return;
            }

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

            // Show success message with size reduction
            const savings = ((originalCss.length - result.length) / originalCss.length * 100).toFixed(1);
            NotificationManager.show(`CSS minified successfully! Reduced by ${savings}%`, 2000, { type: 'success' });
        } catch (error) {
            outputCss.value = '';
            updateStats(originalCss, '');
            NotificationManager.show('Error: Failed to process CSS. ' + error.message, 3000, { type: 'error' });
        } finally {
            // Restore UI state
            minifyBtn.textContent = 'Minify CSS';
            minifyBtn.disabled = false;
            outputCss.classList.remove('processing');
        }
    }

    // UI Helper Functions
    async function loadSample() {
        inputCss.value = sampleCss;
        clearButtonInstance.updateVisibility();
        await minifyCss();
        copyButtonInstance.updateVisibility();
        NotificationManager.show('Sample CSS loaded and minified', 2000, { type: 'success' });
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


});
