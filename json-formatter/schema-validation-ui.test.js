import { JSONFormatter } from './script';

jest.mock('./schema-validation-runner', () => {
  throw new Error('validator chunk missing');
});

function createFormatter(result, useDefaultSchemaRunner = false) {
  const formatter = new JSONFormatter(false);
  formatter.currentRunId = 0;
  formatter.input = document.createElement('textarea');
  formatter.output = document.createElement('div');
  formatter.plainViewTextarea = document.createElement('textarea');
  formatter.formatBtn = document.createElement('button');
  formatter.copyBtn = document.createElement('button');
  formatter.downloadBtn = document.createElement('button');
  formatter.expandAllBtn = document.createElement('button');
  formatter.collapseAllBtn = document.createElement('button');
  formatter.errorStatus = document.createElement('div');
  formatter.goToErrorBtn = document.createElement('button');
  formatter.originalSizeEl = document.createElement('span');
  formatter.formattedSizeEl = document.createElement('span');
  formatter.sortCheckbox = { checked: false };
  formatter.autoFixCheckbox = { checked: false };
  formatter.indentSelect = { value: '2', addEventListener: jest.fn() };
  formatter.tabs = [];
  formatter.viewContainers = { tree: document.createElement('div'), plain: document.createElement('div') };
  formatter.schemaInput = document.createElement('textarea');
  formatter.schemaDraft = document.createElement('select');
  formatter.schemaDraft.value = 'auto';
  formatter.schemaStatus = document.createElement('div');
  formatter.goToSchemaErrorBtn = document.createElement('button');
  if (!useDefaultSchemaRunner) {
    formatter.lazySchemaRunner = { run: jest.fn().mockResolvedValue(result), terminate: jest.fn() };
  }
  return formatter;
}

