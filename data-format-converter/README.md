# Data Format Converter

## Summary
The **Data Format Converter Tool** is a web-based utility that converts between JSON, XML, YAML, and `.properties` data formats. It provides a simple interface for users to paste data in one format and convert it to another, with validation and error handling. The tool performs all processing client-side, ensuring data privacy and security.

## Privacy & Security
- 🔒 **100% Client-Side Processing**: All conversions happen in your browser
- 🚫 **No Data Storage**: Your data is never saved or transmitted to any server
- 💻 **Offline Capability**: Works without an internet connection once loaded
- 🔐 **Data Privacy**: No cookies, tracking, or data collection of any kind

---

## Supported Features
1. **Format Conversion**
   - Convert between JSON, XML, YAML, and `.properties` formats
   - Bidirectional conversion between all supported formats, including `.properties`
   - Preserves data structure and hierarchy during conversion

2. **Input Validation**
   - Validates input data before conversion
   - Provides clear error messages for invalid formats
   - Handles common formatting issues

3. **Output Formatting**
   - Pretty-prints output with proper indentation
   - Ensures valid output format according to specifications
   - Supports downloading converted data

4. **User Experience**
   - Example placeholders for each input format
   - Copy to clipboard functionality
   - Download converted data with proper file extension
   - Visual feedback for successful operations

5. **Cross-Browser Compatibility**
   - Works in all modern browsers
   - No external dependencies required

---

## Usage Example

### Step-by-Step Guide
1. **Select Input Format**
   - Click the format button (JSON, XML, or YAML) above the input box to specify your input format

2. **Enter Data**
   - Paste your data into the input textarea
   - Example templates are provided in the placeholder text

3. **Select Output Format**
   - Click the desired output format button below the output box

4. **Convert Data**
   - Click the "Convert" button to perform the conversion
   - The converted data will appear in the output textarea

5. **Use Results**
   - Copy the output to clipboard using the "Copy" button
   - Download the output as a file using the "Download" button

### Example Conversion
**Input (JSON):**
```json
{
  "name": "John",
  "age": 30,
  "city": "New York"
}
```

**Output (XML):**
```xml
<root>
  <name>John</name>
  <age>30</age>
  <city>New York</city>
</root>
```

**Output (YAML):**
```yaml
name: John
age: 30
city: New York
```

**Output (.properties):**
```properties
name=John
age=30
city=New York
```

---

## Technology Stack
- **HTML**: Provides the tool structure including input/output areas and buttons
- **CSS**: Styles the tool with a clean, responsive design
- **JavaScript**: Implements the core conversion logic using:
  - `js-yaml` for YAML parsing/formatting
  - `fast-xml-parser` for XML parsing/formatting
  - Native `JSON` methods for JSON handling
- **Webpack**: Bundles the tool for production use

---

## Integration Guide
To integrate this tool into another webpage:
1. Copy the HTML, CSS, and JavaScript files into your project
2. Ensure all dependencies are included (js-yaml, fast-xml-parser)
3. Preserve the element IDs to maintain functionality:
   - `inputText`: Input textarea
   - `outputText`: Output textarea
   - `convertBtn`: Convert button
   - `copyBtn`: Copy button
   - `downloadBtn`: Download button

---

## Known Limitations
1. **Large Data Sets**
   - Very large data structures may impact performance
   - Complex nested structures may take longer to convert

2. **XML Specifics**
   - XML attributes are converted to object properties with `@` prefix
   - XML namespaces are not fully supported

3. **YAML Specifics**
   - Some advanced YAML features may not be supported
   - Multi-document YAML is not supported

---

## Future Enhancements
1. **Additional Formats**
   - Support for CSV, TOML, and other common formats
   - Custom format templates

2. **Advanced Features**
   - Schema validation
   - Format auto-detection
   - Batch conversion

3. **UI Improvements**
   - Syntax highlighting
   - Dark mode
   - Side-by-side comparison view

4. **Performance Optimizations**
   - Web Workers for large conversions
   - Streaming processing for very large files

---

## Troubleshooting
### Issue: Conversion fails with "Invalid format" error
- **Cause**: Input data doesn't match the selected format
- **Solution**:
  1. Verify the input format is correctly selected
  2. Check for syntax errors in the input data
  3. Use the example templates as reference

### Issue: Output looks incorrect
- **Cause**: Different formats handle data structures differently
- **Solution**:
  1. Check for known format differences (e.g., XML attributes vs JSON properties)
  2. Try converting back to original format to verify round-trip consistency

### Issue: Tool doesn't respond
- **Cause**: Possible JavaScript error or conflict
- **Solution**:
  1. Check browser console for errors
  2. Refresh the page
  3. Ensure all required scripts are loaded
