// Class to handle the diff computation using Myers Diff Algorithm
class DiffComputer {
  static compute(originalLines, modifiedLines) {
    // Handle empty input cases
    if (originalLines.length === 0) {
      return modifiedLines.map(line => ['added', line]);
    }
    if (modifiedLines.length === 0) {
      return originalLines.map(line => ['removed', line]);
    }

    const diffTrace = this.buildGraph(originalLines, modifiedLines);
    return this.backtrack(originalLines, modifiedLines, diffTrace);
  }

  static buildGraph(originalText, modifiedText) {
    const originalLength = originalText.length;
    const modifiedLength = modifiedText.length;
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
               originalText[currentPosition] === modifiedText[verticalPosition]) {
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

  static backtrack(originalText, modifiedText, diffTrace) {
    const originalLength = originalText.length;
    const modifiedLength = modifiedText.length;
    const maxLength = originalLength + modifiedLength;
    let horizontalPos = originalLength;
    let verticalPos = modifiedLength;
    
    const diffPath = [];
    let traceIndex = diffTrace.length - 1;
    
    // Process unchanged lines at the end
    while (horizontalPos > 0 && verticalPos > 0 && 
           originalText[horizontalPos - 1] === modifiedText[verticalPos - 1]) {
      diffPath.unshift(['unchanged', originalText[horizontalPos - 1]]);
      horizontalPos--;
      verticalPos--;
    }
    
    while (traceIndex >= 0) {
      const currentTrace = diffTrace[traceIndex];
      const diagonal = horizontalPos - verticalPos;
      const previousDiagonal = this.getPreviousDiagonal(diagonal, traceIndex, currentTrace, maxLength);
      
      const previousHorizontal = currentTrace[previousDiagonal + maxLength];
      const previousVertical = previousHorizontal - previousDiagonal;
      
      while (horizontalPos > previousHorizontal && verticalPos > previousVertical) {
        diffPath.unshift(['unchanged', originalText[horizontalPos - 1]]);
        horizontalPos--;
        verticalPos--;
      }
      
      if (traceIndex > 0) {
        if (horizontalPos === previousHorizontal) {
          diffPath.unshift(['added', modifiedText[verticalPos - 1]]);
          verticalPos--;
        } else {
          diffPath.unshift(['removed', originalText[horizontalPos - 1]]);
          horizontalPos--;
        }
      }
      
      traceIndex--;
    }
    
    return diffPath;
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
    return isCodeContent 
      ? Prism.highlight(lineContent, Prism.languages.javascript, 'javascript') + '\n'
      : lineContent + '\n';
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

// Main event handler
document.getElementById('compare-button').addEventListener('click', function () {
  const originalText = document.getElementById('text1').value;
  const modifiedText = document.getElementById('text2').value;

  const originalLines = originalText.split('\n');
  const modifiedLines = modifiedText.split('\n');

  const isCodeContent = CodeDetector.isCode(originalText) || CodeDetector.isCode(modifiedText);
  const diffResults = DiffComputer.compute(originalLines, modifiedLines);
  
  const diffDisplay = new DiffDisplay(document.getElementById('diff-result'));
  diffDisplay.displayDiff(diffResults, isCodeContent);
});

// Expose for testing
window.computeDiff = DiffComputer.compute.bind(DiffComputer);
