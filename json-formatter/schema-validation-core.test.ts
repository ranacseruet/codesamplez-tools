import {
  MAX_SCHEMA_BYTES,
  MAX_SCHEMA_DEPTH,
  validateJsonSchema,
  type SchemaValidationRequest
} from './schema-validation-core';
import Ajv from 'ajv';

const run = (data: string, schema: string, draft: SchemaValidationRequest['draft'] = 'auto') =>
  validateJsonSchema({ data, schema, draft });

describe('JSON Schema validation core', () => {
  test('validates Draft 7 and returns only the first diagnostic', () => {
    const result = run(
      '{"name":"Ada","extra":true}',
      JSON.stringify({
        $schema: 'https://json-schema.org/draft-07/schema#',
        type: 'object',
        required: ['name'],
        additionalProperties: false,
        properties: { name: { type: 'string' } }
      })
    );

    expect(result).toMatchObject({
      outcome: 'invalid-data',
      draft: 'draft-07',
      diagnostic: {
        pointer: '/extra',
        rule: 'additionalProperties',
        line: 1,
        column: 15
      }
    });
    expect(result).toHaveProperty('diagnostic.message');
  });

  test('accepts draft-valid schemas without Ajv strict-mode assumptions', () => {
    expect(run(
      '{"name":"Ada"}',
      JSON.stringify({
        properties: { name: { type: 'string' } },
        required: ['name'],
        additionalProperties: false
      })
    )).toMatchObject({ outcome: 'valid', draft: 'draft-07' });

    expect(run(
      '["Ada"]',
      JSON.stringify({ type: 'array', items: [{ type: 'string' }] })
    )).toMatchObject({ outcome: 'valid', draft: 'draft-07' });

    expect(run(
      '{"name":"Ada"}',
      JSON.stringify({
        type: 'object',
        properties: { name: { type: 'string', example: 'Ada' } }
      })
    )).toMatchObject({ outcome: 'valid', draft: 'draft-07' });
  });

  test('validates Draft 2020-12 local $defs references', () => {
    const result = run(
      '{"id":"abc"}',
      JSON.stringify({
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        $defs: { id: { type: 'string', minLength: 4 } },
        type: 'object',
        properties: { id: { $ref: '#/$defs/id' } }
      })
    );

    expect(result).toMatchObject({
      outcome: 'invalid-data',
      draft: '2020-12',
      diagnostic: { pointer: '/id', rule: 'minLength', line: 1, column: 7 }
    });
  });

  test.each([
    'http://json-schema.org/draft/2020-12/schema',
    'http://json-schema.org/draft/2020-12/schema#'
  ])('normalizes the HTTP Draft 2020-12 declaration (%s)', (declaration) => {
    expect(run('42', JSON.stringify({ $schema: declaration, type: 'integer' }))).toMatchObject({
      outcome: 'valid',
      draft: '2020-12'
    });
  });

  test('rewrites a declared draft when the selector explicitly overrides it', () => {
    expect(run(
      '{"name":"Ada"}',
      JSON.stringify({
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: { name: { type: 'string' } }
      }),
      '2020-12'
    )).toMatchObject({ outcome: 'valid', draft: '2020-12' });

    expect(run(
      '"Ada"',
      JSON.stringify({
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'string'
      }),
      'draft-07'
    )).toMatchObject({ outcome: 'valid', draft: 'draft-07' });

    expect(run(
      '"Ada"',
      JSON.stringify({
        $schema: 'http://json-schema.org/draft-04/schema#',
        type: 'string'
      }),
      'draft-07'
    )).toMatchObject({ outcome: 'valid', draft: 'draft-07' });
  });

  test('validates Draft 7 local definitions references', () => {
    const result = run(
      '{"id":3}',
      JSON.stringify({
        $schema: 'http://json-schema.org/draft-07/schema#',
        definitions: { id: { type: 'string' } },
        type: 'object',
        properties: { id: { $ref: '#/definitions/id' } }
      })
    );

    expect(result).toMatchObject({
      outcome: 'invalid-data',
      draft: 'draft-07',
      diagnostic: { pointer: '/id', rule: 'type', line: 1, column: 7 }
    });
  });

  test('defaults a missing declaration to Draft 7', () => {
    expect(run('42', JSON.stringify({ type: 'string' }))).toMatchObject({
      outcome: 'invalid-data',
      draft: 'draft-07',
      diagnostic: { pointer: '', rule: 'type', line: 1, column: 1 }
    });
  });

  test('reports unsupported declarations without compiling them', () => {
    expect(run('{}', JSON.stringify({ $schema: 'https://json-schema.org/draft/2019-09/schema' }))).toEqual({
      outcome: 'unsupported-draft',
      message: 'Unsupported JSON Schema draft: https://json-schema.org/draft/2019-09/schema',
      declared: 'https://json-schema.org/draft/2019-09/schema'
    });
  });

  test('rejects external references without fetching', () => {
    expect(run('{}', JSON.stringify({ $ref: 'https://example.com/schema.json' }))).toMatchObject({
      outcome: 'invalid-schema'
    });

    expect(run('{}', JSON.stringify({
      type: 'object',
      properties: { nested: { $ref: 'https://example.com/schema.json' } }
    }))).toMatchObject({ outcome: 'invalid-schema' });

    expect(run('{}', JSON.stringify({ allOf: [{ $ref: 'https://example.com/schema.json' }] }))).toMatchObject({
      outcome: 'invalid-schema'
    });

    expect(run('{}', JSON.stringify({ dependencies: { nested: { $ref: 'https://example.com/schema.json' } } }))).toMatchObject({
      outcome: 'invalid-schema'
    });
  });

  test('does not mistake literal data or a property named $ref for an external reference', () => {
    expect(run(
      '{"$ref":"https://example.com/schema.json"}',
      JSON.stringify({
        type: 'object',
        properties: { $ref: { type: 'string' } },
        required: ['$ref']
      })
    )).toMatchObject({ outcome: 'valid', draft: 'draft-07' });

    expect(run(
      '{"$ref":"https://example.com/schema.json"}',
      JSON.stringify({ const: { $ref: 'https://example.com/schema.json' } })
    )).toMatchObject({ outcome: 'valid', draft: 'draft-07' });
  });

  test('reports malformed schema JSON and strict raw data separately', () => {
    expect(run('{}', '   ')).toMatchObject({ outcome: 'invalid-schema' });
    expect(run('{}', '{"type":')).toMatchObject({ outcome: 'invalid-schema', line: 1, column: 9 });
    expect(run('{"a":1,}', '{"type":"object"}')).toMatchObject({ outcome: 'invalid-json' });
    expect(run('{}', JSON.stringify('not a schema'))).toMatchObject({ outcome: 'invalid-schema' });
    expect(run('{}', JSON.stringify({ $ref: '#/missing' }))).toMatchObject({ outcome: 'invalid-schema' });
  });

  test('reports unavailable when Ajv does not provide a diagnostic', () => {
    const compile = jest.spyOn(Ajv.prototype, 'compile').mockReturnValue(
      Object.assign(() => false, { errors: undefined }) as never
    );

    try {
      expect(run('{}', '{"type":"object"}')).toEqual({
        outcome: 'unavailable',
        message: 'Schema validation did not return a diagnostic.'
      });
    } finally {
      compile.mockRestore();
    }
  });

  test('maps required to its containing object and additionalProperties to its key', () => {
    expect(run('{"user":{}}', JSON.stringify({ type: 'object', properties: { user: { type: 'object', required: ['name'], properties: { name: { type: 'string' } } } } })))
      .toMatchObject({ outcome: 'invalid-data', diagnostic: { pointer: '/user', rule: 'required', line: 1, column: 9 } });

    expect(run('{"ok":true,"oops":1}', JSON.stringify({ type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean' } } })))
      .toMatchObject({ outcome: 'invalid-data', diagnostic: { pointer: '/oops', rule: 'additionalProperties', line: 1, column: 12 } });
  });

  test('treats format as annotation-only', () => {
    expect(run('"not-an-email"', JSON.stringify({ type: 'string', format: 'email' }))).toMatchObject({
      outcome: 'valid',
      draft: 'draft-07'
    });
  });

  test('enforces schema size, depth, and malformed $schema limits', () => {
    expect(run('{}', 'x'.repeat(MAX_SCHEMA_BYTES + 1))).toMatchObject({ outcome: 'invalid-schema' });

    let deep: unknown = {};
    for (let index = 0; index <= MAX_SCHEMA_DEPTH; index += 1) deep = { properties: { nested: deep } };
    expect(run('{}', JSON.stringify(deep))).toMatchObject({ outcome: 'invalid-schema' });

    expect(run('{}', JSON.stringify({ $schema: 7 }))).toMatchObject({ outcome: 'invalid-schema' });
  });
});
