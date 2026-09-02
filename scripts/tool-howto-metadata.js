// @ts-check

const path = require('path');
const { ensureBabelRegister } = require('./register-node-transforms');

/**
 * @typedef {{ name: string, text: string }} StructuredHowToStep
 */

/** @type {Record<string, () => StructuredHowToStep[]>} */
const TOOL_HOWTO_REGISTRY = {
    'json-formatter-tool': () => {
        ensureBabelRegister();
        const { HOWTO_STEPS } = require(path.resolve(__dirname, '../json-formatter/content'));
        return HOWTO_STEPS.map((step) => ({
            name: step.name,
            text: step.text
        }));
    },
    'json-editor-tool': () => {
        ensureBabelRegister();
        const { HOWTO_STEPS } = require(path.resolve(__dirname, '../json-editor/content'));
        return HOWTO_STEPS.map((step) => ({
            name: step.name,
            text: step.text
        }));
    }
};

/**
 * @param {string} toolId
 * @returns {StructuredHowToStep[]}
 */
function getToolHowToSteps(toolId) {
    const loadHowToSteps = TOOL_HOWTO_REGISTRY[toolId];

    if (!loadHowToSteps) {
        return [];
    }

    return loadHowToSteps();
}

module.exports = {
    getToolHowToSteps
};
