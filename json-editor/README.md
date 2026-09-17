# JSON Editor

A standalone, privacy-preserving visual tree editor for JSON built with Preact and TypeScript. It allows developers to construct, modify, inspect, and restructure JSON documents visually without writing raw syntax.

## Privacy & Security

- 🔒 **100% Client-Side Processing**: All JSON tree operations, parsing, and serialization run locally in your browser.
- 🚫 **No Server Storage**: Your JSON data is never transmitted to any external server.
- 📁 **Local File Drop**: Drag any `.json` file into the editor to load it into the visual tree (5 MB limit, binary files rejected).
- 🛡️ **Defensive Boundaries**: Imports are constrained to a maximum depth of 100 levels and 10,000 value nodes to prevent tab exhaustion.

---

## Features

- **Visual Tree Builder**: View and manipulate JSON documents as an interactive hierarchical tree.
- **Inline Editing**: Double-click or select nodes to modify object keys, array items, and primitive values (string, number, boolean, null).
- **Type Switching**: Dynamically convert any node between string, number, boolean, null, object, and array without losing parent context.
- **Node Operations**: Add child properties or array elements, duplicate subtrees, delete nodes, and reorder siblings up/down.
- **Expand / Collapse All**: Deep tree traversal controls to collapse or expand all nested nodes at once.
- **Undo / Redo History**: Full transactional history supporting up to 100 undo/redo actions.
- **Multi-Format Preview**: Live synchronized preview with selectable formatting (2 spaces, 4 spaces, tabs, or minified).
- **Export Capabilities**: One-click copy to clipboard or download as `edited.json`.

---

## Safety & Validation

- **Strict Validation**: Parsed with native `JSON.parse`. Malformed imports are rejected with line/column diagnostic messages without overwriting your current work.
- **Duplicate Key Prevention**: Object key updates prevent accidental duplication before replacing existing properties.
- **Numeric Precision Note**: Numbers are stored using standard JavaScript IEEE-754 64-bit floats. For 64-bit integers exceeding `Number.MAX_SAFE_INTEGER` (`9007199254740991`), use string representation to prevent rounding.

---

## Usage Guide

1. **Start or Import**:
   - Start with a default empty `{}` object, or click **Import** / drop a `.json` file.
2. **Edit Properties**:
   - Click any property name or value in the visual tree to edit it.
   - Use the type dropdown on each node to toggle types (e.g. String to Number or Object to Array).
3. **Restructure**:
   - Click the **+** button on an Object or Array node to append child properties.
   - Use the up/down arrows next to any element to reorder siblings.
4. **Preview & Export**:
   - Select your preferred indentation in the preview pane.
   - Click **Copy Output** or **Download**.

---

## Testing & Validation

Run the dedicated test suite for JSON Editor:

```bash
# Run unit tests
npm test -- json-editor

# Typecheck
npm run typecheck
```
