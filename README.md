# codesamplez-tools
![Build](https://github.com/ranacseruet/codesamplez-tools/actions/workflows/ci.yml/badge.svg) [![Test Coverage](https://codecov.io/github/ranacseruet/codesamplez-tools/graph/badge.svg)](https://codecov.io/github/ranacseruet/codesamplez-tools)


A collection of browser-based developer utilities and tools built with AI technology. These tools are designed to streamline common development tasks and text manipulation operations, all accessible directly through your web browser at Codesamplez.com.

## Features

- 🚀 Browser-based - No installation required
- 💻 Lightweight and fast
- 🔒 Client-side processing - Your data stays in your browser
- 📱 Mobile-friendly design
- 🎨 Clean, intuitive interface

## Tools

### Base64 Converter
A powerful tool for encoding and decoding Base64 strings with support for multiple character encodings.
- Convert plain text to Base64 encoding and vice versa
- Support for multiple character encodings (UTF-8, ASCII, ISO-8859-1, UCS-2)
- Auto-detection of Base64 strings
- File upload support for processing text files
- Real-time conversion as you type
- Copy results with one click
- 100% client-side processing for data privacy
- Works offline - no internet connection required

### Diff Checker
Compare text files and identify differences quickly.
- Side-by-side comparison view
- Line-level difference highlighting (added/removed lines)
- Line numbering
- Difference navigation (jump between changes)
- Option to ignore whitespace
- Copy differences to clipboard
- Support for large text files

### JWT Decoder
Analyze and validate JSON Web Tokens.
- Decode JWT headers and payloads
- Validate token signatures
- Display token expiration status
- Format claims in readable JSON
- No server-side processing - tokens stay in your browser

### Text Analyzer
A comprehensive text analysis tool with real-time statistics.
- Word, character, sentence, and paragraph counting
- Average word and sentence length calculations
- Detailed punctuation statistics (periods, commas, question marks, exclamation marks)
- 100% client-side processing for privacy
- Real-time analysis as you type
- Clear, intuitive statistics display
- Works offline after initial page load

### JavaScript Minifier
Advanced JavaScript code minification tool.
- Remove comments and unnecessary whitespace
- Preserve string literals and regular expressions
- Experimental variable name shortening
- Optional property name mangling
- Real-time size and compression statistics
- Local processing - no server-side dependencies

### JSON Formatter
A tool for formatting and validating JSON data.
- Pretty-print JSON with proper indentation
- Sort object keys alphabetically
- Validate JSON syntax
- Copy formatted output to clipboard
- Error highlighting for invalid JSON

### JWT Builder
Create and sign custom JSON Web Tokens.
- Add custom claims
- Choose signing algorithms
- Set token expiration
- Generate signed tokens
- Preview token structure before generation

## Getting Started

1. Visit [Codesamplez.com](https://codesamplez.com)
2. Choose the tool you need from the navigation menu
3. Start using it directly in your browser - no setup required!

## Browser Compatibility

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Technologies

- HTML5
- CSS3
- Vanilla JavaScript
- No external dependencies

## Development

### Setup
1. Clone the repository
2. Install dependencies: `npm install`
3. Build the project: `npm run build`
4. Run tests: `npm test`

### Build Process
The build process creates a production-ready version in the `build/` directory:
- Minifies JavaScript files
- Optimizes CSS files
- Updates HTML to reference minified assets
- Injects shared HTML partials (e.g., header, footer) into HTML templates using EJS syntax and Webpack's HtmlWebpackPlugin.
- Copies static assets (images)

### Testing
Tests are written using Jest and run in a JSDOM environment:
- Run all tests: `npm test`
- Test files are located alongside their respective tools
- Uses testHelper.js for common test utilities

## Contributing

We welcome contributions! If you'd like to improve these tools:

1. Fork the repository
2. Create your feature branch
3. Install dependencies: `npm install`
4. Make your changes
5. Run tests: `npm test`
6. Build the project: `npm run build`
7. Test locally by running the dev server: `npm run dev`
8. Commit your changes
9. Push to the branch
10. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## About

These tools are part of the Codesamplez.com platform, developed to provide developers with quick, efficient, and secure utilities for common development tasks. All processing is done client-side to ensure your data remains private and secure.
