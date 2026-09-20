import type { Classifier, Sample } from "./types";
import { NearestCentroid } from "./models/nearest-centroid";
import { Knn } from "./models/knn";
import { NaiveBayes } from "./models/naive-bayes";
import { DecisionTree } from "./models/decision-tree";
import { RandomForest } from "./models/random-forest";
import { Svm } from "./models/svm";
import { NeuralNet } from "./models/neural-net";
import type { ActivationName } from "./models/activations";

export type AlgoId =
  | "centroid"
  | "knn"
  | "bayes"
  | "tree"
  | "forest"
  | "svm"
  | "mlp";

export interface AlgoParams {
  k: number;
  weighted: boolean;
  maxDepth: number;
  minSamplesLeaf: number;
  criterion: "gini" | "entropy";
  nTrees: number;
  C: number;
  kernel: "linear" | "rbf" | "poly";
  gamma: number;
  degree: number;
  hidden: number[];
  activation: ActivationName;
  learningRate: number;
  epochs: number;
  l2: number;
  seed: number;
}

export const DEFAULT_PARAMS: AlgoParams = {
  k: 5,
  weighted: false,
  maxDepth: 4,
  minSamplesLeaf: 3,
  criterion: "gini",
  nTrees: 12,
  C: 1,
  kernel: "rbf",
  gamma: 1,
  degree: 3,
  hidden: [6, 4],
  activation: "tanh",
  learningRate: 0.08,
  epochs: 120,
  l2: 0,
  seed: 7,
};

export interface AlgoSpec {
  id: AlgoId;
  label: string;
  href: string;
  /** What this model assumes about the world. The honest one-liner. */
  assumption: string;
  /** Big-O of a single prediction, in learner-friendly terms. */
  predictCost: string;
  /** How many numbers the fitted model stores. */
  parameterCount: (model: Classifier, nTrain: number) => number;
}

export const ALGOS: Record<AlgoId, AlgoSpec> = {
  centroid: {
    id: "centroid",
    label: "Nearest Centroid",
    href: "/classification/nearest-centroid/",
    assumption: "Chaque classe est un nuage rond, résumable par son centre.",
    predictCost: "O(k) — une distance par classe",
    parameterCount: (m) => (m as NearestCentroid).centroids.flat().length,
  },
  knn: {
    id: "knn",
    label: "K-Nearest Neighbors",
    href: "/classification/knn/",
    assumption: "Les points proches se ressemblent. Aucune forme globale supposée.",
    predictCost: "O(n) — il compare à tout le dataset",
    parameterCount: (_m, n) => n * 3,
  },
  bayes: {
    id: "bayes",
    label: "Naive Bayes",
    href: "/classification/naive-bayes/",
    assumption: "Chaque feature suit une gaussienne, et elles sont indépendantes dans chaque classe.",
    predictCost: "O(k·d) — une densité par classe et par feature",
    parameterCount: (m) => {
      const nb = m as NaiveBayes;
      return nb.priors.length + nb.stats.flat().length * 2;
    },
  },
  tree: {
    id: "tree",
    label: "Arbre de décision",
    href: "/classification/arbre-de-decision/",
    assumption: "La frontière peut se décomposer en coupures perpendiculaires aux axes.",
    predictCost: "O(profondeur) — quelques comparaisons",
    parameterCount: (m) => (m as DecisionTree).leafCount * 2,
  },
  forest: {
    id: "forest",
    label: "Random Forest",
    href: "/classification/random-forest/",
    assumption: "Plusieurs arbres imparfaits mais différents valent mieux qu'un seul.",
    predictCost: "O(T · profondeur)",
    parameterCount: (m) => (m as RandomForest).trees.reduce((a, t) => a + t.leafCount * 2, 0),
  },
  svm: {
    id: "svm",
    label: "SVM",
    href: "/classification/svm/",
    assumption: "Il existe une marge large entre les classes, éventuellement après passage dans un autre espace.",
    predictCost: "O(#vecteurs de support)",
    parameterCount: (m) => {
      const svm = m as Svm;
      return svm.models.reduce((a, b) => a + b.supportIndices.length + 1, 0);
    },
  },
  mlp: {
    id: "mlp",
    label: "Réseau de neurones",
    href: "/reseaux/entrainement/",
    assumption: "Une composition de transformations simples peut approcher n'importe quelle frontière.",
    predictCost: "O(nombre de poids)",
    parameterCount: (m) => (m as NeuralNet).parameterCount,
  },
};

export const ALGO_ORDER: AlgoId[] = ["centroid", "knn", "bayes", "tree", "forest", "svm", "mlp"];

export interface FitResult {
  model: Classifier;
  /** Wall-clock milliseconds spent fitting. Real, measured, not estimated. */
  trainMs: number;
  parameters: number;
}

/**
 * Build and fit one model from a uniform parameter bag.
 *
 * A single entry point matters for the comparison page: "same data, same split,
 * same code path, only the algorithm changes" is the claim the page makes, and
 * routing every model through one function is how that claim stays true.
 */
export function fitModel(
  algo: AlgoId,
  samples: Sample[],
  nClasses: number,
  params: AlgoParams,
): FitResult {
  const t0 = performance.now();
  let model: Classifier;

  switch (algo) {
    case "centroid":
      model = new NearestCentroid(samples, nClasses);
      break;
    case "knn":
      model = new Knn(samples, nClasses, params.k, "euclidean", params.weighted);
      break;
    case "bayes":
      model = new NaiveBayes(samples, nClasses);
      break;
    case "tree":
      model = new DecisionTree(samples, nClasses, {
        maxDepth: params.maxDepth,
        minSamplesLeaf: params.minSamplesLeaf,
        criterion: params.criterion,
      });
      break;
    case "forest":
      model = new RandomForest(samples, nClasses, {
        nTrees: params.nTrees,
        maxDepth: params.maxDepth,
        minSamplesLeaf: params.minSamplesLeaf,
        criterion: params.criterion,
        maxFeatures: 1,
        seed: params.seed,
        bagFraction: 0.8,
      });
      break;
    case "svm":
      model = new Svm(samples, nClasses, {
        C: params.C,
        kernel: params.kernel,
        gamma: params.gamma,
        degree: params.degree,
        epochs: 60,
        tol: 1e-3,
      });
      break;
    case "mlp": {
      const net = new NeuralNet({
        hidden: params.hidden,
        activation: params.activation,
        learningRate: params.learningRate,
        l2: params.l2,
        seed: params.seed,
        nInputs: 2,
        nOutputs: nClasses,
      });
      for (let e = 0; e < params.epochs; e++) net.trainEpoch(samples);
      model = net;
      break;
    }
  }

  const trainMs = performance.now() - t0;
  return { model, trainMs, parameters: ALGOS[algo].parameterCount(model, samples.length) };
}
