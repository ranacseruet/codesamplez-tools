# JSON Formatter

A tool for formatting and validating JSON data with alphabetical key sorting.

## Features
- Pretty-print JSON with proper indentation
- Sort object keys alphabetically for consistent output
- Validate JSON syntax with detailed error messages
- Copy formatted output to clipboard with confirmation
- Error highlighting for invalid JSON with specific error details
- Mobile-responsive design
- Syntax highlighting for better readability

## Usage
1. Paste your JSON into the input area
2. Click "Format JSON" to validate and format
   - The tool will automatically validate the JSON syntax
   - If valid, it will format with proper indentation
   - Object keys will be sorted alphabetically at all levels
3. Use "Copy Output" button to copy formatted JSON
   - A confirmation message will appear when copied successfully
4. Invalid JSON will show specific error messages
   - The error message will indicate the exact issue
   - The input area will be preserved for corrections

## Example Input
```json
{"z":1,"a":{"d":2,"c":3},"b":[4,3,2]}
```

## Example Output
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

## Current Limitations
- Large JSON files (>10MB) may impact performance
- Array elements are not sorted (only object keys are sorted)
- Clipboard operations require secure context (HTTPS or localhost)
- Comments in JSON are not supported (as per JSON specification)
- Does not preserve trailing commas
- Unicode characters in strings are not escaped/unescaped
- No support for JSON5 or JSON with comments (JSONC)

## Error Handling
- Provides specific error messages for common JSON syntax errors:
  - Missing or extra commas
  - Unclosed brackets or braces
  - Invalid property names
  - Missing colons
  - Invalid values
- Errors are displayed below the input area
- The error message includes the position where the error was detected

## Browser Support
Works in all modern browsers (Chrome, Firefox, Safari, Edge). Requires JavaScript enabled and clipboard API support for copy functionality.

![JSON Formatter Screenshot](images/json-formatter.png)
