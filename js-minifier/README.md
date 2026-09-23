# JavaScript Minifier

A tool to minify JavaScript code by removing comments, whitespace, and optionally shortening variable names and mangling properties. This tool maintains code functionality while reducing file size through various optimization techniques.

## Features

- Remove comments (both single-line and multi-line)
- Preserve string literals and regular expressions while minifying surrounding code
- Remove unnecessary whitespace while maintaining syntax validity
- Intelligent handling of operators and keywords to prevent syntax errors
- Shorten variable names (experimental)
- Mangle object properties (experimental)
- Real-time size and compression statistics
- Copy to clipboard functionality
- Clear all fields
- Click "Upload File" or drag a `.js` file onto the input to load and minify it;
  the file is read in the browser and never uploaded (5 MB limit, binary files rejected)

## Usage

1. Paste your JavaScript code into the "Original JavaScript" textarea, or click "Upload File" to choose a local text file
2. Select desired minification options:
   - Remove comments (enabled by default)
   - Remove whitespace (enabled by default)
   - Shorten variable names (experimental)
   - Mangle properties (experimental)
3. Click "Minify JavaScript" to process the code
4. View the minified code in the "Minified JavaScript" textarea
5. Use the "Copy Minified Code" button to copy the result to clipboard
6. Use "Clear All" to reset the tool

## Example

### Input
```javascript
// Example JavaScript function
function calculateSum(numbers) {
  // This function calculates the sum of all numbers in an array
  let sum = 0;
  
  for (let i = 0; i < numbers.length; i++) {
    // Add each number to the sum
    sum = sum + numbers[i];
  }
  
  // Return the final sum
  return sum;
}
```

### Output (with all options enabled)
```javascript
function a(b){let c=0;for(let d=0;d<b.length;d++)c=c+b[d];return c}
```

## Advanced Features

### String and RegExp Handling
- Preserves string literals (single quotes, double quotes, and template literals)
- Maintains regular expressions including their flags
- Prevents comment removal within string contents

### Whitespace Optimization
- Intelligent space preservation around operators
- Maintains spaces for keywords (if, else, for, etc.)
- Preserves spaces necessary for valid syntax (e.g., around 'in' operator)

### Property Mangling (Experimental)
```javascript
// Original code
const user = { firstName: "John", lastName: "Doe" };
console.log(user.firstName + " " + user.lastName);

// Minified with property mangling
const user={a:"John",b:"Doe"};console.log(user.a+" "+user.b);
```

## Limitations

### General Limitations
- Variable name shortening and property mangling are experimental features
  - May break code in some cases
  - Always test minified code before deployment
  - Can conflict with external dependencies
- Property mangling only shortens static keys on local object literals that do not escape, use dynamic access, act as method receivers, or are visible to dynamic `eval`/`Function` code or `with` scopes; API/config objects, `this`-dependent objects, and class members stay unchanged
- Bindings visible to direct or script-level indirect `eval`, referenced by a `Function` constructor, or referenced inside `with` blocks are left unchanged when shortening variable names

### JavaScript and Module Syntax
- Parses and minifies modern JavaScript syntax, including ES module imports and exports, dynamic imports, and top-level `await`.
- TypeScript and JSX must be transpiled before minification.
- Preserves the input's JavaScript syntax; it does not transpile, bundle, or tree-shake code.

## Error Handling

The minifier includes several safety features:

- Validates input to ensure it's non-empty and string type
- Validates JavaScript syntax before minifying; invalid input surfaces the
  parser's message (including the line/column, e.g. `Unexpected token (1:6)`)
  as a persistent inline validation error beneath the input, not just a
  transient toast
- Preserves necessary whitespace to prevent syntax errors
- Skips shortening of reserved JavaScript keywords and built-ins
- Maintains function and method names that could affect program behavior

## Security Considerations

### Local Processing
- All minification happens entirely in your browser
- No code is sent to external servers
- Source code remains private and secure

### Lazy-loaded engine
- The minifier engine (the Babel parser/traverse/generator stack, ~803 KB raw) is **not** in the initial page bundle. It is code-split behind the `./load-minifier` seam and fetched on the first minify, so visitors who never minify don't download it. The initial `js-minifier` bundle is now in line with the other tools (~54 KB raw). The first minify shows a brief "Loading…" state on the button while the engine chunk downloads.

### Best Practices
- Always test minified code thoroughly before deployment
- Use source maps in development for easier debugging
- Keep original source code for maintenance
- Be cautious with experimental features in production
- Consider running tests on both original and minified code
- Verify that all external dependencies still work with minified code

### Known Issues
- Property mangling may break code that uses reflection
- Dynamic property access using string literals needs careful consideration
- Some browser-specific features may require manual testing

## Testing & Validation

Run the dedicated test suite for JavaScript Minifier:

```bash
# Run unit tests
npm test -- js-minifier

# Typecheck
npm run typecheck
```

## Screenshot

![JavaScript Minifier Screenshot](./images/featured.png)
