# JSON Formatter

A tool for formatting and validating JSON data with alphabetical key sorting.

## Features
- Pretty-print JSON with proper indentation
- Sort object keys alphabetically
- Validate JSON syntax
- Copy formatted output to clipboard
- Error highlighting for invalid JSON
- Mobile-responsive design

## Usage
1. Paste your JSON into the input area
2. Click "Format JSON" to validate and format
3. Use "Copy Output" button to copy formatted JSON
4. Invalid JSON will show error messages

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

## Browser Support
Works in all modern browsers (Chrome, Firefox, Safari, Edge). Requires JavaScript enabled.

![JSON Formatter Screenshot](images/json-formatter.png)
