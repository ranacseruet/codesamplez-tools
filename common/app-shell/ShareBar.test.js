import { render } from 'preact';
import { ShareBar } from './ShareBar';

const SHARE_URL = 'https://tools.codesamplez.com/diff-checker/';
const SHARE_TITLE = 'Diff Checker & Text Comparison';

function renderShareBar(props = {}) {
    const root = document.createElement('div');
    document.body.appendChild(root);
    render(<ShareBar shareUrl={SHARE_URL} shareTitle={SHARE_TITLE} {...props} />, root);
    return root;
}

describe('ShareBar', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('renders a labelled share navigation with the four platform links', () => {
        const root = renderShareBar();

        const nav = root.querySelector('nav.cst-share');
        expect(nav).not.toBeNull();
        expect(nav.getAttribute('aria-label')).toBe('Share this tool');

        const links = Array.from(root.querySelectorAll('a.cst-share__btn'));
        expect(links).toHaveLength(4);
        expect(links.map((link) => link.getAttribute('aria-label'))).toEqual([
            'Share on X',
            'Share on LinkedIn',
            'Share on Reddit',
            'Share on Facebook'
        ]);
    });

    it('encodes the page url and title into each platform share intent', () => {
        const root = renderShareBar();
        const encodedUrl = encodeURIComponent(SHARE_URL);
        const encodedTitle = encodeURIComponent(SHARE_TITLE);
        const hrefByLabel = (label) =>
            root.querySelector(`a.cst-share__btn[aria-label="${label}"]`)?.getAttribute('href');

        expect(hrefByLabel('Share on X')).toBe(
            `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`
        );
        expect(hrefByLabel('Share on LinkedIn')).toBe(
            `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`
        );
        expect(hrefByLabel('Share on Reddit')).toBe(
            `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`
        );
        expect(hrefByLabel('Share on Facebook')).toBe(
            `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`
        );
    });

    it('opens share links in a new tab with a safe rel', () => {
        const root = renderShareBar();
        root.querySelectorAll('a.cst-share__btn').forEach((link) => {
            expect(link.getAttribute('target')).toBe('_blank');
            expect(link.getAttribute('rel')).toBe('noopener noreferrer');
        });
    });

    it('copies the share url and reflects a copied state', async () => {
        const writeText = jest.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText }
        });

        const root = renderShareBar();
        const copyButton = root.querySelector('button.cst-share__btn--copy');
        expect(copyButton).not.toBeNull();
        expect(copyButton.getAttribute('aria-label')).toBe('Copy link');

        copyButton.click();
        await Promise.resolve();
        await Promise.resolve();

        expect(writeText).toHaveBeenCalledWith(SHARE_URL);
        const updatedButton = root.querySelector('button.cst-share__btn--copy');
        expect(updatedButton.getAttribute('aria-label')).toBe('Link copied');
        expect(updatedButton.className).toContain('is-copied');
    });

    it('does not throw when the clipboard API is unavailable', () => {
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: undefined
        });

        const root = renderShareBar();
        const copyButton = root.querySelector('button.cst-share__btn--copy');
        expect(() => copyButton.click()).not.toThrow();
    });
});
