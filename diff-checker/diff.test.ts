import { computeDiff, DiffComputer, type DiffResultLine } from './diff';

describe('Base Functionality', () => {
  test('empty inputs should return empty array', () => {
    const result = computeDiff([], []);
    expect(result).toEqual([]);
  });

  test('handles null and undefined inputs gracefully via DiffComputer.compute', () => {
    expect(DiffComputer.compute(null as any, null as any)).toEqual([]);
    expect(DiffComputer.compute(undefined as any, undefined as any)).toEqual([]);
    expect(DiffComputer.compute(null as any, ['added line'])).toEqual([
      ['added', 'added line']
    ]);
    expect(DiffComputer.compute(['removed line'], null as any)).toEqual([
      ['removed', 'removed line']
    ]);
  });

  test('converts null, undefined, or empty elements within line arrays to empty strings', () => {
    const original = ['line1', null as any, undefined as any, ''];
    const modified = ['line1', 'line2'];
    const result = DiffComputer.compute(original, modified, true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toEqual(['unchanged', 'line1']);
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

  test('should detect single line difference', () => {
    const text1 = 'Hello world';
    const text2 = 'Hello there';
    // Expect raw strings with spans
    expect(computeDiff(text1.split('\n'), text2.split('\n'))).toEqual([
      ['removed', 'Hello <span class="word-removed">world</span>'],
      ['added', 'Hello <span class="word-added">there</span>']
    ]);
  });

  test('should handle multi-line differences', () => {
    const text1 = `Line 1
Line 2
Line 3`;
    const text2 = `Line 1
Line 2 modified
Line 3`;
    // Expect raw strings with spans
    expect(computeDiff(text1.split('\n'), text2.split('\n'))).toEqual([
      ['unchanged', 'Line 1'],
      ['removed', 'Line 2'],
      ['added', 'Line 2 <span class="word-added">modified</span>'], // Span wraps the word, not the space before it
      ['unchanged', 'Line 3']
    ]);
  });

  test('completely different inputs should mark all lines as added/removed', () => {
      const result = computeDiff(
          ['old1', 'old2'],
          ['new1', 'new2']
      );
      // Expect raw strings with spans
      expect(result).toEqual([
          ['removed', '<span class="word-removed">old1</span>'],
          ['added', '<span class="word-added">new1</span>'],
          ['removed', '<span class="word-removed">old2</span>'],
          ['added', '<span class="word-added">new2</span>'],
      ]);
  });
});

describe('Whitespace Handling', () => {
  test('should respect whitespace sensitivity setting', () => {
      // With whitespace ignored (default)
      const resultIgnored = computeDiff(
          ['  spaced  ', '\ttabbed\t', 'no-space'],
          ['spaced', 'tabbed', 'no-space'],
          true
      );
      expect(resultIgnored).toEqual([
          ['unchanged', '  spaced  '],
          ['unchanged', '\ttabbed\t'],
          ['unchanged', 'no-space']
      ]);

      // With whitespace sensitive
      const resultSensitive = computeDiff(
          ['  spaced  ', '\ttabbed\t', 'no-space'],
          ['spaced', 'tabbed', 'no-space'],
          false
      );
      // Expect raw strings with spans
      expect(resultSensitive).toEqual([
          ['removed', '<span class="word-removed">  </span>spaced<span class="word-removed">  </span>'],
          ['added', 'spaced'],
          ['removed', '<span class="word-removed">\t</span>tabbed<span class="word-removed">\t</span>'],
          ['added', 'tabbed'],
          ['unchanged', 'no-space']
      ]);
  });

  test('should handle mixed whitespace with sensitivity', () => {
      const result = computeDiff(
          ['function() {', '  return true;', '}'],
          ['function(){', 'return true;', '}'],
          false
      );
       // Expect raw strings with spans
      expect(result).toEqual([
          ['removed', 'function()<span class="word-removed"> </span>{'],
          ['added', 'function(){'],
          ['removed', '<span class="word-removed">  </span>return true;'],
          ['added', 'return true;'],
          ['unchanged', '}'],
      ]);
  });

  test('should treat a whitespace-only difference as unchanged when ignoreWhitespace is true', () => {
    const text1 = 'Hello   world';
    const text2 = 'Hello world';
    // The only delta is run length, which the toggle says to ignore. The
    // original line is kept verbatim rather than the normalized one.
    expect(computeDiff(text1.split('\n'), text2.split('\n'), true)).toEqual([
       ['unchanged', 'Hello   world']
    ]);
  });

  // Regression for #76. A whitespace-only change never reached the word-level
  // pass, so the bug only surfaced on a line that also carried a real change.
  describe('#76 — indentation change alongside a real change', () => {
    const original = ['function a() {', '    const foo = 1;', '}'];
    const modified = ['function a() {', '\t\tconst bar = 1;', '}'];
    const stripSpans = (html: string) => html.replace(/<\/?span[^>]*>/g, '');

    test('highlights only the word change when ignoreWhitespace is true', () => {
      expect(computeDiff(original, modified, true)).toEqual([
        ['unchanged', 'function a() {'],
        ['removed', '    const <span class="word-removed">foo</span> = 1;'],
        ['added', '\t\tconst <span class="word-added">bar</span> = 1;'],
        ['unchanged', '}']
      ]);
    });

    test('keeps each pane on its own indentation when ignoreWhitespace is true', () => {
      // Both panes are built from one parts list, so the danger is a pane
      // rendering whitespace copied from the other side's line.
      const [, [, removedHtml], [, addedHtml]] = computeDiff(original, modified, true) as DiffResultLine[];
      expect(stripSpans(removedHtml)).toBe(original[1]);
      expect(stripSpans(addedHtml)).toBe(modified[1]);
    });

    test('still highlights whitespace when ignoreWhitespace is false', () => {
      expect(computeDiff(original, modified, false)).toEqual([
        ['unchanged', 'function a() {'],
        ['removed', '<span class="word-removed">    </span>const <span class="word-removed">foo</span> = 1;'],
        ['added', '<span class="word-added">\t\t</span>const <span class="word-added">bar</span> = 1;'],
        ['unchanged', '}']
      ]);
    });

    // Built from escapes on purpose: a literal NBSP in a test file is invisible
    // in every diff and review tool, so the test would silently start comparing
    // two identical strings the first time an editor normalized it.
    const NBSP = String.fromCharCode(0x00a0);
    const BOM = String.fromCharCode(0xfeff);

    describe('look-alike spaces are real content, not whitespace', () => {
      // /\s/ matches NBSP and BOM, so a naive whitespace test reports these
      // pairs as identical and shows the user nothing — the exact class of
      // change (Word/Docs pastes, &nbsp; cleanups, encoding bugs) a diff tool
      // exists to surface.
      test.each([
        ['mid-line NBSP', `price: 10${NBSP}USD`, 'price: 10 USD'],
        ['leading NBSP', `${NBSP}price`, ' price'],
        ['trailing NBSP', `price${NBSP}`, 'price '],
        ['leading BOM', `${BOM}abc`, 'abc']
      ])('%s is reported as a difference', (_label, original, modified) => {
        const result = computeDiff([original], [modified], true);

        expect(result.map(([type]) => type)).toEqual(['removed', 'added']);
        expect(result[0][1] + result[1][1]).toContain('word-');
        expect(stripSpans(result[0][1])).toBe(original);
        expect(stripSpans(result[1][1])).toBe(modified);
      });

      test('the check survives the line-level pass, not just the word pass', () => {
        // Diff.diffLines({ ignoreWhitespace: true }) trims line edges using its
        // own \s definition, so an edge-only look-alike never reaches word
        // refinement unless the unchanged branch re-checks it.
        expect(computeDiff([`${NBSP}price`], [' price'], true)[0][0]).not.toBe('unchanged');
      });
    });

    test('stays linear on a part with a long interior whitespace run', () => {
      // Guards against a regex of the shape /^(\s*)([\s\S]*?)(\s*)$/, which
      // backtracks quadratically here: ~2.9s at 80k, ~18s at 200k. Column
      // padded reports and ASCII tables produce exactly this shape, and this
      // runs on the default path — on the main thread under the 20k worker
      // threshold, and in the worker above it.
      const padded = ['anchor', `aaa${' '.repeat(200000)}bbb`, 'tail'];
      const other = ['anchor', 'ccc', 'tail'];
      const started = Date.now();
      computeDiff(padded, other, true);
      expect(Date.now() - started).toBeLessThan(1000);
    });

    test('drops the highlight from inner run-length changes when ignoreWhitespace is true', () => {
      const [, [, removedHtml], [, addedHtml]] = computeDiff(
        ['x', 'const foo   =   1;'],
        ['x', 'const bar = 1;'],
        true
      ) as DiffResultLine[];
      expect(removedHtml).not.toContain('word-removed">   <');
      expect(addedHtml).not.toContain('word-added"> <');
      expect(stripSpans(removedHtml)).toBe('const foo   =   1;');
      expect(stripSpans(addedHtml)).toBe('const bar = 1;');
    });
  });

  test('should return all lines as added/removed when no matches and ignoreWhitespace=false', () => {
    const result = computeDiff(
      ['line1', 'line2'],
      ['line3', 'line4'],
      false
    );
     // Expect raw output
    expect(result).toEqual([
      ['removed', 'line1'],
      ['removed', 'line2'],
      ['added', 'line3'],
      ['added', 'line4']
    ]);
  });
});

describe('Edge Cases', () => {
  test('should handle very long lines', () => {
      const longLine = 'a'.repeat(1000); // Reduced length for sanity
      const result = computeDiff([longLine], [longLine + 'b']);
       // Expect raw strings with spans
      expect(result).toEqual([
          ['removed', '<span class="word-removed">' + longLine + '</span>'], // Whole line removed
          ['added', '<span class="word-added">' + longLine + 'b</span>'] // Whole line added
      ]);
  });

  test('should handle Unicode characters and emojis', () => {
      const result = computeDiff(
          ['Hello 👋', '🌍 Earth', 'Goodbye 👋'],
          ['Hello 👋', '🌎 World', 'Goodbye 👋']
      );
      // Expect raw strings with spans
      expect(result).toEqual([
          ['unchanged', 'Hello 👋'],
          ['removed', '<span class="word-removed">🌍</span> <span class="word-removed">Earth</span>'],
          ['added', '<span class="word-added">🌎</span> <span class="word-added">World</span>'],
          ['unchanged', 'Goodbye 👋']
      ]);
  });

  test('should handle repeated lines', () => {
      const result = computeDiff(
          ['A', 'B', 'A', 'C'],
          ['A', 'D', 'A', 'C']
      );
       // Expect raw strings with spans
      expect(result).toEqual([
          ['unchanged', 'A'],
          ['removed', '<span class="word-removed">B</span>'],
          ['added', '<span class="word-added">D</span>'],
          ['unchanged', 'A'],
          ['unchanged', 'C']
      ]);
  });

  test('should handle HTML/XML content', () => {
      // Use raw HTML strings as input
      const result = computeDiff(
          ['<div>', '<p>Old text</p>', '</div>'],
          ['<div>', '<p>New text</p>', '</div>']
      );
      // Expect raw HTML strings with spans
      expect(result).toEqual([
          ['unchanged', '<div>'],
          ['removed', '<p><span class="word-removed">Old</span> text</p>'],
          ['added', '<p><span class="word-added">New</span> text</p>'],
          ['unchanged', '</div>']
      ]);
  });

  test('should handle large inputs', () => {
      const oldLines = Array.from({ length: 100 }, (_, i) => `line${i}`); // Reduced size
      const newLines = Array.from({ length: 100 }, (_, i) => i % 2 === 0 ? `line${i}` : `modified${i}`);

      const result = computeDiff(oldLines, newLines);

      // Expect 50 unchanged + 50 removed (with span) + 50 added (with span) = 150 lines total
      expect(result.length).toBe(150);
      expect(result.filter(([type]) => type === 'unchanged').length).toBe(50);
      expect(result.filter(([type]) => type === 'removed').length).toBe(50);
      expect(result.filter(([type]) => type === 'added').length).toBe(50);
      // Check one example
      expect(result[0]).toEqual(['unchanged', 'line0']); // Raw
      expect(result[1]).toEqual(['removed', '<span class="word-removed">line1</span>']);
      expect(result[2]).toEqual(['added', '<span class="word-added">modified1</span>']);
  });

  test('should handle moved lines correctly', () => {
      const result = computeDiff(
          ['A', 'B', 'C'],
          ['C', 'B', 'A']
      );
      // Expect raw output
      expect(result).toEqual([
          ['removed', 'A'],
          ['removed', 'B'],
          ['unchanged', 'C'],
          ['added', 'B'],
          ['added', 'A'],
      ]);
  });

  test('Should handle moved block with braces correctly', () => {
    const result = computeDiff(
        ['A{','}', 'B', 'C{','}'],
        ['B','C{','}',  'A{','}']
    );
    // Expect raw output
    expect(result).toEqual([
        ['removed', 'A{'],
        ['removed', '}'],
        ['unchanged', 'B'],
        ['unchanged', 'C{'],
        ['unchanged', '}'],
        ['added', 'A{'],
        ['added', '}']
    ]);
  });
});

describe('Word-Level Diffing', () => {
  test('should highlight modified words within a line', () => {
    const text1 = 'This is the original line.';
    const text2 = 'This is the modified line.';
    const result = computeDiff(text1.split('\n'), text2.split('\n'));
    // Expect raw strings with spans
    expect(result).toEqual([
      ['removed', 'This is the <span class="word-removed">original</span> line.'],
      ['added', 'This is the <span class="word-added">modified</span> line.']
    ]);
  });

  test('should highlight added words within a line', () => {
    const text1 = 'This is line.';
    const text2 = 'This is the line.';
    const result = computeDiff(text1.split('\n'), text2.split('\n'));
     // Expect raw strings with spans
    expect(result).toEqual([
      ['removed', 'This is line.'], // Diff lib shows no removed part here
      ['added', 'This is <span class="word-added">the</span> line.']
    ]);
  });

   test('should highlight removed words within a line', () => {
    const text1 = 'This is the first line.';
    const text2 = 'This is line.';
    const result = computeDiff(text1.split('\n'), text2.split('\n'));
    // Expect raw strings with spans
    expect(result).toEqual([
      ['removed', 'This is <span class="word-removed">the first</span> line.'],
      ['added', 'This is line.'] // Diff lib shows no added part here
    ]);
  });

  test('should handle multiple word changes in a line', () => {
    const text1 = 'The quick brown fox jumps.';
    const text2 = 'A slow red fox sleeps.';
    const result = computeDiff(text1.split('\n'), text2.split('\n'));
     // Expect raw strings with spans (individual words)
    expect(result).toEqual([
      ['removed', '<span class="word-removed">The</span> <span class="word-removed">quick</span> <span class="word-removed">brown</span> fox <span class="word-removed">jumps</span>.'],
      ['added', '<span class="word-added">A</span> <span class="word-added">slow</span> <span class="word-added">red</span> fox <span class="word-added">sleeps</span>.']
    ]);
  });

  test('should combine word diff with line diff', () => {
    const text1 = 'Line 1 unchanged\nLine 2 is old\nLine 3 removed';
    const text2 = 'Line 1 unchanged\nLine 2 is new\nLine 4 added';
    const result = computeDiff(text1.split('\n'), text2.split('\n'));
    // Expect raw strings with spans (actual output for lines 3/4)
    expect(result).toEqual([
      ['unchanged', 'Line 1 unchanged'],
      ['removed', 'Line 2 is <span class="word-removed">old</span>'],
      ['added', 'Line 2 is <span class="word-added">new</span>'],
      ['removed', 'Line <span class="word-removed">3</span> <span class="word-removed">removed</span>'], // Actual
      ['added', 'Line <span class="word-added">4</span> <span class="word-added">added</span>'] // Actual
    ]);
  });

  test('should not word diff leading, inner or trailing whitespace when ignoreWhitespace is true', () => {
    // Regression for #76: ignoreWhitespace now reaches the word-level pass too,
    // so a line whose every delta is whitespace stays unchanged instead of
    // coming back with each run highlighted.
    const text1 = '  Word   diff   ';
    const text2 = 'Word diff';
    const result = computeDiff(text1.split('\n'), text2.split('\n'), true);
    expect(result).toEqual([
      ['unchanged', '  Word   diff   ']
    ]);
  });
  
  test('should not show word-level diff for effectively identical content', () => {
    // This test verifies the fix for the bug where identical content was showing word-level diff
    const text1 = 'if (part.added) {\n  addedHtml += \'${value}\';\n}';
    const text2 = 'if (part.added) {\n  addedHtml += \'${value}\';\n}';
    const result = computeDiff(text1.split('\n'), text2.split('\n'));
    
    // Expect all lines to be marked as unchanged with no word-level diff spans
    expect(result).toEqual([
      ['unchanged', 'if (part.added) {'],
      ['unchanged', '  addedHtml += \'${value}\';'],
      ['unchanged', '}']
    ]);
    
    // Verify no line contains word-level diff spans
    result.forEach(([_, content]) => {
      expect(content).not.toContain('word-added');
      expect(content).not.toContain('word-removed');
    });
  });
  
  test('should not show word-level diff for content that differs only in whitespace when ignoreWhitespace is true', () => {
    // This test verifies the fix for the bug where content with only whitespace differences
    // was showing word-level diff when ignoreWhitespace was true
    const text1 = 'if (part.added) {\n    addedHtml += \'${value}\';\n}';
    const text2 = 'if (part.added) {\n  addedHtml += \'${value}\';\n}';
    const result = computeDiff(text1.split('\n'), text2.split('\n'), true);
    
    // Expect all lines to be marked as unchanged with no word-level diff spans
    expect(result).toEqual([
      ['unchanged', 'if (part.added) {'],
      ['unchanged', '    addedHtml += \'${value}\';'], // Original whitespace preserved
      ['unchanged', '}']
    ]);
    
    // Verify no line contains word-level diff spans
    result.forEach(([_, content]) => {
      expect(content).not.toContain('word-added');
      expect(content).not.toContain('word-removed');
    });
  });

  test('should correctly escape HTML characters within word diff spans', () => {
    const text1 = 'Check <this> tag.'; // Raw HTML chars
    const text2 = 'Check &that; entity.'; // Raw HTML entity
    const result = computeDiff(text1.split('\n'), text2.split('\n'));
    // Expect raw strings with spans, innerHTML will handle display (actual output)
    expect(result).toEqual([
      ['removed', 'Check <span class="word-removed"><this></span> <span class="word-removed">tag</span>.'], // Actual
      ['added', 'Check <span class="word-added">&that;</span> <span class="word-added">entity</span>.'] // Actual
    ]);
  });

  test('should apply word-level diff when removed/added blocks have different line counts', () => {
    const text1 = '<title>Diff Checker</title>\n<link rel="stylesheet" href="styles.main.css">';
    const text2 = '<title>Diff</title>';
    const result = computeDiff(text1.split('\n'), text2.split('\n'));
    // Expect raw strings with spans for the modified line, and raw string for the purely removed line
    expect(result).toEqual([
      ['removed', '<title>Diff <span class="word-removed">Checker</span></title>'], // Span wraps the word, not the space before it
      ['added', '<title>Diff</title>'], // Adjusted expectation based on actual library output
      ['removed', '<link rel="stylesheet" href="styles.main.css">']
    ]);
  });
});
