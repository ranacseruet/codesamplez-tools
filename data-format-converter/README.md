# Data Format Converter

A fast, client-side bidirectional data converter built with Preact and TypeScript. Convert data structures seamlessly between JSON, XML, YAML, and Java `.properties` formats with instant validation, formatting, and file drop support.

## Privacy & Security

- 🔒 **100% Client-Side Processing**: All parsing, structural transformation, and serialization happen locally in your browser.
- 🚫 **No Server Uploads**: Your structured data is never transmitted across the network.
- 📁 **Local File Drop**: Drag text data files (`.json`, `.xml`, `.yaml`, `.yml`, `.properties`) directly onto the input editor (5 MB limit, binary files rejected).
- 🔗 **Private Sharing**: Shareable state links compress payload into the `#c=` URL hash fragment, which is never sent to the host server.

---

## Supported Formats

- **JSON**: Standard JavaScript Object Notation with full nested object and array handling.
- **XML**: XML parsing and generation via `fast-xml-parser`, supporting root tag encapsulation and attribute mapping.
- **YAML**: Human-readable data serialization via `js-yaml` with clean indentation.
- **.properties**: Key-value property mapping commonly used in Java and system configuration environments.

---

## Features

- **Bidirectional Conversion**: Convert freely from any supported format to any other supported format.
- **Syntax Validation**: Input data is parsed and validated before conversion; clear error notifications highlight malformed syntax.
- **Auto-Convert Mode**: Optionally triggers automatic conversion upon typing or file upload.
- **Copy & Download**: Export results to clipboard or download with the appropriate extension (`.json`, `.xml`, `.yaml`, `.properties`).
- **Shareable URLs**: Generate compact LZ-compressed links that retain input text and format configurations in the URL hash.

---

## Usage Guide

1. Choose your **Input Format** (JSON, XML, YAML, or .properties).
2. Paste your data into the editor or drag and drop a data file.
3. Choose your desired **Output Format**.
4. Click **Convert** or press `Cmd/Ctrl + Enter`.
5. Copy the output to your clipboard or download as a file.

---

## Testing & Validation

Run the dedicated test suite:

```bash
# Run unit tests
npm test -- data-format-converter

# Typecheck
npm run typecheck
```
