# CSS Minifier Tool

A lightweight web-based tool for minifying CSS code by removing comments and unnecessary whitespace while preserving functionality.

## Features
- **Comment Removal**: Strips all `/* ... */` style comments.
- **Whitespace Compression**: Reduces multiple spaces, tabs, and line breaks into single spaces between tokens.
- **Fast Output**: Immediate results displayed in the formatted preview area.

## Usage Instructions

1. Open `index.html` in a modern browser (Chrome/Firefox/Edge).
2. Paste your CSS code into the input field.
3. Click the "Minify" button to process and see optimized output.
4. Copy the minified CSS from the result section for deployment.

---

### Example Workflow

**Input:**
```css
/* Header styling */
body {
  font-family: Arial, sans-serif;
}

.header {
  padding: 20px; 
}
```

**Output:**
`body{font-family:Ariel,sans-serif}.header{padding:20px}`

---

## Security Concerns
- **Input Validation**: The tool processes user-provided CSS without executing it, minimizing injection risks.
- **No External Dependencies**: Self-contained processing reduces potential security vulnerabilities.
- **Client-Side Only**: All processing happens locally in the browser without sending data to remote servers.
- **Output Sanitization**: The minified output preserves valid CSS syntax without introducing unsafe modifications.

## Browser Compatibility
- **Modern Browsers**: Fully supported in recent versions of Chrome, Firefox, Safari, and Edge.
- **Legacy Support**: Basic functionality works in Internet Explorer 11+.
- **Mobile Browsers**: Compatible with mobile Chrome, Safari, and Firefox.
- **Performance**: Efficient processing even with large CSS files across all supported browsers.

---

## Limitations
- Does not optimize property names (e.g., `margin-left` → `ml`)
- Maintains CSS syntax validity during minification
- Best for basic optimization of modern CSS codebases

For advanced optimizations, consider using tools like PurifyCSS or dedicated build pipelines.
