import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';

type MinifierInput = string | null | undefined;

interface JSMinifierOptions {
  removeComments: boolean;
  removeWhitespace: boolean;
  shortenVariables: boolean;
  mangleProperties: boolean;
}

// JavaScript Minifier Implementation
export class JSMinifier {
  options: JSMinifierOptions;

  constructor(options: Partial<JSMinifierOptions> = {}) {
    this.options = {
      removeComments: options.removeComments !== undefined ? options.removeComments : true,
      removeWhitespace: options.removeWhitespace !== undefined ? options.removeWhitespace : true,
      shortenVariables: options.shortenVariables !== undefined ? options.shortenVariables : false,
      mangleProperties: options.mangleProperties !== undefined ? options.mangleProperties : false
    };
  }

  // Return the SyntaxError for invalid JavaScript, or null when the code parses.
  // Non-syntax errors are re-thrown so genuine bugs are not silently swallowed.
  getSyntaxError(code: string): SyntaxError | null {
    try {
      // eslint-disable-next-line no-new-func
      new Function(code);
      return null;
    } catch (e: unknown) {
      if (e instanceof SyntaxError) {
        return e;
      }
      throw e; // Re-throw non-syntax errors
    }
  }

  // Validate JavaScript syntax
  isValidJavaScript(code: string): boolean {
    const syntaxError = this.getSyntaxError(code);
    if (syntaxError) {
      console.log('Invalid JavaScript: ', syntaxError.message);
      return false;
    }
    return true;
  }

  // Main minify method
  minify(code: MinifierInput | unknown): string {
    if (!code || typeof code !== 'string') {
      return '';
    }

    const syntaxError = this.getSyntaxError(code);
    if (syntaxError) {
      // Surface the parser's message (with its line/column) so the UI can show a
      // specific validation error instead of a generic "invalid" notice.
      throw new Error(`Invalid JavaScript syntax: ${syntaxError.message}`);
    }

    let result = code;

    // Remove comments
    if (this.options.removeComments) {
      result = this.removeComments(result);
    }

    // Remove whitespace
    if (this.options.removeWhitespace) {
      result = this.removeWhitespace(result);
    }

    // Apply variable shortening (if enabled)
    if (this.options.shortenVariables) {
      result = this.shortenVariableNames(result);
    }

    // Apply property mangling (if enabled)
    if (this.options.mangleProperties) {
      result = this.mangleObjectProperties(result);
    }

    return result;
  }

