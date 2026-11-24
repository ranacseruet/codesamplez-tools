import type { JSX } from 'preact';
import Base64Codec from '../common/Base64Codec';
import { buildSiteHref, SITE_BASE_URL } from '../common/siteBaseUrl';
import { ToolArticleSection, ToolFaqList, type ToolFaqItem } from '../common/tool-article/ToolArticle';
import { ToolTutorialLinks } from '../common/tool-article/TutorialLinks';
import { BASE64_EXPLAINED } from '../common/tool-article/tutorial-links';

const SHAREABLE_LINK_EXAMPLE = `${buildSiteHref('/base64-converter/')}?data=YOUR_BASE64_OR_TEXT_DATA`;

/**
 * Strings the page shows. Encoded values are whatever Base64Codec returns
 * for UTF-8, which is the Character Encoding the converter starts on, and
 * the path processInput uses for that setting. Do not replace them with
 * hand-written Base64.
 */
const workedExampleCodec = new Base64Codec();

export const WORKED_EXAMPLE_ASCII = 'Hello';
export const WORKED_EXAMPLE_UTF8 = 'Hello 🌍';
/** Contains `+` in standard Base64, so the URL-safe alphabet is visible. */
export const WORKED_EXAMPLE_URL_TEXT = 'Hello~~';

export const WORKED_EXAMPLE_ASCII_ENCODED = workedExampleCodec.encodeText(WORKED_EXAMPLE_ASCII, 'utf8');
export const WORKED_EXAMPLE_UTF8_ENCODED = workedExampleCodec.encodeText(WORKED_EXAMPLE_UTF8, 'utf8');
/** ASCII option on the same emoji string: the code point becomes `?`. */
export const WORKED_EXAMPLE_UTF8_ASCII_ENCODING = workedExampleCodec.encodeText(WORKED_EXAMPLE_UTF8, 'ascii');
export const WORKED_EXAMPLE_URL_STANDARD = workedExampleCodec.encodeText(WORKED_EXAMPLE_URL_TEXT, 'utf8');
export const WORKED_EXAMPLE_URL_SAFE = workedExampleCodec.base64ToBase64Url(WORKED_EXAMPLE_URL_STANDARD);

export const BROWSER_BASE64_SNIPPET = `function encodeUtf8(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}

function decodeUtf8(payload) {
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder().decode(bytes);
}`;

export const NODE_BASE64_SNIPPET = `function encodeUtf8(text) {
  return Buffer.from(text, 'utf8').toString('base64');
}

function decodeUtf8(payload) {
  return Buffer.from(payload, 'base64').toString('utf8');
}`;

export const PYTHON_BASE64_SNIPPET = `import base64

def encode_utf8(text):
    return base64.b64encode(text.encode("utf-8")).decode("ascii")

def decode_utf8(payload):
    return base64.b64decode(payload).decode("utf-8")`;

export const CLI_BASE64_SNIPPET = `printf '%s' '${WORKED_EXAMPLE_ASCII}' | base64
printf '%s' '${WORKED_EXAMPLE_UTF8}' | base64
printf '%s' '${WORKED_EXAMPLE_ASCII_ENCODED}' | base64 -d`;

