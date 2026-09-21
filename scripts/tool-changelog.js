// @ts-check

const fs = require('fs');
const path = require('path');
const { getToolMetadataPath, getToolById } = require('./tool-manifest');

const REPO_URL = 'https://github.com/ranacseruet/codesamplez-tools';
/** How many recent versions the on-page changelog section shows. */
const VISIBLE_VERSION_COUNT = 3;

/**
 * @param {string} toolId
 * @returns {string}
 */
function getToolChangelogFilePath(toolId) {
    return path.join(path.dirname(getToolMetadataPath(toolId)), 'CHANGELOG.md');
}

/**
 * Parses the tool's Keep-a-Changelog file into structured sections. Robust to
 * the seed format ("### Title" + bullet list): every bullet line in a section
 * becomes one entry; the optional "### ..." heading is dropped from the
 * rendered output (the section already names the tool).
 * @param {string} toolId
 * @returns {{ version: string, date: string | null, notes: string[] }[]}
 */
function readToolChangelog(toolId) {
    const changelogPath = getToolChangelogFilePath(toolId);

    if (!fs.existsSync(changelogPath)) {
        return [];
    }

    const sections = [];
    /** @type {{ version: string, date: string | null, notes: string[] } | null} */
    let current = null;

    fs.readFileSync(changelogPath, 'utf8').split(/\r?\n/u).forEach((line) => {
        const versionMatch = /^## \[(\d+\.\d+\.\d+)\](?:\s+-\s+(.*))?$/u.exec(line.trim());

        if (versionMatch) {
            if (current) {
                sections.push(current);
            }

            current = {
                version: versionMatch[1],
                date: versionMatch[2] ? versionMatch[2].trim() : null,
                notes: []
            };
            return;
        }

        if (!current) {
            return;
        }

        const noteMatch = /^- (.+)$/u.exec(line.trim());

        if (noteMatch) {
            current.notes.push(noteMatch[1].trim());
        }
    });

    if (current) {
        sections.push(current);
    }

    return sections;
}

/**
 * The latest N changelog sections, newest first (file order is newest first).
 * @param {string} toolId
 * @returns {{ version: string, date: string | null, notes: string[] }[]}
 */
function getRecentToolChangelog(toolId) {
    return readToolChangelog(toolId).slice(0, VISIBLE_VERSION_COUNT);
}

/**
 * Deep link to the tool's full changelog blob on the default branch.
 * @param {string} toolId
 * @returns {string}
 */
function getToolChangelogUrl(toolId) {
    const tool = getToolById(toolId);
    const sourceRoot = tool ? tool.sourceRoot : toolId;

    return `${REPO_URL}/blob/main/${sourceRoot}/CHANGELOG.md`;
}

/**
 * Escapes HTML text content in changelog note copy.
 * @param {string} text
 * @returns {string}
 */
function escapeNoteText(text) {
    return text
        .replace(/&/gu, '&amp;')
        .replace(/</gu, '&lt;')
        .replace(/>/gu, '&gt;')
        .replace(/"/gu, '&quot;');
}

/**
 * Renders the "Changelog" section for the tool page: the latest versions'
 * release notes, newest first, plus a link to the full history on GitHub.
 * @param {string} toolId
 * @returns {string}
 */
function renderToolChangelogMarkup(toolId) {
    const sections = getRecentToolChangelog(toolId);
    const changelogUrl = getToolChangelogUrl(toolId);

    if (sections.length === 0) {
        return '';
    }

    const versionBlocks = sections.map((section) => {
        const versionLine = `<h4 class="c-tool-changelog__version">${escapeNoteText(section.version)}${section.date ? ` <span class="c-tool-changelog__date">· ${escapeNoteText(section.date)}</span>` : ''}</h4>`;
        const notes = section.notes.length > 0
            ? `<ul class="c-tool-changelog__notes">${section.notes.map((note) => `<li>${escapeNoteText(note)}</li>`).join('')}</ul>`
            : '';

        return `<div class="c-tool-changelog__version-block">${versionLine}${notes}</div>`;
    }).join('\n');

    return `<section class="c-tool-changelog" aria-labelledby="c-tool-changelog-heading">
<h3 class="c-tool-changelog__heading" id="c-tool-changelog-heading">Changelog</h3>
${versionBlocks}
<a class="c-tool-changelog__link" href="${escapeNoteText(changelogUrl)}" rel="noopener">View full changelog on GitHub</a>
</section>`;
}

module.exports = {
    REPO_URL,
    VISIBLE_VERSION_COUNT,
    getRecentToolChangelog,
    getToolChangelogFilePath,
    getToolChangelogUrl,
    readToolChangelog,
    renderToolChangelogMarkup
};