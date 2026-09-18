# CSS Minifier

A fast, client-side CSS minification tool built with Preact and TypeScript. It optimizes CSS stylesheets by safely stripping comments, compressing whitespace, consolidating identical rules, and removing redundant zero units while strictly preserving stylesheet behavior.

## Privacy & Security

- 🔒 **100% Client-Side Processing**: Minification happens entirely within the browser.
- 🚫 **No Server Uploads**: Your style code is never sent to any remote server.
- 📁 **Local File Drop**: Drag a `.css` file onto the editor to load it locally using the browser's `FileReader` API (5 MB limit, binary files rejected).

---

## Features

### Core Optimizations
- **Comment Removal**: Eliminates single-line and multi-line comments (`/* ... */`).
- **Whitespace Stripping**: Removes unnecessary line breaks, tabs, and spaces while strictly preserving required whitespace in descendant and sibling selectors.
- **Unit Optimization**: Cleans redundant units on zero values (e.g. `0px` → `0`).
- **Selector Consolidation**: Safely merges identical selectors without altering specificity or cascading order.
- **Media Query Support**: Properly preserves `@media` query blocks and nested rules.

### Diagnostics & Statistics
- **Syntax Validation**: Checks CSS syntax using DOM parsing before minifying. Invalid CSS surfaces inline error alerts without crashing the UI.
- **Savings Metrics**: Live computation of original size, minified size, and percentage reduction.
- **One-Click Copy & Download**: Copy the output to clipboard or export as `minified.css`.

---

## Usage Guide

1. Paste your CSS into the input editor or drop a `.css` file.
2. Click **Minify** or press `Cmd/Ctrl + Enter`.
3. Review the size savings and minified CSS output.
4. Click **Copy Output** or **Download**.

---

## Development & Testing

### Development Server

```bash
# Start local development server (port 8081)
npm run dev
```

### Testing

```bash
# Run CSS Minifier test suite
npm test -- css-minifier

# Typecheck
npm run typecheck
```
