"use client";

import { create } from "zustand";
import {
  classCountFor,
  generateDataset,
  type DatasetId,
} from "@/lib/ml/datasets";
import { clearImported as forgetImported, saveImported } from "@/lib/imported-store";
import type { Dataset } from "@/lib/ml/types";

interface LabState {
  kind: DatasetId;
  n: number;
  noise: number;
  seed: number;
  nClasses: number;
  trainRatio: number;
  dataset: Dataset;
  /**
   * A dataset the reader imported, when there is one.
   *
   * Kept beside the generator settings rather than replacing them: moving any
   * generator control has to rebuild synthetic data, and without this flag
   * there would be no way to tell "the reader wants their own data" from "the
   * reader has not touched anything yet". It also lets every page say, in one
   * line, whose data is on screen.
   */
  imported: Dataset | null;

  setKind: (kind: DatasetId) => void;
  setN: (n: number) => void;
  setNoise: (noise: number) => void;
  setSeed: (seed: number) => void;
  setNClasses: (n: number) => void;
  setTrainRatio: (r: number) => void;
  /** Adopt an imported dataset across the whole site. */
  adoptImported: (dataset: Dataset) => void;
  /** Go back to the generated dataset, keeping the generator settings. */
  clearImported: () => void;
  reseed: () => void;
  /** Direct edits from the plot (drag, add, delete, relabel). */
  setDataset: (dataset: Dataset) => void;
  regenerate: () => void;
  /** Restore several settings in one go — used when opening a shared link. */
  applyParams: (patch: Partial<Pick<LabState, "kind" | "n" | "noise" | "seed" | "nClasses" | "trainRatio">>) => void;
}

const DEFAULTS = {
  kind: "moons" as DatasetId,
  n: 160,
  noise: 0.18,
  seed: 42,
  nClasses: 2,
  trainRatio: 0.7,
};

function build(s: Pick<LabState, "kind" | "n" | "noise" | "seed" | "nClasses">): Dataset {
  return generateDataset({
    kind: s.kind,
    n: s.n,
    noise: s.noise,
    seed: s.seed,
    nClasses: s.nClasses,
  });
}

/**
 * One dataset, shared by every page.
 *
 * This is the spine of the site: the points you drag on the home page are the
 * same points KNN, the SVM and the neural network are looking at three pages
 * later. Comparing algorithms only teaches anything if the problem is held
 * fixed while the algorithm changes, and a global store is what makes that
 * true by construction rather than by the learner's memory.
 */
export const useLab = create<LabState>((set, get) => ({
  ...DEFAULTS,
  dataset: build(DEFAULTS),
  imported: null,

  setKind: (kind) => {
    const s = get();
    const nClasses = classCountFor(kind, s.nClasses);
    forgetImported();
    set({ kind, nClasses, imported: null, dataset: build({ ...s, kind, nClasses }) });
  },
  setN: (n) => {
    forgetImported();
    set((s) => ({ n, imported: null, dataset: build({ ...s, n }) }));
  },
  setNoise: (noise) => {
    forgetImported();
    set((s) => ({ noise, imported: null, dataset: build({ ...s, noise }) }));
  },
  setSeed: (seed) => {
    forgetImported();
    set((s) => ({ seed, imported: null, dataset: build({ ...s, seed }) }));
  },
  setNClasses: (requested) => {
    forgetImported();
    set((s) => {
      const nClasses = classCountFor(s.kind, requested);
      return { nClasses, imported: null, dataset: build({ ...s, nClasses }) };
    });
  },
  setTrainRatio: (trainRatio) => set({ trainRatio }),
  reseed: () => {
    forgetImported();
    return set((s) => {
      const seed = (s.seed * 1103515245 + 12345) % 100000;
      return { seed, imported: null, dataset: build({ ...s, seed }) };
    });
  },
  setDataset: (dataset) => set({ dataset }),
  regenerate: () => {
    forgetImported();
    set((s) => ({ imported: null, dataset: build(s) }));
  },

  adoptImported: (dataset) => {
    saveImported(dataset);
    set({ imported: dataset, dataset });
  },
  clearImported: () => {
    forgetImported();
    set((s) => ({ imported: null, dataset: build(s) }));
  },

  /**
   * Apply several settings at once, rebuilding the data a single time.
   *
   * Restoring a shared link through the individual setters would regenerate the
   * dataset five times and, worse, would pass through intermediate states that
   * never existed — a class count that the chosen generator does not allow, for
   * instance. One transaction, one dataset.
   */
  applyParams: (patch) => {
    forgetImported();
    set((s) => {
      const kind = patch.kind ?? s.kind;
      const next = {
        kind,
        n: patch.n ?? s.n,
        noise: patch.noise ?? s.noise,
        seed: patch.seed ?? s.seed,
        nClasses: classCountFor(kind, patch.nClasses ?? s.nClasses),
      };
      return {
        ...next,
        trainRatio: patch.trainRatio ?? s.trainRatio,
        imported: null,
        dataset: build(next),
      };
    });
  },
}));
