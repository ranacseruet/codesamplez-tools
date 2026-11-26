import type { JSX } from 'preact';
import { buildSiteHref, SITE_BASE_URL } from '../common/siteBaseUrl';
import { ToolArticleSection, ToolFaqList, type ToolFaqItem } from '../common/tool-article/ToolArticle';
import {
    MAX_UUID_COUNT,
    WORKED_EXAMPLE_V4,
    WORKED_EXAMPLE_V4_UPPER_PLAIN,
    WORKED_EXAMPLE_V7,
    WORKED_EXAMPLE_V7_TIMESTAMP_MS,
    describeV4CollisionOdds,
    parseUuid
} from './uuid';

export {
    WORKED_EXAMPLE_V4,
    WORKED_EXAMPLE_V4_UPPER_PLAIN,
    WORKED_EXAMPLE_V7,
    WORKED_EXAMPLE_V7_TIMESTAMP_MS
};

const workedV4Parsed = parseUuid(WORKED_EXAMPLE_V4);
const workedV7Parsed = parseUuid(WORKED_EXAMPLE_V7);
const workedV4FromPlain = parseUuid(WORKED_EXAMPLE_V4_UPPER_PLAIN);

if (!workedV4Parsed.valid || !workedV7Parsed.valid || !workedV4FromPlain.valid) {
    // The bytes above are produced by this tool's formatter. A failure here is a broken build, not a user path.
    /* istanbul ignore next */
    throw new Error('Worked UUID example failed to parse');
}

export const WORKED_EXAMPLE_V4_VERSION = workedV4Parsed.versionLabel;
export const WORKED_EXAMPLE_V4_VARIANT = workedV4Parsed.variantLabel;
export const WORKED_EXAMPLE_V7_VERSION = workedV7Parsed.versionLabel;
export const WORKED_EXAMPLE_V7_VARIANT = workedV7Parsed.variantLabel;
export const WORKED_EXAMPLE_V7_TIMESTAMP_ISO = workedV7Parsed.timestampIso;
export const WORKED_EXAMPLE_V4_CANONICAL_FROM_PLAIN = workedV4FromPlain.canonical;
export const COLLISION_ODDS = describeV4CollisionOdds();

export const JAVASCRIPT_UUID_SNIPPET = `const v4 = crypto.randomUUID();

function uuidV7() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const timestamp = Date.now();
  bytes[0] = Math.floor(timestamp / 2 ** 40) & 0xff;
  bytes[1] = Math.floor(timestamp / 2 ** 32) & 0xff;
  bytes[2] = Math.floor(timestamp / 2 ** 24) & 0xff;
  bytes[3] = Math.floor(timestamp / 2 ** 16) & 0xff;
  bytes[4] = Math.floor(timestamp / 256) & 0xff;
  bytes[5] = timestamp & 0xff;
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  let hex = '';
  for (let index = 0; index < bytes.length; index += 1) {
    hex += bytes[index].toString(16).padStart(2, '0');
  }
  return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20);
}`;

export const PYTHON_UUID_SNIPPET = `import uuid

# Version 4
print(uuid.uuid4())

# Version 7 (Python 3.14+)
print(uuid.uuid7())`;

export const SQL_UUID_SNIPPET = `-- PostgreSQL: version 4
SELECT gen_random_uuid();

-- PostgreSQL 18: version 7
SELECT uuidv7();`;

const JWT_FAQ_ANSWER = 'Generate a UUID here and paste it into the jti claim in the JWT Builder. jti is the token id. This page does not sign the token.';

function createPlainTextFaqItem(question: string, answer: string): ToolFaqItem {
    return {
        question,
        answer,
        structuredDataAnswer: answer
    };
}

