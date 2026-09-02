import {
    addJsonArrayItem,
    addJsonObjectProperty,
    assertJsonEditorLimits,
    changeJsonEditorNodeType,
    cloneJsonEditorNode,
    countJsonEditorNodes,
    createJsonEditorDocument,
    createJsonEditorNode,
    deleteJsonEditorNode,
    duplicateJsonEditorNode,
    findJsonEditorNode,
    findJsonObjectProperty,
    findJsonObjectPropertyParent,
    getJsonEditorDepth,
    getUniqueJsonObjectKey,
    hasDuplicateJsonObjectKey,
    isValidJsonEditorNumber,
    jsonEditorNodeToValue,
    moveJsonEditorNode,
    parseJsonEditorInput,
    parseJsonEditorIndent,
    renameJsonObjectProperty,
    serializeJsonEditorNode,
    updateJsonEditorValue,
    JsonEditorParseError,
    JsonEditorLimitError,
    type JsonEditorIdFactory,
    type JsonEditorNode
} from './json-editor-core';

function ids(prefix = 'id'): JsonEditorIdFactory {
    let next = 0;
    return () => `${prefix}-${next += 1}`;
}

function parse(input: string): JsonEditorNode {
    return parseJsonEditorInput(input, ids());
}

describe('json editor core parsing and serialization', () => {
    it('supports every JSON value type and strips runtime ids from output', () => {
        const node = parse('{"text":"escaped \\"quote\\"\\nline","number":-2.5e3,"flag":true,"empty":null,"list":[1,false]}');

        expect(jsonEditorNodeToValue(node)).toEqual({
            text: 'escaped "quote"\nline',
            number: -2500,
            flag: true,
            empty: null,
            list: [1, false]
        });
        expect(serializeJsonEditorNode(node)).toBe(`{
  "text": "escaped \\"quote\\"\\nline",
  "number": -2500,
  "flag": true,
  "empty": null,
  "list": [
    1,
    false
  ]
}`);
        expect(serializeJsonEditorNode(node, 4)).toContain('    "number"');
        expect(serializeJsonEditorNode(node, 'tab')).toContain('\t"number"');
        expect(serializeJsonEditorNode(node, 'minify')).toBe('{"text":"escaped \\"quote\\"\\nline","number":-2500,"flag":true,"empty":null,"list":[1,false]}');
        expect(serializeJsonEditorNode(node)).not.toContain('id-');
    });

    it('accepts primitive roots and preserves object ordering', () => {
        expect(jsonEditorNodeToValue(parse('"hello"'))).toBe('hello');
        expect(jsonEditorNodeToValue(parse('42'))).toBe(42);
        expect(jsonEditorNodeToValue(parse('false'))).toBe(false);
        expect(serializeJsonEditorNode(parse('{"z":1,"a":2}'))).toBe(`{
  "z": 1,
  "a": 2
}`);
        expect(serializeJsonEditorNode(parse('"hello"'))).toBe('"hello"');
        expect(serializeJsonEditorNode(parse('true'))).toBe('true');
        expect(serializeJsonEditorNode(parse('null'))).toBe('null');
        expect(serializeJsonEditorNode(parse('[]'))).toBe('[]');
        expect(serializeJsonEditorNode(parse('{}'))).toBe('{}');
        expect(() => serializeJsonEditorNode({ id: 'invalid', type: 'number', value: Infinity })).toThrow('finite');
        expect(parseJsonEditorIndent('4')).toBe(4);
        expect(parseJsonEditorIndent('tab')).toBe('tab');
        expect(parseJsonEditorIndent('minify')).toBe('minify');
        expect(parseJsonEditorIndent('unexpected')).toBe(2);
    });

    it('supports direct construction, cloning, and recursive lookup', () => {
        expect(createJsonEditorNode('direct', ids()).type).toBe('string');
        expect(createJsonEditorNode([], ids()).type).toBe('array');
        expect(() => createJsonEditorNode(undefined, ids())).toThrow('Unsupported JSON value type');
        expect(() => parseJsonEditorInput('', ids())).toThrow('Enter JSON to import');

        const source = parse('{"array":[{"key":"value"}],"empty":null}');
        const cloneValues = [
            parse('"value"'),
            parse('1'),
            parse('true'),
            parse('null'),
            parse('[]'),
            parse('{}')
        ].map((node) => cloneJsonEditorNode(node, ids('clone')));
        expect(cloneValues.map((node) => node.type)).toEqual(['string', 'number', 'boolean', 'null', 'array', 'object']);

        const arrayProperty = (source as Extract<JsonEditorNode, { type: 'object' }>).children[0];
        const array = arrayProperty.value as Extract<JsonEditorNode, { type: 'array' }>;
        const nestedObject = array.children[0] as Extract<JsonEditorNode, { type: 'object' }>;
        expect(findJsonEditorNode(source, source.id)).toBe(source);
        expect(findJsonEditorNode(source, nestedObject.children[0].value.id)).toBe(nestedObject.children[0].value);
        expect(findJsonEditorNode(source, 'missing')).toBeNull();
        expect(findJsonObjectProperty(source, arrayProperty.id)).toBe(arrayProperty);
        expect(findJsonObjectProperty(source, nestedObject.children[0].id)).toBe(nestedObject.children[0]);
        expect(findJsonObjectProperty(source, 'missing')).toBeNull();
        expect(findJsonObjectPropertyParent(source, nestedObject.children[0].id)).toBe(nestedObject);
    });

    it('clones nested structures with fresh ids', () => {
        const original = parse('{"nested":{"value":1},"items":[true]}');
        const clone = cloneJsonEditorNode(original, ids());

        expect(jsonEditorNodeToValue(clone)).toEqual(jsonEditorNodeToValue(original));
        expect(clone.id).not.toBe(original.id);
        expect((clone as Extract<JsonEditorNode, { type: 'object' }>).children[0].id)
            .not.toBe((original as Extract<JsonEditorNode, { type: 'object' }>).children[0].id);
    });

    it('rejects invalid JSON with line and column diagnostics', () => {
        expect(() => parse('{\n  "name"  "Ada"\n}')).toThrow(JsonEditorParseError);
        try {
            parse('{\n  "name"  "Ada"\n}');
        } catch (error) {
            expect(error).toBeInstanceOf(JsonEditorParseError);
            const diagnostics = (error as JsonEditorParseError).diagnostics;
            expect(diagnostics.message).toContain('JSON');
            expect(diagnostics.line).toBe(2);
            expect(diagnostics.column).toBeGreaterThan(1);
        }

        const lineColumnParse = jest.spyOn(JSON, 'parse').mockImplementation(() => {
            throw new SyntaxError('Unexpected token at line 3 column 4');
        });
        try {
            expect(() => parseJsonEditorInput(`{
  "name": "Ada"
  "other"
}`, ids())).toThrow(JsonEditorParseError);
            try {
                parseJsonEditorInput(`{
  "name": "Ada"
  "other"
}`, ids());
            } catch (error) {
                expect((error as JsonEditorParseError).diagnostics.line).toBe(3);
                expect((error as JsonEditorParseError).diagnostics.column).toBe(4);
            }
        } finally {
            lineColumnParse.mockRestore();
        }

        const endParse = jest.spyOn(JSON, 'parse').mockImplementation(() => {
            throw new SyntaxError('Unexpected end of JSON input');
        });
        try {
            expect(() => parseJsonEditorInput('{"name":', ids())).toThrow(JsonEditorParseError);
        } finally {
            endParse.mockRestore();
        }

        const genericParse = jest.spyOn(JSON, 'parse').mockImplementation(() => {
            throw new Error('Unexpected parser failure');
        });
        try {
            expect(() => parseJsonEditorInput('null', ids())).toThrow('Unexpected parser failure');
        } finally {
            genericParse.mockRestore();
        }

        const unsupportedParse = jest.spyOn(JSON, 'parse').mockReturnValue(undefined);
        try {
            expect(() => parseJsonEditorInput('null', ids())).toThrow('Unsupported JSON value type');
        } finally {
            unsupportedParse.mockRestore();
        }
    });

    it('enforces input size, node count, and depth limits', () => {
        expect(() => parseJsonEditorInput('"x"'.repeat(2_000_000), ids())).toThrow(/5 MiB/);
        expect(() => parseJsonEditorInput(`[${new Array(10_000).fill('0').join(',')}]`, ids())).toThrow(/10,000/);

        let deep = '0';
        for (let index = 0; index < 100; index += 1) deep = `[${deep}]`;
        expect(() => parse(deep)).not.toThrow();
        deep = `[${deep}]`;
        expect(() => parse(deep)).toThrow(/nesting depth/);
    });

    it('rejects duplicate object keys in the editor serializer', () => {
        const node = parse('{"a":1,"b":2}') as Extract<JsonEditorNode, { type: 'object' }>;
        node.children[1].key = 'a';
        expect(() => serializeJsonEditorNode(node)).toThrow('duplicate key');
    });
});

