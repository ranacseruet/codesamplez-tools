// @ts-check
/**
 * Catalog group → v4 category accent slug.
 *
 * The slug drives the category hues used by the landing cards, the search
 * chips, the section markers and the related-tools cards. Extracted here so the
 * build side has one copy rather than one per generator.
 *
 * Two client-side copies still exist, in `common/app-shell/ToolSearch.tsx` and
 * `common/app-shell/RecentTools.tsx`, because those run in tool bundles and
 * cannot require a CommonJS module. Keep all three in sync.
 */

const GROUP_CATEGORY_SLUGS = {
    'code-formatters': 'formatters',
    'encoders-decoders': 'encoders',
    'text-analysis': 'text'
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