export const FAQ_ITEMS: ToolFaqItem[] = [
    createPlainTextFaqItem(
        'What is a UUID?',
        'A UUID is a 128-bit id, usually written as 32 hex digits in five groups. The point is to create an id on one machine without asking a database for the next number. Version 4 is random. Version 7 starts with the current time, so new ids sort near each other.'
    ),
    createPlainTextFaqItem(
        'What is the difference between UUID v4 and v7?',
        'Version 4 is 122 random bits, with the version and variant bits set. crypto.randomUUID() returns one. Version 7, from RFC 9562, stores a 48-bit Unix timestamp in milliseconds in front, then sets the version nibble to 7 and fills the rest at random. Version 7 values created later sort after earlier ones. Version 4 values do not.'
    ),
    createPlainTextFaqItem(
        'How likely is a UUID collision?',
        COLLISION_ODDS
    ),
    createPlainTextFaqItem(
        'Does this page upload the UUIDs I generate or paste?',
        'No. Generation and validation run in your browser. The UUID text is not uploaded to a CodeSamplez server, and the tool_used analytics event does not include it. The published site still loads Google Analytics and advertising scripts, which use cookies.'
    ),
    createPlainTextFaqItem(
        'How many UUIDs can I generate at once?',
        `From 1 to ${MAX_UUID_COUNT}. Generate again for another batch. Copy copies the list, and Download saves it as uuids.txt.`
    ),
    createPlainTextFaqItem(
        'Are uppercase UUIDs and UUIDs without hyphens valid?',
        `Yes. ${WORKED_EXAMPLE_V4_UPPER_PLAIN} is the same id as ${WORKED_EXAMPLE_V4}. The validator also accepts braces and a urn:uuid: prefix, and it prints the canonical lowercase form with hyphens.`
    ),
    {
        question: 'How do I use a UUID as a JWT ID?',
        answer: (
            <p>
                Generate a UUID here and paste it into the jti claim in the{' '}
                <a href={buildSiteHref('/jwt-builder/')}>JWT Builder</a>.
                {' '}jti is the token id. This page does not sign the token.
            </p>
        ),
        structuredDataAnswer: JWT_FAQ_ANSWER
    }
];

export function UuidGeneratorIntro(): JSX.Element {
    return (
        <section className="c-tool-article c-tool-article--intro c-surface-card" aria-labelledby="uuid-generator-intro-heading">
            <div className="c-tool-article__content">
                <h2 id="uuid-generator-intro-heading" className="c-tool-article__eyebrow">About This Tool</h2>
                <p className="c-tool-article__lead">
                    Generate a version 4 or version 7 UUID in your browser, one at a time or up to {MAX_UUID_COUNT} at
                    once. Copy or download the list, or paste a UUID you already have and read its version, variant,
                    and, for version 7, the timestamp.
                </p>
            </div>
        </section>
    );
}

