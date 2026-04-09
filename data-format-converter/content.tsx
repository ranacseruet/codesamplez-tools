import type { JSX } from 'preact';
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
        'What formats can this converter handle?',
        'This tool converts between JSON, XML, YAML, and Java properties formats. You can paste data in one supported format and export it to any of the others.'
    ),
    createPlainTextFaqItem(
        'Does the converter auto-detect my input format?',
        'Yes. When auto-convert is enabled, the tool attempts to detect whether your input is JSON, XML, YAML, or properties data and updates the selected input format before converting.'
    ),
    createPlainTextFaqItem(
        'Is the Data Format Converter free to use?',
        'Yes. The CodeSamplez Data Format Converter is free to use with no signup, subscription, or installation required.'
    ),
    createPlainTextFaqItem(
        'Is my data uploaded to a server?',
        'No. All parsing and conversion happen locally in your browser, so your input is not uploaded to a remote server by this tool.'
    ),
    createPlainTextFaqItem(
        'Why does conversion fail for some XML or YAML input?',
        'Conversion usually fails when the input is not valid for the selected format, such as malformed XML tags, invalid JSON syntax, or unsupported YAML structure. The tool shows an error message so you can fix the source data and try again.'
    ),
    createPlainTextFaqItem(
        'Can I download the converted result?',
        'Yes. After conversion, you can download the result using the appropriate file extension for the selected output format, such as .json, .xml, .yaml, or .properties.'
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
                    The CodeSamplez Data Format Converter is a <strong>free online format conversion tool</strong> for
                    translating structured data between <strong>JSON</strong>, <strong>XML</strong>,{' '}
                    <strong>YAML</strong>, and <strong>Java properties</strong>. It validates your input, converts it
                    locally in the browser, and lets you copy or download the result without sending data to a server.
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

                <ToolArticleSection id="data-format-converter-how-to-use" title="How To Use The Data Format Converter:">
                    <ol>
                        <li>
                            <strong>Select or confirm the input format</strong>. Pick JSON, XML, YAML, or Properties,
                            or leave auto-convert enabled so the tool can detect the format from the pasted data.
                        </li>
                        <li>
                            <strong>Paste your source data</strong> into the input area. Placeholder examples show the
                            expected structure for each supported format.
                        </li>
                        <li>
                            <strong>Choose the output format</strong> and convert. The converted result appears in the
                            output panel, where you can copy or download it immediately.
                        </li>
                    </ol>
                </ToolArticleSection>

                <ToolArticleSection id="data-format-converter-features" title="Supported Features">
                    <ul>
                        <li><strong>Bidirectional conversion</strong> between JSON, XML, YAML, and Properties formats.</li>
                        <li><strong>Automatic input detection</strong> when auto-convert is enabled.</li>
                        <li><strong>Formatted output</strong> for readable JSON, XML, YAML, and properties files.</li>
                        <li><strong>Clipboard and download actions</strong> for quick reuse in other workflows.</li>
                        <li><strong>Client-side processing</strong> so conversion stays fast and private.</li>
                    </ul>

                    <div className="c-tool-article__cta-row">
                        <a className="c-button" href="https://codesamplez.com/tools">
                            Explore More Dev Tools
                        </a>
                    </div>
                </ToolArticleSection>

                <ToolArticleSection id="data-format-converter-use-cases" title="Common Use Cases">
                    <ul>
                        <li>Convert API payload samples between JSON and XML during integration work.</li>
                        <li>Translate application configuration files between YAML and Properties formats.</li>
                        <li>Normalize sample data before documentation, debugging, or support handoff.</li>
                        <li>Inspect how the same data structure is represented across multiple serialization formats.</li>
                    </ul>
                </ToolArticleSection>

                <ToolArticleSection id="data-format-converter-technology" title="Technology">
                    <p>
                        The converter uses browser-side JavaScript plus format-specific parsers for YAML and XML. JSON
                        conversion relies on native parsing and serialization, while download and copy actions are
                        handled in the client runtime.
                    </p>
                </ToolArticleSection>

                <ToolArticleSection id="data-format-converter-error-handling" title="Error Handling">
                    <ul>
                        <li>Shows clear validation errors when the selected input format does not match the pasted data.</li>
                        <li>Prevents empty conversions and prompts you to enter content before converting.</li>
                        <li>Lets you retry immediately after fixing malformed JSON, XML, YAML, or properties input.</li>
                    </ul>
                </ToolArticleSection>

                <ToolArticleSection id="data-format-converter-privacy" title="Privacy & Security">
                    <ul>
                        <li>100% client-side processing in the browser.</li>
                        <li>No server upload or account requirement.</li>
                        <li>No data storage by the converter itself.</li>
                        <li>Suitable for offline use after the page assets are loaded.</li>
                    </ul>
                </ToolArticleSection>

                <ToolArticleSection id="data-format-converter-limitations" title="Known Limitations">
                    <ul>
                        <li>Very large documents may feel slower in the browser than small and medium payloads.</li>
                        <li>Advanced YAML constructs and multi-document YAML are not the primary target of this tool.</li>
                        <li>XML namespaces, attributes, and mixed-content documents may not map perfectly to simpler formats.</li>
                    </ul>
                </ToolArticleSection>

                <ToolArticleSection id="data-format-converter-feedback" title="Feedback">
                    <p>
                        Have a bug report or want support for another data format such as CSV or TOML? Please{' '}
                        <a href="https://codesamplez.com/contact">contact us</a>.
                    </p>
                </ToolArticleSection>

                <ToolArticleSection id="data-format-converter-faqs" title="Frequently Asked Questions (FAQs)">
                    <ToolFaqList items={FAQ_ITEMS} />
                </ToolArticleSection>
            </div>
        </section>
    );
}
