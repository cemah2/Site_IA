import { makeRng, shuffle } from "@/lib/rng";
import { fitModel, type AlgoId, type AlgoParams } from "./registry";
import type { Sample } from "./types";

export interface Fold {
  /** Indices into the shuffled sample order that form this fold's test set. */
  test: Sample[];
  train: Sample[];
}

export interface FoldResult {
  fold: number;
  trainAccuracy: number;
  testAccuracy: number;
  testSize: number;
}

export interface CvResult {
  folds: FoldResult[];
  mean: number;
  /** Population standard deviation across folds — the honest error bar. */
  std: number;
  min: number;
  max: number;
  trainMean: number;
  ms: number;
}

/**
 * Stratified K-fold assignment.
 *
 * Stratified because the alternative fails silently: on an imbalanced dataset,
 * a plain shuffle can produce a fold with no examples of the minority class at
 * all, and the accuracy it reports is then measuring a different problem than
 * the other folds.
 */
export function assignFolds(samples: Sample[], k: number, seed: number): number[] {
  const rng = makeRng(seed ^ 0x5bf03635);
  const byClass = new Map<number, Sample[]>();
  for (const s of samples) {
    const bucket = byClass.get(s.y);
    if (bucket) bucket.push(s);
    else byClass.set(s.y, [s]);
  }
  const foldOf = new Map<number, number>();
  for (const bucket of byClass.values()) {
    // Dealt round-robin after shuffling: fold sizes differ by at most one
    // within every class, which is what "stratified" buys.
    shuffle([...bucket], rng).forEach((s, i) => foldOf.set(s.id, i % k));
  }
  return samples.map((s) => foldOf.get(s.id) ?? 0);
}

export function makeFolds(samples: Sample[], k: number, seed: number): Fold[] {
  const assignment = assignFolds(samples, k, seed);
  return Array.from({ length: k }, (_, f) => {
    const test: Sample[] = [];
    const train: Sample[] = [];
    samples.forEach((s, i) => (assignment[i] === f ? test : train).push(s));
    return { test, train };
  });
}

function accuracy(model: { predict(x: number[]): number }, samples: Sample[]): number {
  if (!samples.length) return 0;
  let ok = 0;
  for (const s of samples) if (model.predict(s.x) === s.y) ok += 1;
  return ok / samples.length;
}

/**
 * K-fold cross-validation for one algorithm and one parameter setting.
 *
 * Every fold refits from scratch — that is the whole point, and the reason a
 * cross-validated number costs K times a single split. Returning the individual
 * folds rather than only the mean is deliberate: the spread between folds is
 * the part that teaches, because it says how much a single split could have
 * lied to you.
 */
export function crossValidate(
  algo: AlgoId,
  samples: Sample[],
  nClasses: number,
  params: AlgoParams,
  k: number,
  seed: number,
): CvResult {
  const t0 = performance.now();
  const folds = makeFolds(samples, k, seed);
  const results: FoldResult[] = folds.map((fold, i) => {
    if (!fold.train.length || !fold.test.length) {
      return { fold: i, trainAccuracy: 0, testAccuracy: 0, testSize: fold.test.length };
    }
    const { model } = fitModel(algo, fold.train, nClasses, params);
    return {
      fold: i,
      trainAccuracy: accuracy(model, fold.train),
      testAccuracy: accuracy(model, fold.test),
      testSize: fold.test.length,
    };
  });

  const accs = results.map((r) => r.testAccuracy);
  const mean = accs.reduce((a, b) => a + b, 0) / (accs.length || 1);
  const variance =
    accs.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (accs.length || 1);

  return {
    folds: results,
    mean,
    std: Math.sqrt(variance),
    min: Math.min(...accs),
    max: Math.max(...accs),
    trainMean:
      results.reduce((a, r) => a + r.trainAccuracy, 0) / (results.length || 1),
    ms: performance.now() - t0,
  };
}

/** One point of a hyperparameter sweep: the value, its CV score, its single-split score. */
export interface SweepPoint {
  value: number;
  cv: CvResult;
  /** What a single 70/30 split would have reported for the same value. */
  single: number;
}

/**
 * Sweep one hyperparameter, scoring it both ways.
 *
 * Showing the two curves together is the argument of the page: the single-split
 * curve is jagged, and its highest point moves when the split changes. The
 * cross-validated curve is the same measurement with most of that luck averaged
 * out.
 */
export function sweepParameter(
  algo: AlgoId,
  samples: Sample[],
  nClasses: number,
  base: AlgoParams,
  key: keyof AlgoParams,
  values: number[],
  k: number,
  seed: number,
  holdout: { train: Sample[]; test: Sample[] },
): SweepPoint[] {
  return values.map((value) => {
    const params = { ...base, [key]: value } as AlgoParams;
    const cv = crossValidate(algo, samples, nClasses, params, k, seed);
    const { model } = fitModel(algo, holdout.train, nClasses, params);
    return { value, cv, single: accuracy(model, holdout.test) };
  });
}
