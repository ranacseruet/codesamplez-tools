// Class to handle the diff computation using Myers Diff Algorithm
class DiffComputer {
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

    // Normalize all lines upfront with whitespace setting
    const normalizedOriginal = originalLines.map(line => this.normalizeLine(line, ignoreWhitespace));
    const normalizedModified = modifiedLines.map(line => this.normalizeLine(line, ignoreWhitespace));

    if (this.areArraysEqual(normalizedOriginal, normalizedModified)) {
      return originalLines.map(line => ['unchanged', line]);
    }

    const diffTrace = this.buildGraph(normalizedOriginal, normalizedModified);
    const changes = this.backtrack(originalLines, normalizedOriginal, modifiedLines, normalizedModified, diffTrace);
    
    // Post-process changes to handle consecutive operations better
    return this.postProcessChanges(changes);
  }

  static normalizeLine(line, ignoreWhitespace = true) {
    let normalized = String(line).normalize();
    
    if (ignoreWhitespace) {
      normalized = normalized
        .replace(/>\s+</g, '><')  // Normalize HTML tags
        .replace(/\s+/g, ' ')     // Normalize multiple spaces
        .trim();                  // Trim trailing spaces
    }
    
    return normalized;
  }

  static areArraysEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    return arr1.every((item, index) => item === arr2[index]);
  }

  static buildGraph(originalLines, modifiedLines) {
    const originalLength = originalLines.length;
    const modifiedLength = modifiedLines.length;
    const maxLength = originalLength + modifiedLength;
    const distances = new Array(2 * maxLength + 1).fill(0);
    const diffTrace = [];

    for (let editDistance = 0; editDistance <= maxLength; editDistance++) {
      diffTrace.push([...distances]);
      
      for (let diagonal = -editDistance; diagonal <= editDistance; diagonal += 2) {
        let currentPosition = this.getNextPosition(diagonal, editDistance, distances, maxLength);
        let verticalPosition = currentPosition - diagonal;
        
        while (currentPosition < originalLength && 
               verticalPosition < modifiedLength && 
               originalLines[currentPosition] === modifiedLines[verticalPosition]) {
          currentPosition++;
          verticalPosition++;
        }
        
        distances[diagonal + maxLength] = currentPosition;
        
        if (currentPosition >= originalLength && verticalPosition >= modifiedLength) {
          return diffTrace;
        }
      }
    }
    return diffTrace;
  }

  static getNextPosition(diagonal, editDistance, distances, maxLength) {
    if (diagonal === -editDistance || 
        (diagonal !== editDistance && 
         distances[diagonal - 1 + maxLength] < distances[diagonal + 1 + maxLength])) {
      return distances[diagonal + 1 + maxLength];
    }
    return distances[diagonal - 1 + maxLength] + 1;
  }

  static backtrack(originalLines, normalizedOriginal, modifiedLines, normalizedModified, diffTrace) {
    const changes = [];
    let horizontalPos = originalLines.length;
    let verticalPos = modifiedLines.length;
    let traceIndex = diffTrace.length - 1;

    while (horizontalPos > 0 || verticalPos > 0) {
      if (traceIndex < 0) {
        while (horizontalPos > 0) changes.unshift(['removed', originalLines[--horizontalPos]]);
        while (verticalPos > 0) changes.unshift(['added', modifiedLines[--verticalPos]]);
        break;
      }

      const currentTrace = diffTrace[traceIndex];
      const diagonal = horizontalPos - verticalPos;
      const maxLength = originalLines.length + modifiedLines.length;
      const previousDiagonal = this.getPreviousDiagonal(diagonal, traceIndex, currentTrace, maxLength);
      
      const previousHorizontal = currentTrace[previousDiagonal + maxLength];
      const previousVertical = previousHorizontal - previousDiagonal;

      while (horizontalPos > previousHorizontal || verticalPos > previousVertical) {
        if (horizontalPos > 0 && verticalPos > 0 && 
            normalizedOriginal[horizontalPos - 1] === normalizedModified[verticalPos - 1]) {
          changes.unshift(['unchanged', originalLines[horizontalPos - 1]]);
          horizontalPos--;
          verticalPos--;
        } else if (verticalPos > previousVertical) {
          if (verticalPos > 0) {
            changes.unshift(['added', modifiedLines[verticalPos - 1]]);
          }
          verticalPos--;
        } else {
          if (horizontalPos > 0) {
            changes.unshift(['removed', originalLines[horizontalPos - 1]]);
            horizontalPos--;
          }
        }
      }

      traceIndex--;
    }

    return changes;
  }

  static postProcessChanges(changes) {
    const result = [];
    let i = 0;

    while (i < changes.length) {
      const current = changes[i];
      
      // Look ahead for patterns
      if (i + 2 < changes.length) {
        const next = changes[i + 1];
        const afterNext = changes[i + 2];

        // Pattern: unchanged-added-unchanged -> keep all unchanged
        if (current[0] === 'unchanged' && next[0] === 'added' && afterNext[0] === 'unchanged') {
          result.push(current);
          result.push(next);
          result.push(afterNext);
          i += 3;
          continue;
        }

        // Pattern: unchanged-removed-unchanged -> keep all unchanged
        if (current[0] === 'unchanged' && next[0] === 'removed' && afterNext[0] === 'unchanged') {
          result.push(current);
          result.push(next);
          result.push(afterNext);
          i += 3;
          continue;
        }
      }

      // No pattern matched, add current change
      result.push(current);
      i++;
    }

    return result;
  }

  static getPreviousDiagonal(diagonal, traceIndex, currentTrace, maxLength) {
    return diagonal === -traceIndex || 
           (diagonal !== traceIndex && 
            currentTrace[diagonal - 1 + maxLength] < currentTrace[diagonal + 1 + maxLength]) 
           ? diagonal + 1 : diagonal - 1;
  }
}

