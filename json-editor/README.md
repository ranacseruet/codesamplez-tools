# JSON Editor

The JSON Editor is a standalone, client-side Preact tool for building and editing JSON as a visual tree.

## Features

- Start with an empty `{}` document or import strict JSON from paste, a local file, or drag and drop.
- Edit object keys and primitive values inline.
- Add properties/items, duplicate, delete, and move sibling nodes.
- Change the root or any node between string, number, boolean, null, object, and array.
- Expand or collapse nested containers, with Expand All and Collapse All controls.
- Undo and redo up to 100 committed actions.
- Preview with 2 spaces, 4 spaces, tabs, or minified output.
- Copy the generated JSON or download it as `edited.json`.

## Safety and scope

Input is parsed with strict `JSON.parse` and processed locally in the browser. Imports are limited to 5 MiB, 10,000 value nodes, and a maximum nesting depth of 100; the same node and depth limits are enforced while editing. Invalid imports preserve the current document and show parser diagnostics. During tree edits, invalid numbers and duplicate object keys are rejected before they can replace a valid value. Browser JavaScript uses IEEE-754 numbers, so integer literals outside the safe integer range can be rounded during import; duplicate keys follow `JSON.parse` semantics and the last occurrence wins. Use strings for exact large identifiers and unique keys when those values matter.

Version 1 intentionally does not include JSON Schema, JSON5/JSONC, comments, share links, local persistence, raw preview editing, search/filtering, or drag-and-drop tree reparenting.

## Development

The tool is discovered from `tool.meta.json`, prerendered through `scripts/prerender-tool.js`, and bundled with the other standalone tools. Its tree model lives in `json-editor-core.ts` and has no browser or third-party editor dependency.
