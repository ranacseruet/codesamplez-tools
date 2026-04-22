// @ts-check

const { escapeAttribute, escapeHtml } = require('./document-helpers');

const CONTACT_PAGE_URL = 'https://codesamplez.com/contact';

/**
 * @typedef {{ href: string, label: string }} LinkPart
 * @typedef {string | LinkPart} ContentPart
 * @typedef {{ id: string, title: string, paragraphs: ContentPart[][] }} ContentSection
 * @typedef {{ question: string, answer: ContentPart[] }} FaqItem
 */

/** @type {ContentPart[]} */
const ROOT_PAGE_INTRO = [
    'Developers lose time on repetitive tasks - that\'s where free online developer tools come in. This page is a hub of browser-based utilities to speed up development: format code, debug errors, convert data, and more. Whether you need to minify JavaScript or decode a secret message, these tools help you get it done fast, no installation required.'
];

/** @type {ContentSection[]} */
const ROOT_PAGE_OVERVIEW_SECTIONS = [
    {
        id: 'what-are-online-developer-tools',
        title: 'What are Online Developer Tools?',
        paragraphs: [[
            'Online developer tools are browser-based applications that help programmers perform coding tasks without installing software. They run in the cloud or in-browser, enabling quick actions like code formatting, debugging, encoding/decoding, and other productivity tasks.'
        ]]
    },
    {
        id: 'why-use-these-free-developer-tools',
        title: 'Why Use These Free Developer Tools?',
        paragraphs: [[
            'Free online dev tools save time by handling repetitive coding chores instantly. They let developers format, minify, or analyze code on the fly, which boosts productivity. Since they\'re web-based, you can use them anywhere, anytime - at no cost.'
        ]]
    }
];

/** @type {ContentSection} */
const ROOT_PAGE_USAGE_SECTION = {
    id: 'when-to-use-these-online-developer-tools',
    title: 'When to Use These Online Developer Tools?',
    paragraphs: [
        [
            'Use these free online developer tools when you need instant solutions for common coding tasks without installing software or setting up complex environments.'
        ],
        [
            'Need to quickly debug why your JSON isn\'t parsing? Use our ',
            { href: 'json-formatter/', label: 'JSON Formatter and Validator' },
            '.'
        ],
        [
            'Want to compare two code versions? Use ',
            { href: 'diff-checker/', label: 'Diff Checker' },
            '.'
        ],
        [
            'Need to create a JWT Token or inspect an existing one? Try our ',
            { href: 'jwt-builder/', label: 'JWT Generator' },
            ' and ',
            { href: 'jwt-decoder/', label: 'JWT Decoder' },
            '.'
        ],
        [
            'Want to reduce size of your javascript or css? Use the ',
            { href: 'js-minifier/', label: 'Javascript Minifier' },
            ' or the ',
            { href: 'css-minifier/', label: 'CSS Minifier' },
            '.'
        ],
        [
            'These browser-based utilities are perfect for quick one-off tasks, emergency debugging sessions, code reviews, or when working on different machines where you don\'t have access to your usual development tools - saving developers time on repetitive tasks that would otherwise require dedicated software installations or complex command-line operations.'
        ]
    ]
};

/** @type {FaqItem[]} */
const ROOT_PAGE_FAQ_ITEMS = [
    {
        question: 'Are these online developer tools free to use?',
        answer: [
            'Yes. All tools listed here are completely free to use with no registration required, allowing any developer to instantly use them in a browser.'
        ]
    },
    {
        question: 'How secure are online dev tools to use?',
        answer: [
            'Reputable online developer tools (like those on this page) run locally in your browser or securely on the server. We do not store your code or data. However, it\'s best not to paste sensitive code into any online tool if security is a concern.'
        ]
    },
    {
        question: 'Do I need to install anything to use these tools?',
        answer: [
            'No installation is needed. These are web-based tools - you simply open them in your browser. This makes them quick and convenient for one-off tasks.'
        ]
    },
    {
        question: 'Can I suggest a new tool?',
        answer: [
            'Yes! Please visit our ',
            { href: CONTACT_PAGE_URL, label: 'Contact' },
            ' page to send us your suggestions or requests.'
        ]
    }
];

/**
 * @param {ContentPart[]} parts
 * @returns {string}
 */
function renderContentParts(parts) {
    return parts.map((part) => {
        if (typeof part === 'string') {
            return escapeHtml(part);
        }

        return `<a href="${escapeAttribute(part.href)}">${escapeHtml(part.label)}</a>`;
    }).join('');
}

/**
 * @param {ContentSection} section
 * @returns {string}
 */
function renderContentSection(section) {
    return `    <section aria-labelledby="${escapeAttribute(section.id)}">
      <h2 class="section-title" id="${escapeAttribute(section.id)}">${escapeHtml(section.title)}</h2>
${section.paragraphs.map((paragraph) => `      <p class="section-body">${renderContentParts(paragraph)}</p>`).join('\n')}
    </section>`;
}

/**
 * @returns {string}
 */
function renderRootPageIntro() {
    return `    <p class="section-intro">${renderContentParts(ROOT_PAGE_INTRO)}</p>`;
}

/**
 * @returns {string}
 */
function renderRootPagePostIndexSections() {
    const overviewSections = ROOT_PAGE_OVERVIEW_SECTIONS.map((section) => renderContentSection(section)).join('\n\n');
    const usageSection = renderContentSection(ROOT_PAGE_USAGE_SECTION);
    const faqSection = `    <section class="faqs" aria-labelledby="tools-index-faqs">
      <h2 class="section-title" id="tools-index-faqs">FAQs (Frequently Asked Questions):</h2>
      <dl>
${ROOT_PAGE_FAQ_ITEMS.map((item) => `        <dt>${escapeHtml(item.question)}</dt>
        <dd>${renderContentParts(item.answer)}</dd>`).join('\n')}
      </dl>
    </section>`;

    return [overviewSections, usageSection, faqSection].join('\n\n');
}

module.exports = {
    renderRootPageIntro,
    renderRootPagePostIndexSections
};
