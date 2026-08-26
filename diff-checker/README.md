# Diff Checker

## Summary
The **Diff Checker Tool** is a lightweight, web-based utility designed to compare two blocks of text and highlight their differences line by line, including specific word changes within modified lines. It provides an intuitive interface for users to paste texts, compare them, and view the changes in a clear, color-coded format. The tool is particularly useful for comparing multiline texts, programming code, HTML, or any other textual content. Built entirely with plain JavaScript, CSS, and HTML, it ensures compatibility and performance without relying on external libraries or frameworks.

## Privacy & Security
- 🔒 **100% Client-Side Processing**: All text comparisons are performed locally in your browser
- 🚫 **No Data Storage**: Your text content is never saved or transmitted to any server
- 💻 **Offline Capability**: Works without an internet connection once loaded
- 🔐 **Data Privacy**: No cookies, tracking, or data collection of any kind

---

## Supported Features
1. **Text Comparison**
   - Compares two blocks of text line by line
   - Identifies additions, deletions, and unchanged lines
   - Smart whitespace handling with configurable sensitivity

2. **Multiline Support**
   - Handles multi-line inputs seamlessly, making it suitable for code, HTML, or large documents

3. **Color-Coded Differences**
   - Added lines are highlighted with a light green background
   - Removed lines are highlighted with a light red background
   - Unchanged lines are displayed as-is
   - Specific word changes within modified lines are highlighted with darker green/red backgrounds

4. **Whitespace Handling**
   - Option to ignore or consider whitespace differences
   - Default setting ignores whitespace for code comparison convenience
   - Toggle available for exact whitespace matching when needed

5. **Cross-Browser Compatibility**
   - Works in all modern browsers without requiring additional plugins or configurations

6. **Difference Navigation**
    - Use the "Prev" and "Next" buttons above the results to jump between blocks of consecutive differences. A counter shows the current block number and the total count.

7. **Word-Level Highlighting**
   - Highlights specific word changes within modified lines using darker shades of red/green.

8. **Visual Feedback**
   - Displays a "Diff computation complete!" message briefly after the diff results are shown.

---

9. **File Drop**
   - Drag a file onto either pane to load it into that side
   - The file is read in the browser and never uploaded (5 MB limit, binary files rejected)
   - A drop deliberately does not auto-compare: it fills one pane at a time, and
     comparing against an empty pane would render the whole file as an insertion

10. **Shareable Links**
   - The Share button copies a link carrying both panes plus the whitespace option
   - The payload is LZ-compressed into the URL's `#d=` fragment, which browsers never
     send to a server, so the compared text stays local
   - Opening the link restores both panes and the option, then runs the compare
   - Links over ~8,000 characters are refused rather than silently truncated
   - The codec loads as a lazy chunk on first use, so visitors who never share
     do not download it

## Usage Example

### Step-by-Step Guide
1. **Input Texts**
   - Paste the first block of text into the left textarea labeled "Paste your first text here..."
   - Paste the second block of text into the right textarea labeled "Paste your second text here..."

2. **Configure Options**
   - Check/uncheck "Ignore whitespace" based on your needs:
     - Checked (default): Ignores differences in spaces, tabs, and line endings
     - Unchecked: Shows all whitespace differences

3. **Compare Texts**
   - Click the "Compare" button to analyze the differences between the two texts

4. **View Results**
   - The differences will be displayed below the button in a styled output area
   - Added lines will appear with a light green background, removed lines with a light red background, and unchanged lines will remain unstyled.
   - Within modified lines, specific added words will have a darker green background, and removed words will have a darker red background with a strike-through.

### Example Input
**Text 1:**
```javascript
function greet(name) {
  console.log("Hello, " + name);
}
```

**Text 2:**
```javascript
function greet(name) {
  console.log("Hi, " + name);
}
```

### Example Output (Conceptual Markdown)
```diff
function greet(name) {
- console.log("~~Hello,~~ " + name); // Removed word "Hello,"
+ console.log("**Hi,** " + name); // Added word "Hi,"
}
```
*(Note: Actual output uses colored backgrounds for highlighting)*

---

## Technology Stack
- **HTML**: Provides the structure of the tool, including input fields, buttons, and result display
- **CSS**: Styles the tool with a modern, clean design. Includes responsive layouts and color-coded highlights for differences (line and word level).
- **JavaScript**: Implements the core diff algorithm (line and word level) to compare texts and dynamically update the UI with results. Uses the `diff` library.
- **Plain Text Processing**: No external frameworks are used, ensuring lightweight and efficient performance.

---

## Integration Guide
To integrate this tool into another webpage:
1. Copy the provided HTML, CSS, and JavaScript code into your project
2. Ensure unique element IDs (e.g., `#diff-checker-container`, `#text1`, `#text2`) are preserved to avoid conflicts with existing elements
3. Embed the tool within a `<div>` or `<iframe>` if necessary, depending on your layout requirements

---

## Known Limitations
1. **Performance with Large Inputs**
   - Line + word diffing is inherently expensive on very large inputs. To keep the UI responsive, compares above ~20,000 combined characters offload the diff computation to a Web Worker (`diff.worker.ts` via `diff-runner.ts`), with an automatic main-thread fallback if the worker is unavailable. Smaller compares run synchronously. Rendering the result (DOM + syntax highlighting) still happens on the main thread.

---

## Future Enhancements
1. **Character-Level Diffs**
   - Option for character-level diffing for even finer granularity (currently supports line and word level).

2. **Syntax Highlighting (Unchanged Lines Only)**
   - Basic syntax highlighting (currently JavaScript) is applied only to code lines that are completely **unchanged** between the two inputs.
   - Added, removed, or modified lines (including those with only word-level differences) are *not* syntax highlighted to ensure diff markers remain clear.

3. **Export Options**
   - Allow users to export the diff results as a file (e.g., `.txt` or `.html`).

4. **Advanced Algorithms**
   - Explore alternative diff algorithms or optimizations for performance improvements.

5. **Dark Mode**
   - Add a toggle for a dark mode UI to improve accessibility and user preference options.

---

## Troubleshooting
### Issue: Differences are not displayed correctly
- **Cause**: The tool performs a line-by-line comparison followed by word-level comparison on modified lines. Formatting issues (e.g., extra newlines or inconsistent indentation) can affect line matching.
- **Solution**:
  1. Check the "Ignore whitespace" option if spacing differences should be ignored. It applies to both passes: lines that differ only in whitespace are reported as unchanged (shown once, using the original text), and on a line that also carries a real change, only the changed words are highlighted while each side keeps its own indentation.
  2. Uncheck it if you need to see exact whitespace differences, highlighted down to the individual space or tab.
  3. "Whitespace" here means spaces, tabs and line endings. Look-alike characters such as a non-breaking space (`U+00A0`) are always treated as real content, so swapping one for a plain space still shows up as a difference.
  3. Ensure both texts are properly formatted before comparison.

### Issue: Tool does not load or function as expected
- **Cause**: Conflicts with existing scripts or styles on the host page.
- **Solution**: Verify that the tool's unique element IDs and styles do not clash with other elements on the page.
