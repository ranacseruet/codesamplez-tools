import { DataFormatConverter } from './DataFormatConverter.js';
import { NotificationManager } from '../common/notification-manager.js';
import DownloadManager from '../common/DownloadManager.js';
import ClearButton from '../common/clear-button/ClearButton.js';
import CopyButton from '../common/copy-button/CopyButton.js';

class DataFormatConverterUI {
    constructor() {
        this.converter = new DataFormatConverter();
        this.debounceTimer = null;
        this.setupEventListeners();
        this.initializeCommonButtons();
    }

    initializeCommonButtons() {
        const inputTextArea = document.getElementById('inputText');
        const outputTextArea = document.getElementById('outputText');
        
        this.clearButton = new ClearButton(inputTextArea);
        this.copyButton = new CopyButton(outputTextArea);
        
        // Update the input textarea's clear event to also clear any error messages
        inputTextArea.addEventListener('textCleared', () => {
            NotificationManager.show("Input cleared", 3000, { type: 'success' });
        });

        // Listen for copy events
        outputTextArea.addEventListener('contentCopied', (event) => {
            NotificationManager.show("Copied to clipboard!", 3000, { type: 'success' });
        });
    }

    setupEventListeners() {
        // Format selector buttons
        document.querySelectorAll('.format-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.handleFormatSelection(e);
            });
        });

        // Convert button
        document.getElementById('convertBtn').addEventListener('click', () => {
            this.convertData();
        });

        // Download button
        document.getElementById('downloadBtn').addEventListener('click', () => {
            this.downloadOutput();
        });

        // Real-time conversion on input
        document.getElementById('inputText').addEventListener('input', () => {
            this.handleAutoConvert();
        });

        // Auto-convert checkbox
        document.getElementById('autoConvert').addEventListener('change', () => {
            if (document.getElementById('autoConvert').checked) {
                this.convertData(true);
            }
        });

        // Swap button
        document.getElementById('swapBtn').addEventListener('click', () => {
            this.swapContent();
        });
    }

    handleAutoConvert() {
        if (!document.getElementById('autoConvert').checked) return;

        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            const inputText = document.getElementById('inputText').value.trim();
            if (inputText) {
                const detectedFormat = this.converter.detectFormat(inputText);
                if (detectedFormat && detectedFormat !== this.converter.inputFormat) {
                    this.converter.inputFormat = detectedFormat;
                    this.updateFormatButtons('input-section', detectedFormat);
                    // Don't update placeholder or clear text as user is typing
                }

                // Suppress success notification for auto-convert to avoid spam
                this.convertData(true);
            }
        }, 500); // 500ms debounce
    }

    handleFormatSelection(event) {
        const button = event.target;
        const format = button.getAttribute('data-format');
        const section = button.closest('.input-section, .output-section');

        // Remove active class from siblings
        section.querySelectorAll('.format-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.setAttribute('aria-pressed', 'false');
        });

        // Add active class to clicked button
        button.classList.add('active');
        button.setAttribute('aria-pressed', 'true');

        // Update format selection
        if (section.classList.contains('input-section')) {
            this.converter.inputFormat = format;
            this.updateInputPlaceholder();
            this.clearButton.clearText(); // Only clear input when INPUT format changes
        } else {
            this.converter.outputFormat = format;
            // If there's input data, trigger conversion when output format changes
            const inputText = document.getElementById('inputText').value.trim();
            if (inputText) {
                this.convertData(document.getElementById('autoConvert').checked);
            }
        }
    }

    updateInputPlaceholder() {
        const inputText = document.getElementById('inputText');
        const placeholders = {
            json: 'Paste your JSON data here...\n\nExample:\n{\n  "name": "John",\n  "age": 30,\n  "city": "New York"\n}',
            xml: 'Paste your XML data here...\n\nExample:\n<person>\n  <name>John</name>\n  <age>30</age>\n  <city>New York</city>\n</person>',
            yaml: 'Paste your YAML data here...\n\nExample:\nname: John\nage: 30\ncity: New York',
            properties: 'Paste your Properties data here...\n\nExample:\nname=John\nage=30\ncity=New York'
        };
        inputText.placeholder = placeholders[this.converter.inputFormat];
    }

    convertData(silent = false) {
        const inputText = document.getElementById('inputText').value.trim();
        
        if (!inputText) {
            // Only show error if clicked manually. Auto-convert shouldn't nag if empty.
            if (!silent) {
                 this.showError('Please enter some data to convert.');
            }
            return;
        }

        try {
            // Parse input to internal format
            const internalData = this.converter.parseInput(inputText, this.converter.inputFormat);
            
            // Convert to output format
            const outputData = this.converter.formatOutput(internalData, this.converter.outputFormat);
            
            // Display result
            document.getElementById('outputText').value = outputData;
            this.copyButton.updateVisibility();

            if (!silent) {
                this.showSuccess(`Successfully converted from ${this.converter.inputFormat.toUpperCase()} to ${this.converter.outputFormat.toUpperCase()}`);
            } else {
                document.getElementById('inputError').style.display = 'none';
            }
            
        } catch (error) {
            this.showError(`Conversion failed: ${error.message}`, silent);
        }
    }

    swapContent() {
         const oldInputFormat = this.converter.inputFormat;
         const oldOutputFormat = this.converter.outputFormat;

         // Swap internal formats
         this.converter.inputFormat = oldOutputFormat;
         this.converter.outputFormat = oldInputFormat;

         // Update UI buttons
         this.updateFormatButtons('input-section', oldOutputFormat);
         this.updateFormatButtons('output-section', oldInputFormat);

         // Swap textarea content
         const inputText = document.getElementById('inputText');
         const outputText = document.getElementById('outputText');

         const newInputValue = outputText.value;
         // We don't necessarily swap output to input if output was generated.
         // But "Swap" usually means "I want to take what I generated and use it as input for next step".
         // The old input becomes... well, discarded or put in output?
         // Usually swapping just moves Output -> Input. What happens to Input?
         // It can move to Output, but if formats are swapped, the old Input (in old InputFormat) might not match new OutputFormat (old InputFormat).
         // Actually, Old Input (Format A) -> Old Output (Format B).
         // New Input (Format B) -> New Output (Format A).
         // So if we move Old Input to New Output, it matches the format!
         // So yes, full swap is safe format-wise.

         const temp = inputText.value;
         inputText.value = newInputValue;
         outputText.value = temp;

         this.updateInputPlaceholder();

         // Trigger conversion
         if (inputText.value.trim()) {
             this.convertData(true);
         }
    }

    updateFormatButtons(sectionClass, format) {
        const section = document.querySelector('.' + sectionClass);
        section.querySelectorAll('.format-btn').forEach(btn => {
            if (btn.getAttribute('data-format') === format) {
                btn.classList.add('active');
                btn.setAttribute('aria-pressed', 'true');
            } else {
                btn.classList.remove('active');
                btn.setAttribute('aria-pressed', 'false');
            }
        });
    }

    showError(message, silent = false) {
        if (!silent) {
            NotificationManager.show(message, 3000, { type: 'error' });
        }
        const errorDiv = document.getElementById('inputError');
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }

    showSuccess(message) {
        NotificationManager.show(message, 3000, { type: 'success' });
        document.getElementById('inputError').style.display = 'none';
    }

    downloadOutput() {
        const outputText = document.getElementById('outputText').value;
        if (!outputText) {
            this.showError('No data to download');
            return;
        }

        const format = this.converter.outputFormat;
        const mimeTypes = {
            json: 'application/json',
            xml: 'application/xml',
            yaml: 'text/yaml',
            properties: 'text/plain'
        };
        const extensions = {
            json: 'json',
            xml: 'xml',
            yaml: 'yaml',
            properties: 'properties'
        };

        const downloadManager = new DownloadManager();
        downloadManager.downloadFile(
            outputText,
            `data.${extensions[format]}`,
            mimeTypes[format]
        );
        this.showSuccess('Download started!');
    }
}

// Initialize the converter when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new DataFormatConverterUI();
});
