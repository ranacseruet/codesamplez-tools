# Text Analyzer

A fast, privacy-preserving browser text analysis utility built with Preact and TypeScript. It calculates real-time text statistics, reading metrics, readability scores, and keyword densities with Web Worker offloading.

![Text Analyzer Tool](images/featured.png)

## Privacy & Security

- 🔒 **100% Client-Side Processing**: All text analysis happens locally in your browser.
- 🚫 **No Data Storage**: Your text is never saved or transmitted to any server.
- 💻 **Offline Support**: Works completely offline once loaded.
- 🔐 **Zero Data Collection**: No cookies, tracking, or persistent data capture.
- 📁 **Safe File Loading**: Upload or drop files locally via the browser's `FileReader` API (5 MB limit, binary files rejected).

---

## Features

- **Character Count**: Total characters including whitespace and punctuation.
- **Word Count**: Words detected by splitting whitespace with Unicode compatibility.
- **Sentence Count**: Accurate sentence boundary detection using punctuation patterns (`.`, `!`, `?`).
- **Line & Paragraph Counts**: Distinguishes between physical lines and empty-line delimited paragraphs.
- **Average Word & Sentence Lengths**: Dynamic averages computed in real-time.
- **Reading Time**: Estimated reading duration based on standard 200 words-per-minute speed.
- **Readability Scores**: Flesch Reading Ease and Flesch-Kincaid grade levels using a dependency-free syllable counting heuristic.
- **Keyword Density**: Highlights top non-stop-word frequencies while ignoring standalone numeric tokens.
- **Punctuation Statistics**: Frequency tracking for periods, commas, questions, and exclamations.
- **Drag-and-Drop File Loading**: Drag text files directly into the input area.

---

## Worker Offload Architecture

Text parsing and readability heuristics can incur noticeable main-thread execution time on lengthy documents (e.g. multi-chapter books or long logs).

- **Offload Threshold**: Inputs exceeding **5,000 characters** automatically delegate metric computations to a dedicated Web Worker (`text-analyzer.worker.ts`).
- **Worker Pipeline**:
  - `analyzer-runner.ts` interfaces with `common/worker-runner.ts` to manage worker requests with timeouts.
  - Calculations run off the main thread so typing and scrolling stay at 60 FPS without input latency (INP optimization).
- **Graceful Fallback**: If Web Workers are disabled or unavailable in the environment, computations execute synchronously on the main thread without failing.
- **Reactive UI**: Statistics update smoothly in Preact components as worker responses arrive.

---

## Usage Guide

1. Enter or paste text into the input area, or drop a text file.
2. Statistics update instantly in the cards below the input.
3. Use the clear button to reset input and metrics at any time.

---

## Development & Testing

### Prerequisites

- **Node.js**: `>= 24.15.0 < 25`
- **npm**: `>= 10.0.0`

### Testing

```bash
# Run Text Analyzer tests specifically
npm test -- text-analyzer

# Typecheck
npm run typecheck
```
