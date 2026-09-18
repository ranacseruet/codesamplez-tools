import type { JSX } from 'preact';
import { SITE_BASE_URL } from '../common/siteBaseUrl';
import { ToolArticleSection, ToolFaqList, type ToolFaqItem } from '../common/tool-article/ToolArticle';

function createPlainTextFaqItem(question: string, answer: string): ToolFaqItem {
    return {
        question,
        answer,
        structuredDataAnswer: answer
    };
}

export const FAQ_ITEMS: ToolFaqItem[] = [
    createPlainTextFaqItem(
        'Does the tool support batch conversion?',
        'Currently, our data format conversion tool focuses on single-file conversions, perfect for quick JSON to YAML tasks. Stay tuned for future updates that might include batch data conversion for multiple files at once.'
    ),
    createPlainTextFaqItem(
        'How secure is the online converter?',
        'Your data’s safety is our priority with this secure online converter. We don’t store or share any uploaded data, ensuring complete privacy during every JSON to YAML or XML conversion process. Due to 100% client-side processing, your data doesn’t leave your browser.'
    ),
    createPlainTextFaqItem(
        'What file formats can your tool convert between?',
        'Our free online XML converter seamlessly transforms data between XML, YAML, and JSON formats, making it the go-to solution for developers and data enthusiasts. Whether you need a JSON to YAML conversion or XML to JSON conversion, our tool handles it all with ease.'
    ),
    createPlainTextFaqItem(
        'How does the tool handle errors in input data?',
        'Our invalid XML fix feature detects errors in your input and displays clear messages, guiding you to correct issues before conversion. This ensures smooth JSON to XML or YAML processing every time.'
    ),
    createPlainTextFaqItem(
        'Can I use the tool for specific use cases?',
        'Absolutely! Our tool excels in use cases like Kubernetes YAML to JSON conversion for DevOps or API data transformation. It’s your ultimate solution for configuration files and more, boosting productivity effortlessly.'
    )
];

export function DataFormatConverterIntro(): JSX.Element {
    return (
        <section
            className="c-tool-article c-tool-article--intro c-surface-card"
            aria-labelledby="data-format-converter-intro-heading"
        >
            <div className="c-tool-article__content">
                <h2 id="data-format-converter-intro-heading" className="c-tool-article__eyebrow">About This Tool</h2>
                <p className="c-tool-article__lead">
                    The Online Data Format Converter Tool is a web-based utility that converts between JSON, XML,
                    Properties and YAML data formats. It provides a simple interface for users to paste data in one
                    format and convert it to another, with validation and error handling. The tool performs all
                    processing client-side, ensuring data privacy and security.
                </p>
            </div>
        </section>
    );
}

