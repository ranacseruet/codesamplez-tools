describe('Basic Functionality', () => {
    test('empty inputs should return empty array', () => {
        const result = computeDiff([], []);
        expect(result).toEqual([]);
    });

    test('one empty input should mark all lines as added/removed', () => {
        const result1 = computeDiff([], ['line1', 'line2']);
        expect(result1).toEqual([
            ['added', 'line1'],
            ['added', 'line2']
        ]);

        const result2 = computeDiff(['line1', 'line2'], []);
        expect(result2).toEqual([
            ['removed', 'line1'],
            ['removed', 'line2']
        ]);
    });

    test('identical inputs should mark all lines as unchanged', () => {
        const lines = ['line1', 'line2', 'line3'];
        const result = computeDiff(lines, lines);
        expect(result).toEqual([
            ['unchanged', 'line1'],
            ['unchanged', 'line2'],
            ['unchanged', 'line3']
        ]);
    });

    test('completely different inputs should mark all lines as added/removed', () => {
        const result = computeDiff(
            ['old1', 'old2'],
            ['new1', 'new2']
        );
        expect(result).toEqual([
            ['removed', 'old1'],
            ['removed', 'old2'],
            ['added', 'new1'],
            ['added', 'new2']
        ]);
    });
});

describe('Complex Scenarios', () => {
    test('should handle multiple line additions', () => {
        const result = computeDiff(
            ['line1', 'line3'],
            ['line1', 'line2', 'line3', 'line4']
        );
        expect(result).toEqual([
            ['unchanged', 'line1'],
            ['added', 'line2'],
            ['unchanged', 'line3'],
            ['added', 'line4']
        ]);
    });

    test('should handle multiple line removals', () => {
        const result = computeDiff(
            ['line1', 'line2', 'line3', 'line4'],
            ['line1', 'line4']
        );
        expect(result).toEqual([
            ['unchanged', 'line1'],
            ['removed', 'line2'],
            ['removed', 'line3'],
            ['unchanged', 'line4']
        ]);
    });

    test('should handle mixed changes correctly', () => {
        const result = computeDiff(
            ['keep1', 'old1', 'keep2', 'old2', 'keep3'],
            ['keep1', 'new1', 'keep2', 'new2', 'keep3']
        );
        expect(result).toEqual([
            ['unchanged', 'keep1'],
            ['removed', 'old1'],
            ['added', 'new1'],
            ['unchanged', 'keep2'],
            ['removed', 'old2'],
            ['added', 'new2'],
            ['unchanged', 'keep3']
        ]);
    });

    test('should handle whitespace differences', () => {
        const result = computeDiff(
            ['no spaces', ' leading space', 'trailing space ', '  multiple  spaces  '],
            ['no spaces', 'leading space', 'trailing space', ' multiple spaces ']
        );
        expect(result).toEqual([
            ['unchanged', 'no spaces'],
            ['removed', ' leading space'],
            ['added', 'leading space'],
            ['removed', 'trailing space '],
            ['added', 'trailing space'],
            ['removed', '  multiple  spaces  '],
            ['added', ' multiple spaces ']
        ]);
    });
});

describe('Edge Cases', () => {
    test('should handle null/undefined inputs', () => {
        expect(() => computeDiff(null, [])).toThrow();
        expect(() => computeDiff([], null)).toThrow();
        expect(() => computeDiff(undefined, [])).toThrow();
        expect(() => computeDiff([], undefined)).toThrow();
    });

    test('should handle very long lines', () => {
        const longLine = 'a'.repeat(10000);
        const result = computeDiff([longLine], [longLine + 'b']);
        expect(result).toEqual([
            ['removed', longLine],
            ['added', longLine + 'b']
        ]);
    });

    test('should handle Unicode characters and emojis', () => {
        const result = computeDiff(
            ['Hello 👋', '🌍 Earth', 'Goodbye 👋'],
            ['Hello 👋', '🌎 World', 'Goodbye 👋']
        );
        expect(result).toEqual([
            ['unchanged', 'Hello 👋'],
            ['removed', '🌍 Earth'],
            ['added', '🌎 World'],
            ['unchanged', 'Goodbye 👋']
        ]);
    });

    test('should handle repeated lines', () => {
        const result = computeDiff(
            ['A', 'B', 'A', 'C'],
            ['A', 'D', 'A', 'C']
        );
        expect(result).toEqual([
            ['unchanged', 'A'],
            ['removed', 'B'],
            ['added', 'D'],
            ['unchanged', 'A'],
            ['unchanged', 'C']
        ]);
    });

    test('should handle HTML/XML content', () => {
        const result = computeDiff(
            ['<div>', '<p>Old text</p>', '</div>'],
            ['<div>', '<p>New text</p>', '</div>']
        );
        expect(result).toEqual([
            ['unchanged', '<div>'],
            ['removed', '<p>Old text</p>'],
            ['added', '<p>New text</p>'],
            ['unchanged', '</div>']
        ]);
    });

    test('should handle large inputs', () => {
        const oldLines = Array.from({ length: 1000 }, (_, i) => `line${i}`);
        const newLines = Array.from({ length: 1000 }, (_, i) => i % 2 === 0 ? `line${i}` : `modified${i}`);
        
        const result = computeDiff(oldLines, newLines);
        
        expect(result.length).toBe(1500); // 500 unchanged + 500 removed + 500 added
        expect(result.filter(([type]) => type === 'unchanged').length).toBe(500);
        expect(result.filter(([type]) => type === 'removed').length).toBe(500);
        expect(result.filter(([type]) => type === 'added').length).toBe(500);
    });
});
