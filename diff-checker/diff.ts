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

    // Get line-level diff chunks using the library
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
            const originalLineForWordDiff = originalLines[originalLineIndex];
            const modifiedLineForWordDiff = modifiedLines[modifiedLineIndex];
            const wordDiff = Diff.diffWordsWithSpace(originalLineForWordDiff, modifiedLineForWordDiff);

            let removedHtml = '';
            let addedHtml = '';

            const isEffectivelyUnchanged = wordDiff.every(part => !part.added && !part.removed);

            if (isEffectivelyUnchanged) {
              result.push(['unchanged', originalLineForWordDiff]);
            } else {
              wordDiff.forEach(part => {
                const value = part.value;
                if (part.added) {
                  addedHtml += `<span class="word-added">${value}</span>`;
                } else if (part.removed) {
                  removedHtml += `<span class="word-removed">${value}</span>`;
                } else {
                  removedHtml += value;
                  addedHtml += value;
                }
              });
              result.push(['removed', removedHtml]);
              result.push(['added', addedHtml]);
            }
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
          result.push(['unchanged', originalLines[originalLineIndex]]); // Raw line
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

function normalizeLine(line) {
  return String(line).trim().replace(/\s+/g, ' ');
}

function areArraysEqual(arr1, arr2) {
  if (arr1.length !== arr2.length) return false;
  return arr1.every((item, index) => item === arr2[index]);
}

export const computeDiff = DiffComputer.compute.bind(DiffComputer);
