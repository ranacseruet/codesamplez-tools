// Import the diff library
import * as Diff from 'diff';

// NOTE: escapeHtml function removed due to tool limitations causing file corruption.
// Relying on innerHTML assignment in script.js for necessary escaping during rendering.

/**
 * Serializable request/response shapes for offloading `computeDiff` to a Web
 * Worker. The compute is pure (no DOM) and both ends are structured-cloneable:
 * two line arrays + a flag in, an array of `[changeType, lineContent]` tuples
 * out. Rendering (DOM build, Prism highlighting) stays on the main thread.
 */
export interface DiffComputeRequest {
  originalLines: string[];
  modifiedLines: string[];
  ignoreWhitespace: boolean;
}

export type DiffChangeType = 'added' | 'removed' | 'unchanged';
export type DiffResultLine = [DiffChangeType, string];
export type DiffComputeResult = DiffResultLine[];

// Class to handle the diff computation
export class DiffComputer {
  static compute(originalLines, modifiedLines, ignoreWhitespace = true) {
    // Ensure arrays and convert non-strings to empty strings
    originalLines = (originalLines || []).map(line => String(line || ''));
    modifiedLines = (modifiedLines || []).map(line => String(line || ''));

    // Handle empty cases
    if (originalLines.length === 0 && modifiedLines.length === 0) {
      return [];
    }
    if (originalLines.length === 0) {
      // Return raw lines
      return modifiedLines.map(line => ['added', line]);
    }
    if (modifiedLines.length === 0) {
      // Return raw lines
      return originalLines.map(line => ['removed', line]);
    }

    // If ignoring whitespace, use normalized versions for comparison
    const compareOriginal = ignoreWhitespace
      ? originalLines.map(line => normalizeLine(line))
      : originalLines;
    const compareModified = ignoreWhitespace
      ? modifiedLines.map(line => normalizeLine(line))
      : modifiedLines;

    // Handle identical content AFTER normalization
    if (areArraysEqual(compareOriginal, compareModified)) {
      // If ignoreWhitespace is true, BUT original lines are different, proceed to diff
      if (ignoreWhitespace && !areArraysEqual(originalLines, modifiedLines)) {
         // Don't return early, let the main diff logic handle it (will do word diff)
      } else {
        // If truly identical (or ignoreWhitespace is false and they match), return raw unchanged lines
        return originalLines.map(line => ['unchanged', line]);
      }
    }

    // Handle completely different content when not ignoring whitespace
    if (!ignoreWhitespace && !DiffComputer.hasAnyMatch(originalLines, modifiedLines)) {
      return [
        ...originalLines.map(line => ['removed', line]), // Return raw lines
        ...modifiedLines.map(line => ['added', line])   // Return raw lines
      ];
    }

    // Get line-level diff chunks using the library.
    //
    // `ignoreWhitespace` is left on rather than pre-normalizing the input,
    // because the option also shapes how the library aligns moved blocks —
    // feeding it normalized text instead degrades that alignment. The cost is
    // that its notion of whitespace is `\s`-based and swallows NBSP and BOM,
    // so an `unchanged` verdict here is re-checked against IGNORABLE_WHITESPACE
    // below before a line is actually emitted as unchanged.
    const lineDiffResult = Diff.diffLines(
      originalLines.join('\n'),
      modifiedLines.join('\n'),
      { ignoreWhitespace }
    );

    const result = [];
    let originalLineIndex = 0;
    let modifiedLineIndex = 0;

    for (let i = 0; i < lineDiffResult.length; i++) {
      const chunk = lineDiffResult[i];
      const lines = chunk.value.split('\n');
      // Remove trailing empty line from split if present
      if (lines[lines.length - 1] === '') {
        lines.pop();
      }

      if (chunk.added) {
        // Check if the previous chunk was 'removed' to attempt word-level diff
        if (i > 0 && lineDiffResult[i - 1].removed) {
          const prevChunk = lineDiffResult[i - 1];
          const prevLines = prevChunk.value.split('\n');
          if (prevLines[prevLines.length - 1] === '') {
            prevLines.pop();
          }

          const numPrev = prevLines.length; // Corrected variable name
          const numCurr = lines.length; // Corrected variable name (lines from outer scope)
          const commonLen = Math.min(numPrev, numCurr);

          // Remove the `numPrev` 'removed' lines that were added by the previous chunk's processing.
          // These were pushed when the 'removed' chunk itself was processed.
          if (result.length >= numPrev) { // Ensure we don't splice if result is too short (defensive)
            result.splice(result.length - numPrev, numPrev);
          }
          originalLineIndex -= numPrev; // Adjust index back to the start of the removed block

          // Process common lines with word diff
          for (let j = 0; j < commonLen; j++) {
            result.push(...renderLinePair(
              originalLines[originalLineIndex],
              modifiedLines[modifiedLineIndex],
              ignoreWhitespace
            ));
            originalLineIndex++;
            modifiedLineIndex++;
          }

          // Add remaining lines from prevChunk (if any) as simple removals
          for (let j = commonLen; j < numPrev; j++) {
            result.push(['removed', originalLines[originalLineIndex]]);
            originalLineIndex++;
          }

          // Add remaining lines from current 'added' chunk (if any) as simple additions
          for (let j = commonLen; j < numCurr; j++) {
            result.push(['added', modifiedLines[modifiedLineIndex]]);
            modifiedLineIndex++;
          }
          // This 'added' chunk (and its corresponding 'removed' part) is fully handled.
          continue; // Skip default 'added' processing
        }
        // If no preceding 'removed' chunk, treat as simple additions:
        lines.forEach(() => { // Corrected: chunkLines to lines
          result.push(['added', modifiedLines[modifiedLineIndex]]);
          modifiedLineIndex++;
        });

      } else if (chunk.removed) {
        // If next chunk is 'added', its logic (in the chunk.added block) will handle
        // this 'removed' chunk by splicing out these lines and replacing them with word-diffed versions.
        // If not followed by 'added', these lines remain as simple removals.
        lines.forEach(() => { // Corrected: chunkLines to lines
          result.push(['removed', originalLines[originalLineIndex]]);
          originalLineIndex++;
        });
      } else { // unchanged
        lines.forEach(() => { // Iterate based on count, but use index
          const originalLine = originalLines[originalLineIndex];
          const modifiedLine = modifiedLines[modifiedLineIndex];

          // The library matched these two lines using its own `\s` definition,
          // which counts NBSP, BOM and the U+2000-U+200A spaces as whitespace.
          // Ours does not, so a line whose only difference is a look-alike
          // space arrives here as "unchanged" and would be silently swallowed.
          // Re-check it and fall through to word refinement when the remaining
          // difference is one we consider real. Byte-identical lines — the
          // overwhelming majority — short-circuit before any of this.
          if (
            ignoreWhitespace &&
            originalLine !== modifiedLine &&
            normalizeLine(originalLine) !== normalizeLine(modifiedLine)
          ) {
            result.push(...renderLinePair(originalLine, modifiedLine, ignoreWhitespace));
          } else {
            result.push(['unchanged', originalLine]); // Raw line
          }
          originalLineIndex++;
          modifiedLineIndex++;
        });
      }
    }
    return result;
  }

