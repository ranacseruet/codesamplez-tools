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
   - Use the "Prev" and "Next" buttons above the results to jump between highlighted differences. A counter shows the current difference number and the total count.

7. **Word-Level Highlighting**
   - Highlights specific word changes within modified lines using darker shades of red/green.

---

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
   - While the tool handles moderate-sized texts efficiently, extremely large inputs may impact performance due to the complexity of line and word diffing.

---

## Future Enhancements
1. **Character-Level Diffs**
   - Option for character-level diffing for even finer granularity (currently supports line and word level).

2. **Syntax Highlighting**
   - Add syntax highlighting for programming languages and markup languages like HTML, CSS, and JavaScript.

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
  1. Check the "Ignore whitespace" option if spacing differences should be ignored *between lines*. Word-level diffing within lines still considers whitespace.
  2. Uncheck it if you need to see exact whitespace differences *between lines*.
  3. Ensure both texts are properly formatted before comparison.

### Issue: Tool does not load or function as expected
- **Cause**: Conflicts with existing scripts or styles on the host page.
- **Solution**: Verify that the tool's unique element IDs and styles do not clash with other elements on the page.
