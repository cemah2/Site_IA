"use client";

import * as React from "react";
import Link from "next/link";
import { PageShell, SectionTitle } from "@/components/layout/PageShell";
import { Button, Callout, Panel, Select, Toggle } from "@/components/ui";
import { ClientOnly } from "@/components/ui/ClientOnly";
import { G } from "@/components/ui/Glossary";
import { ALGO_ORDER, ALGOS, DEFAULT_PARAMS, type AlgoId } from "@/lib/ml/registry";
import { estimatorNote, sklearnSnippet } from "@/lib/export/sklearn";
import { useLab } from "@/store/lab";

/** Each idea of the site, and the line of real code that does it. */
const BRIDGE: { page: string; href: string; idea: string; code: string }[] = [
  { page: "Features", href: "/donnees/features/", idea: "Mettre les colonnes à la même échelle", code: "StandardScaler()" },
  { page: "Nearest Centroid", href: "/classification/nearest-centroid/", idea: "Le centre de chaque classe", code: "NearestCentroid()" },
  { page: "KNN", href: "/classification/knn/", idea: "Les K plus proches voisins", code: "KNeighborsClassifier(n_neighbors=7)" },
  { page: "Naive Bayes", href: "/classification/naive-bayes/", idea: "Une gaussienne par classe", code: "GaussianNB()" },
  { page: "Arbre de décision", href: "/classification/arbre-de-decision/", idea: "Une suite de questions", code: "DecisionTreeClassifier(max_depth=4)" },
  { page: "Random Forest", href: "/classification/random-forest/", idea: "Beaucoup d'arbres, puis un vote", code: "RandomForestClassifier(n_estimators=200)" },
  { page: "SVM", href: "/classification/svm/", idea: "La marge la plus large", code: 'SVC(C=1, kernel="rbf")' },
  { page: "Régression logistique", href: "/regression/logistique/", idea: "Un score transformé en probabilité", code: "LogisticRegression()" },
  { page: "Boosting", href: "/regression/boosting/", idea: "Des arbres qui corrigent les précédents", code: "GradientBoostingClassifier(learning_rate=0.1)" },
  { page: "Réseau de neurones", href: "/reseaux/entrainement/", idea: "Des couches de neurones", code: "MLPClassifier(hidden_layer_sizes=(32,))" },
  { page: "Clustering", href: "/concepts/clustering/", idea: "Des groupes sans étiquettes", code: "KMeans(n_clusters=3)" },
  { page: "Validation croisée", href: "/concepts/validation-croisee/", idea: "Un chiffre défendable", code: "cross_val_score(model, X, y, cv=5)" },
  { page: "Le seuil", href: "/concepts/seuil/", idea: "Couper ailleurs qu'à 50 %", code: "model.predict_proba(X)[:, 1] >= 0.2" },
  { page: "La fuite de données", href: "/concepts/fuite-de-donnees/", idea: "Ne rien apprendre sur le test", code: "make_pipeline(StandardScaler(), SVC())" },
  { page: "Régularisation", href: "/concepts/regularisation/", idea: "Brider les coefficients", code: "Ridge(alpha=1.0)" },
];

