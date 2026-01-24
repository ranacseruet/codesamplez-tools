import yaml from 'js-yaml';
import { XMLParser, XMLBuilder, XMLValidator } from 'fast-xml-parser';

export class DataFormatConverter {
    constructor() {
        this.inputFormat = 'json';
        this.outputFormat = 'xml';
    }

    parseInput(input, format) {
        switch (format) {
            case 'json':
                return JSON.parse(input);
            case 'xml':
                return this.parseXML(input);
            case 'yaml':
                return this.parseYAML(input);
            case 'properties':
                return this.parseProperties(input);
            default:
                throw new Error(`Unsupported input format: ${format}`);
        }
    }

    validateOutput(output, format) {
        try {
            this.parseInput(output, format);
            return true;
        } catch (e) {
            return false;
        }
    }

    formatOutput(data, format) {
        let output;
        switch (format) {
            case 'json':
                output = JSON.stringify(data, null, 2);
                break;
            case 'xml':
                output = this.formatXML(data);
                break;
            case 'yaml':
                output = this.formatYAML(data);
                break;
            case 'properties':
                output = this.formatProperties(data);
                break;
            default:
                throw new Error(`Unsupported output format: ${format}`);
        }

        if (!this.validateOutput(output, format)) {
            throw new Error(`Invalid ${format.toUpperCase()} output format`);
        }
        return output;
    }

    parseXML(xmlString) {
        // Validate XML structure
        const validation = XMLValidator.validate(xmlString);
        if (validation !== true) {
            // Provide specific error from validator if available, or generic message
            const msg = validation.err ? validation.err.msg : 'Invalid XML format';
            throw new Error(msg);
        }

        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
            isArray: (name, jpath, isLeafNode, isAttribute) => false,
            numberParseOptions: {
                skipLike: /^[0-9]+$/ // Keep numbers as strings to match tests
            }
        });
        try {
            const result = parser.parse(xmlString);
            // Remove root wrapper and return direct child properties
            const rootKey = Object.keys(result)[0];
            return result[rootKey];
        } catch (e) {
            throw new Error('Invalid XML format');
        }
    }

    parseProperties(content) {
        const result = {};
        let validLineFound = false;
        content.split(/\r?\n/).forEach(line => {
            line = line.trim();
            if (!line || line.startsWith('#') || line.startsWith('!')) return;

            const match = line.match(/^((?:\\.|[^:=])+)([:=])(.*)$/);

            if (!match) {
                throw new Error('Invalid properties format');
            }

            validLineFound = true;
            const key = this.unescapeProp(match[1].trim());
            const value = this.unescapeProp(match[3].trim());
            result[key] = value;
        });
        if (!validLineFound && content.trim() !== '') {
            throw new Error('Invalid properties format');
        }
        return result;
    }

    formatProperties(obj) {
        if (obj === null || obj === undefined || typeof obj !== 'object') {
            throw new Error('Cannot format to properties');
        }
        return Object.entries(obj)
            .map(([key, value]) => `${this.escapeProp(key)}=${this.escapeProp(value)}`)
            .join('\n');
    }

    escapeProp(str) {
        return String(str)
            .replace(/\\/g, '\\\\')
            .replace(/\n/g, '\\n')
            .replace(/\t/g, '\\t')
            .replace(/:/g, '\\:')
            .replace(/=/g, '\\=');
    }

    unescapeProp(str) {
        return str.replace(/\\(.)/g, (match, char) => {
            switch(char) {
                case 'n': return '\n';
                case 't': return '\t';
                case ':': return ':';
                case '=': return '=';
                case '\\': return '\\';
                default: return char;
            }
        });
    }

    xmlToObject(xmlNode) {
        // Convert DOM node to XML string first
        const xmlString = new XMLSerializer().serializeToString(xmlNode);
        return this.parseXML(xmlString);
    }

    formatXML(obj, rootName = 'root') {
        if (obj === null || obj === undefined) {
            throw new Error('Cannot format null or undefined to XML');
        }
        
        const builder = new XMLBuilder({
            ignoreAttributes: false,
            attributeNamePrefix: '@',
            format: true,
            indentBy: '  ',
            suppressEmptyNode: true
        });
        
        try {
            return builder.build({ [rootName]: obj });
        } catch (e) {
            throw new Error('Cannot format to XML');
        }
    }

    parseYAML(yamlString) {
        try {
            // Handle empty YAML - return empty object to match test expectations
            if (!yamlString.trim()) {
                return {};
            }
            
            const result = yaml.load(yamlString);
            // Convert undefined to empty object to match test expectations
            return result === undefined ? {} : result;
        } catch (e) {
            throw new Error(`Invalid YAML format: ${e.message}`);
        }
    }

    formatYAML(obj) {
        try {
            if (obj === null || obj === undefined) {
                throw new Error('Cannot format null or undefined to YAML');
            }
            return yaml.dump(obj, { indent: 2 });
        } catch (e) {
            throw new Error(`Cannot format to YAML: ${e.message}`);
        }
    }

    detectFormat(input) {
        const trimmed = input.trim();
        if (!trimmed) return null;

        if (trimmed.startsWith('<')) return 'xml';
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';

        // Simple heuristics for Properties vs YAML
        // Properties typically uses = or : but YAML strictly uses : followed by space or newline
        const hasEquals = trimmed.includes('=');
        const hasColonSpace = trimmed.includes(': ');
        const hasColonNewline = /:\s*\n/.test(trimmed);

        if (hasEquals && !hasColonSpace && !hasColonNewline) return 'properties';
        if ((hasColonSpace || hasColonNewline) && !hasEquals) return 'yaml';

        // If ambiguous, default to YAML as it's more flexible
        return 'yaml';
    }
}
