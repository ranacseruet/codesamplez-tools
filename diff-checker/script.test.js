import { DiffDisplay, DiffNavigator, CodeDetector, initializeDiffChecker } from './script';
import { NotificationManager } from '../common/notification-manager';
import { scheduleTask } from '../common/scheduler-utils';

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
    disconnect: jest.fn()
  }));
});

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
      <button id="compare-button">Compare</button>
      <div id="diff-result"></div>
      <button id="prev-diff-button"></button>
      <button id="next-diff-button"></button>
      <span id="diff-counter"></span>
      <input type="checkbox" id="ignore-whitespace">
    `;
    document.body.appendChild(container); // Using JSDOM document
    jest.clearAllMocks();
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

  // The large-input offload path (lazy ./diff-runner import + worker/fallback)
  // is covered end-to-end in the ESM specs diff-offload.test.js and
  // diff-import-fallback.test.js, where dynamic import + module mocking behave
  // deterministically. This CJS suite keeps the sub-threshold sync coverage.

  test('should show error validation if inputs empty', async () => {
    initializeDiffChecker();
    document.getElementById('compare-button').click();

    // Wait slightly
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(NotificationManager.show).toHaveBeenCalledWith(expect.stringContaining('Please enter text'));
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

    expect(NotificationManager.show).toHaveBeenCalledWith('Error computing diff: scheduler failed');
  });
});
