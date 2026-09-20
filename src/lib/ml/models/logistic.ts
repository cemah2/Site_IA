import type { Classifier, Sample } from "../types";

export interface LogisticOptions {
  learningRate: number;
  /** L2 penalty on the weights (never on the bias). 0 = off. */
  l2: number;
  /** Full-batch steps to run at construction. 0 leaves the model untrained. */
  epochs: number;
}

export interface LogisticStep {
  epoch: number;
  loss: number;
  accuracy: number;
  /** A copy of the parameters at this step, for the trajectory plot. */
  w: number[][];
  b: number[];
  /** Length of the gradient — how steep the slope still is. */
  gradientNorm: number;
}

export const DEFAULT_LOGISTIC: LogisticOptions = {
  learningRate: 0.5,
  l2: 0,
  epochs: 0,
};

export function sigmoid(z: number): number {
  // Split by sign: exp(710) overflows, and a probability that silently becomes
  // NaN is the kind of bug that only shows up on the one point that matters.
  return z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z));
}

/**
 * Logistic regression, written to be watched rather than to be fast.
 *
 * This is the smallest model that produces a *probability* instead of a verdict,
 * and the bridge the site needs between "fit a line" and "a neuron": the score
 * `z = w·x + b` is exactly a neuron's pre-activation, the sigmoid is exactly its
 * activation, and the training rule below — move each weight by (prediction −
 * truth) × input — is exactly the neuron's backward pass with one layer.
 *
 * Two deliberate choices:
 *
 *  - **Full-batch gradient descent**, not a closed form and not stochastic.
 *    There is no closed form (unlike least squares), which is itself worth
 *    seeing; and full batch makes every step reproducible, so the loss curve is
 *    a smooth line a learner can reason about rather than a noisy one.
 *  - **Two classes use one weight vector, not two.** `k` classes get the
 *    softmax generalisation, but the binary case keeps a single `w` and `b` so
 *    that the decision line has literally the equation shown on the page.
 */
export class LogisticRegression implements Classifier {
  /** `w[c]` for class c. Binary models hold a single row. */
  w: number[][];
  b: number[];
  readonly nClasses: number;
  readonly binary: boolean;
  history: LogisticStep[] = [];
  epoch = 0;
  private opts: LogisticOptions;
  private train: Sample[];
  private readonly nFeatures: number;

  constructor(
    samples: Sample[],
    nClasses: number,
    options: Partial<LogisticOptions> = {},
  ) {
    this.opts = { ...DEFAULT_LOGISTIC, ...options };
    this.nClasses = nClasses;
    this.binary = nClasses === 2;
    this.train = samples;
    this.nFeatures = samples[0]?.x.length ?? 2;
    const rows = this.binary ? 1 : nClasses;
    this.w = Array.from({ length: rows }, () => new Array<number>(this.nFeatures).fill(0));
    this.b = new Array<number>(rows).fill(0);
    this.record();
    for (let i = 0; i < this.opts.epochs; i++) this.step();
  }

  /**
   * Swap the training set without touching the weights.
   *
   * Dragging a point must not wipe out the descent the learner just watched:
   * the question the page asks is "what does *this* model say about the new
   * data", and rebuilding from zero would answer a different one.
   */
  setTrain(samples: Sample[]): void {
    this.train = samples;
  }

  /** Set the parameters by hand — the page lets the learner do this. */
  setParams(w: number[][], b: number[]): void {
    this.w = w.map((row) => [...row]);
    this.b = [...b];
  }

  setOptions(options: Partial<LogisticOptions>): void {
    this.opts = { ...this.opts, ...options };
  }

  /** The raw score before the sigmoid: a neuron's `z`. */
  score(x: number[], c = 0): number {
    const row = this.w[c];
    let z = this.b[c];
    for (let i = 0; i < row.length; i++) z += row[i] * x[i];
    return z;
  }

  predictProba(x: number[]): number[] {
    if (this.binary) {
      const p = sigmoid(this.score(x));
      return [1 - p, p];
    }
    const z = this.w.map((_, c) => this.score(x, c));
    const max = Math.max(...z);
    const e = z.map((v) => Math.exp(v - max));
    const sum = e.reduce((a, v) => a + v, 0);
    return e.map((v) => v / sum);
  }

  predict(x: number[]): number {
    if (this.binary) return this.score(x) >= 0 ? 1 : 0;
    const p = this.predictProba(x);
    let best = 0;
    for (let c = 1; c < p.length; c++) if (p[c] > p[best]) best = c;
    return best;
  }

