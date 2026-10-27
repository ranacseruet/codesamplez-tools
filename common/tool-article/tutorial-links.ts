/**
 * Shared map of codesamplez.com tutorials related to each tool.
 *
 * Keyed by the public-path slug (`jwt-builder`, not the manifest id
 * `jwt-builder-tool`). Import this module instead of copying the URLs.
 * Paths are the canonical forms that return HTTP 200 with no redirect.
 * The trailing-slash URLs redirect to these.
 */

export interface TutorialLink {
    /** Canonical absolute URL on codesamplez.com. */
    href: string;
    /** Path only. Analytics sends this and never the full URL or any tool input. */
    path: string;
    /** Tutorial topic, used as the link anchor. */
    anchor: string;
}

export const TUTORIAL_LINK_CLASS = 'c-tool-tutorial__link';
export const TUTORIAL_LINK_PATH_ATTR = 'data-tutorial-path';

const TUTORIAL_ORIGIN = 'https://codesamplez.com';

function defineTutorial(path: string, anchor: string): TutorialLink {
    return {
        href: `${TUTORIAL_ORIGIN}${path}`,
        path,
        anchor
    };
}

export const JWT_CRASH_COURSE = defineTutorial(
    '/development/json-web-token-crash-course',
    'JSON Web Token crash course'
);

export const JWT_BEST_PRACTICES = defineTutorial(
    '/development/jwt-best-practices',
    'JWT best practices'
);

export const JWT_AUTH_CASE_STUDY = defineTutorial(
    '/development/microservices/jwt-auth-case-study',
    'JWT authentication in microservices'
);

export const JSON_VS_JSONC_VS_JSON5 = defineTutorial(
    '/development/json-vs-jsonc-vs-json5',
    'JSON vs JSONC vs JSON5'
);

export const USING_JSON_IN_NODE = defineTutorial(
    '/programming/using-json-in-node-js-javascript',
    'Using JSON in Node.js'
);

export const BASE64_EXPLAINED = defineTutorial(
    '/programming/base64-explained',
    'Base64 explained'
);

export const GIT_MERGE_VS_REBASE = defineTutorial(
    '/productivity/git-merge-vs-rebase',
    'Git merge vs rebase'
);

export const GIT_COMMANDS = defineTutorial(
    '/productivity/git-commands',
    'Git commands'
);

const JWT_TUTORIALS: readonly TutorialLink[] = [
    JWT_CRASH_COURSE,
    JWT_BEST_PRACTICES,
    JWT_AUTH_CASE_STUDY
];

const JSON_TUTORIALS: readonly TutorialLink[] = [
    JSON_VS_JSONC_VS_JSON5,
    USING_JSON_IN_NODE
];

/**
 * Public-path slug → related tutorials. Tools omitted here have no matching
 * tutorial and should not render a Learn more block.
 */
export const TUTORIAL_LINKS_BY_TOOL_ID: Readonly<Record<string, readonly TutorialLink[]>> = {
    'jwt-decoder': JWT_TUTORIALS,
    'jwt-builder': JWT_TUTORIALS,
    'json-formatter': JSON_TUTORIALS,
    'json-editor': JSON_TUTORIALS,
    'data-format-converter': JSON_TUTORIALS,
    'base64-converter': [BASE64_EXPLAINED],
    'diff-checker': [GIT_MERGE_VS_REBASE, GIT_COMMANDS]
};

export function getTutorialLinksForTool(toolId: string): readonly TutorialLink[] {
    const links = TUTORIAL_LINKS_BY_TOOL_ID[toolId];
    return links ? links : [];
}

/** True when `path` is one of the mapped tutorial paths. */
export function isMappedTutorialPath(path: string): boolean {
    const toolIds = Object.keys(TUTORIAL_LINKS_BY_TOOL_ID);

    for (let toolIndex = 0; toolIndex < toolIds.length; toolIndex += 1) {
        const links = TUTORIAL_LINKS_BY_TOOL_ID[toolIds[toolIndex]];

        for (let linkIndex = 0; linkIndex < links.length; linkIndex += 1) {
            if (links[linkIndex].path === path) {
                return true;
            }
        }
    }

    return false;
}
