// @ts-check

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const ROOT_CONFIG_PATH = path.resolve(REPO_ROOT, 'config/tooling-root.json');
const TOOL_METADATA_FILENAME = 'tool.meta.json';
const ADS_TXT_FILENAME = 'ads.txt';
const DEFAULT_FEATURED_IMAGE_DIRECTORY = 'images';
const DEFAULT_FEATURED_IMAGE_FILENAME = 'featured.png';
const DEFAULT_FEATURED_IMAGE_EXTENSION = '.png';
const DEFAULT_FEATURED_IMAGE_PATH = path.posix.join(DEFAULT_FEATURED_IMAGE_DIRECTORY, DEFAULT_FEATURED_IMAGE_FILENAME);
const SITE_BASE_URL_ENV_KEY = 'CST_SITE_BASE_URL';
const SITE_STATIC_ROOT_URI_ENV_KEY = 'CST_SITE_STATIC_ROOT_URI';
const GA_MEASUREMENT_ID_ENV_KEY = 'CST_GA_MEASUREMENT_ID';
const ADSENSE_CLIENT_ID_ENV_KEY = 'CST_ADSENSE_CLIENT_ID';
// Kill-switch: when set to a truthy value (1/true/yes), analytics injection is
// disabled even for production builds. Used by automated QA/agent runs that
// drive real browsers against production HTML so test traffic never reaches
// the live GA4/AdSense properties.
const ANALYTICS_DISABLED_ENV_KEY = 'CST_DISABLE_ANALYTICS';
// GA4 measurement IDs look like "G-XXXXXXXXXX"; AdSense client IDs like
// "ca-pub-1234567890123456". These are public values embedded in client HTML,
// so they live in config (with env overrides), not in secret storage.
const GA_MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]+$/;
const ADSENSE_CLIENT_ID_PATTERN = /^ca-pub-\d+$/;
const DEFAULT_DEVELOPMENT_SITE_ORIGIN = 'http://localhost:8081';

/**
 * @typedef {'module' | 'classic'} ToolScriptType
 */

/**
 * @typedef {{ includeFaq: boolean, includeHowTo: boolean }} ToolStructuredDataOptions
 */

/**
 * @typedef {{ id: string, label: string }} CatalogGroupDefinition
 * @typedef {{ title: string, description: string, absoluteUrl: string, staticRootUri: string, imageUrl: string }} RootPageDefinition
 * @typedef {{ name: string, url: string, logo: string, sameAs: string[] }} OrganizationDefinition
 * @typedef {{ id: string, outputPath: string }} RootShellDefinition
 * @typedef {{ googleAnalyticsId: string | null, adsenseClientId: string | null }} AnalyticsConfig
 * @typedef {{
 *   siteBaseUrl: string,
 *   siteStaticRootUri: string,
 *   siteName: string,
 *   siteDescription: string,
 *   organization: OrganizationDefinition,
 *   analytics: AnalyticsConfig,
 *   rootPage: RootPageDefinition,
 *   catalogGroups: CatalogGroupDefinition[],
 *   tools: ToolDefinition[],
 *   rootShell: RootShellDefinition,
 *   rootAssets: string[]
 * }} ToolManifest
 * @typedef {{ requestedTools: string[], includeRootShell: boolean, includeRootAssets: boolean }} ToolSelection
 * @typedef {{
 *   id: string,
 *   label: string,
 *   tools: ToolDefinition[]
 * }} GroupedToolDefinition
 * @typedef {{
 *   siteBaseUrl: string,
 *   siteStaticRootUri: string,
 *   siteName: string,
 *   siteDescription: string,
 *   id: string,
 *   version: string,
 *   sourceRoot: string,
 *   outputDir: string,
 *   outputPath: string,
 *   title: string,
 *   seoTitle: string,
 *   description: string,
 *   indexDescription: string,
 *   icon: string | null,
 *   status: 'live' | 'soon',
 *   keywords: string[],
 *   structuredData: ToolStructuredDataOptions,
 *   appRootId: string,
 *   publicPath: string,
 *   absolutePageUrl: string,
 *   scriptType: ToolScriptType,
 *   featuredImagePath: string,
 *   absoluteFeaturedImageUrl: string,
 *   catalogGroupId: string,
 *   catalogOrder: number,
 *   dependencyScopes: string[],
 *   relatedToolIds: string[]
 * }} ToolDefinition
 * @typedef {{
 *   siteBaseUrl: string,
 *   siteStaticRootUri?: string,
 *   siteName: string,
 *   siteDescription: string,
 *   organization: OrganizationDefinition,
 *   analytics: AnalyticsConfig,
 *   rootPage: {
 *     title: string,
 *     description: string,
 *     image: string
 *   },
 *   catalogGroups: CatalogGroupDefinition[],
 *   rootShell: RootShellDefinition,
 *   rootAssets: string[]
 * }} RootConfig
 * @typedef {{
 *   id: string,
 *   version: string,
 *   title: string,
 *   seoTitle: string | null,
 *   description: string,
 *   indexDescription: string,
 *   icon: string | null,
 *   status: 'live' | 'soon',
 *   keywords?: string[],
 *   structuredData?: { includeFaq?: boolean, includeHowTo?: boolean },
 *   catalogGroupId: string,
 *   catalogOrder: number,
 *   appRootId: string,
 *   publicPath: string,
 *   scriptType: ToolScriptType,
 *   dependencyScopes: string[],
 *   relatedToolIds: string[]
 * }} RawToolMetadata
 */