  /**
   * One full-batch gradient step.
   *
   * The gradient of the log-loss with respect to a weight is the average of
   * `(p − y) · xᵢ` over the data — the same "error times input" rule the
   * backpropagation page derives. Nothing here is specific to two dimensions.
   */
  step(): LogisticStep {
    const n = this.train.length;
    if (!n) return this.record();
    const rows = this.w.length;
    const gradW = Array.from({ length: rows }, () => new Array<number>(this.nFeatures).fill(0));
    const gradB = new Array<number>(rows).fill(0);

    for (const s of this.train) {
      const p = this.predictProba(s.x);
      for (let c = 0; c < rows; c++) {
        // Binary: the single row plays the role of class 1.
        const target = this.binary ? (s.y === 1 ? 1 : 0) : s.y === c ? 1 : 0;
        const err = (this.binary ? p[1] : p[c]) - target;
        for (let i = 0; i < this.nFeatures; i++) gradW[c][i] += (err * s.x[i]) / n;
        gradB[c] += err / n;
      }
    }

    for (let c = 0; c < rows; c++) {
      for (let i = 0; i < this.nFeatures; i++) {
        gradW[c][i] += this.opts.l2 * this.w[c][i];
        this.w[c][i] -= this.opts.learningRate * gradW[c][i];
      }
      this.b[c] -= this.opts.learningRate * gradB[c];
    }

    this.epoch += 1;
    return this.record(gradW, gradB);
  }

  /** Mean log-loss (cross-entropy) over a set. This is what training minimises. */
  loss(samples: Sample[] = this.train): number {
    if (!samples.length) return 0;
    let sum = 0;
    for (const s of samples) {
      const p = this.predictProba(s.x);
      sum += -Math.log(Math.max(p[s.y] ?? 1e-12, 1e-12));
    }
    let penalty = 0;
    if (this.opts.l2) {
      for (const row of this.w) for (const v of row) penalty += v * v;
      penalty *= this.opts.l2 / 2;
    }
    return sum / samples.length + penalty;
  }

  accuracy(samples: Sample[] = this.train): number {
    if (!samples.length) return 0;
    let ok = 0;
    for (const s of samples) if (this.predict(s.x) === s.y) ok += 1;
    return ok / samples.length;
  }

  reset(): void {
    const rows = this.w.length;
    this.w = Array.from({ length: rows }, () => new Array<number>(this.nFeatures).fill(0));
    this.b = new Array<number>(rows).fill(0);
    this.epoch = 0;
    this.history = [];
    this.record();
  }

  get parameterCount(): number {
    return this.w.length * (this.nFeatures + 1);
  }

  private record(gradW?: number[][], gradB?: number[]): LogisticStep {
    let norm = 0;
    if (gradW && gradB) {
      for (const row of gradW) for (const v of row) norm += v * v;
      for (const v of gradB) norm += v * v;
      norm = Math.sqrt(norm);
    }
    const entry: LogisticStep = {
      epoch: this.epoch,
      loss: this.loss(),
      accuracy: this.accuracy(),
      w: this.w.map((row) => [...row]),
      b: [...this.b],
      gradientNorm: norm,
    };
    this.history.push(entry);
    return entry;
  }
}

/**
 * The same problem fitted by least squares on 0/1 labels.
 *
 * Kept here deliberately: the honest way to motivate the log-loss is to let a
 * learner try the obvious alternative and watch a single far-away point drag
 * the boundary across correctly-classified data. Returns `[w1, w2, b]` of the
 * plane `ŷ = w·x + b`, whose 0.5 level set is the boundary.
 */
export function leastSquaresBoundary(samples: Sample[]): {
  w: number[];
  b: number;
} | null {
  const n = samples.length;
  if (n < 3) return null;
  // Normal equations for 3 unknowns, solved by Gaussian elimination.
  const A = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  for (const s of samples) {
    const row = [s.x[0], s.x[1], 1];
    const y = s.y === 1 ? 1 : 0;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) A[i][j] += row[i] * row[j];
      A[i][3] += row[i] * y;
    }
  }
  for (let i = 0; i < 3; i++) {
    let pivot = i;
    for (let r = i + 1; r < 3; r++) if (Math.abs(A[r][i]) > Math.abs(A[pivot][i])) pivot = r;
    if (Math.abs(A[pivot][i]) < 1e-12) return null;
    [A[i], A[pivot]] = [A[pivot], A[i]];
    for (let r = 0; r < 3; r++) {
      if (r === i) continue;
      const f = A[r][i] / A[i][i];
      for (let c = i; c < 4; c++) A[r][c] -= f * A[i][c];
    }
  }
  const sol = [A[0][3] / A[0][0], A[1][3] / A[1][1], A[2][3] / A[2][2]];
  // Rewritten as a signed score around the 0.5 threshold, so it can be drawn
  // with the same code as the logistic boundary.
  return { w: [sol[0], sol[1]], b: sol[2] - 0.5 };
}
