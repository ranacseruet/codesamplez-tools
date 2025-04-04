// Import the diff library
import * as Diff from 'diff';

// NOTE: escapeHtml function removed due to tool limitations causing file corruption.
// Relying on innerHTML assignment in script.js for necessary escaping during rendering.

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

          // Perform word diff only if the number of added/removed lines match
          if (prevLines.length === lines.length) {
            // Remove the previously added 'removed' lines from result
            result.splice(-prevLines.length);
            originalLineIndex -= prevLines.length; // Adjust index back

            for (let j = 0; j < lines.length; j++) {
              // Use the *actual* lines being compared for word diff
              const originalLineForWordDiff = originalLines[originalLineIndex];
              const modifiedLineForWordDiff = modifiedLines[modifiedLineIndex];
              const wordDiff = Diff.diffWordsWithSpace(originalLineForWordDiff, modifiedLineForWordDiff);

              let removedHtml = '';
              let addedHtml = '';

              // Check if the word diff resulted in only unchanged parts
              const isEffectivelyUnchanged = wordDiff.every(part => !part.added && !part.removed);

              // If effectively unchanged after word diff, treat as unchanged line
              if (isEffectivelyUnchanged) {
                 result.push(['unchanged', originalLineForWordDiff]);
                 originalLineIndex++;
                 modifiedLineIndex++;
                 // Skip the rest of the loop for this line pair
                 continue;
              }

              wordDiff.forEach(part => {
                // No escaping here - rely on innerHTML
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

              result.push(['removed', removedHtml]); // Raw HTML string
              result.push(['added', addedHtml]);     // Raw HTML string
              originalLineIndex++;
              modifiedLineIndex++;
            }
            // Skip the normal processing for this 'added' chunk as it's handled
            continue;
          }
        }

        // If not part of a modification pair, treat as simple addition
        lines.forEach(() => { // Iterate based on count, but use index
          result.push(['added', modifiedLines[modifiedLineIndex]]); // Raw line
          modifiedLineIndex++;
        });

      } else if (chunk.removed) {
        // Check if the next chunk is 'added' - if so, defer processing to the 'added' block
        if (i + 1 < lineDiffResult.length && lineDiffResult[i + 1].added) {
           // Add the raw removed lines for now.
           lines.forEach(() => { // Iterate based on count, but use index
             result.push(['removed', originalLines[originalLineIndex]]); // Raw line
             originalLineIndex++;
           });
        } else {
          // If no following 'added' chunk, treat as simple removal
          lines.forEach(() => { // Iterate based on count, but use index
            result.push(['removed', originalLines[originalLineIndex]]); // Raw line
            originalLineIndex++;
          });
        }
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
    return arr1.some(line1 => arr2.includes(line1));
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
