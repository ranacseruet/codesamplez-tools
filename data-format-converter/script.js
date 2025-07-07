// Data Format Converter Class
class DataFormatConverter {
    constructor() {
        this.inputFormat = 'json';
        this.outputFormat = 'xml';
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
            this.clearMessages();
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
            this.inputFormat = format;
            this.updateInputPlaceholder();
        } else {
            this.outputFormat = format;
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
        inputText.placeholder = placeholders[this.inputFormat];
    }

    convertData() {
        const inputText = document.getElementById('inputText').value.trim();
        
        if (!inputText) {
            this.showError('Please enter some data to convert.');
            return;
        }

        try {
            // Parse input to internal format
            const internalData = this.parseInput(inputText, this.inputFormat);
            
            // Convert to output format
            const outputData = this.formatOutput(internalData, this.outputFormat);
            
            // Display result
            document.getElementById('outputText').value = outputData;
            this.showSuccess(`Successfully converted from ${this.inputFormat.toUpperCase()} to ${this.outputFormat.toUpperCase()}`);
            
        } catch (error) {
            this.showError(`Conversion failed: ${error.message}`);
        }
    }

    parseInput(input, format) {
        switch (format) {
            case 'json':
                return JSON.parse(input);
            
            case 'xml':
                return this.parseXML(input);
            
            case 'yaml':
                return this.parseYAML(input);
            
            default:
                throw new Error(`Unsupported input format: ${format}`);
        }
    }

    formatOutput(data, format) {
        switch (format) {
            case 'json':
                return JSON.stringify(data, null, 2);
            
            case 'xml':
                return this.formatXML(data);
            
            case 'yaml':
                return this.formatYAML(data);
            
            default:
                throw new Error(`Unsupported output format: ${format}`);
        }
    }

