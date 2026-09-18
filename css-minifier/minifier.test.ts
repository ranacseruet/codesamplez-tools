import {
  combineSelectorsInCss,
  isValidCSS,
  minifyCSS,
  removeCommentsFromCss,
  removeLastSemicolonsFromCss,
  removeUnnecessaryUnits,
  removeWhitespaceFromCss,
  shortenColorsInCss
} from './minifier';

describe('minifier helper functions', () => {
  describe('removeCommentsFromCss', () => {
    test('removes multi-line comments', () => {
      const input = '/* comment */ body { color: red; } /* another \n multiline \n comment */';
      expect(removeCommentsFromCss(input)).toBe(' body { color: red; } ');
    });

    test('removes inline comments', () => {
      const input = 'a { color: /* blue */ red; }';
      expect(removeCommentsFromCss(input)).toBe('a { color:  red; }');
    });

    test('leaves CSS without comments untouched', () => {
      const input = 'body { margin: 0; }';
      expect(removeCommentsFromCss(input)).toBe('body { margin: 0; }');
    });
  });

  describe('removeWhitespaceFromCss', () => {
    test('removes line breaks, tabs, and trims leading/trailing spaces', () => {
      const input = '\n\t  body {\n\t    color: red;\n\t  }\n\t';
      expect(removeWhitespaceFromCss(input)).toBe('body{color:red;}');
    });

    test('collapses spaces around delimiters and commas', () => {
      const input = 'h1 ,  h2 ,   h3  { margin : 0 ; padding : 0 ; }';
      expect(removeWhitespaceFromCss(input)).toBe('h1,h2,h3{margin:0;padding:0;}');
    });

    test('removes spaces around operators in selectors and media queries', () => {
      const input = 'div > p + span ~ a { display: block; }';
      expect(removeWhitespaceFromCss(input)).toBe('div>p+span~a{display:block;}');
    });

    test('removes spaces inside parentheses', () => {
      const input = '@media ( max-width: 600px ) { body { font-size: 14px; } }';
      expect(removeWhitespaceFromCss(input)).toBe('@media (max-width:600px){body{font-size:14px;}}');
    });

    test('removes space before !important', () => {
      const input = 'p { color: red   !important; }';
      expect(removeWhitespaceFromCss(input)).toBe('p{color:red!important;}');
    });

    test('removes space between consecutive declaration blocks', () => {
      const input = '.a { color: red; }   .b { color: blue; }';
      expect(removeWhitespaceFromCss(input)).toBe('.a{color:red;}.b{color:blue;}');
    });
  });

  describe('shortenColorsInCss', () => {
    test('shortens named colors', () => {
      const input = 'color: white; background: black; border-color: red green blue yellow cyan magenta;';
      expect(shortenColorsInCss(input)).toBe(
        'color: #fff; background: #000; border-color: #f00 #0f0 #00f #ff0 #0ff #f0f;'
      );
    });

    test('shortens hex colors #RRGGBB to #RGB', () => {
      const input = 'color: #aabbcc; background: #112233;';
      expect(shortenColorsInCss(input)).toBe('color: #abc; background: #123;');
    });

    test('leaves non-collapsible hex colors untouched', () => {
      const input = 'color: #123456; background: #abcdef;';
      expect(shortenColorsInCss(input)).toBe('color: #123456; background: #abcdef;');
    });

    test('is case insensitive', () => {
      const input = 'color: WHITE; background: ReD; border: 1px solid #AABBCC;';
      expect(shortenColorsInCss(input)).toBe('color: #fff; background: #f00; border: 1px solid #ABC;');
    });

    test('does not replace colors inside other words or classes', () => {
      const input = 'color: whitesmoke; class: bred; background: blueprint;';
      expect(shortenColorsInCss(input)).toBe('color: whitesmoke; class: bred; background: blueprint;');
    });

    test('handles colors at boundaries and before braces/semicolons', () => {
      expect(shortenColorsInCss('color: blue')).toBe('color: #00f');
      expect(shortenColorsInCss('color: yellow}')).toBe('color: #ff0}');
      expect(shortenColorsInCss('color: red;')).toBe('color: #f00;');
    });

    test('handles consecutive colors separated by space or newlines', () => {
      expect(shortenColorsInCss('border-color: red green;')).toBe('border-color: #f00 #0f0;');
      expect(shortenColorsInCss('border-color: red green blue;')).toBe('border-color: #f00 #0f0 #00f;');
      expect(shortenColorsInCss('color: red;\nbackground: green;')).toBe('color: #f00;\nbackground: #0f0;');
    });
  });

  describe('removeUnnecessaryUnits', () => {
    test('removes units from zero values', () => {
      const input = 'margin: 0px 0em 0rem 0pt; padding: 0pc 0vh 0vw 0vmin; border-width: 0vmax 0ex 0ch 0mm; top: 0cm 0in 0%;';
      const expected = 'margin: 0 0 0 0; padding: 0 0 0 0; border-width: 0 0 0 0; top: 0 0 0;';
      expect(removeUnnecessaryUnits(input)).toBe(expected);
    });

    test('preserves units for non-zero values', () => {
      const input = 'margin: 10px 2.5em 0.5rem; width: 100%; height: 50vh;';
      expect(removeUnnecessaryUnits(input)).toBe('margin: 10px 2.5em 0.5rem; width: 100%; height: 50vh;');
    });

    test('handles colon boundary for single zero unit value', () => {
      expect(removeUnnecessaryUnits('left:0px')).toBe('left:0');
      expect(removeUnnecessaryUnits('margin: 0px')).toBe('margin: 0');
    });
  });

  describe('removeLastSemicolonsFromCss', () => {
    test('removes trailing semicolon before closing bracket', () => {
      const input = 'body{color:red;margin:0;}h1{font-size:24px;}';
      expect(removeLastSemicolonsFromCss(input)).toBe('body{color:red;margin:0}h1{font-size:24px}');
    });

    test('leaves declarations without trailing semicolons untouched', () => {
      const input = 'body{color:red}';
      expect(removeLastSemicolonsFromCss(input)).toBe('body{color:red}');
    });
  });

  describe('combineSelectorsInCss', () => {
    test('processes regular CSS rules and formats them cleanly', () => {
      const input = 'body { color: red; margin: 0; } p { font-size: 14px; }';
      expect(combineSelectorsInCss(input)).toBe('body{color: red;margin: 0;}p{font-size: 14px;}');
    });

    test('processes media query blocks and preserves inner rules', () => {
      const input = '@media (max-width: 600px) { body { color: red; } h1 { font-size: 20px; } } p { margin: 0; }';
      const output = combineSelectorsInCss(input);
      expect(output).toContain('@media (max-width: 600px) {');
      expect(output).toContain('body{color: red;}');
      expect(output).toContain('h1{font-size: 20px;}');
      expect(output).toContain('p{margin: 0;}');
    });

    test('cleans and ignores empty declaration blocks', () => {
      const input = 'body { } p { color: blue; }';
      expect(combineSelectorsInCss(input)).toBe('p{color: blue;}');
    });
  });
});

