# QR Code Generator Tool

## Overview
The QR Code Generator Tool allows users to create QR codes from text or URLs. This tool is part of the CodeSamplez Tools suite, providing a simple interface for generating QR codes that can be scanned by mobile devices.

## Privacy & Security
- 🔒 100% client-side processing - all QR code generation happens in your browser
- 🚫 No data storage - your input is never saved or transmitted anywhere
- 💻 Works offline - can be used without an internet connection
- 🔐 No external dependencies - uses pure JavaScript implementation

## Features
- 📱 Generate QR codes from any text input or URL
- 🎨 Customize QR code appearance:
  - Adjust size (100px to 1000px)
  - Set margin (0px to 50px)
  - Choose error correction level (L, M, Q, H)
- 💾 Download generated QR codes as PNG images
- ⚡ Real-time generation - updates as you type or change configuration
- 🖥️ Responsive design - works on desktop and mobile

## Usage

### Basic QR Code Generation
1. Enter the text or URL you want to encode in the input field
2. (Optional) Adjust QR code settings:
   - **Size**: Drag slider or enter pixel value (100-1000px)
   - **Margin**: Set white border around QR code (0-50px)
   - **Error Correction**: Choose level (L=7%, M=15%, Q=25%, H=30%)
3. View the generated QR code in real-time
4. Use the QR code directly from the page or:
   - Click "Download PNG" to save as image file

### Advanced Usage
- For URLs: QR codes will automatically open in a new tab when scanned
- For plain text: QR codes will display the text content when scanned
- For contact information: Use proper vCard format for best results
- For WiFi credentials: Use format "WIFI:T:WPA;S:SSID;P:password;;"

## Technical Implementation
The QR code generator is built using pure JavaScript with the following key components:

- QR Code generation using the `qrcode-generator` library (bundled)
- Canvas API for rendering QR codes
- Clipboard API for copy functionality
- File API for download functionality
- Responsive design using CSS Flexbox

### QR Code Generation Process
1. Input validation and sanitization
2. Error correction level selection
3. QR code matrix generation
4. Canvas rendering with customizable:
   - Module size (dots per module)
   - Margin (quiet zone)
   - Colors (foreground and background)
5. Image export options:
   - PNG generation via canvas.toDataURL()
   - Clipboard copy via navigator.clipboard.write()

### Error Handling
- Input validation for maximum length (2953 chars for L level)
- Automatic URL detection and formatting
- Error correction level optimization
- Memory management for large QR codes
- Fallback handling for older browsers

## Browser Compatibility
The tool requires a modern browser that supports:
- HTML5 Canvas API
- Clipboard API (for copy functionality)
- File API (for download functionality)
- ES6+ JavaScript

Tested and works on:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Development
The codebase is organized into the following main components:

- `tool.meta.json`: Shared page metadata used to generate the standalone document shell
- `script.tsx`: Preact component implementation and UI interaction handlers
- `content.tsx`: Documentation, guide, and FAQ content
- `styles.css`: Responsive styling and layout
- `script.test.js`: Unit tests for core functionality
- `images/`: Contains tool screenshot and assets

### Testing & Validation

Run the dedicated test suite for QR Code Generator:

```bash
# Run unit tests
npm test -- qr-code-generator

# Typecheck
npm run typecheck
```

## License

This project is licensed under the [MIT License](../LICENSE).
