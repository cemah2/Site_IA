import { GLOSSARY } from "@/content/glossary";
import { NAV } from "@/lib/nav";

/**
 * The site's search index, built at module scope from what already exists.
 *
 * Thirty-six pages and fifty-eight glossary entries is exactly the size where a
 * sidebar stops working: the reader knows the word "kernel" but not that it
 * lives under "SVM", and scanning a rail of thirty-six links to find out is the
 * opposite of what this site is for. Small enough, too, that a search index is
 * a plain array and a scoring function — no library, no network, no pre-built
 * artefact to keep in sync.
 */

export interface SearchEntry {
  kind: "page" | "terme";
  title: string;
  sub: string;
  href: string;
  /** The section it belongs to, shown as context in the result row. */
  section: string;
  /** Words a reader might type that are in neither the title nor the blurb. */
  keywords?: string;
}

/**
 * Vocabulary a page teaches without naming it in its title or blurb.
 *
 * Written out by hand rather than scraped from the pages: the point is to catch
 * what someone would *type*, which includes English terms the French titles
 * avoid and spellings the prose does not use.
 */
const PAGE_KEYWORDS: Record<string, string> = {
  "/donnees/features/": "variable colonne dimension mesure attribut",
  "/donnees/datasets/": "lunes cercles spirales blobs xor bruit generateur",
  "/donnees/espace-3d/": "hyperplan projection dimension distance euclidienne 3d",
  "/donnees/vos-donnees/":
    "csv import upload fichier excel pca composantes principales acp reduction de dimension variance expliquee",
  "/classification/nearest-centroid/": "barycentre moyenne distance classe prototype",
  "/classification/knn/": "k plus proches voisins vote distance euclidienne manhattan",
  "/classification/naive-bayes/": "theoreme probabilite conditionnelle gaussienne prior vraisemblance posterior",
  "/classification/arbre-de-decision/": "cart gini entropie gain seuil split profondeur elagage regle",
  "/classification/random-forest/": "bagging bootstrap vote ensemble arbres foret",
  "/classification/svm/": "marge vecteurs de support kernel noyau rbf polynomial hinge smo",
  "/regression/lineaire/": "moindres carres residus droite pente ordonnee mse r2",
  "/regression/descente-de-gradient/": "gradient learning rate momentum adam minimum surface de cout convergence",
  "/regression/logistique/": "sigmoide logit probabilite softmax odds entropie croisee",
  "/regression/boosting/": "gradient boosting residus arbres faibles xgboost apprenants",
  "/reseaux/neurone/": "perceptron poids biais somme ponderee activation",
  "/reseaux/activations/": "relu sigmoide tanh leaky derivee gradient qui s evanouit",
  "/reseaux/forward/": "propagation avant couches matrices activation prediction",
  "/reseaux/backpropagation/": "retropropagation chaine derivee gradient erreur correction poids",
  "/reseaux/entrainement/": "epoch loss courbe apprentissage batch convergence",
  "/reseaux/chiffres/": "mnist chiffres manuscrits dessin pixels image reconnaissance ocr",
  "/concepts/overfitting/": "surapprentissage sous apprentissage memorisation generalisation complexite",
  "/concepts/biais-variance/": "compromis decomposition erreur irreductible",
  "/concepts/regularisation/": "ridge lasso l1 l2 penalite weight decay dropout",
  "/concepts/validation-croisee/": "k fold plis stratifie cv score fiable",
  "/concepts/seuil/": "roc auc precision rappel f1 matrice de confusion faux positifs pr",
  "/concepts/fuite-de-donnees/": "data leakage pipeline normalisation avant split triche",
  "/concepts/idees-fausses/": "mythes croyances accuracy correlation causalite plus de donnees",
  "/concepts/clustering/": "k means non supervise centroides inertie coude segmentation",
  "/comparaison/": "benchmark cote a cote frontieres accuracy temps",
  "/playground/": "bac a sable experimenter parametres libre",
  "/defis/": "exercices problemes enigmes jeu",
  "/en-vrai/": "scikit learn sklearn python code pipeline export",
  "/reviser/": "revision repetition espacee leitner quiz memoire",
  "/parcours/": "cours progression ordre lecon chapitre",
  "/glossaire/": "definitions vocabulaire lexique termes",
};