export function RealWorldLab() {
  return (
    <PageShell
      eyebrow="Laboratoire"
      title="Et maintenant, en vrai"
      lede={
        <>
          Vous avez manipulé les idées ; il reste à les exécuter. Cette page donne{" "}
          <strong>le code qui refait exactement l&apos;expérience actuellement à
          l&apos;écran</strong> — vos données, votre modèle, vos réglages — en scikit-learn,
          la bibliothèque que tout le monde utilise réellement.
        </>
      }
      wide
    >
      <ClientOnly
        fallback={<div className="h-[560px] animate-pulse rounded-xl border border-line bg-surface-1/60" />}
      >
        <SnippetBench />
      </ClientOnly>

      <SectionTitle hint="Chaque page du site, et la ligne qui fait la même chose.">
        La table de correspondance
      </SectionTitle>

      <Panel title="Du site au code" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[12.5px]">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-[0.08em] text-ink-muted">
                <th className="px-4 py-2.5 font-medium">Page</th>
                <th className="px-4 py-2.5 font-medium">L&apos;idée</th>
                <th className="px-4 py-2.5 font-medium">En scikit-learn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {BRIDGE.map((b) => (
                <tr key={b.href}>
                  <td className="px-4 py-2">
                    <Link href={b.href} className="text-accent hover:underline">
                      {b.page}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-ink-2">{b.idea}</td>
                  <td className="px-4 py-2">
                    <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[11.5px] text-ink">
                      {b.code}
                    </code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <SectionTitle hint="Les trois choses qui séparent un notebook d'un travail sérieux.">
        Ce que le site vous a appris et que les tutoriels oublient
      </SectionTitle>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="Toujours un Pipeline">
          <p className="text-[12px] leading-relaxed text-ink-2">
            Dès qu&apos;une étape <em>apprend</em> quelque chose — une moyenne, une variance,
            un encodage — elle doit vivre dans un <code>Pipeline</code>. Sans ça, la
            validation croisée calcule ces statistiques sur les plis de test aussi, et le
            score annoncé est optimiste. C&apos;est la{" "}
            <Link href="/concepts/fuite-de-donnees/" className="text-accent hover:underline">
              fuite de données
            </Link>{" "}
            en une ligne de code.
          </p>
        </Panel>
        <Panel title="Jamais un seul découpage">
          <p className="text-[12px] leading-relaxed text-ink-2">
            <code>train_test_split</code> seul donne un chiffre qui bouge de plusieurs points
            d&apos;un tirage à l&apos;autre — huit, mesurés sur la page de{" "}
            <Link href="/concepts/validation-croisee/" className="text-accent hover:underline">
              validation croisée
            </Link>
            . Annoncez une moyenne et un écart-type, pas un nombre seul.
          </p>
        </Panel>
        <Panel title="0,5 n'est pas sacré">
          <p className="text-[12px] leading-relaxed text-ink-2">
            <code>predict()</code> coupe les probabilités à 50 %. Presque aucun problème réel
            ne le justifie : utilisez <code>predict_proba()</code> et choisissez le{" "}
            <Link href="/concepts/seuil/" className="text-accent hover:underline">
              seuil
            </Link>{" "}
            selon ce que coûtent vos deux erreurs.
          </p>
        </Panel>
      </div>

      <Callout kind="note" title="Pour exécuter tout ça">
        Installez <code>scikit-learn</code> (<code>pip install scikit-learn pandas</code>) et
        collez le code dans un fichier Python ou un notebook. Rien de ce que fait ce site ne
        demande de carte graphique : tous les modèles présentés ici s&apos;entraînent en
        quelques secondes sur un ordinateur portable.
      </Callout>
    </PageShell>
  );
}

function SnippetBench() {
  const { dataset, kind, n, noise, seed, nClasses, trainRatio, imported } = useLab();
  const [algo, setAlgo] = React.useState<AlgoId>("knn");
  const [scaled, setScaled] = React.useState(true);
  const [crossValidated, setCrossValidated] = React.useState(true);
  const [copied, setCopied] = React.useState(false);

  const code = React.useMemo(
    () =>
      sklearnSnippet({
        algo,
        params: DEFAULT_PARAMS,
        dataset,
        kind,
        n,
        noise,
        seed,
        nClasses,
        trainRatio,
        imported: Boolean(imported),
        crossValidated,
        scaled,
      }),
    [algo, dataset, kind, n, noise, seed, nClasses, trainRatio, imported, crossValidated, scaled],
  );

  React.useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
      <Panel
        title="Votre expérience, en Python"
        subtitle={
          imported
            ? "Adapté à vos données importées"
            : `Reprend le dataset et les réglages actuels du site`
        }
        bodyClassName="p-0"
      >
        <pre className="overflow-x-auto px-4 py-4 text-[12px] leading-relaxed text-ink">
          <code>{code}</code>
        </pre>
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
          <Button
            variant="primary"
            size="sm"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(code);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? "Copié ✓" : "Copier le code"}
          </Button>
          <span className="text-[11px] text-ink-muted">{estimatorNote(algo, DEFAULT_PARAMS)}</span>
        </div>
      </Panel>

      <div className="space-y-4">
        <Panel title="Réglages" bodyClassName="space-y-4 p-4">
          {/* A Select rather than a segmented row: seven model names side by
              side in a 300 px column are unreadable at any window width. */}
          <Select
            label="Modèle"
            value={algo}
            options={ALGO_ORDER.map((id) => ({ value: id, label: ALGOS[id].label }))}
            onChange={(v) => setAlgo(v as AlgoId)}
          />
          <Toggle
            label="Mettre les features à l'échelle"
            checked={scaled}
            onChange={setScaled}
            hint="Dans un Pipeline, donc calculé sur l'entraînement seul. Indispensable pour KNN, le SVM et le réseau."
          />
          <Toggle
            label="Valider par validation croisée"
            checked={crossValidated}
            onChange={setCrossValidated}
            hint="Cinq plis, et le jeu de test gardé pour la toute fin."
          />
        </Panel>

        <Panel title="Ce qui change du site" subtitle="Deux différences à connaître">
          <ul className="space-y-2 text-[12px] leading-relaxed text-ink-2">
            <li>
              <strong>Les nombres ne seront pas identiques.</strong> Les générateurs de
              scikit-learn ne sont pas ceux de ce site, et les implémentations diffèrent dans
              leurs détails. Les <em>conclusions</em>, elles, se reproduisent.
            </li>
            <li>
              <strong>Vous ne verrez plus la frontière.</strong> C&apos;est le prix du passage
              au code — et la raison d&apos;être de ce site : vous l&apos;avez vue, vous savez
              maintenant à quoi ressemble ce que <code>fit()</code> fabrique en silence.
            </li>
          </ul>
        </Panel>

        <Callout kind="insight" title="Vos données aussi">
          Importez un CSV sur la page{" "}
          <Link href="/donnees/vos-donnees/" className="text-accent hover:underline">
            Vos propres données
          </Link>{" "}
          : le code ci-contre passera automatiquement en <code>pandas.read_csv</code> avec vos
          noms de colonnes. Le <G t="feature">choix des features</G> reste le vôtre.
        </Callout>
      </div>
    </div>
  );
}
