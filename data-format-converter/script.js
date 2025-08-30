import { DataFormatConverter } from './DataFormatConverter.js';
import { NotificationManager } from '../common/notification-manager.js';
import DownloadManager from '../common/DownloadManager.js';
import ClearButton from '../common/clear-button/ClearButton.js';
import CopyButton from '../common/copy-button/CopyButton.js';

class DataFormatConverterUI {
    constructor() {
        this.converter = new DataFormatConverter();
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
            // No need to clear messages as NotificationManager handles auto-hiding
        });
    }

    handleFormatSelection(event) {
        const button = event.target;
        const format = button.getAttribute('data-format');
        const section = button.closest('.input-section, .output-section');

        // Remove active class from siblings
        section.querySelectorAll('.format-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Add active class to clicked button
        button.classList.add('active');

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
                this.convertData();
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

    convertData() {
        const inputText = document.getElementById('inputText').value.trim();
        
        if (!inputText) {
            this.showError('Please enter some data to convert.');
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
            this.showSuccess(`Successfully converted from ${this.converter.inputFormat.toUpperCase()} to ${this.converter.outputFormat.toUpperCase()}`);
            
        } catch (error) {
            this.showError(`Conversion failed: ${error.message}`);
        }
    }


    showError(message) {
        NotificationManager.show(message, 3000, { type: 'error' });
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
