import { DiffDisplay, DiffNavigator, CodeDetector, initializeDiffChecker } from './script';
import { waitFor } from '@testing-library/dom';
import { NotificationManager } from '../common/notification-manager';
import { scheduleTask } from '../common/scheduler-utils';
import ClearButton from '../common/clear-button/ClearButton';
import { fireFileDragEvent, fireFileDrop, flushFileDrop } from '../common/drop-zone-test-utils';
import { buildShareHash, parseShareHash } from './share-url';

const mockDownloadManagerInstances = [];

// Mock NotificationManager
jest.mock('../common/notification-manager', () => ({
  NotificationManager: {
    show: jest.fn()
  }
}));

// Mock scheduler
jest.mock('../common/scheduler-utils', () => ({
  scheduleTask: jest.fn().mockResolvedValue()
}));

// Mock ClearButton
jest.mock('../common/clear-button/ClearButton', () => {
  return jest.fn().mockImplementation(() => ({
    disconnect: jest.fn(),
    updateVisibility: jest.fn()
  }));
});

jest.mock('../common/DownloadManager', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => {
    const instance = { downloadFile: jest.fn() };
    mockDownloadManagerInstances.push(instance);
    return instance;
  })
}));

// Removed global document.createElement mock

describe('DiffDisplay', () => {
  let mockElement;
  let diffDisplay;

  beforeEach(() => {
    // Mock DOM element
    mockElement = {
      innerHTML: '',
      appendChild: jest.fn()
    };
    diffDisplay = new DiffDisplay(mockElement);
  });

  describe('constructor', () => {
    it('should initialize with correct properties', () => {
      expect(diffDisplay.diffResultElement).toBe(mockElement);
      expect(diffDisplay.originalLineNumber).toBe(1);
      expect(diffDisplay.modifiedLineNumber).toBe(1);
    });
  });

  describe('displayDiff', () => {
    it('should clear the element and display diff results', () => {
      const diffResults = [
        ['added', 'new line'],
        ['removed', 'old line'],
        ['unchanged', 'same line']
      ];

      diffDisplay.displayDiff(diffResults, false);

      expect(mockElement.innerHTML).toBe('');
      // Check that appendChild was called for each result
      expect(mockElement.appendChild).toHaveBeenCalledTimes(diffResults.length);
      // Check that the first appended child is a div (our line container) - use toLowerCase() for robustness
      expect(mockElement.appendChild.mock.calls[0][0].tagName.toLowerCase()).toBe('div');
    });
  });

  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      const html = '<div class="test">Hello & goodbye</div>';
      const expected = '&lt;div class=&quot;test&quot;&gt;Hello &amp; goodbye&lt;/div&gt;';
      expect(diffDisplay.escapeHtml(html)).toBe(expected);
    });

    it('should handle empty string', () => {
      expect(diffDisplay.escapeHtml('')).toBe('');
    });

    it('should handle string with no HTML', () => {
      const text = 'Hello world';
      expect(diffDisplay.escapeHtml(text)).toBe(text);
    });
  });

  describe('escapeHtmlPreserveDiff', () => {
    it('should preserve word-level diff spans while escaping other HTML', () => {
      const html = '<div>Hello <span class="word-removed">world</span> & <span class="word-added">earth</span></div>';
      const expected = '&lt;div&gt;Hello <span class="word-removed">world</span> &amp; <span class="word-added">earth</span>&lt;/div&gt;';
      expect(diffDisplay.escapeHtmlPreserveDiff(html)).toBe(expected);
    });

    it('should escape all HTML if no word-level diff spans present', () => {
      const html = '<div>Hello world</div>';
      const expected = '&lt;div&gt;Hello world&lt;/div&gt;';
      expect(diffDisplay.escapeHtmlPreserveDiff(html)).toBe(expected);
    });

    it('should handle empty string', () => {
      expect(diffDisplay.escapeHtmlPreserveDiff('')).toBe('');
    });

    it('should handle string with only word-level diff spans', () => {
      const html = '<span class="word-removed">Hello</span><span class="word-added">world</span>';
      expect(diffDisplay.escapeHtmlPreserveDiff(html)).toBe(html);
    });

    it('should escape HTML inside word-level diff spans', () => {
      const html = '<span class="word-added"><div id="app-shell-footer"></div></span>';
      const expected = '<span class="word-added">&lt;div id=&quot;app-shell-footer&quot;&gt;&lt;/div&gt;</span>';
      expect(diffDisplay.escapeHtmlPreserveDiff(html)).toBe(expected);
    });
  });

  describe('createLineElement', () => {
    // Test HTML escaping in createLineElement

    it('should create a div container with correct class', () => {
      const lineContainer = diffDisplay.createLineElement('unchanged', 'test', false);
      expect(lineContainer.tagName.toLowerCase()).toBe('div');
      expect(lineContainer.classList.contains('diff-line')).toBe(true);
    });

    it('should create line number and content spans as children', () => {
      const lineContainer = diffDisplay.createLineElement('unchanged', 'test', false);
      expect(lineContainer.children.length).toBe(2);
      const lineNumberSpan = lineContainer.children[0];
      const contentSpan = lineContainer.children[1];
      expect(lineNumberSpan.tagName.toLowerCase()).toBe('span');
      expect(lineNumberSpan.classList.contains('diff-line-number')).toBe(true);
      expect(contentSpan.tagName.toLowerCase()).toBe('span');
      expect(contentSpan.classList.contains('diff-content')).toBe(true);
    });

    it('should create ins element for added line', () => {
      const lineContainer = diffDisplay.createLineElement('added', 'test line', false);
      const contentElement = lineContainer.children[1];
      expect(contentElement.tagName.toLowerCase()).toBe('ins');
      expect(contentElement.classList.contains('diff-content')).toBe(true);
      expect(contentElement.classList.contains('diff-added')).toBe(true);
      expect(contentElement.innerHTML).toContain('test line');
    });

    it('should create del element for removed line', () => {
      const lineContainer = diffDisplay.createLineElement('removed', 'test line', false);
      const contentElement = lineContainer.children[1];
      expect(contentElement.tagName.toLowerCase()).toBe('del');
      expect(contentElement.classList.contains('diff-content')).toBe(true);
      expect(contentElement.classList.contains('diff-removed')).toBe(true);
      expect(contentElement.innerHTML).toContain('test line');
    });

    it('should only apply base class to content span for unchanged line', () => {
      const lineContainer = diffDisplay.createLineElement('unchanged', 'test line', false);
      const contentSpan = lineContainer.children[1];
      expect(contentSpan.classList.contains('diff-content')).toBe(true);
      expect(contentSpan.classList.contains('diff-added')).toBe(false);
      expect(contentSpan.classList.contains('diff-removed')).toBe(false);
      expect(contentSpan.innerHTML).toContain('test line');
    });

    it('should display HTML as text for regular lines', () => {
      const lineContainer = diffDisplay.createLineElement('unchanged', '<h1>Hello</h1>', false);
      const contentSpan = lineContainer.children[1];
      expect(contentSpan.textContent).toBe('<h1>Hello</h1>\n');
    });

    it('should preserve word-level diff spans while escaping other HTML', () => {
      const htmlWithDiff = '<div>Hello <span class="word-removed">world</span></div>';
      const lineContainer = diffDisplay.createLineElement('removed', htmlWithDiff, false);
      const contentSpan = lineContainer.children[1];
      expect(contentSpan.innerHTML).toBe('&lt;div&gt;Hello <span class="word-removed">world</span>&lt;/div&gt;\n');
    });

    it('should render HTML inside word-level added spans as text, not live elements', () => {
      const footerAsWordAdded = '<span class="word-added"><div id="app-shell-footer"></div></span>';
      const lineContainer = diffDisplay.createLineElement('added', footerAsWordAdded, false);
      const contentElement = lineContainer.children[1];

      expect(contentElement.innerHTML).toBe(
        '<span class="word-added">&lt;div id="app-shell-footer"&gt;&lt;/div&gt;</span>\n'
      );
      expect(contentElement.textContent).toBe('<div id=\"app-shell-footer\"></div>\n');
      expect(contentElement.querySelector('#app-shell-footer')).toBeNull();
    });

    it('should include correct line numbers text in the line number span', () => {
      // Reset line numbers for this specific test
      diffDisplay.originalLineNumber = 1;
      diffDisplay.modifiedLineNumber = 1;
      const lineContainer = diffDisplay.createLineElement('unchanged', 'test', false);
      const lineNumberSpan = lineContainer.children[0];
      // Based on maxDigits being 3 in this case (Math.max(1, 1, 3))
      expect(lineNumberSpan.textContent).toBe('  1│  1');
    });
  });

  describe('formatLine', () => {
    it('should return plain text for non-code content', () => {
      const result = diffDisplay.formatLine('test line', false);
      expect(result).toBe('test line\n');
    });

    it('should attempt syntax highlighting for code content', () => {
      // Mock Prism for this test
      global.Prism = {
        highlight: jest.fn().mockReturnValue('highlighted'),
        languages: { javascript: {} }
      };

      // Pass 'unchanged' as changeType to trigger highlighting attempt
      const result = diffDisplay.formatLine('const x = 1;', true, 'unchanged');
      expect(result).toBe('highlighted\n');
      expect(Prism.highlight).toHaveBeenCalledWith('const x = 1;', Prism.languages.javascript, 'javascript');
    });

    it('should fall back to plain text if highlighting fails', () => {
      global.Prism = {
        highlight: jest.fn().mockImplementation(() => { throw new Error(); }),
        languages: { javascript: {} }
      };

      // Pass 'unchanged' as changeType to trigger highlighting attempt
      const result = diffDisplay.formatLine('const x = 1;', true, 'unchanged');
      expect(result).toBe('const x = 1;\n');
    });

    it('should fall back to escaped HTML and log a warning if Prism or javascript language is missing', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      global.Prism = {
        languages: {}
      };

      const result = diffDisplay.formatLine('const <x> = 1;', true, 'unchanged');
      expect(result).toBe('const &lt;x&gt; = 1;\n');
      expect(consoleWarnSpy).toHaveBeenCalledWith('Prism.js or javascript language not available. Falling back to escaped HTML.');

      consoleWarnSpy.mockRestore();
    });

    it('renders carriage returns as visible markers', () => {
      const result = diffDisplay.formatLine('first\r', false, 'removed');

      expect(result).toBe('first␍\n');
      expect(result).not.toContain('\r');
    });
  });

  // Rename describe block and test calls
  describe('getLineNumberText', () => {
    it('should increment modified line number for added lines', () => {
      diffDisplay.getLineNumberText('added'); // Call new method name
      expect(diffDisplay.modifiedLineNumber).toBe(2);
      expect(diffDisplay.originalLineNumber).toBe(1);
    });

    it('should increment original line number for removed lines', () => {
      diffDisplay.getLineNumberText('removed'); // Call new method name
      expect(diffDisplay.originalLineNumber).toBe(2);
      expect(diffDisplay.modifiedLineNumber).toBe(1);
    });

    it('should increment both numbers for unchanged lines', () => {
      diffDisplay.getLineNumberText('unchanged'); // Call new method name
      expect(diffDisplay.originalLineNumber).toBe(2);
      expect(diffDisplay.modifiedLineNumber).toBe(2);
    });
  });

  describe('formatLineNumbers', () => {
    // Update expected values to be just the string, not the span
    it('should format numbers with equal padding', () => {
      const result = diffDisplay.formatLineNumbers(1, 1, 2);
      expect(result).toBe(' 1│ 1'); // Removed span wrapper
    });

    it('should handle empty original number', () => {
      const result = diffDisplay.formatLineNumbers('', 1, 2);
      expect(result).toBe('  │ 1'); // Removed span wrapper
    });

    it('should handle empty modified number', () => {
      const result = diffDisplay.formatLineNumbers(1, '', 2);
      expect(result).toBe(' 1│  '); // Removed span wrapper
    });
  });

  describe('createLineNumberHTML', () => {
    beforeEach(() => {
      // Reset line numbers before each test
      diffDisplay.originalLineNumber = 1;
      diffDisplay.modifiedLineNumber = 1;
    });

    it('should increment modified line number for added lines', () => {
      const result = diffDisplay.createLineNumberHTML('added');
      expect(diffDisplay.modifiedLineNumber).toBe(2);
      expect(diffDisplay.originalLineNumber).toBe(1);
      expect(result).toBe(' │1');
    });

    it('should increment original line number for removed lines', () => {
      const result = diffDisplay.createLineNumberHTML('removed');
      expect(diffDisplay.originalLineNumber).toBe(2);
      expect(diffDisplay.modifiedLineNumber).toBe(1);
      expect(result).toBe('1│ ');
    });

    it('should increment both numbers for unchanged lines', () => {
      const result = diffDisplay.createLineNumberHTML('unchanged');
      expect(diffDisplay.originalLineNumber).toBe(2);
      expect(diffDisplay.modifiedLineNumber).toBe(2);
      expect(result).toBe('1│1');
    });

    it('should handle different digit lengths correctly', () => {
      diffDisplay.originalLineNumber = 9;
      diffDisplay.modifiedLineNumber = 99;

      const result = diffDisplay.createLineNumberHTML('unchanged');
      expect(result).toBe(' 9│99');
    });

    it('should not enforce minimum width padding', () => {
      const result = diffDisplay.createLineNumberHTML('unchanged');
      expect(result).toBe('1│1');
    });
  });
});

