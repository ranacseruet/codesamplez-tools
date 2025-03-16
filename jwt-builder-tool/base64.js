// Base64 helper functions for both browser and test environments
const base64lookup = [];
const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// Initialize lookup table
for (let i = 0; i < base64Chars.length; i++) {
  base64lookup[base64Chars.charCodeAt(i)] = i;
}

export function encodeBase64(data) {
  const bytes = new Uint8Array(data);
  let result = '';
  let i;
  const len = bytes.length;

  // Process each byte in the array
  for (i = 0; i < len; i += 3) {
    // Combine three bytes into one number
    const byte1 = bytes[i];
    const byte2 = i + 1 < len ? bytes[i + 1] : 0;
    const byte3 = i + 2 < len ? bytes[i + 2] : 0;

    const triplet = (byte1 << 16) | (byte2 << 8) | byte3;

    // Convert to four base64 characters
    result += base64Chars[(triplet >> 18) & 0x3F];
    result += base64Chars[(triplet >> 12) & 0x3F];
    result += i + 1 < len ? base64Chars[(triplet >> 6) & 0x3F] : '=';
    result += i + 2 < len ? base64Chars[triplet & 0x3F] : '=';
  }

  return result;
}

export function decodeBase64(str) {
  str = str.replace(/[^A-Za-z0-9+/=]/g, '');
  const len = str.length;

  // Calculate the output length
  let paddingLength = str.endsWith('==') ? 2 : str.endsWith('=') ? 1 : 0;
  let outputLength = (len * 3) / 4 - paddingLength;

  const bytes = new Uint8Array(outputLength);
  let position = 0;

  // Process each group of four characters
  for (let i = 0; i < len; i += 4) {
    const enc1 = base64lookup[str.charCodeAt(i)];
    const enc2 = base64lookup[str.charCodeAt(i + 1)];
    const enc3 = base64lookup[str.charCodeAt(i + 2)] || 0;
    const enc4 = base64lookup[str.charCodeAt(i + 3)] || 0;

    const triplet = (enc1 << 18) | (enc2 << 12) | (enc3 << 6) | enc4;

    if (position < outputLength) bytes[position++] = (triplet >> 16) & 0xFF;
    if (position < outputLength) bytes[position++] = (triplet >> 8) & 0xFF;
    if (position < outputLength) bytes[position++] = triplet & 0xFF;
  }

  return bytes;
}

export function base64UrlToBase64(str) {
  let output = str.replace(/-/g, '+').replace(/_/g, '/');
  switch (output.length % 4) {
    case 0:
      break;
    case 2:
      output += '==';
      break;
    case 3:
      output += '=';
      break;
    default:
      throw new Error('Invalid base64url string');
  }
  return output;
}

export function base64ToBase64Url(str) {
  return str.replace(/[+]/g, '-')
    .replace(/[/]/g, '_')
    .replace(/[=]+$/, '');
}

// Test environment polyfills
export function setupBase64Polyfills() {
  if (typeof global !== 'undefined') {
    global.atob = str => {
      const base64 = base64UrlToBase64(str);
      const bytes = decodeBase64(base64);
      return new TextDecoder('utf-8').decode(bytes);
    };

    global.btoa = str => {
      const bytes = new TextEncoder().encode(str);
      const base64 = encodeBase64(bytes);
      return base64;
    };
  }
}
