# Diff Checker

## Summary
Diff Checker is a web-based tool that compares two text inputs and highlights the differences between them. It's useful for comparing code snippets, documents, or any text-based content.

## Features
- Character-level text comparison
- Three types of differences highlighted:
  - **Insertions** (new text) in green
  - **Deletions** (removed text) in red  
  - **Modifications** (changed text) in yellow
- Side-by-side comparison with line numbers
- Real-time diff calculation
- Responsive design for mobile and desktop
- Clear button to reset both text areas

## Usage Guide
1. Open diff-checker.html in your browser
2. Enter or paste your text in the left and right input boxes
3. Differences will be automatically highlighted:
   - Green: Newly added text
   - Red: Removed text
   - Yellow: Modified text
4. Click "Clear" to reset both text areas

## Examples
### Character-level Differences
```
Original: Hello world!
Modified: Hello there world!
```
- "there" will be highlighted in green as an insertion
- Spaces around it will be highlighted in yellow as modifications

### Modifications
```
Original: The quick brown fox
Modified: The fast brown fox
```
- "quick" → "fast" will be highlighted in yellow as a modification

## Built With
- HTML
- CSS
- JavaScript

## Test

Requires node installed in the system.

```
node script.test.js
```
