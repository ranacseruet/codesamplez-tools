function expect(actual) {
    return {
        toBe(expected) {
            if (actual !== expected) {
                throw new Error(`Expected  ${expected}, but received ${actual}`);
            }
        },
        toContain(item) {
            if (!actual.includes(item)) {
                throw new Error(`Expected array to contain ${item}, but it did not.`);
            }
        },
        toMatch(regex) {
            if (!regex.test(actual)) {
                throw new Error(`Expected string to match ${regex}, but it did not.`);
            }
        },
        toEqual(expected) {
            const actualStr = JSON.stringify(actual);
            const expectedStr = JSON.stringify(expected);
            if (actualStr !== expectedStr) {
                throw new Error(`Expected ${expectedStr}, but received ${actualStr}`);
            }
        },
        toThrow() {
            if (!(actual instanceof Function)) {
                throw new Error('Expected a function to test for thrown error');
            }
            try {
                actual();
                throw new Error('Expected function to throw but it did not');
            } catch (e) {
                // Test passes if any error was thrown
                return;
            }
        }
    };
}

function test(description, callback) {
    //tests.push({ description, callback });
    let passed = 0;
    let failed = 0;
    try {
        callback();
        console.log(`✅ PASS: ${description}`);
        passed++;
    } catch (error) {
        console.log(`❌ FAIL: ${description} - ${error.message}`);
        failed++;
    }
    console.log(`Tests passed: ${passed}, Tests failed: ${failed}`);
}

function describe(suiteName, callback) {
    console.group(suiteName);
    callback();
    console.groupEnd();
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {describe, test, expect};
}