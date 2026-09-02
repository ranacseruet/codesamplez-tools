import { render } from 'preact';
import { FAQ_ITEMS, FEATURE_LIST, HOWTO_STEPS, JsonEditorArticle, JsonEditorIntro } from './content';

describe('json-editor content', () => {
    it('provides a complete FAQ set with matching structured answers', () => {
        expect(FAQ_ITEMS.length).toBeGreaterThanOrEqual(10);
        expect(FAQ_ITEMS.length).toBeLessThanOrEqual(12);
        expect(new Set(FAQ_ITEMS.map((item) => item.question)).size).toBe(FAQ_ITEMS.length);
        FAQ_ITEMS.forEach((item) => {
            expect(item.answer).toBe(item.structuredDataAnswer);
            expect(String(item.answer).length).toBeGreaterThan(0);
        });
    });

    it('exposes non-empty HowTo and feature metadata', () => {
        expect(HOWTO_STEPS.length).toBeGreaterThan(0);
        HOWTO_STEPS.forEach((step) => {
            expect(step.name.length).toBeGreaterThan(0);
            expect(step.text.length).toBeGreaterThan(0);
        });
        expect(FEATURE_LIST.length).toBeGreaterThan(0);
    });

    it('renders the intro and step-by-step article sections', () => {
        document.body.innerHTML = '<div id="content-root"></div>';
        const root = document.getElementById('content-root');

        render(<JsonEditorIntro />, root);
        expect(root.textContent).toContain('free online JSON editor to build and edit JSON objects and arrays');

        root.innerHTML = '';
        render(<JsonEditorArticle />, root);
        expect(root.querySelector('#json-editor-how-to-use')).not.toBeNull();
        expect(root.querySelectorAll('section[aria-labelledby="json-editor-how-to-use"] li')).toHaveLength(HOWTO_STEPS.length);
        expect(root.querySelector('#json-editor-faqs')).not.toBeNull();
    });
});
