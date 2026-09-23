import { jest } from '@jest/globals';
import { runInNewContext } from 'node:vm';
import { JSMinifier } from './minifier';

describe('JS Minifier', () => {
  describe('configuration options and defaults', () => {
    test('uses expected default options when no config is passed', () => {
      const minifier = new JSMinifier();
      expect(minifier.options).toEqual({
        removeComments: true,
        removeWhitespace: true,
        shortenVariables: false,
        mangleProperties: false
      });
    });

    test('should respect removeComments=false in minify', () => {
      const minifier = new JSMinifier({ removeComments: false });
      const input = `// comment\nconst x = 1;`;
      expect(minifier.minify(input)).toBe(`// comment\nconst x=1;`);
    });

    test('should respect removeWhitespace=false in minify', () => {
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

    test('returns original code when removeComments is called with removeComments=false', () => {
      const minifier = new JSMinifier({ removeComments: false });
      const input = `// comment\nconst x = 1;`;
      expect(minifier.removeComments(input)).toBe(input);
    });

    test('removes comments by source range while preserving line breaks', () => {
      const minifier = new JSMinifier({ removeWhitespace: false });
      const input = `const x = 1; // line comment\nconst y = 2; /* block comment */`;
      const output = minifier.removeComments(input);

      expect(output).not.toContain('// line comment');
      expect(output).not.toContain('/* block comment */');
      expect(output.split('\n')).toHaveLength(2);
      expect(minifier.minify(input)).toBe(output);
    });

    test('removes comment text without retaining its width as whitespace', () => {
      const minifier = new JSMinifier({ removeWhitespace: false });
      const input = `const x = 1; // note\nconst y = 2; /* note */ const z = 3;`;
      const output = minifier.removeComments(input);

      expect(output).toBe(`const x = 1;\nconst y = 2; const z = 3;`);
      expect(output.length).toBeLessThan(input.length);
      expect(minifier.minify(input)).toBe(output);
    });

    test('keeps token boundaries when removing comments', () => {
      const minifier = new JSMinifier({ removeWhitespace: false });
      const input = `function read() { return/* comment */value; } const value = 7;`;
      const output = minifier.removeComments(input);

      expect(output).toContain('return value');
      expect(new Function(`${output}; return read();`)()).toBe(7);
    });

    test('preserves U+2028 line terminators inside removed comments', () => {
      const minifier = new JSMinifier({ removeWhitespace: false });
      const lineSeparator = '\u2028';
      const input = `function read(){return/*${lineSeparator}*/value;} const value=7;`;
      const output = minifier.removeComments(input);

      expect(output).toContain(`return${lineSeparator}value`);
      expect(new Function(`${output}; return read();`)()).toBeUndefined();
    });

    test('preserves U+2029 line terminators inside removed comments', () => {
      const minifier = new JSMinifier({ removeWhitespace: false });
      const paragraphSeparator = '\u2029';
      const input = `function read(){return/*${paragraphSeparator}*/value;} const value=7;`;
      const output = minifier.removeComments(input);

      expect(output).toContain(`return${paragraphSeparator}value`);
      expect(new Function(`${output}; return read();`)()).toBeUndefined();
    });

    test('uses the syntax-aware generator for the whitespace helper', () => {
      expect(new JSMinifier().removeWhitespace('const x = 1;')).toBe('const x=1;');
    });

    test('returns original code when shortenVariableNames is called with shortenVariables=false', () => {
      const minifier = new JSMinifier({ shortenVariables: false });
      const input = `function test() { const longName = 1; return longName; }`;
      expect(minifier.shortenVariableNames(input)).toBe(input);
    });

    test('shortens bindings through the syntax-aware helper', () => {
      const minifier = new JSMinifier({ shortenVariables: true });

      expect(minifier.shortenVariableNames('const longName = 1;')).toBe('const a=1;');
    });

    test('returns original code when mangleObjectProperties is called with mangleProperties=false', () => {
      const minifier = new JSMinifier({ mangleProperties: false });
      const input = `const obj = { customProp: 1 }; obj.customProp;`;
      expect(minifier.mangleObjectProperties(input)).toBe(input);
    });

    test('returns the original code when direct property mangling receives invalid JavaScript', () => {
      const minifier = new JSMinifier({ mangleProperties: true });
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const input = 'const x = ;';

      expect(minifier.mangleObjectProperties(input)).toBe(input);
      expect(warnSpy).toHaveBeenCalledWith('AST Parse failed, falling back to original code', expect.any(Error));

      warnSpy.mockRestore();
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

  test('should preserve token boundaries between unary and binary operators', () => {
    const input = `function addPositive(a, b) { return a + +b; }`;
    const output = minifier.minify(input);

    expect(output).toContain('a+ +b');
    expect(new Function(`${output} return addPositive(2, 3);`)()).toBe(5);
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

    test('should preserve regex literals containing // and following code', () => {
      const input = `const regex = /ab\\/\\/x/; const ok = 1;`;
      const output = minifier.minify(input);

      expect(output).toBe(`const regex=/ab\\/\\/x/;const ok=1;`);
      expect(new Function(`${output} return regex.test('ab//x');`)()).toBe(true);
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
      const output = `function test(){const longVariableName=1;return longVariableName}`;
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

    test('should avoid renaming to short names that collide with globals', () => {
      const minifier = new JSMinifier({ shortenVariables: true });
      const input = `function test(){const longVariableName=1;return longVariableName+a;}`;
      const output = minifier.minify(input);

      expect(output).toContain('const b=1');
      expect(output).toContain('return b+a');
    });

    test('generates multi-character variable names when variable count exceeds single-character alphabet', () => {
      const minifier = new JSMinifier({ shortenVariables: true });
      // Generate 60 distinct variables in a function
      const varDeclarations = Array.from({ length: 60 }, (_, i) => `const var_${i} = ${i};`).join('\n');
      const varSum = Array.from({ length: 60 }, (_, i) => `var_${i}`).join(' + ');
      const input = `function calculateLots() {\n${varDeclarations}\nreturn ${varSum};\n}`;
      const output = minifier.minify(input);

      expect(output).toContain('function calculateLots()');
      // Should execute correctly and compute sum 0..59 = 1770
      const fn = new Function(`return ${output}`)();
      expect(fn()).toBe((59 * 60) / 2);
    });

    test('preserves class declarations and method names when shortening variables', () => {
      const minifier = new JSMinifier({ shortenVariables: true });
      const input = `class Calculator { add(valA, valB) { const sum = valA + valB; return sum; } }`;
      const output = minifier.minify(input);
      expect(output).toContain('class Calculator');
      expect(output).toContain('add(');
    });

    test('should fall back to original code when AST parsing throws', () => {
      const minifier = new JSMinifier({ shortenVariables: true });
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      // Syntactically invalid JS the Babel parser rejects. shortenVariableNames is
      // called directly here (not via minify), so it skips the upstream syntax
      // guard and exercises the parser's own throw -> catch/fallback path.
      const input = 'const = = =;';

      expect(minifier.shortenVariableNames(input)).toBe(input);
      expect(warnSpy).toHaveBeenCalledWith('AST Parse failed, falling back to original code', expect.any(Error));

      warnSpy.mockRestore();
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
      const propertyMatch = output.match(/const obj=\{([a-zA-Z$_][a-zA-Z0-9$_]*):1\};obj\.([a-zA-Z$_][a-zA-Z0-9$_]*);/);

      expect(propertyMatch).not.toBeNull();
      expect(propertyMatch![1]).toBe(propertyMatch![2]);
      expect(new Function(`${output} return obj.${propertyMatch![1]};`)()).toBe(1);
      expect(output.length).toBeLessThan(input.length);
    });

    test('should mangle bracket notation properties when enabled', () => {
      const minifier = new JSMinifier({ mangleProperties: true });
      const input = `const obj = { 'longPropertyName': 1 }; obj['longPropertyName'];`;
      const output = minifier.minify(input);
      const propertyMatch = output.match(/const obj=\{['"]([a-zA-Z$_][a-zA-Z0-9$_]*)['"]:1\};obj\[['"]([a-zA-Z$_][a-zA-Z0-9$_]*)['"]\];/);

      expect(propertyMatch).not.toBeNull();
      expect(propertyMatch![1]).toBe(propertyMatch![2]);
      expect(new Function(`${output} return obj[${JSON.stringify(propertyMatch![1])}];`)()).toBe(1);
      expect(output.length).toBeLessThan(input.length);
    });

    test('should not mangle common properties', () => {
      const minifier = new JSMinifier({ mangleProperties: true });
      const input = `const arr = []; arr.length; arr.toString(); arr.valueOf();`;
      const output = `const arr=[];arr.length;arr.toString();arr.valueOf();`;
      expect(minifier.minify(input)).toBe(output);
    });

    test('should handle nested object properties', () => {
      const minifier = new JSMinifier({ mangleProperties: true });
      const input = `const obj = { nested: { deepProperty: 1 } }; return obj.nested.deepProperty;`;
      const output = minifier.minify(input);
      const propertyMatch = output.match(/const obj=\{([a-zA-Z$_][a-zA-Z0-9$_]*):\{deepProperty:1\}\};return obj\.([a-zA-Z$_][a-zA-Z0-9$_]*)\.deepProperty;/);

      expect(propertyMatch).not.toBeNull();
      expect(propertyMatch![1]).toBe(propertyMatch![2]);
      expect(new Function(output)()).toBe(1);
    });

    test('should handle computed properties', () => {
      const minifier = new JSMinifier({ mangleProperties: true });
      const input = `const prop = 'name'; const obj = { [prop]: 'value' }; obj[prop];`;
      const output = minifier.minify(input);

      expect(new Function(`${output} return obj[prop];`)()).toBe('value');
    });

    test('preserves string values that match mangled property names', () => {
      const minifier = new JSMinifier({ mangleProperties: true });
      const input = `const message = "longPropertyName"; const obj = { "longPropertyName": "longPropertyName" }; const result = obj.longPropertyName;`;
      const output = minifier.minify(input);
      const result = new Function(`${output} return { message, result };`)();

      expect(result).toEqual({ message: 'longPropertyName', result: 'longPropertyName' });
      expect(output).toContain('obj.a');
      expect(output).not.toContain('obj.longPropertyName');
    });

    test('preserves property names used by object destructuring', () => {
      const minifier = new JSMinifier({ mangleProperties: true });
      const input = `const source = { longPropertyName: 7 }; function read(input) { const { longPropertyName } = input; return longPropertyName; }`;
      const output = minifier.minify(input);

      expect(output).toContain('{longPropertyName}');
      expect(new Function(`${output} return read({ longPropertyName: 7 });`)()).toBe(7);
    });

    test('avoids collisions with existing properties and leaves external properties unchanged', () => {
      const minifier = new JSMinifier({ mangleProperties: true });
      const input = `const data = { longProp: 1, a: 2 }; return [data.longProp, data.a, external.a];`;
      const output = minifier.minify(input);

      expect(output).toContain('{b:1,c:2}');
      expect(output).toContain('external.a');
      expect(new Function('external', output)({ a: 3 })).toEqual([1, 2, 3]);
    });

    test('does not mangle external built-in and platform properties', () => {
      const minifier = new JSMinifier({ mangleProperties: true });
      const input = `const promise = Promise.resolve('value').then(response => response.json()).catch(console.error); const replaced = 'abc'.replace('a', 'x').trim(); const timestamp = new Date(0).getTime(); const moduleUrl = import.meta.url;`;
      const output = minifier.minify(input);

      for (const property of ['resolve', 'then', 'json', 'catch', 'error', 'replace', 'trim', 'getTime']) {
        expect(output).toContain(`.${property}`);
      }
      expect(output).toContain('import.meta.url');
    });

    test('preserves API and descriptor object keys', () => {
      const minifier = new JSMinifier({ mangleProperties: true });
      const input = `const local = { longProperty: 1 }; fetch('/api', { method: 'POST', body: 'payload' }); const target = {}; Object.defineProperty(target, 'field', { value: 1, configurable: true }); return local.longProperty;`;
      const output = minifier.minify(input);

      expect(output).toContain('method:"POST"');
      expect(output).toContain('body:"payload"');
      expect(output).toContain('value:1');
      expect(output).toContain('configurable:true');
      expect(new Function('fetch', output)(() => {})).toBe(1);
    });

    test('leaves objects used with reflective property APIs unchanged', () => {
      const minifier = new JSMinifier({ mangleProperties: true });
      const input = `function read(descriptor) { const obj = { longProperty: 1 }; Object.defineProperty(obj, 'a', descriptor); return obj.longProperty; } return read({ value: 2, writable: true, configurable: true });`;
      const output = minifier.minify(input);

      expect(output).toContain('obj.longProperty');
      expect(new Function(output)()).toBe(1);
    });

    test('leaves objects used as direct and indirect method receivers unchanged', () => {
      const minifier = new JSMinifier({ mangleProperties: true });
      for (const invocation of ['obj.getName()', 'obj.getName?.()', 'obj.getName.call(obj)']) {
        const input = `function getName() { return this.name; } const obj = { name: 'tom', getName }; return ${invocation};`;
        const output = minifier.minify(input);

        expect(output).toContain('name:"tom"');
        expect(new Function(output)()).toBe('tom');
      }
    });

    test('does not collide with properties added by legacy reflection', () => {
      const minifier = new JSMinifier({ mangleProperties: true });
      const input = `const obj = { longProperty: 1 }; obj.__defineGetter__('a', () => 2); return obj.longProperty;`;
      const output = minifier.minify(input);

      expect(output).toContain('obj.longProperty');
      expect(new Function(output)()).toBe(1);
    });

    test('leaves object properties visible to direct eval unchanged', () => {
      const minifier = new JSMinifier({ mangleProperties: true, shortenVariables: true });
      const input = `function read() { const obj = { longProperty: 1 }; return eval('obj.longProperty'); } return read();`;
      const output = minifier.minify(input);

      expect(output).toContain('const obj=');
      expect(output).toContain('longProperty:1');
      expect(new Function(output)()).toBe(1);
    });

    test.each([
      ['optional eval calls', '', `eval?.('obj.longProperty')`],
      ['sequence eval calls', '', `(0, eval)('obj.longProperty')`],
      ['global eval calls', '', `globalThis.eval('obj.longProperty')`],
      ['optional global eval calls', '', `globalThis?.eval('obj.longProperty')`],
      ['template global eval calls', '', `globalThis[\`eval\`]('obj.longProperty')`],
      ['self eval aliases', 'globalThis.self=globalThis;', `self.eval('obj.longProperty')`],
      ['global eval aliases', 'globalThis.global=globalThis;', `global.eval('obj.longProperty')`],
      ['top-level this eval', '', `this.eval('obj.longProperty')`],
      ['arrow lexical this eval', '', `(() => this.eval('obj.longProperty'))()`],
      ['Function constructor calls', '', `Function('return obj.longProperty')()`],
      ['new Function constructor calls', '', `new Function('return obj.longProperty')()`],
      ['global Function constructors', '', `globalThis.Function('return obj.longProperty')()`],
      ['aliased Function constructors', 'const Fn = Function;', `Fn('return obj.longProperty')()`],
      ['aliased global Function constructors', 'const g = globalThis;', `g.Function('return obj.longProperty')()`],
      ['aliased global eval calls', 'const g = globalThis;', `g.eval('obj.longProperty')`],
      ['template destructured eval', 'const { [\`eval\`]: runEval } = globalThis;', `runEval('obj.longProperty')`],
      ['destructured global eval', 'const { eval: runEval } = globalThis;', `runEval('obj.longProperty')`],
      ['destructured global Function', 'const { Function: runFunction } = globalThis;', `runFunction('return obj.longProperty')()`]
    ])('leaves top-level bindings and properties visible to indirect %s unchanged', (_kind, setup, evalCall) => {
      const minifier = new JSMinifier({ mangleProperties: true, shortenVariables: true });
      const input = `const obj = { longProperty: 1 }; ${setup} globalThis.result = ${evalCall};`;
      const run = (code: string) => {
        const context: { result?: unknown } = {};
        runInNewContext(code, context);
        return context.result;
      };
      const output = minifier.minify(input);

      expect(run(input)).toBe(1);
      expect(output).toContain('const obj=');
      expect(output).toContain('longProperty:1');
      expect(run(output)).toBe(1);
    });

    test('leaves object properties referenced inside with statements unchanged', () => {
      const minifier = new JSMinifier({ mangleProperties: true, shortenVariables: true });
      const input = `const obj = { longProperty: 1 }; const other = { obj: { longProperty: 2 } }; with (other) { return obj.longProperty; }`;
      const output = minifier.minify(input);

      expect(output).toContain('obj.longProperty');
      expect(new Function(output)()).toBe(2);
    });

    test('preserves special object prototype setters and class constructors', () => {
      const minifier = new JSMinifier({ mangleProperties: true });
      const input = `const data = { ['__proto__']: 2, constructor: 1 }; const prototype = {}; const value = { __proto__: prototype }; class Example { constructor() { this.initialized = true; } } return [data.__proto__, data.constructor, Object.getPrototypeOf(value) === prototype, new Example().initialized];`;
      const output = minifier.minify(input);

      expect(new Function(output)()).toEqual([2, 1, true, true]);
    });

    test('mangles optional access and shorthand keys on a local object', () => {
      const minifier = new JSMinifier({ mangleProperties: true });
      const input = `const longPropertyName = 1; const obj = { longPropertyName }; return obj?.longPropertyName;`;
      const output = minifier.minify(input);

      expect(output).toMatch(/\{a:longPropertyName\}/);
      expect(new Function(output)()).toBe(1);
    });

    test('does not mangle chained access as a root object property', () => {
      const minifier = new JSMinifier({ mangleProperties: true });
      const input = `const obj = { nested: { deepProperty: 1 }, deepProperty: 2 }; return obj.nested.deepProperty + obj.deepProperty;`;
      const output = minifier.minify(input);

      expect(output).toContain('.deepProperty');
      expect(new Function(output)()).toBe(3);
    });

    test('leaves properties unchanged when the local object binding is reassigned', () => {
      const minifier = new JSMinifier({ mangleProperties: true });
      const input = `function read(external) { let obj = { longProperty: 1 }; obj = external; return obj.longProperty; } return read({ longProperty: 2 });`;
      const output = minifier.minify(input);

      expect(output).toContain('longProperty');
      expect(new Function(output)()).toBe(2);
    });

    test('leaves object methods and class properties unchanged', () => {
      const minifier = new JSMinifier({ mangleProperties: true });
      const input = `const obj = { longProperty: 1, longMethod() { return this.longProperty; } }; class Example { longField = 2; longClassMethod() { return this.longField; } } return [obj.longMethod(), new Example().longClassMethod()];`;
      const output = minifier.minify(input);

      expect(output).toContain('longMethod');
      expect(output).toContain('longField');
      expect(new Function(output)()).toEqual([1, 2]);
    });

    test('generates multi-character property names when properties count exceeds 54', () => {
      const minifier = new JSMinifier({ mangleProperties: true });
      const props = Array.from({ length: 60 }, (_, i) => `prop_${i}`);
      const objectProperties = props.map((property) => `${property}: 1`).join(',');
      const propertyAssignments = props.map((property) => `obj.${property} = 1;`).join(' ');
      const input = `const obj = { ${objectProperties} }; ${propertyAssignments} return obj.prop_0 + obj.prop_59;`;
      const output = minifier.mangleObjectProperties(input);

      expect(output).not.toContain('prop_0');
      expect(output).not.toContain('prop_59');
      expect(new Function(output)()).toBe(2);
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
      expect(minifier.minify(123 as any)).toBe('');
      expect(console.log).not.toHaveBeenCalled();
    });

    test('should handle invalid syntax with minify', () => {
      const invalidCode = `const x = ;`;
      expect(() => minifier.minify(invalidCode)).toThrow('Invalid JavaScript syntax');
    });

    test('minify surfaces the parser message detail for invalid syntax', () => {
      const invalidCode = `const x = ;`;
      // The thrown error must carry the underlying SyntaxError detail so the UI
      // can show a specific validation message instead of a generic notice.
      expect(() => minifier.minify(invalidCode)).toThrow(/Invalid JavaScript syntax: .*Unexpected token/);
    });

    test('getSyntaxError returns the SyntaxError for invalid code and null for valid code', () => {
      expect(minifier.getSyntaxError('const x = 1;')).toBeNull();
      const error = minifier.getSyntaxError('const x = ;');
      expect(error).toBeInstanceOf(SyntaxError);
      expect(error!.message).toContain('Unexpected token (1:10)');
    });

    test('reports line and column for invalid module input', () => {
      const invalidCode = `export const x = 1;\nconst y = ;`;
      const error = minifier.getSyntaxError(invalidCode);

      expect(error).toBeInstanceOf(SyntaxError);
      expect(error!.message).toContain('(2:10)');
      expect(() => minifier.minify(invalidCode)).toThrow(/Invalid JavaScript syntax: .*\(2:10\)/);
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
      expect(minifier.isValidJavaScript(importCode)).toBe(true);
    });

    test('should accept and minify ES modules and top-level await', () => {
      const moduleCode = `import value from './value.js'; export const result = await value;`;

      expect(minifier.isValidJavaScript(moduleCode)).toBe(true);
      const output = minifier.minify(moduleCode);
      expect(output).toContain('import value');
      expect(output).toContain('export const result=await value');
      expect(minifier.getSyntaxError(output)).toBeNull();
    });

    test.each(['const value: number = 1;', 'const element = <div />;'])(
      'rejects non-JavaScript syntax as input: %s',
      (input) => {
        expect(minifier.isValidJavaScript(input)).toBe(false);
        expect(() => minifier.minify(input)).toThrow(/Invalid JavaScript syntax/);
      }
    );

    test('does not execute code to validate its syntax', () => {
      const originalFunction = global.Function;
      const functionMock = jest.fn();
      global.Function = functionMock as any;
      let isValid = false;

      try {
        isValid = minifier.isValidJavaScript('const x = 1;');
      } finally {
        global.Function = originalFunction;
      }

      expect(isValid).toBe(true);
      expect(functionMock).not.toHaveBeenCalled();
    });
  });

  describe('string placeholder handling', () => {
    test('should correctly restore string placeholders', () => {
      const input = `const str1 = "// not a comment"; const str2 = '/* not a comment */';`;
      const output = minifier.minify(input);

      expect(new Function(`${output} return [str1, str2];`)()).toEqual(['// not a comment', '/* not a comment */']);
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
      const output = `if(x)return;else if(y)throw new Error;`;
      expect(minifier.minify(input)).toBe(output);
    });

    test('should handle complex keyword combinations', () => {
      const input = `function test(){return x instanceof Array&&y in obj;}`;
      const output = `function test(){return x instanceof Array&&y in obj}`;
      expect(minifier.minify(input)).toBe(output);
    });

    test('should handle typeof operator', () => {
      const input = `const type=typeof x;`;
      const output = `const type=typeof x;`;
      expect(minifier.minify(input)).toBe(output);
    });
  });
});
