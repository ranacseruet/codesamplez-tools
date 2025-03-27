import { DiffDisplay } from './script.js';

// Mock document.createElement
document.createElement = jest.fn().mockImplementation((tagName) => {
  return {
    tagName,
    innerHTML: '',
    classList: {
      add: jest.fn()
    }
  };
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
      expect(mockElement.appendChild).toHaveBeenCalledTimes(3);
    });
  });

  describe('createLineElement', () => {
    it('should create element with correct class and content for added line', () => {
      const mockElement = {
        tagName: 'span',
        innerHTML: '',
        classList: {
          add: jest.fn()
        }
      };
      document.createElement.mockReturnValueOnce(mockElement);
      
      const lineElement = diffDisplay.createLineElement('added', 'test line', false);
      expect(document.createElement).toHaveBeenCalledWith('span');
      expect(mockElement.classList.add).toHaveBeenCalledWith('diff-added');
      expect(mockElement.innerHTML).toContain('test line');
    });

    it('should include line numbers in the element', () => {
      const lineElement = diffDisplay.createLineElement('unchanged', 'test', false);
      expect(lineElement.innerHTML).toMatch(/1│1/);
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

  describe('createLineNumberHTML', () => {
    it('should increment modified line number for added lines', () => {
      diffDisplay.createLineNumberHTML('added');
      expect(diffDisplay.modifiedLineNumber).toBe(2);
      expect(diffDisplay.originalLineNumber).toBe(1);
    });

    it('should increment original line number for removed lines', () => {
      diffDisplay.createLineNumberHTML('removed');
      expect(diffDisplay.originalLineNumber).toBe(2);
      expect(diffDisplay.modifiedLineNumber).toBe(1);
    });

    it('should increment both numbers for unchanged lines', () => {
      diffDisplay.createLineNumberHTML('unchanged');
      expect(diffDisplay.originalLineNumber).toBe(2);
      expect(diffDisplay.modifiedLineNumber).toBe(2);
    });
  });

  describe('formatLineNumbers', () => {
    it('should format numbers with equal padding', () => {
      const result = diffDisplay.formatLineNumbers(1, 1, 2);
      expect(result).toBe('<span class="diff-line-number"> 1│ 1</span>');
    });

    it('should handle empty original number', () => {
      const result = diffDisplay.formatLineNumbers('', 1, 2);
      expect(result).toBe('<span class="diff-line-number">  │ 1</span>');
    });

    it('should handle empty modified number', () => {
      const result = diffDisplay.formatLineNumbers(1, '', 2);
      expect(result).toBe('<span class="diff-line-number"> 1│  </span>');
    });
  });
});