describe('CSS Minifier (minifyCSS)', () => {
  test('minifies whitespace and comments', () => {
    const input = `
      /* Header styles */
      .test {
        color: red; /* inline comment */
        margin: 0px;
      }
    `;
    const expected = '.test{color:red;margin:0;}';
    expect(minifyCSS(input)).toBe(expected);
  });

  test('preserves important syntax and removes unnecessary units', () => {
    const input = `
      .test {
        color: red !important;
        padding: 0px 10px;
      }
    `;
    const expected = '.test{color:red!important;padding:0 10px;}';
    expect(minifyCSS(input)).toBe(expected);
  });

  test('handles media queries inside minifyCSS', () => {
    const input = `
      @media (max-width: 600px) {
        .test {
          color: red;
        }
      }
    `;
    const expected = '@media (max-width:600px){.test{color:red;}}';
    expect(minifyCSS(input)).toBe(expected);
  });

  test('throws error for invalid CSS input', () => {
    let errorSpy: jest.SpyInstance | undefined;
    try {
      errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const input = 'body { color: red'; // missing closing brace
      expect(() => minifyCSS(input)).toThrow('Invalid CSS input');
    } finally {
      errorSpy?.mockRestore();
    }
  });
});

describe('CSS Validator (isValidCSS)', () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  test('returns true for valid CSS with single or multiple rules', () => {
    expect(isValidCSS('body { color: red; }')).toBe(true);
    expect(isValidCSS('p { font-size: 12px; } a { text-decoration: none; }')).toBe(true);
  });

  test('returns true for valid CSS with leading and trailing whitespace', () => {
    expect(isValidCSS('  div { border: 1px solid black; }  ')).toBe(true);
  });

  test('returns true for empty string or whitespace-only CSS', () => {
    expect(isValidCSS('')).toBe(true);
    expect(isValidCSS('   \n\t  ')).toBe(true);
  });

  test('returns true for CSS containing only comments', () => {
    expect(isValidCSS('/* this is a comment */')).toBe(true);
    expect(isValidCSS('/* comment 1 */ /* comment 2 */')).toBe(true);
    expect(isValidCSS('// single line comment')).toBe(true);
  });

  test('returns true for @media queries', () => {
    expect(isValidCSS('@media (max-width: 600px) { body { color: red; } }')).toBe(true);
  });

  test('returns true for CSS variables / custom properties', () => {
    expect(isValidCSS(':root { --primary-color: #fff; } body { color: var(--primary-color); }')).toBe(true);
  });

  test('returns true for empty block structures like body {}', () => {
    expect(isValidCSS('body {}')).toBe(true);
    expect(isValidCSS('div {   }')).toBe(true);
  });

  test('returns false for selector without declaration block', () => {
    expect(isValidCSS('body ')).toBe(false);
  });

  test('returns false for property without value', () => {
    expect(isValidCSS('body { color: }')).toBe(false);
  });

  test('returns false for malformed / unclosed comments', () => {
    expect(isValidCSS('/* unclosed comment body { color: red; }')).toBe(false);
  });

  test('returns false for random gibberish', () => {
    expect(isValidCSS('@@@@@$$$$$')).toBe(false);
  });

  test('handles browser CSSOM producing rule with empty style and colon (target line 177)', () => {
    const createElementSpy = jest.spyOn(document, 'createElement').mockImplementationOnce((tagName) => {
      const el = document.createElement.bind(document)(tagName);
      Object.defineProperty(el, 'sheet', {
        value: {
          cssRules: [{ style: { length: 0 } }]
        },
        configurable: true
      });
      return el;
    });

    try {
      expect(isValidCSS('body { color: }')).toBe(false);
    } finally {
      createElementSpy.mockRestore();
    }
  });

  test('handles browser CSSOM producing 0 rules for empty selector blocks (target line 187)', () => {
    const createElementSpy = jest.spyOn(document, 'createElement').mockImplementationOnce((tagName) => {
      const el = document.createElement.bind(document)(tagName);
      Object.defineProperty(el, 'sheet', {
        value: {
          cssRules: []
        },
        configurable: true
      });
      return el;
    });

    try {
      expect(isValidCSS('body {}')).toBe(true);
    } finally {
      createElementSpy.mockRestore();
    }
  });

  test('returns false if style sheet or cssRules is unavailable', () => {
    const createElementSpy = jest.spyOn(document, 'createElement').mockImplementationOnce((tagName) => {
      const el = document.createElement.bind(document)(tagName);
      Object.defineProperty(el, 'sheet', { value: null, configurable: true });
      return el;
    });

    try {
      expect(isValidCSS('body { color: red; }')).toBe(false);
    } finally {
      createElementSpy.mockRestore();
    }
  });

  test('returns false if setting textContent throws', () => {
    const createElementSpy = jest.spyOn(document, 'createElement').mockImplementationOnce((tagName) => {
      const el = document.createElement.bind(document)(tagName);
      Object.defineProperty(el, 'textContent', {
        set: () => {
          throw new Error('Simulated DOM parsing exception');
        },
        configurable: true
      });
      return el;
    });

    try {
      expect(isValidCSS('body { color: red; }')).toBe(false);
    } finally {
      createElementSpy.mockRestore();
    }
  });

  test('cleans up the style element from document.head after validation', () => {
    const initialHeadChildCount = document.head.children.length;
    isValidCSS('body { color: red; }');
    expect(document.head.children.length).toBe(initialHeadChildCount);
  });
});
