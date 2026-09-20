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

## Architecture

| Dossier | Rôle |
|---|---|
| `src/lib/ml/models/` | Les algorithmes, écrits à la main en TypeScript |
| `src/lib/ml/` | Datasets, métriques, balayage des frontières de décision, registre |
| `src/lib/viz/` | Palette validée, échelles, formes des marqueurs |
| `src/components/viz/` | Primitives de tracé (frame, champ de décision, points, légende) |
| `src/components/ui/` | Contrôles (sliders, segmented, panneaux, stats) |
| `src/store/lab.ts` | Le dataset partagé par toutes les pages |

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

## Design

Thème sombre uniquement, assumé : la palette de classes a été **choisie et
validée** pour ces surfaces sombres précises (bande de luminosité, plancher de
chroma, séparation daltonisme sur toutes les paires, seuil de vision normale,
contraste). Un thème clair demanderait ses propres pas validés, pas une
inversion automatique. Voir `docs/design-system.md`.