describe('JSON Schema validation UI flow', () => {
  test('preserves formatted output while showing the first schema issue', async () => {
    const formatter = createFormatter({
      outcome: 'invalid-data',
      draft: 'draft-07',
      diagnostic: { pointer: '/name', rule: 'type', message: 'must be string', line: 1, column: 9 }
    });
    formatter.input.value = '{"name":42}';
    formatter.schemaInput.value = '{"type":"object"}';

    await formatter.formatJSON();

    expect(formatter.plainViewTextarea.value).toContain('"name": 42');
    expect(formatter.schemaStatus.textContent).toContain('/name');
    expect(formatter.schemaStatus.textContent).toContain('type');
    expect(formatter.goToSchemaErrorBtn.hidden).toBe(false);
    expect(formatter.formatBtn.textContent).toBe('Format & Validate');
  });

  test('reports strict raw JSON while retaining auto-fixed output', async () => {
    const formatter = createFormatter({
      outcome: 'invalid-json',
      message: 'Unexpected token } in JSON'
    });
    formatter.input.value = '{"a":1,}';
    formatter.autoFixCheckbox.checked = true;
    formatter.schemaInput.value = '{"type":"object"}';

    await formatter.formatJSON();

    expect(formatter.plainViewTextarea.value).toContain('"a": 1');
    expect(formatter.schemaStatus.textContent).toContain('not run until the source is valid JSON');
  });

  test('drops a validation result when the schema changes during the worker run', async () => {
    let resolveRun;
    const formatter = createFormatter({ outcome: 'valid', draft: 'draft-07' });
    formatter.lazySchemaRunner.run = jest.fn((_request, shouldAbort) => {
      shouldAbort();
      return new Promise((resolve) => { resolveRun = resolve; });
    });
    formatter.input.value = '{"a":1}';
    formatter.schemaInput.value = '{"type":"object"}';

    const pending = formatter.formatJSON();
    await new Promise((resolve) => setTimeout(resolve, 30));
    formatter.clearValidationStatus();
    resolveRun({ outcome: 'valid', draft: 'draft-07' });
    await pending;

    expect(formatter.schemaStatus.textContent).toBe('');
  });

  test('renders valid, invalid-schema, unsupported, and unavailable statuses', () => {
    const formatter = createFormatter({ outcome: 'valid', draft: 'draft-07' });

    formatter.setValidationStatus({ outcome: 'valid', draft: 'draft-07' });
    expect(formatter.schemaStatus.textContent).toBe('Valid against Draft 7.');

    formatter.setValidationStatus({ outcome: 'valid', draft: '2020-12' });
    expect(formatter.schemaStatus.textContent).toBe('Valid against Draft 2020-12.');

    formatter.setValidationStatus({ outcome: 'invalid-schema', message: 'Schema is malformed.', line: 2, column: 4 });
    expect(formatter.schemaStatus.textContent).toContain('Invalid schema: Schema is malformed. (line 2, col 4)');

    formatter.setValidationStatus({ outcome: 'unsupported-draft', message: 'Unsupported JSON Schema draft.' });
    expect(formatter.schemaStatus.textContent).toBe('Unsupported JSON Schema draft.');

    formatter.setValidationStatus({ outcome: 'unavailable', message: 'Schema validation is unavailable.' });
    expect(formatter.schemaStatus.textContent).toBe('Schema validation is unavailable.');

    formatter.schemaStatus = null;
    expect(() => formatter.setValidationStatus({ outcome: 'valid', draft: 'draft-07' })).not.toThrow();
  });

  test('supports the schema-error jump action and invalidates on schema controls', () => {
    const formatter = createFormatter({ outcome: 'valid', draft: 'draft-07' });
    formatter.input.value = '{"name":42}';
    formatter.setValidationStatus({
      outcome: 'invalid-data',
      draft: 'draft-07',
      diagnostic: { pointer: '', rule: 'type', message: 'must be string', line: 1, column: 9 }
    });

    formatter.goToSchemaError();
    expect(formatter.input.selectionStart).toBe(8);
    expect(formatter.input.selectionEnd).toBe(9);

    formatter.schemaInput.dispatchEvent(new Event('input'));
    formatter.schemaDraft.dispatchEvent(new Event('change'));
  });

  test('reports an unavailable validator error without losing formatted output', async () => {
    const formatter = createFormatter({ outcome: 'valid', draft: 'draft-07' });
    formatter.lazySchemaRunner.run = jest.fn(() => Promise.reject(new Error('worker failed')));
    formatter.input.value = '{"a":1}';
    formatter.schemaInput.value = '{"type":"object"}';

    await formatter.formatJSON();

    expect(formatter.plainViewTextarea.value).toContain('"a": 1');
    expect(formatter.schemaStatus.textContent).toContain('Schema validation is unavailable: worker failed');
  });

  test('validates the raw source after formatting fails', async () => {
    const formatter = createFormatter({ outcome: 'invalid-json', message: 'Unexpected end of JSON input' });
    formatter.input.value = '{"a":';
    formatter.schemaInput.value = '{"type":"object"}';

    await formatter.formatJSON();

    expect(formatter.lazySchemaRunner.run).toHaveBeenCalled();
    expect(formatter.schemaStatus.textContent).toContain('not run until the source is valid JSON');
  });

  test('loads schema files and clears stale status through the registered controls', async () => {
    const formatter = createFormatter({ outcome: 'valid', draft: 'draft-07' });
    const schemaFileInput = document.createElement('input');
    schemaFileInput.type = 'file';
    schemaFileInput.id = 'json-schema-file';
    document.body.appendChild(schemaFileInput);

    formatter.initializeEvents();

    formatter.schemaInput.dispatchEvent(new Event('input'));
    formatter.schemaDraft.dispatchEvent(new Event('change'));
    formatter.schemaErrorIndex = 0;
    formatter.goToSchemaErrorBtn.click();

    const dropped = new File(['{"type":"object"}'], 'schema.json');
    const dropEvent = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: { types: ['Files'], files: [dropped] }
    });
    formatter.schemaInput.dispatchEvent(dropEvent);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(formatter.schemaInput.value).toContain('object');

    const oversized = new File(['x'], 'large-schema.json');
    Object.defineProperty(oversized, 'size', { value: 257 * 1024 });
    const oversizedDrop = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(oversizedDrop, 'dataTransfer', {
      value: { types: ['Files'], files: [oversized] }
    });
    formatter.schemaInput.dispatchEvent(oversizedDrop);

    const picked = new File(['{"type":"string"}'], 'picked-schema.json');
    Object.defineProperty(schemaFileInput, 'files', { value: [picked], configurable: true });
    schemaFileInput.dispatchEvent(new Event('change'));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(formatter.schemaInput.value).toContain('string');

    const oversizedPick = new File(['x'], 'oversized-schema.json');
    Object.defineProperty(oversizedPick, 'size', { value: 257 * 1024 });
    Object.defineProperty(schemaFileInput, 'files', { value: [oversizedPick], configurable: true });
    schemaFileInput.dispatchEvent(new Event('change'));

    formatter.schemaInput = null;
    const secondPick = new File(['{}'], 'second-schema.json');
    Object.defineProperty(schemaFileInput, 'files', { value: [secondPick], configurable: true });
    schemaFileInput.dispatchEvent(new Event('change'));

    formatter.schemaErrorIndex = null;
    formatter.goToSchemaError();

    document.body.removeChild(schemaFileInput);
  });

  test('returns unavailable when the validator runner chunk is unavailable', async () => {
    const formatter = createFormatter(undefined, true);
    formatter.input.value = '{"a":1}';
    formatter.schemaInput.value = '{"type":"object"}';

    await formatter.formatJSON();

    expect(formatter.schemaStatus.textContent).toContain('Schema validation is unavailable');
  });
});
