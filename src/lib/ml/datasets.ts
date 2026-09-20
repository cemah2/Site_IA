import { gaussian, makeRng, shuffle, uniform, type Rng } from "@/lib/rng";
import type { Dataset, Sample, Split } from "./types";

export type DatasetId =
  | "blobs"
  | "linear"
  | "moons"
  | "circles"
  | "spirals"
  | "xor"
  | "gaussian"
  | "outliers"
  | "imbalanced"
  | "overlap";

export interface DatasetSpec {
  id: DatasetId;
  label: string;
  /** Two-to-six character label for tight segmented controls. */
  short: string;
  /** One line explaining what this shape is *for* — which idea it stresses. */
  teaches: string;
  /** Some shapes only make sense with a fixed number of classes. */
  fixedClasses?: number;
  maxClasses?: number;
}

export const DATASET_SPECS: DatasetSpec[] = [
  {
    id: "blobs",
    short: "Blobs",
    label: "Clusters gaussiens",
    teaches: "Le cas facile : des groupes compacts et bien séparés. Presque tout marche.",
  },
  {
    id: "linear",
    short: "Linéaire",
    label: "Séparables linéairement",
    teaches: "Une seule droite suffit. Sert de référence avant de casser cette hypothèse.",
    fixedClasses: 2,
  },
  {
    id: "moons",
    short: "Lunes",
    label: "Deux lunes",
    teaches: "Séparables, mais pas par une droite. Le test standard de la non-linéarité.",
    fixedClasses: 2,
  },
  {
    id: "circles",
    short: "Cercles",
    label: "Cercles concentriques",
    teaches: "Aucune droite ne marche, mais un noyau RBF les sépare trivialement.",
    fixedClasses: 2,
  },
  {
    id: "spirals",
    short: "Spirales",
    label: "Spirales",
    teaches: "Frontière très courbée : exige un modèle à forte capacité.",
    maxClasses: 4,
  },
  {
    id: "xor",
    short: "XOR",
    label: "XOR",
    teaches: "Le contre-exemple historique : impossible pour un perceptron sans couche cachée.",
    fixedClasses: 2,
  },
  {
    id: "gaussian",
    short: "Gauss",
    label: "Deux gaussiennes",
    teaches: "Le cas où Naive Bayes est exactement le bon modèle : les données suivent son hypothèse.",
    fixedClasses: 2,
  },
  {
    id: "outliers",
    short: "Outliers",
    label: "Clusters + outliers",
    teaches: "Quelques points aberrants. Montre qui est robuste (grand K, grand C) et qui ne l'est pas.",
  },
  {
    id: "imbalanced",
    short: "Déséq.",
    label: "Classes déséquilibrées",
    teaches: "90 % / 10 %. Révèle pourquoi l'accuracy seule est un mauvais juge.",
    fixedClasses: 2,
  },
  {
    id: "overlap",
    short: "Recouvr.",
    label: "Classes qui se recouvrent",
    teaches: "Les classes se chevauchent vraiment : aucune frontière ne peut atteindre 100 %.",
    fixedClasses: 2,
  },
];

export const DATASET_LABELS: Record<DatasetId, string> = Object.fromEntries(
  DATASET_SPECS.map((s) => [s.id, s.label]),
) as Record<DatasetId, string>;

export interface GenerateOptions {
  kind: DatasetId;
  /** Number of samples, total across classes. */
  n: number;
  /** Gaussian jitter added to every coordinate, in data units. */
  noise: number;
  seed: number;
  nClasses: number;
}

const DEFAULT_CLASS_NAMES = ["A", "B", "C", "D", "E"];

/** Clamp a requested class count to what the chosen shape can express. */
export function classCountFor(kind: DatasetId, requested: number): number {
  const spec = DATASET_SPECS.find((s) => s.id === kind);
  if (!spec) return requested;
  if (spec.fixedClasses) return spec.fixedClasses;
  return Math.min(requested, spec.maxClasses ?? 5);
}

