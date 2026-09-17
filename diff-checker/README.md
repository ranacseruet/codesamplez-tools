# Diff Checker

A fast, client-side text and code difference viewer built with Preact and TypeScript. It compares two blocks of text or source code line-by-line from dual input panes and highlights changes at the word level, with support for unified `.patch` file export and LZ-compressed shareable links.

## Privacy & Security

- 🔒 **100% Client-Side Processing**: All comparisons run entirely within your browser.
- 🚫 **No Server Communication**: Neither your original nor modified text is ever sent across the network.
- 📁 **Safe File Loading**: Files dropped into either pane are read locally using the browser's `FileReader` API (5 MB limit, binary files rejected).
- 🔗 **Private Sharing**: Shareable URLs encode state in the URL hash fragment (`#d=...`), which is never transmitted to the host server.

---

## Features

1. **Line-by-Line Comparison with Dual Inputs**
   - Compares original and modified inputs line-by-line in a unified diff display with paired line numbering.
   - Highlights additions (green), deletions (red), and unchanged context.
2. **Word-Level Highlighting**
   - Precise intra-line highlighting for changed words within modified lines.
3. **Difference Navigation**
   - Jump through consecutive change blocks using the "Prev" and "Next" buttons with live position tracking (`Block X of Y`).
4. **Configurable Whitespace Sensitivity**
   - "Ignore whitespace" toggle (enabled by default) treats differences in indentation, trailing spaces, and line endings as unchanged.
   - When unchecked, exact whitespace differences are highlighted. Carriage returns (`\r`) from dropped files or links are visually surfaced as `␍`.
5. **Drag-and-Drop File Loading**
   - Drag files onto either pane or use the file picker button.
6. **Unified `.patch` Export**
   - Export comparison results as a standard Git-compatible `.patch` file for code review or applying via `git apply`.
7. **Shareable State Links**
   - Generate compressed URLs via LZ-string in the hash fragment for collaboration without server-side persistence.
8. **Responsive Iris Theme**
   - Built on the dark-first Iris design system with accessible contrast and mobile layout protection.

---

## Worker Offload Architecture

Text comparison algorithms (Myers diff) can be computationally expensive on large inputs. To preserve responsive 60 FPS interactions and optimize Core Web Vitals (specifically Interaction to Next Paint - INP):

- **Offload Threshold**: When the combined character count of both panes exceeds **20,000 characters**, the calculation is automatically dispatched to a dedicated Web Worker (`diff.worker.ts`).
- **Worker Pipeline**:
  - `diff-runner.ts` wraps the worker invocation using the typed `common/worker-runner.ts` utility.
  - The worker computes line-level and word-level diffs off the main thread.
- **Resilient Fallback**: If Web Workers are unsupported, worker creation fails, or a timeout occurs, execution gracefully falls back to synchronous computation on the main thread.
- **Non-blocking Rendering**: Rendered results are mounted efficiently via Preact to avoid locking the UI during DOM construction.

---

## Usage Guide

1. **Input Texts**:
   - Paste or drag the original text into the left pane ("Original").
   - Paste or drag the updated text into the right pane ("Modified").
2. **Configure Options**:
   - Toggle **Ignore whitespace** depending on whether whitespace and line endings should be evaluated.
3. **Compare**:
   - Click **Compare** or press `Cmd/Ctrl + Enter`.
4. **Navigate & Export**:
   - Use **Prev / Next** to step through modified blocks.
   - Click **Download .patch** to export unified diff patch output.
   - Click **Share** to copy a private shareable URL.

---

## Testing & Validation

Run the dedicated test suite for Diff Checker:

```bash
# Run unit tests
npm test -- diff-checker

# Run type check
npm run typecheck
```
