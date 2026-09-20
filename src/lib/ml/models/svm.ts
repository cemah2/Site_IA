import type { Classifier, Sample } from "../types";

export type KernelKind = "linear" | "rbf" | "poly";

export interface SvmOptions {
  /** Regularisation. Large C = "fit every point"; small C = "keep a wide margin". */
  C: number;
  kernel: KernelKind;
  /** RBF width. Large gamma = each point's influence is very local. */
  gamma: number;
  /** Polynomial degree. */
  degree: number;
  epochs: number;
  tol: number;
}

export interface SvmDetail {
  /** Signed distance to the hyperplane, in margin units. */
  decision: number;
  predicted: number;
  /** |f(x)| < 1 means the point is inside the margin band. */
  insideMargin: boolean;
}

function kernel(a: number[], b: number[], o: SvmOptions): number {
  switch (o.kernel) {
    case "rbf": {
      let d = 0;
      for (let i = 0; i < a.length; i++) d += (a[i] - b[i]) ** 2;
      return Math.exp(-o.gamma * d);
    }
    case "poly": {
      let dot = 0;
      for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
      return (o.gamma * dot + 1) ** o.degree;
    }
    default: {
      let dot = 0;
      for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
      return dot;
    }
  }
}

/**
 * Binary SVM trained by SMO (Sequential Minimal Optimisation), simplified.
 *
 * SMO is used rather than a hinge-loss SGD because the dual variables α are
 * what make the *support vectors* fall out of the maths: α > 0 marks exactly
 * the points that hold the boundary in place, and the page's central claim —
 * "delete every other point and nothing moves" — is only true, and only
 * demonstrable, because we solve the dual.
 *
 * `C` bounds every α from above. That is the whole soft-margin story in one
 * line: a point can only pull on the boundary with force at most C, so a small
 * C lets outliers be ignored and a large C forces the boundary to contort.
 */
export class BinarySvm {
  readonly alpha: Float64Array;
  b = 0;
  readonly y: Int8Array;
  readonly X: number[][];
  readonly supportIndices: number[] = [];

  constructor(
    samples: Sample[],
    positiveClass: number,
    private readonly opts: SvmOptions,
  ) {
    const n = samples.length;
    this.X = samples.map((s) => s.x);
    this.y = new Int8Array(n);
    for (let i = 0; i < n; i++) this.y[i] = samples[i].y === positiveClass ? 1 : -1;
    this.alpha = new Float64Array(n);

    this.smo();

    for (let i = 0; i < n; i++) if (this.alpha[i] > 1e-6) this.supportIndices.push(i);
  }

  private f(x: number[]): number {
    let s = this.b;
    for (let i = 0; i < this.X.length; i++) {
      if (this.alpha[i] === 0) continue;
      s += this.alpha[i] * this.y[i] * kernel(this.X[i], x, this.opts);
    }
    return s;
  }

