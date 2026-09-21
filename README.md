# codesamplez-tools

[![Build Status](https://github.com/ranacseruet/codesamplez-tools/actions/workflows/ci.yml/badge.svg)](https://github.com/ranacseruet/codesamplez-tools/actions/workflows/ci.yml)
[![codecov](https://codecov.io/github/ranacseruet/codesamplez-tools/graph/badge.svg)](https://codecov.io/github/ranacseruet/codesamplez-tools)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D24.15.0%20%3C25-brightgreen.svg)](https://nodejs.org)
[![Privacy](https://img.shields.io/badge/Privacy-100%25%20Client--Side-success.svg)](#core-principles)

A suite of fast, privacy-preserving browser utilities built for developers. Every tool runs 100% client-side in the browser—zero server uploads, zero installation, and zero telemetry in local development.

Live at [tools.codesamplez.com](https://tools.codesamplez.com).

Tracking is off by default: the repository ships no analytics or ad IDs, and only
a production deployment that explicitly supplies them loads GA4/AdSense. See
[Analytics & Ads](./CONTRIBUTING.md#analytics--ads-deploy-time-configuration).

---

## Tool Catalog

| Tool | Category | Key Capabilities | Documentation |
|---|---|---|---|
| **Base64 Converter** | Encoders & Decoders | Data URI image preview, multi-encoding text conversion, drag-and-drop file loading | [`base64-converter/`](./base64-converter/README.md) |
| **CSS Minifier** | Code Formatters | Comment and whitespace removal, safe property compression, error detection | [`css-minifier/`](./css-minifier/README.md) |
| **Data Format Converter** | Encoders & Decoders | Bidirectional JSON, XML, YAML, and Java `.properties` conversion | [`data-format-converter/`](./data-format-converter/README.md) |
| **Diff Checker** | Text Analysis | Line-by-line comparison, word diffs, unified `.patch` export, offloaded worker diffing | [`diff-checker/`](./diff-checker/README.md) |
| **Image Editor** | Image Tools | Crop, resize, rotate, flip, color filters, text captions, PNG/JPEG/WebP export | [`image-editor/`](./image-editor/README.md) |
| **JavaScript Minifier** | Code Formatters | Code-split Babel engine, identifier mangling, whitespace stripping | [`js-minifier/`](./js-minifier/README.md) |
| **JSON Editor** | Code Formatters | Interactive tree view, inline type switching, property insertion, undo/redo | [`json-editor/`](./json-editor/README.md) |
| **JSON Formatter** | Code Formatters | Formatting, tree folding, Draft 7 / Draft 2020-12 schema validation, worker offload | [`json-formatter/`](./json-formatter/README.md) |
| **JWT Builder** | Encoders & Decoders | HS256 / RS256 token generation with browser-native Web Crypto API | [`jwt-builder/`](./jwt-builder/README.md) |
| **JWT Decoder** | Encoders & Decoders | Real-time token parsing, claim tree inspection, HMAC signature verification | [`jwt-decoder/`](./jwt-decoder/README.md) |
| **QR Code Generator** | Encoders & Decoders | Instant PNG QR code generation, customizable error correction and sizing | [`qr-code-generator/`](./qr-code-generator/README.md) |
| **Text Analyzer** | Text Analysis | Word, syllable, and reading time statistics, readability formulas, worker offload | [`text-analyzer/`](./text-analyzer/README.md) |

---

## Core Principles

- 🔒 **100% Client-Side Privacy**: All data transformations, hashing, and token validations execute locally in your browser. Inputs and files are never sent across the network.
- ⚡ **Web Worker Performance**: CPU-heavy tasks (large diffs, extensive text parsing, schema validation) transparently offload to dedicated Web Workers, ensuring fluid 60 FPS interactions.
- ⌨️ **Keyboard-First UX**: Press `?` on any page to open a context-aware shortcut overlay. Execute primary actions quickly with `Cmd/Ctrl+Enter`.
- 🎨 **Unified Iris Design System**: Dark-first theme with Material Design 3 tokens, Geist and Geist Mono typography, and responsive layouts hardened for viewports down to 390px.
- 🚀 **Prerendered & Zero-JS Friendly**: Every tool prerenders semantic HTML and JSON-LD structured data during build time, guaranteeing fast initial loads and SEO discoverability.

---

## Quick Start

### Prerequisites

- **Node.js**: `>= 24.15.0 < 25` (enforced at install time via `.npmrc`; Jest additionally requires Node >= 24.9 for native `require(esm)`)
- **npm**: `>= 10.0.0`

### Setup

```bash
# Clone the repository
git clone https://github.com/ranacseruet/codesamplez-tools.git
cd codesamplez-tools

# Use the pinned Node version (see .nvmrc)
nvm install && nvm use

# Install dependencies
npm install
```

### Development

```bash
# Start local development server with live reload (zero telemetry, port 8081)
npm run dev
```

### Production Build

```bash
# Build all tools into standalone static artifacts (build/)
npm run build

# Serve the production build locally (port 8080)
npm start
```

Targeted single-tool builds are also supported:
```bash
npm run build -- --tool diff-checker-tool
```

---

## Quality Gates

Before submitting changes, ensure all validation checks pass:

```bash
# Type check all TypeScript files
npm run typecheck

# Run test suites (Jest + JSDOM)
npm test

# Verify production build output integrity
npm run verify-build

# Enforce bundle size budgets
npm run bundle-budget-check

# Audit dependencies for known vulnerabilities
npm run audit:deps
```

---

## Architecture Overview

```
codesamplez-tools/
├── <tool-name>/          # Standalone tool implementations (Preact + TypeScript/CSS)
│   ├── tool.meta.json    # Catalog metadata, SEO configuration, dependencies, version
│   ├── CHANGELOG.md      # Per-tool release history
│   ├── script.tsx        # UI components and tool shell integration
│   ├── styles.css        # Scoped styling rules
│   └── README.md         # Tool-specific documentation and algorithms
├── common/               # Shared runtime, shell, and design tokens
│   ├── app-shell/        # Header, footer, recent tools, shortcut dialog
│   ├── material-theme.css # M3 design tokens & dark-first Iris palette
│   └── worker-runner.ts  # Typed Web Worker offload pipeline with fallbacks
├── config/               # Catalog taxonomy and site configuration
└── scripts/              # Prerendering, document building, and bundle budgets
```

Each tool compiles to an independent, self-contained deployment contract:
- `build/<tool>/index.html` (prerendered HTML)
- `build/<tool>/styles.main.css` (scoped styles)
- `build/<tool>/bundle.main.js` (hydrated script)

### Tool versioning

Tools are versioned and released independently: each tool's semver lives in its
`tool.meta.json`, changes are documented in its `CHANGELOG.md`, and CI requires
a version bump whenever a tool's runtime output changes. Built pages expose the
version via `<meta name="tool-version">`, and `build/versions.json` (deployed at
the site root) maps every tool to its live version plus the source commit. See
[CONTRIBUTING.md](./CONTRIBUTING.md) for the release flow.

---

## Contributing

Contributions are welcome! Please read our [Contributing Guidelines](./CONTRIBUTING.md) to learn about our design patterns, Web Worker conventions, and PR workflows.

- **Found a bug?** Open an issue using our [Bug Report Template](https://github.com/ranacseruet/codesamplez-tools/issues/new?template=bug_report.yml).
- **Proposing a feature?** Submit a [Feature Request](https://github.com/ranacseruet/codesamplez-tools/issues/new?template=feature_request.yml).
- **Need help?** Check out our [Support Guidelines](./SUPPORT.md).

---

## Security

For vulnerability disclosures, please review our [Security Policy](./SECURITY.md) and report privately via [GitHub Security Advisories](https://github.com/ranacseruet/codesamplez-tools/security/advisories/new).

---

## Community & Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

---

## License

This project is licensed under the [MIT License](./LICENSE).
