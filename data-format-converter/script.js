import { DataFormatConverter } from './DataFormatConverter.js';
import { NotificationManager } from '../common/notification-manager.js';

class DataFormatConverterUI {
    constructor() {
        this.converter = new DataFormatConverter();
        this.setupEventListeners();
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
        } else {
            this.converter.outputFormat = format;
        }
        
        this.clearMessages();
    }

    updateInputPlaceholder() {
        const inputText = document.getElementById('inputText');
        const placeholders = {
            json: 'Paste your JSON data here...\n\nExample:\n{\n  "name": "John",\n  "age": 30,\n  "city": "New York"\n}',
            xml: 'Paste your XML data here...\n\nExample:\n<person>\n  <name>John</name>\n  <age>30</age>\n  <city>New York</city>\n</person>',
            yaml: 'Paste your YAML data here...\n\nExample:\nname: John\nage: 30\ncity: New York'
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
}

// Initialize the converter when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new DataFormatConverterUI();
});
