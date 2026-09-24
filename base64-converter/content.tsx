import type { JSX } from 'preact';
import { buildSiteHref } from '../common/siteBaseUrl';
import { ToolArticleNextSteps, ToolArticleSection, ToolFaqList, type ToolArticleProps, type ToolFaqItem } from '../common/tool-article/ToolArticle';

const SHAREABLE_LINK_EXAMPLE = `${buildSiteHref('/base64-converter/')}?data=YOUR_BASE64_OR_TEXT_DATA`;

function createPlainTextFaqItem(question: string, answer: string): ToolFaqItem {
    return {
        question,
        answer,
        structuredDataAnswer: answer
    };
}

export const FAQ_ITEMS: ToolFaqItem[] = [
    createPlainTextFaqItem(
        'Is Base64 encoding secure?',
        'No. Base64 is not encryption. It is an encoding scheme for data representation, not meant for security. It merely converts data to a text format and does not hide or protect the data.'
    ),
    createPlainTextFaqItem(
        'What are common uses of Base64?',
        'Base64 is commonly used to safely encode binary data for transmission over text-based protocols such as email or URLs. Examples include embedding images in web pages as data URIs, sending email attachments in SMTP or MIME base64, and storing small blobs in JSON or config files.'
    ),
    createPlainTextFaqItem(
        'Does this tool send my data to a server?',
        'No. The conversion happens entirely in the browser client-side. This means your input is not uploaded, which helps keep the workflow private.'
    )
];

export function Base64ConverterIntro(): JSX.Element {
    return (
        <section className="c-tool-article c-tool-article--intro c-surface-card" aria-labelledby="base64-converter-intro-heading">
            <div className="c-tool-article__content">
                <h2 id="base64-converter-intro-heading" className="c-tool-article__eyebrow">About This Tool</h2>
                <p className="c-tool-article__lead">
                    Base64 Converter is a free online tool to quickly encode or decode text and files in Base64
                    format. It is useful for developers who need to transform data to Base64 for embedding binary
                    data in text form or decode Base64 back to original form. All processing is done in your browser
                    for speed and privacy.
                </p>
            </div>
        </section>
    );
}

