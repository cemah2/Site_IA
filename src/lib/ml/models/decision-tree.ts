import { argmax, type Rng } from "@/lib/rng";
import type { Classifier, Sample } from "../types";

export type Criterion = "gini" | "entropy";

export interface TreeNode {
  id: number;
  depth: number;
  /** Class counts reaching this node. */
  counts: number[];
  nSamples: number;
  impurity: number;
  /** The majority class — what this node answers if it is a leaf. */
  prediction: number;
  /** Set on internal nodes only. */
  feature?: number;
  threshold?: number;
  gain?: number;
  left?: TreeNode;
  right?: TreeNode;
  /** Why the node stopped splitting — shown verbatim in the UI. */
  stopReason?: string;
  /** Every candidate split evaluated here, so the page can show the runners-up. */
  candidates?: SplitCandidate[];
}

export interface SplitCandidate {
  feature: number;
  threshold: number;
  gain: number;
  leftCounts: number[];
  rightCounts: number[];
  leftImpurity: number;
  rightImpurity: number;
}

export interface TreeOptions {
  maxDepth: number;
  minSamplesLeaf: number;
  criterion: Criterion;
  /** Features considered per split. Used by Random Forest, not by a lone tree. */
  maxFeatures?: number;
  rng?: Rng;
  /** Keep the full candidate list per node. Off for forests (memory). */
  keepCandidates?: boolean;
}

/**
 * A CART-style decision tree, built greedily.
 *
 * "Greedy" is the word that matters pedagogically: at each node the tree picks
 * the split that looks best *right now*, with no lookahead, which is why it can
 * produce a staircase where a single diagonal line would do. Every node keeps
 * its impurity, its class counts and the full list of candidate splits it
 * considered, so the UI can answer "why this split and not another one?"
 * with the actual numbers rather than a story.
 */
export class DecisionTree implements Classifier {
  readonly root: TreeNode;
  readonly nClasses: number;
  private nodeCounter = 0;

  constructor(
    samples: Sample[],
    nClasses: number,
    private readonly opts: TreeOptions,
    private readonly nFeatures = 2,
  ) {
    this.nClasses = nClasses;
    this.root = this.build(samples, 0);
  }

  private build(samples: Sample[], depth: number): TreeNode {
    const counts = new Array<number>(this.nClasses).fill(0);
    for (const s of samples) if (s.y >= 0 && s.y < this.nClasses) counts[s.y] += 1;

    const node: TreeNode = {
      id: this.nodeCounter++,
      depth,
      counts,
      nSamples: samples.length,
      impurity: impurityOf(counts, this.opts.criterion),
      prediction: argmax(counts),
    };

    if (depth >= this.opts.maxDepth) {
      node.stopReason = `Profondeur maximale atteinte (${this.opts.maxDepth})`;
      return node;
    }
    if (samples.length < 2 * this.opts.minSamplesLeaf) {
      node.stopReason = `Trop peu d'échantillons pour couper en deux feuilles de ${this.opts.minSamplesLeaf}`;
      return node;
    }
    if (node.impurity === 0) {
      node.stopReason = "Nœud pur : tous les échantillons ont la même classe";
      return node;
    }

    const candidates = this.candidateSplits(samples, counts);
    if (this.opts.keepCandidates) node.candidates = candidates;

    const best = candidates.reduce<SplitCandidate | null>(
      (acc, c) => (acc === null || c.gain > acc.gain ? c : acc),
      null,
    );

    if (!best || best.gain <= 1e-9) {
      node.stopReason = "Aucune coupure n'améliore l'impureté";
      return node;
    }

    node.feature = best.feature;
    node.threshold = best.threshold;
    node.gain = best.gain;
    node.left = this.build(
      samples.filter((s) => s.x[best.feature] <= best.threshold),
      depth + 1,
    );
    node.right = this.build(
      samples.filter((s) => s.x[best.feature] > best.threshold),
      depth + 1,
    );
    return node;
  }

