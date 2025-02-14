# JWT Decoder & Validator

A powerful, browser-based tool for decoding and validating JSON Web Tokens (JWT). This tool provides a secure, client-side solution for developers to inspect and verify JWT tokens without sending sensitive data to any server.

## Features

- **Real-time Decoding**: Instantly decode JWT tokens as you type
- **Signature Verification**: Validate JWT signatures using HMAC-SHA256
- **Base64 Support**: Automatic handling of both standard and URL-safe Base64 encoding
- **Secure Processing**: All operations performed client-side for maximum security
- **Copy Functionality**: One-click copying of decoded token information
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
   - Visual feedback confirms successful copying

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

The tool is built using vanilla JavaScript and modern web APIs, requiring no external dependencies. The codebase is organized into three main components:

- `index.html`: Structure and layout
- `script.js`: Core functionality and token processing
- `styles.css`: Responsive styling and visual design