export function Base64ConverterArticle({ relatedTools }: ToolArticleProps): JSX.Element {
    return (
        <section className="c-tool-article c-surface-card" aria-labelledby="base64-converter-article-heading">
            <div className="c-tool-article__content">
                <h2 id="base64-converter-article-heading" className="c-tool-article__sr-only">Base64 Converter Guide</h2>

                <ToolArticleSection id="base64-converter-what-is" title="What is Base64 encoding and why use it?">
                    <p>
                        Base64 encoding is a way to represent binary data like images or files in text form using only
                        64 ASCII characters. It is commonly used to embed images in HTML or CSS, include attachments in
                        emails, or store binary data in JSON. Developers use Base64 to ensure data remains intact when
                        transmitted over text-only systems.
                    </p>
                    <p>
                        Please refer to our more comprehensive{' '}
                        <a href="https://codesamplez.com/programming/base64-explained/amp">Base64 Explained Guide</a>{' '}
                        to learn more in-depth.
                    </p>

                    <ToolArticleNextSteps relatedTools={relatedTools} />
                </ToolArticleSection>

                <ToolArticleSection id="base64-converter-features" title="Base64 Converter Tool Features">
                    <ul>
                        <li><strong>Automatic Base64 detection:</strong> checks string length, validates the Base64 character set, and does a decode plus re-encode round trip.</li>
                        <li><strong>Multiple encoding support:</strong> UTF-8, ASCII, ISO-8859-1, and UCS-2.</li>
                        <li><strong>File upload support:</strong> reads file content and automatically processes it.</li>
                        <li><strong>Copy to clipboard:</strong> shows a copy button when there is output and hides it when there is not.</li>
                        <li><strong>Download as file:</strong> downloads encoded or decoded output, including binary content when available.</li>
                        <li><strong>Image previews:</strong> displays decoded raster images from explicitly typed <code>data:image/*;base64,...</code> Data URIs and from bare Base64 whose magic bytes match a raster format, while keeping Download available. SVG is never previewed.</li>
                        <li><strong>Swap conversion:</strong> exchanges the Input and Output panels and toggles the conversion direction, including the last successful direction in Auto Detect mode.</li>
                        <li><strong>Binary content support:</strong> can encode and decode binary files or content.</li>
                        <li><strong>URL parameter support:</strong> supports preloading data directly from links through the <code>data</code> parameter.</li>
                    </ul>
                </ToolArticleSection>

                <ToolArticleSection id="base64-converter-how-to-use" title="How do I use this Base64 Converter tool?">
                    <h3>Basic Text Conversion</h3>
                    <ol>
                        <li>Enter or paste your text in the input textarea.</li>
                        <li>
                            Choose your preferred mode:
                            <ul>
                                <li>Auto Detect automatically determines if the input is Base64 encoded.</li>
                                <li>Encode forces Base64 encoding of the input.</li>
                                <li>Decode forces Base64 decoding of the input.</li>
                            </ul>
                        </li>
                        <li>
                            Select your character encoding:
                            <ul>
                                <li>UTF-8, the default and recommended option for most uses</li>
                                <li>ASCII</li>
                                <li>ISO-8859-1</li>
                                <li>UCS-2</li>
                            </ul>
                        </li>
                        <li>View the result below the input area. Decoded image Data URIs — and bare Base64 with raster image magic bytes — appear as an image preview; text remains in the output area.</li>
                        <li>Click Copy Result to copy text output, Download to save the result, or Swap to exchange the panels and toggle the conversion direction.</li>
                    </ol>

                    <h3>Encode/Decode File Content</h3>
                    <ol>
                        <li>Click Upload File to select any file, including text, image, PDF, or other binary data.</li>
                        <li>The file upload status appears in the input area and the converted data appears in the output area. Uploaded raster images also show a thumbnail with their type and size next to the Base64 output.</li>
                        <li>Conversion happens automatically based on your selected mode and encoding.</li>
                    </ol>

                    <h3>Preview Images and Swap Values</h3>
                    <p>
                        To preview an image, provide a valid Data URI with an explicit raster <code>image/*</code> MIME type
                        (PNG, JPEG, GIF, WebP, BMP, or AVIF), such as <code>data:image/png;base64,...</code>, and use Auto Detect or Decode mode.
                        Bare Base64 without a Data URI prefix is previewed too when its magic bytes match one of those
                        formats — so an upload's Base64 output previews when pasted back in, regardless of the selected
                        character encoding. If sniffed bytes turn out to be text the browser cannot render, the decoded
                        text is shown instead. SVG is never previewed and
                        stays download-only. The text output and Copy control are hidden during the preview, while Download
                        remains available. A caption under the preview shows the image type, decoded size, and dimensions
                        once loaded. If the browser cannot load the image, a binary placeholder is shown instead.
                    </p>
                    <p>
                        Swap exchanges the full Input and Output values and toggles Encode/Decode. In Auto Detect mode,
                        it chooses the opposite of the last successful conversion. Swap is disabled for empty, invalid,
                        binary, or image output.
                    </p>

                    <h3>URL Parameter Integration</h3>
                    <p>
                        The tool supports external linking, allowing you to create URLs that automatically load data
                        into the converter.
                    </p>

                    <p><strong>Creating Shareable Links:</strong></p>
                    <pre><code>{SHAREABLE_LINK_EXAMPLE}</code></pre>

                    <p><strong>Examples:</strong></p>
                    <ul>
                        <li><code>?data=Hello%20World</code> for encode mode input</li>
                        <li><code>?data=SGVsbG8gV29ybGQ%3D</code> for decode mode input</li>
                    </ul>

                    <p><strong>How It Works:</strong></p>
                    <ol>
                        <li>Add <code>?data=</code> followed by URL-encoded text or Base64 data.</li>
                        <li>The tool automatically decodes the URL parameter, pre-populates the input, sets Auto Detect mode, and immediately performs the conversion.</li>
                        <li>The conversion starts as soon as the page loads.</li>
                    </ol>

                    <p><strong>URL Encoding Requirements:</strong></p>
                    <ul>
                        <li>Spaces become <code>%20</code></li>
                        <li>Plus signs become <code>%2B</code></li>
                        <li>Equal signs become <code>%3D</code></li>
                        <li>Ampersands become <code>%26</code></li>
                    </ul>
                </ToolArticleSection>

                <ToolArticleSection id="base64-converter-how-it-works" title="How Base64 Conversion Works">
                    <p>
                        Base64 encoding is a method for converting binary data such as images, files, or any non-text
                        data into an ASCII string format using a set of 64 characters: A-Z, a-z, 0-9, +, and /.
                    </p>
                    <p>
                        It works by taking input bytes, grouping them into sets of three, then dividing those 24 bits
                        into four groups of six bits. Each 6-bit group is mapped to a character from the Base64
                        alphabet. Padding with <code>=</code> is used if the input data is not a multiple of three
                        bytes.
                    </p>
                    <p>
                        Decoding is the reverse process: the encoded Base64 string is processed in groups of four
                        characters, each mapped back into a 6-bit value and then combined to reconstruct the original
                        bytes.
                    </p>

                    <p><strong>Example Conversion:</strong></p>
                    <p>
                        The text <code>Hello</code> encodes to <code>SGVsbG8=</code> in Base64. Decoding{' '}
                        <code>SGVsbG8=</code> returns <code>Hello</code>.
                    </p>
                </ToolArticleSection>

                <ToolArticleSection id="base64-converter-encodings" title="Character Encodings">
                    <ul>
                        <li><strong>UTF-8:</strong> Universal character encoding that supports all Unicode characters and is the default.</li>
                        <li><strong>ASCII:</strong> Basic 7-bit encoding for English characters and common symbols.</li>
                        <li><strong>ISO-8859-1:</strong> 8-bit encoding for Western European characters.</li>
                        <li><strong>UCS-2:</strong> Fixed-width 16-bit encoding for the Basic Multilingual Plane.</li>
                    </ul>

                    <h3>Automatic Base64 Detection</h3>
                    <p>The tool uses a multi-step validation process to detect Base64 strings:</p>
                    <ol>
                        <li>Length validation where the string must be a multiple of 4</li>
                        <li>Character set validation for A-Z, a-z, 0-9, +, /, and =</li>
                        <li>Padding validation</li>
                        <li>Decode and encode round-trip verification</li>
                    </ol>
                </ToolArticleSection>

                <ToolArticleSection id="base64-converter-error-handling" title="Error Handling">
                    <p>The converter includes comprehensive error handling for:</p>
                    <ul>
                        <li>Invalid Base64 strings with detailed validation feedback</li>
                        <li>Character encoding issues across ASCII, ISO-8859-1, UCS-2, and UTF-8 paths</li>
                        <li>Memory-efficient processing of large files using a streaming approach</li>
                        <li>Input validation for null, undefined, empty strings, and invalid encoding selections</li>
                        <li>File operation problems such as read errors, file size limits, and unsupported file types</li>
                        <li>Clipboard operation failures</li>
                    </ul>
                </ToolArticleSection>

                <ToolArticleSection id="base64-converter-special-features" title="Special Features">
                    <h3>UCS-2 Encoding</h3>
                    <ul>
                        <li>Little-endian UTF-16, two bytes per code unit</li>
                        <li>Surrogate pairs are preserved, so emoji and other astral characters round-trip losslessly</li>
                        <li>Fallback handling for basic BMP (Basic Multilingual Plane) characters</li>
                        <li>Maintains character integrity during encode and decode operations</li>
                    </ul>

                    <h3>Memory Management</h3>
                    <ul>
                        <li>Efficient byte array allocation</li>
                        <li>Streaming processing for large files</li>
                        <li>Automatic garbage collection optimization</li>
                        <li>Browser memory limit considerations</li>
                    </ul>
                </ToolArticleSection>

                <ToolArticleSection id="base64-converter-browser-support" title="Browser Support For Base64 Converter Tool">
                    <p>The tool requires a modern browser that supports:</p>
                    <ul>
                        <li>Clipboard API</li>
                        <li>ES6+ JavaScript</li>
                        <li>TextEncoder and TextDecoder APIs</li>
                        <li>File API</li>
                    </ul>
                </ToolArticleSection>

                <ToolArticleSection id="base64-converter-feedback" title="Feedback">
                    <p>
                        Do you have any feature requests or bugs to report? Feel free to{' '}
                        <a href="https://codesamplez.com/contact">contact us</a>.
                    </p>
                </ToolArticleSection>

                <ToolArticleSection id="base64-converter-faqs" title="Base64 Converter FAQs (Frequently Asked Questions)">
                    <ToolFaqList items={FAQ_ITEMS} />
                </ToolArticleSection>
            </div>
        </section>
    );
}