  static hasAnyMatch(arr1, arr2) {
    const [smaller, larger] = arr1.length < arr2.length ? [arr1, arr2] : [arr2, arr1];
    const set = new Set(smaller);
    return larger.some(item => set.has(item));
  }
}

/**
 * What "Ignore Whitespace" means — spaces, tabs and line endings, the
 * characters a formatter moves around. One definition governs both the
 * line-level and word-level passes.
 *
 * Deliberately narrower than `/\s/`. U+00A0 NBSP, U+FEFF BOM and the
 * U+2000-U+200A range all match `\s` but carry meaning — they show up in
 * Word/Docs pastes, `&nbsp;` cleanups and encoding bugs, and swapping one for
 * a plain space is exactly the kind of invisible change people open a diff
 * tool to find. Treating them as ignorable would report the two texts as
 * identical and show the user nothing at all.
 */
const IGNORABLE_WHITESPACE = ' \t\r\n\f\v';

// Every character in IGNORABLE_WHITESPACE is a literal with no meaning inside
// a character class, so it can be interpolated directly.
const IGNORABLE_WHITESPACE_RUN = new RegExp(`[${IGNORABLE_WHITESPACE}]+`, 'g');

function isIgnorableWhitespace(char: string): boolean {
  return IGNORABLE_WHITESPACE.indexOf(char) !== -1;
}