  // Remove all comments (single line and multi-line)
  removeComments(code: string): string {
    if (!this.options.removeComments) {
      return code;
    }

    // First handle strings to avoid removing comments within strings
    const stringPlaceholders: string[] = [];
    let processedCode = code.replace(/(['"`])(?:\\[\s\S]|(?!\1)[^\\])*\1/g, (match) => {
      stringPlaceholders.push(match);
      return `__STRING_PLACEHOLDER_${stringPlaceholders.length - 1}__`;
    });

    // Remove single line comments
    processedCode = processedCode.replace(/\/\/.*?(?:\n|$)/g, '\n');

    // Remove multi-line comments
    processedCode = processedCode.replace(/\/\*[\s\S]*?\*\//g, '');

    // Restore strings
    stringPlaceholders.forEach((str, i) => {
      processedCode = processedCode.replace(`__STRING_PLACEHOLDER_${i}__`, str);
    });

    return processedCode;
  }

  // Remove unnecessary whitespace
  removeWhitespace(code: string): string {
    // Save strings and regular expressions
    const patterns: string[] = [];
    let processedCode = code.replace(
      /(['"`])(?:\\[\s\S]|(?!\1)[^\\])*\1|\/(?:\\[\s\S]|[^\\\/])+\/(?:[gimsuy]*)/g,
      (match) => {
        patterns.push(match);
        return `__PATTERN_${patterns.length - 1}__`;
      }
    );

    // Replace multiple spaces with a single space
    processedCode = processedCode.replace(/\s+/g, ' ');

    // Remove spaces that aren't needed for syntax
    processedCode = processedCode.replace(/\s*([{}\[\]()=+\-*/<>!?:;,.|&])\s*/g, '$1');

    // Fix spaces that are needed to avoid syntax errors
    processedCode = processedCode.replace(/([+\-*/<>!&|])=(?!=)/g, '$1 =');
    processedCode = processedCode.replace(/\bin\b/g, ' in ');
    processedCode = processedCode.replace(/\binstanceof\b/g, ' instanceof ');
    processedCode = processedCode.replace(/([+\-*/%<>=&|!])\s+([+\-*/%<>=&|!])/g, '$1$2');

    // Ensure keywords have proper spacing
    const keywords = [
      'if', 'else', 'for', 'while', 'do', 'switch', 'try', 'catch', 'finally', 'with',
      'return', 'throw', 'var', 'let', 'const', 'function', 'typeof', 'instanceof', 'in'
    ];
    const keywordRegex = new RegExp(`([^a-zA-Z0-9_$])\\s*(${keywords.join('|')})\\s*([^a-zA-Z0-9_$])`, 'g');
    processedCode = processedCode.replace(keywordRegex, '$1$2$3');

    // Restore strings and regexes
    patterns.forEach((pattern, i) => {
      processedCode = processedCode.replace(`__PATTERN_${i}__`, pattern);
    });

    // Trim leading/trailing whitespace
    return processedCode.trim();
  }

  // Experimental: Shorten variable names
  shortenVariableNames(code: string): string {
    if (!this.options.shortenVariables) {
      return code;
    }

    try {
      const ast = parse(code, {
        sourceType: 'module',
        allowReturnOutsideFunction: true,
        plugins: ['jsx', 'typescript']
      });

      const allBindings = new Set<any>();

      // Collect all bindings
      const traverseFn = (traverse as any).default || traverse;
      traverseFn(ast, {
        Scope(path: any) {
          for (const name in path.scope.bindings) {
            allBindings.add(path.scope.bindings[name]);
          }
        }
      });

      // Filter and Rename
      const shortNameChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$_';
      let shortNameCounter = 0;

      const getNextShortName = () => {
        let shortName = '';
        let counter = shortNameCounter++;
        do {
          shortName = shortNameChars[counter % shortNameChars.length] + shortName;
          counter = Math.floor(counter / shortNameChars.length);
        } while (counter > 0);
        return shortName;
      };

      const reserved = new Set([
        'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default',
        'delete', 'do', 'else', 'export', 'extends', 'false', 'finally', 'for', 'function',
        'if', 'import', 'in', 'instanceof', 'new', 'null', 'return', 'super', 'switch',
        'this', 'throw', 'true', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield',
        'let', 'static', 'await', 'async'
      ]);

      const getSafeShortName = () => {
        let name: string;
        do {
          name = getNextShortName();
        } while (reserved.has(name));
        return name;
      };

      const bindingsToRename: any[] = [];
      const namesInUse = new Set<string>();

      // Preserve function names and other critical identifiers
      for (const binding of allBindings) {
        if (binding.path.isFunctionDeclaration() || binding.path.isClassDeclaration()) {
          namesInUse.add(binding.identifier.name);
        } else {
          bindingsToRename.push(binding);
        }
      }

      // Collect globals used
      traverseFn(ast, {
        Program(path: any) {
          Object.keys(path.scope.globals).forEach((g) => namesInUse.add(g));
        }
      });

      // Rename bindings
      for (const binding of bindingsToRename) {
        let newName = getSafeShortName();
        // Ensure uniqueness against preserved names and globals.
        while (namesInUse.has(newName)) {
          newName = getSafeShortName();
        }

        binding.scope.rename(binding.identifier.name, newName);
      }

      const generateFn = (generate as any).default || generate;
      const { code: newCode } = generateFn(ast, {
        minified: true,
        comments: false
      });

      return newCode;
    } catch (e) {
      console.warn('AST Parse failed, falling back to original code', e);
      return code;
    }
  }

  // Experimental: Mangle object properties
  mangleObjectProperties(code: string): string {
    if (!this.options.mangleProperties) {
      return code;
    }

    // This is a simplified implementation.
    // Finding object properties is complex and requires proper parsing.
    // This basic regex looks for patterns like obj.property or obj["property"].
    const propRegex = /\.([a-zA-Z_$][a-zA-Z0-9_$]*)|["']([a-zA-Z_$][a-zA-Z0-9_$]*)["']/g;
    const foundProps = new Set<string>();

    let match: RegExpExecArray | null;
    while ((match = propRegex.exec(code)) !== null) {
      if (match[1]) {
        foundProps.add(match[1]); // dot notation
      }
      if (match[2]) {
        foundProps.add(match[2]); // bracket notation
      }
    }

    // Filter out common methods and properties
    const commonProps = new Set([
      'length', 'prototype', 'constructor', 'toString', 'valueOf', 'hasOwnProperty',
      'isPrototypeOf', 'propertyIsEnumerable', 'toLocaleString', 'apply', 'call', 'bind',
      'name', 'arguments', 'callee', 'caller', 'super', 'this', 'window', 'document',
      'console', 'log', 'warn', 'error', 'info', 'debug'
    ]);

    const properties = [...foundProps].filter((p) => !commonProps.has(p));

    // Create property name mapping
    const propMap: Record<string, string> = {};
    const shortNameChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$_';
    let shortNameCounter = 0;

    properties.forEach((propName) => {
      let shortName = '';
      let counter = shortNameCounter++;

      do {
        shortName = shortNameChars[counter % shortNameChars.length] + shortName;
        counter = Math.floor(counter / shortNameChars.length);
      } while (counter > 0);

      propMap[propName] = shortName;
    });

    // Replace property names (this is a simplified approach)
    let result = code;
    Object.keys(propMap).forEach((propName) => {
      const dotRegex = new RegExp(`\\.${propName}\\b`, 'g');
      const bracketRegex = new RegExp(`["']${propName}["']`, 'g');

      result = result.replace(dotRegex, `.${propMap[propName]}`);
      result = result.replace(bracketRegex, `"${propMap[propName]}"`);
    });

    return result;
  }
}