// --- Tests for Navigation ---
describe('DiffNavigator', () => { // Test the class directly
  let diffResultElement, prevButton, nextButton, counter, navigator;

  // Helper to create a REAL JSDOM diff line element for testing
  const createRealDiffLine = (doc, type = 'unchanged') => {
    const lineDiv = doc.createElement('div');
    lineDiv.classList.add('diff-line');
    lineDiv.scrollIntoView = jest.fn(); // Still mock scrollIntoView

    const contentSpan = doc.createElement('span');
    contentSpan.classList.add('diff-content');
    if (type === 'added' || type === 'removed') {
      contentSpan.classList.add(`diff-${type}`);
    }
    lineDiv.appendChild(contentSpan);
    // Store type for easier querying in tests if needed, using setAttribute for JSDOM compatibility
    lineDiv.setAttribute('data-diff-type', type);

    return lineDiv;
  };


  beforeEach(() => {
    // No need to mock document.createElement here, rely on JSDOM's implementation
    // Set up basic HTML structure in JSDOM
    document.body.innerHTML = `
      <div id="diff-result"></div>
      <button id="prev-diff-button" disabled></button>
      <span id="diff-counter">0 of 0</span>
      <button id="next-diff-button" disabled></button>
    `;

    // Get references to REAL JSDOM elements
    diffResultElement = document.getElementById('diff-result'); // This is a JSDOM element
    prevButton = document.getElementById('prev-diff-button');
    nextButton = document.getElementById('next-diff-button');
    counter = document.getElementById('diff-counter');

    // Instantiate the navigator with real JSDOM elements
    navigator = new DiffNavigator(diffResultElement, prevButton, nextButton, counter);
    // Spy on methods AFTER instantiation
    // No need to spy on updateNavigationState/reset as they are internal calls triggered by others
    jest.spyOn(navigator, 'navigateToIndex'); // Still useful to spy on this

  });

  // Helper function to set up REAL diff lines in the JSDOM
  const setupRealDiffLines = (lineTypes) => {
    diffResultElement.innerHTML = ''; // Clear previous
    lineTypes.forEach(type => {
      const lineElement = createRealDiffLine(document, type); // Create real JSDOM element
      diffResultElement.appendChild(lineElement); // Append real element
    });
    // Manually tell the navigator to update its internal list based on the real DOM
    navigator.updateDiffElements();
  };


  it('should initialize with navigation disabled and counter at 0', () => {
    // Constructor calls _bindEvents, updateDiffElements calls reset -> updateNavigationState
    // So initial state should be set correctly after instantiation.
    expect(prevButton.disabled).toBe(true);
    expect(nextButton.disabled).toBe(true);
    expect(counter.textContent).toBe('0 of 0');
  });

  it('should keep navigation disabled if no differences are found after update', () => {
    setupRealDiffLines([]); // No diff lines
    // updateDiffElements calls reset -> updateNavigationState internally
    expect(navigator.diffElements.length).toBe(0);
    expect(prevButton.disabled).toBe(true);
    expect(nextButton.disabled).toBe(true);
    expect(counter.textContent).toBe('0 of 0');
  });

  it('should enable navigation and update counter correctly when differences are found', () => {
    const lineTypes = ['added', 'unchanged', 'removed'];
    setupRealDiffLines(lineTypes);

    expect(navigator.diffElements.length).toBe(2);
    // Initial state after updateDiffElements (index is -1)
    expect(navigator.currentDiffIndex).toBe(-1);
    expect(prevButton.disabled).toBe(true);
    expect(nextButton.disabled).toBe(false); // Can go next from index -1
    expect(counter.textContent).toBe('0 of 2'); // Shows 0 because index is -1
  });

  it('should navigate to the next difference on "Next" button click', () => {
    const lineTypes = ['added', 'unchanged', 'removed'];
    setupRealDiffLines(lineTypes);
    const addedLine = diffResultElement.children[0]; // The actual JSDOM node
    const removedLine = diffResultElement.children[2]; // The actual JSDOM node

    // Simulate clicking Next button (calls navigator.navigateToNext)
    nextButton.click();

    // Check state after first click
    expect(navigator.navigateToIndex).toHaveBeenCalledWith(0); // Should navigate to index 0
    expect(navigator.currentDiffIndex).toBe(0);
    expect(addedLine.classList.contains('current-diff-single')).toBe(true); // added line is highlighted
    expect(addedLine.scrollIntoView).toHaveBeenCalled();
    expect(counter.textContent).toBe('1 of 2');
    expect(prevButton.disabled).toBe(true);
    expect(nextButton.disabled).toBe(false);

    // Simulate clicking Next button again
    nextButton.click();

    // Check state after second click
    expect(navigator.navigateToIndex).toHaveBeenCalledWith(1); // Should navigate to index 1
    expect(navigator.currentDiffIndex).toBe(1);
    expect(addedLine.classList.contains('current-diff-single')).toBe(false); // Highlight removed
    expect(removedLine.classList.contains('current-diff-single')).toBe(true); // removed line is highlighted
    expect(removedLine.scrollIntoView).toHaveBeenCalled();
    expect(counter.textContent).toBe('2 of 2');
    expect(prevButton.disabled).toBe(false);
    expect(nextButton.disabled).toBe(true); // At the end
  });

  it('should navigate to the previous difference on "Prev" button click', () => {
    const lineTypes = ['added', 'unchanged', 'removed'];
    setupRealDiffLines(lineTypes);
    const addedLine = diffResultElement.children[0];
    const removedLine = diffResultElement.children[2];
    navigator.navigateToIndex(1); // Manually set index to the end

    // Check initial state (at the end)
    expect(navigator.currentDiffIndex).toBe(1);
    expect(removedLine.classList.contains('current-diff-single')).toBe(true);
    expect(counter.textContent).toBe('2 of 2');
    expect(prevButton.disabled).toBe(false);
    expect(nextButton.disabled).toBe(true);

    // Simulate clicking Prev button
    prevButton.click();

    // Check state after first click
    expect(navigator.navigateToIndex).toHaveBeenCalledWith(0); // Should navigate to index 0
    expect(navigator.currentDiffIndex).toBe(0);
    expect(removedLine.classList.contains('current-diff-single')).toBe(false); // Highlight removed
    expect(addedLine.classList.contains('current-diff-single')).toBe(true); // added line is highlighted
    expect(addedLine.scrollIntoView).toHaveBeenCalled();
    expect(counter.textContent).toBe('1 of 2');
    expect(prevButton.disabled).toBe(true); // At the start
    expect(nextButton.disabled).toBe(false);
  });

  it('should not navigate past the first or last difference', () => {
    const lineTypes = ['added', 'unchanged', 'removed'];
    setupRealDiffLines(lineTypes);
    navigator.navigateToIndex(0); // Go to first

    // Check state at first diff
    expect(navigator.currentDiffIndex).toBe(0);
    expect(prevButton.disabled).toBe(true);

    // Simulate clicking Prev button (should do nothing)
    prevButton.click();
    // navigateToIndex should have been called once for the initial setup
    expect(navigator.navigateToIndex).toHaveBeenCalledTimes(1);
    expect(navigator.currentDiffIndex).toBe(0); // Still at index 0
    expect(counter.textContent).toBe('1 of 2');
    expect(prevButton.disabled).toBe(true);

    navigator.navigateToIndex(1); // Go to last
    expect(navigator.currentDiffIndex).toBe(1);
    expect(nextButton.disabled).toBe(true);

    // Simulate clicking Next button (should do nothing)
    nextButton.click();
    // navigateToIndex should have been called twice now (initial + manual navToIndex(1))
    expect(navigator.navigateToIndex).toHaveBeenCalledTimes(2);
    expect(navigator.currentDiffIndex).toBe(1); // Still at index 1
    expect(counter.textContent).toBe('2 of 2');
    expect(nextButton.disabled).toBe(true);
  });

  it('should reset navigation state on re-compare', () => {
    const lineTypes1 = ['added'];
    setupRealDiffLines(lineTypes1);
    const firstAddedLine = diffResultElement.children[0];
    navigator.navigateToIndex(0); // Navigate to the first diff

    // Check initial state
    expect(navigator.currentDiffIndex).toBe(0);
    expect(counter.textContent).toBe('1 of 1');
    expect(firstAddedLine.classList.contains('current-diff-single')).toBe(true);

    // Simulate comparing again by setting up new lines
    const lineTypes2 = ['removed', 'unchanged', 'added'];
    setupRealDiffLines(lineTypes2); // This calls updateDiffElements -> reset -> updateNavigationState

    // Check reset state
    expect(navigator.currentDiffIndex).toBe(-1); // Index reset
    expect(counter.textContent).toBe('0 of 2'); // Counter reset (index -1)
    expect(prevButton.disabled).toBe(true);
    expect(nextButton.disabled).toBe(false); // Can go next
    // Check that previous highlight is gone (mock check)
    // We can't easily check the *old* element's classList.remove mock here
    // Instead, check that no elements currently have the highlight
    const highlighted = diffResultElement.querySelectorAll('.current-diff-single, .current-diff-start, .current-diff-middle, .current-diff-end');
    expect(highlighted.length).toBe(0);
  });

  it('should highlight multi-line blocks correctly', () => {
    const lineTypes = ['added', 'removed', 'unchanged', 'added'];
    setupRealDiffLines(lineTypes);
    // This should create two blocks: [added, removed] and [added]

    expect(navigator.diffElements.length).toBe(2);
    expect(navigator.diffElements[0].length).toBe(2); // First block has 2 lines
    expect(navigator.diffElements[1].length).toBe(1); // Second block has 1 line

    navigator.navigateToIndex(0); // Navigate to first block

    const firstBlockLines = navigator.diffElements[0];
    expect(firstBlockLines[0].classList.contains('current-diff-start')).toBe(true);
    expect(firstBlockLines[1].classList.contains('current-diff-end')).toBe(true);
    expect(counter.textContent).toBe('1 of 2');

    navigator.navigateToIndex(1); // Navigate to second block

    const secondBlockLines = navigator.diffElements[1];
    expect(firstBlockLines[0].classList.contains('current-diff-start')).toBe(false);
    expect(firstBlockLines[1].classList.contains('current-diff-end')).toBe(false);
    expect(secondBlockLines[0].classList.contains('current-diff-single')).toBe(true);
    expect(counter.textContent).toBe('2 of 2');
  });

  it('ignores navigation when target index is out of bounds', () => {
    setupRealDiffLines(['added', 'unchanged', 'removed']);
    navigator.navigateToIndex(-1);
    expect(navigator.currentDiffIndex).toBe(-1);

    navigator.navigateToIndex(99);
    expect(navigator.currentDiffIndex).toBe(-1);
  });

  it('adds current-diff-middle class to intermediate lines in a consecutive diff block with 3 or more lines', () => {
    setupRealDiffLines(['added', 'added', 'added']);
    expect(navigator.diffElements.length).toBe(1);
    expect(navigator.diffElements[0].length).toBe(3);

    navigator.navigateToIndex(0);

    const block = navigator.diffElements[0];
    expect(block[0].classList.contains('current-diff-start')).toBe(true);
    expect(block[1].classList.contains('current-diff-middle')).toBe(true);
    expect(block[2].classList.contains('current-diff-end')).toBe(true);
  });
});


