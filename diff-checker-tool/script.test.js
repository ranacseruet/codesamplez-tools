import { DiffDisplay } from './script.js';

// More robust mock for document.createElement
document.createElement = jest.fn().mockImplementation((tagName) => {
  const element = {
    tagName: tagName.toLowerCase(),
    innerHTML: '',
    textContent: '',
    className: '',
    children: [],
    classList: {
      list: new Set(),
      add: jest.fn(function(className) { element.classList.list.add(className); }),
      contains: jest.fn(function(className) { return element.classList.list.has(className); })
    },
    appendChild: jest.fn(function(child) {
      element.children.push(child);
    }),
    // Helper to find child by class for testing
    querySelector: jest.fn(function(selector) {
      if (selector.startsWith('.')) {
        const className = selector.substring(1);
        return element.children.find(child => child.classList.contains(className));
      }
      return null; // Basic mock, extend if needed
    })
  };
  return element;
});

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
      // Check that the first appended child is a div (our line container)
      expect(mockElement.appendChild.mock.calls[0][0].tagName).toBe('div');
    });
  });

  describe('createLineElement', () => {
    beforeEach(() => {
      // Reset mocks for each test in this suite if needed
      document.createElement.mockClear();
      // Setup specific mocks for the two spans created inside createLineElement
      const mockLineNumberSpan = document.createElement('span');
      const mockContentSpan = document.createElement('span');
      const mockDiv = document.createElement('div');
      
      // Order matters based on implementation
      document.createElement
        .mockReturnValueOnce(mockDiv) // First call creates the div
        .mockReturnValueOnce(mockLineNumberSpan) // Second call creates line number span
        .mockReturnValueOnce(mockContentSpan); // Third call creates content span
    });

    it('should create a div container with correct class', () => {
      const lineContainer = diffDisplay.createLineElement('unchanged', 'test', false);
      expect(lineContainer.tagName).toBe('div');
      expect(lineContainer.classList.add).toHaveBeenCalledWith('diff-line');
    });

    it('should create line number and content spans as children', () => {
      const lineContainer = diffDisplay.createLineElement('unchanged', 'test', false);
      expect(lineContainer.appendChild).toHaveBeenCalledTimes(2);
      expect(lineContainer.children.length).toBe(2);
      expect(lineContainer.children[0].className).toBe('diff-line-number');
      expect(lineContainer.children[1].classList.contains('diff-content')).toBe(true);
    });
    
    it('should apply correct class to content span for added line', () => {
      const lineContainer = diffDisplay.createLineElement('added', 'test line', false);
      const contentSpan = lineContainer.children[1]; // Assuming content is the second child
      expect(contentSpan.classList.add).toHaveBeenCalledWith('diff-content');
      expect(contentSpan.classList.add).toHaveBeenCalledWith('diff-added');
      expect(contentSpan.innerHTML).toContain('test line');
    });
    
    it('should apply correct class to content span for removed line', () => {
      const lineContainer = diffDisplay.createLineElement('removed', 'test line', false);
      const contentSpan = lineContainer.children[1];
      expect(contentSpan.classList.add).toHaveBeenCalledWith('diff-content');
      expect(contentSpan.classList.add).toHaveBeenCalledWith('diff-removed');
      expect(contentSpan.innerHTML).toContain('test line');
    });
    
    it('should only apply base class to content span for unchanged line', () => {
      const lineContainer = diffDisplay.createLineElement('unchanged', 'test line', false);
      const contentSpan = lineContainer.children[1];
      expect(contentSpan.classList.add).toHaveBeenCalledWith('diff-content');
      expect(contentSpan.classList.add).not.toHaveBeenCalledWith('diff-unchanged'); // Or added/removed
      expect(contentSpan.innerHTML).toContain('test line');
    });

    it('should include correct line numbers text in the line number span', () => {
      const lineContainer = diffDisplay.createLineElement('unchanged', 'test', false);
      const lineNumberSpan = lineContainer.children[0]; // Assuming line number is the first child
      // Use textContent for the check now and expect the padded string
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
      
      const result = diffDisplay.formatLine('const x = 1;', true);
      expect(result).toBe('highlighted\n');
      expect(Prism.highlight).toHaveBeenCalledWith('const x = 1;', Prism.languages.javascript, 'javascript');
    });

    it('should fall back to plain text if highlighting fails', () => {
      global.Prism = {
        highlight: jest.fn().mockImplementation(() => { throw new Error(); }),
        languages: { javascript: {} }
      };
      
      const result = diffDisplay.formatLine('const x = 1;', true);
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