/**
 * All generators emit coordinates in roughly [-3, 3] on both axes so that a
 * single fixed viewport works for every shape — switching datasets never
 * rescales the plot under the learner, which would look like the data moved.
 */
export function generateDataset(opts: GenerateOptions): Dataset {
  const nClasses = classCountFor(opts.kind, opts.nClasses);
  const rng = makeRng(opts.seed);
  const samples: Sample[] = [];
  const push = (x: number, y: number, label: number) => {
    samples.push({
      id: samples.length,
      x: [x + gaussian(rng) * opts.noise, y + gaussian(rng) * opts.noise],
      y: label,
    });
  };

  switch (opts.kind) {
    case "blobs": {
      const centres = ringCentres(nClasses, 1.75);
      for (let i = 0; i < opts.n; i++) {
        const c = i % nClasses;
        push(centres[c][0] + gaussian(rng) * 0.45, centres[c][1] + gaussian(rng) * 0.45, c);
      }
      break;
    }
    case "linear": {
      for (let i = 0; i < opts.n; i++) {
        const c = i % 2;
        // Project a band onto a slanted axis so the true boundary is oblique,
        // not axis-aligned — axis-aligned would flatter decision trees.
        const t = uniform(rng, -2.4, 2.4);
        const offset = (c === 0 ? -1 : 1) * 0.95 + gaussian(rng) * 0.42;
        push(t * 0.82 - offset * 0.57, t * 0.57 + offset * 0.82, c);
      }
      break;
    }
    case "moons": {
      for (let i = 0; i < opts.n; i++) {
        const c = i % 2;
        const t = uniform(rng, 0, Math.PI);
        if (c === 0) push(2 * Math.cos(t) - 0.5, 2 * Math.sin(t) - 0.6, 0);
        else push(2 * Math.cos(t) + 0.5, -2 * Math.sin(t) + 0.6, 1);
      }
      break;
    }
    case "circles": {
      for (let i = 0; i < opts.n; i++) {
        const c = i % 2;
        const t = uniform(rng, 0, 2 * Math.PI);
        const r = c === 0 ? 0.95 + gaussian(rng) * 0.18 : 2.35 + gaussian(rng) * 0.18;
        push(r * Math.cos(t), r * Math.sin(t), c);
      }
      break;
    }
    case "spirals": {
      for (let i = 0; i < opts.n; i++) {
        const c = i % nClasses;
        const t = (i / opts.n) * 2.6 + 0.35;
        const angle = t * 2.6 + (c * 2 * Math.PI) / nClasses;
        const r = t * 1.05;
        push(r * Math.cos(angle), r * Math.sin(angle), c);
      }
      break;
    }
    case "xor": {
      for (let i = 0; i < opts.n; i++) {
        const qx = rng() < 0.5 ? -1 : 1;
        const qy = rng() < 0.5 ? -1 : 1;
        push(qx * 1.35 + gaussian(rng) * 0.5, qy * 1.35 + gaussian(rng) * 0.5, qx * qy > 0 ? 0 : 1);
      }
      break;
    }
    case "gaussian": {
      // Axis-aligned, unequal variances — exactly Gaussian Naive Bayes' model.
      for (let i = 0; i < opts.n; i++) {
        const c = i % 2;
        if (c === 0) push(-1.0 + gaussian(rng) * 0.75, -0.6 + gaussian(rng) * 0.5, 0);
        else push(1.1 + gaussian(rng) * 0.5, 0.7 + gaussian(rng) * 0.95, 1);
      }
      break;
    }
    case "outliers": {
      const centres = ringCentres(nClasses, 1.7);
      const nOut = Math.max(3, Math.round(opts.n * 0.06));
      for (let i = 0; i < opts.n - nOut; i++) {
        const c = i % nClasses;
        push(centres[c][0] + gaussian(rng) * 0.42, centres[c][1] + gaussian(rng) * 0.42, c);
      }
      for (let i = 0; i < nOut; i++) {
        // Deliberately placed deep inside a *rival* cluster.
        const c = i % nClasses;
        const wrong = (c + 1) % nClasses;
        push(centres[wrong][0] + gaussian(rng) * 0.4, centres[wrong][1] + gaussian(rng) * 0.4, c);
      }
      break;
    }
    case "imbalanced": {
      const nMinority = Math.max(4, Math.round(opts.n * 0.1));
      for (let i = 0; i < opts.n - nMinority; i++) {
        push(-0.75 + gaussian(rng) * 1.15, -0.35 + gaussian(rng) * 1.15, 0);
      }
      for (let i = 0; i < nMinority; i++) {
        push(1.55 + gaussian(rng) * 0.55, 1.35 + gaussian(rng) * 0.55, 1);
      }
      break;
    }
    case "overlap": {
      for (let i = 0; i < opts.n; i++) {
        const c = i % 2;
        const mx = c === 0 ? -0.62 : 0.62;
        push(mx + gaussian(rng) * 1.15, gaussian(rng) * 1.15, c);
      }
      break;
    }
  }

  shuffle(samples, rng);
  samples.forEach((s, i) => (s.id = i));

  return {
    name: DATASET_LABELS[opts.kind],
    samples,
    featureNames: ["x₁", "x₂"],
    classNames: DEFAULT_CLASS_NAMES.slice(0, nClasses),
    domain: [
      [-3.2, 3.2],
      [-3.2, 3.2],
    ],
  };
}

