import type { JSX } from 'preact';
import { ToolArticleSection } from './ToolArticle';
import {
    TUTORIAL_LINK_CLASS,
    TUTORIAL_LINK_PATH_ATTR,
    getTutorialLinksForTool
} from './tutorial-links';

/**
 * One sentence about what this tool does today, then why the tutorials are
 * listed. Kept beside the renderer so the URL map stays data other pages can
 * import without this copy.
 */
const TUTORIAL_INTRO_BY_TOOL_ID: Readonly<Record<string, string>> = {
    'jwt-decoder': 'This decoder shows a JSON Web Token\'s header and payload and can verify an HMAC-SHA256 signature in the browser. These tutorials explain how JSON Web Tokens are structured, how to handle them, and how one authentication design uses them between services.',
    'jwt-builder': 'This generator builds a signed JSON Web Token from the claims you enter, using HS256 or RS256, in the browser. These tutorials explain how JSON Web Tokens are structured, how to handle them, and how one authentication design uses them between services.',
    'json-formatter': 'This formatter beautifies, minifies, and checks strict JSON in the browser, and can validate it against a Draft 7 or Draft 2020-12 JSON Schema. These tutorials compare JSON, JSONC, and JSON5, and show how Node.js reads and writes JSON.',
    'json-editor': 'This editor builds and changes strict JSON as a tree in the browser, then copies or downloads the result. These tutorials compare JSON, JSONC, and JSON5, and show how Node.js reads and writes JSON.',
    'data-format-converter': 'This converter turns data between JSON, XML, YAML, and Properties in the browser. These tutorials compare JSON, JSONC, and JSON5, and show how Node.js reads and writes JSON.',
    'base64-converter': 'This converter encodes and decodes Base64 text and files in the browser. The tutorial explains how Base64 encoding works.',
    'diff-checker': 'This checker compares two texts or files and highlights added, removed, and changed lines in the browser. These tutorials cover Git merge versus rebase and a Git command reference for reviewing committed changes.'
};

export function ToolTutorialLinks({ toolId }: { toolId: string }): JSX.Element | null {
    const links = getTutorialLinksForTool(toolId);

    if (links.length === 0) {
        return null;
    }

    const intro = TUTORIAL_INTRO_BY_TOOL_ID[toolId];
    const sectionId = `${toolId}-tutorials`;

    return (
        <ToolArticleSection id={sectionId} title="Learn more">
            {intro ? <p>{intro}</p> : null}
            <ul>
                {links.map((link) => (
                    <li key={link.path}>
                        <a
                            className={TUTORIAL_LINK_CLASS}
                            href={link.href}
                            {...{ [TUTORIAL_LINK_PATH_ATTR]: link.path }}
                        >
                            {link.anchor}
                        </a>
                    </li>
                ))}
            </ul>
        </ToolArticleSection>
    );
}