export function UuidGeneratorArticle(): JSX.Element {
    return (
        <section className="c-tool-article c-surface-card" aria-labelledby="uuid-generator-article-heading">
            <div className="c-tool-article__content">
                <h2 id="uuid-generator-article-heading" className="c-tool-article__sr-only">UUID Generator Guide</h2>

                <ToolArticleSection id="uuid-generator-what-is" title="What is a UUID?">
                    <p>
                        A UUID (universally unique identifier) is a 128-bit value. People also call it a GUID.
                        The usual text form is 8-4-4-4-12 hex digits, for example {WORKED_EXAMPLE_V4}. Four bits
                        record the version and two bits record the variant, so the remaining bits carry the random
                        or time data.
                    </p>
                    <p>
                        You do not need a central counter. A client, a test, or a database row can mint an id on
                        its own. That is why APIs, queue messages, and JWT <code>jti</code> claims use them.
                    </p>
                </ToolArticleSection>

                <ToolArticleSection id="uuid-generator-v4-vs-v7" title="UUID v4 vs v7">
                    <p>
                        <strong>Version 4</strong> is the random UUID. This page asks <code>crypto.randomUUID()</code> for
                        it, and uses <code>crypto.getRandomValues()</code> only when that method is missing. The
                        version nibble is 4 and the variant is the RFC 4122 pattern (<code>10</code> in the top two
                        bits of the clock-sequence byte).
                    </p>
                    <p>
                        <strong>Version 7</strong> is defined in RFC 9562. The first 48 bits are the Unix time in
                        milliseconds. The version nibble is 7, the variant bits match version 4, and the remaining
                        bits are random. Ids created a millisecond later sort after earlier ones. Two ids from the
                        same millisecond still differ in the random bits. This page does not generate version 1, 3,
                        5, 6, or 8.
                    </p>
                    <div className="c-tool-article__cta-row">
                        <a className="c-button" href={SITE_BASE_URL}>
                            Explore More Dev Tools
                        </a>
                    </div>
                </ToolArticleSection>

                <ToolArticleSection id="uuid-generator-example" title="Worked Example">
                    <p>
                        These two ids are not samples typed by hand. They are the strings this page&apos;s generator
                        returns for a fixed 16-byte input. Version 7 uses the timestamp {WORKED_EXAMPLE_V7_TIMESTAMP_ISO}.
                    </p>
                    <p><strong>Version 4</strong></p>
                    <pre><code>{WORKED_EXAMPLE_V4}</code></pre>
                    <p>
                        Validate reports version {WORKED_EXAMPLE_V4_VERSION} and variant {WORKED_EXAMPLE_V4_VARIANT}.
                        There is no timestamp: version 4 does not store one. The same bytes with Uppercase and No
                        hyphens checked are:
                    </p>
                    <pre><code>{WORKED_EXAMPLE_V4_UPPER_PLAIN}</code></pre>
                    <p>
                        Pasting that form back into Validate returns the canonical id {WORKED_EXAMPLE_V4_CANONICAL_FROM_PLAIN}.
                    </p>
                    <p><strong>Version 7</strong></p>
                    <pre><code>{WORKED_EXAMPLE_V7}</code></pre>
                    <p>
                        Validate reports version {WORKED_EXAMPLE_V7_VERSION}, variant {WORKED_EXAMPLE_V7_VARIANT}, and
                        timestamp {WORKED_EXAMPLE_V7_TIMESTAMP_ISO} ({WORKED_EXAMPLE_V7_TIMESTAMP_MS} ms).
                    </p>
                </ToolArticleSection>

                <ToolArticleSection id="uuid-generator-how-to" title="How do I generate and check a UUID?">
                    <ol>
                        <li>
                            <strong>Choose version 4 or version 7</strong>
                            <p>Version 4 is random. Version 7 leads with the current time.</p>
                        </li>
                        <li>
                            <strong>Set the count</strong>
                            <p>Use any whole number from 1 to {MAX_UUID_COUNT}.</p>
                        </li>
                        <li>
                            <strong>Set the formatting</strong>
                            <p>Uppercase and No hyphens change the text only. Leave both unchecked for the usual lowercase form with hyphens.</p>
                        </li>
                        <li>
                            <strong>Click Generate</strong>
                            <p>Copy the list, or download it as uuids.txt.</p>
                        </li>
                        <li>
                            <strong>Paste a UUID to validate</strong>
                            <p>One id per line. The result shows the version, the variant, and the version 7 timestamp when the id has one.</p>
                        </li>
                    </ol>
                </ToolArticleSection>

                <ToolArticleSection id="uuid-generator-in-code" title="Generate a UUID in Code">
                    <p>
                        The browser snippet uses the same calls as this page: <code>crypto.randomUUID()</code> for
                        version 4, and <code>crypto.getRandomValues()</code> plus the version 7 bit layout for version 7.
                        <code>crypto.randomUUID()</code> does not return a version 7 UUID.
                    </p>
                    <p><strong>JavaScript</strong></p>
                    <pre><code>{JAVASCRIPT_UUID_SNIPPET}</code></pre>
                    <p><strong>Python</strong></p>
                    <pre><code>{PYTHON_UUID_SNIPPET}</code></pre>
                    <p><strong>SQL</strong></p>
                    <pre><code>{SQL_UUID_SNIPPET}</code></pre>
                </ToolArticleSection>

                <ToolArticleSection id="uuid-generator-collisions" title="Collision Odds">
                    <p>{COLLISION_ODDS}</p>
                    <p>
                        That is not a promise that a collision is impossible. It is the standard birthday
                        approximation for 122 random bits. Version 7 adds a timestamp, so two values collide only
                        when they share a millisecond and the random bits also match. Do not use either version as
                        a secret. A UUID identifies a record. It does not hide it.
                    </p>
                </ToolArticleSection>

                <ToolArticleSection id="uuid-generator-related" title="Related Tools">
                    <p>
                        A JWT <code>jti</code> claim is a unique token id. Generate one here, then paste it into
                        the <a href={buildSiteHref('/jwt-builder/')}>JWT Builder</a>. The{' '}
                        <a href={buildSiteHref('/jwt-decoder/')}>JWT Decoder</a> reads that claim back out.
                        If a transport wants those bytes as text, the{' '}
                        <a href={buildSiteHref('/base64-converter/')}>Base64 Converter</a> encodes
                        them in the browser. This page does not encode Base64 and it does not sign a token.
                    </p>
                </ToolArticleSection>

                <ToolArticleSection id="uuid-generator-limits" title="What this page does not do">
                    <ul>
                        <li>It generates version 4 and version 7 only. A pasted version 1, 3, 5, or 6 id is still checked, and the version number is shown.</li>
                        <li>The timestamp line is filled only for version 7. Version 1 stores time in a different layout, so that line stays empty.</li>
                        <li>The count stops at {MAX_UUID_COUNT} per click.</li>
                        <li>Nil (all zeros) and max (all ones) are reported as such. They are not version 4 or version 7.</li>
                    </ul>
                </ToolArticleSection>

                <ToolArticleSection id="uuid-generator-faqs" title="UUID Generator FAQs">
                    <ToolFaqList items={FAQ_ITEMS} />
                </ToolArticleSection>
            </div>
        </section>
    );
}