  private smo(): void {
    const n = this.X.length;
    const { C, tol, epochs } = this.opts;
    let passes = 0;

    for (let epoch = 0; epoch < epochs && passes < 5; epoch++) {
      let changed = 0;

      for (let i = 0; i < n; i++) {
        const Ei = this.f(this.X[i]) - this.y[i];
        const ai = this.alpha[i];
        // KKT violation check: only pairs that break the optimality conditions
        // are worth optimising.
        if (!((this.y[i] * Ei < -tol && ai < C) || (this.y[i] * Ei > tol && ai > 0))) continue;

        // Deterministic partner choice keeps the model reproducible.
        const j = (i * 7919 + epoch * 104729) % n;
        if (j === i) continue;

        const Ej = this.f(this.X[j]) - this.y[j];
        const aj = this.alpha[j];

        let L: number;
        let H: number;
        if (this.y[i] !== this.y[j]) {
          L = Math.max(0, aj - ai);
          H = Math.min(C, C + aj - ai);
        } else {
          L = Math.max(0, ai + aj - C);
          H = Math.min(C, ai + aj);
        }
        if (L >= H) continue;

        const kii = kernel(this.X[i], this.X[i], this.opts);
        const kjj = kernel(this.X[j], this.X[j], this.opts);
        const kij = kernel(this.X[i], this.X[j], this.opts);
        const eta = 2 * kij - kii - kjj;
        if (eta >= -1e-12) continue;

        let ajNew = aj - (this.y[j] * (Ei - Ej)) / eta;
        ajNew = Math.min(H, Math.max(L, ajNew));
        if (Math.abs(ajNew - aj) < 1e-7) continue;

        const aiNew = ai + this.y[i] * this.y[j] * (aj - ajNew);

        const b1 =
          this.b - Ei - this.y[i] * (aiNew - ai) * kii - this.y[j] * (ajNew - aj) * kij;
        const b2 =
          this.b - Ej - this.y[i] * (aiNew - ai) * kij - this.y[j] * (ajNew - aj) * kjj;

        this.alpha[i] = aiNew;
        this.alpha[j] = ajNew;
        if (aiNew > 0 && aiNew < C) this.b = b1;
        else if (ajNew > 0 && ajNew < C) this.b = b2;
        else this.b = (b1 + b2) / 2;

        changed += 1;
      }

      passes = changed === 0 ? passes + 1 : 0;
    }
  }

  /** Primal weights. Only defined for the linear kernel. */
  weights(): number[] | null {
    if (this.opts.kernel !== "linear") return null;
    const d = this.X[0]?.length ?? 2;
    const w = new Array<number>(d).fill(0);
    for (let i = 0; i < this.X.length; i++) {
      if (this.alpha[i] === 0) continue;
      for (let k = 0; k < d; k++) w[k] += this.alpha[i] * this.y[i] * this.X[i][k];
    }
    return w;
  }

  decision(x: number[]): number {
    return this.f(x);
  }
}

/**
 * Multi-class SVM by one-vs-rest. `k` binary problems, each asking "class c or
 * everything else", and the largest signed distance wins.
 */
export class Svm implements Classifier {
  readonly models: BinarySvm[];
  readonly nClasses: number;

  constructor(samples: Sample[], nClasses: number, opts: SvmOptions) {
    this.nClasses = nClasses;
    this.models =
      nClasses === 2
        ? [new BinarySvm(samples, 1, opts)]
        : Array.from({ length: nClasses }, (_, c) => new BinarySvm(samples, c, opts));
  }

  detailFor(x: number[]): SvmDetail {
    const d = this.models[0].decision(x);
    return { decision: d, predicted: this.predict(x), insideMargin: Math.abs(d) < 1 };
  }

  predict(x: number[]): number {
    if (this.nClasses === 2) return this.models[0].decision(x) >= 0 ? 1 : 0;
    let best = 0;
    let bestScore = -Infinity;
    for (let c = 0; c < this.models.length; c++) {
      const s = this.models[c].decision(x);
      if (s > bestScore) {
        bestScore = s;
        best = c;
      }
    }
    return best;
  }

  /**
   * Squashed decision values. An SVM does not output probabilities — Platt
   * scaling would be needed for that — so this is labelled "confidence" in the
   * UI and used only for shading intensity.
   */
  predictProba(x: number[]): number[] {
    if (this.nClasses === 2) {
      const p = 1 / (1 + Math.exp(-2 * this.models[0].decision(x)));
      return [1 - p, p];
    }
    const scores = this.models.map((m) => m.decision(x));
    const max = Math.max(...scores);
    const exp = scores.map((s) => Math.exp((s - max) * 1.5));
    const sum = exp.reduce((a, b) => a + b, 0) || 1;
    return exp.map((e) => e / sum);
  }

  /** Union of the support vectors across the one-vs-rest models. */
  supportVectorIds(samples: Sample[]): Set<number> {
    const ids = new Set<number>();
    for (const m of this.models) for (const i of m.supportIndices) ids.add(samples[i].id);
    return ids;
  }
}
