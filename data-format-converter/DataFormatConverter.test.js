import { DataFormatConverter } from './DataFormatConverter.js';

describe('DataFormatConverter', () => {
    let converter;

    beforeEach(() => {
        converter = new DataFormatConverter();
    });

    it('should initialize with default formats', () => {
        expect(converter.inputFormat).toBe('json');
        expect(converter.outputFormat).toBe('xml');
    });

    describe('parseInput', () => {
        it('should parse valid JSON input', () => {
            const json = '{"name":"test","value":123}';
            const result = converter.parseInput(json, 'json');
            expect(result).toEqual({ name: 'test', value: 123 });
        });

        it('should throw error for invalid JSON input', () => {
            const invalidJson = '{"name":"test",}';
            expect(() => converter.parseInput(invalidJson, 'json')).toThrow(SyntaxError);
        });

        it('should parse valid XML input', () => {
            const xml = `<root>
                <name>test</name>
                <value>123</value>
            </root>`;
            const result = converter.parseInput(xml, 'xml');
            expect(result).toEqual({
                name: 'test',
                value: '123'
            });
        });

        it('should throw error for invalid XML input', () => {
            const invalidXml = '<root><name>test</root>';
            expect(() => converter.parseInput(invalidXml, 'xml')).toThrow('Invalid XML format');
        });

        it('should parse valid YAML input', () => {
            const yaml = `name: test\nvalue: 123`;
            const result = converter.parseInput(yaml, 'yaml');
            expect(result).toEqual({ name: 'test', value: 123 });
        });

        it('should throw error for unsupported format', () => {
            expect(() => converter.parseInput('data', 'csv')).toThrow('Unsupported input format: csv');
        });
    });

    describe('validateOutput', () => {
        it('should validate correct JSON', () => {
            const validJson = '{"name":"test"}';
            expect(converter.validateOutput(validJson, 'json')).toBe(true);
        });

        it('should invalidate malformed JSON', () => {
            const invalidJson = '{"name":"test",}';
            expect(converter.validateOutput(invalidJson, 'json')).toBe(false);
        });

        it('should validate correct XML', () => {
            const validXml = '<root><name>test</name></root>';
            expect(converter.validateOutput(validXml, 'xml')).toBe(true);
        });

        it('should validate XML via parseXML() method', () => {
            const invalidXml = '<root><name>test</root>';
            expect(converter.validateOutput(invalidXml, 'xml')).toBe(false);
        });

        it('should validate correct YAML', () => {
            const validYaml = 'name: test\nvalue: 123';
            expect(converter.validateOutput(validYaml, 'yaml')).toBe(true);
        });

        it('should invalidate malformed YAML', () => {
            const invalidYaml = 'name: test\n  value: 123';
            expect(converter.validateOutput(invalidYaml, 'yaml')).toBe(false);
        });
    });

    describe('formatOutput', () => {
        const testData = { name: 'test', value: 123 };

        it('should format to JSON', () => {
            const result = converter.formatOutput(testData, 'json');
            expect(result).toBe('{\n  "name": "test",\n  "value": 123\n}');
        });

        it('should format to XML', () => {
            const result = converter.formatOutput(testData, 'xml');
            expect(result).toContain('<name>test</name>');
            expect(result).toContain('<value>123</value>');
        });

        it('should format to YAML', () => {
            const result = converter.formatOutput(testData, 'yaml');
            expect(result).toContain('name: test');
            expect(result).toContain('value: 123');
        });

        it('should throw error for unsupported format', () => {
            expect(() => converter.formatOutput(testData, 'csv')).toThrow('Unsupported output format: csv');
        });

        it('should throw error for circular JSON structure', () => {
            const badData = { circular: {} };
            badData.circular.self = badData;
            expect(() => converter.formatOutput(badData, 'json')).toThrow('Converting circular structure to JSON');
        });

        it('should handle YAML with newlines in keys', () => {
            const data = { 'key\nwith\nnewlines': 'value' };
            const result = converter.formatOutput(data, 'yaml');
            // Verify the YAML is valid and contains the key-value pair
            const parsed = converter.parseInput(result, 'yaml');
            expect(parsed).toEqual(data);
        });
    });

    describe('xmlToObject', () => {
        it('should convert XML with attributes', () => {
            const xml = `<root id="1">
                <name type="string">test</name>
            </root>`;
            const doc = new DOMParser().parseFromString(xml, 'text/xml');
            const result = converter.xmlToObject(doc.documentElement);
            expect(result).toEqual({
                '@_id': '1',
                name: {
                    '@_type': 'string',
                    '#text': 'test'
                }
            });
        });

        it('should handle arrays in XML', () => {
            const xml = `<root>
                <item>1</item>
                <item>2</item>
            </root>`;
            const doc = new DOMParser().parseFromString(xml, 'text/xml');
            const result = converter.xmlToObject(doc.documentElement);
            expect(Array.isArray(result.item)).toBe(true);
            expect(result.item).toEqual(['1', '2']);
        });

        it('should handle empty XML nodes', () => {
            const xml = `<root></root>`;
            const doc = new DOMParser().parseFromString(xml, 'text/xml');
            const result = converter.xmlToObject(doc.documentElement);
            expect(result).toBe('');
        });

        it('should handle XML with comments', () => {
            const xml = `<root><!-- comment --><item>test</item></root>`;
            const doc = new DOMParser().parseFromString(xml, 'text/xml');
            const result = converter.xmlToObject(doc.documentElement);
            expect(result).toEqual({ item: 'test' });
        });

        it('should handle mixed content nodes', () => {
            const xml = `<root>text<item>1</item>more text</root>`;
            const doc = new DOMParser().parseFromString(xml, 'text/xml');
            const result = converter.xmlToObject(doc.documentElement);
            expect(result).toEqual({
                '#text': 'textmore text',
                item: '1'
            });
        });
    });

    describe('parseYAML', () => {
        it('should parse nested YAML', () => {
            const yaml = `parent:
  child:
    name: test
    value: 123`;
            const result = converter.parseInput(yaml, 'yaml');
            expect(result).toEqual({
                parent: {
                    child: {
                        name: 'test',
                        value: 123
                    }
                }
            });
        });

        it('should parse YAML arrays', () => {
            const yaml = `items:
  - 1
  - 2
  - 3`;
            const result = converter.parseInput(yaml, 'yaml');
            expect(result).toEqual({
                items: [1, 2, 3]
            });
        });

        it('should parse empty YAML', () => {
            const yaml = ``;
            const result = converter.parseInput(yaml, 'yaml');
            expect(result).toEqual({});
        });

        it('should parse YAML with quoted strings', () => {
            const yaml = `name: "test string"
value: '123'`;
            const result = converter.parseInput(yaml, 'yaml');
            expect(result).toEqual({
                name: 'test string',
                value: '123'
            });
        });

        it('should parse YAML with special characters', () => {
            const yaml = `special: "line\\nbreak"
path: "C:\\\\path\\\\to\\\\file"`;
            const result = converter.parseInput(yaml, 'yaml');
            expect(result).toEqual({
                special: 'line\nbreak',
                path: 'C:\\path\\to\\file'
            });
        });

        it('should parse YAML boolean and null values', () => {
            const yaml = `enabled: true
disabled: false
empty: null`;
            const result = converter.parseInput(yaml, 'yaml');
            expect(result).toEqual({
                enabled: true,
                disabled: false,
                empty: null
            });
        });

        it('should throw error for invalid YAML', () => {
            const yaml = `invalid:
  - item1
    - item2`;
            expect(() => converter.parseInput(yaml, 'yaml')).toThrow();
        });
    });

    describe('formatYAML', () => {
        it('should format nested objects to YAML', () => {
            const data = {
                parent: {
                    child: {
                        name: 'test',
                        value: 123
                    }
                }
            };
            const result = converter.formatOutput(data, 'yaml');
            expect(result).toContain('parent:');
            expect(result).toContain('  child:');
            expect(result).toContain('    name: test');
            expect(result).toContain('    value: 123');
        });

        it('should format arrays to YAML', () => {
            const data = {
                items: [1, 2, 3]
            };
            const result = converter.formatOutput(data, 'yaml');
            expect(result).toContain('items:');
            expect(result).toContain('- 1');
            expect(result).toContain('- 2');
            expect(result).toContain('- 3');
        });

        it('should throw error for null input', () => {
            expect(() => converter.formatOutput(null, 'yaml')).toThrow();
        });

        it('should throw error for undefined input', () => {
            expect(() => converter.formatOutput(undefined, 'yaml')).toThrow();
        });
    });

    describe('formatXML', () => {
        it('should throw error for null input', () => {
            expect(() => converter.formatOutput(null, 'xml')).toThrow();
        });

        it('should throw error for undefined input', () => {
            expect(() => converter.formatOutput(undefined, 'xml')).toThrow();
        });

        it('should throw error for circular references', () => {
            const obj = {};
            obj.self = obj;
            expect(() => converter.formatOutput(obj, 'xml')).toThrow();
        });
    });
});
