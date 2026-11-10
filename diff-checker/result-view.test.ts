import { readFileSync } from 'fs';
import path from 'path';
import type { DiffResultLine } from './diff';
import {
  alignSplitRows,
  buildVisibleBlocks,
  foldControlLabel,
  planUnchangedFolds,
  UNCHANGED_FOLD_CONTEXT,
  UNCHANGED_FOLD_MIN
} from './result-view';

const unchanged = (text: string): DiffResultLine => ['unchanged', text];
const removed = (text: string, highlights?: [number, number][]): DiffResultLine => (
  highlights ? ['removed', text, highlights] : ['removed', text]
);
const added = (text: string, highlights?: [number, number][]): DiffResultLine => (
  highlights ? ['added', text, highlights] : ['added', text]
);

describe('diff-checker result view', () => {
  it('folds only unchanged runs longer than six lines', () => {
    expect(UNCHANGED_FOLD_MIN).toBe(7);
    expect(UNCHANGED_FOLD_CONTEXT).toBe(3);

    const short = Array.from({ length: 6 }, (_, index) => unchanged(`s${index}`));
    expect(planUnchangedFolds(short)).toEqual([]);

    const middle = [
      removed('before'),
      ...Array.from({ length: 7 }, (_, index) => unchanged(`m${index}`)),
      added('after')
    ];
    const [region] = planUnchangedFolds(middle);
    expect(region.hiddenCount).toBe(1);
    expect(region.hiddenStart).toBe(1 + 3);
    expect(region.hiddenEnd).toBe(region.end - 3);
  });

  it('keeps context beside a change and at both ends of an unchanged file', () => {
    const prefix = [
      ...Array.from({ length: 10 }, (_, index) => unchanged(`p${index}`)),
      removed('tail')
    ];
    const [leading] = planUnchangedFolds(prefix);
    expect(leading.hiddenStart).toBe(0);
    expect(leading.hiddenEnd).toBe(7);
    expect(leading.hiddenCount).toBe(7);

    const suffix = [
      added('head'),
      ...Array.from({ length: 10 }, (_, index) => unchanged(`e${index}`))
    ];
    const [trailing] = planUnchangedFolds(suffix);
    expect(trailing.hiddenStart).toBe(1 + 3);
    expect(trailing.hiddenEnd).toBe(suffix.length);
    expect(trailing.hiddenCount).toBe(7);

    const whole = Array.from({ length: 10 }, (_, index) => unchanged(`w${index}`));
    const [entire] = planUnchangedFolds(whole);
    expect(entire.hiddenStart).toBe(3);
    expect(entire.hiddenEnd).toBe(7);
    expect(entire.id).toBe('unchanged-0-10');
  });

  it('does not fold a run whose context would cover every line', () => {
    const lines = Array.from({ length: 4 }, (_, index) => unchanged(`c${index}`));
    expect(planUnchangedFolds(lines, 1, 3)).toEqual([]);
  });

  it('gives each fold its own id so one expansion cannot rename the other', () => {
    const lines = [
      removed('a'),
      ...Array.from({ length: 8 }, (_, index) => unchanged(`a${index}`)),
      added('b'),
      ...Array.from({ length: 9 }, (_, index) => unchanged(`b${index}`)),
      removed('c')
    ];
    const regions = planUnchangedFolds(lines);
    expect(regions).toHaveLength(2);
    expect(new Set(regions.map((region) => region.id)).size).toBe(2);

    const expanded = new Set([regions[0].id]);
    const blocks = buildVisibleBlocks(lines.length, regions, expanded);
    const folds = blocks.filter((block) => block.kind === 'fold');
    expect(folds).toEqual([
      { kind: 'fold', region: regions[0], expanded: true },
      { kind: 'fold', region: regions[1], expanded: false }
    ]);

    const hiddenOfSecond = new Set<number>();
    for (let index = regions[1].hiddenStart; index < regions[1].hiddenEnd; index += 1) {
      hiddenOfSecond.add(index);
    }
    const painted = blocks
      .filter((block) => block.kind === 'lines')
      .flatMap((block) => (block.kind === 'lines' ? block.indexes : []));
    expect(painted.some((index) => hiddenOfSecond.has(index))).toBe(false);
    expect(painted).toEqual(expect.arrayContaining(
      Array.from({ length: regions[0].hiddenEnd - regions[0].hiddenStart }, (_, offset) => regions[0].hiddenStart + offset)
    ));
  });

  it('skips hidden indexes until a fold is expanded', () => {
    const lines = Array.from({ length: 10 }, (_, index) => unchanged(`u${index}`));
    const [region] = planUnchangedFolds(lines);
    const collapsed = buildVisibleBlocks(lines.length, [region], new Set());
    expect(collapsed.map((block) => block.kind)).toEqual(['lines', 'fold', 'lines']);
    const collapsedIndexes = collapsed
      .filter((block) => block.kind === 'lines')
      .flatMap((block) => (block.kind === 'lines' ? block.indexes : []));
    expect(collapsedIndexes).toEqual([0, 1, 2, 7, 8, 9]);

    const expanded = buildVisibleBlocks(lines.length, [region], new Set([region.id]));
    const expandedIndexes = expanded
      .filter((block) => block.kind === 'lines')
      .flatMap((block) => (block.kind === 'lines' ? block.indexes : []));
    expect(expandedIndexes).toEqual(lines.map((_, index) => index));
  });

  it('labels the fold control for one line and for many', () => {
    expect(foldControlLabel(1, false)).toBe('Show 1 unchanged line');
    expect(foldControlLabel(14, false)).toBe('Show 14 unchanged lines');
    expect(foldControlLabel(14, true)).toBe('Hide 14 unchanged lines');
  });

  it('aligns a changed pair on one row and leaves the empty side blank', () => {
    const lines: DiffResultLine[] = [
      unchanged('same'),
      removed('hello world', [[6, 11]]),
      added('hello there', [[6, 11]]),
      removed('only old'),
      removed('also old'),
      added('extra')
    ];

    expect(alignSplitRows(lines)).toEqual([
      {
        left: { changeType: 'unchanged', text: 'same', highlights: [], lineNumber: 1 },
        right: { changeType: 'unchanged', text: 'same', highlights: [], lineNumber: 1 },
        sourceIndexes: [0]
      },
      {
        left: { changeType: 'removed', text: 'hello world', highlights: [[6, 11]], lineNumber: 2 },
        right: { changeType: 'added', text: 'hello there', highlights: [[6, 11]], lineNumber: 2 },
        sourceIndexes: [1, 2]
      },
      {
        left: { changeType: 'removed', text: 'only old', highlights: [], lineNumber: 3 },
        right: { changeType: 'added', text: 'extra', highlights: [], lineNumber: 3 },
        sourceIndexes: [3, 5]
      },
      {
        left: { changeType: 'removed', text: 'also old', highlights: [], lineNumber: 4 },
        right: emptyCell(),
        sourceIndexes: [4]
      }
    ]);
  });

  it('aligns an insertion-only and a deletion-only diff', () => {
    expect(alignSplitRows([added('new')])).toEqual([
      {
        left: emptyCell(),
        right: { changeType: 'added', text: 'new', highlights: [], lineNumber: 1 },
        sourceIndexes: [0]
      }
    ]);
    expect(alignSplitRows([removed('old')])).toEqual([
      {
        left: { changeType: 'removed', text: 'old', highlights: [], lineNumber: 1 },
        right: emptyCell(),
        sourceIndexes: [0]
      }
    ]);
    expect(alignSplitRows([])).toEqual([]);
  });

  it('plans and aligns a 5,000-line comparison without a node per line', () => {
    const lines: DiffResultLine[] = Array.from({ length: 5000 }, (_, index) => unchanged(`line ${index}`));
    lines[2500] = removed('old center');
    lines.splice(2501, 0, added('new center'));

    const started = Date.now();
    const folds = planUnchangedFolds(lines);
    const blocks = buildVisibleBlocks(lines.length, folds, new Set());
    const rows = alignSplitRows(lines);
    expect(Date.now() - started).toBeLessThan(500);

    const painted = blocks
      .filter((block) => block.kind === 'lines')
      .reduce((count, block) => count + (block.kind === 'lines' ? block.indexes.length : 0), 0);
    expect(folds.length).toBeGreaterThan(0);
    expect(painted).toBeLessThan(30);
    expect(rows).toHaveLength(5000);
    const changed = rows.find((row) => row.left.changeType === 'removed');
    expect(changed?.left.lineNumber).toBe(2501);
    expect(changed?.right).toMatchObject({ changeType: 'added', text: 'new center', lineNumber: 2501 });
    expect(changed?.sourceIndexes).toEqual([2500, 2501]);
  });

  it('scrolls Side by side inside the result panel on a narrow screen and keeps +/- markers', () => {
    const css = readFileSync(path.join(__dirname, 'styles.css'), 'utf8');
    expect(css).toContain('.diffc-result-output--split');
    expect(css).toContain('overflow-x: auto');
    expect(css).toMatch(/@media \(max-width:\s*767px\)/);
    expect(css).toContain('min-width: 40rem');
    expect(css).not.toMatch(/\.diff-line::before\s*\{\s*display:\s*none/);
  });
});

function emptyCell() {
  return { changeType: 'empty' as const, text: '', highlights: [], lineNumber: null };
}
