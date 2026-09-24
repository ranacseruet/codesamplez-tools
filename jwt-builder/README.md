# JWT Builder

A browser-based tool for creating signed JSON Web Tokens (JWTs) with standard and custom claims.

## Summary

JWT Builder creates HS256 and RS256 tokens entirely in the browser. Choose an algorithm, enter a shared secret or an unencrypted PKCS#8 RSA private key, configure the claims, and build a signed token without sending the payload or signing key to a server.

## Features

- HS256 signing with a shared secret using HMAC SHA-256
- RS256 signing with an unencrypted PKCS#8 RSA private key (2048 bits or stronger) using RSASSA-PKCS1-v1_5 and SHA-256
- An algorithm selector with signing-key guidance that adapts to HS256 or RS256
- Standard JWT claims: `iss`, `sub`, `aud`, `exp`, `nbf`, `iat`, and `jti`
- Dynamic custom claims with string, object, and array values
- ISO 8601 and UNIX timestamp input for time-based claims
- Cryptographically random 32-character Base64URL shared-secret generation for HS256 testing
- Copy-ready token output and shared-secret control
- Inline validation with a cleared result whenever a build fails

## Usage

1. Fill in the required issuer and expiration time plus any optional standard or custom claims.
2. Choose a signing algorithm:
   - **HS256:** enter a shared secret or generate a random test secret.
   - **RS256:** paste an unencrypted PKCS#8 RSA private key (2048 bits or stronger) whose PEM block begins with `-----BEGIN PRIVATE KEY-----`.
3. Select **Build JWT**.
4. Copy the generated token from the result panel.

The **Load Sample** action restores the standard sample claims, selects HS256, restores the sample shared secret, and clears any RSA private key.

## Input Processing and Validation

- Time-based claims accept ISO 8601 dates or UNIX timestamps in seconds (10+ digits) and are converted to JWT NumericDate values. Shorter integers such as a bare year (`2025`) are rejected rather than read as a 1970 timestamp.
- A non-empty invalid datetime is rejected instead of being silently omitted.
- Custom-claim values beginning with `{` or `[` are parsed as JSON when valid; malformed JSON-style values fall back to strings.
- Missing issuer, expiration time, or active signing key is reported inline.
- RS256 reports clear errors for public, malformed, encrypted, or unsupported private-key input without displaying key contents or raw Web Crypto errors.
- RS256 reports when Web Crypto is unavailable in the current browser context separately from key-format errors.

## Privacy and Security

- Claims and signing keys are processed locally with the Web Crypto API.
- No payload, shared secret, or private key is stored or transmitted by the tool.
- Signing keys are held in memory only for the current page session.
- Use test credentials. Avoid entering production shared secrets, private keys, or sensitive payloads into any browser tool.

## Test Coverage

The Jest and browser suites cover:

- HS256 and RS256 header and signature generation
- RS256 verification against the matching known public key
- PKCS#8 PEM parsing and public/malformed-key errors
- Algorithm-specific UI state and signing-key routing
- Required-field and datetime validation
- Standard, custom, nested, Unicode, and special-character payloads
- Desktop/mobile accessibility and cross-browser Web Crypto behavior

## Browser Compatibility

The tool requires a modern browser with:

- Web Crypto API support for HMAC and RSASSA-PKCS1-v1_5
- `TextEncoder` and `TextDecoder`
- Clipboard support for copy actions
- ES6+ JavaScript features

## Development

The main files are:

- `JWTBuilder.ts`: algorithm-specific signing, PEM parsing, and JWT assembly
- `script.tsx`: rendered controls and browser interactions
- `content.tsx`: guide and FAQ content
- `styles.css`: tool-specific layout and presentation
- `tool.meta.json`: standalone page metadata
## Testing & Validation

Run the dedicated test suite for JWT Builder:

```bash
# Run unit tests
npm test -- jwt-builder

# Typecheck
npm run typecheck
```

## License

This project is licensed under the [MIT License](../LICENSE).
