import { render } from 'preact';
import { RelatedToolsSection } from './RelatedTools';
import { buildSiteHref } from '../siteBaseUrl';

describe('RelatedToolsSection', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('renders a compact card list with headings, descriptions, and links', () => {
        const root = document.createElement('div');
        document.body.appendChild(root);

        render(
            <RelatedToolsSection
                tools={[
                    {
                        id: 'jwt-builder-tool',
                        title: 'JWT Builder',
                        description: 'Create and sign JWT tokens locally with standard and custom claims.',
                        publicPath: '/jwt-builder/'
                    },
                    {
                        id: 'base64-converter-tool',
                        title: 'Base64 Converter',
                        description: 'Convert text and files to and from Base64 with multiple encoding options.',
                        publicPath: '/base64-converter/'
                    }
                ]}
            />,
            root
        );

        expect(root.querySelector('#related-tools-heading')?.textContent).toBe('Related tools');
        expect(root.textContent).toContain('JWT Builder');
        expect(root.textContent).toContain('Base64 Converter');

        const links = Array.from(root.querySelectorAll('a.c-related-tools__cta'));
        expect(links.map((link) => link.getAttribute('href'))).toEqual([
            buildSiteHref('/jwt-builder/'),
            buildSiteHref('/base64-converter/')
        ]);
        expect(links.every((link) => link.textContent === 'Open tool')).toBe(true);
    });

    it('renders nothing when the list is empty', () => {
        const root = document.createElement('div');
        document.body.appendChild(root);

        render(<RelatedToolsSection tools={[]} />, root);

        expect(root.innerHTML).toBe('');
    });
});
