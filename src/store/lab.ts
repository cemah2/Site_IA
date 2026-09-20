"use client";

import { create } from "zustand";
import {
  classCountFor,
  generateDataset,
  type DatasetId,
} from "@/lib/ml/datasets";
import type { Dataset } from "@/lib/ml/types";

interface LabState {
  kind: DatasetId;
  n: number;
  noise: number;
  seed: number;
  nClasses: number;
  trainRatio: number;
  dataset: Dataset;

  setKind: (kind: DatasetId) => void;
  setN: (n: number) => void;
  setNoise: (noise: number) => void;
  setSeed: (seed: number) => void;
  setNClasses: (n: number) => void;
  setTrainRatio: (r: number) => void;
  reseed: () => void;
  /** Direct edits from the plot (drag, add, delete, relabel). */
  setDataset: (dataset: Dataset) => void;
  regenerate: () => void;
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

  setKind: (kind) => {
    const s = get();
    const nClasses = classCountFor(kind, s.nClasses);
    set({ kind, nClasses, dataset: build({ ...s, kind, nClasses }) });
  },
  setN: (n) => set((s) => ({ n, dataset: build({ ...s, n }) })),
  setNoise: (noise) => set((s) => ({ noise, dataset: build({ ...s, noise }) })),
  setSeed: (seed) => set((s) => ({ seed, dataset: build({ ...s, seed }) })),
  setNClasses: (requested) =>
    set((s) => {
      const nClasses = classCountFor(s.kind, requested);
      return { nClasses, dataset: build({ ...s, nClasses }) };
    }),
  setTrainRatio: (trainRatio) => set({ trainRatio }),
  reseed: () =>
    set((s) => {
      const seed = (s.seed * 1103515245 + 12345) % 100000;
      return { seed, dataset: build({ ...s, seed }) };
    }),
  setDataset: (dataset) => set({ dataset }),
  regenerate: () => set((s) => ({ dataset: build(s) })),
}));
