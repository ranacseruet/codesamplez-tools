/**
 * Catalog group → v4 category accent slug, for client bundles (search chips,
 * palette rows, recent-tool pills).
 *
 * The build side keeps its own CommonJS copy in `scripts/tool-categories.js`
 * because the document generators cannot import this ESM module;
 * `scripts/tool-categories.test.js` fails if the two drift apart.
 */
export const GROUP_CATEGORY_SLUGS: Readonly<Record<string, string>> = {
    'code-formatters': 'formatters',
    'encoders-decoders': 'encoders',
    'text-analysis': 'text',
    'image-tools': 'media'
};

export const DEFAULT_CATEGORY_SLUG = 'formatters';

export function getGroupCategorySlug(groupId: string): string {
    return GROUP_CATEGORY_SLUGS[groupId] ?? DEFAULT_CATEGORY_SLUG;
}