/**
 * @param {unknown} value
 * @param {string} label
 * @returns {string}
 */
function requireNonEmptyString(value, label) {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new Error(`${label} must be a non-empty string`);
    }

    return value.trim();
}

/**
 * @param {unknown} value
 * @param {string} label
 * @returns {string}
 */
function requireSemanticVersion(value, label) {
    const version = requireNonEmptyString(value, label);

    if (!/^\d+\.\d+\.\d+$/u.test(version)) {
        throw new Error(`${label} must be a semantic version (x.y.z), got: ${version}`);
    }

    return version;
}

/**
 * @param {unknown} value
 * @param {string} label
 * @returns {number}
 */
function requirePositiveInteger(value, label) {
    if (!Number.isInteger(value)) {
        throw new Error(`${label} must be a positive integer`);
    }

    const numericValue = /** @type {number} */ (value);

    if (numericValue <= 0) {
        throw new Error(`${label} must be a positive integer`);
    }

    return numericValue;
}

/**
 * @param {unknown} baseUrl
 * @returns {string}
 */
function normalizeBaseUrl(baseUrl) {
    const normalizedBaseUrl = requireNonEmptyString(baseUrl, 'Root siteBaseUrl').replace(/\/+$/, '');

    try {
        return new URL(normalizedBaseUrl).toString().replace(/\/+$/, '');
    } catch (error) {
        throw new Error(`Root siteBaseUrl must be a valid absolute URL: ${normalizedBaseUrl}`);
    }
}

/**
 * @returns {string}
 */
function getDevelopmentSiteBaseUrl() {
    const port = requireNonEmptyString(process.env.PORT || '8081', 'Development port');

    if (!/^\d+$/.test(port)) {
        throw new Error(`Development port must be numeric: ${port}`);
    }

    return normalizeBaseUrl(`${DEFAULT_DEVELOPMENT_SITE_ORIGIN.replace(/:\d+$/, '')}:${port}`);
}

/**
 * @param {unknown} configuredBaseUrl
 * @returns {string}
 */
function resolveSiteBaseUrl(configuredBaseUrl) {
    const configuredSiteBaseUrl = normalizeBaseUrl(configuredBaseUrl);
    const overriddenSiteBaseUrl = process.env[SITE_BASE_URL_ENV_KEY];

    if (typeof overriddenSiteBaseUrl === 'string' && overriddenSiteBaseUrl.trim().length > 0) {
        return normalizeBaseUrl(overriddenSiteBaseUrl);
    }

    return process.env.NODE_ENV === 'development'
        ? getDevelopmentSiteBaseUrl()
        : configuredSiteBaseUrl;
}

/**
 * @param {unknown} configuredStaticRootUri
 * @param {string} resolvedSiteBaseUrl
 * @returns {string}
 */
function resolveSiteStaticRootUri(configuredStaticRootUri, resolvedSiteBaseUrl) {
    const overriddenStaticRootUri = process.env[SITE_STATIC_ROOT_URI_ENV_KEY];

    if (typeof overriddenStaticRootUri === 'string' && overriddenStaticRootUri.trim().length > 0) {
        return normalizeBaseUrl(overriddenStaticRootUri);
    }

    // In development the local dev server emits every tool bundle, stylesheet,
    // font and image under the dev origin and serves them at `/`, so static
    // assets must resolve to that origin — not the configured production CDN.
    // Otherwise `npm run dev` would load production assets and local edits would
    // never appear. An explicit CST_SITE_STATIC_ROOT_URI override (handled above)
    // still takes precedence for the rare case a dev wants to point elsewhere.
    if (process.env.NODE_ENV === 'development') {
        return resolvedSiteBaseUrl;
    }

    if (typeof configuredStaticRootUri !== 'undefined') {
        const normalizedStaticRootUri = requireNonEmptyString(configuredStaticRootUri, 'Root siteStaticRootUri');

        try {
            return new URL(normalizedStaticRootUri).toString().replace(/\/+$/, '');
        } catch (error) {
            throw new Error(`Root siteStaticRootUri must be a valid absolute URL: ${normalizedStaticRootUri}`);
        }
    }

    return resolvedSiteBaseUrl;
}

/**
 * Resolve a single analytics id with env override + format validation.
 * @param {unknown} configuredValue
 * @param {string | undefined} overrideValue
 * @param {RegExp} pattern
 * @param {string} label
 * @returns {string | null}
 */
