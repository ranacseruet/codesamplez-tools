import { load as loadYAML, dump as dumpYAML, YAML11_SCHEMA } from 'js-yaml';
import { XMLParser, XMLBuilder, XMLValidator } from 'fast-xml-parser';

type SupportedFormat = 'json' | 'xml' | 'yaml' | 'properties';

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}

export class DataFormatConverter {
    inputFormat: SupportedFormat;
    outputFormat: SupportedFormat;

    constructor() {
        this.inputFormat = 'json';
        this.outputFormat = 'xml';
    }

    parseInput(input: string, format: string): unknown {
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

    validateOutput(output: string, format: string): boolean {
        try {
            this.parseInput(output, format);
            return true;
        } catch (_e) {
            return false;
        }
    }

    formatOutput(data: unknown, format: string): string {
        let output: string;
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

    parseXML(xmlString: string): unknown {
        if (typeof DOMParser === 'function') {
            const doc = new DOMParser().parseFromString(xmlString, 'application/xml');
            const parserError = doc.getElementsByTagName('parsererror')[0];

            if (parserError) {
                const message = (parserError.textContent || '').trim();
                throw new Error(message || 'Invalid XML format');
            }

            const root = doc.documentElement;
            if (!root) {
                throw new Error('Invalid XML format');
            }

            return this.xmlElementToObject(root);
        }

        // Fallback for non-DOM environments.
        const validation = XMLValidator.validate(xmlString) as true | { err?: { msg?: string } };
        if (validation !== true) {
            const msg = validation.err ? validation.err.msg : 'Invalid XML format';
            throw new Error(msg);
        }

        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
            isArray: () => false,
            numberParseOptions: {
                skipLike: /^[0-9]+$/
            } as any
        });

        try {
            const result = parser.parse(xmlString) as Record<string, unknown>;
            const rootKey = Object.keys(result)[0];
            return result[rootKey];
        } catch (_e) {
            throw new Error('Invalid XML format');
        }
    }

    parseProperties(content: string): Record<string, string> {
        const result: Record<string, string> = {};
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

    formatProperties(obj: unknown): string {
        if (obj === null || obj === undefined || typeof obj !== 'object') {
            throw new Error('Cannot format to properties');
        }
        return Object.entries(obj)
            .map(([key, value]) => `${this.escapeProp(key)}=${this.escapeProp(value)}`)
            .join('\n');
    }

    escapeProp(str: unknown): string {
        return String(str)
            .replace(/\\/g, '\\\\')
            .replace(/\r/g, '\\r')
            .replace(/\n/g, '\\n')
            .replace(/\t/g, '\\t')
            .replace(/\f/g, '\\f')
            .replace(/:/g, '\\:')
            .replace(/=/g, '\\=');
    }

    unescapeProp(str: string): string {
        let result = '';
        for (let index = 0; index < str.length; index += 1) {
            if (str[index] !== '\\' || index === str.length - 1) {
                result += str[index];
                continue;
            }

            const escaped = str[index + 1];
            switch (escaped) {
                case 'n':
                    result += '\n';
                    index += 1;
                    break;
                case 'r':
                    result += '\r';
                    index += 1;
                    break;
                case 't':
                    result += '\t';
                    index += 1;
                    break;
                case 'f':
                    result += '\f';
                    index += 1;
                    break;
                case ':':
                    result += ':';
                    index += 1;
                    break;
                case '=':
                    result += '=';
                    index += 1;
                    break;
                case '\\':
                    result += '\\';
                    index += 1;
                    break;
                case 'u': {
                    const unicode = str.slice(index + 2, index + 6);
                    if (!/^[0-9a-fA-F]{4}$/.test(unicode)) {
                        throw new Error('Invalid Unicode escape in properties');
                    }
                    result += String.fromCharCode(parseInt(unicode, 16));
                    index += 5;
                    break;
                }
                default:
                    result += escaped;
                    index += 1;
                    break;
            }
        }
        return result;
    }

    xmlToObject(xmlNode: Node): unknown {
        // Convert DOM node to XML string first
        const xmlString = new XMLSerializer().serializeToString(xmlNode);
        return this.parseXML(xmlString);
    }

    xmlElementToObject(element: Element): unknown {
        const result: Record<string, unknown> = {};
        const childElements = Array.from(element.children);
        const textContent = Array.from(element.childNodes)
            .filter((node) => node.nodeType === Node.TEXT_NODE || node.nodeType === Node.CDATA_SECTION_NODE)
            .map((node) => node.textContent || '')
            .join('')
            .trim();

        Array.from(element.attributes).forEach((attribute) => {
            result[`@_${attribute.name}`] = attribute.value;
        });

        childElements.forEach((child) => {
            const childValue = this.xmlElementToObject(child);
            const existingValue = result[child.tagName];

            if (existingValue === undefined) {
                result[child.tagName] = childValue;
                return;
            }

            if (Array.isArray(existingValue)) {
                existingValue.push(childValue);
                return;
            }

            result[child.tagName] = [existingValue, childValue];
        });

        if (!childElements.length && !Object.keys(result).length) {
            return textContent;
        }

        if (textContent) {
            result['#text'] = textContent;
        }

        return result;
    }

    formatXML(obj: unknown, rootName = 'root'): string {
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
        } catch (_e) {
            throw new Error('Cannot format to XML');
        }
    }

    parseYAML(yamlString: string): unknown {
        try {
            // Handle empty YAML - return empty object to match test expectations
            if (!yamlString.trim()) {
                return {};
            }
            
            const result = loadYAML(yamlString, { schema: YAML11_SCHEMA });
            // Convert undefined to empty object to match test expectations
            return result === undefined ? {} : result;
        } catch (e) {
            throw new Error(`Invalid YAML format: ${getErrorMessage(e)}`);
        }
    }

    formatYAML(obj: unknown): string {
        try {
            if (obj === null || obj === undefined) {
                throw new Error('Cannot format null or undefined to YAML');
            }
            return dumpYAML(obj, { indent: 2, schema: YAML11_SCHEMA });
        } catch (e) {
            throw new Error(`Cannot format to YAML: ${getErrorMessage(e)}`);
        }
    }

    detectFormat(input: string): SupportedFormat | null {
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