/** Class centres placed on a circle, so no class is privileged by position. */
function ringCentres(n: number, radius: number): [number, number][] {
  if (n === 1) return [[0, 0]];
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * 2 * Math.PI - Math.PI / 2;
    return [radius * Math.cos(a), radius * Math.sin(a)] as [number, number];
  });
}

/**
 * Stratified train/test split: each class keeps its proportion in both halves.
 * Without stratification a small class can vanish from the training set and the
 * resulting "the model never predicts C" is an artefact of the split, not of
 * the algorithm — a confusing thing to show a beginner.
 */
export function splitDataset(dataset: Dataset, trainRatio: number, seed: number): Split {
  const rng: Rng = makeRng(seed ^ 0x9e3779b9);
  const byClass = new Map<number, Sample[]>();
  for (const s of dataset.samples) {
    const bucket = byClass.get(s.y);
    if (bucket) bucket.push(s);
    else byClass.set(s.y, [s]);
  }
  const train: Sample[] = [];
  const test: Sample[] = [];
  for (const bucket of byClass.values()) {
    const shuffled = shuffle([...bucket], rng);
    const nTrain = Math.max(1, Math.round(shuffled.length * trainRatio));
    train.push(...shuffled.slice(0, nTrain));
    test.push(...shuffled.slice(nTrain));
  }
  return { train: shuffle(train, rng), test: shuffle(test, rng) };
}

/** Add a point at a data-space location; returns a new dataset object. */
export function withPoint(dataset: Dataset, x: number, y: number, label: number): Dataset {
  const nextId = dataset.samples.reduce((m, s) => Math.max(m, s.id), -1) + 1;
  return { ...dataset, samples: [...dataset.samples, { id: nextId, x: [x, y], y: label }] };
}

export function withoutPoint(dataset: Dataset, id: number): Dataset {
  return { ...dataset, samples: dataset.samples.filter((s) => s.id !== id) };
}

export function movePoint(dataset: Dataset, id: number, x: number, y: number): Dataset {
  return {
    ...dataset,
    samples: dataset.samples.map((s) => (s.id === id ? { ...s, x: [x, y] } : s)),
  };
}

export function relabelPoint(dataset: Dataset, id: number, label: number): Dataset {
  return {
    ...dataset,
    samples: dataset.samples.map((s) => (s.id === id ? { ...s, y: label } : s)),
  };
}
