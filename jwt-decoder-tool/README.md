# JWT Decoder & Validator

A powerful, browser-based tool for decoding and validating JSON Web Tokens (JWT). This tool provides a secure, client-side solution for developers to inspect and verify JWT tokens without sending sensitive data to any server.

## Privacy & Security
- 🔒 **100% Client-Side Processing**: All token decoding and validation happens in your browser
- 🚫 **Zero Data Storage**: Your tokens and secret keys are never saved or transmitted anywhere
- 💻 **Offline Capability**: Works completely offline after initial page load
- 🔐 **Secure Key Handling**: Secret keys are only used in memory and never persisted
- 🛡️ **No External Dependencies**: Uses only native browser crypto APIs for secure operations
- 🧹 **No Data Persistence**: All data is cleared when you close the browser tab

## Features

- **Consistent Text Area Height**:
  - Ensures the JWT Token and Decoded Token text areas maintain a consistent height, even when inputs are cleared.
- **Real-time Decoding**:
  - Instantly decode JWT tokens as you type
  - Debounced input handling for optimal performance
  - Clear error messages for invalid tokens
- **Button Status Indicators**:
    - The "Decode JWT" button dynamically updates its text and appearance ("Decoded ✓", "Invalid Token ✗", "Decode JWT") to reflect the current token's validity. It is disabled and acts purely as a status indicator.
    - The "Verify Signature" button also updates its text and appearance ("✓ Valid", "✗ Invalid", "Secret Missing", "Token Invalid", "Verify Signature") based on the last verification attempt. It is enabled only when a token has been successfully decoded.
- **Real-time Verification**: Signature verification status updates automatically (debounced) as you type in the secret key field, provided a valid token is present.
- **Signature Verification**: Validate JWT signatures using HMAC-SHA256
- **Base64 Support**: Automatic handling of both standard and URL-safe Base64 encoding
- **Secure Processing**: All operations performed client-side for maximum security
- **Copy Functionality**: 
  - One-click copying of decoded token information
  - Visual feedback for successful copy operations
  - Error handling for clipboard operations
- **Responsive Design**: Works seamlessly on both desktop and mobile devices

## How to Use

1. **Decode a Token**:
   - Paste your JWT token into the "Token" textarea
   - The decoded header and payload will appear instantly in the "Decoded Token" section

2. **Verify Signature**:
   - Enter the secret key used to sign the token in the "Secret Key" field
   - The tool supports both plain text and Base64-encoded secrets
   - View the validation result in the "Validation Result" section
   - ✓ Green checkmark indicates a valid signature
   - ✗ Red X indicates an invalid signature

3. **Copy Results**:
   - Click the "Copy Decoded" button to copy the decoded token information to your clipboard
   - Button changes color and text to confirm successful copying
   - Automatic reset after 2 seconds
   - Error handling with tooltip feedback if copying fails

## Technical Details

### Token Processing
- Supports standard JWT format (header.payload.signature)
- Handles URL-safe Base64 encoding (replacing `-` and `_` with `+` and `/`)
- Automatically manages Base64 padding

### Security Features
- All processing done client-side using browser's native APIs
- Uses Web Crypto API for secure HMAC-SHA256 signature verification
- No data transmitted to external servers
- No token storage or caching

### Signature Verification
- Implements HMAC-SHA256 using the Web Crypto API
- Supports both raw and Base64-encoded secret keys
- Real-time validation with immediate feedback

## Browser Compatibility

The tool uses modern web APIs and is compatible with:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

Required browser features:
- Web Crypto API
- Clipboard API
- TextEncoder
- async/await support

## Security Considerations

1. **Client-Side Processing**:
   - All token processing occurs in your browser
   - No data is sent to external servers
   - Tokens and secrets remain private

2. **Secret Key Handling**:
   - Secret keys are only used for local signature verification
   - Keys are never stored or transmitted
   - Memory is cleared after verification

3. **Best Practices**:
   - Do not use this tool with sensitive production tokens
   - Clear your browser history/cache after working with sensitive data
   - Use only for development and debugging purposes

## Development

The tool is built using TypeScript/TSX and modern web APIs, requiring no external dependencies. The codebase is organized into the following main components:

- `index.html`: Structure and layout
- `JWTDecoder.ts`: Class responsible for parsing, decoding, and validating JWTs
- `JsonTreeViewRenderer.ts`: Class responsible for rendering the interactive JSON tree view
- `script.tsx`: Contains the `JWTDecoderUI` class and Preact runtime wrapper, handles UI interactions/event listeners, and initializes the app on DOMContentLoaded.
- `styles.css`: Responsive styling and visual design
- `JWTDecoder.test.js`: Unit tests for the `JWTDecoder` class
- `script.test.js`: Unit tests for the UI interactions in `script.tsx`
