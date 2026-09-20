export interface NavItem {
  href: string;
  label: string;
  /** Shown in the page header and in search results. */
  blurb?: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV: NavSection[] = [
  {
    title: "Commencer",
    items: [
      { href: "/", label: "Introduction", blurb: "Données → algorithme → modèle → prédiction" },
      { href: "/parcours/", label: "Parcours guidé", blurb: "Le site comme un cours, dans l'ordre" },
      { href: "/glossaire/", label: "Glossaire", blurb: "Tout le vocabulaire, sans prérequis" },
    ],
  },
  {
    title: "Les données",
    items: [
      { href: "/donnees/features/", label: "Features", blurb: "Ce que le modèle voit réellement" },
      { href: "/donnees/datasets/", label: "Datasets", blurb: "Dix formes, dix difficultés" },
      { href: "/donnees/espace-3d/", label: "Espace 2D / 3D", blurb: "Hyperplan, projection, distance" },
    ],
  },
  {
    title: "Classification",
    items: [
      { href: "/classification/nearest-centroid/", label: "Nearest Centroid", blurb: "Le modèle le plus simple possible" },
      { href: "/classification/knn/", label: "K-Nearest Neighbors", blurb: "Aucun apprentissage, tout au moment de prédire" },
      { href: "/classification/naive-bayes/", label: "Naive Bayes", blurb: "Le théorème de Bayes, assemblé sous vos yeux" },
      { href: "/classification/arbre-de-decision/", label: "Arbre de décision", blurb: "Une suite de questions, et pourquoi celles-là" },
      { href: "/classification/random-forest/", label: "Random Forest", blurb: "Beaucoup d'arbres différents, puis un vote" },
      { href: "/classification/svm/", label: "SVM", blurb: "La marge, les vecteurs de support, le kernel trick" },
    ],
  },
  {
    title: "Régression",
    items: [
      { href: "/regression/lineaire/", label: "Régression linéaire", blurb: "Résidus, coût, moindres carrés" },
      { href: "/regression/descente-de-gradient/", label: "Descente de gradient", blurb: "La bille sur la surface de coût" },
      { href: "/regression/logistique/", label: "Régression logistique", blurb: "Un score, une sigmoïde, une probabilité" },
    ],
  },
  {
    title: "Réseaux de neurones",
    items: [
      { href: "/reseaux/neurone/", label: "Un neurone", blurb: "z = Σwᵢxᵢ + b, puis a = f(z)" },
      { href: "/reseaux/activations/", label: "Fonctions d'activation", blurb: "Courbe, dérivée, effet sur le gradient" },
      { href: "/reseaux/forward/", label: "Forward propagation", blurb: "Une donnée traverse le réseau" },
      { href: "/reseaux/backpropagation/", label: "Backpropagation", blurb: "L'erreur remonte et corrige les poids" },
      { href: "/reseaux/entrainement/", label: "Entraînement", blurb: "Loss, accuracy et frontière, epoch par epoch" },
      { href: "/reseaux/chiffres/", label: "Chiffres manuscrits", blurb: "Dessinez, le réseau reconnaît — et vous voyez pourquoi" },
    ],
  },
  {
    title: "Concepts",
    items: [
      { href: "/concepts/overfitting/", label: "Sur / sous-apprentissage", blurb: "Quand le modèle apprend le bruit" },
      { href: "/concepts/biais-variance/", label: "Biais et variance", blurb: "Les deux façons de se tromper" },
      { href: "/concepts/regularisation/", label: "Régularisation", blurb: "Payer la complexité pour l'éviter" },
      { href: "/concepts/clustering/", label: "Clustering", blurb: "Apprendre sans étiquettes : K-means" },
    ],
  },
  {
    title: "Laboratoire",
    items: [
      { href: "/comparaison/", label: "Comparer les algorithmes", blurb: "Un dataset, six modèles, côte à côte" },
      { href: "/playground/", label: "Playground", blurb: "Votre dataset, votre modèle, vos paramètres" },
      { href: "/defis/", label: "Défis", blurb: "Des problèmes à résoudre vous-même" },
    ],
  },
];

export const ALL_ITEMS: NavItem[] = NAV.flatMap((s) => s.items);

export function findNav(pathname: string): { item: NavItem; section: NavSection } | null {
  for (const section of NAV) {
    for (const item of section.items) {
      if (item.href === pathname) return { item, section };
    }
  }
  return null;
}

/** Previous / next page in reading order, for the footer navigation. */
export function neighbours(pathname: string): { prev: NavItem | null; next: NavItem | null } {
  const i = ALL_ITEMS.findIndex((it) => it.href === pathname);
  if (i < 0) return { prev: null, next: null };
  return { prev: ALL_ITEMS[i - 1] ?? null, next: ALL_ITEMS[i + 1] ?? null };
}