describe('CodeDetector', () => {
  test('should detect JavaScript code keywords', () => {
    const code = 'function test() { const a = 1; return a; }';
    expect(CodeDetector.isCode(code)).toBe(true);
  });

  test('should detect code syntax characters', () => {
    const code = '{ a: 1, b: 2 }; [1, 2, 3];';
    expect(CodeDetector.isCode(code)).toBe(true);
  });

  test('should not detect plain text as code', () => {
    const text = 'This is just some plain text with no code symbols.';
    expect(CodeDetector.isCode(text)).toBe(false);
  });
});

describe('initializeDiffChecker', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    container.innerHTML = `
      <textarea id="text1"></textarea>
      <textarea id="text2"></textarea>
      <button id="load-sample">Load Sample</button>
      <button id="compare-button">Compare</button>
      <div id="diff-error-status" aria-live="polite"></div>
      <div id="diff-empty-state"></div>
      <div id="diff-result"></div>
      <button id="prev-diff-button"></button>
      <button id="next-diff-button"></button>
      <span id="diff-counter"></span>
      <input type="checkbox" id="ignore-whitespace">
      <button id="diff-share-button">Share</button>
      <button id="download-patch-button" disabled>Download .patch</button>
    `;
    document.body.appendChild(container); // Using JSDOM document
    // initializeDiffChecker reads window.location for a share payload, so the
    // hash has to be clean unless a spec sets one deliberately.
    window.location.hash = '';
    jest.clearAllMocks();
    mockDownloadManagerInstances.length = 0;
  });

  afterEach(() => {
    document.body.removeChild(container);
    // Cleanup global state if needed
  });

  test('should initialize event listeners', () => {
    const btn = document.getElementById('compare-button');
    const addEventListenerSpy = jest.spyOn(btn, 'addEventListener');

    initializeDiffChecker();

    expect(addEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));
  });

  test('loads a dropped file into each pane without auto-comparing', async () => {
    initializeDiffChecker();

    const original = document.getElementById('text1');
    const modified = document.getElementById('text2');
    const resultBefore = document.getElementById('diff-result').innerHTML;

    fireFileDrop(original, 'first side', 'before.txt');
    await waitFor(() => expect(original.value).toBe('first side'));
    fireFileDrop(modified, 'second side', 'after.txt');
    await waitFor(() => expect(modified.value).toBe('second side'));

    expect(NotificationManager.show).toHaveBeenCalledWith(
      'Loaded before.txt',
      expect.any(Number),
      expect.objectContaining({ type: 'success' })
    );
    expect(NotificationManager.show).toHaveBeenCalledWith(
      'Loaded after.txt',
      expect.any(Number),
      expect.objectContaining({ type: 'success' })
    );
    // A drop fills one pane at a time, so the diff must wait for Compare.
    expect(document.getElementById('diff-result').innerHTML).toBe(resultBefore);
  });

  test('reports an oversized dropped file as an error toast', async () => {
    initializeDiffChecker();

    const oversized = new File(['x'], 'huge.log');
    Object.defineProperty(oversized, 'size', { value: 6 * 1024 * 1024 });
    fireFileDragEvent(document.getElementById('text1'), 'drop', [oversized]);
    await flushFileDrop();

    expect(document.getElementById('text1').value).toBe('');
    expect(NotificationManager.show).toHaveBeenCalledWith(
      expect.stringContaining('too large'),
      expect.any(Number),
      expect.objectContaining({ type: 'error' })
    );
  });

  describe('teardown', () => {
    const firePageHide = (persisted) => {
      const event = new Event('pagehide');
      Object.defineProperty(event, 'persisted', { value: persisted });
      window.dispatchEvent(event);
    };

    test('never registers the deprecated unload listener', () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener');

      initializeDiffChecker();

      // Chrome blocks `unload` under a default permissions policy and a
      // registered listener also disqualifies the page from the bfcache.
      const listenedEvents = addEventListenerSpy.mock.calls.map(([eventName]) => eventName);
      expect(listenedEvents).not.toContain('unload');
      expect(listenedEvents).toContain('pagehide');

      addEventListenerSpy.mockRestore();
    });

    test('tears down on a terminal pagehide', () => {
      initializeDiffChecker();
      const clearButtonInstance = ClearButton.mock.results.at(-1).value;

      firePageHide(false);

      expect(clearButtonInstance.disconnect).toHaveBeenCalled();
    });

    test('leaves everything connected when the page enters the back/forward cache', () => {
      initializeDiffChecker();
      const clearButtonInstance = ClearButton.mock.results.at(-1).value;

      firePageHide(true);

      // A bfcache-restored page keeps its DOM and JS state, so tearing down the
      // clear/copy buttons and the diff worker would hand back a dead tool.
      expect(clearButtonInstance.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('share links', () => {
    let writeText;

    beforeEach(() => {
      writeText = jest.fn().mockResolvedValue(undefined);
      Object.defineProperty(global.navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
        writable: true
      });
    });

    const flushShare = () => new Promise((resolve) => setTimeout(resolve, 0));

    test('copies a hash-fragment link carrying both panes', async () => {
      initializeDiffChecker();
      document.getElementById('text1').value = 'alpha';
      document.getElementById('text2').value = 'beta';
      document.getElementById('ignore-whitespace').checked = false;

      document.getElementById('diff-share-button').click();
      await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));

      const url = writeText.mock.calls[0][0];
      expect(url).toContain('#d=');
      // The compared text must live in the fragment, never the query string.
      expect(url.split('#')[0]).not.toContain('d=');
      expect(parseShareHash(`#${url.split('#')[1]}`)).toEqual({
        original: 'alpha',
        modified: 'beta',
        ignoreWhitespace: false
      });
    });

    test('refuses to share when both panes are empty', async () => {
      initializeDiffChecker();

      document.getElementById('diff-share-button').click();
      await flushShare();

      expect(writeText).not.toHaveBeenCalled();
      expect(NotificationManager.show).toHaveBeenCalledWith(
        expect.stringContaining('before sharing'),
        expect.any(Number),
        expect.objectContaining({ type: 'error' })
      );
    });

    test('reports a clipboard failure instead of claiming success', async () => {
      writeText.mockRejectedValue(new Error('denied'));
      initializeDiffChecker();
      document.getElementById('text1').value = 'alpha';

      document.getElementById('diff-share-button').click();
      await flushShare();

      expect(NotificationManager.show).toHaveBeenCalledWith(
        expect.stringContaining('Failed to copy share link'),
        expect.any(Number),
        expect.objectContaining({ type: 'error' })
      );
    });

    test('refuses to share a payload that would exceed the URL ceiling', async () => {
      initializeDiffChecker();
      // High-entropy text so LZ compression cannot bring it under the ceiling.
      let bulky = '';
      for (let i = 0; i < 30000; i += 1) {
        bulky += Math.random().toString(36).slice(2, 6);
      }
      document.getElementById('text1').value = bulky;

      document.getElementById('diff-share-button').click();
      await flushShare();

      expect(writeText).not.toHaveBeenCalled();
      expect(NotificationManager.show).toHaveBeenCalledWith(
        expect.stringContaining('too large to share'),
        expect.any(Number),
        expect.objectContaining({ type: 'error' })
      );
    });

    test('does nothing when the panes are missing from the DOM', async () => {
      document.getElementById('text1').remove();
      initializeDiffChecker();

      document.getElementById('diff-share-button').click();
      await flushShare();

      expect(writeText).not.toHaveBeenCalled();
    });

    test('warns when a payload arrives via the legacy query string', async () => {
      const { pathname } = window.location;
      window.history.replaceState({}, '', `${pathname}?${buildShareHash({
        original: 'a',
        modified: 'b',
        ignoreWhitespace: true
      })}`);

      initializeDiffChecker();
      await waitFor(() => expect(document.getElementById('text1').value).toBe('a'));

      expect(NotificationManager.show).toHaveBeenCalledWith(
        expect.stringContaining('Legacy ?d='),
        expect.any(Number),
        expect.objectContaining({ type: 'warning' })
      );

      window.history.replaceState({}, '', pathname);
    });

    test('preloads both panes and the option from a shared link, then compares', async () => {
      window.location.hash = `#${buildShareHash({
        original: 'alpha\nbeta',
        modified: 'alpha\ngamma',
        ignoreWhitespace: false
      })}`;

      initializeDiffChecker();
      await waitFor(() => expect(document.getElementById('text1').value).toBe('alpha\nbeta'));

      expect(document.getElementById('text2').value).toBe('alpha\ngamma');
      expect(document.getElementById('ignore-whitespace').checked).toBe(false);
      expect(NotificationManager.show).toHaveBeenCalledWith(
        'Loaded texts from shared link.',
        expect.any(Number),
        expect.objectContaining({ type: 'success' })
      );
      // The share link carries both sides, so the compare runs immediately.
      expect(document.getElementById('diff-result').innerHTML.length).toBeGreaterThan(0);
    });

    test('does not overwrite text typed while the share chunk loads', async () => {
      window.location.hash = `#${buildShareHash({
        original: 'shared original',
        modified: 'shared modified',
        ignoreWhitespace: true
      })}`;

      initializeDiffChecker();
      // Synchronously after init — i.e. while the dynamic import of the share
      // codec is still pending, which is exactly the slow-connection case.
      document.getElementById('text1').value = 'typed while the chunk loaded';
      await new Promise((resolve) => setTimeout(resolve, 60));

      expect(document.getElementById('text1').value).toBe('typed while the chunk loaded');
      expect(document.getElementById('text2').value).toBe('');
      expect(NotificationManager.show).not.toHaveBeenCalledWith(
        'Loaded texts from shared link.',
        expect.any(Number),
        expect.any(Object)
      );
    });

    test('ignores a malformed share hash instead of throwing', () => {
      window.location.hash = '#d=not-actually-compressed';

      expect(() => initializeDiffChecker()).not.toThrow();
      expect(document.getElementById('text1').value).toBe('');
    });
  });

  test('should fall back to textContent label writes when the button has no leading text node', async () => {
    document.getElementById('compare-button').innerHTML = '<span>Compare</span>';
    initializeDiffChecker();

    document.getElementById('text1').value = 'foo';
    document.getElementById('text2').value = 'bar';
    document.getElementById('compare-button').click();
    await new Promise(resolve => setTimeout(resolve, 50));

    // Label flip ran through the fallback branch and was restored.
    expect(document.getElementById('compare-button').textContent).toBe('Compare');
    expect(document.getElementById('diff-result').children.length).toBeGreaterThan(0);
  });

  test('should trigger diff computation on click', async () => {
    initializeDiffChecker();

    document.getElementById('text1').value = 'foo\nbar';
    document.getElementById('text2').value = 'foo\nbaz';
    document.getElementById('compare-button').click();

    // Wait for async operations (setTimeout, etc)
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(NotificationManager.show).toHaveBeenCalledWith('Diff computation complete!');

    // Verify results were populated
    const result = document.getElementById('diff-result');
    expect(result.children.length).toBeGreaterThan(0);
  });

  test('enables patch download after a comparison and uses typed labels', async () => {
    initializeDiffChecker();

    const downloadButton = document.getElementById('download-patch-button');
    const downloadManager = mockDownloadManagerInstances.at(-1);
    expect(downloadButton.disabled).toBe(true);

    document.getElementById('text1').value = 'first\nsecond';
    document.getElementById('text2').value = 'first\nupdated';
    document.getElementById('compare-button').click();

    await waitFor(() => expect(downloadButton.disabled).toBe(false));
    downloadButton.click();
    await waitFor(() => expect(downloadManager.downloadFile).toHaveBeenCalledTimes(1));

    const [patch, filename, mimeType] = downloadManager.downloadFile.mock.calls[0];
    expect(filename).toBe('comparison.patch');
    expect(mimeType).toBe('text/plain');
    expect(patch).toContain('--- original');
    expect(patch).toContain('+++ modified');
    expect(patch).toContain('-second');
    expect(patch).toContain('+updated');
  });

  test('uses file labels and falls back after a pane is edited', async () => {
    initializeDiffChecker();

    const original = document.getElementById('text1');
    const modified = document.getElementById('text2');
    const downloadButton = document.getElementById('download-patch-button');
    const downloadManager = mockDownloadManagerInstances.at(-1);

    fireFileDrop(original, 'before\nline', 'before.txt');
    fireFileDrop(modified, 'after\nline', 'after.txt');
    await waitFor(() => {
      expect(original.value).toBe('before\nline');
      expect(modified.value).toBe('after\nline');
    });

    document.getElementById('compare-button').click();
    await waitFor(() => expect(downloadButton.disabled).toBe(false));
    downloadButton.click();
    await waitFor(() => expect(downloadManager.downloadFile).toHaveBeenCalledTimes(1));

    const firstPatch = downloadManager.downloadFile.mock.calls[0][0];
    expect(firstPatch).toContain('--- before.txt');
    expect(firstPatch).toContain('+++ after.txt');

    original.value = 'edited before\nline';
    original.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('compare-button').click();
    await waitFor(() => expect(downloadButton.disabled).toBe(false));
    downloadButton.click();
    await waitFor(() => expect(downloadManager.downloadFile).toHaveBeenCalledTimes(2));

    const secondPatch = downloadManager.downloadFile.mock.calls[1][0];
    expect(secondPatch).toContain('--- original');
    expect(secondPatch).toContain('+++ after.txt');
  });

  test('downloads the last successful comparison snapshot', async () => {
    initializeDiffChecker();

    const text1 = document.getElementById('text1');
    const text2 = document.getElementById('text2');
    const downloadButton = document.getElementById('download-patch-button');
    const downloadManager = mockDownloadManagerInstances.at(-1);

    text1.value = 'old original';
    text2.value = 'old modified';
    document.getElementById('compare-button').click();
    await waitFor(() => expect(downloadButton.disabled).toBe(false));

    text1.value = 'new original';
    text2.value = 'new modified';
    document.getElementById('ignore-whitespace').checked = true;
    downloadButton.click();
    await waitFor(() => expect(downloadManager.downloadFile).toHaveBeenCalledTimes(1));

    const patch = downloadManager.downloadFile.mock.calls[0][0];
    expect(patch).toContain('-old original');
    expect(patch).toContain('+old modified');
    expect(patch).not.toContain('-new original');
    expect(patch).not.toContain('+new modified');
  });

  test('keeps patch download disabled for an empty comparison and reports failures', async () => {
    initializeDiffChecker();

    const compareButton = document.getElementById('compare-button');
    const downloadButton = document.getElementById('download-patch-button');
    const downloadManager = mockDownloadManagerInstances.at(-1);

    compareButton.click();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(downloadButton.disabled).toBe(true);

    document.getElementById('text1').value = 'one-sided';
    compareButton.click();
    await waitFor(() => expect(downloadButton.disabled).toBe(false));

    downloadManager.downloadFile.mockImplementationOnce(() => {
      throw new Error('blocked');
    });
    downloadButton.click();
    await waitFor(() => expect(NotificationManager.show).toHaveBeenCalledWith(
      'Download failed: blocked',
      3000,
      expect.objectContaining({ type: 'error' })
    ));
  });

  test('compares dropped CRLF and LF files without blank rows', async () => {
    initializeDiffChecker();

    const original = document.getElementById('text1');
    const modified = document.getElementById('text2');
    fireFileDrop(original, 'first\r\nsecond', 'before.txt');
    fireFileDrop(modified, 'first\nsecond', 'after.txt');
    await waitFor(() => {
      expect(original.value).toBe('first\nsecond');
      expect(modified.value).toBe('first\nsecond');
    });

    document.getElementById('ignore-whitespace').checked = false;
    document.getElementById('compare-button').click();
    await new Promise(resolve => setTimeout(resolve, 50));

    const result = document.getElementById('diff-result');
    expect(result.children).toHaveLength(3);
    expect(result.querySelectorAll('.diff-removed, .diff-added')).toHaveLength(2);
    expect(result.innerHTML).not.toContain('\r');
    expect(result.textContent).toContain('first␍');

    // The same raw dropped file is normalized when whitespace is ignored.
    document.getElementById('ignore-whitespace').checked = true;
    document.getElementById('compare-button').click();
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(result.children).toHaveLength(2);
    expect(result.querySelectorAll('.diff-removed, .diff-added')).toHaveLength(0);
    expect(result.innerHTML).not.toContain('\r');
    expect(result.textContent).not.toContain('␍');
  });

  test('keeps classic-Mac line structure visible in exact mode', async () => {
    initializeDiffChecker();

    const original = document.getElementById('text1');
    const modified = document.getElementById('text2');
    fireFileDrop(original, 'alpha\rbeta\rgamma', 'classic-mac.txt');
    fireFileDrop(modified, 'alpha\nbeta\ngamma', 'unix.txt');
    await waitFor(() => {
      expect(original.value).toBe('alpha\nbeta\ngamma');
      expect(modified.value).toBe('alpha\nbeta\ngamma');
    });

    document.getElementById('ignore-whitespace').checked = false;
    document.getElementById('compare-button').click();
    await new Promise(resolve => setTimeout(resolve, 50));

    const result = document.getElementById('diff-result');
    expect(result.children).toHaveLength(5);
    expect(result.innerHTML).not.toContain('\r');
    expect(result.textContent).toContain('alpha␍');
    expect(result.textContent).toContain('beta␍');
  });

  test('drops remembered file line endings after a pane is edited', async () => {
    initializeDiffChecker();

    const original = document.getElementById('text1');
    const modified = document.getElementById('text2');
    fireFileDrop(original, 'first\r\nsecond', 'before.txt');
    fireFileDrop(modified, 'first\nsecond', 'after.txt');
    await waitFor(() => expect(original.value).toBe('first\nsecond'));

    original.value = 'first\nsecond';
    original.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('ignore-whitespace').checked = false;
    document.getElementById('compare-button').click();
    await new Promise(resolve => setTimeout(resolve, 50));

    const result = document.getElementById('diff-result');
    expect(result.querySelectorAll('.diff-removed, .diff-added')).toHaveLength(0);
    expect(result.innerHTML).not.toContain('␍');
  });

  test('should fill both panes and compare via the Load Sample button', async () => {
    initializeDiffChecker();

    document.getElementById('load-sample').click();
    await new Promise(resolve => setTimeout(resolve, 50));

    const text1 = document.getElementById('text1');
    const text2 = document.getElementById('text2');
    expect(text1.value).toContain('function greet');
    expect(text2.value).toContain('const message');
    expect(NotificationManager.show).toHaveBeenCalledWith('Diff computation complete!');
  });

  // The large-input offload path (lazy ./diff-runner import + worker/fallback)
  // is covered end-to-end in the ESM specs diff-offload.test.js and
  // diff-import-fallback.test.js, where dynamic import + module mocking behave
  // deterministically. This CJS suite keeps the sub-threshold sync coverage.

  test('should show error validation if inputs empty', async () => {
    initializeDiffChecker();
    document.getElementById('compare-button').click();

    // Wait slightly
    await new Promise(resolve => setTimeout(resolve, 0));

    // v4 contract: validation errors surface inline, not as toasts.
    expect(NotificationManager.show).not.toHaveBeenCalled();
    const errorStatus = document.getElementById('diff-error-status');
    expect(errorStatus.textContent).toContain('Please enter text');
    expect(errorStatus.classList.contains('error')).toBe(true);
  });

  test('should safely return when diff result element is missing', () => {
    const originalGetElementById = document.getElementById.bind(document);
    const getElementByIdSpy = jest.spyOn(document, 'getElementById').mockImplementation((id) => {
      if (id === 'diff-result') {
        return null;
      }
      return originalGetElementById(id);
    });

    const initResult = initializeDiffChecker();

    expect(initResult).toBeUndefined();
    getElementByIdSpy.mockRestore();
  });

  test('should surface diff computation errors to the notification area', async () => {
    scheduleTask.mockRejectedValueOnce(new Error('scheduler failed'));
    initializeDiffChecker();

    document.getElementById('text1').value = 'foo';
    document.getElementById('text2').value = 'bar';
    document.getElementById('compare-button').click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    // v4 contract: computation errors surface inline, not as toasts.
    expect(NotificationManager.show).not.toHaveBeenCalled();
    const errorStatus = document.getElementById('diff-error-status');
    expect(errorStatus.textContent).toBe('Error computing diff: scheduler failed');
    expect(errorStatus.classList.contains('error')).toBe(true);
  });
});
