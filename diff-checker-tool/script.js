// Import diff computation from separate module
import { computeDiff } from './diff';

// Class to detect if content is code (used for syntax highlighting)
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

  // Updated createLineElement to separate line number and content spans
  createLineElement(changeType, lineContent, isCodeContent) {
    const lineContainer = document.createElement('div'); // Use div for block display per line
    const lineNumberElement = document.createElement('span');
    const contentElement = document.createElement('span');

    const formattedLine = this.formatLine(lineContent, isCodeContent);
    // Get the raw text content for the line number span
    const lineNumbersContent = this.getLineNumberText(changeType); 

    lineNumberElement.className = 'diff-line-number'; // Apply class directly
    lineNumberElement.textContent = lineNumbersContent; // Set text content

    contentElement.innerHTML = formattedLine; // Use innerHTML for potentially highlighted code
    contentElement.classList.add('diff-content'); // Add class for content span
    // Apply specific diff class only to the content span
    if (changeType !== 'unchanged') {
      contentElement.classList.add(`diff-${changeType}`);
    }

    lineContainer.appendChild(lineNumberElement); // Add line number span to container
    lineContainer.appendChild(contentElement); // Add content span to container
    lineContainer.classList.add('diff-line'); // Add class for the container div

    return lineContainer;
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
    // Return only the text content, not the span tag
    return `${originalStr}│${modifiedStr}`; 
  }

  // Renamed from createLineNumberHTML to getLineNumberText to reflect it returns text
  getLineNumberText(changeType) {
    // Ensure minimum width for alignment, calculate max digits needed
    // This calculation might need refinement based on total lines, but is a start
    const maxDigits = Math.max(
      this.originalLineNumber.toString().length,
      this.modifiedLineNumber.toString().length,
      3 // Ensure a minimum width visually
    );

    let lineNumbersContent = '';
    switch (changeType) {
      case 'added':
        lineNumbersContent = this.formatLineNumbers('', this.modifiedLineNumber++, maxDigits);
        break;
      case 'removed':
        lineNumbersContent = this.formatLineNumbers(this.originalLineNumber++, '', maxDigits);
        break;
      default: // unchanged
        lineNumbersContent = this.formatLineNumbers(this.originalLineNumber++, this.modifiedLineNumber++, maxDigits);
    }
    return lineNumbersContent;
  }
}

// Notification handler
class NotificationManager {
  static show(message, duration = 2000) {
    const notification = document.getElementById('notification');
    if (!notification) return;
    
    notification.textContent = message;
    notification.classList.add('show');
    
    setTimeout(() => {
      notification.classList.remove('show');
    }, duration);
  }
}

// Class to handle diff navigation
class DiffNavigator {
  constructor(resultElement, prevButton, nextButton, counterElement) {
    this.resultElement = resultElement;
    this.prevButton = prevButton;
    this.nextButton = nextButton;
    this.counterElement = counterElement;
    this.diffElements = [];
    this.currentDiffIndex = -1;

    this._bindEvents();
  }

  _bindEvents() {
    if (this.prevButton) {
      this.prevButton.addEventListener('click', () => this.navigateToPrevious());
    }
    if (this.nextButton) {
      this.nextButton.addEventListener('click', () => this.navigateToNext());
    }
  }

  updateDiffElements() {
    // Find all diff lines after rendering
    this.diffElements = Array.from(
      this.resultElement.querySelectorAll('.diff-line:has(.diff-added), .diff-line:has(.diff-removed)')
    );
    this.reset();
  }

  reset() {
     // Remove any existing highlight
    this.resultElement.querySelectorAll('.current-diff').forEach(el => el.classList.remove('current-diff'));
    this.currentDiffIndex = -1;
    this.updateNavigationState();
  }

  updateNavigationState() {
    const totalDiffs = this.diffElements.length;

    if (!this.counterElement || !this.prevButton || !this.nextButton) return;

    if (totalDiffs === 0) {
      this.counterElement.textContent = '0 of 0';
      this.prevButton.disabled = true;
      this.nextButton.disabled = true;
      return;
    }

    // Display 1-based index for user
    this.counterElement.textContent = `${this.currentDiffIndex + 1} of ${totalDiffs}`;
    this.prevButton.disabled = this.currentDiffIndex <= 0;
    this.nextButton.disabled = this.currentDiffIndex >= totalDiffs - 1;
  }

  navigateToIndex(index) {
    if (index < 0 || index >= this.diffElements.length) {
      return; // Invalid index
    }

    // Remove highlight from the previous diff
    if (this.currentDiffIndex !== -1 && this.diffElements[this.currentDiffIndex]) {
      this.diffElements[this.currentDiffIndex].classList.remove('current-diff');
    }

    this.currentDiffIndex = index;

    // Add highlight to the current diff
    const currentElement = this.diffElements[this.currentDiffIndex];
    if (currentElement) {
      currentElement.classList.add('current-diff');
      // Scroll into view
      currentElement.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest'
      });
    }

    this.updateNavigationState();
  }

  navigateToPrevious() {
    if (this.currentDiffIndex > 0) {
      this.navigateToIndex(this.currentDiffIndex - 1);
    }
  }

  navigateToNext() {
    if (this.currentDiffIndex < this.diffElements.length - 1) {
      this.navigateToIndex(this.currentDiffIndex + 1);
    }
  }
}


// Main event handler
if (typeof document !== 'undefined') {
  const compareButton = document.getElementById('compare-button');
  const text1 = document.getElementById('text1');
  const text2 = document.getElementById('text2');
  const clearText1Button = document.getElementById('clear-text1');
  const clearText2Button = document.getElementById('clear-text2');
  const diffResultElement = document.getElementById('diff-result');

  // Instantiate the navigator
  const diffNavigator = new DiffNavigator(
    diffResultElement,
    document.getElementById('prev-diff-button'),
    document.getElementById('next-diff-button'),
    document.getElementById('diff-counter')
  );

  // Clear buttons functionality
  if (clearText1Button && text1) {
    clearText1Button.addEventListener('click', function() {
      text1.value = '';
      text1.focus();
    });
  }
  
  if (clearText2Button && text2) {
    clearText2Button.addEventListener('click', function() {
      text2.value = '';
      text2.focus();
    });
  }
  
  if (compareButton && text1 && text2) {
    compareButton.addEventListener('click', function () {
      const originalText = text1.value;
      const modifiedText = text2.value;
      
      if (!originalText && !modifiedText) {
        NotificationManager.show('Please enter text in at least one of the fields');
        return;
      }

      const originalLines = originalText.split('\n');
      const modifiedLines = modifiedText.split('\n');

      const isCodeContent = CodeDetector.isCode(originalText) || CodeDetector.isCode(modifiedText);
      const ignoreWhitespace = document.getElementById('ignore-whitespace').checked;
      const diffResults = computeDiff(originalLines, modifiedLines, ignoreWhitespace);

      const diffDisplay = new DiffDisplay(diffResultElement);
      diffDisplay.displayDiff(diffResults, isCodeContent);

      // Update the navigator with the new diff elements
      diffNavigator.updateDiffElements();

    });
  }
}

// Export classes/functions needed for testing or potentially other modules
export { computeDiff, DiffDisplay, DiffNavigator };
