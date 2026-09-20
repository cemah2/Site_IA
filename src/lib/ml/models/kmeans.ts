import { makeRng } from "@/lib/rng";
import type { Sample } from "../types";
import { euclidean } from "./nearest-centroid";

export interface KMeansStep {
  iteration: number;
  centroids: number[][];
  /** Cluster index per sample, aligned with the input array order. */
  assignment: number[];
  /** Within-cluster sum of squares — the quantity K-means actually minimises. */
  inertia: number;
  /** True once no assignment changed: the algorithm has converged. */
  converged: boolean;
}

/**
 * Lloyd's algorithm, one step at a time.
 *
 * K-means earns its place in the lab because it is the clearest example of
 * *unsupervised* learning: no labels exist, and the two-phase loop — assign
 * every point to its nearest centre, then move every centre to the mean of what
 * it captured — is simple enough to follow by eye and yet visibly converges.
 * It also fails in instructive ways: the result depends on the initialisation,
 * and it insists on round, equally sized clusters.
 */
export function kmeansSteps(
  samples: Sample[],
  k: number,
  seed: number,
  maxIter = 30,
): KMeansStep[] {
  if (!samples.length || k < 1) return [];
  const rng = makeRng(seed);
  const d = samples[0].x.length;

  // k-means++ seeding: spread the initial centres out, which makes a bad local
  // minimum much less likely than picking k points uniformly at random.
  const centroids: number[][] = [[...samples[Math.floor(rng() * samples.length)].x]];
  while (centroids.length < k) {
    const d2 = samples.map((s) => Math.min(...centroids.map((c) => euclidean(s.x, c) ** 2)));
    const total = d2.reduce((a, b) => a + b, 0);
    let target = rng() * total;
    let chosen = samples.length - 1;
    for (let i = 0; i < d2.length; i++) {
      target -= d2[i];
      if (target <= 0) {
        chosen = i;
        break;
      }
    }
    centroids.push([...samples[chosen].x]);
  }

  const steps: KMeansStep[] = [];
  let assignment = new Array<number>(samples.length).fill(-1);

  for (let iter = 0; iter <= maxIter; iter++) {
    const next = samples.map((s) => {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const dist = euclidean(s.x, centroids[c]);
        if (dist < bestD) {
          bestD = dist;
          best = c;
        }
      }
      return best;
    });

    const converged = next.every((v, i) => v === assignment[i]);
    assignment = next;

    let inertia = 0;
    for (let i = 0; i < samples.length; i++) {
      inertia += euclidean(samples[i].x, centroids[assignment[i]]) ** 2;
    }

    steps.push({
      iteration: iter,
      centroids: centroids.map((c) => [...c]),
      assignment: [...assignment],
      inertia,
      converged,
    });
    if (converged) break;

    for (let c = 0; c < centroids.length; c++) {
      const members = samples.filter((_, i) => assignment[i] === c);
      // An emptied cluster keeps its old centre rather than collapsing to the
      // origin, which would look like a bug to anyone watching.
      if (!members.length) continue;
      for (let f = 0; f < d; f++) {
        centroids[c][f] = members.reduce((a, s) => a + s.x[f], 0) / members.length;
      }
    }
  }

  return steps;
}
