# Base64 Converter

A powerful and user-friendly web tool for encoding and decoding Base64 strings with support for multiple character encodings.

## Features

- 🔄 Auto-detection of Base64 strings
- 📝 Multiple encoding support (UTF-8, ASCII, ISO-8859-1, UCS-2)
- 📁 File upload capability
- 📋 One-click copy to clipboard
- 🎨 Clean, responsive user interface
- ⚡ Real-time conversion
- ❌ Error handling and validation

## Usage

### Basic Text Conversion

1. Enter or paste your text in the input textarea
2. Choose your preferred mode:
   - **Auto Detect**: Automatically determines if the input is Base64 encoded
   - **Encode**: Force Base64 encoding of the input
   - **Decode**: Force Base64 decoding of the input
3. Select your character encoding:
   - UTF-8 (default, recommended for most uses)
   - ASCII
   - ISO-8859-1
   - UCS-2
4. View the result below the input area
5. Click "Copy Result" to copy the converted text to clipboard

### File Processing

1. Click "Upload File" to select a text file
2. The file content will be loaded into the input area
3. Conversion happens automatically based on your selected mode and encoding

## Character Encodings

- **UTF-8**: Universal character encoding, supports all Unicode characters (default)
- **ASCII**: Basic 7-bit encoding, supports English characters and common symbols
- **ISO-8859-1**: 8-bit encoding, supports Western European characters
- **UCS-2**: Fixed-width 16-bit encoding, supports Basic Multilingual Plane

## Technical Implementation

The converter is built using pure JavaScript with the following key components:

- `TextEncoder`/`TextDecoder` for handling various character encodings
- `btoa`/`atob` for Base64 conversion
- Regular expression validation for Base64 string detection
- File API for handling file uploads
- Clipboard API for copy functionality

### Base64 Detection

The tool uses a multi-step validation process to detect Base64 strings:
1. Length validation (must be multiple of 4)
2. Character set validation (A-Z, a-z, 0-9, +, /, =)
3. Padding validation
4. Decode/encode round-trip verification

### Error Handling

The converter includes comprehensive error handling for:
- Invalid Base64 strings
- Unsupported characters in selected encoding
- File reading errors
- Clipboard operation failures

## Browser Compatibility

The tool requires a modern browser that supports:
- ES6+ JavaScript
- TextEncoder/TextDecoder APIs
- File API
- Clipboard API

## License

MIT License - Feel free to use, modify, and distribute this tool as needed.
