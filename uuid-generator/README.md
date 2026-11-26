# UUID Generator

Generate version 4 and version 7 UUIDs in the browser, and check a UUID you already have.

## Features

- Version 4 via `crypto.randomUUID`, with `crypto.getRandomValues` when that method is missing
- Version 7 (RFC 9562): a 48-bit Unix timestamp in milliseconds, then random bits
- One UUID, or up to 100 at a time
- Uppercase and no-hyphen formatting
- Copy and download the generated list
- Validate one or more pasted UUIDs and show the version, the variant, and the version 7 timestamp

## Usage

1. Choose version 4 or version 7.
2. Set the count from 1 to 100.
3. Check Uppercase or No hyphens if you want that formatting.
4. Click Generate.
5. Copy the list or download `uuids.txt`.
6. To check an existing value, paste it (one per line) and click Validate.

## Notes

Uppercase and hyphen choices change only the text. The 128-bit value stays the same. The validator accepts the hyphenated form, 32 hex digits, `{braces}`, and a `urn:uuid:` prefix. It reads a Unix timestamp only from version 7. Version 1 uses a different timestamp layout, so that field stays empty for it.
