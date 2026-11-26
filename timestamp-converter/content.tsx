import type { JSX } from 'preact';
import { buildSiteHref, SITE_BASE_URL } from '../common/siteBaseUrl';
import { ToolArticleSection, ToolFaqList, type ToolFaqItem } from '../common/tool-article/ToolArticle';
import {
    WORKED_EXAMPLE,
    WORKED_EXAMPLE_EPOCH,
    WORKED_EXAMPLE_FROM_DATE,
    WORKED_EXAMPLE_LOCAL_ZONE,
    WORKED_EXAMPLE_MILLISECONDS,
    WORKED_EXAMPLE_MS,
    WORKED_EXAMPLE_NANOSECONDS,
    WORKED_EXAMPLE_NOW_ISO,
    WORKED_EXAMPLE_NS,
    WORKED_EXAMPLE_REPORT,
    WORKED_EXAMPLE_ZONE
} from './timestamp';

export {
    WORKED_EXAMPLE,
    WORKED_EXAMPLE_EPOCH,
    WORKED_EXAMPLE_FROM_DATE,
    WORKED_EXAMPLE_MS,
    WORKED_EXAMPLE_NS,
    WORKED_EXAMPLE_REPORT
};

if (!WORKED_EXAMPLE.iso8601 || !WORKED_EXAMPLE_MS.iso8601 || !WORKED_EXAMPLE_NS.iso8601 || !WORKED_EXAMPLE_FROM_DATE.iso8601) {
    // These strings are produced by the converter. A failure here is a broken build.
    /* istanbul ignore next */
    throw new Error('Worked timestamp example failed to convert');
}

export const JAVASCRIPT_TIMESTAMP_SNIPPET = `const seconds = ${WORKED_EXAMPLE_EPOCH};
const iso = new Date(seconds * 1000).toISOString();
const epoch = Math.floor(Date.parse('${WORKED_EXAMPLE.iso8601}') / 1000);`;

export const PYTHON_TIMESTAMP_SNIPPET = `from datetime import datetime, timezone

seconds = ${WORKED_EXAMPLE_EPOCH}
print(datetime.fromtimestamp(seconds, timezone.utc).isoformat())
print(int(datetime(2023, 11, 14, 22, 13, 20, tzinfo=timezone.utc).timestamp()))`;

export const SQL_TIMESTAMP_SNIPPET = `-- PostgreSQL
SELECT to_timestamp(${WORKED_EXAMPLE_EPOCH}) AT TIME ZONE 'UTC';
SELECT EXTRACT(EPOCH FROM TIMESTAMPTZ '2023-11-14 22:13:20+00');`;

export const SHELL_TIMESTAMP_SNIPPET = `# GNU date
date -u -d @${WORKED_EXAMPLE_EPOCH} +%Y-%m-%dT%H:%M:%SZ
date -u -d '2023-11-14 22:13:20' +%s

# macOS date uses -r for an epoch and -j -f to parse a calendar time.
# date -u -r ${WORKED_EXAMPLE_EPOCH} +%Y-%m-%dT%H:%M:%SZ`;

const JWT_FAQ_ANSWER = 'exp, iat, and nbf are NumericDate values: whole seconds since 1970-01-01 00:00:00 UTC, not counting leap seconds. Paste the number into JWT exp / iat on this page. It is read as seconds even when it has more than 10 digits. This page does not decode a token. The JWT Decoder reads those claims from a token.';

function createPlainTextFaqItem(question: string, answer: string): ToolFaqItem {
    return {
        question,
        answer,
        structuredDataAnswer: answer
    };
}

