// @ts-check

const path = require('path');
const { ensureBabelRegister } = require('./register-node-transforms');

/** @type {Record<string, () => string[]>} */
const TOOL_FEATURE_REGISTRY = {
    'json-formatter-tool': () => {
        ensureBabelRegister();
        const { FEATURE_LIST } = require(path.resolve(__dirname, '../json-formatter/content'));
        return FEATURE_LIST;
    },
    'json-editor-tool': () => {
        ensureBabelRegister();
        const { FEATURE_LIST } = require(path.resolve(__dirname, '../json-editor/content'));
        return FEATURE_LIST;
    }
};

/**
 * @param {string} toolId
 * @returns {string[]}
 */
function getToolFeatureList(toolId) {
    const loadFeatureList = TOOL_FEATURE_REGISTRY[toolId];

    if (!loadFeatureList) {
        return [];
    }

    return loadFeatureList();
}

module.exports = {
    getToolFeatureList
};
