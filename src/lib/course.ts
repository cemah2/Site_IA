export interface CourseStep {
  href: string;
  title: string;
  /** What the learner will be able to do afterwards, in one sentence. */
  outcome: string;
  /** Rough reading + playing time, in minutes. Honest, not optimistic. */
  minutes: number;
}

export interface CourseChapter {
  id: string;
  title: string;
  /** Why this chapter exists, for someone deciding whether to read it. */
  why: string;
  steps: CourseStep[];
}

/**
 * The site as a course, in reading order.
 *
 * The sidebar is a table of contents: useful once you know what you are looking
 * for, intimidating when you do not. This is the other entry point — an ordered
 * path where each step says what it gives you and roughly what it costs.
 *
 * The order is pedagogical, not alphabetical: every page here only uses ideas
 * introduced before it.
 */
export const COURSE: CourseChapter[] = [
  {
    id: "voir",
    title: "1 · Voir ce que voit un modèle",
    why: "Avant tout algorithme : comprendre que des données, pour une machine, ce sont des nombres dans un espace.",
    steps: [
      {
        href: "/",
        title: "Le principe en une minute",
        outcome: "Vous aurez vu la chaîne complète : des données, un algorithme, un modèle, une prédiction.",
        minutes: 3,
      },
      {
        href: "/donnees/features/",
        title: "Les features",
        outcome: "Vous saurez pourquoi l'échelle d'une mesure peut rendre un modèle aveugle, et comment y remédier.",
        minutes: 8,
      },
      {
        href: "/donnees/datasets/",
        title: "Les formes de données",
        outcome: "Vous reconnaîtrez les problèmes qu'une droite peut résoudre et ceux qu'elle ne peut pas.",
        minutes: 6,
      },
      {
        href: "/donnees/vos-donnees/",
        title: "Vos propres données",
        outcome:
          "Vous saurez amener un fichier à vous sur le site, choisir les colonnes qui portent l'information, et pourquoi les échelles comptent.",
        minutes: 8,
      },
    ],
  },
  {
    id: "premiers",
    title: "2 · Deux algorithmes qu'on peut suivre à la main",
    why: "Les deux modèles les plus simples qui existent. Tout le reste en est une élaboration.",
    steps: [
      {
        href: "/classification/nearest-centroid/",
        title: "Nearest Centroid",
        outcome: "Vous saurez calculer vous-même ce que fait ce modèle, et dire pourquoi il échoue sur des cercles.",
        minutes: 10,
      },
      {
        href: "/classification/knn/",
        title: "K plus proches voisins",
        outcome: "Vous saurez choisir K, et expliquer pourquoi le meilleur K n'est jamais 1.",
        minutes: 12,
      },
    ],
  },
  {
    id: "juger",
    title: "3 · Savoir si un modèle est bon",
    why: "La compétence la plus importante, et la plus souvent négligée. Un chiffre isolé ne veut rien dire.",
    steps: [
      {
        href: "/concepts/overfitting/",
        title: "Sur et sous-apprentissage",
        outcome: "Vous saurez lire un écart entre entraînement et test, et dire lequel des deux problèmes vous avez.",
        minutes: 12,
      },
      {
        href: "/concepts/biais-variance/",
        title: "Biais et variance",
        outcome: "Vous saurez dire si plus de données aiderait, ou si c'est le modèle qu'il faut changer.",
        minutes: 10,
      },
      {
        href: "/concepts/validation-croisee/",
        title: "Validation croisée",
        outcome:
          "Vous saurez à quel point une accuracy de test dépend du hasard, et comment annoncer un chiffre défendable.",
        minutes: 12,
      },
      {
        href: "/concepts/seuil/",
        title: "Le seuil de décision",
        outcome:
          "Vous saurez lire une courbe ROC, choisir un seuil en fonction de ce que coûtent vos erreurs, et repérer quand l'accuracy ment.",
        minutes: 14,
      },
      {
        href: "/concepts/fuite-de-donnees/",
        title: "La fuite de données",
        outcome:
          "Vous saurez reconnaître les situations où un bon score ne veut rien dire, et dans quel ordre s'en méfier.",
        minutes: 12,
      },
      {
        href: "/concepts/idees-fausses/",
        title: "Idées fausses",
        outcome:
          "Vous aurez confronté six croyances répandues à une mesure, dont au moins une que vous teniez pour vraie.",
        minutes: 10,
      },
    ],
  },
  {
    id: "famille",
    title: "4 · Les grandes familles",
    why: "Quatre façons très différentes de découper le même plan. Chacune suppose quelque chose sur vos données.",
    steps: [
      {
        href: "/classification/naive-bayes/",
        title: "Naive Bayes",
        outcome: "Vous saurez lire le théorème de Bayes terme par terme, et ce que « naïf » veut dire ici.",
        minutes: 12,
      },
      {
        href: "/classification/arbre-de-decision/",
        title: "Arbres de décision",
        outcome: "Vous saurez dire pourquoi un arbre a choisi une coupure plutôt qu'une autre.",
        minutes: 12,
      },
      {
        href: "/classification/random-forest/",
        title: "Random Forest",
        outcome: "Vous saurez pourquoi plusieurs modèles médiocres battent un bon modèle seul.",
        minutes: 10,
      },
      {
        href: "/classification/svm/",
        title: "SVM et kernel trick",
        outcome: "Vous saurez ce qu'est une marge, et comment un problème non linéaire devient linéaire ailleurs.",
        minutes: 15,
      },
    ],
  },
  {
    id: "apprendre",
    title: "5 · Comment un modèle apprend vraiment",
    why: "Jusqu'ici les modèles se calculaient. À partir d'ici, ils s'ajustent pas à pas — et c'est ce qui rend les réseaux possibles.",
    steps: [
      {
        href: "/regression/lineaire/",
        title: "Régression linéaire",
        outcome: "Vous saurez ce qu'est une fonction de coût et pourquoi on élève l'erreur au carré.",
        minutes: 10,
      },
      {
        href: "/regression/descente-de-gradient/",
        title: "Descente de gradient",
        outcome: "Vous saurez régler un learning rate et reconnaître une divergence.",
        minutes: 12,
      },
      {
        href: "/regression/boosting/",
        title: "Boosting",
        outcome:
          "Vous saurez en quoi le boosting est l'opposé d'une forêt aléatoire, et pourquoi trop d'arbres y nuit.",
        minutes: 12,
      },
      {
        href: "/regression/logistique/",
        title: "Régression logistique",
        outcome:
          "Vous saurez transformer un score en probabilité, et vous aurez déjà construit un neurone sans le savoir.",
        minutes: 12,
      },
    ],
  },
  {
    id: "reseaux",
    title: "6 · Les réseaux de neurones",
    why: "Une seule brique, répétée. Tout ce qui précède réapparaît ici à l'identique.",
    steps: [
      {
        href: "/reseaux/neurone/",
        title: "Un neurone",
        outcome: "Vous saurez ce que calcule un neurone, et pourquoi il lui faut une activation.",
        minutes: 10,
      },
      {
        href: "/reseaux/activations/",
        title: "Les activations",
        outcome: "Vous saurez pourquoi ReLU a rendu les réseaux profonds entraînables.",
        minutes: 10,
      },
      {
        href: "/reseaux/forward/",
        title: "Forward propagation",
        outcome: "Vous saurez suivre une donnée couche par couche jusqu'à la prédiction.",
        minutes: 8,
      },
      {
        href: "/reseaux/backpropagation/",
        title: "Backpropagation",
        outcome: "Vous saurez comment l'erreur remonte et corrige chaque poids.",
        minutes: 15,
      },
      {
        href: "/reseaux/entrainement/",
        title: "Entraînement",
        outcome: "Vous saurez lire des courbes d'apprentissage et repérer un surapprentissage en direct.",
        minutes: 12,
      },
      {
        href: "/reseaux/chiffres/",
        title: "Chiffres manuscrits",
        outcome:
          "Vous aurez entraîné vous-même un réseau à lire votre écriture, et vu les formes qu'il s'est inventées pour y arriver.",
        minutes: 15,
      },
    ],
  },
  {
    id: "pratiquer",
    title: "7 · Pratiquer",
    why: "Plus de leçon : vos propres expériences.",
    steps: [
      {
        href: "/comparaison/",
        title: "Comparer les algorithmes",
        outcome: "Vous verrez six modèles expliquer les mêmes points de six façons différentes.",
        minutes: 10,
      },
      {
        href: "/playground/",
        title: "Playground",
        outcome: "Votre dataset, votre modèle, vos réglages — avec une lecture automatique du résultat.",
        minutes: 15,
      },
      {
        href: "/defis/",
        title: "Défis",
        outcome: "Quatre problèmes qui ne se résolvent pas en poussant les curseurs au maximum.",
        minutes: 20,
      },
    ],
  },
];

export const COURSE_STEPS: CourseStep[] = COURSE.flatMap((c) => c.steps);

export const COURSE_MINUTES = COURSE_STEPS.reduce((a, s) => a + s.minutes, 0);

/** Where a given page sits in the course, if it is part of it. */
export function coursePosition(href: string): { index: number; total: number } | null {
  const index = COURSE_STEPS.findIndex((s) => s.href === href);
  return index < 0 ? null : { index, total: COURSE_STEPS.length };
}
