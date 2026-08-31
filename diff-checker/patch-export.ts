import { createTwoFilesPatch } from 'diff/lib/patch/create.js';

export interface UnifiedPatchInput {
  originalFileName: string;
  modifiedFileName: string;
  originalText: string;
  modifiedText: string;
  ignoreWhitespace: boolean;
}

/**
 * Build a unified patch without blocking the main thread for the duration of
 * the diff calculation. The raw source is intentionally passed through so
 * ignored formatting is not rewritten before patch generation. Native
 * ignore-whitespace matching can otherwise put the modified side's spacing in
 * context lines, so the ignored mode uses zero context; applying that patch
 * preserves the original spacing just as the renderer does.
 */
export function createUnifiedPatch(input: UnifiedPatchInput): Promise<string> {
  return new Promise((resolve) => {
    createTwoFilesPatch(
      input.originalFileName,
      input.modifiedFileName,
      input.originalText,
      input.modifiedText,
      undefined,
      undefined,
      {
        ignoreWhitespace: input.ignoreWhitespace,
        context: input.ignoreWhitespace ? 0 : undefined,
        callback: (patch: string) => resolve(patch)
      }
    );
  });
}
