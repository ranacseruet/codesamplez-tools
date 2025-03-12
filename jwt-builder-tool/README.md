# JWT Builder

A powerful and user-friendly web tool for building JSON Web Tokens (JWTs) with support for both standard and custom claims.

## Summary

JWT Builder is a browser-based tool that allows users to create JWTs by specifying standard claims, adding custom claims, and signing tokens using HMAC-SHA256 (HS256) algorithm. The tool provides an intuitive interface for JWT generation with real-time validation and error handling.

## Privacy & Security
- 🔒 **100% Client-Side Processing**: All JWT operations including signing are performed locally in your browser
- 🚫 **Zero Data Storage**: Your claims and signature keys are never saved or transmitted anywhere
- 💻 **Offline Capability**: Works completely offline after initial page load
- 🔐 **Secure Key Handling**: Secret keys are only used in memory and never stored or transmitted
- 🛡️ **No External Dependencies**: Uses only native browser crypto APIs for secure operations

## Features

- Support for all standard JWT claims:
  - `iss` (Issuer)
  - `sub` (Subject)
  - `aud` (Audience)
  - `exp` (Expiration Time)
  - `nbf` (Not Before)
  - `iat` (Issued At)
  - `jti` (JWT ID)
- Custom claim support with dynamic field addition
- Flexible datetime input handling:
  - Accepts both ISO 8601 datetime strings (e.g., "2025-12-31T23:59:59Z")
  - Supports UNIX timestamps
- Automatic timestamp conversion and validation
- HMAC-SHA256 (HS256) signature generation
- Copy-to-clipboard functionality
- Real-time error handling and feedback
- Default values for quick testing

## Usage Example

1. Fill in the standard claims:
   - Issuer: The entity issuing the token (e.g., "my-app")
   - Subject: The subject of the token (e.g., "user123")
   - Audience: The intended recipient (e.g., "my-api")
   - Expiration: When the token expires (e.g., "2025-12-31T23:59:59Z")
   - Other standard claims as needed

2. Add custom claims (if required):
   - Click "Add Claim" button
   - Enter claim name and value
   - Add multiple custom claims as needed

3. Enter your signature key:
   - Provide a secure secret key for signing the JWT

4. Generate the JWT:
   - Click "Build JWT" button
   - The generated JWT will appear in the output section

5. Copy the token:
   - Click "Copy JWT" button to copy the token to clipboard
   - Use the token in your application

## Technology Stack

- **Frontend**: Pure HTML, CSS, and JavaScript
- **Cryptography**: Web Crypto API
  - HMAC-SHA256 for token signing
  - Secure key handling using SubtleCrypto
- **Encoding**: 
  - Base64URL encoding for JWT components
  - UTF-8 encoding for string handling
- **Input Processing**:
  - Datetime parsing and validation
  - JSON structure validation
  - Chunk-based string processing for large tokens

## Security Considerations

- All cryptographic operations are performed using the standardized Web Crypto API
- No external dependencies required for JWT generation
- Client-side only - no data is sent to any server
- Signature key is never stored or transmitted

## Browser Compatibility

Compatible with modern browsers that support:
- Web Crypto API
- TextEncoder API
- Clipboard API
- ES6+ JavaScript features

## Development

The tool consists of three main files:
- `index.html`: Structure and UI elements
- `styles.css`: Styling and layout
- `script.js`: JWT generation logic and user interactions

## License

This tool is part of the CodeSamplez collection and is available for free use.
