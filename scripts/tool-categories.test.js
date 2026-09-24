/** @jest-environment node */

const { DEFAULT_CATEGORY_SLUG, GROUP_CATEGORY_SLUGS, getGroupCategorySlug } = require('./tool-categories');
const { getCatalogGroups } = require('./tool-manifest');

describe('tool category slugs', () => {
    it('maps every catalog group the manifest declares', () => {
        // A group with no slug would silently fall back to the formatters hue,
        // so the accent would be wrong rather than obviously missing.
        getCatalogGroups().forEach((group) => {
            expect(GROUP_CATEGORY_SLUGS[group.id]).toBeDefined();
            expect(getGroupCategorySlug(group.id)).toBe(GROUP_CATEGORY_SLUGS[group.id]);
        });
    });

    it('falls back to the default slug for an unknown group', () => {
        expect(getGroupCategorySlug('not-a-real-group')).toBe(DEFAULT_CATEGORY_SLUG);
    });

    it('matches the client-bundle copy in common/app-shell/categorySlugs.ts', () => {
        const clientSlugs = require('../common/app-shell/categorySlugs');
        expect(clientSlugs.GROUP_CATEGORY_SLUGS).toEqual(GROUP_CATEGORY_SLUGS);
        expect(clientSlugs.DEFAULT_CATEGORY_SLUG).toBe(DEFAULT_CATEGORY_SLUG);
    });
});
