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

## Limitations
- Does not optimize property names (e.g., `margin-left` → `ml`)
- Maintains CSS syntax validity during minification
- Best for basic optimization of modern CSS codebases

For advanced optimizations, consider using tools like PurifyCSS or dedicated build pipelines.
