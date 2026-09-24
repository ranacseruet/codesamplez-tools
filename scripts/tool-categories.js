// @ts-check
/**
 * Catalog group → v4 category accent slug.
 *
 * The slug drives the category hues used by the landing cards, the search
 * chips, the section markers and the related-tools cards. Extracted here so the
 * build side has one copy rather than one per generator.
 *
 * Client bundles (ToolSearch, RecentTools) import the ESM twin in
 * `common/app-shell/categorySlugs.ts`, since they cannot require a CommonJS
 * module. `tool-categories.test.js` fails if the two copies drift apart.
 */

const GROUP_CATEGORY_SLUGS = {
    'code-formatters': 'formatters',
    'encoders-decoders': 'encoders',
    'text-analysis': 'text',
    'image-tools': 'media'
};

const DEFAULT_CATEGORY_SLUG = 'formatters';

/**
 * @param {string} groupId
 * @returns {string}
 */
function getGroupCategorySlug(groupId) {
    return GROUP_CATEGORY_SLUGS[groupId] || DEFAULT_CATEGORY_SLUG;
}

module.exports = {
    DEFAULT_CATEGORY_SLUG,
    GROUP_CATEGORY_SLUGS,
    getGroupCategorySlug
};