function resolveAnalyticsId(configuredValue, overrideValue, pattern, label) {
    const rawValue = typeof overrideValue === 'string' && overrideValue.trim().length > 0
        ? overrideValue
        : configuredValue;

    if (typeof rawValue !== 'string' || rawValue.trim().length === 0) {
        return null;
    }

    const normalizedValue = rawValue.trim();
    if (!pattern.test(normalizedValue)) {
        throw new Error(`${label} must match ${pattern}`);
    }

    return normalizedValue;
}

/**
 * @param {string | undefined} value
 * @returns {boolean}
 */
function isTruthyEnvValue(value) {
    if (typeof value !== 'string') {
        return false;
    }

    return ['1', 'true', 'yes'].includes(value.trim().toLowerCase());
}

/**
 * Whether analytics/ads injection is enabled for this build. Fail-closed:
 * only production builds inject trackers; anything else (development, test,
 * CI, staging, unset) stays tracker-free. The CST_DISABLE_ANALYTICS
 * kill-switch forces disabled even for production builds.
 * @returns {boolean}
 */
function isAnalyticsEnabled() {
    if (isTruthyEnvValue(process.env[ANALYTICS_DISABLED_ENV_KEY])) {
        return false;
    }

    return process.env.NODE_ENV === 'production';
}

/**
 * Resolve the analytics/ads configuration. Env overrides win over config.
 *
 * Injection is fail-closed: analytics is enabled ONLY for production builds
 * (`NODE_ENV=production`). Every other environment — development, test, CI,
 * staging, or an unset/empty NODE_ENV (bare `webpack serve`, IDE launchers,
 * Windows shells without `VAR=val` prefix support) — resolves to null ids so
 * local builds stay tracker-free. This mirrors the NODE_ENV gate used by
 * resolveSiteBaseUrl, but inverted: instead of denylisting development, it
 * allowlists production, so any new/unset environment value fails safe.
 *
 * The CST_DISABLE_ANALYTICS kill-switch (truthy: 1/true/yes) disables
 * injection even for production builds, for automated browser runs against
 * production HTML.
 * @param {unknown} configuredAnalytics
 * @returns {AnalyticsConfig}
 */
function resolveAnalyticsConfig(configuredAnalytics) {
    if (!isAnalyticsEnabled()) {
        return { googleAnalyticsId: null, adsenseClientId: null };
    }

    const analyticsRecord = configuredAnalytics && typeof configuredAnalytics === 'object'
        ? /** @type {Record<string, unknown>} */ (configuredAnalytics)
        : {};

    return {
        googleAnalyticsId: resolveAnalyticsId(
            analyticsRecord.googleAnalyticsId,
            process.env[GA_MEASUREMENT_ID_ENV_KEY],
            GA_MEASUREMENT_ID_PATTERN,
            'Root analytics.googleAnalyticsId'
        ),
        adsenseClientId: resolveAnalyticsId(
            analyticsRecord.adsenseClientId,
            process.env[ADSENSE_CLIENT_ID_ENV_KEY],
            ADSENSE_CLIENT_ID_PATTERN,
            'Root analytics.adsenseClientId'
        )
    };
}

/**
 * Publisher entity used for schema.org Organization markup. Required so every
 * page can declare a consistent publisher (name, logo, social profiles).
 * @param {unknown} configuredOrganization
 * @returns {OrganizationDefinition}
 */
function resolveOrganization(configuredOrganization) {
    if (!configuredOrganization || typeof configuredOrganization !== 'object') {
        throw new Error('Root organization must be an object');
    }

    const organizationRecord = /** @type {Record<string, unknown>} */ (configuredOrganization);

    return {
        name: requireNonEmptyString(organizationRecord.name, 'Root organization.name'),
        url: requireNonEmptyString(organizationRecord.url, 'Root organization.url'),
        logo: requireNonEmptyString(organizationRecord.logo, 'Root organization.logo'),
        sameAs: normalizeStringArray(organizationRecord.sameAs, 'Root organization.sameAs')
    };
}

/**
 * @param {string} baseUrl
 * @param {string} pathName
 * @returns {string}
 */
