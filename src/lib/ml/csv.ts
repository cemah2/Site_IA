import type { Dataset, Sample } from "./types";

/**
 * Read a table the way a spreadsheet actually exports it.
 *
 * This is deliberately tolerant, because the people this site is written for
 * will arrive with a file exported from Excel in French: semicolons instead of
 * commas, decimal commas instead of points, a UTF-8 byte-order mark at the
 * start, and CRLF line endings. A parser that only accepts the textbook
 * `a,b,c` form would simply not work for exactly the intended audience, and
 * would look like a bug in their file rather than in ours.
 */

export interface ParsedTable {
  columns: string[];
  /** Raw cell values, one array per row, aligned with `columns`. */
  rows: string[][];
  delimiter: string;
  /** True when the decimal separator was detected as a comma. */
  decimalComma: boolean;
}

const DELIMITERS = [",", ";", "\t", "|"] as const;

/** The delimiter that yields the most consistent column count. */
function detectDelimiter(sample: string): string {
  const lines = sample.split(/\r?\n/).filter((l) => l.trim()).slice(0, 12);
  let best = ",";
  let bestScore = -1;
  for (const d of DELIMITERS) {
    const counts = lines.map((l) => splitLine(l, d).length);
    if (!counts.length || counts[0] < 2) continue;
    const consistent = counts.filter((c) => c === counts[0]).length / counts.length;
    // Consistency first, then column count: ";" splitting into 5 identical
    // columns beats "," splitting into 2 ragged ones.
    const score = consistent * 10 + Math.min(counts[0], 20) / 20;
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

/** One line, respecting double-quoted fields (which may contain the delimiter). */
function splitLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === delimiter) {
      out.push(field);
      field = "";
    } else {
      field += c;
    }
  }
  out.push(field);
  return out.map((f) => f.trim());
}

export function parseCsv(text: string): ParsedTable {
  // A byte-order mark on the first header turns "species" into "﻿species",
  // which then matches nothing the user selects.
  const clean = text.replace(/^﻿/, "");
  const delimiter = detectDelimiter(clean);
  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) return { columns: [], rows: [], delimiter, decimalComma: false };

  const all = lines.map((l) => splitLine(l, delimiter));
  const width = all[0].length;
  const body = all.slice(1).filter((r) => r.length === width);

  // Decimal commas only make sense when the delimiter is not itself a comma.
  const decimalComma =
    delimiter !== "," &&
    body
      .slice(0, 50)
      .flat()
      .some((v) => /^-?\d+,\d+$/.test(v));

  // A header row is assumed unless the first row is entirely numeric, in which
  // case the file has none and the columns get positional names.
  const firstLooksNumeric = all[0].every((v) => v !== "" && isNumeric(v, decimalComma));
  const columns = firstLooksNumeric
    ? all[0].map((_, i) => `colonne ${i + 1}`)
    : all[0].map((c, i) => c || `colonne ${i + 1}`);
  const rows = firstLooksNumeric ? all.filter((r) => r.length === width) : body;

  return { columns, rows, delimiter, decimalComma };
}

function isNumeric(v: string, decimalComma: boolean): boolean {
  const s = decimalComma ? v.replace(",", ".") : v;
  return s !== "" && Number.isFinite(Number(s));
}

export function toNumber(v: string, decimalComma: boolean): number {
  return Number(decimalComma ? v.replace(",", ".") : v);
}

export interface ColumnSummary {
  name: string;
  index: number;
  /** A column is numeric when nearly every non-empty value parses as a number. */
  numeric: boolean;
  /** Distinct values, capped — used to judge whether a column can be a label. */
  distinct: string[];
  missing: number;
}

const MISSING = new Set(["", "na", "n/a", "nan", "null", "none", "?", "-"]);

export function summarise(table: ParsedTable): ColumnSummary[] {
  return table.columns.map((name, index) => {
    const values = table.rows.map((r) => (r[index] ?? "").trim());
    const present = values.filter((v) => !MISSING.has(v.toLowerCase()));
    const numericCount = present.filter((v) => isNumeric(v, table.decimalComma)).length;
    const distinct = Array.from(new Set(present)).slice(0, 60);
    return {
      name,
      index,
      numeric: present.length > 0 && numericCount >= present.length * 0.95,
      distinct,
      missing: values.length - present.length,
    };
  });
}

export interface ColumnChoice {
  x: number;
  y: number;
  /** -1 means "no label column": every point gets class 0. */
  label: number;
}

