import { render } from 'preact';
import { ToolTutorialLinks } from './TutorialLinks';
import {
    TUTORIAL_LINK_CLASS,
    TUTORIAL_LINK_PATH_ATTR,
    getTutorialLinksForTool
} from './tutorial-links';

describe('ToolTutorialLinks', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="test-root"></div>';
    });

    it('renders same-tab descriptive links for a mapped tool', () => {
        const root = document.getElementById('test-root');
        render(<ToolTutorialLinks toolId="jwt-decoder" />, root);

        const section = root!.querySelector('#jwt-decoder-tutorials');
        expect(section).not.toBeNull();
        expect(section!.textContent).toBe('Learn more');
        expect(root!.textContent).toContain('HMAC-SHA256');
        expect(root!.textContent).not.toContain('RS256');

        const links = Array.from(root!.querySelectorAll(`.${TUTORIAL_LINK_CLASS}`));
        const expected = getTutorialLinksForTool('jwt-decoder');
        expect(links).toHaveLength(expected.length);

        links.forEach((link, index) => {
            expect(link.tagName).toBe('A');
            expect(link.getAttribute('href')).toBe(expected[index].href);
            expect(link.getAttribute(TUTORIAL_LINK_PATH_ATTR)).toBe(expected[index].path);
            expect(link.textContent).toBe(expected[index].anchor);
            expect(link.getAttribute('target')).toBeNull();
            expect(link.getAttribute('rel')).toBeNull();
        });
    });

    it('describes only the behavior of each mapped tool', () => {
        const expectations: Record<string, string[]> = {
            'jwt-builder': ['HS256', 'RS256'],
            'json-formatter': ['strict JSON', 'Draft 7', 'Draft 2020-12'],
            'json-editor': ['strict JSON', 'tree'],
            'data-format-converter': ['JSON', 'XML', 'YAML', 'Properties'],
            'base64-converter': ['encodes and decodes Base64'],
            'diff-checker': ['added, removed, and changed lines']
        };

        Object.keys(expectations).forEach((toolId) => {
            document.body.innerHTML = '<div id="test-root"></div>';
            const root = document.getElementById('test-root');
            render(<ToolTutorialLinks toolId={toolId} />, root);
            expectations[toolId].forEach((phrase) => {
                expect(root!.textContent).toContain(phrase);
            });
        });
    });

    it('renders nothing when the tool has no tutorial match', () => {
        const root = document.getElementById('test-root');
        render(<ToolTutorialLinks toolId="text-analyzer" />, root);
        expect(root!.innerHTML).toBe('');
    });
});
