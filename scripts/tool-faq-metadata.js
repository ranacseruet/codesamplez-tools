// @ts-check

const path = require('path');
const { ensureBabelRegister } = require('./register-node-transforms');

/**
 * @typedef {{ question: string, structuredDataAnswer: string }} StructuredFaqItem
 */

/** @type {Record<string, () => StructuredFaqItem[]>} */
const TOOL_FAQ_REGISTRY = {
    'qr-code-generator': () => {
        ensureBabelRegister();
        const { FAQ_ITEMS } = require(path.resolve(__dirname, '../qr-code-generator/content'));
        return FAQ_ITEMS.map((item) => ({
            question: item.question,
            structuredDataAnswer: item.structuredDataAnswer
        }));
    },
    'text-analyzer-tool': () => {
        ensureBabelRegister();
        const { FAQ_ITEMS } = require(path.resolve(__dirname, '../text-analyzer/content'));
        return FAQ_ITEMS.map((item) => ({
            question: item.question,
            structuredDataAnswer: item.structuredDataAnswer
        }));
    }
};

/**
 * @param {string} toolId
 * @returns {StructuredFaqItem[]}
 */
function getToolFaqItems(toolId) {
    const loadFaqItems = TOOL_FAQ_REGISTRY[toolId];

    if (!loadFaqItems) {
        return [];
    }

    return loadFaqItems();
}

module.exports = {
    getToolFaqItems
};