  private candidateSplits(samples: Sample[], parentCounts: number[]): SplitCandidate[] {
    const parentImpurity = impurityOf(parentCounts, this.opts.criterion);
    const n = samples.length;
    const out: SplitCandidate[] = [];

    let features = Array.from({ length: this.nFeatures }, (_, i) => i);
    if (this.opts.maxFeatures && this.opts.maxFeatures < this.nFeatures) {
      const rng = this.opts.rng ?? Math.random;
      features = features
        .map((f) => ({ f, r: rng() }))
        .sort((a, b) => a.r - b.r)
        .slice(0, this.opts.maxFeatures)
        .map((e) => e.f);
    }

    for (const f of features) {
      const sorted = [...samples].sort((a, b) => a.x[f] - b.x[f]);
      const left = new Array<number>(this.nClasses).fill(0);
      const right = [...parentCounts];

      for (let i = 0; i < sorted.length - 1; i++) {
        const s = sorted[i];
        if (s.y >= 0) {
          left[s.y] += 1;
          right[s.y] -= 1;
        }
        // Only split between two *distinct* values: a threshold inside a run of
        // identical values cannot separate them.
        if (sorted[i].x[f] === sorted[i + 1].x[f]) continue;
        const nLeft = i + 1;
        const nRight = n - nLeft;
        if (nLeft < this.opts.minSamplesLeaf || nRight < this.opts.minSamplesLeaf) continue;

        const li = impurityOf(left, this.opts.criterion);
        const ri = impurityOf(right, this.opts.criterion);
        const gain = parentImpurity - (nLeft / n) * li - (nRight / n) * ri;

        out.push({
          feature: f,
          threshold: (sorted[i].x[f] + sorted[i + 1].x[f]) / 2,
          gain,
          leftCounts: [...left],
          rightCounts: [...right],
          leftImpurity: li,
          rightImpurity: ri,
        });
      }
    }
    return out;
  }

  /** The nodes a sample visits, root first — the "prediction walkthrough". */
  path(x: number[]): TreeNode[] {
    const out: TreeNode[] = [];
    let node: TreeNode | undefined = this.root;
    while (node) {
      out.push(node);
      if (node.feature === undefined || node.threshold === undefined) break;
      node = x[node.feature] <= node.threshold ? node.left : node.right;
    }
    return out;
  }

  predict(x: number[]): number {
    const path = this.path(x);
    return path[path.length - 1].prediction;
  }

  predictProba(x: number[]): number[] {
    const leaf = this.path(x).at(-1)!;
    const total = leaf.counts.reduce((a, b) => a + b, 0) || 1;
    return leaf.counts.map((c) => c / total);
  }

  get depth(): number {
    const walk = (n: TreeNode): number =>
      n.left && n.right ? 1 + Math.max(walk(n.left), walk(n.right)) : 0;
    return walk(this.root);
  }

  get leafCount(): number {
    const walk = (n: TreeNode): number => (n.left && n.right ? walk(n.left) + walk(n.right) : 1);
    return walk(this.root);
  }
}

/** Gini impurity: the chance of mislabelling a random sample of this node by
 *  drawing a label at random from the node's own class distribution. */
export function gini(counts: number[]): number {
  const n = counts.reduce((a, b) => a + b, 0);
  if (!n) return 0;
  let s = 1;
  for (const c of counts) s -= (c / n) ** 2;
  return s;
}

/** Shannon entropy in bits: how many yes/no questions you still need. */
export function entropy(counts: number[]): number {
  const n = counts.reduce((a, b) => a + b, 0);
  if (!n) return 0;
  let s = 0;
  for (const c of counts) {
    if (c === 0) continue;
    const p = c / n;
    s -= p * Math.log2(p);
  }
  return s;
}

export function impurityOf(counts: number[], criterion: Criterion): number {
  return criterion === "entropy" ? entropy(counts) : gini(counts);
}

export function countNodes(n: TreeNode): number {
  return 1 + (n.left ? countNodes(n.left) : 0) + (n.right ? countNodes(n.right) : 0);
}