function buildAbsoluteUrl(baseUrl, pathName) {
    return new URL(pathName.replace(/^\.\//, '').replace(/^\/+/, ''), `${baseUrl}/`).toString();
}

/**
 * @param {unknown} value
 * @param {string} label
 * @returns {string[]}
 */
function normalizeStringArray(value, label) {
    if (!Array.isArray(value)) {
        throw new Error(`${label} must be an array`);
    }

    return value.map((entry, index) => requireNonEmptyString(entry, `${label}[${index}]`));
}

/**
 * Optional single string; returns null when absent. Used for presentation-only
 * metadata such as the landing-card Lucide icon name.
 * @param {unknown} value
 * @param {string} label
 * @returns {string | null}
 */
function normalizeOptionalString(value, label) {
    if (typeof value === 'undefined' || value === null) {
        return null;
    }
    return requireNonEmptyString(value, label);
}

/**
 * Tool launch status shown as a landing-card badge. Defaults to "live".
 * @param {unknown} value
 * @returns {'live' | 'soon'}
 */
function normalizeToolStatus(value) {
    if (typeof value === 'undefined' || value === null) {
        return 'live';
    }
    if (value !== 'live' && value !== 'soon') {
        throw new Error('Tool status must be "live" or "soon"');
    }
    return value;
}

/**
 * @param {unknown} value
 * @param {string} label
 * @param {boolean} fallback
 * @returns {boolean}
 */
function normalizeOptionalBoolean(value, label, fallback) {
    if (typeof value === 'undefined') {
        return fallback;
    }

    if (typeof value !== 'boolean') {
        throw new Error(`${label} must be a boolean`);
    }

    return value;
}

/**
 * FAQ and HowTo structured data are enabled by default so existing tools keep
 * their current generated graph. A tool can explicitly opt out of either
 * content type when the markup is useful on-page but no longer belongs in its
 * search-structured-data graph.
 * @param {unknown} value
 * @returns {ToolStructuredDataOptions}
 */
function normalizeStructuredDataOptions(value) {
    if (typeof value === 'undefined') {
        return { includeFaq: true, includeHowTo: true };
    }

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Tool structuredData must be an object');
    }

    const structuredDataRecord = /** @type {Record<string, unknown>} */ (value);
    return {
        includeFaq: normalizeOptionalBoolean(structuredDataRecord.includeFaq, 'Tool structuredData.includeFaq', true),
        includeHowTo: normalizeOptionalBoolean(structuredDataRecord.includeHowTo, 'Tool structuredData.includeHowTo', true)
    };
}

/**
 * @param {unknown} value
 * @param {string} label
 * @returns {string[]}
 */
function normalizeOptionalStringArray(value, label) {
    if (typeof value === 'undefined') {
        return [];
    }

    const normalizedValues = normalizeStringArray(value, label);
    const seenValues = new Set();

    normalizedValues.forEach((entry) => {
        if (seenValues.has(entry)) {
            throw new Error(`${label} contains a duplicate value: ${entry}`);
        }
        seenValues.add(entry);
    });

    return normalizedValues;
}

/**
 * Root config parsed once for the current build pass, or null outside one.
 * `loadRootConfig()` is called per tool and by every getter, so a manifest
 * build would otherwise re-read and re-validate the file ~20 times. The cache
 * is scoped to a pass (see `withRootConfigPass`) rather than the process so
 * watch-mode edits to the config file and env overrides still take effect.
 * @type {{ config: RootConfig | null } | null}
 */
let rootConfigPass = null;

/**
 * Runs `task` with root config reads memoized for its duration. Nested calls
 * join the outer pass.
 * @template T
 * @param {() => T} task
 * @returns {T}
 */
function withRootConfigPass(task) {
    if (rootConfigPass) {
        return task();
    }

    rootConfigPass = { config: null };
    try {
        return task();
    } finally {
        rootConfigPass = null;
    }
}

/**
 * @returns {RootConfig}
 */
function loadRootConfig() {
    if (!rootConfigPass) {
        return readRootConfig();
    }

    if (!rootConfigPass.config) {
        rootConfigPass.config = readRootConfig();
    }

    return rootConfigPass.config;
}

/**
 * @returns {RootConfig}
 */
function readRootConfig() {
    /** @type {unknown} */
    const rawRootConfig = JSON.parse(fs.readFileSync(ROOT_CONFIG_PATH, 'utf8'));
    if (!rawRootConfig || typeof rawRootConfig !== 'object') {
        throw new Error('Root config must be an object');
    }

    const parsedRootConfig = /** @type {Record<string, unknown>} */ (rawRootConfig);
    const siteBaseUrl = resolveSiteBaseUrl(parsedRootConfig.siteBaseUrl);
    const siteStaticRootUri = resolveSiteStaticRootUri(parsedRootConfig.siteStaticRootUri, siteBaseUrl);
    const siteName = requireNonEmptyString(parsedRootConfig.siteName, 'Root siteName');
    const siteDescription = requireNonEmptyString(parsedRootConfig.siteDescription, 'Root siteDescription');
    const rootPage = parsedRootConfig.rootPage;
    const rootShell = parsedRootConfig.rootShell;

    if (!rootPage || typeof rootPage !== 'object') {
        throw new Error('Root rootPage must be an object');
    }

    if (!rootShell || typeof rootShell !== 'object') {
        throw new Error('Root rootShell must be an object');
    }

    const catalogGroups = Array.isArray(parsedRootConfig.catalogGroups) ? parsedRootConfig.catalogGroups : null;
    if (!catalogGroups || catalogGroups.length === 0) {
        throw new Error('Root catalogGroups must be a non-empty array');
    }

    const seenCatalogGroupIds = new Set();
    const normalizedCatalogGroups = catalogGroups.map((group, index) => {
        if (!group || typeof group !== 'object') {
            throw new Error(`Root catalogGroups[${index}] must be an object`);
        }

        const groupRecord = /** @type {Record<string, unknown>} */ (group);
        const groupId = requireNonEmptyString(groupRecord.id, `Root catalogGroups[${index}].id`);
        const groupLabel = requireNonEmptyString(groupRecord.label, `Root catalogGroups[${index}].label`);

        if (seenCatalogGroupIds.has(groupId)) {
            throw new Error(`Duplicate catalog group id detected: ${groupId}`);
        }
        seenCatalogGroupIds.add(groupId);

        return {
            id: groupId,
            label: groupLabel
        };
    });

    return {
        siteBaseUrl,
        siteStaticRootUri,
        siteName,
        siteDescription,
        organization: resolveOrganization(parsedRootConfig.organization),
        analytics: resolveAnalyticsConfig(parsedRootConfig.analytics),
        rootPage: {
            title: requireNonEmptyString((/** @type {Record<string, unknown>} */ (rootPage)).title, 'Root rootPage.title'),
            description: requireNonEmptyString((/** @type {Record<string, unknown>} */ (rootPage)).description, 'Root rootPage.description'),
            image: requireNonEmptyString((/** @type {Record<string, unknown>} */ (rootPage)).image, 'Root rootPage.image')
        },
        catalogGroups: normalizedCatalogGroups,
        rootShell: {
            id: requireNonEmptyString((/** @type {Record<string, unknown>} */ (rootShell)).id, 'Root rootShell.id'),
            outputPath: requireNonEmptyString((/** @type {Record<string, unknown>} */ (rootShell)).outputPath, 'Root rootShell.outputPath')
        },
        rootAssets: normalizeStringArray(parsedRootConfig.rootAssets, 'Root rootAssets')
    };
}

/**
 * @returns {string[]}
 */
function listToolMetadataPaths() {
    return fs.readdirSync(REPO_ROOT, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.resolve(REPO_ROOT, entry.name, TOOL_METADATA_FILENAME))
        .filter((metaPath) => fs.existsSync(metaPath))
        .sort();
}

/**
 * @param {string} metadataPath
 * @returns {RawToolMetadata}
 */
function readToolMetadata(metadataPath) {
    /** @type {unknown} */
    const rawMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    if (!rawMetadata || typeof rawMetadata !== 'object') {
        throw new Error(`Tool metadata at ${metadataPath} must be an object`);
    }

    const metadataRecord = /** @type {Record<string, unknown>} */ (rawMetadata);

    return {
        id: requireNonEmptyString(metadataRecord.id, 'Tool id'),
        version: requireSemanticVersion(metadataRecord.version, 'Tool version'),
        title: requireNonEmptyString(metadataRecord.title, 'Tool title'),
        seoTitle: normalizeOptionalString(metadataRecord.seoTitle, 'Tool seoTitle'),
        description: requireNonEmptyString(metadataRecord.description, 'Tool description'),
        indexDescription: requireNonEmptyString(metadataRecord.indexDescription, 'Tool indexDescription'),
        icon: normalizeOptionalString(metadataRecord.icon, 'Tool icon'),
        status: normalizeToolStatus(metadataRecord.status),
        keywords: normalizeOptionalStringArray(metadataRecord.keywords, 'Tool keywords'),
        structuredData: normalizeStructuredDataOptions(metadataRecord.structuredData),
        catalogGroupId: requireNonEmptyString(metadataRecord.catalogGroupId, 'Tool catalogGroupId'),
        catalogOrder: requirePositiveInteger(metadataRecord.catalogOrder, 'Tool catalogOrder'),
        appRootId: requireNonEmptyString(metadataRecord.appRootId, 'Tool appRootId'),
        publicPath: requireNonEmptyString(metadataRecord.publicPath, 'Tool publicPath'),
        scriptType: /** @type {ToolScriptType} */ (requireNonEmptyString(metadataRecord.scriptType, 'Tool scriptType')),
        dependencyScopes: normalizeStringArray(metadataRecord.dependencyScopes, 'Tool dependencyScopes'),
        relatedToolIds: normalizeStringArray(metadataRecord.relatedToolIds, 'Tool relatedToolIds')
    };
}

/**
 * @param {string} publicPath
 * @returns {string}
 */
function normalizePublicPath(publicPath) {
    if (typeof publicPath !== 'string') {
        throw new Error('Tool publicPath must be a string');
    }

    const trimmedPath = publicPath.trim().replace(/^\/+|\/+$/g, '');
    if (!trimmedPath) {
        throw new Error('Tool publicPath must contain a non-root path segment');
    }

    return `/${trimmedPath}/`;
}

/**
 * @param {string} publicPath
 * @returns {string}
 */
function getOutputDirFromPublicPath(publicPath) {
    return normalizePublicPath(publicPath).slice(1, -1);
}

/**
 * @param {string} metadataPath
 * @returns {ToolDefinition}
 */
function createToolDefinition(metadataPath) {
    const sourceRoot = path.basename(path.dirname(metadataPath));
    const metadata = readToolMetadata(metadataPath);
    const rootConfig = loadRootConfig();
    const publicPath = normalizePublicPath(metadata.publicPath);
    const outputDir = getOutputDirFromPublicPath(publicPath);
    const absolutePageUrl = buildAbsoluteUrl(rootConfig.siteBaseUrl, publicPath);
    const absoluteFeaturedImageUrl = buildAbsoluteUrl(rootConfig.siteStaticRootUri, `${publicPath.replace(/^\//, '')}${DEFAULT_FEATURED_IMAGE_PATH}`);

    if (metadata.scriptType !== 'module' && metadata.scriptType !== 'classic') {
        throw new Error(`Tool ${metadata.id} scriptType must be "module" or "classic"`);
    }

    return {
        siteBaseUrl: rootConfig.siteBaseUrl,
        siteStaticRootUri: rootConfig.siteStaticRootUri,
        siteName: rootConfig.siteName,
        siteDescription: rootConfig.siteDescription,
        id: metadata.id,
        version: metadata.version,
        sourceRoot,
        outputDir,
        outputPath: path.join('build', outputDir),
        title: metadata.title,
        // SEO `<title>` override; falls back to the plain tool name when unset so
        // the visible H1/og:title and structured-data names stay untouched.
        seoTitle: metadata.seoTitle || metadata.title,
        description: metadata.description,
        indexDescription: metadata.indexDescription,
        icon: metadata.icon,
        status: metadata.status,
        keywords: metadata.keywords || [],
        structuredData: normalizeStructuredDataOptions(metadata.structuredData),
        appRootId: metadata.appRootId,
        publicPath,
        absolutePageUrl,
        scriptType: metadata.scriptType,
        featuredImagePath: DEFAULT_FEATURED_IMAGE_PATH,
        absoluteFeaturedImageUrl,
        catalogGroupId: metadata.catalogGroupId,
        catalogOrder: metadata.catalogOrder,
        dependencyScopes: metadata.dependencyScopes.slice(),
        relatedToolIds: metadata.relatedToolIds.slice()
    };
}

/**
 * @param {ToolDefinition[]} toolDefinitions
 * @param {CatalogGroupDefinition[]} [catalogGroups]
 * @returns {ToolDefinition[]}
 */
function validateToolDefinitions(toolDefinitions, catalogGroups = loadRootConfig().catalogGroups) {
    const knownToolIds = new Set(toolDefinitions.map((tool) => tool.id));
    const knownPublicPaths = new Map();
    const knownOutputDirs = new Map();
    const knownCatalogGroups = new Set(catalogGroups.map((group) => group.id));
    const seenCatalogOrdersByGroup = new Map();

    toolDefinitions.forEach((tool) => {
        if (knownPublicPaths.has(tool.publicPath)) {
            throw new Error(`Duplicate tool publicPath detected for ${tool.id}: ${tool.publicPath}`);
        }

        if (knownOutputDirs.has(tool.outputDir)) {
            throw new Error(`Duplicate tool outputDir detected for ${tool.id}: ${tool.outputDir}`);
        }

        knownPublicPaths.set(tool.publicPath, tool.id);
        knownOutputDirs.set(tool.outputDir, tool.id);

        if (!knownCatalogGroups.has(tool.catalogGroupId)) {
            throw new Error(`Tool ${tool.id} references an unknown catalog group id: ${tool.catalogGroupId}`);
        }

        const catalogOrdersForGroup = seenCatalogOrdersByGroup.get(tool.catalogGroupId) || new Map();
        if (catalogOrdersForGroup.has(tool.catalogOrder)) {
            throw new Error(`Duplicate catalogOrder ${tool.catalogOrder} detected for catalog group ${tool.catalogGroupId}`);
        }
        catalogOrdersForGroup.set(tool.catalogOrder, tool.id);
        seenCatalogOrdersByGroup.set(tool.catalogGroupId, catalogOrdersForGroup);

        if (!Array.isArray(tool.relatedToolIds)) {
            throw new Error(`Tool ${tool.id} must define relatedToolIds as an array`);
        }

        if (!Array.isArray(tool.keywords)) {
            throw new Error(`Tool ${tool.id} must define keywords as an array`);
        }

        const seenKeywords = new Set();
        tool.keywords.forEach((keyword) => {
            if (typeof keyword !== 'string' || keyword.length === 0) {
                throw new Error(`Tool ${tool.id} contains an invalid keyword`);
            }

            if (seenKeywords.has(keyword)) {
                throw new Error(`Tool ${tool.id} contains a duplicate keyword: ${keyword}`);
            }

            seenKeywords.add(keyword);
        });

        const seenRelatedToolIds = new Set();
        tool.relatedToolIds.forEach((relatedToolId) => {
            if (typeof relatedToolId !== 'string' || relatedToolId.length === 0) {
                throw new Error(`Tool ${tool.id} contains an invalid related tool id`);
            }

            if (relatedToolId === tool.id) {
                throw new Error(`Tool ${tool.id} cannot reference itself in relatedToolIds`);
            }

            if (seenRelatedToolIds.has(relatedToolId)) {
                throw new Error(`Tool ${tool.id} contains a duplicate related tool id: ${relatedToolId}`);
            }

            if (!knownToolIds.has(relatedToolId)) {
                throw new Error(`Tool ${tool.id} references an unknown related tool id: ${relatedToolId}`);
            }

            seenRelatedToolIds.add(relatedToolId);
        });
    });

    return toolDefinitions;
}

/**
 * @returns {ToolDefinition[]}
 */
function getToolDefinitions() {
    return withRootConfigPass(() => validateToolDefinitions(
        listToolMetadataPaths().map((metadataPath) => createToolDefinition(metadataPath))
    ));
}

/**
 * @returns {CatalogGroupDefinition[]}
 */
function getCatalogGroups() {
    return loadRootConfig().catalogGroups.slice();
}

/**
 * @returns {GroupedToolDefinition[]}
 */
function getGroupedToolDefinitions() {
    const catalogGroups = getCatalogGroups();
    const tools = getToolDefinitions();

    return catalogGroups.map((group) => ({
        id: group.id,
        label: group.label,
        tools: tools
            .filter((tool) => tool.catalogGroupId === group.id)
            .sort((left, right) => left.catalogOrder - right.catalogOrder || left.title.localeCompare(right.title))
    }));
}

/**
 * @returns {RootPageDefinition}
 */
function getRootPageDefinition() {
    const rootConfig = loadRootConfig();
    return {
        title: rootConfig.rootPage.title,
        description: rootConfig.rootPage.description,
        absoluteUrl: `${rootConfig.siteBaseUrl}/`,
        staticRootUri: `${rootConfig.siteStaticRootUri}/`,
        imageUrl: buildAbsoluteUrl(rootConfig.siteStaticRootUri, rootConfig.rootPage.image)
    };
}

/**
 * @returns {ToolManifest}
 */
function loadManifest() {
    const rootConfig = loadRootConfig();
    return {
        siteBaseUrl: rootConfig.siteBaseUrl,
        siteStaticRootUri: rootConfig.siteStaticRootUri,
        siteName: rootConfig.siteName,
        siteDescription: rootConfig.siteDescription,
        organization: rootConfig.organization,
        analytics: rootConfig.analytics,
        rootPage: getRootPageDefinition(),
        catalogGroups: rootConfig.catalogGroups.slice(),
        tools: getToolDefinitions(),
        rootShell: rootConfig.rootShell,
        rootAssets: rootConfig.rootAssets.slice()
    };
}

/**
 * @returns {string[]}
 */
function getToolIds() {
    return getToolDefinitions().map((tool) => tool.id);
}

/**
 * @param {string} toolId
 * @returns {ToolDefinition | undefined}
 */
function getToolById(toolId) {
    return getToolDefinitions().find((tool) => tool.id === toolId);
}

/**
 * @param {string} outputDir
 * @returns {ToolDefinition | undefined}
 */
function getToolByOutputDir(outputDir) {
    return getToolDefinitions().find((tool) => tool.outputDir === outputDir);
}

/**
 * @param {string} toolId
 * @returns {ToolDefinition[]}
 */
function getRelatedTools(toolId) {
    const toolDefinitions = getToolDefinitions();
    const tool = toolDefinitions.find((candidate) => candidate.id === toolId);
    if (!tool) {
        throw new Error(`Unknown tool id: ${toolId}`);
    }

    const toolById = new Map(toolDefinitions.map((candidate) => [candidate.id, candidate]));
    return tool.relatedToolIds.map((relatedToolId) => {
        const relatedTool = toolById.get(relatedToolId);
        if (!relatedTool) {
            throw new Error(`Tool ${toolId} references an unknown related tool id: ${relatedToolId}`);
        }

        return relatedTool;
    });
}

/**
 * @param {string} toolId
 * @returns {string}
 */
function getToolMetadataPath(toolId) {
    const tool = getToolById(toolId);
    if (!tool) {
        throw new Error(`Unknown tool id: ${toolId}`);
    }

    return path.resolve(REPO_ROOT, tool.sourceRoot, TOOL_METADATA_FILENAME);
}

/**
 * @returns {RootShellDefinition}
 */
function getRootShellDefinition() {
    return loadManifest().rootShell;
}

/**
 * @returns {string}
 */
function getSiteBaseUrl() {
    return loadRootConfig().siteBaseUrl;
}

/**
 * @returns {string}
 */
function getSiteStaticRootUri() {
    return loadRootConfig().siteStaticRootUri;
}

/**
 * @returns {string}
 */
function getSiteName() {
    return loadRootConfig().siteName;
}

/**
 * @returns {string}
 */
function getSiteDescription() {
    return loadRootConfig().siteDescription;
}

/**
 * @returns {AnalyticsConfig}
 */
function getAnalyticsConfig() {
    return loadRootConfig().analytics;
}

/**
 * @returns {string | null}
 */
function getGoogleAnalyticsId() {
    return getAnalyticsConfig().googleAnalyticsId;
}

/**
 * @returns {string | null}
 */
function getAdsenseClientId() {
    return getAnalyticsConfig().adsenseClientId;
}

/**
 * Root assets deployed to the site root. `ads.txt` is appended only when AdSense
 * is configured, because it is generated (not copied from source) and only then
 * does the build emit it — keeping generation, listing, and deploy in lockstep.
 * @returns {string[]}
 */
function getRootAssets() {
    const rootConfig = loadRootConfig();
    const rootAssets = rootConfig.rootAssets.slice();

    if (rootConfig.analytics.adsenseClientId && !rootAssets.includes(ADS_TXT_FILENAME)) {
        rootAssets.push(ADS_TXT_FILENAME);
    }

    return rootAssets;
}

/**
 * @param {string | undefined} value
 * @returns {string[]}
 */
function splitCsv(value) {
    if (!value) {
        return [];
    }

    return value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
}

/**
 * @param {string[]} toolIds
 * @returns {string[]}
 */
function dedupeToolIds(toolIds) {
    return Array.from(new Set(toolIds));
}

/**
 * @param {string[]} requestedTools
 * @returns {string[]}
 */
function assertValidToolIds(requestedTools) {
    const knownTools = new Set(getToolIds());
    const invalidTools = requestedTools.filter((tool) => !knownTools.has(tool));

    if (invalidTools.length > 0) {
        throw new Error(`Unknown tool id(s): ${invalidTools.join(', ')}`);
    }

    return requestedTools;
}

/**
 * @param {string[]} argv
 * @returns {ToolSelection}
 */
function parseToolSelectionArgs(argv) {
    /** @type {ToolSelection} */
    const selection = {
        requestedTools: [],
        includeRootShell: false,
        includeRootAssets: false
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];

        if (arg === '--tool') {
            selection.requestedTools.push(argv[index + 1] || '');
            index += 1;
            continue;
        }

        if (arg === '--tools') {
            selection.requestedTools.push(...splitCsv(argv[index + 1]));
            index += 1;
            continue;
        }

        if (arg === '--include-root-shell') {
            selection.includeRootShell = true;
            continue;
        }

        if (arg === '--include-root-assets') {
            selection.includeRootAssets = true;
            continue;
        }
    }

    selection.requestedTools = assertValidToolIds(dedupeToolIds(selection.requestedTools));
    return selection;
}

