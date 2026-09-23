import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';

type MinifierInput = string | null | undefined;
type MinifierAst = ReturnType<typeof parse>;
const SHORT_NAME_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$_';

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
    allowAwaitOutsideFunction: true
  });
}

function createShortNameGenerator(): () => string {
  let counter = 0;

  return () => {
    let shortName = '';
    let current = counter++;

    do {
      shortName = SHORT_NAME_CHARS[current % SHORT_NAME_CHARS.length] + shortName;
      current = Math.floor(current / SHORT_NAME_CHARS.length);
    } while (current > 0);

    return shortName;
  };
}

function getTraverseFunction(): typeof traverse {
  return ((traverse as any).default || traverse) as typeof traverse;
}

function getEvalScopes(ast: MinifierAst): { direct: any[]; hasIndirect: boolean } {
  const direct: any[] = [];
  let hasIndirect = false;
  const traverseFn = getTraverseFunction();
  const isDynamicCodeProperty = (property: any, computed: boolean) => {
    const name = !computed && property.type === 'Identifier'
      ? property.name
      : computed && property.type === 'StringLiteral'
        ? property.value
        : computed && property.type === 'TemplateLiteral' && property.expressions.length === 0
          ? property.quasis[0]?.value.cooked ?? property.quasis[0]?.value.raw
        : undefined;
    return name === 'eval' || name === 'Function';
  };
  const checkDynamicCodeAccess = (path: any) => {
    const { property, computed } = path.node;
    if (isDynamicCodeProperty(property, computed)) {
      hasIndirect = true;
    }
  };

  traverseFn(ast, {
    ReferencedIdentifier(path: any) {
      if (path.node.name === 'Function' && !path.scope.getBinding('Function')) {
        hasIndirect = true;
        return;
      }

      if (path.node.name !== 'eval') {
        return;
      }

      const parent = path.parentPath;
      if (parent?.node?.type === 'CallExpression' && parent.node.callee === path.node) {
        direct.push(parent.scope);
      } else {
        hasIndirect = true;
      }
    },
    MemberExpression(path: any) {
      checkDynamicCodeAccess(path);
    },
    OptionalMemberExpression(path: any) {
      checkDynamicCodeAccess(path);
    },
    ObjectPattern(path: any) {
      if (path.node.properties.some((property: any) =>
        property.type === 'ObjectProperty' && isDynamicCodeProperty(property.key, property.computed)
      )) {
        hasIndirect = true;
      }
    }
  });

  return { direct, hasIndirect };
}

