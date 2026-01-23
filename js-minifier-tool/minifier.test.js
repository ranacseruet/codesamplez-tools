import { JSMinifier } from './minifier.js';

describe('JS Minifier', () => {
  describe('configuration options', () => {
    test('should respect removeComments=false', () => {
      const minifier = new JSMinifier({ removeComments: false });
      const input = `// comment\nconst x = 1;`;
      expect(minifier.minify(input)).toBe(`//comment const x=1;`);
    });

    test('should respect removeWhitespace=false', () => {
      const minifier = new JSMinifier({ removeWhitespace: false });
      const input = `const x = 1; \n const y = 2;`;
      expect(minifier.minify(input)).toBe(input.trim());
    });

    test('should handle all options disabled', () => {
      const minifier = new JSMinifier({
        removeComments: false,
        removeWhitespace: false,
        shortenVariables: false,
        mangleProperties: false
      });
      const input = `// comment\nconst x = 1; \n const y = 2;`;
      expect(minifier.minify(input)).toBe(input.trim());
    });
  });

  const minifier = new JSMinifier();
  const originalConsoleLog = console.log;

  beforeEach(() => {
    console.log = jest.fn();
  });

  afterEach(() => {
    console.log = originalConsoleLog;
  });

  test('should remove comments', () => {
    const input = `// comment\nconst x = 1;`;
    const output = `const x=1;`;
    expect(minifier.minify(input)).toBe(output);
  });

  test('should remove whitespace', () => {
    const input = `const x = 1; \n const y = 2;`;
    const output = `const x=1;const y=2;`;
    expect(minifier.minify(input)).toBe(output);
  });

  describe('string handling', () => {
    test('should preserve strings when removing comments', () => {
      const input = `const str = "// not a comment"; // real comment`;
      const output = `const str="// not a comment";`;
      expect(minifier.minify(input)).toBe(output);
    });

    test('should preserve template literals when removing comments', () => {
      const input = `const str = \`/* not a comment */\`; /* real comment */`;
      const output = `const str=\`/* not a comment */\`;`;
      expect(minifier.minify(input)).toBe(output);
    });

    test('should preserve regex patterns when removing comments', () => {
      const input = `const regex = /\\/\\/ not a comment/g; // real comment`;
      const output = `const regex=/\\/\\/ not a comment/g;`;
      expect(minifier.minify(input)).toBe(output);
    });

    test('should handle escaped quotes in strings', () => {
      const input = `const str = "\\"quoted\\""; // comment`;
      const output = `const str="\\"quoted\\"";`;
      expect(minifier.minify(input)).toBe(output);
    });

    test('should handle complex template literals', () => {
      const input = `const str = \`\${name}'s template with \${count} items\`;`;
      const output = `const str=\`\${name}'s template with \${count} items\`;`;
      expect(minifier.minify(input)).toBe(output);
    });

    test('should handle regex with special characters', () => {
      const input = `const regex = /^[a-z]+\\d{2,3}$/gi;`;
      const output = `const regex=/^[a-z]+\\d{2,3}$/gi;`;
      expect(minifier.minify(input)).toBe(output);
    });
  });

  describe('variable shortening', () => {
    test('should not shorten variables when disabled', () => {
      const minifier = new JSMinifier({ shortenVariables: false });
      const input = `function test() { const longVariableName = 1; return longVariableName; }`;
      const output = `function test(){const longVariableName=1;return longVariableName;}`;
      expect(minifier.minify(input)).toBe(output);
    });

    test('should shorten variables when enabled', () => {
      const minifier = new JSMinifier({ shortenVariables: true });
      const input = `function test() { const longVariableName = 1; return longVariableName; }`;
      const output = minifier.minify(input);
      expect(output).toMatch(/function test\(\)\{const [a-zA-Z$_][a-zA-Z0-9$_]*=1;return [a-zA-Z$_][a-zA-Z0-9$_]*;?\}/);
      expect(output.length).toBeLessThan(input.length);
    });

    test('should shorten local variables even if they shadow globals', () => {
      const minifier = new JSMinifier({ shortenVariables: true });
      const input = `function test() { const window = 1; return window; }`;
      const output = minifier.minify(input);
      expect(output).toMatch(/function test\(\)\{const [a-zA-Z$_][a-zA-Z0-9$_]*=1;return [a-zA-Z$_][a-zA-Z0-9$_]*;?\}/);
      expect(output.length).toBeLessThan(input.length);
    });

    test('should handle nested functions with same variable names', () => {
      const minifier = new JSMinifier({ shortenVariables: true });
      const input = `function outer() { 
        const x = 1; 
        function inner() { 
          const x = 2; 
          return x; 
        } 
        return x + inner(); 
      }`;
      const output = minifier.minify(input);
      expect(output).toMatch(/function outer\(\)\{const [a-zA-Z$_][a-zA-Z0-9$_]*=1;function inner\(\)\{const [a-zA-Z$_][a-zA-Z0-9$_]*=2;return [a-zA-Z$_][a-zA-Z0-9$_]*;?\}return [a-zA-Z$_][a-zA-Z0-9$_]*\+inner\(\);?\}/);
    });

    test('should handle closures with outer scope variables', () => {
      const minifier = new JSMinifier({ shortenVariables: true });
      const input = `function createCounter() { 
        let count = 0; 
        return function() { 
          return ++count; 
        }; 
      }`;
      const output = minifier.minify(input);
      
      // Verify the closure behavior works by executing the minified code
      const counter = new Function(`return ${output}`)()();
      expect(counter()).toBe(1);
      expect(counter()).toBe(2);
      expect(counter()).toBe(3);
    });

    test('should NOT replace variable names inside strings', () => {
      const minifier = new JSMinifier({ shortenVariables: true });
      const input = `const myVar = 1; return "myVar";`;
      const output = minifier.minify(input);
      expect(output).toContain('"myVar"');
      expect(output).not.toContain('const myVar=');
    });

    test('should NOT replace object property keys that match variable names', () => {
      const minifier = new JSMinifier({ shortenVariables: true });
      const input = `const key = 1; const obj = { key: 2 }; return obj.key;`;
      const output = minifier.minify(input);
      expect(output).toMatch(/key:2/);
      expect(output).toMatch(/\.key/);
      expect(output).not.toContain('const key=');
    });
  });

  describe('property mangling', () => {
    test('should not mangle properties when disabled', () => {
      const minifier = new JSMinifier({ mangleProperties: false });
      const input = `const obj = { longPropertyName: 1 }; obj.longPropertyName;`;
      const output = `const obj={longPropertyName:1};obj.longPropertyName;`;
      expect(minifier.minify(input)).toBe(output);
    });

    test('should mangle dot notation properties when enabled', () => {
      const minifier = new JSMinifier({ mangleProperties: true });
      const input = `const obj = { longPropertyName: 1 }; obj.longPropertyName;`;
      const output = minifier.minify(input);
      expect(output).toMatch(/const obj=\{[a-zA-Z$_][a-zA-Z0-9$_]*:1\};obj\.[a-zA-Z$_][a-zA-Z0-9$_]*;/);
      expect(output.length).toBeLessThan(input.length);
    });

    test('should mangle bracket notation properties when enabled', () => {
      const minifier = new JSMinifier({ mangleProperties: true });
      const input = `const obj = { 'longPropertyName': 1 }; obj['longPropertyName'];`;
      const output = minifier.minify(input);
      expect(output).toMatch(/const obj=\{"[a-zA-Z$_][a-zA-Z0-9$_]*":1\};obj\["[a-zA-Z$_][a-zA-Z0-9$_]*"\];/);
      expect(output.length).toBeLessThan(input.length);
    });

    test('should not mangle common properties', () => {
      const minifier = new JSMinifier({ mangleProperties: true });
      const input = `const arr = []; arr.length;`;
      const output = `const arr=[];arr.length;`;
      expect(minifier.minify(input)).toBe(output);
    });

    test('should handle nested object properties', () => {
      const minifier = new JSMinifier({ mangleProperties: true });
      const input = `const obj = { nested: { deepProperty: 1 } }; obj.nested.deepProperty;`;
      const output = minifier.minify(input);
      expect(output).toMatch(/const obj=\{nested:\{[a-zA-Z$_][a-zA-Z0-9$_]*:1\}\};obj\.[a-zA-Z$_][a-zA-Z0-9$_]*\.[a-zA-Z$_][a-zA-Z0-9$_]*;/);
    });

    test('should handle computed properties', () => {
      const minifier = new JSMinifier({ mangleProperties: true });
      const input = `const prop = 'name'; const obj = { [prop]: 'value' }; obj[prop];`;
      const output = minifier.minify(input);
      expect(output).toMatch(/const prop='name';const obj=\{\[prop\]:["']\w+["']\};obj\[prop\];/);
    });
  });

  describe('syntax validation', () => {
    test('should validate correct JavaScript', () => {
      const validCode = `const x = 1;`;
      expect(minifier.isValidJavaScript(validCode)).toBe(true);
      expect(console.log).not.toHaveBeenCalled();
    });

    test('should detect syntax errors', () => {
      const invalidCode = `const x = ;`;
      expect(minifier.isValidJavaScript(invalidCode)).toBe(false);
      expect(console.log).toHaveBeenCalledWith(
        'Invalid JavaScript: ', 
        expect.stringContaining('Unexpected token')
      );
    });

    test('should accept code that throws errors', () => {
      const errorCode = `throw new Error('test');`;
      expect(minifier.isValidJavaScript(errorCode)).toBe(true);
      expect(console.log).not.toHaveBeenCalled();
    });

    test('should handle empty string input', () => {
      expect(minifier.minify('')).toBe('');
      expect(console.log).not.toHaveBeenCalled();
    });

    test('should handle non-string input', () => {
      expect(minifier.minify(null)).toBe('');
      expect(minifier.minify(undefined)).toBe('');
      expect(minifier.minify(123)).toBe('');
      expect(console.log).not.toHaveBeenCalled();
    });

    test('should handle invalid syntax with minify', () => {
      const invalidCode = `const x = ;`;
      expect(() => minifier.minify(invalidCode)).toThrow('Invalid JavaScript syntax');
    });

    test('should handle complex syntax structures', () => {
      const complexCode = `class Test { 
        #privateField = 1; 
        method() { 
          return this.#privateField; 
        } 
      }`;
      expect(minifier.isValidJavaScript(complexCode)).toBe(true);
    });

    test('should handle async/await syntax', () => {
      const asyncCode = `async function test() { 
        await Promise.resolve(); 
        return 42; 
      }`;
      expect(minifier.isValidJavaScript(asyncCode)).toBe(true);
    });

    test('should handle dynamic imports', () => {
      const importCode = `const module = await import('./module.js');`;
      expect(minifier.isValidJavaScript(importCode)).toBe(false);
    });

    test('should re-throw non-SyntaxError exceptions', () => {
      const originalError = new Error('Custom error');
      const throwingCode = `throw originalError;`;
      
      // Mock the Function constructor to throw our custom error
      const originalFunction = global.Function;
      global.Function = jest.fn().mockImplementation(() => {
        throw originalError;
      });

      try {
        expect(() => minifier.isValidJavaScript(throwingCode)).toThrow(originalError);
      } finally {
        global.Function = originalFunction;
      }
    });
  });

  describe('string placeholder handling', () => {
    test('should correctly restore string placeholders', () => {
      const input = `const str1 = "// not a comment"; const str2 = '/* not a comment */';`;
      const output = `const str1="// not a comment";const str2='/* not a comment */';`;
      expect(minifier.minify(input)).toBe(output);
    });

    test('should handle multiple string placeholders', () => {
      const input = `const str1 = "string1"; const str2 = "string2"; const str3 = "string3";`;
      const output = `const str1="string1";const str2="string2";const str3="string3";`;
      expect(minifier.minify(input)).toBe(output);
    });

    test('should handle empty strings', () => {
      const input = `const empty = "";`;
      const output = `const empty="";`;
      expect(minifier.minify(input)).toBe(output);
    });
  });

  describe('keyword spacing', () => {
    test('should maintain proper spacing for keywords', () => {
      const input = `if(x)return;else if(y)throw new Error();`;
      const output = `if(x)return;else if(y)throw new Error();`;
      expect(minifier.minify(input)).toBe(output);
    });

    test('should handle complex keyword combinations', () => {
      const input = `function test(){return x instanceof Array&&y in obj;}`;
      const output = `function test(){return x instanceof Array&&y in obj;}`;
      expect(minifier.minify(input)).toBe(output);
    });

    test('should handle typeof operator', () => {
      const input = `const type=typeof x;`;
      const output = `const type=typeof x;`;
      expect(minifier.minify(input)).toBe(output);
    });
  });
});
