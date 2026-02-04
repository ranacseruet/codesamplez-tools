const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

// Configuration
const BUILD_DIR = path.resolve(__dirname, '../build');
const IGNORE_DIRS = ['assets', 'common'];

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m'
};

console.log(`${colors.cyan}Starting Build Verification...${colors.reset}`);

if (!fs.existsSync(BUILD_DIR)) {
    console.error(`${colors.red}Build directory not found at ${BUILD_DIR}. Run 'npm run build' first.${colors.reset}`);
    process.exit(1);
}

// Find all tool directories in build
const tools = fs.readdirSync(BUILD_DIR).filter(file => {
    return fs.statSync(path.join(BUILD_DIR, file)).isDirectory() && !IGNORE_DIRS.includes(file);
});

let errorCount = 0;
let successCount = 0;

tools.forEach(tool => {
    const toolDir = path.join(BUILD_DIR, tool);
    const bundlePath = path.join(toolDir, 'bundle.main.js');

    if (!fs.existsSync(bundlePath)) {
        console.warn(`${colors.yellow}Skipping ${tool}: bundle.main.js not found.${colors.reset}`);
        return;
    }

    console.log(`Verifying ${tool}...`);

    try {
        const bundleContent = fs.readFileSync(bundlePath, 'utf8');

        // Create a virtual console to capture logs and errors
        const virtualConsole = new VirtualConsole();
        virtualConsole.on('error', (err) => {
            console.error(`${colors.red}[${tool}] Runtime Error: ${err.message}${colors.reset}`);
            errorCount++;
        });

        // Setup JSDOM environment
        const dom = new JSDOM(`<!DOCTYPE html><body><div id="app"></div></body>`, {
            runScripts: "dangerously",
            resources: "usable",
            virtualConsole
        });

        // Explicitly remove process to simulate pure browser environment
        // JSDOM might expose process variable from Node.js, so we delete it
        // Using Object.defineProperty to ensure it's gone if configurable, or just setting to undefined
        dom.window.process = undefined;

        // We also need to mock some browser globals that might be used
        if (!dom.window.TextEncoder) {
            dom.window.TextEncoder = global.TextEncoder || require('util').TextEncoder;
        }
        if (!dom.window.TextDecoder) {
            dom.window.TextDecoder = global.TextDecoder || require('util').TextDecoder;
        }

        dom.window.matchMedia = dom.window.matchMedia || function () {
            return {
                matches: false,
                addListener: function () { },
                removeListener: function () { }
            };
        };

        // Execute the bundle
        try {
            dom.window.eval(bundleContent);

            // If we got here without throwing, check if we caught any async errors via virtualConsole
            // But eval itself is synchronous for the top level execution.

            console.log(`${colors.green}✓ ${tool} passed verification${colors.reset}`);
            successCount++;
        } catch (err) {
            console.error(`${colors.red}✗ ${tool} failed verification${colors.reset}`);
            console.error(`${colors.red}  ${err.name}: ${err.message}${colors.reset}`);
            // Check if it's the specific process error
            if (err.message.includes('process is not defined')) {
                console.error(`${colors.red}  -> Detected 'process is not defined' error! Polyfill missing.${colors.reset}`);
            }
            errorCount++;
        }

    } catch (err) {
        console.error(`${colors.red}Error reading/processing ${tool}: ${err.message}${colors.reset}`);
        errorCount++;
    }
});

console.log('\nVerification Summary:');
console.log(`${colors.green}Passed: ${successCount}${colors.reset}`);
console.log(`${colors.red}Failed: ${errorCount}${colors.reset}`);

if (errorCount > 0) {
    process.exit(1);
} else {
    process.exit(0);
}
