const path = require('path');

const jestEnvironmentPackage = require.resolve('jest-environment-jsdom/package.json');
const bundledJsdomPath = path.join(path.dirname(jestEnvironmentPackage), 'node_modules', 'jsdom');

module.exports = require(bundledJsdomPath);