function isInsideWithStatement(path: any): boolean {
  let current = path.parentPath;
  while (current) {
    if (current.node?.type === 'WithStatement') {
      return true;
    }
    current = current.parentPath;
  }
  return false;
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
    let before = result.slice(0, start);
    let after = result.slice(end);
    const commentText = code.slice(start, end);
    const lineBreaks = commentText.match(/\r\n|\r|\n|\u2028|\u2029/gu) ?? [];

    if (lineBreaks.length > 0) {
      result = `${before}${lineBreaks.join('')}${after}`;
      continue;
    }

    if (after.length === 0 || /^[\r\n\u2028\u2029]/u.test(after)) {
      before = before.replace(/[ \t]+$/u, '');
      result = `${before}${after}`;
      continue;
    }

    const lineStart = Math.max(
      before.lastIndexOf('\n'),
      before.lastIndexOf('\r'),
      before.lastIndexOf('\u2028'),
      before.lastIndexOf('\u2029')
    ) + 1;
    const isAtLineStart = before.slice(lineStart).trim().length === 0;
    if (!isAtLineStart) {
      before = before.replace(/[ \t]+$/u, '');
      after = after.replace(/^[ \t]+/u, '');
      result = `${before} ${after}`;
    } else {
      result = `${before}${after}`;
    }
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
    const evalScopes = getEvalScopes(ast);
    traverseFn(ast, {
      Scope(path: any) {
        for (const name in path.scope.bindings) {
          allBindings.add(path.scope.bindings[name]);
        }
      }
    });

    // Filter and Rename
    const getNextShortName = createShortNameGenerator();

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
      const isObservedDynamically = evalScopes.direct.some((scope) =>
        scope.getBinding(binding.identifier.name) === binding
      ) || (evalScopes.hasIndirect && binding.scope.path.node.type === 'Program') ||
        binding.referencePaths.some(isInsideWithStatement);

      if (
        binding.path.isFunctionDeclaration() ||
        binding.path.isClassDeclaration() ||
        isObservedDynamically
      ) {
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

    this.manglePropertiesInAst(ast);
    return generateJavaScript(ast, {
      minified: this.options.removeWhitespace,
      comments: !this.options.removeComments
    });
  }

  private manglePropertiesInAst(ast: MinifierAst): void {
    const traverseFn = getTraverseFunction();
    type LocalObjectProperties = {
      propertyNodes: Map<string, any[]>;
      usedNames: Set<string>;
    };

    const localObjects = new Map<any, LocalObjectProperties>();
    const propertyMappings = new Map<any, Map<string, string>>();
    const propertyName = (key: any, computed: boolean): string | null => {
      if (key?.type === 'StringLiteral') {
        return key.value;
      }
      if (!computed && key?.type === 'Identifier') {
        return key.name;
      }
      return null;
    };
    const evalScopes = getEvalScopes(ast);

    traverseFn(ast, {
      VariableDeclarator(path: any) {
        const { id, init } = path.node;
        if (id.type !== 'Identifier' || init?.type !== 'ObjectExpression') {
          return;
        }

        const declarationParent = path.parentPath.parentPath;
        if (declarationParent?.node?.type === 'ExportNamedDeclaration') {
          return;
        }

        const binding = path.scope.getBinding(id.name);
        if (
          !binding ||
          binding.constantViolations.length > 0 ||
          evalScopes.direct.some((scope) => scope.getBinding(id.name) === binding) ||
          (evalScopes.hasIndirect && binding.scope.path.node.type === 'Program') ||
          binding.referencePaths.some(isInsideWithStatement)
        ) {
          return;
        }

        const hasUnsafeReference = binding.referencePaths.some((reference: any) => {
          const member = reference.parentPath;
          if (
            (!member?.isMemberExpression() && !member?.isOptionalMemberExpression()) ||
            member.node.object !== reference.node
          ) {
            return true;
          }

          if (member.node.computed && !propertyName(member.node.property, member.node.computed)) {
            return true;
          }

          let accessedProperty = member;
          let parent = accessedProperty.parentPath;
          while (
            (parent?.isMemberExpression() || parent?.isOptionalMemberExpression()) &&
            parent.node.object === accessedProperty.node
          ) {
            accessedProperty = parent;
            parent = accessedProperty.parentPath;
          }

          return (
            ((parent?.node?.type === 'CallExpression' || parent?.node?.type === 'OptionalCallExpression') &&
              parent.node.callee === accessedProperty.node) ||
            (parent?.node?.type === 'TaggedTemplateExpression' && parent.node.tag === accessedProperty.node)
          );
        });
        if (hasUnsafeReference) {
          return;
        }

        let containsThis = false;
        path.get('init').traverse({
          ThisExpression() {
            containsThis = true;
          }
        });
        if (containsThis || init.properties.some((property: any) => property.type !== 'ObjectProperty')) {
          return;
        }

        const propertyNodes = new Map<string, any[]>();
        let hasDynamicProperty = false;
        let hasPrototypeSetter = false;
        for (const property of init.properties) {
          const name = propertyName(property.key, property.computed);
          if (!name) {
            hasDynamicProperty = true;
            break;
          }
          if (name === '__proto__' && !property.computed && !property.shorthand) {
            hasPrototypeSetter = true;
          }
          const nodes = propertyNodes.get(name) ?? [];
          nodes.push(property);
          propertyNodes.set(name, nodes);
        }
        if (hasDynamicProperty || hasPrototypeSetter) {
          return;
        }

        localObjects.set(binding, {
          propertyNodes,
          usedNames: new Set(propertyNodes.keys())
        });
      }
    });

    const collectUsedMemberName = (path: any) => {
      if (path.node.object.type !== 'Identifier') {
        return;
      }

      const binding = path.scope.getBinding(path.node.object.name);
      const localObject = localObjects.get(binding);
      const name = propertyName(path.node.property, path.node.computed);
      if (localObject && name) {
        localObject.usedNames.add(name);
      }
    };

    traverseFn(ast, {
      MemberExpression: collectUsedMemberName,
      OptionalMemberExpression: collectUsedMemberName
    });

    const propertyNodeMappings = new Map<any, string>();
    for (const [binding, localObject] of localObjects) {
      const propMap = new Map<string, string>();
      const getNextShortName = createShortNameGenerator();
      const usedPropertyNames = new Set(localObject.usedNames);

      for (const [propName, nodes] of localObject.propertyNodes) {
        if (propName === '__proto__') {
          continue;
        }

        let shortName = getNextShortName();
        while (usedPropertyNames.has(shortName)) {
          shortName = getNextShortName();
        }

        propMap.set(propName, shortName);
        usedPropertyNames.add(shortName);
        for (const node of nodes) {
          propertyNodeMappings.set(node, shortName);
        }
      }

      propertyMappings.set(binding, propMap);
    }

    const renameMemberProperty = (path: any) => {
      if (path.node.object.type !== 'Identifier') {
        return;
      }

      const binding = path.scope.getBinding(path.node.object.name);
      const propMap = propertyMappings.get(binding);
      const name = propertyName(path.node.property, path.node.computed);
      const mangledName = name ? propMap?.get(name) : undefined;
      if (!mangledName) {
        return;
      }

      if (path.node.property.type === 'Identifier') {
        path.node.property.name = mangledName;
      } else {
        path.node.property.value = mangledName;
        path.node.property.extra = undefined;
      }
    };
    const renamePropertyKey = (node: any) => {
      const mangledName = propertyNodeMappings.get(node);
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
      MemberExpression: renameMemberProperty,
      OptionalMemberExpression: renameMemberProperty,
      ObjectProperty(path: any) {
        renamePropertyKey(path.node);
      }
    });
  }
}