    parseXML(xmlString) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlString, 'text/xml');
        
        // Check for parsing errors
        const parserError = doc.querySelector('parsererror');
        if (parserError) {
            throw new Error('Invalid XML format');
        }
        
        return this.xmlToObject(doc.documentElement);
    }

    xmlToObject(xmlNode) {
        const obj = {};
        
        // Handle attributes
        if (xmlNode.attributes && xmlNode.attributes.length > 0) {
            obj['@attributes'] = {};
            for (let attr of xmlNode.attributes) {
                obj['@attributes'][attr.name] = attr.value;
            }
        }
        
        // Handle child nodes
        if (xmlNode.childNodes && xmlNode.childNodes.length > 0) {
            for (let child of xmlNode.childNodes) {
                if (child.nodeType === Node.TEXT_NODE) {
                    const text = child.textContent.trim();
                    if (text) {
                        if (Object.keys(obj).length === 0) {
                            return text;
                        }
                        obj['#text'] = text;
                    }
                } else if (child.nodeType === Node.ELEMENT_NODE) {
                    const childObj = this.xmlToObject(child);
                    if (obj[child.nodeName]) {
                        if (!Array.isArray(obj[child.nodeName])) {
                            obj[child.nodeName] = [obj[child.nodeName]];
                        }
                        obj[child.nodeName].push(childObj);
                    } else {
                        obj[child.nodeName] = childObj;
                    }
                }
            }
        }
        
        return Object.keys(obj).length === 0 ? xmlNode.textContent : obj;
    }

    formatXML(obj, rootName = 'root', indent = 0) {
        const spaces = '  '.repeat(indent);
        let xml = '';
        
        if (indent === 0) {
            xml += '<?xml version="1.0" encoding="UTF-8"?>\n';
        }
        
        if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
            return `${spaces}<${rootName}>${obj}</${rootName}>\n`;
        }
        
        if (Array.isArray(obj)) {
            obj.forEach(item => {
                xml += this.formatXML(item, rootName, indent);
            });
            return xml;
        }
        
        if (typeof obj === 'object' && obj !== null) {
            xml += `${spaces}<${rootName}>\n`;
            
            for (let key in obj) {
                if (key === '@attributes') continue;
                xml += this.formatXML(obj[key], key, indent + 1);
            }
            
            xml += `${spaces}</${rootName}>\n`;
        }
        
        return xml;
    }

    parseYAML(yamlString) {
        // Simple YAML parser - handles basic structures
        const lines = yamlString.split('\n');
        const obj = {};
        let currentObj = obj;
        const stack = [obj];
        let currentIndent = 0;
        
        for (let line of lines) {
            line = line.replace(/\t/g, '  '); // Convert tabs to spaces
            const trimmedLine = line.trim();
            
            if (!trimmedLine || trimmedLine.startsWith('#')) continue;
            
            const indent = line.length - line.trimStart().length;
            
            // Handle indentation changes
            if (indent < currentIndent) {
                const levels = Math.floor((currentIndent - indent) / 2);
                for (let i = 0; i < levels; i++) {
                    stack.pop();
                }
                currentObj = stack[stack.length - 1];
            }
            currentIndent = indent;
            
            if (trimmedLine.includes(':')) {
                const colonIndex = trimmedLine.indexOf(':');
                const key = trimmedLine.substring(0, colonIndex).trim();
                const value = trimmedLine.substring(colonIndex + 1).trim();
                
                if (value === '') {
                    // Object
                    currentObj[key] = {};
                    stack.push(currentObj[key]);
                    currentObj = currentObj[key];
                } else {
                    // Value
                    currentObj[key] = this.parseYAMLValue(value);
                }
            } else if (trimmedLine.startsWith('- ')) {
                // Array item
                const value = trimmedLine.substring(2).trim();
                const lastKey = Object.keys(currentObj).pop();
                if (!Array.isArray(currentObj[lastKey])) {
                    currentObj[lastKey] = [];
                }
                currentObj[lastKey].push(this.parseYAMLValue(value));
            }
        }
        
        return obj;
    }

    parseYAMLValue(value) {
        if (value === 'true') return true;
        if (value === 'false') return false;
        if (value === 'null') return null;
        if (!isNaN(value) && !isNaN(parseFloat(value))) return parseFloat(value);
        if (value.startsWith('"') && value.endsWith('"')) return value.slice(1, -1);
        if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1);
        return value;
    }

    formatYAML(obj, indent = 0) {
        const spaces = '  '.repeat(indent);
        let yaml = '';
        
        if (Array.isArray(obj)) {
            obj.forEach(item => {
                if (typeof item === 'object' && item !== null) {
                    yaml += `${spaces}-\n`;
                    yaml += this.formatYAML(item, indent + 1);
                } else {
                    yaml += `${spaces}- ${item}\n`;
                }
            });
        } else if (typeof obj === 'object' && obj !== null) {
            for (let key in obj) {
                if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
                    yaml += `${spaces}${key}:\n`;
                    yaml += this.formatYAML(obj[key], indent + 1);
                } else if (Array.isArray(obj[key])) {
                    yaml += `${spaces}${key}:\n`;
                    yaml += this.formatYAML(obj[key], indent + 1);
                } else {
                    yaml += `${spaces}${key}: ${obj[key]}\n`;
                }
            }
        } else {
            yaml += `${spaces}${obj}\n`;
        }
        
        return yaml;
    }

    showError(message) {
        const errorDiv = document.getElementById('inputError');
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        
        const successDiv = document.getElementById('outputSuccess');
        successDiv.style.display = 'none';
    }

    showSuccess(message) {
        const successDiv = document.getElementById('outputSuccess');
        successDiv.textContent = message;
        successDiv.style.display = 'block';
        
        const errorDiv = document.getElementById('inputError');
        errorDiv.style.display = 'none';
    }

    clearMessages() {
        document.getElementById('inputError').style.display = 'none';
        document.getElementById('outputSuccess').style.display = 'none';
    }
}

// Initialize the converter when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new DataFormatConverter();
});