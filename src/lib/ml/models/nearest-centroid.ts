import { argmax } from "@/lib/rng";
import type { Classifier, Sample } from "../types";

export interface CentroidDetail {
  /** Distance from the query to each class centroid, in data units. */
  distances: number[];
  nearest: number;
}

/**
 * Nearest Centroid: represent each class by the mean of its points, then assign
 * a query to the closest mean.
 *
 * It is the simplest thing that can honestly be called "learning": the whole
 * model is `k` points, and training is one pass of averaging. Because the
 * decision rule is "closest mean", its boundary is always a set of straight
 * lines (the Voronoi diagram of the centroids) — which is precisely why it
 * fails on circles and moons, and why that failure is worth showing.
 */
export class NearestCentroid implements Classifier {
  readonly centroids: number[][];
  readonly counts: number[];
  readonly nClasses: number;

  constructor(samples: Sample[], nClasses: number, nFeatures = 2) {
    this.nClasses = nClasses;
    this.counts = new Array(nClasses).fill(0);
    const sums = Array.from({ length: nClasses }, () => new Array<number>(nFeatures).fill(0));

    for (const s of samples) {
      if (s.y < 0 || s.y >= nClasses) continue;
      this.counts[s.y] += 1;
      for (let f = 0; f < nFeatures; f++) sums[s.y][f] += s.x[f];
    }

    this.centroids = sums.map((sum, c) =>
      this.counts[c] > 0 ? sum.map((v) => v / this.counts[c]) : sum.map(() => Number.NaN),
    );
  }

  /** Euclidean distance to every centroid — the quantity the page animates. */
  detail(x: number[]): CentroidDetail {
    const distances = this.centroids.map((c) => euclidean(x, c));
    // An empty class must never win; push it out of contention.
    const finite = distances.map((d) => (Number.isFinite(d) ? -d : -Infinity));
    return { distances, nearest: argmax(finite) };
  }

  predict(x: number[]): number {
    return this.detail(x).nearest;
  }

  /**
   * Softmax over negative distances. Nearest Centroid is not a probabilistic
   * model, so this is presented in the UI as "confidence", never as P(class|x):
   * it is a monotone re-scaling of distance, useful only for shading.
   */
  predictProba(x: number[]): number[] {
    const d = this.centroids.map((c) => euclidean(x, c));
    const scores = d.map((v) => (Number.isFinite(v) ? -v * 1.6 : -1e9));
    const max = Math.max(...scores);
    const exp = scores.map((s) => Math.exp(s - max));
    const sum = exp.reduce((a, b) => a + b, 0) || 1;
    return exp.map((e) => e / sum);
  }
}

export function euclidean(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return Math.sqrt(s);
}

export function manhattan(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s;
}
