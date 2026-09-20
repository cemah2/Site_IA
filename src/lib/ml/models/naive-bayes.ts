import { argmax } from "@/lib/rng";
import type { Classifier, Sample } from "../types";

export interface FeatureStat {
  mean: number;
  std: number;
}

export interface BayesDetail {
  /** P(class) — measured from class frequencies in the training set. */
  priors: number[];
  /** `likelihood[class][feature]` = p(xⱼ | class) from the fitted Gaussian. */
  likelihood: number[][];
  /** Π p(xⱼ|class) — the product the "naive" assumption licenses. */
  joint: number[];
  /** prior × joint, before normalisation. This is the numerator of Bayes. */
  unnormalised: number[];
  /** The evidence P(x) = Σ. The denominator. */
  evidence: number;
  /** P(class | x) — what the model finally answers with. */
  posterior: number[];
  predicted: number;
}

/**
 * Gaussian Naive Bayes.
 *
 * Every quantity in Bayes' theorem is kept separately rather than folded into
 * a single score, because the whole point of the page is to show the theorem
 * being *assembled*:
 *
 *     P(c | x) = P(c) · Π p(xⱼ | c)  /  P(x)
 *
 * The "naive" part is the Π: it assumes the features are conditionally
 * independent given the class. That is usually false, and the page shows both
 * why it is false and why the classifier often survives it anyway — the
 * argmax can be right even when the probabilities are badly calibrated.
 */
export class NaiveBayes implements Classifier {
  readonly priors: number[];
  readonly stats: FeatureStat[][];
  readonly nClasses: number;

  constructor(samples: Sample[], nClasses: number, nFeatures = 2) {
    this.nClasses = nClasses;
    const buckets: number[][][] = Array.from({ length: nClasses }, () =>
      Array.from({ length: nFeatures }, () => [] as number[]),
    );

    let total = 0;
    for (const s of samples) {
      if (s.y < 0 || s.y >= nClasses) continue;
      total += 1;
      for (let f = 0; f < nFeatures; f++) buckets[s.y][f].push(s.x[f]);
    }

    this.priors = buckets.map((b) => (total ? b[0].length / total : 0));
    this.stats = buckets.map((perFeature) =>
      perFeature.map((values) => {
        if (values.length === 0) return { mean: 0, std: 1 };
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
        // Variance smoothing: a class with one sample has zero variance, which
        // would make its density infinite at the mean and zero elsewhere.
        return { mean, std: Math.sqrt(variance + 1e-3) };
      }),
    );
  }

  detail(x: number[]): BayesDetail {
    const likelihood = this.stats.map((perFeature) =>
      perFeature.map((st, f) => normalPdf(x[f], st.mean, st.std)),
    );
    const joint = likelihood.map((ls) => ls.reduce((a, b) => a * b, 1));
    const unnormalised = joint.map((j, c) => j * this.priors[c]);
    const evidence = unnormalised.reduce((a, b) => a + b, 0);
    const posterior = evidence
      ? unnormalised.map((u) => u / evidence)
      : new Array(this.nClasses).fill(1 / this.nClasses);

    return {
      priors: this.priors,
      likelihood,
      joint,
      unnormalised,
      evidence,
      posterior,
      predicted: argmax(posterior),
    };
  }

  predict(x: number[]): number {
    // Sum of logs, not product of densities: with more features the product
    // underflows to exactly 0 and every class ties.
    return argmax(this.logScores(x));
  }

  predictProba(x: number[]): number[] {
    const logs = this.logScores(x);
    const max = Math.max(...logs);
    const exp = logs.map((l) => Math.exp(l - max));
    const sum = exp.reduce((a, b) => a + b, 0) || 1;
    return exp.map((e) => e / sum);
  }

  private logScores(x: number[]): number[] {
    return this.stats.map((perFeature, c) => {
      let s = Math.log(this.priors[c] + 1e-12);
      for (let f = 0; f < perFeature.length; f++) {
        s += logNormalPdf(x[f], perFeature[f].mean, perFeature[f].std);
      }
      return s;
    });
  }
}

export function normalPdf(x: number, mean: number, std: number): number {
  const z = (x - mean) / std;
  return Math.exp(-0.5 * z * z) / (std * Math.sqrt(2 * Math.PI));
}

export function logNormalPdf(x: number, mean: number, std: number): number {
  const z = (x - mean) / std;
  return -0.5 * z * z - Math.log(std) - 0.5 * Math.log(2 * Math.PI);
}
