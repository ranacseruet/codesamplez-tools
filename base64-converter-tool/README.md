# Base64 Converter

A powerful and user-friendly web tool for encoding and decoding Base64 strings with support for multiple character encodings.

## Privacy & Security

- 🔒 100% client-side processing - all conversions happen in your browser
- 🚫 No data storage - your data is never saved or transmitted anywhere
- 💻 Works offline - can be used without an internet connection

## Features

- 🔄 Auto-detection of Base64 strings
- 📝 Multiple encoding support (UTF-8, ASCII, ISO-8859-1, UCS-2)
- 📁 File upload capability for encoding
- 💾 Download decoded Base64 as a file (supports any file type)
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

#### Encoding Files to Base64

The "Upload File" feature allows you to directly encode any file into its Base64 representation.

1.  Click "Upload File" to select any file from your computer (text, image, PDF, binary, etc.).
2.  The tool will read the file's content and directly encode it to Base64.
3.  The resulting Base64 string will be displayed in the **Output** area.
4.  The **Input** area will show a placeholder message, for example: `[File: yourfile.png uploaded and encoded to output]`.
5.  The character encoding selection (`UTF-8`, `ASCII`, etc.) is not applicable when uploading files this way, as the file is treated as binary data for direct Base64 encoding.

#### Decoding Base64 to Files

You can decode a Base64 string (whether it represents text or binary data like an image or PDF) and download it as a file.

1.  Paste your Base64 string into the **Input** area.
    *   If your input is a **Data URL** (e.g., `data:image/png;base64,iVBORw...`), the tool will attempt to parse the MIME type and suggest a filename (e.g., `decoded_file.png`).
    *   If it's a raw Base64 string, you'll need to provide a suitable filename.
2.  Select "Decode" or "Auto Detect" mode. The text representation of the decoded content will appear in the **Output** area (this may look like garbled text for binary files).
3.  If the input is valid Base64, the "Download Decoded File" button will become active.
4.  Enter a desired filename (e.g., `myImage.png`, `document.pdf`) in the "Download Filename" input field next to the button. If you don't provide one, a default like `download.dat` or one based on a detected MIME type will be used.
5.  Click "Download Decoded File". The browser will download the decoded binary data as the specified file.
6.  The character encoding selection (`UTF-8`, `ASCII`, etc.) is primarily for how the text preview in the **Output** area is interpreted. For downloading files, the raw binary data from the Base64 string is used.
7.  If you need to decode a Base64 string that is *inside* a text file, you should open that file, copy the Base64 text, and paste it into the **Input** area.

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

The tool uses a sophisticated multi-step validation process to detect Base64 strings:
1. Length validation (must be multiple of 4)
2. Character set validation using regex pattern `^[A-Za-z0-9+/]*={0,2}$`
3. Advanced padding validation:
   - Padding (`=`) can only appear at the end
   - Maximum of 2 padding characters allowed
   - Validates padding position relative to string length
4. Decode/encode round-trip verification using `btoa(atob(str)) === str`

### Error Handling

The converter includes comprehensive error handling for:
- Invalid Base64 strings with detailed validation feedback
- Character encoding issues:
  - ASCII: Replaces non-ASCII characters with '?'
  - ISO-8859-1: Handles overflow by masking to 8 bits
  - UCS-2: Validates byte sequences and handles surrogate pairs
  - UTF-8: Detects invalid sequences using TextDecoder
- Memory-efficient processing of large files using streaming approach
- Input validation:
  - Null/undefined input detection
  - Empty string handling
  - Invalid character encoding selection
- File operations:
  - File reading errors (e.g., if the file is inaccessible)
  - Errors during the Base64 encoding process of the file content
- Clipboard operations:
  - Copy operation failures
  - Permissions handling
  - Unsupported browser detection

### Special Features

#### UCS-2 Encoding
- Special handling for surrogate pairs and emoji characters
- 4-byte sequence detection for extended Unicode characters
- Fallback handling for basic BMP (Basic Multilingual Plane) characters
- Maintains character integrity during encode/decode operations

#### Memory Management
- Efficient byte array allocation
- Streaming processing for large files
- Automatic garbage collection optimization
- Browser memory limit considerations

## Browser Compatibility

The tool requires a modern browser that supports:
- ES6+ JavaScript
- TextEncoder/TextDecoder APIs
- File API
- Clipboard API

## License

MIT License - Feel free to use, modify, and distribute this tool as needed.
