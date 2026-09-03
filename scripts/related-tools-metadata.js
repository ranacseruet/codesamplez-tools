// @ts-check
/**
 * Why-next copy for the related-tools section, per source→target pair.
 *
 * The section used to render each target's SEO meta `description`, which is
 * written to sell that tool to a stranger arriving from search — the wrong job
 * here. Someone who has just formatted JSON does not need the JSON Formatter
 * pitched at them; they need to know what the next tool does *with what they
 * are already holding*. So the copy is keyed on the pair, not the target: the
 * Data Format Converter reads as "Turn this JSON into YAML or XML" from the
 * JSON Formatter, and as "Convert the data before you encode it" from the QR
 * generator.
 *
 * Sidecar module rather than a `tool.meta.json` field, matching
 * `tool-faq-metadata.js` / `tool-howto-metadata.js` / `tool-feature-metadata.js`:
 * the text belongs to the relationship between two tools, so it has no single
 * tool's metadata file to live in.
 *
 * Keep each line short enough to sit on one or two lines without truncation
 * (~40–70 characters) — the section deliberately has no line clamp, so an
 * overlong line makes the cards ragged instead of quietly cutting off.
 */

/** @type {Record<string, Record<string, string>>} */
const RELATED_TOOL_REASONS = {
    'base64-converter-tool': {
        'jwt-decoder-tool': 'Decode a JWT instead of raw Base64',
        'jwt-builder-tool': 'Build a signed token from these claims',
        'data-format-converter': 'Convert the decoded JSON to YAML or XML'
    },
    'css-minifier-tool': {
        'js-minifier-tool': 'Shrink the JavaScript on the same page',
        'json-formatter-tool': 'Tidy the JSON config that ships with it',
        'diff-checker-tool': 'Compare the minified CSS against the original'
    },
    'data-format-converter': {
        'json-formatter-tool': 'Pretty-print and validate the JSON side',
        'base64-converter-tool': 'Encode the converted output for transport',
        'diff-checker-tool': 'See exactly what the conversion changed'
    },
    'diff-checker-tool': {
        'text-analyzer-tool': 'Count words and characters in either side',
        'json-formatter-tool': 'Format both files so the diff stays readable',
        'js-minifier-tool': 'Minify the version you decided to keep'
    },
    'js-minifier-tool': {
        'css-minifier-tool': 'Do the same for your stylesheets',
        'json-formatter-tool': 'Format the JSON your script consumes',
        'diff-checker-tool': 'Check the minified output against the source'
    },
    'json-formatter-tool': {
        'data-format-converter': 'Turn this JSON into YAML or XML',
        'jwt-decoder-tool': 'Decode a token and read its JSON payload',
        'js-minifier-tool': 'Minify the JavaScript that consumes it'
    },
    'json-editor-tool': {
        'json-formatter-tool': 'Format the JSON you just built',
        'data-format-converter': 'Convert this JSON to YAML or XML',
        'diff-checker-tool': 'Compare this document with another version'
    },
    'jwt-builder-tool': {
        'jwt-decoder-tool': 'Verify the token you just signed',
        'base64-converter-tool': 'Inspect the raw Base64 segments',
        'json-formatter-tool': 'Format the claims before you sign them'
    },
    'jwt-decoder-tool': {
        'jwt-builder-tool': 'Build a new token from these claims',
        'base64-converter-tool': 'Decode the raw segments yourself',
        'json-formatter-tool': 'Pretty-print the payload you just decoded'
    },
    'qr-code-generator': {
        'base64-converter-tool': 'Encode an image or file as Base64',
        'data-format-converter': 'Convert the data before you encode it',
        'text-analyzer-tool': 'Check the length of the text you encoded'
    },
    'text-analyzer-tool': {
        'diff-checker-tool': 'Compare this text against another version',
        'qr-code-generator': 'Turn a short string into a QR code',
        'json-formatter-tool': 'Format JSON before counting its contents'
    },
    'image-editor': {
        'base64-converter-tool': 'Encode the edited image as Base64',
        'qr-code-generator': 'Turn text into a QR code for the image page',
        'text-analyzer-tool': 'Check the caption length before you export'
    }
};

/**
 * The one-line handoff shown on `sourceToolId`'s card for `targetToolId`.
 *
 * Throws rather than falling back to generic copy: a missing pair means someone
 * added a `relatedToolIds` entry without writing the line that makes it worth
 * clicking, and a silent generic default is exactly the outcome this module
 * exists to prevent. The build fails loudly instead.
 *
 * @param {string} sourceToolId
 * @param {string} targetToolId
 * @returns {string}
 */
function getRelatedToolReason(sourceToolId, targetToolId) {
    const reasonsForSource = RELATED_TOOL_REASONS[sourceToolId];
    if (!reasonsForSource) {
        throw new Error(`No related-tool copy registered for source tool: ${sourceToolId}`);
    }

    const reason = reasonsForSource[targetToolId];
    if (!reason) {
        throw new Error(`No related-tool copy for pair ${sourceToolId} -> ${targetToolId}`);
    }

    return reason;
}

module.exports = {
    RELATED_TOOL_REASONS,
    getRelatedToolReason
};
