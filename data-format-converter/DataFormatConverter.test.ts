import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { DataFormatConverter } from './DataFormatConverter';

describe('DataFormatConverter', () => {
    let converter: DataFormatConverter;
    const originalDOMParser = global.DOMParser;

    beforeEach(() => {
        converter = new DataFormatConverter();
    });

    afterEach(() => {
        global.DOMParser = originalDOMParser;
        jest.restoreAllMocks();
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

        it('should preserve dotted numeric strings from XML text nodes', () => {
            const xml = `<root><version>2026.04</version></root>`;
            const result = converter.parseInput(xml, 'xml');

            expect(result).toEqual({
                version: '2026.04'
            });
        });

        it('should throw error for invalid XML input', () => {
            const invalidXml = '<root><name>test</root>';
            expect(() => converter.parseInput(invalidXml, 'xml')).toThrow();
        });

        it('should throw when DOMParser returns no document element', () => {
            global.DOMParser = class MockDOMParser {
                parseFromString() {
                    return {
                        getElementsByTagName: () => [],
                        documentElement: null
                    } as unknown as Document;
                }
            } as unknown as typeof DOMParser;

            expect(() => converter.parseInput('<root><name>test</name></root>', 'xml'))
                .toThrow('Invalid XML format');
        });

        it('should fall back to the generic XML message when parsererror has no text', () => {
            global.DOMParser = class MockDOMParser {
                parseFromString() {
                    return {
                        getElementsByTagName: () => [{ textContent: '' }],
                        documentElement: { nodeName: 'parsererror' }
                    } as unknown as Document;
                }
            } as unknown as typeof DOMParser;

            expect(() => converter.parseInput('<root><name>test</name></root>', 'xml'))
                .toThrow('Invalid XML format');
        });

        it('should parse XML through the non-DOM fallback path', () => {
            delete (global as unknown as { DOMParser?: unknown }).DOMParser;
            jest.spyOn(XMLValidator, 'validate').mockReturnValue(true);

            expect(converter.parseInput('<root><name>test</name></root>', 'xml')).toEqual({
                name: 'test'
            });
        });

        it('should surface fallback XML validator errors without DOMParser', () => {
            delete (global as unknown as { DOMParser?: unknown }).DOMParser;
            jest.spyOn(XMLValidator, 'validate').mockReturnValue({
                err: {
                    code: 'ERR',
                    msg: 'Bad fallback XML',
                    line: 1,
                    col: 1
                }
            });

            expect(() => converter.parseInput('<root><name>test</name></root>', 'xml'))
                .toThrow('Bad fallback XML');
        });

        it('should use the generic fallback XML message when validator omits details', () => {
            delete (global as unknown as { DOMParser?: unknown }).DOMParser;
            jest.spyOn(XMLValidator, 'validate').mockReturnValue({} as any);

            expect(() => converter.parseInput('<root><name>test</name></root>', 'xml'))
                .toThrow('Invalid XML format');
        });

        it('should throw generic XML error when fallback parser throws', () => {
            delete (global as unknown as { DOMParser?: unknown }).DOMParser;
            jest.spyOn(XMLValidator, 'validate').mockReturnValue(true);
            jest.spyOn(XMLParser.prototype, 'parse').mockImplementation(() => {
                throw new Error('parse failed');
            });

            expect(() => converter.parseInput('<root><name>test</name></root>', 'xml'))
                .toThrow('Invalid XML format');
        });

        it('should parse valid YAML input', () => {
            const yaml = `name: test\nvalue: 123`;
            const result = converter.parseInput(yaml, 'yaml');
            expect(result).toEqual({ name: 'test', value: 123 });
        });

        it('should resolve merge keys in YAML input', () => {
            const yaml = 'a: &base\n  color: purple\nb:\n  <<: *base\n  size: large';
            const result = converter.parseInput(yaml, 'yaml');
            expect(result).toEqual({ a: { color: 'purple' }, b: { color: 'purple', size: 'large' } });
        });

        it('should throw error for unsupported format', () => {
            expect(() => converter.parseInput('data', 'csv')).toThrow('Unsupported input format: csv');
        });

        it('should stringify non-Error YAML parser failures', () => {
            const yaml = require('js-yaml');
            const loadSpy = jest.spyOn(yaml, 'load').mockImplementation(() => {
                throw 'string-yaml-error';
            });

            expect(() => converter.parseInput('name: test', 'yaml'))
                .toThrow('Invalid YAML format: string-yaml-error');

            loadSpy.mockRestore();
        });

        it('should convert undefined YAML parses into empty objects', () => {
            const yaml = require('js-yaml');
            const loadSpy = jest.spyOn(yaml, 'load').mockReturnValue(undefined);

            expect(converter.parseInput('key:', 'yaml')).toEqual({});

            loadSpy.mockRestore();
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

    describe('properties format', () => {
        const propertiesString = `name=John Doe\nage=30\ncity=New York`;
        const propertiesObject = { name: 'John Doe', age: '30', city: 'New York' };

        it('should parse valid properties input', () => {
            const result = converter.parseInput(propertiesString, 'properties');
            expect(result).toEqual(propertiesObject);
        });

        it('should ignore comments and empty lines in properties', () => {
            const input = `# This is a comment
name=John

! Another comment
age=30`;
            const result = converter.parseInput(input, 'properties');
            expect(result).toEqual({ name: 'John', age: '30' });
        });

        it('should format object to properties string', () => {
            const output = converter.formatOutput(propertiesObject, 'properties');
            expect(output).toContain('name=John Doe');
            expect(output).toContain('age=30');
            expect(output).toContain('city=New York');
        });

        it('should produce a parseable properties output', () => {
            const formatted = converter.formatOutput(propertiesObject, 'properties');
            const reparsed = converter.parseInput(formatted, 'properties');
            expect(reparsed).toEqual(propertiesObject);
        });

        it('should validate correct properties output', () => {
            expect(converter.validateOutput(propertiesString, 'properties')).toBe(true);
        });

        it('should invalidate malformed properties (no delimiter)', () => {
            expect(converter.validateOutput('invalidLineWithoutEquals', 'properties')).toBe(false);
        });

        it('should handle escaped characters in properties', () => {
            const input = 'key\\:colon=value\\=equals\\nnewline';
            const result = converter.parseInput(input, 'properties');
            expect(result).toEqual({ 'key:colon': 'value=equals\nnewline' });
        });

        it('should escape characters when formatting properties', () => {
            const obj = { 'key:colon': 'value=equals\nnewline' };
            const output = converter.formatOutput(obj, 'properties');
            expect(output).toContain('key\\:colon=value\\=equals\\nnewline');
        });

        it('should throw error for properties with only comments', () => {
            const input = '# just a comment';
            expect(() => converter.parseInput(input, 'properties')).toThrow('Invalid properties format');
        });

        it('should handle special escapes in properties', () => {
            const input = 'key=\\t\\\\\\z'; // \t, \\, \z (unknown)
            const result = converter.parseInput(input, 'properties');
            expect(result).toEqual({ key: '\t\\z' });
        });

        it('should round-trip carriage returns, form-feeds, and trailing backslashes', () => {
            const values = {
                carriageReturn: 'ending\r',
                formFeed: 'ending\f',
                trailingSlash: 'ends\\'
            };

            const formatted = converter.formatOutput(values, 'properties');
            expect(formatted).toBe('carriageReturn=ending\\r\nformFeed=ending\\f\ntrailingSlash=ends\\\\');
            expect(converter.parseInput(formatted, 'properties')).toEqual(values);
        });

        it('should decode Java Unicode escapes, including surrogate pairs', () => {
            const input = 'name=Montr\\u00E9al emoji=\\uD83D\\uDE00';
            expect(converter.parseInput(input, 'properties')).toEqual({
                name: 'Montréal emoji=😀'
            });
        });

        it('should reject malformed Java Unicode escapes', () => {
            expect(() => converter.parseInput('name=\\u12G4', 'properties')).toThrow(
                'Invalid Unicode escape in properties'
            );
        });
    });

    describe('detectFormat', () => {
        it('should detect XML', () => {
            expect(converter.detectFormat('<root></root>')).toBe('xml');
            expect(converter.detectFormat('  <root>')).toBe('xml');
        });

        it('should detect JSON', () => {
            expect(converter.detectFormat('{}')).toBe('json');
            expect(converter.detectFormat('[]')).toBe('json');
            expect(converter.detectFormat('  {"a":1}')).toBe('json');
        });

        it('should detect Properties', () => {
            expect(converter.detectFormat('key=value')).toBe('properties');
            expect(converter.detectFormat('key=value\nother=1')).toBe('properties');
        });

        it('should detect YAML', () => {
            expect(converter.detectFormat('key: value')).toBe('yaml');
            expect(converter.detectFormat('list:\n  - item')).toBe('yaml');
            expect(converter.detectFormat('just a string')).toBe('yaml'); // Default
        });

        it('should return null for empty input', () => {
            expect(converter.detectFormat('')).toBe(null);
            expect(converter.detectFormat('   ')).toBe(null);
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

        it('should round-trip XML output through the XML parser', () => {
            const data = { version: '2026.04', owner: 'alex' };
            const xml = converter.formatOutput(data, 'xml');

            expect(converter.parseInput(xml, 'xml')).toEqual(data);
        });

        it('should format to YAML', () => {
            const result = converter.formatOutput(testData, 'yaml');
            expect(result).toContain('name: test');
            expect(result).toContain('value: 123');
        });

        it('should throw error for unsupported format', () => {
            expect(() => converter.formatOutput(testData, 'csv')).toThrow('Unsupported output format: csv');
        });

        it('should throw when generated output fails validation', () => {
            jest.spyOn(converter, 'validateOutput').mockReturnValue(false);

            expect(() => converter.formatOutput(testData, 'json')).toThrow('Invalid JSON output format');
        });

        it('should throw error for invalid properties input', () => {
            expect(() => converter.formatOutput(null, 'properties')).toThrow('Cannot format to properties');
        });

        it('should throw error for circular JSON structure', () => {
            const badData: Record<string, unknown> = { circular: {} };
            (badData.circular as Record<string, unknown>).self = badData;
            expect(() => converter.formatOutput(badData, 'json')).toThrow('Converting circular structure to JSON');
        });

        it('should handle YAML with newlines in keys', () => {
            const data = { 'key\nwith\nnewlines': 'value' };
            const result = converter.formatOutput(data, 'yaml');
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
            const result = converter.xmlToObject(doc.documentElement) as Record<string, unknown>;
            expect(Array.isArray(result.item)).toBe(true);
            expect(result.item).toEqual(['1', '2']);
        });

        it('should append to an existing XML child array for repeated tags beyond two items', () => {
            const xml = `<root>
                <item>1</item>
                <item>2</item>
                <item>3</item>
            </root>`;
            const doc = new DOMParser().parseFromString(xml, 'text/xml');
            const result = converter.xmlToObject(doc.documentElement) as Record<string, unknown>;

            expect(result.item).toEqual(['1', '2', '3']);
        });

        it('should treat null text nodes as empty strings when building XML objects', () => {
            const result = converter.xmlElementToObject({
                children: [],
                childNodes: [{ nodeType: Node.TEXT_NODE, textContent: null }],
                attributes: []
            } as unknown as Element);

            expect(result).toBe('');
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
            const yaml = `[unclosed`;
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

        it('should preserve string types through YAML round trip', () => {
            const data = { date: '2026-08-25', flag: 'yes', octal: '0777', ratio: '1:30' };
            const yamlOut = converter.formatOutput(data, 'yaml');
            expect(yamlOut).toContain("date: '2026-08-25'");
            expect(yamlOut).toContain("flag: 'yes'");
            expect(yamlOut).toContain("octal: '0777'");
            expect(converter.parseInput(yamlOut, 'yaml')).toEqual(data);
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
            const obj: Record<string, unknown> = {};
            obj.self = obj;
            expect(() => converter.formatOutput(obj, 'xml')).toThrow();
        });
    });
});