export function DataFormatConverterArticle(): JSX.Element {
    return (
        <section className="c-tool-article c-surface-card" aria-labelledby="data-format-converter-article-heading">
            <div className="c-tool-article__content">
                <h2 id="data-format-converter-article-heading" className="c-tool-article__sr-only">
                    Data Format Converter Guide
                </h2>

                <ToolArticleSection id="data-format-converter-features" title="Supported Features">
                    <ol>
                        <li>
                            <strong>Format Conversion</strong>
                            <ul>
                                <li>Convert between JSON, XML, and YAML formats</li>
                                <li>Bidirectional conversion between all supported formats</li>
                                <li>JSON XML conversion</li>
                                <li>JSON to YAML conversion</li>
                                <li>XML to JSON conversion</li>
                                <li>XML to YAML conversion</li>
                                <li>... and so on</li>
                                <li>Preserves data structure and hierarchy during conversion</li>
                            </ul>
                        </li>
                        <li>
                            <strong>Input Validation</strong>
                            <ul>
                                <li>Validates input data before conversion</li>
                                <li>Provides clear error messages for invalid formats</li>
                                <li>Handles common formatting issues</li>
                            </ul>
                        </li>
                        <li>
                            <strong>Output Formatting</strong>
                            <ul>
                                <li>Pretty-prints output with proper indentation</li>
                                <li>Ensures valid output format according to specifications</li>
                                <li>Supports downloading converted data</li>
                            </ul>
                        </li>
                        <li>
                            <strong>User Experience</strong>
                            <ul>
                                <li>Example placeholders for each input format</li>
                                <li>Copy to clipboard functionality</li>
                                <li>Download converted data with proper file extension</li>
                                <li>Visual feedback for successful operations</li>
                                <li>Click Upload File or drag a local text file into the input</li>
                            </ul>
                        </li>
                        <li>
                            <strong>Cross-Browser Compatibility</strong>
                            <ul>
                                <li>Works in all modern browsers</li>
                                <li>No external dependencies required</li>
                            </ul>
                        </li>
                    </ol>

                    <div className="c-tool-article__cta-row">
                        <a className="c-button" href={SITE_BASE_URL}>
                            Explore More Dev Tools
                        </a>
                    </div>
                </ToolArticleSection>

                <ToolArticleSection id="data-format-converter-usage" title="Data Format Converter Usage Example">
                    <h3>Step-by-Step Guide</h3>
                    <ol>
                        <li>
                            <strong>Select Input Format</strong>
                            <ul>
                                <li>Click the format button (JSON, XML, Properties or YAML) above the input box to specify your input format</li>
                            </ul>
                        </li>
                        <li>
                            <strong>Enter Data</strong>
                            <ul>
                                <li>Paste your data into the input textarea, or click Upload File to choose a local text file</li>
                                <li>Example templates are provided in the placeholder text</li>
                            </ul>
                        </li>
                        <li>
                            <strong>Select Output Format</strong>
                            <ul>
                                <li>Click the desired output format button below the output box</li>
                            </ul>
                        </li>
                        <li>
                            <strong>Convert Data</strong>
                            <ul>
                                <li>Click the &ldquo;Convert&rdquo; button to perform the conversion</li>
                                <li>The converted data will appear in the output textarea</li>
                            </ul>
                        </li>
                        <li>
                            <strong>Use Results</strong>
                            <ul>
                                <li>Copy the output to clipboard using the &ldquo;Copy&rdquo; button</li>
                                <li>Download the output as a file using the &ldquo;Download&rdquo; button</li>
                            </ul>
                        </li>
                    </ol>

                    <h3>Example Conversion</h3>
                    <p><strong>Input (JSON):</strong></p>
                    <pre><code>{`{
  "name": "John",
  "age": 30,
  "city": "New York"
}`}</code></pre>

                    <p><strong>Output (XML):</strong></p>
                    <pre><code>{`<root>
  <name>John</name>
  <age>30</age>
  <city>New York</city>
</root>`}</code></pre>

                    <p><strong>Output (YAML):</strong></p>
                    <pre><code>{`name: John
age: 30
city: New York`}</code></pre>

                    <p><strong>Output (.properties):</strong></p>
                    <pre><code>{`name=John
age=30
city=New York`}</code></pre>
                </ToolArticleSection>

                <ToolArticleSection id="data-format-converter-technology" title="Technology Stack">
                    <p>
                        Implements the core conversion logic is 100% client-side Javascript only. It uses:
                    </p>
                    <ul>
                        <li><code>js-yaml</code> for YAML parsing/formatting</li>
                        <li><code>fast-xml-parser</code> for XML parsing/formatting</li>
                        <li>Native <code>JSON</code> methods for JSON handling</li>
                    </ul>
                </ToolArticleSection>

                <ToolArticleSection id="data-format-converter-limitations" title="Known Limitations">
                    <ol>
                        <li>
                            <strong>Large Data Sets</strong>
                            <ul>
                                <li>Very large data structures may impact performance</li>
                                <li>Complex nested structures may take longer to convert</li>
                            </ul>
                        </li>
                        <li>
                            <strong>XML Specifics</strong>
                            <ul>
                                <li>XML attributes are converted to object properties with <code>@</code> prefix</li>
                                <li>XML namespaces are not fully supported</li>
                            </ul>
                        </li>
                        <li>
                            <strong>YAML Specifics</strong>
                            <ul>
                                <li>Some advanced YAML features may not be supported</li>
                                <li>Multi-document YAML is not supported</li>
                            </ul>
                        </li>
                        <li>
                            <strong>Properties specifics</strong>
                            <ul>
                                <li>Data with more than a level deeper can&apos;t be converted to properties properly</li>
                            </ul>
                        </li>
                    </ol>
                </ToolArticleSection>

                <ToolArticleSection id="data-format-converter-future" title="Data Format Converter Future Enhancements">
                    <ol>
                        <li>
                            <strong>Additional Formats</strong>
                            <ul>
                                <li>Support for CSV, TOML, and other common formats</li>
                                <li>Custom format templates</li>
                            </ul>
                        </li>
                        <li>
                            <strong>Advanced Features</strong>
                            <ul>
                                <li>Schema validation</li>
                                <li>Format auto-detection</li>
                                <li>Batch conversion</li>
                            </ul>
                        </li>
                        <li>
                            <strong>UI Improvements</strong>
                            <ul>
                                <li>Syntax highlighting</li>
                                <li>Side-by-side comparison view</li>
                            </ul>
                        </li>
                        <li>
                            <strong>Performance Optimizations</strong>
                            <ul>
                                <li>Web Workers for large conversions</li>
                                <li>Streaming processing for very large files</li>
                            </ul>
                        </li>
                    </ol>
                </ToolArticleSection>

                <ToolArticleSection id="data-format-converter-privacy" title="Privacy & Security">
                    <ul>
                        <li>100% Client-Side Processing: All conversions happen in your browser</li>
                        <li>No Data Storage: Your data is never saved or transmitted to any server</li>
                        <li>Offline Capability: Works without an internet connection once loaded</li>
                        <li>Data Privacy: No cookies, tracking, or data collection of any kind</li>
                    </ul>
                </ToolArticleSection>

                <ToolArticleSection id="data-format-converter-troubleshooting" title="Troubleshooting">
                    <h3>Conversion fails with &ldquo;Invalid format&rdquo; error</h3>
                    <ul>
                        <li>Cause: Input data doesn&apos;t match the selected format</li>
                        <li>Solution: Verify the input format is correctly selected</li>
                        <li>Solution: Check for syntax errors in the input data</li>
                        <li>Solution: Use the example templates as reference</li>
                    </ul>

                    <h3>Output looks incorrect</h3>
                    <ul>
                        <li>Cause: Different formats handle data structures differently</li>
                        <li>Solution: Check for known format differences such as XML attributes vs JSON properties</li>
                        <li>Solution: Try converting back to original format to verify round-trip consistency</li>
                    </ul>

                    <h3>Tool doesn&apos;t respond</h3>
                    <ul>
                        <li>Cause: Possible JavaScript error or conflict</li>
                        <li>Solution: Check browser console for errors</li>
                        <li>Solution: Refresh the page</li>
                        <li>Solution: Ensure all required scripts are loaded</li>
                    </ul>
                </ToolArticleSection>

                <ToolArticleSection id="data-format-converter-feedback" title="Feedback">
                    <p>
                        Want more tools like this? Explore the full developer tools collection on{' '}
                        <a href={SITE_BASE_URL}>CodeSamplez Tools</a>.
                    </p>
                </ToolArticleSection>

                <ToolArticleSection id="data-format-converter-faqs" title="Data Format Converter FAQs">
                    <ToolFaqList items={FAQ_ITEMS} />
                </ToolArticleSection>
            </div>
        </section>
    );
}
