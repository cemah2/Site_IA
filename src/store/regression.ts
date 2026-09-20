"use client";

import { create } from "zustand";
import { makeRng, gaussian } from "@/lib/rng";
import type { Point2 } from "@/lib/ml/models/regression";

export type RegressionShape = "linear" | "curved" | "noisy" | "outlier" | "heteroscedastic";

export const REGRESSION_SHAPES: { id: RegressionShape; label: string; teaches: string }[] = [
  { id: "linear", label: "Relation linéaire", teaches: "Le cas où une droite est le bon modèle." },
  { id: "curved", label: "Relation courbe", teaches: "Une droite ne peut pas capturer ça — le biais est structurel." },
  { id: "noisy", label: "Très bruité", teaches: "La relation existe mais le bruit domine. R² s'effondre." },
  { id: "outlier", label: "Avec un point aberrant", teaches: "Les moindres carrés élèvent l'erreur au carré : un seul point peut tout tirer." },
  { id: "heteroscedastic", label: "Bruit croissant", teaches: "La variance augmente avec x — une hypothèse des moindres carrés qui tombe." },
];

interface RegressionState {
  shape: RegressionShape;
  n: number;
  noise: number;
  seed: number;
  points: Point2[];
  setShape: (s: RegressionShape) => void;
  setN: (n: number) => void;
  setNoise: (v: number) => void;
  reseed: () => void;
  setPoints: (p: Point2[]) => void;
  regenerate: () => void;
}

const DOMAIN = { xMin: -3, xMax: 3, yMin: -3.2, yMax: 3.2 };
export const REGRESSION_DOMAIN = DOMAIN;

function build(s: { shape: RegressionShape; n: number; noise: number; seed: number }): Point2[] {
  const rng = makeRng(s.seed);
  const out: Point2[] = [];
  for (let i = 0; i < s.n; i++) {
    const x = DOMAIN.xMin + ((DOMAIN.xMax - DOMAIN.xMin) * (i + 0.5)) / s.n + gaussian(rng) * 0.12;
    let y: number;
    switch (s.shape) {
      case "curved":
        y = 0.42 * x * x - 1.1 + gaussian(rng) * s.noise;
        break;
      case "noisy":
        y = 0.7 * x + gaussian(rng) * s.noise * 3.2;
        break;
      case "heteroscedastic":
        // Noise grows with x: the constant-variance assumption, broken on purpose.
        y = 0.7 * x + gaussian(rng) * s.noise * (0.25 + 0.9 * (x - DOMAIN.xMin));
        break;
      default:
        y = 0.78 * x + 0.25 + gaussian(rng) * s.noise;
    }
    out.push({ id: i, x, y: clamp(y, DOMAIN.yMin, DOMAIN.yMax) });
  }
  if (s.shape === "outlier") {
    out.push({ id: out.length, x: 2.6, y: -2.9 });
    out.push({ id: out.length, x: -2.5, y: 2.85 });
  }
  return out;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

const DEFAULTS = { shape: "linear" as RegressionShape, n: 28, noise: 0.5, seed: 11 };

/** Separate from the classification store: the two problems need different
 *  data, and sharing one store would force awkward reinterpretations. */
export const useRegression = create<RegressionState>((set) => ({
  ...DEFAULTS,
  points: build(DEFAULTS),
  setShape: (shape) => set((s) => ({ shape, points: build({ ...s, shape }) })),
  setN: (n) => set((s) => ({ n, points: build({ ...s, n }) })),
  setNoise: (noise) => set((s) => ({ noise, points: build({ ...s, noise }) })),
  reseed: () =>
    set((s) => {
      const seed = (s.seed * 1103515245 + 12345) % 100000;
      return { seed, points: build({ ...s, seed }) };
    }),
  setPoints: (points) => set({ points }),
  regenerate: () => set((s) => ({ points: build(s) })),
}));