export const SEARCH_INDEX: SearchEntry[] = [
  ...NAV.flatMap((section) =>
    section.items.map(
      (item): SearchEntry => ({
        kind: "page",
        title: item.label,
        sub: item.blurb ?? "",
        href: item.href,
        section: section.title,
        keywords: PAGE_KEYWORDS[item.href],
      }),
    ),
  ),
  ...Object.entries(GLOSSARY).map(
    ([key, entry]): SearchEntry => ({
      kind: "terme",
      title: entry.term,
      sub: entry.short,
      href: `/glossaire/#${key}`,
      section: "Glossaire",
      keywords: key,
    }),
  ),
];

/**
 * Lower-case and strip accents, one output character per input character.
 *
 * Keeping the length identical is the whole point: the palette highlights the
 * matched range by index, and a fold that changed the length — `normalize`
 * applied to the whole string does, since "é" becomes two characters — would
 * highlight the wrong letters as soon as a French word appeared earlier in the
 * title, which on this site is every other one.
 */
export function fold(s: string): string {
  return [...s].map((c) => c.normalize("NFD")[0].toLowerCase()).join("");
}

export interface SearchHit extends SearchEntry {
  score: number;
  /** Where the first query word matched the title, for highlighting. */
  range: [number, number] | null;
}

/**
 * Score one entry against one folded query word.
 *
 * The ladder matters more than the exact numbers: a word at the start of a
 * title must beat the same word buried in a definition, or typing "gradient"
 * puts "Descente de gradient" below four pages that merely mention it.
 *
 * A match inside a word scores far below one at a word boundary, everywhere.
 * Measured reason: "roc" is a substring of "proches", so without that gap
 * searching for the ROC curve returned K-Nearest Neighbors first and the page
 * about ROC third.
 */
function scoreWord(entry: SearchEntry, word: string): { score: number; at: number } {
  const title = fold(entry.title);
  const at = title.indexOf(word);
  if (at === 0) return { score: 100, at };
  if (at > 0) return { score: startsWord(title, at) ? 70 : 15, at };

  if (entry.keywords) {
    const keywords = fold(entry.keywords);
    const k = keywords.indexOf(word);
    if (k >= 0) return { score: startsWord(keywords, k) ? 30 : 8, at: -1 };
  }

  const sub = fold(entry.sub);
  const k = sub.indexOf(word);
  if (k >= 0) return { score: startsWord(sub, k) ? 20 : 6, at: -1 };

  return { score: 0, at: -1 };
}

/** True when the match begins a word rather than sitting inside one. */
function startsWord(haystack: string, at: number): boolean {
  return at === 0 || !/[a-z0-9]/.test(haystack[at - 1]);
}

/**
 * Every word must match somewhere — an AND, not an OR.
 *
 * With fewer than a hundred entries, an OR search returns half the site for a
 * two-word query and is worse than no search at all.
 */
export function search(query: string, limit = 12): SearchHit[] {
  const words = fold(query.trim()).split(/\s+/).filter(Boolean);
  if (!words.length) return [];

  const hits: SearchHit[] = [];
  for (const entry of SEARCH_INDEX) {
    let total = 0;
    let range: [number, number] | null = null;
    for (const word of words) {
      const { score, at } = scoreWord(entry, word);
      if (score === 0) {
        total = 0;
        break;
      }
      total += score;
      if (at >= 0 && !range) range = [at, at + word.length];
    }
    if (total > 0) {
      // A tie between a page and a definition goes to the page: the reader can
      // reach the definition from it, not the other way round.
      hits.push({ ...entry, score: total + (entry.kind === "page" ? 3 : 0), range });
    }
  }

  return hits.sort((a, b) => b.score - a.score || a.title.length - b.title.length).slice(0, limit);
}

/** What the palette shows before anything is typed. */
export const SEARCH_SUGGESTIONS: SearchEntry[] = [
  "/parcours/",
  "/donnees/vos-donnees/",
  "/comparaison/",
  "/concepts/seuil/",
  "/reviser/",
]
  .map((href) => SEARCH_INDEX.find((e) => e.href === href))
  .filter((e): e is SearchEntry => Boolean(e));