export interface BuildOptions {
  /** Cap on the working sample. Beyond this the data is subsampled, stratified. */
  maxPoints?: number;
  /** Rescale both features to comparable ranges. */
  standardise?: boolean;
  seed?: number;
}

export interface BuiltDataset {
  dataset: Dataset;
  /** How many usable rows the file had, before any subsampling. */
  totalRows: number;
  /** How many rows were dropped for missing or unparsable values. */
  droppedRows: number;
  /** Classes beyond the fifth are merged into "autres" — the palette has five. */
  mergedClasses: string[];
}

const MAX_CLASSES = 5;

/**
 * Turn a chosen pair of columns plus a label column into the site's Dataset.
 *
 * Two limits are enforced here rather than left to blow up later: five classes,
 * because the categorical palette is validated for exactly five and a sixth
 * would be indistinguishable for a colour-blind reader; and a working sample
 * size, because the SVM keeps an n × n kernel matrix and a ten-thousand-row
 * file would ask the browser for 760 MB.
 */
export function buildDataset(
  table: ParsedTable,
  choice: ColumnChoice,
  name: string,
  { maxPoints = 600, standardise = false, seed = 7 }: BuildOptions = {},
): BuiltDataset {
  const dc = table.decimalComma;
  const usable: { x: number; y: number; label: string }[] = [];
  let dropped = 0;

  for (const row of table.rows) {
    const xs = (row[choice.x] ?? "").trim();
    const ys = (row[choice.y] ?? "").trim();
    if (!isNumeric(xs, dc) || !isNumeric(ys, dc)) {
      dropped++;
      continue;
    }
    const label = choice.label >= 0 ? (row[choice.label] ?? "").trim() : "tous";
    if (choice.label >= 0 && MISSING.has(label.toLowerCase())) {
      dropped++;
      continue;
    }
    usable.push({ x: toNumber(xs, dc), y: toNumber(ys, dc), label });
  }

  // Classes ordered by frequency, so the ones that survive the cap are the ones
  // that actually carry the data.
  const counts = new Map<string, number>();
  for (const u of usable) counts.set(u.label, (counts.get(u.label) ?? 0) + 1);
  const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const kept = ordered.slice(0, MAX_CLASSES);
  const merged = ordered.slice(MAX_CLASSES);
  const classIndex = new Map(kept.map((k, i) => [k, i]));

  const labelled = usable.filter((u) => classIndex.has(u.label));

  // Stratified subsample: taking the first N rows of a file sorted by class —
  // which is how most real files arrive — would hand the model only some classes.
  const working = subsample(labelled, maxPoints, classIndex, seed);

  let xs = working.map((u) => u.x);
  let ys = working.map((u) => u.y);
  if (standardise) {
    xs = standardiseValues(xs);
    ys = standardiseValues(ys);
  }

  const samples: Sample[] = working.map((u, i) => ({
    id: i,
    x: [xs[i], ys[i]],
    y: classIndex.get(u.label) ?? 0,
  }));

  return {
    dataset: {
      name,
      samples,
      featureNames: [table.columns[choice.x] ?? "x", table.columns[choice.y] ?? "y"],
      classNames: kept.length ? kept : ["tous"],
      domain: [paddedRange(xs), paddedRange(ys)],
    },
    totalRows: labelled.length,
    droppedRows: dropped,
    mergedClasses: merged,
  };
}

function subsample<T extends { label: string }>(
  items: T[],
  max: number,
  classIndex: Map<string, number>,
  seed: number,
): T[] {
  if (items.length <= max) return items;
  const byClass = new Map<string, T[]>();
  for (const it of items) {
    const bucket = byClass.get(it.label);
    if (bucket) bucket.push(it);
    else byClass.set(it.label, [it]);
  }
  // Deterministic shuffle, so the same file always yields the same sample and
  // a shared link keeps meaning something.
  let state = seed >>> 0 || 1;
  const rand = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const out: T[] = [];
  const share = max / items.length;
  for (const bucket of byClass.values()) {
    const shuffled = [...bucket];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    out.push(...shuffled.slice(0, Math.max(2, Math.round(bucket.length * share))));
  }
  void classIndex;
  return out;
}

function standardiseValues(values: number[]): number[] {
  const n = values.length || 1;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / n) || 1;
  return values.map((v) => (v - mean) / sd);
}

/** A range with a margin, so points never sit exactly on the frame. */
function paddedRange(values: number[]): [number, number] {
  if (!values.length) return [-1, 1];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || Math.max(1, Math.abs(hi));
  return [lo - span * 0.08, hi + span * 0.08];
}