describe('json editor core immutable operations', () => {
    it('adds properties and array items without mutating the source', () => {
        const factory = ids('new');
        const original = createJsonEditorDocument(factory);
        const withProperty = addJsonObjectProperty(original, original.id, factory);
        const propertyParent = withProperty as Extract<JsonEditorNode, { type: 'object' }>;
        expect(original.children).toHaveLength(0);
        expect(propertyParent.children).toHaveLength(1);
        expect(propertyParent.children[0].key).toBe('newProperty');

        const arrayNode = changeJsonEditorNodeType(withProperty, propertyParent.children[0].value.id, 'array', factory);
        const arrayChild = addJsonArrayItem(arrayNode, propertyParent.children[0].value.id, factory);
        const array = findJsonEditorNode(arrayChild, propertyParent.children[0].value.id) as Extract<JsonEditorNode, { type: 'array' }>;
        expect(array.children).toHaveLength(1);
        expect(jsonEditorNodeToValue(arrayChild)).toEqual({ newProperty: [null] });
        expect(jsonEditorNodeToValue(addJsonObjectProperty(arrayNode, array.children[0].id, factory))).toEqual(jsonEditorNodeToValue(arrayNode));
        expect(jsonEditorNodeToValue(addJsonArrayItem(arrayNode, arrayNode.id, factory))).toEqual(jsonEditorNodeToValue(arrayNode));
    });

    it('updates and renames values through nested arrays without mutation', () => {
        const factory = ids('nested');
        const source = parse('[{"first":1,"second":2},3]') as Extract<JsonEditorNode, { type: 'array' }>;
        const object = source.children[0] as Extract<JsonEditorNode, { type: 'object' }>;
        const updated = updateJsonEditorValue(source, object.children[0].value.id, 10);
        expect(jsonEditorNodeToValue(source)).toEqual([{ first: 1, second: 2 }, 3]);
        expect(jsonEditorNodeToValue(updated)).toEqual([{ first: 10, second: 2 }, 3]);

        const renamed = renameJsonObjectProperty(updated, object.children[1].id, 'last');
        expect(jsonEditorNodeToValue(renamed)).toEqual([{ first: 10, last: 2 }, 3]);
        expect(() => renameJsonObjectProperty(renamed, 'missing', 'x')).toThrow('duplicate key');
        expect(duplicateJsonEditorNode(source, source.children[1].id, factory)).toEqual(expect.objectContaining({ type: 'array' }));
    });

    it('renames keys and rejects duplicates within the owning object only', () => {
        const node = parse('{"first":1,"second":{"first":2}}');
        const root = node as Extract<JsonEditorNode, { type: 'object' }>;
        const firstProperty = root.children[0];
        const secondProperty = root.children[1];
        const nested = secondProperty.value as Extract<JsonEditorNode, { type: 'object' }>;

        expect(hasDuplicateJsonObjectKey(root, 'first', firstProperty.id)).toBe(false);
        expect(findJsonObjectPropertyParent(node, nested.children[0].id)?.id).toBe(nested.id);
        expect(() => renameJsonObjectProperty(node, secondProperty.id, 'first')).toThrow('duplicate key');
        const renamed = renameJsonObjectProperty(node, firstProperty.id, 'renamed');
        expect(jsonEditorNodeToValue(renamed)).toEqual({ renamed: 1, second: { first: 2 } });
    });

    it('duplicates, reorders, and deletes direct siblings', () => {
        const factory = ids('new');
        const original = parse('{"a":1,"b":2,"c":3}') as Extract<JsonEditorNode, { type: 'object' }>;
        const duplicated = duplicateJsonEditorNode(original, original.children[1].value.id, factory);
        expect(Object.keys(jsonEditorNodeToValue(duplicated) as Record<string, unknown>)).toEqual(['a', 'b', 'bCopy', 'c']);

        const bCopy = (duplicated as Extract<JsonEditorNode, { type: 'object' }>).children[2].value.id;
        const moved = moveJsonEditorNode(duplicated, bCopy, 'up');
        expect(Object.keys(jsonEditorNodeToValue(moved) as Record<string, unknown>)).toEqual(['a', 'bCopy', 'b', 'c']);
        const deleted = deleteJsonEditorNode(moved, bCopy);
        expect(jsonEditorNodeToValue(deleted)).toEqual({ a: 1, b: 2, c: 3 });

        const array = parse('[1,2,3]') as Extract<JsonEditorNode, { type: 'array' }>;
        const duplicatedArray = duplicateJsonEditorNode(array, array.children[1].id, factory) as Extract<JsonEditorNode, { type: 'array' }>;
        expect(jsonEditorNodeToValue(duplicatedArray)).toEqual([1, 2, 2, 3]);
        const movedArray = moveJsonEditorNode(duplicatedArray, duplicatedArray.children[2].id, 'down');
        expect(jsonEditorNodeToValue(movedArray)).toEqual([1, 2, 3, 2]);
        const movedArrayChildren = (movedArray as Extract<JsonEditorNode, { type: 'array' }>).children;
        expect(jsonEditorNodeToValue(moveJsonEditorNode(movedArray, movedArrayChildren[0].id, 'up'))).toEqual([1, 2, 3, 2]);
        expect(jsonEditorNodeToValue(deleteJsonEditorNode(movedArray, movedArrayChildren[3].id))).toEqual([1, 2, 3]);
        expect(deleteJsonEditorNode(array, array.id)).toBe(array);

        const nestedArray = parse('[[1,2],[3,4]]') as Extract<JsonEditorNode, { type: 'array' }>;
        const innerArray = nestedArray.children[1] as Extract<JsonEditorNode, { type: 'array' }>;
        const innerValueId = innerArray.children[0].id;
        expect(jsonEditorNodeToValue(deleteJsonEditorNode(nestedArray, innerValueId))).toEqual([[1, 2], [4]]);
        expect(jsonEditorNodeToValue(duplicateJsonEditorNode(nestedArray, innerValueId, factory))).toEqual([[1, 2], [3, 3, 4]]);
        expect(jsonEditorNodeToValue(moveJsonEditorNode(nestedArray, innerValueId, 'down'))).toEqual([[1, 2], [4, 3]]);

        const nestedObject = parse('{"outer":{"first":1,"second":2}}') as Extract<JsonEditorNode, { type: 'object' }>;
        const innerObject = nestedObject.children[0].value as Extract<JsonEditorNode, { type: 'object' }>;
        const secondId = innerObject.children[1].value.id;
        expect(jsonEditorNodeToValue(deleteJsonEditorNode(nestedObject, secondId))).toEqual({ outer: { first: 1 } });
        expect(jsonEditorNodeToValue(duplicateJsonEditorNode(nestedObject, secondId, factory))).toEqual({ outer: { first: 1, second: 2, secondCopy: 2 } });
        expect(jsonEditorNodeToValue(moveJsonEditorNode(nestedObject, secondId, 'up'))).toEqual({ outer: { second: 2, first: 1 } });
        expect(duplicateJsonEditorNode(parse('1'), 'missing', factory)).toEqual(expect.objectContaining({ type: 'number' }));
        expect(deleteJsonEditorNode(parse('1'), 'missing')).toEqual(expect.objectContaining({ type: 'number' }));
        expect(moveJsonEditorNode(parse('1'), 'missing', 'down')).toEqual(expect.objectContaining({ type: 'number' }));
        expect(duplicateJsonEditorNode(array, array.id, factory)).toBe(array);
    });

    it('changes primitive and container types while preserving the node id', () => {
        const factory = ids();
        const node = parse('{"value":"12","children":{"x":true}}') as Extract<JsonEditorNode, { type: 'object' }>;
        const valueId = node.children[0].value.id;
        const numberNode = changeJsonEditorNodeType(node, valueId, 'number', factory);
        expect((findJsonEditorNode(numberNode, valueId) as Extract<JsonEditorNode, { type: 'number' }>).value).toBe(12);

        const childrenId = node.children[1].value.id;
        const emptyArray = changeJsonEditorNodeType(node, childrenId, 'array', factory);
        expect((findJsonEditorNode(emptyArray, childrenId) as Extract<JsonEditorNode, { type: 'array' }>).children).toHaveLength(0);

        const conversions = parse('{"string":"true","number":2,"boolean":true,"null":null,"object":{"x":1},"array":[1]}') as Extract<JsonEditorNode, { type: 'object' }>;
        const converted = conversions.children.reduce((current, property) => changeJsonEditorNodeType(current, property.value.id, 'string', factory), conversions);
        expect(jsonEditorNodeToValue(converted)).toEqual({ string: 'true', number: '2', boolean: 'true', null: '', object: '', array: '' });
        const numberFromBoolean = changeJsonEditorNodeType(conversions, conversions.children[2].value.id, 'number', factory);
        expect(jsonEditorNodeToValue(numberFromBoolean)).toEqual({ string: 'true', number: 2, boolean: 1, null: null, object: { x: 1 }, array: [1] });
        const booleanFromNumber = changeJsonEditorNodeType(conversions, conversions.children[1].value.id, 'boolean', factory);
        expect((booleanFromNumber as Extract<JsonEditorNode, { type: 'object' }>).children[1].value).toEqual(expect.objectContaining({ type: 'boolean', value: true }));
        const nullFromString = changeJsonEditorNodeType(conversions, conversions.children[0].value.id, 'null', factory);
        expect((nullFromString as Extract<JsonEditorNode, { type: 'object' }>).children[0].value).toEqual(expect.objectContaining({ type: 'null', value: null }));
        expect(jsonEditorNodeToValue(changeJsonEditorNodeType(conversions, conversions.children[0].value.id, 'object', factory))).toEqual({ string: {}, number: 2, boolean: true, null: null, object: { x: 1 }, array: [1] });
        expect(jsonEditorNodeToValue(changeJsonEditorNodeType(conversions, conversions.children[0].value.id, 'array', factory))).toEqual({ string: [], number: 2, boolean: true, null: null, object: { x: 1 }, array: [1] });
        expect((changeJsonEditorNodeType(conversions, conversions.children[0].value.id, 'number', factory) as Extract<JsonEditorNode, { type: 'object' }>).children[0].value).toEqual(expect.objectContaining({ type: 'number', value: 0 }));
        expect((changeJsonEditorNodeType(conversions, conversions.children[3].value.id, 'number', factory) as Extract<JsonEditorNode, { type: 'object' }>).children[3].value).toEqual(expect.objectContaining({ type: 'number', value: 0 }));
        expect((changeJsonEditorNodeType(conversions, conversions.children[4].value.id, 'number', factory) as Extract<JsonEditorNode, { type: 'object' }>).children[4].value).toEqual(expect.objectContaining({ type: 'number', value: 0 }));
        expect((changeJsonEditorNodeType(conversions, conversions.children[5].value.id, 'number', factory) as Extract<JsonEditorNode, { type: 'object' }>).children[5].value).toEqual(expect.objectContaining({ type: 'number', value: 0 }));
        expect((changeJsonEditorNodeType(conversions, conversions.children[0].value.id, 'boolean', factory) as Extract<JsonEditorNode, { type: 'object' }>).children[0].value).toEqual(expect.objectContaining({ type: 'boolean', value: true }));
        expect((changeJsonEditorNodeType(conversions, conversions.children[3].value.id, 'boolean', factory) as Extract<JsonEditorNode, { type: 'object' }>).children[3].value).toEqual(expect.objectContaining({ type: 'boolean', value: false }));
        expect((changeJsonEditorNodeType(conversions, conversions.children[4].value.id, 'boolean', factory) as Extract<JsonEditorNode, { type: 'object' }>).children[4].value).toEqual(expect.objectContaining({ type: 'boolean', value: false }));
        expect((changeJsonEditorNodeType(conversions, conversions.children[5].value.id, 'boolean', factory) as Extract<JsonEditorNode, { type: 'object' }>).children[5].value).toEqual(expect.objectContaining({ type: 'boolean', value: false }));
    });

    it('reports counts, depth, and unique key candidates', () => {
        const node = parse('{"a":{"b":[true,null]},"c":0}');
        expect(countJsonEditorNodes(node)).toBe(6);
        expect(getJsonEditorDepth(node)).toBe(3);
        const object = node as Extract<JsonEditorNode, { type: 'object' }>;
        expect(getUniqueJsonObjectKey(object.children, 'a')).toBe('a2');
        expect(getUniqueJsonObjectKey(object.children, 'new')).toBe('new');
        expect(getUniqueJsonObjectKey([
            { id: 'a', key: 'a', value: parse('1') },
            { id: 'a2', key: 'a2', value: parse('2') }
        ], 'a')).toBe('a3');
    });

    it('accepts JSON number literals and rejects JavaScript-only values', () => {
        expect(isValidJsonEditorNumber('-2.5e3')).toBe(true);
        expect(isValidJsonEditorNumber('0')).toBe(true);
        expect(isValidJsonEditorNumber('01')).toBe(false);
        expect(isValidJsonEditorNumber('Infinity')).toBe(false);
        expect(isValidJsonEditorNumber('')).toBe(false);

        const node = parse('{"value":1}') as Extract<JsonEditorNode, { type: 'object' }>;
        const updated = updateJsonEditorValue(node, node.children[0].value.id, 2);
        expect(jsonEditorNodeToValue(updated)).toEqual({ value: 2 });
        expect(() => updateJsonEditorValue(node, node.children[0].value.id, '01')).toThrow('valid JSON number syntax');
        expect(() => updateJsonEditorValue(node, node.children[0].value.id, NaN)).toThrow('finite');

        const primitives = parse('{"text":"old","flag":false,"empty":null}') as Extract<JsonEditorNode, { type: 'object' }>;
        expect(jsonEditorNodeToValue(updateJsonEditorValue(primitives, primitives.children[0].value.id, 'new'))).toEqual({ text: 'new', flag: false, empty: null });
        expect(jsonEditorNodeToValue(updateJsonEditorValue(primitives, primitives.children[1].value.id, true))).toEqual({ text: 'old', flag: true, empty: null });
        expect(jsonEditorNodeToValue(updateJsonEditorValue(primitives, primitives.children[2].value.id, 'ignored'))).toEqual({ text: 'old', flag: false, empty: null });
        expect(updateJsonEditorValue(primitives, primitives.id, 'ignored')).toBe(primitives);
        expect(updateJsonEditorValue(primitives, 'missing', 'ignored')).toBe(primitives);
    });

    it('enforces node and depth limits on structural mutations', () => {
        const factory = ids('limit');
        const root = createJsonEditorDocument(factory);
        const limits = { maxBytes: 5 * 1024 * 1024, maxNodes: 1, maxDepth: 100 };

        expect(() => addJsonObjectProperty(root, root.id, factory, 'newProperty', limits)).toThrow(JsonEditorLimitError);
        expect(() => assertJsonEditorLimits(root, limits)).not.toThrow();

        const nested = parse('{"config":{"enabled":true}}') as Extract<JsonEditorNode, { type: 'object' }>;
        const nestedValue = nested.children[0].value;
        expect(() => duplicateJsonEditorNode(nested, nestedValue.id, factory, {
            maxBytes: 5 * 1024 * 1024,
            maxNodes: countJsonEditorNodes(nested),
            maxDepth: 100
        })).toThrow(/tree nodes/);
        expect(() => changeJsonEditorNodeType(nested, nestedValue.id, 'array', factory, {
            maxBytes: 5 * 1024 * 1024,
            maxNodes: 100,
            maxDepth: 1
        })).toThrow(/nesting depth/);
    });
});
