import { argmax, makeRng } from "@/lib/rng";
import type { Classifier, Sample } from "../types";
import { DecisionTree, type Criterion } from "./decision-tree";

export interface ForestVote {
  treeIndex: number;
  prediction: number;
  /** Class distribution of the leaf this tree landed in. */
  leafCounts: number[];
}

export interface ForestDetail {
  votes: ForestVote[];
  tally: number[];
  predicted: number;
  /** Share of trees backing the winner — the forest's own confidence. */
  agreement: number;
}

export interface ForestOptions {
  nTrees: number;
  maxDepth: number;
  minSamplesLeaf: number;
  criterion: Criterion;
  /** Features drawn per split. 1 of 2 in 2-D is the usual "sqrt(d)" rule. */
  maxFeatures: number;
  seed: number;
  /** Fraction of the training set each tree draws, with replacement. */
  bagFraction: number;
}

/**
 * Random Forest: many deliberately *different* trees, then a majority vote.
 *
 * The two sources of difference are both visible in this implementation and
 * both matter: bagging (each tree sees a bootstrap resample, so it disagrees
 * about the data) and feature subsampling (each split considers only some
 * features, so it disagrees about the questions). Trees that all made the same
 * mistakes would average to nothing; it is the disagreement that cancels the
 * individual errors out.
 */
export class RandomForest implements Classifier {
  readonly trees: DecisionTree[];
  /** Indices each tree was trained on, so the UI can show its bootstrap sample. */
  readonly bags: number[][];
  readonly nClasses: number;

  constructor(samples: Sample[], nClasses: number, opts: ForestOptions, nFeatures = 2) {
    this.nClasses = nClasses;
    this.trees = [];
    this.bags = [];

    const n = samples.length;
    const bagSize = Math.max(1, Math.round(n * opts.bagFraction));

    for (let t = 0; t < opts.nTrees; t++) {
      // Each tree gets its own generator seeded from the forest seed, so the
      // forest is fully reproducible and tree #3 is always the same tree #3.
      const rng = makeRng(opts.seed + t * 7919);
      const idx: number[] = [];
      const bag: Sample[] = [];
      for (let i = 0; i < bagSize; i++) {
        const j = Math.floor(rng() * n);
        idx.push(j);
        bag.push(samples[j]);
      }
      this.bags.push(idx);
      this.trees.push(
        new DecisionTree(
          bag,
          nClasses,
          {
            maxDepth: opts.maxDepth,
            minSamplesLeaf: opts.minSamplesLeaf,
            criterion: opts.criterion,
            maxFeatures: opts.maxFeatures,
            rng,
          },
          nFeatures,
        ),
      );
    }
  }

  detail(x: number[]): ForestDetail {
    const votes: ForestVote[] = this.trees.map((tree, treeIndex) => {
      const leaf = tree.path(x).at(-1)!;
      return { treeIndex, prediction: leaf.prediction, leafCounts: leaf.counts };
    });
    const tally = new Array<number>(this.nClasses).fill(0);
    for (const v of votes) tally[v.prediction] += 1;
    const predicted = argmax(tally);
    return {
      votes,
      tally,
      predicted,
      agreement: votes.length ? tally[predicted] / votes.length : 0,
    };
  }

  predict(x: number[]): number {
    return this.detail(x).predicted;
  }

  /**
   * Soft voting: average the trees' leaf distributions rather than counting
   * hard votes. It gives a smoother surface, which is the honest picture of
   * what a forest believes between its trees' disagreements.
   */
  predictProba(x: number[]): number[] {
    const acc = new Array<number>(this.nClasses).fill(0);
    for (const tree of this.trees) {
      const p = tree.predictProba(x);
      for (let c = 0; c < this.nClasses; c++) acc[c] += p[c];
    }
    const total = acc.reduce((a, b) => a + b, 0) || 1;
    return acc.map((v) => v / total);
  }
}
