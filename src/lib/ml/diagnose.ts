import type { Evaluation } from "./metrics";
import { ALGOS, type AlgoId, type AlgoParams } from "./registry";
import type { DatasetId } from "./datasets";

export interface Diagnosis {
  tone: "good" | "warning" | "critical" | "note";
  title: string;
  body: string;
}

/**
 * Read a result and say what it means.
 *
 * The brief asks for an "automatic explanation of the result". This is a small
 * rule base, not a model: each rule is a condition a practitioner would
 * actually check, phrased as the sentence they would actually say. Rules are
 * ordered by how much they matter, and the most important two or three are
 * shown — a wall of advice teaches nothing.
 *
 * Every rule states the evidence it is reading, so the learner can disagree
 * with it. That matters more than the rule being right.
 */
export function diagnose({
  algo,
  params,
  train,
  test,
  dataset,
  nTrain,
}: {
  algo: AlgoId;
  params: AlgoParams;
  train: Evaluation;
  test: Evaluation;
  dataset: DatasetId;
  nTrain: number;
}): Diagnosis[] {
  const out: Diagnosis[] = [];
  const gap = train.accuracy - test.accuracy;
  const aboveBaseline = test.accuracy - test.baseline;

  if (test.accuracy <= test.baseline + 0.02) {
    out.push({
      tone: "critical",
      title: "Le modèle ne fait pas mieux que la classe majoritaire",
      body: `${(test.accuracy * 100).toFixed(1)} % contre ${(test.baseline * 100).toFixed(1)} % pour un modèle qui répondrait toujours la même chose. Soit les hypothèses de ${ALGOS[algo].label} ne collent pas du tout à ces données, soit le modèle est trop contraint pour apprendre quoi que ce soit.`,
    });
  }

  if (gap > 0.15) {
    out.push({
      tone: "critical",
      title: "Surapprentissage net",
      body: `${(train.accuracy * 100).toFixed(1)} % sur les points vus, ${(test.accuracy * 100).toFixed(1)} % sur les autres — un écart de ${(gap * 100).toFixed(1)} points. Le modèle mémorise au lieu de généraliser. ${simplifyHint(algo, params)}`,
    });
  } else if (gap > 0.07) {
    out.push({
      tone: "warning",
      title: "Début de surapprentissage",
      body: `Écart de ${(gap * 100).toFixed(1)} points entre entraînement et test. Ce n'est pas alarmant, mais c'est la direction à surveiller. ${simplifyHint(algo, params)}`,
    });
  }

  if (nTrain < 40) {
    out.push({
      tone: "warning",
      title: "Peu de données d'entraînement",
      body: `${nTrain} points seulement. À cette taille, l'accuracy de test varie énormément d'un découpage à l'autre : un écart de quelques points entre deux modèles n'est probablement que du bruit.`,
    });
  }

  // Rules that name a specific, checkable mismatch between model and data.
  if (algo === "centroid" && (dataset === "circles" || dataset === "moons" || dataset === "spirals" || dataset === "xor")) {
    out.push({
      tone: "note",
      title: "Le modèle ne peut structurellement pas réussir",
      body: "Nearest Centroid ne produit que des frontières droites (le diagramme de Voronoï de ses centres). Sur cette forme de données, aucun réglage ne peut l'aider : le problème n'est pas l'entraînement, c'est l'hypothèse du modèle.",
    });
  }

  if (algo === "svm" && params.kernel === "linear" && (dataset === "circles" || dataset === "moons" || dataset === "xor" || dataset === "spirals")) {
    out.push({
      tone: "note",
      title: "Essayez un noyau RBF",
      body: "Un SVM linéaire ne trace qu'un hyperplan. Ces données ne sont pas linéairement séparables — c'est exactement le cas que le kernel trick résout.",
    });
  }

  if (algo === "knn" && params.k === 1 && gap > 0.05) {
    out.push({
      tone: "note",
      title: "K = 1 colle au bruit",
      body: "Avec un seul voisin, chaque point aberrant crée sa propre région. Montez K : la frontière se lissera et l'écart entraînement / test devrait se réduire.",
    });
  }

  if (algo === "knn" && params.k > nTrain * 0.4) {
    out.push({
      tone: "note",
      title: "K très grand par rapport au jeu de données",
      body: `K = ${params.k} sur ${nTrain} points d'entraînement : le modèle consulte une part énorme du dataset à chaque prédiction et converge vers « toujours la classe majoritaire ».`,
    });
  }

  if (algo === "tree" && params.maxDepth >= 7) {
    out.push({
      tone: "note",
      title: "Arbre très profond",
      body: "Au-delà de 6 ou 7 niveaux, un arbre isole des points individuels. Il reste techniquement lisible, mais on ne peut plus en tirer de règle, et il aura appris le bruit.",
    });
  }

  if (algo === "mlp" && params.hidden.length === 0) {
    out.push({
      tone: "note",
      title: "Sans couche cachée, c'est une régression logistique",
      body: "La frontière ne peut être qu'une droite. Ajoutez au moins une couche cachée pour que le réseau puisse courber sa frontière.",
    });
  }

  if (algo === "svm" && params.kernel === "rbf" && params.gamma > 5) {
    out.push({
      tone: "note",
      title: "γ élevé : influence très locale",
      body: "Chaque point ne compte que dans son voisinage immédiat, ce qui fragmente la frontière en bulles autour des données d'entraînement. Le nombre de vecteurs de support en est le signal.",
    });
  }

  if (out.length === 0 && aboveBaseline > 0.15 && gap < 0.05) {
    out.push({
      tone: "good",
      title: "Résultat sain",
      body: `${(test.accuracy * 100).toFixed(1)} % sur des points jamais vus, contre ${(test.baseline * 100).toFixed(1)} % pour la baseline, et un écart entraînement / test de seulement ${(gap * 100).toFixed(1)} points. Le modèle a appris une structure réelle, pas du bruit.`,
    });
  }

  if (dataset === "overlap" && test.accuracy < 0.92 && gap < 0.1) {
    out.push({
      tone: "note",
      title: "Une partie de l'erreur est irréductible",
      body: "Sur ce dataset les classes se chevauchent vraiment. Même le classifieur optimal se tromperait : viser 100 % ici, c'est chercher à mémoriser le bruit.",
    });
  }

  if (dataset === "imbalanced") {
    const minority = test.perClass.reduce((a, b) => (b.support < a.support ? b : a));
    out.push({
      tone: minority.recall < 0.5 ? "warning" : "note",
      title: `La classe minoritaire « ${minority.name} » est rattrapée à ${(minority.recall * 100).toFixed(0)} %`,
      body: `Elle ne représente que ${minority.support} points de test. L'accuracy globale masque complètement sa performance — regardez le rappel et la matrice de confusion, pas le chiffre global.`,
    });
  }

  return out.slice(0, 3);
}

function simplifyHint(algo: AlgoId, params: AlgoParams): string {
  switch (algo) {
    case "knn":
      return `Augmentez K (actuellement ${params.k}).`;
    case "tree":
      return `Réduisez la profondeur (actuellement ${params.maxDepth}) ou augmentez le minimum par feuille.`;
    case "forest":
      return `Réduisez la profondeur des arbres, ou ajoutez-en.`;
    case "svm":
      return params.kernel === "rbf"
        ? `Baissez C (actuellement ${params.C}) ou γ (actuellement ${params.gamma}).`
        : `Baissez C (actuellement ${params.C}).`;
    case "mlp":
      return `Réduisez l'architecture, augmentez la régularisation L2, ou entraînez moins longtemps.`;
    default:
      return `Contraignez davantage le modèle, ou donnez-lui plus de données.`;
  }
}
