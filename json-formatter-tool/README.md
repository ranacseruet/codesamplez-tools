# JSON Formatter

A tool for formatting and validating JSON data with optional alphabetical key sorting and interactive node collapsing.

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
- **Modern Browsers**: Chrome, Firefox, Safari, Edge
- **Requirements**:
  - JavaScript enabled
  - For copy functionality:
    - Primary: Modern Clipboard API (secure context - HTTPS or localhost)
    - Fallback: execCommand (older browsers/HTTP contexts)
- **Mobile Support**: Fully responsive design with touch-friendly controls

## Technical Implementation
- **Architecture**: Object-oriented design using ES6+ classes
- **Code Organization**:
  - `JSONFormatter` class handles core functionality
  - Modular methods for formatting, rendering, and utilities
- **Test Coverage**: Comprehensive Jest test suite covering:
  - Core JSON formatting and validation
  - Key sorting functionality
  - Byte size calculations
  - Error handling
  - Edge cases (empty objects/arrays, special characters)
  - UI interactions

## Accessibility
- **Keyboard Navigation**:
  - Tab navigation through interactive elements
  - Space/Enter to trigger buttons and toggles
  - Focus management for error messages
- **ARIA Support**:
  - Expandable/collapsible sections use proper ARIA attributes
  - Error messages are properly announced
  - Copy success notifications are screen-reader friendly
- **Visual Indicators**:
  - Clear focus states
  - High contrast toggle indicators (▼/▶)
  - Error messages with distinct styling

## Interactive Features
- **Node Collapsing**:
  - Click toggle buttons (▼/▶) to expand/collapse JSON nodes
  - Nested objects and arrays are collapsible
  - State is preserved during formatting
  - Parent nodes can be collapsed to hide all children
- **Size Comparison**:
  - Real-time size updates on input changes
  - Supports multiple units (bytes, KB, MB, GB, TB)
  - Accurate to 2 decimal places
  - Updates automatically when formatting or editing

![JSON Formatter Screenshot](images/json-formatter.png)
