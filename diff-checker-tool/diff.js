// Import the diff library
import * as Diff from 'diff';

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
      return modifiedLines.map(line => ['added', line]);
    }
    if (modifiedLines.length === 0) {
      return originalLines.map(line => ['removed', line]);
    }

    // If ignoring whitespace, use normalized versions for comparison
    const compareOriginal = ignoreWhitespace
      ? originalLines.map(line => normalizeLine(line))
      : originalLines;
    const compareModified = ignoreWhitespace
      ? modifiedLines.map(line => normalizeLine(line))
      : modifiedLines;

    // Handle identical content
    if (areArraysEqual(compareOriginal, compareModified)) {
      return originalLines.map(line => ['unchanged', line]);
    }

    // Handle completely different content when not ignoring whitespace
    if (!ignoreWhitespace && !DiffComputer.hasAnyMatch(originalLines, modifiedLines)) {
      return [
        ...originalLines.map(line => ['removed', line]),
        ...modifiedLines.map(line => ['added', line])
      ];
    }

    // Get diff chunks using the library
    const diffResult = Diff.diffLines(
      originalLines.join('\n'),
      modifiedLines.join('\n'),
      { ignoreWhitespace }
    );

    // Convert chunks to our format and track positions
    const changes = [];
    let origLine = 0;
    let modLine = 0;

    diffResult.forEach(chunk => {
      const lines = chunk.value.split('\n');
      // Remove trailing empty line from split
      if (lines[lines.length - 1] === '') lines.pop();

      if (chunk.removed) {
        lines.forEach(line => {
          changes.push({
            type: 'removed',
            line: originalLines[origLine],
            origPos: origLine++
          });
        });
      } else if (chunk.added) {
        lines.forEach(line => {
          changes.push({
            type: 'added',
            line: modifiedLines[modLine],
            modPos: modLine++
          });
        });
      } else {
        lines.forEach(line => {
          changes.push({
            type: 'unchanged',
            line: originalLines[origLine]
          });
          origLine++;
          modLine++;
        });
      }
    });

    // Group changes by context
    const groups = [];
    let currentGroup = [];
    let lastType = null;

    changes.forEach(change => {
      if (change.type === 'unchanged') {
        if (currentGroup.length > 0) {
          groups.push([...currentGroup]);
          currentGroup = [];
        }
        groups.push([change]);
        lastType = 'unchanged';
      } else {
        if (lastType === 'unchanged') {
          currentGroup = [];
        }
        currentGroup.push(change);
        lastType = change.type;
      }
    });

    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    // Process groups in order
    const result = [];
    groups.forEach(group => {
      if (group.length === 1 && group[0].type === 'unchanged') {
        result.push(['unchanged', group[0].line]);
      } else {
        // First add removals, then all additions
        group.filter(c => c.type === 'removed')
          .forEach(c => result.push(['removed', c.line]));
        group.filter(c => c.type === 'added')
          .forEach(c => result.push(['added', c.line]));
      }
    });

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
