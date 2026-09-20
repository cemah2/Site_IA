export interface GlossaryEntry {
  /** The headword, as it appears in the popover. */
  term: string;
  /** Two or three sentences. This is what most readers will ever read. */
  short: string;
  /** One concrete image or counter-example. Optional but usually worth it. */
  example?: string;
  /** Where to go to actually manipulate the idea. */
  href?: string;
  hrefLabel?: string;
}

/**
 * The site's vocabulary, in one place.
 *
 * The constraint this answers is "more explanation without flooding the page".
 * A definition that lives in a popover costs a reader who already knows the
 * word exactly nothing, and costs a beginner one hover. That is why the
 * explanations here are allowed to be generous while the pages stay short.
 *
 * Written for someone who has finished secondary school: functions, averages,
 * percentages and coordinates are assumed; vectors, derivatives and
 * probability notation are not.
 */
export const GLOSSARY: Record<string, GlossaryEntry> = {
  // ---------------------------------------------------------------- données
  feature: {
    term: "Feature (caractéristique)",
    short:
      "Une des mesures qui décrivent un exemple. Un modèle ne voit jamais « une fleur » ou « un client » : il voit une liste de nombres, et chaque nombre est une feature.",
    example:
      "Pour un appartement : surface, nombre de pièces, étage, distance au centre. Quatre features.",
    href: "/donnees/features/",
    hrefLabel: "Manipuler les features",
  },
  label: {
    term: "Label (étiquette)",
    short:
      "La réponse attendue pour un exemple — ce que le modèle doit apprendre à retrouver. En classification c'est une catégorie, en régression un nombre.",
    example: "« Ce message est un spam » est un label. « Cet appartement vaut 240 000 € » aussi.",
  },
  dataset: {
    term: "Dataset (jeu de données)",
    short:
      "L'ensemble des exemples dont on dispose, chacun avec ses features et, en apprentissage supervisé, son label.",
  },
  sample: {
    term: "Échantillon",
    short:
      "Un exemple unique du dataset : une ligne du tableau. Sur les graphiques de ce site, c'est un point.",
  },
  supervise: {
    term: "Apprentissage supervisé",
    short:
      "On dispose des bonnes réponses pour les exemples d'entraînement, et le modèle apprend à les reproduire sur des exemples nouveaux. C'est le cadre de presque tout ce site.",
    example: "Par opposition au clustering, où aucune réponse n'est fournie.",
  },
  nonsupervise: {
    term: "Apprentissage non supervisé",
    short:
      "Aucune réponse n'est fournie : l'algorithme doit trouver lui-même une structure dans les données. Il ne peut donc pas se tromper au sens strict — seulement être plus ou moins utile.",
    href: "/concepts/clustering/",
    hrefLabel: "Voir K-means",
  },
  normalisation: {
    term: "Normalisation / standardisation",
    short:
      "Ramener toutes les features à des ordres de grandeur comparables. Indispensable dès qu'un modèle calcule des distances, sinon la feature exprimée dans la plus grande unité écrase toutes les autres.",
    example:
      "Des euros (0 à 500 000) et un nombre de pièces (1 à 6) ne sont pas comparables tels quels.",
    href: "/donnees/features/",
    hrefLabel: "Voir l'effet de l'échelle",
  },
  bruit: {
    term: "Bruit",
    short:
      "La part de variation des données qu'aucune règle ne peut expliquer : erreurs de mesure, hasard, facteurs non observés. Le bruit ne change pas la vraie règle, seulement ce qu'on peut en observer.",
    example:
      "Conséquence directe : au-delà d'un certain niveau de bruit, 100 % de réussite est impossible — et un modèle qui y arrive a mémorisé le hasard.",
  },
  outlier: {
    term: "Outlier (point aberrant)",
    short:
      "Un exemple très éloigné des autres. Certains modèles y sont extrêmement sensibles (la moyenne, les moindres carrés), d'autres presque pas (la médiane, KNN avec un grand K).",
  },

  // -------------------------------------------------------------- le modèle
  modele: {
    term: "Modèle",
    short:
      "Le résultat de l'apprentissage : la règle que l'algorithme a construite à partir des données, et qui sait répondre sur des exemples nouveaux.",
    example:
      "Pour Nearest Centroid, le modèle tient en quelques nombres : un point par classe. Pour KNN, le modèle est le jeu de données lui-même.",
  },
  parametre: {
    term: "Paramètre",
    short:
      "Un nombre que l'algorithme ajuste lui-même pendant l'apprentissage. On ne les choisit pas : on les laisse s'ajuster.",
    example: "Les poids d'un réseau de neurones sont ses paramètres — parfois des milliards.",
  },
  hyperparametre: {
    term: "Hyperparamètre",
    short:
      "Un réglage que l'on choisit soi-même avant l'apprentissage, et que l'algorithme ne peut pas déduire des données.",
    example:
      "Le K de KNN, la profondeur d'un arbre, le learning rate d'un réseau. Ce sont les curseurs de ce site.",
  },
  frontiere: {
    term: "Frontière de décision",
    short:
      "La ligne (ou la surface) qui sépare les régions où le modèle répond une classe de celles où il en répond une autre. C'est la forme visible de ce que le modèle a appris.",
    example:
      "Son intérêt : elle existe partout, y compris là où il n'y a aucune donnée — c'est là qu'on voit ce que le modèle extrapole.",
  },
  prediction: {
    term: "Prédiction",
    short:
      "La réponse du modèle pour un exemple donné. Le mot n'a rien à voir avec l'avenir : prédire, ici, c'est simplement répondre.",
  },

  // ------------------------------------------------------------ évaluation
  entrainement: {
    term: "Jeu d'entraînement",
    short:
      "Les exemples que le modèle a le droit de voir pendant l'apprentissage. Sa performance sur ces exemples-là ne dit presque rien de sa valeur réelle.",
  },
  test: {
    term: "Jeu de test",
    short:
      "Des exemples mis de côté, que le modèle n'a jamais vus. C'est le seul chiffre qui compte, parce que c'est le seul qui imite la situation réelle : répondre sur du nouveau.",
  },
  accuracy: {
    term: "Accuracy (taux de bonnes réponses)",
    short:
      "La proportion d'exemples correctement classés. Simple, et trompeuse dès que les classes sont déséquilibrées.",
    example:
      "Si 90 % des messages ne sont pas des spams, répondre toujours « pas spam » donne 90 % d'accuracy sans rien avoir appris.",
  },
  baseline: {
    term: "Baseline",
    short:
      "Le score d'une stratégie bête, à battre obligatoirement. Ici : toujours répondre la classe la plus fréquente. Un modèle qui ne bat pas la baseline n'a rien appris.",
  },
  matriceconfusion: {
    term: "Matrice de confusion",
    short:
      "Un tableau qui croise la vraie classe et la classe prédite. La diagonale ce sont les bonnes réponses ; tout le reste dit précisément quelles confusions le modèle commet.",
    example: "L'accuracy dit combien d'erreurs. La matrice dit lesquelles.",
  },
  precision: {
    term: "Précision",
    short:
      "Parmi les exemples que le modèle a rangés dans une classe, la proportion qui en fait vraiment partie. Répond à : « quand il dit oui, a-t-il raison ? »",
  },
  rappel: {
    term: "Rappel",
    short:
      "Parmi les exemples qui appartiennent vraiment à une classe, la proportion que le modèle a retrouvée. Répond à : « en a-t-il oublié ? »",
    example:
      "Précision et rappel se compensent : un modèle très prudent a une bonne précision et un mauvais rappel.",
  },
  f1: {
    term: "F1",
    short:
      "Un chiffre unique combinant précision et rappel (leur moyenne harmonique). Il s'effondre dès que l'un des deux est mauvais, ce qui le rend bien plus honnête que l'accuracy sur des classes déséquilibrées.",
  },

  // ------------------------------------------------------- généralisation
  overfitting: {
    term: "Surapprentissage (overfitting)",
    short:
      "Le modèle apprend les particularités et le bruit de ses exemples au lieu de la règle générale. Il excelle sur ce qu'il a vu et échoue sur le reste.",
    example:
      "Son symptôme est un écart : très bon score en entraînement, nettement moins bon en test.",
    href: "/concepts/overfitting/",
    hrefLabel: "Le voir se produire",
  },
  underfitting: {
    term: "Sous-apprentissage (underfitting)",
    short:
      "Le modèle est trop contraint pour représenter la vraie règle. Les deux scores, entraînement et test, sont mauvais — et proches.",
    example: "Lui donner plus de données n'aide pas : il faut plus de capacité.",
    href: "/concepts/overfitting/",
  },
  generalisation: {
    term: "Généralisation",
    short:
      "La capacité à bien répondre sur des exemples jamais vus. C'est le seul objectif réel de l'apprentissage — tout le reste n'en est qu'une approximation mesurable.",
  },
  biais: {
    term: "Biais",
    short:
      "L'erreur qu'un modèle commet systématiquement, toujours dans le même sens, parce que sa forme ne peut pas représenter la vraie règle.",
    example: "Une droite qui essaie de suivre une courbe a du biais, quelles que soient les données.",
    href: "/concepts/biais-variance/",
    hrefLabel: "Voir la décomposition",
  },
  variance: {
    term: "Variance",
    short:
      "L'instabilité d'un modèle : à quel point sa réponse changerait s'il avait reçu un autre échantillon de données. Beaucoup de variance signifie qu'on ne peut pas se fier à un modèle en particulier.",
    href: "/concepts/biais-variance/",
  },
  regularisation: {
    term: "Régularisation",
    short:
      "Faire payer la complexité au lieu de l'interdire : on ajoute au coût une pénalité qui augmente avec la taille des paramètres. Le modèle ne se complique que si les données le justifient.",
    href: "/concepts/regularisation/",
    hrefLabel: "Régler λ soi-même",
  },
  crossval: {
    term: "Validation croisée",
    short:
      "Découper les données en k parts, entraîner k fois en gardant à chaque fois une part différente pour évaluer, puis moyenner. Donne une mesure bien plus stable qu'un découpage unique.",
  },

  // ----------------------------------------------------------- algorithmes
  knn: {
    term: "K plus proches voisins (KNN)",
    short:
      "Pour classer un point, on regarde les K exemples les plus proches et on prend la réponse majoritaire. Aucun apprentissage : tout le travail a lieu au moment de répondre.",
    href: "/classification/knn/",
  },
  centroide: {
    term: "Centroïde",
    short:
      "Le point moyen d'un groupe : on fait la moyenne de chaque coordonnée. C'est le « centre de gravité » du nuage.",
    href: "/classification/nearest-centroid/",
  },
  distance: {
    term: "Distance euclidienne",
    short:
      "La distance « à vol d'oiseau » : le théorème de Pythagore appliqué aux coordonnées. C'est la notion de proximité qu'utilisent KNN, K-means et les SVM.",
  },
  impurete: {
    term: "Impureté",
    short:
      "À quel point un groupe est mélangé. Zéro quand tous les exemples ont la même classe, maximale quand les classes sont à parts égales. Un arbre choisit les coupures qui la font baisser le plus.",
    href: "/classification/arbre-de-decision/",
  },
  entropie: {
    term: "Entropie",
    short:
      "Une mesure d'impureté venue de la théorie de l'information : le nombre moyen de questions oui/non encore nécessaires pour deviner la classe d'un exemple du groupe.",
  },
  gain: {
    term: "Gain d'information",
    short:
      "De combien une coupure réduit l'impureté. C'est le critère qu'un arbre optimise à chaque nœud — et il choisit toujours le meilleur gain immédiat, sans anticiper.",
  },
  ensemble: {
    term: "Méthode d'ensemble",
    short:
      "Combiner plusieurs modèles imparfaits plutôt que d'en chercher un parfait. Ça ne marche qu'à une condition : que leurs erreurs soient différentes.",
    href: "/classification/random-forest/",
  },
  bagging: {
    term: "Bagging",
    short:
      "Entraîner chaque modèle d'un ensemble sur un tirage au sort différent des données, avec remise. C'est ce qui force les modèles à se tromper différemment.",
  },
  marge: {
    term: "Marge",
    short:
      "L'espace libre entre la frontière et les exemples les plus proches. Un SVM choisit, parmi toutes les frontières possibles, celle qui laisse la marge la plus large.",
    href: "/classification/svm/",
  },
  vecteursupport: {
    term: "Vecteur de support",
    short:
      "Un exemple qui touche la marge et la maintient en place. Supprimer n'importe quel autre exemple ne déplacerait pas la frontière d'un pixel — c'est vérifiable sur la page SVM.",
    href: "/classification/svm/",
  },
  kernel: {
    term: "Kernel (noyau)",
    short:
      "Une astuce qui permet de séparer des données non séparables par une droite, en les traitant comme si elles avaient été transportées dans un espace plus grand — sans jamais les y transporter réellement.",
    href: "/classification/svm/",
    hrefLabel: "Voir la transformation en 3D",
  },
  bayes: {
    term: "Théorème de Bayes",
    short:
      "La règle qui permet de retourner une probabilité : on sait mesurer « si c'est une grippe, quelle chance de tousser », on veut « il tousse, quelle chance de grippe ». Bayes fait le passage.",
    href: "/classification/naive-bayes/",
  },
  prior: {
    term: "Probabilité a priori (prior)",
    short:
      "Ce qu'on croit avant de regarder l'exemple : la fréquence de chaque classe en général. Une maladie rarissime reste improbable même devant un symptôme typique.",
  },
  vraisemblance: {
    term: "Vraisemblance",
    short:
      "La probabilité d'observer ces caractéristiques-là si l'exemple appartenait à une classe donnée. Se mesure facilement sur les données d'entraînement.",
  },

  // -------------------------------------------------- réseaux de neurones
  neurone: {
    term: "Neurone",
    short:
      "La brique de base : il fait une somme pondérée de ses entrées, ajoute un décalage, puis applique une fonction non linéaire. Rien de plus.",
    href: "/reseaux/neurone/",
  },
  poids: {
    term: "Poids",
    short:
      "Le coefficient qu'un neurone applique à chacune de ses entrées : à quel point cette information compte, et dans quel sens. Positif, il pousse vers oui ; négatif, vers non.",
  },
  biaisneurone: {
    term: "Biais (d'un neurone)",
    short:
      "Un décalage constant ajouté à la somme pondérée : l'a priori du neurone avant même de regarder ses entrées. Sans lui, sa frontière passerait forcément par l'origine.",
  },
  activation: {
    term: "Fonction d'activation",
    short:
      "La fonction non linéaire appliquée en sortie d'un neurone. Sans elle, empiler des couches ne servirait à rien : une suite de transformations linéaires reste linéaire.",
    href: "/reseaux/activations/",
  },
  couche: {
    term: "Couche",
    short:
      "Un groupe de neurones travaillant en parallèle sur les mêmes entrées. Les couches cachées sont celles entre l'entrée et la sortie — celles où se construisent les représentations intermédiaires.",
  },
  forward: {
    term: "Forward propagation",
    short:
      "Le trajet d'une donnée à travers le réseau, de l'entrée vers la sortie. C'est tout ce qui se passe quand un réseau prédit.",
    href: "/reseaux/forward/",
  },
  backprop: {
    term: "Backpropagation",
    short:
      "La méthode qui calcule, pour chaque poids, de combien il faudrait le bouger pour réduire l'erreur. Elle répartit l'erreur de la sortie vers l'entrée, couche par couche.",
    example:
      "Ce n'est pas un algorithme d'apprentissage : c'est une façon efficace de calculer un gradient.",
    href: "/reseaux/backpropagation/",
  },
  gradient: {
    term: "Gradient",
    short:
      "La pente de l'erreur par rapport à un paramètre : de combien l'erreur change si on bouge ce paramètre d'un cheveu. Son signe indique le sens dans lequel se corriger.",
    href: "/regression/descente-de-gradient/",
  },
  descente: {
    term: "Descente de gradient",
    short:
      "Partir de n'importe où, regarder la pente, faire un pas dans la descente, recommencer. C'est ainsi que sont entraînés absolument tous les réseaux de neurones.",
    href: "/regression/descente-de-gradient/",
  },
  learningrate: {
    term: "Learning rate (taux d'apprentissage)",
    short:
      "La taille du pas à chaque correction. Trop petit, l'apprentissage rampe ; trop grand, il dépasse le minimum et diverge. C'est le réglage le plus important d'un réseau.",
  },
  epoch: {
    term: "Epoch",
    short:
      "Un passage complet sur toutes les données d'entraînement. Ce n'est pas une durée : une epoch sur 20 exemples et une epoch sur 20 millions n'ont rien de comparable.",
  },
  loss: {
    term: "Loss (fonction de coût)",
    short:
      "Le nombre que l'apprentissage cherche à rendre le plus petit possible : une mesure de l'écart entre ce que le modèle répond et ce qu'il aurait dû répondre.",
  },
  softmax: {
    term: "Softmax",
    short:
      "La fonction qui transforme les scores bruts de la dernière couche en probabilités : toutes positives, et leur somme fait exactement 1. Augmenter un score en retire donc aux autres.",
  },
  vanishing: {
    term: "Gradient qui s'évanouit",
    short:
      "En traversant les couches vers l'arrière, le gradient est multiplié à chaque étape. Si ces facteurs sont inférieurs à 1, il devient minuscule et les premières couches n'apprennent plus rien.",
    href: "/reseaux/activations/",
  },
};

export type GlossaryKey = keyof typeof GLOSSARY;
