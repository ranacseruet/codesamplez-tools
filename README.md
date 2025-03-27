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
A tool for encoding and decoding Base64 strings.
- Convert plain text to Base64 encoding
- Decode Base64 strings back to plain text
- Support for UTF-8 character encoding
- Real-time conversion as you type

### Diff Checker
Compare text files and identify differences quickly.
- Side-by-side comparison view
- Character-level difference highlighting
- Line numbering
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
Comprehensive text analysis tool.
- Word and character counting
- Line counting
- Reading time estimation
- Keyword density analysis
- Support for multiple text formats

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
7. Commit your changes
8. Push to the branch
9. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## About

These tools are part of the Codesamplez.com platform, developed to provide developers with quick, efficient, and secure utilities for common development tasks. All processing is done client-side to ensure your data remains private and secure.
