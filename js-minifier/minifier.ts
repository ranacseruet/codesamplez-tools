import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';

type MinifierInput = string | null | undefined;
type MinifierAst = ReturnType<typeof parse>;

interface JSMinifierOptions {
  removeComments: boolean;
  removeWhitespace: boolean;
  shortenVariables: boolean;
  mangleProperties: boolean;
}

function parseJavaScript(code: string): MinifierAst {
  return parse(code, {
    sourceType: 'unambiguous',
    allowReturnOutsideFunction: true,
    allowAwaitOutsideFunction: true,
    plugins: ['jsx', 'typescript']
  });
}

function getTraverseFunction(): typeof traverse {
  return ((traverse as any).default || traverse) as typeof traverse;
}

function generateJavaScript(ast: MinifierAst, options: { minified: boolean; comments: boolean }): string {
  const generateFn = (generate as any).default || generate;
  return generateFn(ast, options).code;
}

function removeCommentsFromSource(code: string, ast: MinifierAst): string {
  const comments = [...(ast.comments ?? [])].sort((left, right) => right.start! - left.start!);
  let result = code;

  for (const comment of comments) {
    const start = comment.start!;
    const end = comment.end!;
    const whitespace = code.slice(start, end).replace(/[^\r\n]/gu, ' ');
    result = `${result.slice(0, start)}${whitespace}${result.slice(end)}`;
  }

  return result;
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
      parseJavaScript(code);
      return null;
    } catch (e: unknown) {
      if (e instanceof SyntaxError) {
        return e;
      }
      throw e;
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

    let ast: MinifierAst;
    try {
      ast = parseJavaScript(code);
    } catch (error: unknown) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JavaScript syntax: ${error.message}`);
      }
      throw error;
    }

    const hasAstTransforms = this.options.shortenVariables || this.options.mangleProperties;

    if (!this.options.removeComments && !this.options.removeWhitespace && !hasAstTransforms) {
      return code;
    }

    if (!this.options.removeWhitespace && !hasAstTransforms) {
      return this.options.removeComments ? removeCommentsFromSource(code, ast) : code;
    }

    if (this.options.shortenVariables) {
      this.shortenBindings(ast);
    }

    if (this.options.mangleProperties) {
      this.manglePropertiesInAst(ast);
    }

    return generateJavaScript(ast, {
      minified: this.options.removeWhitespace,
      comments: !this.options.removeComments
    });
  }

  // Remove all comments using parser comment ranges, not text-pattern matching.
  removeComments(code: string): string {
    if (!this.options.removeComments) {
      return code;
    }

    return removeCommentsFromSource(code, parseJavaScript(code));
  }

  // Remove unnecessary whitespace through Babel's syntax-aware generator.
  removeWhitespace(code: string): string {
    return generateJavaScript(parseJavaScript(code), { minified: true, comments: true });
  }

  // Experimental: Shorten variable names
  shortenVariableNames(code: string): string {
    if (!this.options.shortenVariables) {
      return code;
    }

    let ast: MinifierAst;
    try {
      ast = parseJavaScript(code);
    } catch (error: unknown) {
      if (error instanceof SyntaxError) {
        console.warn('AST Parse failed, falling back to original code', error);
        return code;
      }
      throw error;
    }

    this.shortenBindings(ast);
    return generateJavaScript(ast, {
      minified: this.options.removeWhitespace,
      comments: !this.options.removeComments
    });
  }

  private shortenBindings(ast: MinifierAst): void {
    const allBindings = new Set<any>();

    // Collect all bindings
    const traverseFn = getTraverseFunction();
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
  }

  // Experimental: Mangle object properties
  mangleObjectProperties(code: string): string {
    if (!this.options.mangleProperties) {
      return code;
    }

    const ast = parseJavaScript(code);
    this.manglePropertiesInAst(ast);
    return generateJavaScript(ast, {
      minified: this.options.removeWhitespace,
      comments: !this.options.removeComments
    });
  }

  private manglePropertiesInAst(ast: MinifierAst): void {
    const traverseFn = getTraverseFunction();
    const foundProperties = new Set<string>();
    const propertyName = (key: any, computed: boolean): string | null => {
      if (key?.type === 'StringLiteral') {
        return key.value;
      }
      if (!computed && key?.type === 'Identifier') {
        return key.name;
      }
      return null;
    };

    const collectMemberProperty = (node: any) => {
      const name = propertyName(node.property, node.computed);
      if (name) {
        foundProperties.add(name);
      }
    };
    const collectPropertyKey = (node: any) => {
      const name = propertyName(node.key, node.computed);
      if (name) {
        foundProperties.add(name);
      }
    };

    traverseFn(ast, {
      MemberExpression(path: any) {
        collectMemberProperty(path.node);
      },
      OptionalMemberExpression(path: any) {
        collectMemberProperty(path.node);
      },
      ObjectProperty(path: any) {
        collectPropertyKey(path.node);
      },
      ObjectMethod(path: any) {
        collectPropertyKey(path.node);
      },
      ClassMethod(path: any) {
        collectPropertyKey(path.node);
      },
      ClassProperty(path: any) {
        collectPropertyKey(path.node);
      },
      ClassAccessorProperty(path: any) {
        collectPropertyKey(path.node);
      }
    });

    // Filter out common methods and properties
    const commonProperties = new Set([
      'length', 'prototype', 'constructor', 'toString', 'valueOf', 'hasOwnProperty',
      'isPrototypeOf', 'propertyIsEnumerable', 'toLocaleString', 'apply', 'call', 'bind',
      'name', 'arguments', 'callee', 'caller', 'super', 'this', 'window', 'document',
      'console', 'log', 'warn', 'error', 'info', 'debug'
    ]);
    const properties = [...foundProperties].filter((property) => !commonProperties.has(property));

    // Create property name mapping
    const propMap = new Map<string, string>();
    const shortNameChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$_';
    let shortNameCounter = 0;

    properties.forEach((propName) => {
      let shortName = '';
      let counter = shortNameCounter++;

      do {
        shortName = shortNameChars[counter % shortNameChars.length] + shortName;
        counter = Math.floor(counter / shortNameChars.length);
      } while (counter > 0);

      propMap.set(propName, shortName);
    });

    const renameMemberProperty = (node: any) => {
      const name = propertyName(node.property, node.computed);
      const mangledName = name ? propMap.get(name) : undefined;
      if (!mangledName) {
        return;
      }

      if (node.property.type === 'Identifier') {
        node.property.name = mangledName;
      } else {
        node.property.value = mangledName;
        node.property.extra = undefined;
      }
    };
    const renamePropertyKey = (node: any) => {
      const name = propertyName(node.key, node.computed);
      const mangledName = name ? propMap.get(name) : undefined;
      if (!mangledName) {
        return;
      }

      if (node.key.type === 'Identifier') {
        node.key.name = mangledName;
      } else {
        node.key.value = mangledName;
        node.key.extra = undefined;
      }

      if (node.type === 'ObjectProperty' && node.shorthand) {
        node.shorthand = false;
      }
    };

    traverseFn(ast, {
      MemberExpression(path: any) {
        renameMemberProperty(path.node);
      },
      OptionalMemberExpression(path: any) {
        renameMemberProperty(path.node);
      },
      ObjectProperty(path: any) {
        renamePropertyKey(path.node);
      },
      ObjectMethod(path: any) {
        renamePropertyKey(path.node);
      },
      ClassMethod(path: any) {
        renamePropertyKey(path.node);
      },
      ClassProperty(path: any) {
        renamePropertyKey(path.node);
      },
      ClassAccessorProperty(path: any) {
        renamePropertyKey(path.node);
      }
    });
  }
}
