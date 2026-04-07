// @ts-check

const { escapeJsonForHtml } = require('./document-helpers');

/**
 * @typedef {import('./tool-manifest').ToolDefinition} ToolDefinition
 * @typedef {import('./tool-manifest').ToolManifest} ToolManifest
 * @typedef {{ question: string, structuredDataAnswer: string }} StructuredFaqItem
 */

/**
 * @param {unknown} value
 * @returns {unknown}
 */
function compactValue(value) {
    if (Array.isArray(value)) {
        const compactedArray = value
            .map((entry) => compactValue(entry))
            .filter((entry) => typeof entry !== 'undefined');

        return compactedArray.length > 0 ? compactedArray : undefined;
    }

    if (value && typeof value === 'object') {
        const compactedEntries = Object.entries(value)
            .map(([key, entry]) => [key, compactValue(entry)])
            .filter(([, entry]) => typeof entry !== 'undefined');

        if (compactedEntries.length === 0) {
            return undefined;
        }

        return Object.fromEntries(compactedEntries);
    }

    return typeof value === 'undefined' ? undefined : value;
}

/**
 * @param {ToolManifest} manifest
 * @returns {string}
 */
function getWebsiteId(manifest) {
    return `${manifest.siteBaseUrl}#website`;
}

/**
 * @param {ToolDefinition} tool
 * @returns {string}
 */
function getToolPageId(tool) {
    return `${tool.absolutePageUrl}#webpage`;
}

/**
 * @param {ToolDefinition} tool
 * @returns {string}
 */
function getToolAppId(tool) {
    return `${tool.absolutePageUrl}#webapplication`;
}

/**
 * @param {ToolDefinition} tool
 * @returns {string}
 */
function getToolBreadcrumbId(tool) {
    return `${tool.absolutePageUrl}#breadcrumb`;
}

/**
 * @param {ToolDefinition} tool
 * @returns {string}
 */
function getToolFaqPageId(tool) {
    return `${tool.absolutePageUrl}#faqpage`;
}

/**
 * @param {ToolManifest} manifest
 * @returns {Record<string, unknown>}
 */
function createWebsiteNode(manifest) {
    return {
        '@type': 'WebSite',
        '@id': getWebsiteId(manifest),
        name: manifest.siteName,
        description: manifest.siteDescription,
        url: `${manifest.siteBaseUrl}/`
    };
}

/**
 * @param {ToolDefinition} tool
 * @returns {Record<string, unknown>}
 */
function createToolApplicationNode(tool) {
    return {
        '@type': 'WebApplication',
        '@id': getToolAppId(tool),
        name: tool.title,
        description: tool.description,
        url: tool.absolutePageUrl,
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Any',
        browserRequirements: 'Requires JavaScript and a modern browser.',
        isAccessibleForFree: true,
        offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD'
        },
        image: tool.absoluteFeaturedImageUrl,
        softwareVersion: tool.version,
        keywords: tool.keywords.length > 0 ? tool.keywords.join(', ') : undefined
    };
}

/**
 * @param {ToolManifest} manifest
 * @param {ToolDefinition} tool
 * @returns {Record<string, unknown>}
 */
function createToolWebPageNode(manifest, tool) {
    return {
        '@type': 'WebPage',
        '@id': getToolPageId(tool),
        url: tool.absolutePageUrl,
        name: tool.title,
        description: tool.description,
        isPartOf: {
            '@id': getWebsiteId(manifest)
        },
        mainEntity: {
            '@id': getToolAppId(tool)
        },
        primaryImageOfPage: tool.absoluteFeaturedImageUrl,
        breadcrumb: {
            '@id': getToolBreadcrumbId(tool)
        }
    };
}

/**
 * @param {ToolManifest} manifest
 * @param {ToolDefinition} tool
 * @returns {Record<string, unknown>}
 */
function createToolBreadcrumbNode(manifest, tool) {
    return {
        '@type': 'BreadcrumbList',
        '@id': getToolBreadcrumbId(tool),
        itemListElement: [
            {
                '@type': 'ListItem',
                position: 1,
                name: manifest.rootPage.title,
                item: manifest.rootPage.absoluteUrl
            },
            {
                '@type': 'ListItem',
                position: 2,
                name: tool.title,
                item: tool.absolutePageUrl
            }
        ]
    };
}

/**
 * @param {ToolDefinition} tool
 * @param {StructuredFaqItem[]} faqItems
 * @returns {Record<string, unknown>}
 */
function createToolFaqPageNode(tool, faqItems) {
    return {
        '@type': 'FAQPage',
        '@id': getToolFaqPageId(tool),
        url: tool.absolutePageUrl,
        isPartOf: {
            '@id': getToolPageId(tool)
        },
        mainEntity: faqItems.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: {
                '@type': 'Answer',
                text: item.structuredDataAnswer
            }
        }))
    };
}

/**
 * @param {ToolManifest} manifest
 * @param {ToolDefinition} tool
 * @param {{ faqItems?: StructuredFaqItem[] }} [options]
 * @returns {Record<string, unknown>[]}
 */
function buildToolStructuredDataGraph(manifest, tool, options = {}) {
    const faqItems = Array.isArray(options.faqItems) ? options.faqItems : [];

    return [
        createWebsiteNode(manifest),
        createToolWebPageNode(manifest, tool),
        createToolApplicationNode(tool),
        createToolBreadcrumbNode(manifest, tool),
        ...(faqItems.length > 0 ? [createToolFaqPageNode(tool, faqItems)] : [])
    ];
}

/**
 * @param {ToolManifest} manifest
 * @returns {Record<string, unknown>[]}
 */
function buildRootStructuredDataGraph(manifest) {
    const itemListId = `${manifest.rootPage.absoluteUrl}#tool-list`;
    const groupedTools = manifest.catalogGroups.flatMap((group) => {
        return manifest.tools
            .filter((tool) => tool.catalogGroupId === group.id)
            .sort((left, right) => left.catalogOrder - right.catalogOrder || left.title.localeCompare(right.title));
    });

    return [
        createWebsiteNode(manifest),
        {
            '@type': 'CollectionPage',
            '@id': `${manifest.rootPage.absoluteUrl}#collectionpage`,
            url: manifest.rootPage.absoluteUrl,
            name: manifest.rootPage.title,
            description: manifest.rootPage.description,
            isPartOf: {
                '@id': getWebsiteId(manifest)
            },
            mainEntity: {
                '@id': itemListId
            }
        },
        {
            '@type': 'ItemList',
            '@id': itemListId,
            name: 'CodeSamplez tool directory',
            itemListOrder: 'https://schema.org/ItemListOrderAscending',
            numberOfItems: groupedTools.length,
            itemListElement: groupedTools.map((tool, index) => ({
                '@type': 'ListItem',
                position: index + 1,
                url: tool.absolutePageUrl,
                item: {
                    '@id': getToolAppId(tool)
                }
            }))
        },
        ...groupedTools.map((tool) => createToolApplicationNode(tool))
    ];
}

/**
 * @param {Record<string, unknown>[]} graphNodes
 * @returns {string}
 */
function renderStructuredDataScript(graphNodes) {
    const structuredData = compactValue({
        '@context': 'https://schema.org',
        '@graph': graphNodes
    });

    return `<script type="application/ld+json">${escapeJsonForHtml(JSON.stringify(structuredData))}</script>`;
}

module.exports = {
    buildRootStructuredDataGraph,
    buildToolStructuredDataGraph,
    renderStructuredDataScript
};