export const FAQ_ITEMS: ToolFaqItem[] = [
    createPlainTextFaqItem(
        'What is a Unix timestamp?',
        'A Unix timestamp counts seconds since 1970-01-01 00:00:00 UTC. Leap seconds are not included. This page also reads milliseconds, microseconds, and nanoseconds, and it can turn a calendar time back into that count.'
    ),
    createPlainTextFaqItem(
        'How does this page choose seconds, milliseconds, microseconds, or nanoseconds?',
        'It counts digits in the integer, after a leading minus and leading zeros are removed. 1 to 10 digits are seconds, 11 to 13 are milliseconds, 14 to 16 are microseconds, and 17 to 19 are nanoseconds. The unit menu can override that. A fraction finer than a nanosecond is rejected.'
    ),
    createPlainTextFaqItem(
        'What do UTC, local, and the chosen time zone mean?',
        `UTC is the epoch's own zone. Local is the time zone the browser reports. The third line uses the IANA name you type, such as ${WORKED_EXAMPLE_ZONE}. The zone clock is the millisecond instant. The ISO 8601 line keeps any finer digits, through nanoseconds.`
    ),
    {
        question: 'How do JWT exp, iat, and nbf relate to Unix time?',
        answer: (
            <p>
                exp, iat, and nbf are NumericDate values: whole seconds since 1970-01-01 00:00:00 UTC,
                not counting leap seconds. Paste the number into JWT exp / iat on this page. It is read
                as seconds even when it has more than 10 digits. This page does not decode a token. The{' '}
                <a href={buildSiteHref('/jwt-decoder/')}>JWT Decoder</a> reads those claims from a token.
            </p>
        ),
        structuredDataAnswer: JWT_FAQ_ANSWER
    },
    createPlainTextFaqItem(
        'Does this page upload the timestamp I paste?',
        'No. Conversion runs in your browser. The timestamp and the time zone name are not uploaded to a CodeSamplez server, and the tool_used analytics event does not include them. The published site still loads Google Analytics and advertising scripts, which use cookies.'
    ),
    createPlainTextFaqItem(
        'Why can the ISO 8601 line show more than Date.toISOString()?',
        'Date.toISOString() stops at milliseconds. A nanosecond or microsecond value has more digits than that. This page keeps those digits on the ISO 8601 line. The RFC 2822 line is whole seconds, the same text as Date.toUTCString() of the millisecond instant.'
    ),
    createPlainTextFaqItem(
        'What happens during daylight saving time?',
        'Unix time has no daylight-saving offset. The offset is applied only when a local clock time is shown or when a date is turned back into epoch. A time that falls in a spring-forward gap is rejected. When the same local time happens twice, this page keeps the earlier instant.'
    )
];

export function TimestampConverterIntro(): JSX.Element {
    return (
        <section className="c-tool-article c-tool-article--intro c-surface-card" aria-labelledby="timestamp-converter-intro-heading">
            <div className="c-tool-article__content">
                <h2 id="timestamp-converter-intro-heading" className="c-tool-article__eyebrow">About This Tool</h2>
                <p className="c-tool-article__lead">
                    Convert a Unix timestamp to UTC, local time, and a time zone you choose, or turn a date
                    back into epoch seconds. Seconds, milliseconds, microseconds, and nanoseconds stay in
                    your browser.
                </p>
            </div>
        </section>
    );
}

