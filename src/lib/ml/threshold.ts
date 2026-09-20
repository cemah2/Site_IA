import { makeFolds } from "./crossval";
import { fitModel, type AlgoId, type AlgoParams } from "./registry";
import type { Classifier, Sample } from "./types";

/**
 * Everything that depends on *where you cut* a probability.
 *
 * Every other page of this site silently thresholds at 0.5 and reports one
 * accuracy. That hides the decision that matters most in practice: a model does
 * not output a class, it outputs a degree of belief, and turning that into a
 * verdict is a separate choice with its own consequences. A screening test and
 * a spam filter can use the identical model and must not use the same cut.
 */

export interface ScoredSample {
  id: number;
  /** Probability assigned to the positive class. */
  score: number;
  /** 1 for the positive class, 0 otherwise. */
  label: 0 | 1;
  x: number[];
}

export interface Confusion {
  tp: number;
  fp: number;
  fn: number;
  tn: number;
}

export interface ThresholdMetrics extends Confusion {
  threshold: number;
  accuracy: number;
  /** Of those flagged positive, how many really were. */
  precision: number;
  /** Of the real positives, how many were caught. */
  recall: number;
  /** Of the real negatives, how many were left alone. */
  specificity: number;
  f1: number;
  /** False positive rate — the ROC curve's x axis. */
  fpr: number;
}

/** Positive-class probabilities for a binary problem. */
export function scoreSamples(
  model: Classifier,
  samples: Sample[],
  positiveClass = 1,
): ScoredSample[] {
  return samples.map((s) => {
    const p = model.predictProba?.(s.x);
    // A model without probabilities still has a verdict; treating it as 0 or 1
    // gives a degenerate curve, which is the honest picture rather than a
    // fabricated smooth one.
    const score = p ? (p[positiveClass] ?? 0) : model.predict(s.x) === positiveClass ? 1 : 0;
    return { id: s.id, score, label: (s.y === positiveClass ? 1 : 0) as 0 | 1, x: s.x };
  });
}

/**
 * A score for every point, from a model that never saw that point.
 *
 * A single 70/30 split leaves only a few dozen points to draw a ROC with, and
 * the curve is then a coarse staircase that moves visibly when one point is
 * dragged — which teaches the wrong lesson. Cross-validation gives every point
 * an honest out-of-sample score, so the curve is built from the whole dataset
 * without ever scoring a point with a model that memorised it.
 */
export function outOfFoldScores(
  algo: AlgoId,
  samples: Sample[],
  nClasses: number,
  params: AlgoParams,
  folds = 5,
  seed = 7,
  positiveClass = 1,
): ScoredSample[] {
  if (samples.length < folds * 2) return [];
  const out: ScoredSample[] = [];
  for (const fold of makeFolds(samples, folds, seed)) {
    if (!fold.train.length || !fold.test.length) continue;
    const { model } = fitModel(algo, fold.train, nClasses, params);
    out.push(...scoreSamples(model, fold.test, positiveClass));
  }
  return out;
}

export function confusionAt(scored: ScoredSample[], threshold: number): Confusion {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let tn = 0;
  for (const s of scored) {
    const flagged = s.score >= threshold;
    if (s.label === 1) {
      if (flagged) tp++;
      else fn++;
    } else if (flagged) {
      fp++;
    } else {
      tn++;
    }
  }
  return { tp, fp, fn, tn };
}

export function metricsAt(scored: ScoredSample[], threshold: number): ThresholdMetrics {
  const c = confusionAt(scored, threshold);
  const { tp, fp, fn, tn } = c;
  const precision = tp + fp ? tp / (tp + fp) : 1;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  return {
    ...c,
    threshold,
    accuracy: (tp + tn) / Math.max(1, tp + fp + fn + tn),
    precision,
    recall,
    specificity: tn + fp ? tn / (tn + fp) : 1,
    f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0,
    fpr: tn + fp ? fp / (tn + fp) : 0,
  };
}

export interface CurvePoint {
  threshold: number;
  fpr: number;
  tpr: number;
  precision: number;
  recall: number;
}

/**
 * ROC and precision–recall in one sweep.
 *
 * Built by walking the samples in decreasing score rather than by trying a
 * grid of thresholds: only the values that actually occur can change the
 * confusion matrix, so this is both exact and cheaper — and it makes the
 * staircase shape of a small dataset's curve appear, which is itself worth
 * seeing rather than smoothing away.
 */
export function curvePoints(scored: ScoredSample[]): CurvePoint[] {
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const positives = sorted.filter((s) => s.label === 1).length;
  const negatives = sorted.length - positives;
  if (!positives || !negatives) return [];

  const out: CurvePoint[] = [
    { threshold: 1.0000001, fpr: 0, tpr: 0, precision: 1, recall: 0 },
  ];
  let tp = 0;
  let fp = 0;

  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].label === 1) tp++;
    else fp++;
    // Samples that share a score must be taken together: splitting a tie would
    // invent a threshold that no cut can actually produce.
    if (i + 1 < sorted.length && sorted[i + 1].score === sorted[i].score) continue;
    out.push({
      threshold: sorted[i].score,
      fpr: fp / negatives,
      tpr: tp / positives,
      precision: tp + fp ? tp / (tp + fp) : 1,
      recall: tp / positives,
    });
  }
  return out;
}

/** Area under the ROC curve, by trapezoids. */
export function auc(points: CurvePoint[]): number {
  let area = 0;
  for (let i = 1; i < points.length; i++) {
    area += ((points[i].fpr - points[i - 1].fpr) * (points[i].tpr + points[i - 1].tpr)) / 2;
  }
  return area;
}

/** Area under the precision–recall curve. */
export function auprc(points: CurvePoint[]): number {
  let area = 0;
  for (let i = 1; i < points.length; i++) {
    area += (points[i].recall - points[i - 1].recall) * points[i].precision;
  }
  return area;
}

export type ThresholdRule = "f1" | "youden" | "cost" | "accuracy";

/**
 * The threshold a given objective would choose.
 *
 * `cost` is the one that matters outside a textbook: it asks how many false
 * positives you would accept to avoid one false negative, which is a question
 * about the world and not about the model. Missing a tumour and flagging a
 * healthy patient are not the same mistake, and no metric can know that for you.
 */
export function bestThreshold(
  scored: ScoredSample[],
  rule: ThresholdRule,
  costRatio = 1,
): number {
  const candidates = Array.from(new Set(scored.map((s) => s.score))).sort((a, b) => a - b);
  // Midpoints between observed scores: a threshold exactly on a score is
  // ambiguous, and the interval between two scores all behaves the same.
  const grid = [0, ...candidates.map((v, i) => (i ? (v + candidates[i - 1]) / 2 : v / 2)), 1.0001];

  let best = 0.5;
  let bestValue = -Infinity;
  for (const t of grid) {
    const m = metricsAt(scored, t);
    const value =
      rule === "f1"
        ? m.f1
        : rule === "youden"
          ? m.recall + m.specificity - 1
          : rule === "accuracy"
            ? m.accuracy
            : -(costRatio * m.fn + m.fp);
    if (value > bestValue) {
      bestValue = value;
      best = t;
    }
  }
  return best;
}