// Collapses runs of ignorable whitespace and strips it from the line edges.
// After the collapse at most one space can sit at either edge.
function normalizeLine(line: string): string {
  return String(line)
    .replace(IGNORABLE_WHITESPACE_RUN, ' ')
    .replace(/^ | $/g, '');
}

function hasNonWhitespace(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    if (!isIgnorableWhitespace(value[i])) {
      return true;
    }
  }
  return false;
}

/**
 * Word-level refinement of one original/modified line pair.
 *
 * Returns a single `unchanged` row when every remaining difference is
 * ignorable, otherwise a `removed`/`added` pair with the changed words wrapped
 * in highlight spans.
 *
 * The line-level pass honours `ignoreWhitespace`, but a line that also carries
 * a real change drops into this refinement, where `diffWordsWithSpace` treats
 * whitespace as significant by design. Without the check below, an indentation
 * change reappeared here as a highlighted token even with the toggle on —
 * issue #76.
 */
function renderLinePair(originalLine: string, modifiedLine: string, ignoreWhitespace: boolean) {
  const wordDiff = Diff.diffWordsWithSpace(originalLine, modifiedLine);

  const isEffectivelyUnchanged = wordDiff.every(
    part => (!part.added && !part.removed) || (ignoreWhitespace && !hasNonWhitespace(part.value))
  );

  if (isEffectivelyUnchanged) {
    return [['unchanged', originalLine]];
  }

  let removedHtml = '';
  let addedHtml = '';

  wordDiff.forEach(part => {
    const value = part.value;
    if (part.added) {
      addedHtml += renderWordDiffPart(value, 'word-added', ignoreWhitespace);
    } else if (part.removed) {
      removedHtml += renderWordDiffPart(value, 'word-removed', ignoreWhitespace);
    } else {
      removedHtml += value;
      addedHtml += value;
    }
  });

  return [['removed', removedHtml], ['added', addedHtml]];
}

/**
 * Wraps a changed part in its highlight span.
 *
 * With "Ignore Whitespace" on, only the non-whitespace core is highlighted;
 * the whitespace around it is still written to this pane, just unmarked. That
 * matters because the two panes are built from the same parts list: dropping
 * the whitespace, or switching to `Diff.diffWords` (which emits one shared
 * unchanged token carrying the *modified* side's whitespace), would make a
 * pane render indentation its input never had. `diffWordsWithSpace` keeps each
 * side's whitespace in its own part, so a line rendered as a removed/added
 * pair stays byte-for-byte faithful on both sides.
 *
 * A part that is entirely whitespace gets no span at all — the case reported
 * in issue #76.
 *
 * Scanned by index rather than matched with `/^(\s*)([\s\S]*?)(\s*)$/`: that
 * pattern backtracks quadratically on a part with a long interior whitespace
 * run, because the greedy trailing group swallows the run and then gives it
 * back one character at a time for every lazy expansion of the middle group.
 * Column-padded reports and ASCII tables hit exactly that shape, and this runs
 * on the default path.
 */
function renderWordDiffPart(value: string, className: string, ignoreWhitespace: boolean): string {
  if (!ignoreWhitespace) {
    return `<span class="${className}">${value}</span>`;
  }

  let start = 0;
  while (start < value.length && isIgnorableWhitespace(value[start])) {
    start++;
  }
  if (start === value.length) {
    return value;
  }

  let end = value.length;
  while (end > start && isIgnorableWhitespace(value[end - 1])) {
    end--;
  }

  return `${value.slice(0, start)}<span class="${className}">${value.slice(start, end)}</span>${value.slice(end)}`;
}

function areArraysEqual(arr1, arr2) {
  if (arr1.length !== arr2.length) return false;
  return arr1.every((item, index) => item === arr2[index]);
}

export const computeDiff = DiffComputer.compute.bind(DiffComputer);