export function TimestampConverterArticle(): JSX.Element {
    return (
        <section className="c-tool-article c-surface-card" aria-labelledby="timestamp-converter-article-heading">
            <div className="c-tool-article__content">
                <h2 id="timestamp-converter-article-heading" className="c-tool-article__sr-only">Unix Timestamp Converter Guide</h2>

                <ToolArticleSection id="timestamp-converter-what-is" title="What is a Unix timestamp?">
                    <p>
                        A Unix timestamp is a count of seconds from 1970-01-01 00:00:00 UTC. People also call
                        it epoch time. The count does not include leap seconds, so it is not an atomic-clock
                        tally. APIs, databases, and JWT <code>exp</code>, <code>iat</code>, and <code>nbf</code> claims
                        store that number.
                    </p>
                    <p>
                        The same instant is often written with more digits: milliseconds (13 digits today),
                        microseconds (16), or nanoseconds (19). This page reads the digit count, and the unit
                        menu can force a unit when the count is ambiguous.
                    </p>
                </ToolArticleSection>

                <ToolArticleSection id="timestamp-converter-units" title="Seconds, milliseconds, microseconds, and nanoseconds">
                    <p>
                        Leading zeros do not count. <code>000{WORKED_EXAMPLE_EPOCH}</code> is still 10 digits, so it
                        is seconds. A value with 11 to 13 digits is milliseconds, 14 to 16 is microseconds, and
                        17 to 19 is nanoseconds. Anything longer is rejected.
                    </p>
                    <p>
                        JavaScript <code>Number</code> cannot hold a current nanosecond count exactly. This page
                        keeps the value as an integer of nanoseconds, then shows the same instant in all four
                        units. The calendar lines use the millisecond instant. The ISO 8601 line keeps the rest.
                    </p>
                    <div className="c-tool-article__cta-row">
                        <a className="c-button" href={SITE_BASE_URL}>
                            Explore More Dev Tools
                        </a>
                    </div>
                </ToolArticleSection>

                <ToolArticleSection id="timestamp-converter-example" title="Worked Example">
                    <p>
                        These lines are not typed by hand. They are what this page returns for{' '}
                        <code>{WORKED_EXAMPLE_EPOCH}</code>, with the chosen zone {WORKED_EXAMPLE_ZONE} and the
                        browser zone {WORKED_EXAMPLE_LOCAL_ZONE}. Relative time below uses {WORKED_EXAMPLE_NOW_ISO}.
                        On the tool itself, relative time uses the moment you click Convert.
                    </p>
                    <pre><code>{WORKED_EXAMPLE_REPORT}</code></pre>
                    <p>
                        <code>{WORKED_EXAMPLE_MILLISECONDS}</code> has 13 digits, so it is milliseconds:{' '}
                        <code>{WORKED_EXAMPLE_MS.iso8601}</code>. <code>{WORKED_EXAMPLE_NANOSECONDS}</code> has 19
                        digits, so it is nanoseconds: <code>{WORKED_EXAMPLE_NS.iso8601}</code>. The RFC 2822 line
                        for that nanosecond value is still {WORKED_EXAMPLE_NS.rfc2822}, because that format has
                        no fraction.
                    </p>
                    <p>
                        The other direction uses the same instant. {WORKED_EXAMPLE_ZONE} on 2023-11-14 at 17:13:20
                        converts back to <code>{WORKED_EXAMPLE_FROM_DATE.unixSeconds}</code> seconds.
                    </p>
                </ToolArticleSection>

                <ToolArticleSection id="timestamp-converter-how-to" title="How do I convert a timestamp or a date?">
                    <ol>
                        <li>
                            <strong>Read the current epoch</strong>
                            <p>The top of the page shows the current Unix seconds. Use this time copies that number into the timestamp field.</p>
                        </li>
                        <li>
                            <strong>Paste a timestamp</strong>
                            <p>Leave the unit on Auto, or choose seconds, milliseconds, microseconds, or nanoseconds.</p>
                        </li>
                        <li>
                            <strong>Type an IANA time zone</strong>
                            <p>UTC, America/New_York, and Asia/Tokyo are examples. Local time always uses the browser zone as well.</p>
                        </li>
                        <li>
                            <strong>Click Convert timestamp</strong>
                            <p>The result lists the four units, ISO 8601, RFC 2822, UTC, local, the chosen zone, and a relative time.</p>
                        </li>
                        <li>
                            <strong>Or start from a date</strong>
                            <p>Enter a date and time in the chosen zone. Convert date writes the epoch in seconds, milliseconds, microseconds, and nanoseconds.</p>
                        </li>
                    </ol>
                </ToolArticleSection>

                <ToolArticleSection id="timestamp-converter-in-code" title="Convert a timestamp in code">
                    <p>
                        These snippets convert the worked example, {WORKED_EXAMPLE_EPOCH} seconds, which is{' '}
                        {WORKED_EXAMPLE.iso8601}. They use each language&apos;s own clock libraries. This page does
                        not send the value to them.
                    </p>
                    <p><strong>JavaScript</strong></p>
                    <pre><code>{JAVASCRIPT_TIMESTAMP_SNIPPET}</code></pre>
                    <p><code>Date</code> uses milliseconds. <code>toISOString()</code> for this instant is {WORKED_EXAMPLE.iso8601}.</p>
                    <p><strong>Python</strong></p>
                    <pre><code>{PYTHON_TIMESTAMP_SNIPPET}</code></pre>
                    <p><code>isoformat()</code> prints {WORKED_EXAMPLE.iso8601?.replace('.000Z', '+00:00')} for this UTC instant.</p>
                    <p><strong>SQL</strong></p>
                    <pre><code>{SQL_TIMESTAMP_SNIPPET}</code></pre>
                    <p>PostgreSQL <code>to_timestamp</code> takes seconds. <code>EXTRACT(EPOCH FROM ...)</code> returns seconds.</p>
                    <p><strong>Shell</strong></p>
                    <pre><code>{SHELL_TIMESTAMP_SNIPPET}</code></pre>
                    <p>GNU <code>date -d @</code> reads epoch seconds. macOS <code>date</code> uses <code>-r</code> instead, which is why that command is commented.</p>
                </ToolArticleSection>

                <ToolArticleSection id="timestamp-converter-zones" title="Time zones and daylight saving">
                    <p>
                        UTC for the worked instant is {WORKED_EXAMPLE.utc}. {WORKED_EXAMPLE_ZONE} is {WORKED_EXAMPLE.zoned}.
                        {WORKED_EXAMPLE_LOCAL_ZONE} is {WORKED_EXAMPLE.local}. Your local line follows the browser, so it
                        can differ from both.
                    </p>
                    <p>
                        A local time that does not exist, such as 02:30 in America/New_York on 2023-03-12, is rejected.
                        When a local time happens twice, this page keeps the earlier instant. On 2023-11-05, 01:30 in
                        America/New_York is the daylight-time occurrence, 05:30 UTC, not 06:30 UTC.
                    </p>
                </ToolArticleSection>

                <ToolArticleSection id="timestamp-converter-related" title="Related Tools">
                    <p>
                        JWT <code>exp</code>, <code>iat</code>, and <code>nbf</code> are Unix seconds. Paste one of
                        those numbers into JWT exp / iat here, or open the{' '}
                        <a href={buildSiteHref('/jwt-decoder/')}>JWT Decoder</a> to read them from a token. The{' '}
                        <a href={buildSiteHref('/jwt-builder/')}>JWT Builder</a> writes those claims when you set
                        an expiry. A version 7 UUID also starts with a Unix millisecond timestamp. The{' '}
                        <a href={buildSiteHref('/uuid-generator/')}>UUID Generator</a> shows that time when you
                        validate one. This page does not decode a token and it does not generate a UUID.
                    </p>
                </ToolArticleSection>

                <ToolArticleSection id="timestamp-converter-limits" title="What this page does not do">
                    <ul>
                        <li>It does not decode a JWT. The JWT field is the numeric claim, in seconds.</li>
                        <li>It does not apply leap seconds.</li>
                        <li>The RFC 2822 line is whole seconds. Sub-second digits stay on the ISO 8601 line.</li>
                        <li>The date form collects milliseconds. Microseconds and nanoseconds from a date are zero.</li>
                        <li>Relative time is rounded to one unit. A year in that line is 365 days.</li>
                        <li>An instant outside the range JavaScript can format still shows the exact unit lines, and the calendar lines stay empty.</li>
                        <li>A year before 1 AD is an astronomical year. Year 0000 is 1 BC. Earlier years start with a minus.</li>
                    </ul>
                </ToolArticleSection>

                <ToolArticleSection id="timestamp-converter-faqs" title="Unix Timestamp Converter FAQs">
                    <ToolFaqList items={FAQ_ITEMS} />
                </ToolArticleSection>
            </div>
        </section>
    );
}
