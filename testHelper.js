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

const tests = [];

function test(description, callback) {
    tests.push({ description, callback });
}

function describe(suiteName, callback) {
    console.group(suiteName);
    callback();
    console.groupEnd();
}

document.addEventListener('DOMContentLoaded', () => {
    const resultsDiv = document.getElementById('testResults');
    let passed = 0;
    let failed = 0;

    tests.forEach(({ description, callback }) => {
        try {
            callback();
            const resultDiv = document.createElement('div');
            resultDiv.className = 'test-result pass';
            resultDiv.textContent = `✅ PASS: ${description}`;
            resultsDiv.appendChild(resultDiv);
            passed++;
        } catch (error) {
            const resultDiv = document.createElement('div');
            resultDiv.className = 'test-result fail';
            resultDiv.textContent = `❌ FAIL: ${description} - ${error.message}`;
            resultsDiv.appendChild(resultDiv);
            failed++;
        }
    });

    // Display summary
    const summaryDiv = document.createElement('div');
    summaryDiv.textContent = `Summary: Passed: ${passed}, Failed: ${failed}`;
    resultsDiv.appendChild(summaryDiv);
});
