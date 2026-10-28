import {
    BASE64_EXPLAINED,
    GIT_COMMANDS,
    GIT_MERGE_VS_REBASE,
    JSON_VS_JSONC_VS_JSON5,
    JWT_AUTH_CASE_STUDY,
    JWT_BEST_PRACTICES,
    JWT_CRASH_COURSE,
    TUTORIAL_LINKS_BY_TOOL_ID,
    USING_JSON_IN_NODE,
    getTutorialLinksForTool,
    isMappedTutorialPath
} from './tutorial-links';

const MAPPED_TOOL_IDS = [
    'jwt-decoder',
    'jwt-builder',
    'json-formatter',
    'json-editor',
    'data-format-converter',
    'base64-converter',
    'diff-checker'
];

const UNMAPPED_TOOL_IDS = [
    'qr-code-generator',
    'text-analyzer',
    'image-editor',
    'css-minifier',
    'js-minifier'
];

describe('tutorial link map', () => {
    it('gives each mapped tool one to three shared links and no block to the others', () => {
        MAPPED_TOOL_IDS.forEach((toolId) => {
            const links = getTutorialLinksForTool(toolId);
            expect(links.length).toBeGreaterThanOrEqual(1);
            expect(links.length).toBeLessThanOrEqual(3);
            expect(TUTORIAL_LINKS_BY_TOOL_ID[toolId]).toBe(links);
        });

        UNMAPPED_TOOL_IDS.forEach((toolId) => {
            expect(getTutorialLinksForTool(toolId)).toEqual([]);
        });
    });

    it('shares one link object per URL across tools', () => {
        expect(getTutorialLinksForTool('jwt-decoder')).toBe(getTutorialLinksForTool('jwt-builder'));
        expect(getTutorialLinksForTool('json-formatter')).toBe(getTutorialLinksForTool('json-editor'));
        expect(getTutorialLinksForTool('json-formatter')).toBe(getTutorialLinksForTool('data-format-converter'));
        expect(getTutorialLinksForTool('jwt-decoder')).toEqual([
            JWT_CRASH_COURSE,
            JWT_BEST_PRACTICES,
            JWT_AUTH_CASE_STUDY
        ]);
        expect(getTutorialLinksForTool('json-formatter')).toEqual([
            JSON_VS_JSONC_VS_JSON5,
            USING_JSON_IN_NODE
        ]);
        expect(getTutorialLinksForTool('base64-converter')).toEqual([BASE64_EXPLAINED]);
        expect(getTutorialLinksForTool('diff-checker')).toEqual([GIT_MERGE_VS_REBASE, GIT_COMMANDS]);
    });

    it('uses canonical codesamplez.com paths as descriptive anchors', () => {
        const seenPaths = new Set<string>();

        Object.keys(TUTORIAL_LINKS_BY_TOOL_ID).forEach((toolId) => {
            getTutorialLinksForTool(toolId).forEach((link) => {
                expect(link.href).toBe(`https://codesamplez.com${link.path}`);
                expect(link.path.endsWith('/')).toBe(false);
                expect(link.path.includes('?')).toBe(false);
                expect(link.anchor.trim().length).toBeGreaterThan(0);
                expect(link.anchor.toLowerCase()).not.toBe('click here');
                expect(link.anchor.toLowerCase()).not.toContain('click here');
                seenPaths.add(link.path);
            });
        });

        seenPaths.forEach((path) => {
            expect(isMappedTutorialPath(path)).toBe(true);
        });
        expect(isMappedTutorialPath('/development/json-web-token-crash-course/')).toBe(false);
        expect(isMappedTutorialPath('https://codesamplez.com/development/jwt-best-practices')).toBe(false);
        expect(isMappedTutorialPath('/programming/base64-explained/amp')).toBe(false);
    });
});
