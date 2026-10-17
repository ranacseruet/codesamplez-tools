import { render } from 'preact';
import { RelatedToolsCompactRow } from './RelatedToolsCompactRow';
import { buildSiteHref } from '../siteBaseUrl';

const TOOLS = [
    {
        id: 'json-formatter-tool',
        title: 'JSON Formatter',
        reason: 'Pretty-print the payload',
        publicPath: '/json-formatter/',
        iconSvg: '<svg></svg>',
        categorySlug: 'formatters'
    },
    {
        id: 'jwt-builder-tool',
        title: 'JWT Builder',
        reason: 'Build a signed token',
        publicPath: '/jwt-builder/',
        iconSvg: '<svg></svg>',
        categorySlug: 'encoders'
    }
];

function renderRow(props) {
    const root = document.createElement('div');
    document.body.appendChild(root);
    render(<RelatedToolsCompactRow {...props} />, root);
    return root;
}

describe('RelatedToolsCompactRow', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('renders a titled nav with one descriptive link per related tool', () => {
        const root = renderRow({ tools: TOOLS });

        expect(root.querySelector('#related-tools-compact-heading')?.textContent).toBe('Related tools');
        expect(root.querySelector('nav')?.getAttribute('aria-labelledby')).toBe('related-tools-compact-heading');

        const links = Array.from(root.querySelectorAll('a'));
        expect(links).toHaveLength(TOOLS.length);
        expect(links.map((link) => link.textContent)).toEqual(['JSON Formatter', 'JWT Builder']);
        expect(links.map((link) => link.getAttribute('href'))).toEqual([
            buildSiteHref('/json-formatter/'),
            buildSiteHref('/jwt-builder/')
        ]);
    });

    it('renders nothing when the list is empty', () => {
        const root = renderRow({ tools: [] });

        expect(root.innerHTML).toBe('');
    });
});