/**
 * @param {ToolSelection} selection
 * @returns {ToolSelection}
 */
function normalizeSelection(selection) {
    return {
        requestedTools: selection.requestedTools.length > 0 ? selection.requestedTools : getToolIds(),
        includeRootShell: selection.includeRootShell,
        includeRootAssets: selection.includeRootAssets
    };
}

/**
 * @param {string[]} requestedTools
 * @returns {ToolDefinition[]}
 */
function selectTools(requestedTools) {
    const requestedSet = new Set(assertValidToolIds(dedupeToolIds(requestedTools)));
    return getToolDefinitions().filter((tool) => requestedSet.has(tool.id));
}

module.exports = {
    withRootConfigPass,
    ADS_TXT_FILENAME,
    DEFAULT_FEATURED_IMAGE_DIRECTORY,
    DEFAULT_FEATURED_IMAGE_EXTENSION,
    DEFAULT_FEATURED_IMAGE_FILENAME,
    DEFAULT_FEATURED_IMAGE_PATH,
    ROOT_CONFIG_PATH,
    REPO_ROOT,
    TOOL_METADATA_FILENAME,
    assertValidToolIds,
    buildAbsoluteUrl,
    dedupeToolIds,
    getAdsenseClientId,
    getAnalyticsConfig,
    getGoogleAnalyticsId,
    getCatalogGroups,
    getGroupedToolDefinitions,
    getRootAssets,
    getRelatedTools,
    getRootPageDefinition,
    getRootShellDefinition,
    getSiteBaseUrl,
    getSiteStaticRootUri,
    getSiteDescription,
    getSiteName,
    getDevelopmentSiteBaseUrl,
    getToolById,
    getToolByOutputDir,
    getToolDefinitions,
    getToolIds,
    getToolMetadataPath,
    getOutputDirFromPublicPath,
    isAnalyticsEnabled,
    loadManifest,
    loadRootConfig,
    normalizeSelection,
    normalizePublicPath,
    parseToolSelectionArgs,
    resolveAnalyticsConfig,
    resolveSiteBaseUrl,
    resolveSiteStaticRootUri,
    selectTools,
    splitCsv,
    validateToolDefinitions
};
