import type { Classifier, Sample } from "../types";
import { euclidean, manhattan } from "./nearest-centroid";

export type Metric = "euclidean" | "manhattan";

export interface Neighbour {
  sample: Sample;
  distance: number;
  /** Vote weight: 1 for uniform voting, 1/d² for distance weighting. */
  weight: number;
}

export interface KnnDetail {
  neighbours: Neighbour[];
  votes: number[];
  predicted: number;
  /** Distance to the K-th neighbour — the radius of the circle we draw. */
  radius: number;
}

/**
 * K-Nearest Neighbours. There is no training step at all: the model *is* the
 * training set, and all the work happens at prediction time.
 *
 * That is the point worth showing — K controls how far the model looks before
 * answering, and therefore how much it trusts a single nearby point. Small K
 * follows the noise; large K smooths past the real structure.
 */
export class Knn implements Classifier {
  readonly nClasses: number;

  constructor(
    private readonly samples: Sample[],
    nClasses: number,
    private readonly k: number,
    private readonly metric: Metric = "euclidean",
    private readonly weighted = false,
  ) {
    this.nClasses = nClasses;
  }

  private distance(a: number[], b: number[]): number {
    return this.metric === "manhattan" ? manhattan(a, b) : euclidean(a, b);
  }

  /**
   * The K closest samples, by bounded insertion rather than a full sort.
   *
   * This runs once per decision-surface cell — roughly ten thousand times per
   * refit — so the difference between O(n log n) and O(n·K) per query is the
   * difference between a responsive slider and a janky one.
   */
  private topK(x: number[]): { sample: Sample; distance: number }[] {
    const k = Math.min(this.k, this.samples.length);
    const best: { sample: Sample; distance: number }[] = [];
    let worst = Infinity;

    for (const sample of this.samples) {
      const distance = this.distance(x, sample.x);
      if (best.length === k && distance >= worst) continue;
      let pos = best.length;
      while (pos > 0 && best[pos - 1].distance > distance) pos--;
      best.splice(pos, 0, { sample, distance });
      if (best.length > k) best.pop();
      worst = best[best.length - 1].distance;
    }
    return best;
  }

  detail(x: number[]): KnnDetail {
    const neighbours: Neighbour[] = this.topK(x).map((n) => ({
      ...n,
      // Guard the d = 0 case (query sits exactly on a training point).
      weight: this.weighted ? 1 / Math.max(n.distance, 1e-6) ** 2 : 1,
    }));

    const votes = new Array<number>(this.nClasses).fill(0);
    for (const n of neighbours) {
      if (n.sample.y >= 0 && n.sample.y < this.nClasses) votes[n.sample.y] += n.weight;
    }

    // Ties broken by the closest neighbour of each tied class, which is what a
    // learner intuitively expects — not by class index.
    let predicted = 0;
    let best = -Infinity;
    for (let c = 0; c < this.nClasses; c++) {
      if (votes[c] > best) {
        best = votes[c];
        predicted = c;
      } else if (votes[c] === best && votes[c] > 0) {
        const cur = neighbours.find((n) => n.sample.y === c)?.distance ?? Infinity;
        const inc = neighbours.find((n) => n.sample.y === predicted)?.distance ?? Infinity;
        if (cur < inc) predicted = c;
      }
    }

    return {
      neighbours,
      votes,
      predicted,
      radius: neighbours.length ? neighbours[neighbours.length - 1].distance : 0,
    };
  }

  predict(x: number[]): number {
    return this.detail(x).predicted;
  }

  predictProba(x: number[]): number[] {
    const { votes } = this.detail(x);
    const total = votes.reduce((a, b) => a + b, 0);
    if (!total) return new Array(this.nClasses).fill(1 / this.nClasses);
    return votes.map((v) => v / total);
  }
}
