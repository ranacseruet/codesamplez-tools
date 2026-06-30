// @ts-check

let babelRegistered = false;

/**
 * @returns {void}
 */
function ensureBabelRegister() {
    if (babelRegistered) {
        return;
    }

    if (process.env.JEST_WORKER_ID) {
        babelRegistered = true;
        return;
    }

    // @babel/register 8 ships as ESM, so the callable lives on `.default` under
    // CommonJS interop.
    const babelRegister = require('@babel/register').default;
    // Babel 8's @babel/register ships a narrow Options type (extensions only), but
    // still forwards the full transform options to @babel/core at runtime.
    const registerOptions = /** @type {any} */ ({
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
        ignore: [/node_modules/],
        babelrc: false,
        configFile: false,
        presets: [
            ['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }],
            ['@babel/preset-react', { runtime: 'automatic', importSource: 'preact' }],
            // Babel 8 always enables allowDeclareFields; the option was removed.
            '@babel/preset-typescript'
        ]
    });
    babelRegister(registerOptions);

    babelRegistered = true;
}

module.exports = {
    ensureBabelRegister
};
