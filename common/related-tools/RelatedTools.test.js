import { render } from 'preact';
import { RelatedToolsSection } from './RelatedTools';
import { buildSiteHref } from '../siteBaseUrl';

const TOOLS = [
    {
        id: 'jwt-builder-tool',
        title: 'JWT Builder',
        reason: 'Build a new token from these claims',
        publicPath: '/jwt-builder/',
        iconSvg: '<svg class="cst-icon" data-icon="file-key"></svg>',
        categorySlug: 'encoders'
    },
    {
        id: 'base64-converter-tool',
        title: 'Base64 Converter',
        reason: 'Decode the raw segments yourself',
        publicPath: '/base64-converter/',
        iconSvg: '<svg class="cst-icon" data-icon="binary"></svg>',
        categorySlug: 'encoders'
    }
];

function renderSection(props) {
    const root = document.createElement('div');
    document.body.appendChild(root);
    render(<RelatedToolsSection {...props} />, root);
    return root;
}

describe('RelatedToolsSection', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('renders a card per tool with its pair-specific handoff copy', () => {
        const root = renderSection({ tools: TOOLS, sourceToolTitle: 'JWT Decoder' });

        expect(root.querySelector('#related-tools-heading')?.textContent).toBe('Next step');
        expect(root.querySelector('.c-related-tools__description')?.textContent)
            .toBe('Common follow-ons after using the JWT Decoder.');
        expect(
            Array.from(root.querySelectorAll('.c-related-tools__card-copy')).map((node) => node.textContent)
        ).toEqual([
            'Build a new token from these claims',
            'Decode the raw segments yourself'
        ]);
    });

    it('gives every card exactly one link, named after its destination', () => {
        // Three identical "Open tool" links previously failed WCAG 2.4.4 and
        // wasted the internal anchor text; a second anchor per card would also
        // double the tab stops.
        const root = renderSection({ tools: TOOLS, sourceToolTitle: 'JWT Decoder' });

        const links = Array.from(root.querySelectorAll('a'));
        expect(links).toHaveLength(TOOLS.length);
        expect(links.map((link) => link.textContent)).toEqual(['JWT Builder', 'Base64 Converter']);
        expect(links.map((link) => link.getAttribute('href'))).toEqual([
            buildSiteHref('/jwt-builder/'),
            buildSiteHref('/base64-converter/')
        ]);
        expect(links.every((link) => link.closest('.c-related-tools__card-title'))).toBe(true);
    });

    it('keeps the call to action decorative so it is not a second tab stop', () => {
        const root = renderSection({ tools: TOOLS, sourceToolTitle: 'JWT Decoder' });

        const ctas = Array.from(root.querySelectorAll('.c-related-tools__cta'));
        expect(ctas).toHaveLength(TOOLS.length);
        ctas.forEach((cta) => {
            expect(cta.tagName).toBe('SPAN');
            expect(cta.getAttribute('aria-hidden')).toBe('true');
        });
    });

    it('renders the prerendered icon markup and the category accent class', () => {
        const root = renderSection({ tools: TOOLS, sourceToolTitle: 'JWT Decoder' });

        const icon = root.querySelector('.c-related-tools__icon');
        expect(icon?.getAttribute('aria-hidden')).toBe('true');
        expect(icon?.querySelector('svg')?.getAttribute('data-icon')).toBe('file-key');
        expect(root.querySelector('.c-related-tools__card--encoders')).not.toBeNull();
    });

    it('falls back to a generic subheading when no source tool is given', () => {
        const root = renderSection({ tools: TOOLS });

        expect(root.querySelector('.c-related-tools__description')?.textContent)
            .toBe('Common follow-ons from this tool.');
    });

    it('renders nothing when the list is empty', () => {
        const root = renderSection({ tools: [] });

        expect(root.innerHTML).toBe('');
    });
});