// Class to handle code detection
class CodeDetector {
  static KEYWORDS = ['function', 'const', 'let', 'var', 'import', 'export', 'class', 'return'];
  static CODE_CHARACTERS = ['{', '}', '(', ')', ';', '=', '=>', '.'];
  
  static isCode(textContent) {
    const keywordCount = this.countOccurrences(textContent, this.KEYWORDS);
    const syntaxCharCount = this.countOccurrences(textContent, this.CODE_CHARACTERS);
    return keywordCount > 2 || syntaxCharCount > 5;
  }

  static countOccurrences(textContent, searchPatterns) {
    return searchPatterns.reduce((totalCount, pattern) => 
      totalCount + (textContent.split(pattern).length - 1), 0);
  }
}

// Class to handle the diff display
class DiffDisplay {
  constructor(diffResultElement) {
    this.diffResultElement = diffResultElement;
    this.originalLineNumber = 1;
    this.modifiedLineNumber = 1;
  }

  displayDiff(diffResults, isCodeContent) {
    this.diffResultElement.innerHTML = '';
    diffResults.forEach(([changeType, lineContent]) => {
      const lineElement = this.createLineElement(changeType, lineContent, isCodeContent);
      this.diffResultElement.appendChild(lineElement);
    });
  }

  createLineElement(changeType, lineContent, isCodeContent) {
    const lineElement = document.createElement('span');
    const formattedLine = this.formatLine(lineContent, isCodeContent);
    const lineNumbers = this.createLineNumberHTML(changeType);
    
    lineElement.innerHTML = lineNumbers + formattedLine;
    lineElement.classList.add(`diff-${changeType}`);
    return lineElement;
  }

  formatLine(lineContent, isCodeContent) {
    if (!isCodeContent) return lineContent + '\n';
    
    try {
      return Prism.highlight(lineContent, Prism.languages.javascript, 'javascript') + '\n';
    } catch (error) {
      console.warn('Syntax highlighting failed:', error);
      return lineContent + '\n';
    }
  }

  createLineNumberHTML(changeType) {
    const maxDigits = Math.max(
      this.originalLineNumber.toString().length,
      this.modifiedLineNumber.toString().length
    );
    
    let lineNumbers = '';
    switch (changeType) {
      case 'added':
        lineNumbers = this.formatLineNumbers('', this.modifiedLineNumber++, maxDigits);
        break;
      case 'removed':
        lineNumbers = this.formatLineNumbers(this.originalLineNumber++, '', maxDigits);
        break;
      default:
        lineNumbers = this.formatLineNumbers(this.originalLineNumber++, this.modifiedLineNumber++, maxDigits);
    }
    return lineNumbers;
  }

  formatLineNumbers(originalNum, modifiedNum, maxDigits) {
    const originalStr = originalNum 
      ? originalNum.toString().padStart(maxDigits, ' ') 
      : ''.padStart(maxDigits, ' ');
    const modifiedStr = modifiedNum 
      ? modifiedNum.toString().padStart(maxDigits, ' ') 
      : ''.padStart(maxDigits, ' ');
    return `<span class="diff-line-number">${originalStr}│${modifiedStr}</span>`;
  }
}


// For Node.js, conditionally export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { computeDiff: DiffComputer.compute.bind(DiffComputer) };
} else {
  // Main event handler
  document.getElementById('compare-button').addEventListener('click', function () {
    const originalText = document.getElementById('text1').value;
    const modifiedText = document.getElementById('text2').value;

    const originalLines = originalText.split('\n');
    const modifiedLines = modifiedText.split('\n');

    const isCodeContent = CodeDetector.isCode(originalText) || CodeDetector.isCode(modifiedText);
    const ignoreWhitespace = document.getElementById('ignore-whitespace').checked;
    const diffResults = DiffComputer.compute(originalLines, modifiedLines, ignoreWhitespace);
    
    const diffDisplay = new DiffDisplay(document.getElementById('diff-result'));
    diffDisplay.displayDiff(diffResults, isCodeContent);
  });
}