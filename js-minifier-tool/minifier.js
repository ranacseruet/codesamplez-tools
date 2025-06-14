// JavaScript Minifier Implementation
class JSMinifier {
  constructor(options = {}) {
    this.options = {
      removeComments: options.removeComments !== undefined ? options.removeComments : true,
      removeWhitespace: options.removeWhitespace !== undefined ? options.removeWhitespace : true,
      shortenVariables: options.shortenVariables !== undefined ? options.shortenVariables : false,
      mangleProperties: options.mangleProperties !== undefined ? options.mangleProperties : false
    };
  }

  // Validate JavaScript syntax
  isValidJavaScript(code) {
    try {
      new Function(code);
      return true;
    } catch (e) {
      if (e instanceof SyntaxError) {
        console.log('Invalid JavaScript: ', e.message);
        return false;
      }
      throw e; // Re-throw non-syntax errors
    }
  }

  // Main minify method
  minify(code) {
    if (!code || typeof code !== 'string') {
      return '';
    }

    if (!this.isValidJavaScript(code)) {
      throw new Error('Invalid JavaScript syntax');
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
  removeComments(code) {
    if (!this.options.removeComments) {
      return code;
    }

    // First handle strings to avoid removing comments within strings
    const stringPlaceholders = [];
    let processedCode = code.replace(/(['"`])(?:\\[\s\S]|(?!\1)[^\\])*\1/g, match => {
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
  removeWhitespace(code) {
    // Save strings and regular expressions
    const patterns = [];
    let processedCode = code.replace(/(['"`])(?:\\[\s\S]|(?!\1)[^\\])*\1|\/(?:\\[\s\S]|[^\\\/])+\/(?:[gimsuy]*)/g, match => {
      patterns.push(match);
      return `__PATTERN_${patterns.length - 1}__`;
    });

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
    const keywords = ['if', 'else', 'for', 'while', 'do', 'switch', 'try', 'catch', 'finally', 'with', 'return', 'throw', 'var', 'let', 'const', 'function', 'typeof', 'instanceof', 'in'];
    keywords.forEach(keyword => {
      const regex = new RegExp(`([^a-zA-Z0-9_$])\\s*${keyword}\\s*([^a-zA-Z0-9_$])`, 'g');
      processedCode = processedCode.replace(regex, `$1${keyword}$2`);
    });
    
    // Restore strings and regexes
    patterns.forEach((pattern, i) => {
      processedCode = processedCode.replace(`__PATTERN_${i}__`, pattern);
    });

    // Trim leading/trailing whitespace
    return processedCode.trim();
  }

  // Experimental: Shorten variable names
  shortenVariableNames(code) {
    if (!this.options.shortenVariables) {
      return code;
    }

    // This is a simplified implementation!
    // Parse out variables (excluding function names)
    const variableRegex = /(?:var|let|const)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
    const foundVariables = new Set();
    
    let match;
    while ((match = variableRegex.exec(code)) !== null) {
      foundVariables.add(match[1]);
    }
    
    // Filter out reserved keywords and built-ins
    const reservedWords = new Set([
      'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 
      'delete', 'do', 'else', 'export', 'extends', 'false', 'finally', 'for', 'function', 
      'if', 'import', 'in', 'instanceof', 'new', 'null', 'return', 'super', 'switch', 
      'this', 'throw', 'true', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield',
      'let', 'static', 'implements', 'interface', 'package', 'private', 'protected', 
      'public', 'await', 'abstract', 'boolean', 'byte', 'char', 'double', 'final', 
      'float', 'goto', 'int', 'long', 'native', 'short', 'synchronized', 'throws', 
      'transient', 'volatile',
      // Common globals
      'window', 'document', 'console', 'Math', 'Array', 'Object', 'String', 'Number',
      'Boolean', 'RegExp', 'Date', 'JSON', 'undefined',
      // Function names (don't shorten these)
      'test', 'describe', 'it', 'expect', 'beforeEach', 'afterEach', 'beforeAll', 'afterAll'
    ]);
    
    const variables = [...foundVariables].filter(v => !reservedWords.has(v));
    
    // Create variable name mapping
    const varMap = {};
    const shortNameChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$_';
    let shortNameCounter = 0;
    
    variables.forEach(varName => {
      let shortName = '';
      let counter = shortNameCounter++;
      
      do {
        shortName = shortNameChars[counter % shortNameChars.length] + shortName;
        counter = Math.floor(counter / shortNameChars.length);
      } while (counter > 0);
      
      varMap[varName] = shortName;
    });
    
    // Replace variable names (careful not to replace function names)
    let result = code;
    Object.keys(varMap).forEach(varName => {
      // Skip if this looks like a function declaration
      if (new RegExp(`function\\s+${varName}\\s*\\(`).test(code)) {
        return;
      }
      
      // This is a very simplified approach and can cause bugs!
      // A proper implementation would use an AST to ensure correct replacements
      const regex = new RegExp(`\\b${varName}\\b`, 'g');
      result = result.replace(regex, varMap[varName]);
    });
    return result;
  }

  // Experimental: Mangle object properties
  mangleObjectProperties(code) {
    if (!this.options.mangleProperties) {
      return code;
    }
    
    // This is a simplified implementation
    // Finding object properties is complex and requires proper parsing
    // This basic regex looks for patterns like obj.property or obj["property"]
    const propRegex = /\.([a-zA-Z_$][a-zA-Z0-9_$]*)|["']([a-zA-Z_$][a-zA-Z0-9_$]*)["']/g;
    const foundProps = new Set();
    
    let match;
    while ((match = propRegex.exec(code)) !== null) {
      if (match[1]) foundProps.add(match[1]); // dot notation
      if (match[2]) foundProps.add(match[2]); // bracket notation
    }
    
    // Filter out common methods and properties
    const commonProps = new Set([
      'length', 'prototype', 'constructor', 'toString', 'valueOf', 'hasOwnProperty',
      'isPrototypeOf', 'propertyIsEnumerable', 'toLocaleString', 'apply', 'call', 'bind',
      'name', 'arguments', 'callee', 'caller', 'super', 'this', 'window', 'document',
      'console', 'log', 'warn', 'error', 'info', 'debug'
    ]);
    
    const properties = [...foundProps].filter(p => !commonProps.has(p));
    
    // Create property name mapping
    const propMap = {};
    const shortNameChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$_';
    let shortNameCounter = 0;
    
    properties.forEach(propName => {
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
    Object.keys(propMap).forEach(propName => {
      const dotRegex = new RegExp(`\\.${propName}\\b`, 'g');
      const bracketRegex = new RegExp(`["']${propName}["']`, 'g');
      
      result = result.replace(dotRegex, `.${propMap[propName]}`);
      result = result.replace(bracketRegex, `"${propMap[propName]}"`);
    });
    
    return result;
  }
}

export { JSMinifier };
