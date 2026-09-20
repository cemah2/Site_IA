# Machine Learning Lab

Un laboratoire interactif pour comprendre comment les algorithmes de Machine
Learning fonctionnent **de l'intérieur**. Pas une documentation : un banc
d'essai où l'on manipule les données, on bouge les paramètres, et on regarde le
modèle réagir en temps réel.

Le principe directeur : **chaque quantité qu'un algorithme calcule est affichée
au moment où il la calcule.** Quand KNN cherche ses voisins, ce sont ces
voisins-là qui s'allument, avec leurs distances. Quand un arbre choisit une
coupure, on voit toutes celles qu'il a envisagées et leur gain d'information.
Quand un réseau rétropropage, on voit les gradients remonter et les poids
changer.

## Démarrer

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # export statique dans ./out
npm run lint
```

## Les pages

| Section | Pages |
|---|---|
| Données | Features · Datasets · Espace 2D/3D |
| Classification | Nearest Centroid · KNN · Naive Bayes · Arbre de décision · Random Forest · SVM |
| Régression | Régression linéaire · Descente de gradient |
| Réseaux de neurones | Un neurone · Activations · Forward · Backpropagation · Entraînement |
| Concepts | Sur/sous-apprentissage · Biais et variance · Régularisation · Clustering |
| Laboratoire | Comparaison · Playground · Défis |

Chaque page algorithme suit le même rythme : visualisation → manipulation →
explication à trois niveaux (intuition / technique / mathématiques) → cas
pratique. Le dataset manipulé sur une page suit sur toutes les autres, et le
réseau de neurones entraîné sur une page garde ses poids sur les suivantes.

## Architecture

| Dossier | Rôle |
|---|---|
| `src/lib/ml/models/` | Les algorithmes, écrits à la main en TypeScript |
| `src/lib/ml/` | Datasets, métriques, balayage des frontières de décision, registre |
| `src/lib/viz/` | Palette validée, échelles, formes des marqueurs |
| `src/components/viz/` | Primitives de tracé (frame, champ de décision, points, légende) |
| `src/components/ui/` | Contrôles (sliders, segmented, panneaux, stats) |
| `src/store/` | Le dataset, le réseau et les points de régression partagés |
| `scripts/` | Vérification de la calibration des défis |

### Pourquoi des implémentations maison

Les algorithmes sont écrits ici plutôt qu'importés d'une bibliothèque parce que
le site a besoin de leur **état intermédiaire** : les α du dual d'un SVM (qui
définissent les vecteurs de support), l'impureté et les coupures candidates de
chaque nœud d'arbre, les `z` et `a` de chaque neurone, les `δ` de chaque couche.
Une bibliothèque optimisée jette ces valeurs dès qu'elle s'en est servie.

### Déterminisme

Tout passe par un PRNG graine (`src/lib/rng.ts`). Même graine, mêmes données,
même initialisation : c'est ce qui permet de changer **un seul** paramètre et
d'être certain que la différence observée vient de lui.

### Rendu

Tout le calcul se fait côté client. `next build` produit un export statique
(`output: "export"`), déployé sur GitHub Pages par `.github/workflows/deploy.yml`.

## Vérifications

```bash
npm run lint
npx tsc --noEmit
npx tsx scripts/verify-challenges.ts   # chaque défi est gagnable, et pas gagné d'avance
```

## Design

Thème sombre uniquement, assumé : la palette de classes a été **choisie et
validée** pour ces surfaces sombres précises (bande de luminosité, plancher de
chroma, séparation daltonisme sur toutes les paires, seuil de vision normale,
contraste). Un thème clair demanderait ses propres pas validés, pas une
inversion automatique. Voir `docs/design-system.md`.
