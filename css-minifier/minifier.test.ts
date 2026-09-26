import {
  combineSelectorsInCss,
  isValidCSS,
  minifyCSS,
  DEFAULT_MINIFY_OPTIONS,
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

    test('preserves comment markers inside quoted strings', () => {
      const input = 'a { content: "/* keep this */"; /* remove this */ color: red; }';
      expect(removeCommentsFromCss(input)).toBe('a { content: "/* keep this */";  color: red; }');
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

    test('preserves whitespace around calc() operators (calc(100%+20px) is invalid CSS)', () => {
      const input = '.box { width: calc(100% - 20px); height: calc(100% + 20px); }';
      expect(removeWhitespaceFromCss(input)).toBe(
        '.box{width:calc(100% - 20px);height:calc(100% + 20px);}'
      );
    });

    test('preserves nested calc() and sibling math functions', () => {
      const input = '.box { width: calc(calc(100% - 10px) + 5px); } .v { top: clamp(0px, 1rem + 2px, 3rem); }';
      expect(removeWhitespaceFromCss(input)).toBe(
        '.box{width:calc(calc(100% - 10px) + 5px);}.v{top:clamp(0px, 1rem + 2px, 3rem);}'
      );
    });

    test('still strips selector combinators next to calc() declarations', () => {
      const input = 'div > p { margin: calc(1px + 2px); }';
      expect(removeWhitespaceFromCss(input)).toBe('div>p{margin:calc(1px + 2px);}');
    });

    test('does not mask min/max in media query feature names', () => {
      const input = '@media (min-width: 400px) and (max-width: 600px) { body { font-size: 14px; } }';
      expect(removeWhitespaceFromCss(input)).toBe(
        '@media (min-width:400px) and (max-width:600px){body{font-size:14px;}}'
      );
    });

    test('removes space between consecutive declaration blocks', () => {
      const input = '.a { color: red; }   .b { color: blue; }';
      expect(removeWhitespaceFromCss(input)).toBe('.a{color:red;}.b{color:blue;}');
    });

    test('preserves delimiters, operators, and whitespace inside strings', () => {
      const input = '.a::before { content: "a, b + c > d; }"; } [data-x="a b"] { content: "}"; }';
      const expected = '.a::before{content:"a, b + c > d; }";}[data-x="a b"]{content:"}";}';
      expect(removeWhitespaceFromCss(input)).toBe(expected);
    });

    test('preserves escaped quotes inside strings', () => {
      const input = '.a { content: "say \\"a, b; }"; }';
      expect(removeWhitespaceFromCss(input)).toBe('.a{content:"say \\"a, b; }";}');
    });

    test('normalizes newlines and indentation inside multiline calc() to single spaces', () => {
      const input = '.box {\n  width: calc(\n    100% -\n    20px\n  );\n}';
      expect(removeWhitespaceFromCss(input)).toBe('.box{width:calc(100% - 20px);}');
    });

    test('normalizes whitespace inside multiline clamp() the same way', () => {
      const input = '.v { top: clamp(\n  0px,\n  1rem + 2px,\n  3rem\n); }';
      expect(removeWhitespaceFromCss(input)).toBe('.v{top:clamp(0px, 1rem + 2px, 3rem);}');
    });

    test('does not confuse math placeholders with literal __CSS_MINIFIER_MATH_ text in the input', () => {
      const input = '.a { content: "__CSS_MINIFIER_MATH_0__"; width: calc(1px + 2px); }';
      expect(removeWhitespaceFromCss(input)).toBe(
        '.a{content:"__CSS_MINIFIER_MATH_0__";width:calc(1px + 2px);}'
      );
    });

    test('does not treat identifier tails like admin( or fmin( as math functions', () => {
      const input = '.a { padding: admin(1px, 2px); top: fmin(1px, 2px); }';
      expect(removeWhitespaceFromCss(input)).toBe('.a{padding:admin(1px,2px);top:fmin(1px,2px);}');
    });
  });

  describe('shortenColorsInCss', () => {
    test('shortens named colors', () => {
      const input = 'color: white; background: black; border-color: red blue yellow cyan magenta;';
      expect(shortenColorsInCss(input)).toBe(
        'color: #fff; background: #000; border-color: #f00 #00f #ff0 #0ff #f0f;'
      );
    });

    test('leaves green alone (CSS green is #008000, not lime)', () => {
      // Replacing green with #0f0 would render bright lime instead of dark
      // forest green; the keyword is already byte-shortest.
      expect(shortenColorsInCss('color: green;')).toBe('color: green;');
      expect(shortenColorsInCss('border-color: red green;')).toBe('border-color: #f00 green;');
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

    test('does not shorten colors inside strings', () => {
      expect(shortenColorsInCss('a{content:"#aabbcc";}')).toBe('a{content:"#aabbcc";}');
    });

    test('handles consecutive colors separated by space or newlines', () => {
      expect(shortenColorsInCss('border-color: red blue;')).toBe('border-color: #f00 #00f;');
      expect(shortenColorsInCss('border-color: red blue cyan;')).toBe('border-color: #f00 #00f #0ff;');
      expect(shortenColorsInCss('color: red;\nbackground: white;')).toBe('color: #f00;\nbackground: #fff;');
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

    test('does not remove units inside strings', () => {
      expect(removeUnnecessaryUnits('a{content:"x:0px";}')).toBe('a{content:"x:0px";}');
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

    test('preserves semicolon-brace pairs inside strings', () => {
      expect(removeLastSemicolonsFromCss('a{content:"value;}";}')).toBe('a{content:"value;}"}');
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

    test('preserves braces and semicolons inside declaration strings', () => {
      const input = 'body { content: "};{"; }';
      expect(combineSelectorsInCss(input)).toBe('body{content: "};{";}');
    });

    test('preserves escaped quotes outside strings in selectors', () => {
      const input = '.foo\\"bar { color: red; }';
      expect(combineSelectorsInCss(input)).toBe('.foo\\"bar{color: red;}');
    });

    test('keeps document order between regular rules and at-rule blocks (no cascade inversion)', () => {
      const input = 'body { color: red; } @media (max-width: 600px) { body { color: blue; } }';
      const output = combineSelectorsInCss(input);
      expect(output).toBe('body{color: red;}@media (max-width: 600px) {body{color: blue;}}');
      // The base rule must stay before the media override.
      expect(output.indexOf('body{color: red;}')).toBeLessThan(output.indexOf('@media'));
    });

    test('processes nested at-rule blocks (@supports, @keyframes, @layer, @container)', () => {
      const input = [
        '@supports (display: grid) { .grid { display: grid; } }',
        '@keyframes spin { from { opacity: 0; } to { opacity: 1; } }',
        '@layer base { .card { padding: 1rem; } }',
        '@container sidebar (min-width: 400px) { .card { padding: 2rem; } }'
      ].join('\n');
      const output = combineSelectorsInCss(input);
      expect(output).toContain('@supports (display: grid) {.grid{display: grid;}}');
      expect(output).toContain('@keyframes spin {from{opacity: 0;}to{opacity: 1;}}');
      expect(output).toContain('@layer base {.card{padding: 1rem;}}');
      expect(output).toContain('@container sidebar (min-width: 400px) {.card{padding: 2rem;}}');
    });

    test('recurses through at-rule nesting (@media inside @supports)', () => {
      const input = '@supports (display: grid) { @media (max-width: 600px) { .grid { display: grid; } } }';
      const output = combineSelectorsInCss(input);
      expect(output).toBe(
        '@supports (display: grid) {@media (max-width: 600px) {.grid{display: grid;}}}'
      );
    });

    test('passes @font-face and statement at-rules through without dropping them', () => {
      const input = "@font-face { font-family: 'X'; src: url('x.woff2') format('woff2'); } @import url('theme.css'); .a { color: red; }";
      const output = combineSelectorsInCss(input);
      expect(output).toContain("@font-face {font-family: 'X';src: url('x.woff2') format('woff2')}");
      expect(output).toContain("@import url('theme.css');");
      expect(output).toContain('.a{color: red;}');
      // The @import statement must survive before the rule that follows it.
      expect(output.indexOf('@import')).toBeLessThan(output.indexOf('.a{'));
    });

    test('normalizes declarations in @font-face and @page bodies', () => {
      const input = "@font-face { font-family: 'X' ; ; src: url('x.woff2') format('woff2'); } @page { margin: 1cm ; }";
      const output = combineSelectorsInCss(input);
      expect(output).toContain("@font-face {font-family: 'X';src: url('x.woff2') format('woff2')}");
      expect(output).toContain('@page {margin: 1cm}');
    });

    test('processes every rule in a sequence of three or more rules', () => {
      const input = '.a{color:red;}.b{color:blue;}.c{color:green;}.d{color:yellow;}';
      expect(combineSelectorsInCss(input)).toBe(
        '.a{color:red;}.b{color:blue;}.c{color:green;}.d{color:yellow;}'
      );
    });

    test('keeps every rule inside nested at-rule blocks with three or more rules', () => {
      const input = '@media (min-width:768px){.a{color:red;}.b{color:blue;}.c{color:green;}}';
      expect(combineSelectorsInCss(input)).toBe(
        '@media (min-width:768px){.a{color:red;}.b{color:blue;}.c{color:green;}}'
      );
    });

    test('leaves a malformed at-rule without a block or semicolon untouched', () => {
      expect(combineSelectorsInCss('@media screen')).toBe('@media screen');
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
    const expected = '.test{color:#f00;margin:0}';
    expect(minifyCSS(input)).toBe(expected);
  });

  test('preserves important syntax and removes unnecessary units', () => {
    const input = `
      .test {
        color: red !important;
        padding: 0px 10px;
      }
    `;
    const expected = '.test{color:#f00!important;padding:0 10px}';
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
    const expected = '@media (max-width:600px){.test{color:#f00}}';
    expect(minifyCSS(input)).toBe(expected);
  });

  test('minifies calc(), nested at-rules, and cascade order without corrupting them', () => {
    const input = `
      body { color: green; }
      @supports (display: grid) {
        .box { width: calc(100% + 20px); }
      }
      @media (max-width: 600px) {
        body { color: blue; }
      }
    `;
    const expected = 'body{color:green}@supports (display:grid){.box{width:calc(100% + 20px)}}@media (max-width:600px){body{color:#00f}}';
    expect(minifyCSS(input)).toBe(expected);
  });

  test('normalizes multiline calc() through the full pipeline', () => {
    const input = '.box {\n  width: calc(\n    100% -\n    20px\n  );\n}';
    expect(minifyCSS(input)).toBe('.box{width:calc(100% - 20px)}');
  });

  test('minifies three or more sequential rules without dropping any', () => {
    const input = '.a { color: red; } .b { color: blue; } .c { color: cyan; }';
    expect(minifyCSS(input)).toBe('.a{color:#f00}.b{color:#00f}.c{color:#0ff}');
  });

  test('preserves comment markers and minifier delimiters inside content strings', () => {
    const input = '.test::before { content: "a, b + c > d /* keep */; }"; }';
    const expected = '.test::before{content:"a, b + c > d /* keep */; }"}';
    expect(minifyCSS(input)).toBe(expected);
  });

  test('skips steps whose option is turned off', () => {
    const input = '.a { color: red; margin: 0px; } /* note */';
    const options = { ...DEFAULT_MINIFY_OPTIONS, shortenColors: false, removeUnits: false, removeLastSemicolons: false };
    expect(minifyCSS(input, options)).toBe('.a{color:red;margin:0px;}');
  });

  test('is a pure transform that leaves validation to the caller', () => {
    expect(() => minifyCSS('body { color: red')).not.toThrow();
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

  describe('with constructable stylesheets (replaceSync)', () => {
    const OriginalCSSStyleSheet = globalThis.CSSStyleSheet;
    let parsedRules: Array<{ style: { length: number } }>;
    let replaceSync: jest.Mock;

    beforeEach(() => {
      parsedRules = [{ style: { length: 1 } }];
      replaceSync = jest.fn();
      class StubSheet {
        get cssRules() {
          return parsedRules;
        }
      }
      (StubSheet.prototype as unknown as { replaceSync: jest.Mock }).replaceSync = replaceSync;
      (globalThis as { CSSStyleSheet: unknown }).CSSStyleSheet = StubSheet;
    });

    afterEach(() => {
      (globalThis as { CSSStyleSheet: unknown }).CSSStyleSheet = OriginalCSSStyleSheet;
    });

    test('parses detached without touching the live document head', () => {
      const appendSpy = jest.spyOn(document.head, 'appendChild');
      try {
        expect(isValidCSS('body { color: red; }')).toBe(true);
        expect(replaceSync).toHaveBeenCalledWith('body { color: red; }');
        expect(appendSpy).not.toHaveBeenCalled();
      } finally {
        appendSpy.mockRestore();
      }
    });

    test('applies the same empty-declaration heuristic to detached rules', () => {
      parsedRules = [{ style: { length: 0 } }];
      expect(isValidCSS('body { color: }')).toBe(false);
    });

    test('falls back to a <style> element for @import, which replaceSync drops', () => {
      const appendSpy = jest.spyOn(document.head, 'appendChild');
      try {
        isValidCSS('@import url("a.css");');
        expect(replaceSync).not.toHaveBeenCalled();
        expect(appendSpy).toHaveBeenCalled();
      } finally {
        appendSpy.mockRestore();
      }
    });
  });

  test('cleans up the style element from document.head after validation', () => {
    const initialHeadChildCount = document.head.children.length;
    isValidCSS('body { color: red; }');
    expect(document.head.children.length).toBe(initialHeadChildCount);
  });
});
