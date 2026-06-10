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

    require('@babel/register')({
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
        ignore: [/node_modules/],
        babelrc: false,
        configFile: false,
        presets: [
            ['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }],
            ['@babel/preset-react', { runtime: 'automatic', importSource: 'preact' }],
            ['@babel/preset-typescript', { allowDeclareFields: true }]
        ]
    });

    babelRegistered = true;
}

module.exports = {
    ensureBabelRegister
};
