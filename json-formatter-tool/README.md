# JSON Formatter

A tool for formatting and validating JSON data with optional alphabetical key sorting.

## Privacy & Security
- 🔒 **100% Client-Side Processing**: All JSON formatting and validation happens in your browser
- 🚫 **No Server Storage**: Your JSON data is never saved or transmitted to any server
- 💻 **Offline Support**: Fully functional without internet connection once loaded
- 🔐 **Zero Data Collection**: No cookies, tracking, or data persistence of any kind

## Features
- Pretty-print JSON with proper indentation
- Optional alphabetical sorting of object keys (enabled by default)
- Validate JSON syntax with detailed error messages
- Copy formatted output to clipboard with success confirmation
- Collapsible/expandable JSON nodes for better navigation
- Size comparison between original and formatted JSON
- Load sample data for quick testing
- Mobile-responsive design

## Usage
1. Paste your JSON into the input area
2. Toggle "Sort Keys" checkbox to enable/disable alphabetical sorting
3. Click "Format JSON" to validate and format
   - The tool will automatically validate the JSON syntax
   - If valid, it will format with proper indentation
   - Object keys will be sorted alphabetically if enabled
4. Use "Copy Output" button to copy formatted JSON
   - A temporary success message will appear when copied
5. Click "Sample Data" to load example JSON for testing
6. Invalid JSON will show specific error messages below input
   - The error message will indicate the exact issue
   - The input area will be preserved for corrections

## Example Input
```json
{"z":1,"a":{"d":2,"c":3},"b":[4,3,2]}
```

## Example Output (with sorting enabled)
```json
{
  "a": {
    "c": 3,
    "d": 2
  },
  "b": [
    4,
    3,
    2
  ],
  "z": 1
}
```

## Size Comparison
The tool shows:
- Original size (bytes/KB/MB)
- Formatted size (bytes/KB/MB)

## Current Limitations
- Large JSON files (>10MB) may impact performance
- Array elements are never sorted (only object keys when enabled)
- Clipboard operations require secure context (HTTPS or localhost)
- Comments in JSON are not supported (as per JSON specification)
- Does not preserve trailing commas
- Unicode characters in strings are not escaped/unescaped
- No support for JSON5 or JSON with comments (JSONC)
- No syntax highlighting (basic text rendering only)

## Error Handling
- Provides specific text error messages for common JSON syntax errors:
  - Missing or extra commas
  - Unclosed brackets or braces
  - Invalid property names
  - Missing colons
  - Invalid values
- Errors are displayed below the input area
- The error message includes details about the parsing failure

## Browser Support
Works in all modern browsers (Chrome, Firefox, Safari, Edge). Requires JavaScript enabled and clipboard API support for copy functionality.

![JSON Formatter Screenshot](images/json-formatter.png)
