import { applyPatch } from 'diff';
import { createUnifiedPatch, type UnifiedPatchInput } from './patch-export';

const makeInput = (overrides: Partial<UnifiedPatchInput> = {}): UnifiedPatchInput => ({
  originalFileName: 'original',
  modifiedFileName: 'modified',
  originalText: 'first\nsecond\n',
  modifiedText: 'first\nupdated\n',
  ignoreWhitespace: false,
  ...overrides
});

describe('createUnifiedPatch', () => {
  test('creates an applicable unified patch with the supplied file labels', async () => {
    const input = makeInput({
      originalFileName: 'before.txt',
      modifiedFileName: 'after.txt'
    });

    const patch = await createUnifiedPatch(input);

    expect(patch).toContain('--- before.txt');
    expect(patch).toContain('+++ after.txt');
    expect(patch).toContain('-second');
    expect(patch).toContain('+updated');
    expect(applyPatch(input.originalText, patch)).toBe(input.modifiedText);
  });

  test('returns a header-only patch for identical input', async () => {
    const patch = await createUnifiedPatch(makeInput({
      modifiedText: 'first\nsecond\n'
    }));

    expect(patch).toContain('--- original');
    expect(patch).toContain('+++ modified');
    expect(patch).not.toContain('@@');
  });

  test('passes the whitespace option through to patch generation', async () => {
    const input = makeInput({
      originalText: '  first\n',
      modifiedText: 'first\n'
    });

    const ignoredPatch = await createUnifiedPatch({ ...input, ignoreWhitespace: true });
    const exactPatch = await createUnifiedPatch({ ...input, ignoreWhitespace: false });

    expect(ignoredPatch).not.toContain('@@');
    expect(exactPatch).toContain('@@');
  });

  test('keeps ignored whitespace out of patch context', async () => {
    const input = makeInput({
      originalText: 'alpha\n\tbeta\nCHANGED-OLD\ngamma\n',
      modifiedText: 'alpha\n    beta\nCHANGED-NEW\ngamma\n',
      ignoreWhitespace: true
    });

    const patch = await createUnifiedPatch(input);

    expect(patch).not.toContain('    beta');
    expect(applyPatch(input.originalText, patch)).toBe('alpha\n\tbeta\nCHANGED-NEW\ngamma\n');
  });

  test('preserves raw carriage returns in exact mode', async () => {
    const patch = await createUnifiedPatch(makeInput({
      originalText: 'first\r\nsecond\r\n',
      modifiedText: 'first\nsecond\n'
    }));

    expect(patch).toContain('-first\r\n');
    expect(patch).toContain('+first\n');
  });
});
