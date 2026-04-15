// @ts-check

const path = require('path');
const { ensureBabelRegister } = require('./register-node-transforms');

/**
 * @typedef {{ question: string, structuredDataAnswer: string }} StructuredFaqItem
 */

/** @type {Record<string, () => StructuredFaqItem[]>} */
const TOOL_FAQ_REGISTRY = {
    'css-minifier-tool': () => {
        ensureBabelRegister();
        const { FAQ_ITEMS } = require(path.resolve(__dirname, '../css-minifier/content'));
        return FAQ_ITEMS.map((item) => ({
            question: item.question,
            structuredDataAnswer: item.structuredDataAnswer
        }));
    },
    'data-format-converter': () => {
        ensureBabelRegister();
        const { FAQ_ITEMS } = require(path.resolve(__dirname, '../data-format-converter/content'));
        return FAQ_ITEMS.map((item) => ({
            question: item.question,
            structuredDataAnswer: item.structuredDataAnswer
        }));
    },
    'js-minifier-tool': () => {
        ensureBabelRegister();
        const { FAQ_ITEMS } = require(path.resolve(__dirname, '../js-minifier/content'));
        return FAQ_ITEMS.map((item) => ({
            question: item.question,
            structuredDataAnswer: item.structuredDataAnswer
        }));
    },
    'json-formatter-tool': () => {
        ensureBabelRegister();
        const { FAQ_ITEMS } = require(path.resolve(__dirname, '../json-formatter/content'));
        return FAQ_ITEMS.map((item) => ({
            question: item.question,
            structuredDataAnswer: item.structuredDataAnswer
        }));
    },
    'jwt-decoder-tool': () => {
        ensureBabelRegister();
        const { FAQ_ITEMS } = require(path.resolve(__dirname, '../jwt-decoder/content'));
        return FAQ_ITEMS.map((item) => ({
            question: item.question,
            structuredDataAnswer: item.structuredDataAnswer
        }));
    },
    'jwt-builder-tool': () => {
        ensureBabelRegister();
        const { FAQ_ITEMS } = require(path.resolve(__dirname, '../jwt-builder/content'));
        return FAQ_ITEMS.map((item) => ({
            question: item.question,
            structuredDataAnswer: item.structuredDataAnswer
        }));
    },
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
