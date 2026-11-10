/**
 * Result-view planning for Diff Checker: side-by-side row alignment and
 * collapsible unchanged runs. Pure data in, no DOM, so a 5,000-line compare
 * can decide what to paint before any node is created. Hidden lines are not
 * formatted or highlighted.
 */

import type { DiffChangeType, DiffHighlightRange, DiffResultLine } from './diff';

export type DiffViewMode = 'unified' | 'split';

/** Fold an unchanged run only when it is longer than six lines. */
export const UNCHANGED_FOLD_MIN = 7;
/** Lines of context kept on each side of a fold that borders a change. */
export const UNCHANGED_FOLD_CONTEXT = 3;

export interface FoldRegion {
  id: string;
  /** Inclusive start index in the unified diff lines. */
  start: number;
  /** Exclusive end index. */
  end: number;
  /** Inclusive index of the first hidden line. */
  hiddenStart: number;
  /** Exclusive end of the hidden line range. */
  hiddenEnd: number;
  hiddenCount: number;
}

export interface DiffRenderOptions {
  view?: DiffViewMode;
  /** When true, unchanged runs longer than six lines fold. */
  fold?: boolean;
  expandedFoldIds?: ReadonlySet<string>;
}

export interface SplitCell {
  changeType: DiffChangeType | 'empty';
  text: string;
  highlights: DiffHighlightRange[];
  lineNumber: number | null;
}

export interface SplitRow {
  left: SplitCell;
  right: SplitCell;
  /** Unified-line indexes this row was built from, first index first. */
  sourceIndexes: number[];
}

export type VisibleBlock =
  | { kind: 'lines'; indexes: number[] }
  | { kind: 'fold'; region: FoldRegion; expanded: boolean };

function emptyCell(): SplitCell {
  return { changeType: 'empty', text: '', highlights: [], lineNumber: null };
}

function cellFrom(line: DiffResultLine, lineNumber: number): SplitCell {
  return {
    changeType: line[0],
    text: line[1],
    highlights: line[2] ?? [],
    lineNumber
  };
}

/**
 * Pair a unified diff into side-by-side rows.
 *
 * Unchanged lines occupy both columns. Inside a change hunk, removed and
 * added lines are zipped by index so a word-diff pair (removed, then added)
 * lands on one row. Extra removals leave the right cell empty; extra
 * additions leave the left cell empty.
 */
export function alignSplitRows(lines: readonly DiffResultLine[]): SplitRow[] {
  const rows: SplitRow[] = [];
  let originalNumber = 1;
  let modifiedNumber = 1;
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (line[0] === 'unchanged') {
      rows.push({
        left: cellFrom(line, originalNumber),
        right: cellFrom(line, modifiedNumber),
        sourceIndexes: [index]
      });
      originalNumber += 1;
      modifiedNumber += 1;
      index += 1;
      continue;
    }

    const removed: number[] = [];
    const added: number[] = [];
    while (index < lines.length && lines[index][0] !== 'unchanged') {
      if (lines[index][0] === 'removed') removed.push(index);
      else added.push(index);
      index += 1;
    }

    const pairs = Math.max(removed.length, added.length);
    for (let pair = 0; pair < pairs; pair += 1) {
      const leftIndex = removed[pair];
      const rightIndex = added[pair];
      const sourceIndexes: number[] = [];
      let left = emptyCell();
      let right = emptyCell();
      if (leftIndex !== undefined) {
        left = cellFrom(lines[leftIndex], originalNumber);
        originalNumber += 1;
        sourceIndexes.push(leftIndex);
      }
      if (rightIndex !== undefined) {
        right = cellFrom(lines[rightIndex], modifiedNumber);
        modifiedNumber += 1;
        sourceIndexes.push(rightIndex);
      }
      rows.push({ left, right, sourceIndexes });
    }
  }

  return rows;
}

/**
 * Find unchanged runs long enough to fold.
 *
 * A run in the middle keeps three lines of context on each side. A run at
 * the start or end keeps that context only beside the neighbouring change.
 * A file that is entirely unchanged keeps three lines at each end. Shorter
 * runs stay expanded. Each region id is stable for that run, so expanding
 * one does not renumber the others.
 */
export function planUnchangedFolds(
  lines: readonly DiffResultLine[],
  minRun = UNCHANGED_FOLD_MIN,
  context = UNCHANGED_FOLD_CONTEXT
): FoldRegion[] {
  const regions: FoldRegion[] = [];
  let index = 0;

  while (index < lines.length) {
    if (lines[index][0] !== 'unchanged') {
      index += 1;
      continue;
    }

    const start = index;
    while (index < lines.length && lines[index][0] === 'unchanged') index += 1;
    const end = index;
    const length = end - start;
    if (length < minRun) continue;

    const atStart = start === 0;
    const atEnd = end === lines.length;
    const leading = atStart && !atEnd ? 0 : context;
    const trailing = atEnd && !atStart ? 0 : context;
    if (leading + trailing >= length) continue;

    const hiddenStart = start + leading;
    const hiddenEnd = end - trailing;
    regions.push({
      id: `unchanged-${start}-${end}`,
      start,
      end,
      hiddenStart,
      hiddenEnd,
      hiddenCount: hiddenEnd - hiddenStart
    });
  }

  return regions;
}

export function foldControlLabel(hiddenCount: number, expanded: boolean): string {
  const noun = hiddenCount === 1 ? 'line' : 'lines';
  return expanded
    ? `Hide ${hiddenCount} unchanged ${noun}`
    : `Show ${hiddenCount} unchanged ${noun}`;
}

/**
 * Walk the unified lines once, emitting fold controls and the indexes that
 * should actually be painted. Collapsed runs contribute a control and skip
 * the hidden indexes. An expanded run still gets its control, and its lines
 * stay in the paint list, so other folds are untouched.
 */
export function buildVisibleBlocks(
  lineCount: number,
  folds: readonly FoldRegion[],
  expandedIds: ReadonlySet<string>
): VisibleBlock[] {
  const foldAt = new Map<number, FoldRegion>();
  folds.forEach((region) => {
    foldAt.set(region.hiddenStart, region);
  });

  const blocks: VisibleBlock[] = [];
  let pending: number[] = [];
  const flush = () => {
    if (pending.length === 0) return;
    blocks.push({ kind: 'lines', indexes: pending });
    pending = [];
  };

  for (let index = 0; index < lineCount; index += 1) {
    const region = foldAt.get(index);
    if (region) {
      flush();
      blocks.push({
        kind: 'fold',
        region,
        expanded: expandedIds.has(region.id)
      });
      if (!expandedIds.has(region.id)) {
        index = region.hiddenEnd - 1;
        continue;
      }
    }
    pending.push(index);
  }

  flush();
  return blocks;
}
