import { generateDataset, splitDataset } from "./datasets";
import { DEFAULT_PARAMS, fitModel } from "./registry";
import type { Sample } from "./types";

/**
 * Three ways to accidentally let the answer into the training data, each run
 * both correctly and incorrectly so the difference can be *measured* rather
 * than asserted.
 *
 * Measuring matters here more than usual, because the received wisdom is
 * partly wrong. The leak everyone repeats — scaling before splitting — is worth
 * essentially nothing on this kind of data, while the two nobody mentions are
 * worth about three points each. A page that simply recited the standard list
 * would leave a reader guarding the wrong door.
 */

export type LeakKind = "tuning" | "duplicates" | "scaling";

export interface LeakRun {
  /** What the dishonest protocol would have reported. */
  leaky: number;
  /** What an honest protocol reports on the same data. */
  honest: number;
}

export interface LeakResult {
  runs: LeakRun[];
  leakyMean: number;
  honestMean: number;
  /** Positive = the flawed protocol flatters you. */
  optimism: number;
  ms: number;
}

const K_GRID = [1, 2, 3, 5, 7, 9, 12, 15, 20, 25, 31, 40];

function accuracy(model: { predict(x: number[]): number }, samples: Sample[]): number {
  if (!samples.length) return 0;
  let ok = 0;
  for (const s of samples) if (model.predict(s.x) === s.y) ok += 1;
  return ok / samples.length;
}

/** Min–max rescaling, which is what makes the scaling leak visible at all. */
function minmax(samples: Sample[], stats?: { lo: number[]; hi: number[] }) {
  const lo = [0, 1].map((j) => Math.min(...samples.map((p) => p.x[j])));
  const hi = [0, 1].map((j) => Math.max(...samples.map((p) => p.x[j])));
  const use = stats ?? { lo, hi };
  return {
    samples: samples.map((p) => ({
      ...p,
      x: [0, 1].map((j) => (p.x[j] - use.lo[j]) / Math.max(1e-9, use.hi[j] - use.lo[j])),
    })),
    stats: use,
  };
}

export function runLeakExperiment(
  kind: LeakKind,
  repetitions: number,
  noise: number,
  outlierScale = 20,
): LeakResult {
  const t0 = performance.now();
  const runs: LeakRun[] = [];

  for (let seed = 1; seed <= repetitions; seed++) {
    if (kind === "tuning") {
      // Three parts: train, validation, and a test set that must be opened once.
      const base = generateDataset({ kind: "moons", n: 160, noise, seed, nClasses: 2 });
      const a = splitDataset(base, 0.6, seed * 31);
      const b = splitDataset({ ...base, samples: a.test }, 0.5, seed * 17);
      let leaky = -1;
      let bestVal = -1;
      let bestK = 5;
      for (const k of K_GRID) {
        const { model } = fitModel("knn", a.train, 2, { ...DEFAULT_PARAMS, k });
        // The flawed protocol: try every K against the test set and keep the best.
        leaky = Math.max(leaky, accuracy(model, b.test));
        const val = accuracy(model, b.train);
        if (val > bestVal) {
          bestVal = val;
          bestK = k;
        }
      }
      const { model } = fitModel("knn", a.train, 2, { ...DEFAULT_PARAMS, k: bestK });
      runs.push({ leaky, honest: accuracy(model, b.test) });
      continue;
    }

    if (kind === "duplicates") {
      const base = generateDataset({ kind: "moons", n: 120, noise, seed, nClasses: 2 });
      // A third of the rows recorded twice: a botched merge, or repeated measures
      // of the same subject. The split then puts copies on both sides.
      const copies = base.samples.slice(0, 40).map((s, i) => ({ ...s, id: 10_000 + i }));
      const dirty = splitDataset({ ...base, samples: [...base.samples, ...copies] }, 0.7, seed * 7);
      const { model } = fitModel("knn", dirty.train, 2, { ...DEFAULT_PARAMS, k: 1 });
      const clean = splitDataset(base, 0.7, seed * 7);
      const { model: honestModel } = fitModel("knn", clean.train, 2, { ...DEFAULT_PARAMS, k: 1 });
      runs.push({ leaky: accuracy(model, dirty.test), honest: accuracy(honestModel, clean.test) });
      continue;
    }

    // Scaling: statistics computed over everything, test rows included.
    const base = generateDataset({ kind: "moons", n: 80, noise, seed, nClasses: 2 });
    const samples = base.samples.map((s, i) =>
      i === 3 ? { ...s, x: [s.x[0] * outlierScale, s.x[1]] } : s,
    );
    const sp = splitDataset({ ...base, samples }, 0.6, seed * 13);
    const testIds = new Set(sp.test.map((s) => s.id));
    const all = minmax(samples);
    const { model: leakModel } = fitModel(
      "knn",
      all.samples.filter((s) => !testIds.has(s.id)),
      2,
      { ...DEFAULT_PARAMS, k: 5 },
    );
    const tr = minmax(sp.train);
    const te = minmax(sp.test, tr.stats);
    const { model: honestModel } = fitModel("knn", tr.samples, 2, { ...DEFAULT_PARAMS, k: 5 });
    runs.push({
      leaky: accuracy(leakModel, all.samples.filter((s) => testIds.has(s.id))),
      honest: accuracy(honestModel, te.samples),
    });
  }

  const leakyMean = runs.reduce((a, r) => a + r.leaky, 0) / (runs.length || 1);
  const honestMean = runs.reduce((a, r) => a + r.honest, 0) / (runs.length || 1);
  return {
    runs,
    leakyMean,
    honestMean,
    optimism: leakyMean - honestMean,
    ms: performance.now() - t0,
  };
}
