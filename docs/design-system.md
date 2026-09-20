# Design system

## Palette de classes

Cinq emplacements, **ordre fixe, jamais cyclé** :

| Slot | Teinte | Hex | Forme |
|---|---|---|---|
| 0 | bleu | `#2584f5` | cercle |
| 1 | orange | `#e45a20` | carré |
| 2 | sarcelle | `#27a37e` | triangle |
| 3 | violet | `#9637ab` | losange |
| 4 | cramoisi | `#bb1f54` | croix |

### Pourquoi cinq et pas huit

Les nuages de points imposent la liste de paires **complète** (toutes les paires
peuvent se retrouver côte à côte, contrairement à un empilement où seules les
paires adjacentes comptent). Sous cette contrainte, la palette de référence ne
tient que 3 emplacements, et aucun jeu de 6 teintes testé ne franchit le
plancher de vision normale (ΔE ≥ 15) : le meilleur candidat à 6 plafonne à 14,4.
La palette ci-dessus a donc été cherchée spécifiquement pour ces surfaces
sombres, et **cinq est le maximum honnête**. Au-delà, il faut replier en
« Autre » ou faire des petits multiples.

### Résultats de validation

Contre les deux surfaces du site (`#080b12` plan de page, `#10141b` surface de
graphique), en mode `--pairs all` — pour les préfixes 2, 3, 4 et 5 :

```
Bande de luminosité    PASS   tout dans L 0,48–0,67
Plancher de chroma     PASS   tout ≥ 0,10
Séparation daltonisme  PASS   pire paire ΔE 10,9 (deutan) — cible ≥ 8
Vision normale         PASS   pire paire ΔE 15,5 — plancher ≥ 15
Contraste vs surface   PASS   tout ≥ 3:1
```

Pour re-valider après un changement :

```bash
node <skill>/scripts/validate_palette.js \
  "#2584f5,#e45a20,#27a37e,#9637ab,#bb1f54" \
  --mode dark --surface "#10141b" --pairs all
```

### Encodage secondaire obligatoire

L'identité de classe porte **toujours** une forme en plus de la couleur
(`src/lib/viz/geometry.ts`, `shapePath` / `traceShape`). La séparation tritan de
la palette est faible (ΔE ≈ 4,3) ; la forme est ce qui rend l'identité lisible
malgré ça, et survit aussi à l'impression et au mode couleurs forcées.

## Rampes

- **Séquentielle** (magnitude continue) : une seule teinte, bleu, clair → foncé.
- **Divergente** (quantités signées : résidus, gradients) : bleu ↔ rouge avec un
  gris neutre au milieu. Jamais de teinte au point médian, jamais d'arc-en-ciel.
- **Statut** (bon / avertissement / sérieux / critique) : réservé, jamais réutilisé
  comme couleur de série, et toujours accompagné d'une icône ou d'un libellé.

## Accent d'interface

`#7aa2ff`, délibérément plus clair (OKLCH L ≈ 0,72) que le plafond de la bande
des séries (0,67), pour qu'un élément d'interface ne puisse jamais être confondu
avec une série de données.

## Champ de décision

Deux encodages superposés, séparés exprès :
- la **teinte** dit *quelle* classe gagne (catégoriel) ;
- l'**alpha** dit *avec quelle confiance* (magnitude), sur une bande étroite
  (0,10 → 0,38) pour que les points restent lisibles par-dessus.

La frontière elle-même est ensuite tracée explicitement : un changement de
couleur entre deux aplats à 10 % d'opacité n'est pas une ligne visible.
