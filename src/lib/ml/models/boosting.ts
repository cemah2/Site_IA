import type { Point2 } from "./regression";

/**
 * Gradient boosting, written so each correction can be watched arrive.
 *
 * Random Forest and boosting both combine many trees and are otherwise
 * opposites, which is the point worth making on a site that already has the
 * first one. A forest grows its trees independently, on different samples, and
 * averages them: every tree is trying to solve the whole problem, and the vote
 * cancels their individual mistakes. Boosting grows them in sequence, and each
 * one is fitted to what the previous ones got *wrong* — no tree after the first
 * has ever seen the original target.
 *
 * Kept to one dimension and to squared error: the residual of the squared loss
 * is simply `y − ŷ`, so "fit the next tree to the residuals" is literally true
 * rather than an approximation of a gradient, and the picture does not lie.
 */

export interface Stump {
  /** Split point on x; `null` for a leaf that covers everything. */
  threshold: number | null;
  left: number;
  right: number;
  /** Children, for depths beyond one. */
  leftTree?: Stump;
  rightTree?: Stump;
}

export interface BoostStage {
  /** 0 = the constant starting model, before any tree. */
  step: number;
  /** Prediction of the whole ensemble after this stage, on the grid below. */
  curve: number[];
  /** Residuals of every training point after this stage. */
  residuals: { x: number; y: number }[];
  /** What the tree added at this stage predicts, alone, on the grid. */
  correction: number[];
  trainMse: number;
  testMse: number;
}

export interface BoostResult {
  grid: number[];
  stages: BoostStage[];
  base: number;
}

function predictTree(tree: Stump, x: number): number {
  if (tree.threshold === null) return tree.left;
  if (x <= tree.threshold) {
    return tree.leftTree ? predictTree(tree.leftTree, x) : tree.left;
  }
  return tree.rightTree ? predictTree(tree.rightTree, x) : tree.right;
}

/**
 * The split that minimises squared error, by scanning every midpoint.
 *
 * Exact rather than sampled: with a few hundred points this costs nothing, and
 * an approximate split would make the "why did it cut there" question
 * unanswerable — which is the question the page exists to answer.
 */
function fitTree(points: { x: number; y: number }[], depth: number, minLeaf: number): Stump {
  const mean = points.reduce((a, p) => a + p.y, 0) / (points.length || 1);
  if (depth <= 0 || points.length < 2 * minLeaf) {
    return { threshold: null, left: mean, right: mean };
  }

  const sorted = [...points].sort((a, b) => a.x - b.x);
  let best: { sse: number; threshold: number; i: number } | null = null;

  // Running sums so each candidate split is O(1) instead of O(n).
  let leftSum = 0;
  let leftSq = 0;
  const total = sorted.reduce((a, p) => a + p.y, 0);
  const totalSq = sorted.reduce((a, p) => a + p.y * p.y, 0);

  for (let i = 0; i < sorted.length - 1; i++) {
    leftSum += sorted[i].y;
    leftSq += sorted[i].y * sorted[i].y;
    const nL = i + 1;
    const nR = sorted.length - nL;
    if (nL < minLeaf || nR < minLeaf) continue;
    if (sorted[i].x === sorted[i + 1].x) continue;
    const sseL = leftSq - (leftSum * leftSum) / nL;
    const sseR = totalSq - leftSq - ((total - leftSum) * (total - leftSum)) / nR;
    const sse = sseL + sseR;
    if (!best || sse < best.sse) {
      best = { sse, threshold: (sorted[i].x + sorted[i + 1].x) / 2, i };
    }
  }

  if (!best) return { threshold: null, left: mean, right: mean };

  const left = sorted.slice(0, best.i + 1);
  const right = sorted.slice(best.i + 1);
  const leftMean = left.reduce((a, p) => a + p.y, 0) / left.length;
  const rightMean = right.reduce((a, p) => a + p.y, 0) / right.length;

  return {
    threshold: best.threshold,
    left: leftMean,
    right: rightMean,
    leftTree: depth > 1 ? fitTree(left, depth - 1, minLeaf) : undefined,
    rightTree: depth > 1 ? fitTree(right, depth - 1, minLeaf) : undefined,
  };
}

const mse = (points: Point2[], predict: (x: number) => number): number =>
  points.length
    ? points.reduce((a, p) => a + (p.y - predict(p.x)) ** 2, 0) / points.length
    : 0;

export function fitBoosting(
  train: Point2[],
  test: Point2[],
  options: { nTrees: number; depth: number; learningRate: number; domain: [number, number]; gridSize?: number },
): BoostResult {
  const { nTrees, depth, learningRate, domain, gridSize = 160 } = options;
  const grid = Array.from(
    { length: gridSize },
    (_, i) => domain[0] + ((domain[1] - domain[0]) * i) / (gridSize - 1),
  );

  // The starting model is the mean: the best constant prediction there is, and
  // the honest baseline every tree afterwards is measured against.
  const base = train.length ? train.reduce((a, p) => a + p.y, 0) / train.length : 0;
  const trees: Stump[] = [];
  const predict = (x: number) =>
    base + learningRate * trees.reduce((a, t) => a + predictTree(t, x), 0);

  const stages: BoostStage[] = [
    {
      step: 0,
      curve: grid.map(() => base),
      residuals: train.map((p) => ({ x: p.x, y: p.y - base })),
      correction: grid.map(() => 0),
      trainMse: mse(train, () => base),
      testMse: mse(test, () => base),
    },
  ];

  for (let step = 1; step <= nTrees; step++) {
    const residuals = train.map((p) => ({ x: p.x, y: p.y - predict(p.x) }));
    const tree = fitTree(residuals, depth, 2);
    trees.push(tree);
    stages.push({
      step,
      curve: grid.map(predict),
      residuals: train.map((p) => ({ x: p.x, y: p.y - predict(p.x) })),
      correction: grid.map((x) => learningRate * predictTree(tree, x)),
      trainMse: mse(train, predict),
      testMse: mse(test, predict),
    });
  }

  return { grid, stages, base };
}
