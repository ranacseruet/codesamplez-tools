# CSS Minifier Tool

A powerful web-based tool for optimizing CSS code by intelligently removing redundant characters while preserving functionality. This tool implements multiple optimization techniques to reduce CSS file size without compromising code integrity.

## Features

### Core Optimizations
- **Comment Removal**: Eliminates both single-line and multi-line `/* ... */` comments
- **Whitespace Optimization**: 
  - Removes unnecessary spaces, tabs, and line breaks
  - Preserves essential spaces in selectors
  - Optimizes spacing around operators and brackets
- **Media Query Optimization**: Maintains media query structure while minimizing internal content
- **Unit Optimization**: Removes unnecessary units (e.g., `0px` → `0`)
- **Selector Combination**: Merges rules with identical declarations
- **Syntax Preservation**: Maintains valid CSS syntax throughout optimization

### Advanced Features
- **Media Query Support**: Properly handles nested media queries while maintaining functionality
- **Smart Space Management**:
  - Optimizes spaces around selectors, operators, and brackets
  - Preserves spaces in complex selectors to maintain functionality
  - Removes redundant spaces in property declarations
- **Declaration Block Optimization**:
  - Combines identical selectors
  - Maintains proper semicolon placement
  - Preserves important declarations

## Usage Instructions

### Web Interface
1. Open `index.html` in any modern browser
2. Paste your CSS code into the input field
3. Click "Minify" to process the code
4. Copy the optimized output from the result section

### Development Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Build the project:
   ```bash
   npm run build
   ```
3. Run tests:
   ```bash
   npm test
   ```

## Examples

### Basic CSS Minification
**Input:**
```css
/* Header styles */
.header {
    padding: 20px;
    margin-bottom: 10px;
}

/* Main content */
.content {
    padding: 20px;
    font-family: Arial, sans-serif;
}
```

**Output:**
```css
.header{padding:20px;margin-bottom:10px}.content{padding:20px;font-family:Arial,sans-serif}
```

### Media Query Handling
**Input:**
```css
@media screen and (max-width: 768px) {
    .header {
        padding: 10px;
    }
    
    .content {
        padding: 15px;
    }
}

@media (min-width: 1200px) {
    .header {
        max-width: 1140px;
    }
}
```

**Output:**
```css
@media screen and (max-width:768px){.header{padding:10px}.content{padding:15px}}@media (min-width:1200px){.header{max-width:1140px}}
```

## Technical Details

### Optimization Techniques

1. **Comment Removal**
   - Removes all CSS comments using regex pattern `/\/\*[\s\S]*?\*\//g`
   - Preserves any content outside comment blocks

2. **Whitespace Management**
   - Eliminates redundant whitespace using multiple regex patterns
   - Preserves necessary whitespace in selectors and values
   - Optimizes spaces around operators and special characters

3. **Unit Optimization**
   - Removes unnecessary units from zero values
   - Handles all CSS units (px, em, rem, %, etc.)
   - Preserves units where required

4. **Selector Combination**
   - Combines selectors with identical declarations
   - Maintains proper cascading order
   - Preserves specificity

### Error Handling

The tool performs an initial validation of the input CSS. This is achieved by attempting to apply the CSS to a temporary style element in the document (or a simulated DOM environment during tests).
- **Invalid CSS Syntax**: If the provided CSS is syntactically incorrect and cannot be successfully parsed and applied by the browser's engine (or the testing environment's CSS parser):
    - An error message (e.g., "Error: Invalid CSS input. Please check your CSS syntax.") will be displayed in the output area.
    - The statistics (original size, minified size, savings) will be cleared or reflect an error state.
    - The minification process will not proceed.
- This validation step helps catch significant syntax errors before attempting minification, ensuring that the minifier only processes structurally sound CSS.

## Browser Compatibility

### Full Support
- Chrome 49+
- Firefox 45+
- Safari 9+
- Edge 12+
- Opera 36+

### Partial Support
- Internet Explorer 11 (basic functionality)
- Older mobile browsers

## Security Considerations

### Input Processing
- Sanitizes user input to prevent XSS attacks
- Validates CSS syntax before processing
- Escapes potentially harmful characters

### Output Safety
- Maintains valid CSS syntax
- Prevents injection of malicious code
- Preserves essential security-related properties

## Performance

### Optimization Metrics
- Average file size reduction: 25-30%
- Processing speed: ~100KB/s
- Memory usage: Linear with input size

### Best Practices
- Limit input size to 1MB for optimal performance
- Use gzip compression with minified output
- Consider using source maps for development

## Limitations

### Current Limitations
- Does not reorder properties for optimization
- Maintains original property order
- No support for CSS custom properties optimization
- Does not combine media queries

### Known Edge Cases
- Complex selector combinations
- Vendor-specific syntax
- CSS custom property declarations
- Certain legacy browser hacks

## UI Implementation

### CSS Architecture
The CSS Minifier tool follows a structured CSS architecture that leverages shared components and styles:

- **Shared Styles**: Utilizes the common CSS framework from `common/shared-styles.css`
- **Component-Based Design**: Implements UI using reusable components with consistent naming conventions
- **OOCSS Approach**: Separates structure from skin using object and component classes
- **Responsive Layout**: Adapts to different screen sizes using a flexible grid system

### Key UI Components
- **Layout Objects**: `.o-grid-2col`, `.o-panel`, `.o-panel-header`, `.o-toolbar`
- **Form Components**: `.c-input`, `.c-input--textarea`, `.c-button`, `.c-checkbox-group`, `.c-checkbox-item`
- **Utility Components**: `.c-stats-panel`, `.c-stat-row`, `.c-notification`

### CSS Organization
- **Tool-Specific Styles**: Contains only overrides and adjustments specific to the CSS Minifier tool
- **Shared Framework**: Leverages common styles for consistent appearance across all tools
- **Responsive Behavior**: Adapts layout for different screen sizes using media queries

## Contributing

See CONTRIBUTING.md for detailed information about:
- Code style guidelines
- Pull request process
- Testing requirements
- Documentation standards

---

For advanced use cases or build pipeline integration, consider complementary tools like:
- PostCSS
- PurgeCSS
- CSS Modules