export const WINDOWS_CERTUTIL_SNIPPET = `certutil -encode input.txt encoded.txt
certutil -decode encoded.txt output.txt`;

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
    ),
    createPlainTextFaqItem(
        'How do I decode Base64 online?',
        `Paste the Base64 into Input. Leave Mode on Auto Detect, or choose Decode. Leave Character Encoding on UTF-8 unless the text was encoded as ASCII, ISO-8859-1, or UCS-2. Output shows the decoded text. Pasting ${WORKED_EXAMPLE_ASCII_ENCODED} returns ${WORKED_EXAMPLE_ASCII}. Pasting ${WORKED_EXAMPLE_UTF8_ENCODED} with UTF-8 returns ${WORKED_EXAMPLE_UTF8}. A data:image/...;base64,... URI, or bare Base64 whose bytes are a PNG, JPEG, GIF, WebP, BMP, or AVIF image, shows an image preview, and Download saves the file.`
    ),
    createPlainTextFaqItem(
        'Why does my decoded text look garbled?',
        `Character Encoding does not match the encoding that created the Base64. This page defaults to UTF-8. ${WORKED_EXAMPLE_UTF8} encodes to ${WORKED_EXAMPLE_UTF8_ENCODED} with UTF-8, and decoding that string with UTF-8 returns ${WORKED_EXAMPLE_UTF8}. ASCII, ISO-8859-1, and UCS-2 read those same bytes differently, so Output will not match. Set Character Encoding back to UTF-8 and convert again. Plain btoa() cannot encode that text: the emoji is outside Latin-1, and btoa throws InvalidCharacterError instead of writing UTF-8 bytes. The ASCII option on this page replaces that emoji with a question mark and writes ${WORKED_EXAMPLE_UTF8_ASCII_ENCODING}.`
    ),
    createPlainTextFaqItem(
        'Is Base64 encryption?',
        'No. Base64 is not encryption, and decoding it does not need a password or a key. Anyone who can read the text can recover the original bytes. Use it to carry bytes in a text format, not to hide a secret.'
    ),
    createPlainTextFaqItem(
        'How do I convert an image to Base64?',
        'Click Upload File, or drop the file on Input. Output is the bare Base64 payload. Input is replaced with a note that the file was uploaded and encoded, and the data: prefix is not kept. PNG, JPEG, GIF, WebP, BMP, and AVIF files at 15 MB or under also show a thumbnail with the type, size, and dimensions. SVG is not previewed. A file larger than 15 MB and up to 25 MB still encodes, and the caption says "Preview skipped: file is larger than 15 MB. Base64 output and Download are still available." A file over 25 MB shows a toast that it is too large to load (limit 25 MB) and is not encoded. To preview, paste data:image/png;base64, plus the payload, using the real image type, with Auto Detect or Decode.'
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

export function Base64ConverterArticle(): JSX.Element {
    return (
        <section className="c-tool-article c-surface-card" aria-labelledby="base64-converter-article-heading">
            <div className="c-tool-article__content">
                <h2 id="base64-converter-article-heading" className="c-tool-article__sr-only">Base64 Converter Guide</h2>

                <ToolArticleSection id="base64-converter-what-is" title="What is Base64 encoding and why use it?">
                    <p>
                        Base64 encoding is a way to represent binary data like images or files in text form using only
                        64 ASCII characters. It is commonly used to embed images in HTML or CSS, include attachments in
                        emails, or store binary data in JSON. Developers use Base64 to ensure data remains intact when
                        transmitted over text-only systems. JWT header and payload segments are Base64URL-encoded — use
                        the <a href={buildSiteHref('/jwt-decoder/')}>JWT Decoder</a> to read them as JSON, or the{' '}
                        <a href={buildSiteHref('/jwt-builder/')}>JWT Builder</a> when you need a signed token instead
                        of raw encoding.
                    </p>
                    <p>
                        Please refer to our more comprehensive{' '}
                        <a href={BASE64_EXPLAINED.href}>Base64 Explained Guide</a>{' '}
                        to learn more in-depth.
                    </p>

                    <div className="c-tool-article__cta-row">
                        <a className="c-button" href={SITE_BASE_URL}>
                            Explore more Dev Tools
                        </a>
                    </div>
                </ToolArticleSection>

                <ToolArticleSection id="base64-converter-features" title="Base64 Converter Tool Features">
                    <ul>
                        <li><strong>Automatic Base64 detection:</strong> checks string length, validates the Base64 character set, checks padding, and confirms the payload decodes.</li>
                        <li><strong>Multiple encoding support:</strong> UTF-8, ASCII, ISO-8859-1, and UCS-2.</li>
                        <li><strong>File upload support:</strong> reads file content and automatically processes it.</li>
                        <li><strong>Copy to clipboard:</strong> shows a copy button when there is output and hides it when there is not.</li>
                        <li><strong>Download as file:</strong> downloads encoded or decoded output, including binary content when available.</li>
                        <li><strong>Image previews:</strong> displays decoded raster images from explicitly typed <code>data:image/*;base64,...</code> Data URIs and from bare Base64 whose magic bytes match a raster format, while keeping Download available. SVG is never previewed.</li>
                        <li><strong>Swap conversion:</strong> exchanges the Input and Output panels and toggles the conversion direction, including the last successful direction in Auto Detect mode.</li>
                        <li><strong>Binary content support:</strong> can encode and decode binary files or content.</li>
                        <li><strong>URL parameter support:</strong> supports preloading data directly from links through the <code>data</code> parameter.</li>
                        <li>
                            <strong>Structured data handoff:</strong> Convert decoded JSON to YAML or XML with the{' '}
                            <a href={buildSiteHref('/data-format-converter/')}>Data Format Converter</a>.
                        </li>
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

                    <p>
                        The worked example below is the string this page writes for two inputs, then the text you
                        get by pasting that string back.
                    </p>
                </ToolArticleSection>

                <ToolArticleSection id="base64-converter-worked-example" title="Worked Example: Encode and Decode">
                    <p>
                        Leave Mode on Auto Detect and Character Encoding on UTF-8. Those are the defaults. Auto
                        Detect encodes text that is not valid Base64, and decodes text that is.
                    </p>
                    <p><strong>ASCII text</strong></p>
                    <p>Input:</p>
                    <pre><code>{WORKED_EXAMPLE_ASCII}</code></pre>
                    <p>Output:</p>
                    <pre><code>{WORKED_EXAMPLE_ASCII_ENCODED}</code></pre>
                    <p>
                        Paste <code>{WORKED_EXAMPLE_ASCII_ENCODED}</code> back into Input. Output is{' '}
                        <code>{WORKED_EXAMPLE_ASCII}</code> again.
                    </p>
                    <p><strong>UTF-8 text</strong></p>
                    <p>
                        The same steps with a character outside Latin-1. Plain <code>btoa()</code> throws{' '}
                        <code>InvalidCharacterError</code> on this string, because the emoji is outside Latin-1.{' '}
                        This page encodes the UTF-8 bytes instead.
                    </p>
                    <p>Input:</p>
                    <pre><code>{WORKED_EXAMPLE_UTF8}</code></pre>
                    <p>Output:</p>
                    <pre><code>{WORKED_EXAMPLE_UTF8_ENCODED}</code></pre>
                    <p>
                        Paste <code>{WORKED_EXAMPLE_UTF8_ENCODED}</code> back into Input with UTF-8 still selected.
                        Output is <code>{WORKED_EXAMPLE_UTF8}</code> again. Switch Character Encoding to ASCII and
                        encode the same input, and Output is <code>{WORKED_EXAMPLE_UTF8_ASCII_ENCODING}</code>, which
                        decodes to <code>Hello ?</code>. The ASCII option replaces that emoji with a question mark.
                    </p>
                </ToolArticleSection>

                <ToolArticleSection id="base64-converter-in-code" title="Decode or Encode Base64 in Code">
                    <p>
                        These snippets encode and decode the worked example. For those short strings they produce
                        the same Base64 this page writes with UTF-8. This page&apos;s UTF-8 path uses{' '}
                        <code>TextEncoder</code> and its own byte encoder, so a large file does not go through{' '}
                        <code>btoa()</code>. The browser snippet below uses <code>btoa()</code> only after the text
                        is already UTF-8 bytes. Calling <code>btoa()</code> on <code>{WORKED_EXAMPLE_UTF8}</code>{' '}
                        itself throws.
                    </p>
                    <h3>JavaScript in the browser</h3>
                    <pre><code>{BROWSER_BASE64_SNIPPET}</code></pre>
                    <h3>Node.js</h3>
                    <pre><code>{NODE_BASE64_SNIPPET}</code></pre>
                    <h3>Python</h3>
                    <pre><code>{PYTHON_BASE64_SNIPPET}</code></pre>
                    <h3>Command line</h3>
                    <p>
                        <code>base64</code> prints the same characters as Output, then a newline. This page does
                        not add that newline. <code>base64 -d</code> reads the payload back.
                    </p>
                    <pre><code>{CLI_BASE64_SNIPPET}</code></pre>
                    <p>
                        On Windows, <code>certutil -encode</code> writes a file with a{' '}
                        <code>-----BEGIN CERTIFICATE-----</code> header and a{' '}
                        <code>-----END CERTIFICATE-----</code> footer around the Base64.{' '}
                        <code>certutil -decode</code> reads that file back to the original bytes. Output on this
                        page is the bare Base64 line, without that header.
                    </p>
                    <pre><code>{WINDOWS_CERTUTIL_SNIPPET}</code></pre>
                </ToolArticleSection>

                <ToolArticleSection id="base64-converter-base64url" title="Base64 vs Base64URL">
                    <p>
                        Standard Base64, which Encode writes, uses A-Z, a-z, 0-9, <code>+</code>, and{' '}
                        <code>/</code>, and pads with <code>=</code> so the length is a multiple of 4. Base64URL
                        (RFC 4648 section 5) uses <code>-</code> instead of <code>+</code> and <code>_</code> instead
                        of <code>/</code>, and leaves off the <code>=</code> padding. JWT header and payload segments
                        are Base64URL. Read them as JSON with the{' '}
                        <a href={buildSiteHref('/jwt-decoder/')}>JWT Decoder</a>. The{' '}
                        <a href={BASE64_EXPLAINED.href}>{BASE64_EXPLAINED.anchor}</a> tutorial covers the alphabet
                        in more detail.
                    </p>
                    <p>
                        Paste <code>{WORKED_EXAMPLE_URL_TEXT}</code> with Auto Detect and UTF-8. Output is{' '}
                        <code>{WORKED_EXAMPLE_URL_STANDARD}</code>. The URL-safe form of those same bytes is{' '}
                        <code>{WORKED_EXAMPLE_URL_SAFE}</code>: <code>+</code> became <code>-</code>, and the{' '}
                        <code>=</code> padding is gone.
                    </p>
                    <p>
                        Paste <code>{WORKED_EXAMPLE_URL_SAFE}</code> into Input with Auto Detect or Decode and
                        UTF-8. This page maps <code>-</code> and <code>_</code> back to <code>+</code> and{' '}
                        <code>/</code>, restores the padding, and decodes to{' '}
                        <code>{WORKED_EXAMPLE_URL_TEXT}</code>. Encode does not write the URL-safe alphabet.
                    </p>
                </ToolArticleSection>

                <ToolArticleSection id="base64-converter-data-uri" title="Image to Base64 and Data URIs">
                    <p>
                        A data URI is <code>data:</code>, a MIME type, <code>;base64,</code>, and the Base64
                        payload. An image one looks like <code>data:image/png;base64,</code> followed by the payload.
                    </p>
                    <p>
                        Upload File, or drop a file on Input, reads the file and puts the bare Base64 payload in
                        Output. Input is replaced with <code>[File: name uploaded and encoded to output]</code>,
                        using the file&apos;s name. The <code>data:</code> prefix is removed. The page does not
                        build a data URI for you. Add <code>data:image/png;base64,</code> yourself, with the real
                        image type, if you need one.
                    </p>
                    <p>
                        PNG, JPEG, GIF, WebP, BMP, and AVIF files at 15 MB or under also show a thumbnail beside
                        that Base64, with the type, size, and dimensions. SVG is never previewed. A file larger
                        than 15 MB and up to 25 MB still encodes. The caption reads{' '}
                        <code>Preview skipped: file is larger than 15 MB. Base64 output and Download are still available.</code>{' '}
                        A file over 25 MB is rejected with a toast that names the file and says it is too large to
                        load (limit 25 MB).
                    </p>
                    <p>
                        To preview, paste a data URI with an explicit raster image type, such as{' '}
                        <code>data:image/png;base64,...</code>, and use Auto Detect or Decode. The image appears in
                        Output, the text area and Copy hide, and Download stays. The caption shows the type, the
                        decoded size, and the pixel dimensions once the image loads. If the browser cannot load
                        it, Output shows <code>[Binary content (image/png). Use Download button.]</code> and the
                        status reads <code>Image preview unavailable. Use Download button.</code>
                    </p>
                    <p>
                        Bare Base64 with no data URI prefix is previewed too when its first bytes match one of
                        those raster formats, so an upload&apos;s Output previews if you paste it back into Input.
                        Download on a preview saves the decoded bytes. The file name is <code>output.png</code>,{' '}
                        <code>output.jpg</code>, <code>output.gif</code>, <code>output.webp</code>,{' '}
                        <code>output.bmp</code>, or <code>output.avif</code> when the bytes match that type, and{' '}
                        <code>output.bin</code> otherwise. Text downloads are <code>output.txt</code>.
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
                        <li>Character set validation for A-Z, a-z, 0-9, +, /, and =, after - and _ are mapped to + and /</li>
                        <li>Padding validation</li>
                        <li>A decode check: the payload must be accepted by the Base64 decoder</li>
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

                <ToolTutorialLinks toolId="base64-converter" />

                <ToolArticleSection id="base64-converter-faqs" title="Base64 Converter FAQs (Frequently Asked Questions)">
                    <ToolFaqList items={FAQ_ITEMS} />
                </ToolArticleSection>
            </div>
        </section>
    );
}
