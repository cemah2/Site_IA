"use client";

import * as React from "react";
import Link from "next/link";
import { PageShell, SectionTitle } from "@/components/layout/PageShell";
import { Callout, Panel } from "@/components/ui";
import { G } from "@/components/ui/Glossary";
import { ClientOnly } from "@/components/ui/ClientOnly";
import { DataImport } from "@/components/lab/DataImport";
import { DataPlot } from "@/components/viz/DataPlot";
import { ClassLegend } from "@/components/viz/Legend";
import { Quiz } from "@/components/lab/Quiz";
import { useLab } from "@/store/lab";

export function ImportLab() {
  return (
    <PageShell
      eyebrow="Les données"
      title="Vos propres données"
      lede={
        <>
          Tout ce que le site sait faire — les frontières, les arbres, les marges, le réseau —
          s&apos;applique à un fichier à vous. Deux colonnes de nombres, une colonne de
          catégories, et vos données remplacent les nuages générés{" "}
          <strong>sur les vingt-neuf pages</strong>.
        </>
      }
      wide
    >
      <Callout kind="insight" title="Votre fichier ne part nulle part">
        Ce site est un ensemble de fichiers statiques : il n&apos;y a aucun serveur à qui envoyer
        quoi que ce soit. La lecture, le calcul et l&apos;affichage se font entièrement dans
        votre navigateur, et rien n&apos;est conservé quand vous fermez l&apos;onglet.
      </Callout>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <ClientOnly
          fallback={<div className="h-[520px] animate-pulse rounded-xl border border-line bg-surface-1/60" />}
        >
          <DataImport />
        </ClientOnly>
        <ClientOnly fallback={<div className="h-[420px] rounded-xl border border-line bg-surface-1/60" />}>
          <CurrentDataset />
        </ClientOnly>
      </div>

      <SectionTitle hint="Trois choses qui décident si l'expérience aura un sens.">
        Ce qu&apos;il faut savoir avant d&apos;importer
      </SectionTitle>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="Deux colonnes, pas douze">
          <p className="text-[12px] leading-relaxed text-ink-2">
            Le site dessine un plan, donc il regarde exactement deux{" "}
            <G t="feature">features</G> à la fois. C&apos;est une contrainte réelle et pas un
            détail : le choix des deux colonnes décide de ce qui sera visible. Le classement
            « pouvoir séparateur » vous dit lesquelles portent l&apos;information, mais il juge
            chaque colonne isolément — deux colonnes médiocres séparément peuvent être
            excellentes ensemble, et inversement.
          </p>
        </Panel>

        <Panel title="Les échelles comptent">
          <p className="text-[12px] leading-relaxed text-ink-2">
            Une colonne en euros à côté d&apos;une colonne en années : la distance entre deux
            points ne dépendra plus que des euros, et KNN, le SVM et k-means deviendront
            aveugles à l&apos;autre. L&apos;interrupteur « même échelle » applique un{" "}
            <G t="normalisation">centrage-réduction</G>. Essayez les deux : c&apos;est la
            démonstration la plus convaincante de cette page-là, faite sur vos données.
          </p>
        </Panel>

        <Panel title="Combien de points">
          <p className="text-[12px] leading-relaxed text-ink-2">
            Au-delà d&apos;un millier de points, le SVM garde une matrice de n × n nombres
            (30 Mo à 2 000 points, 190 Mo à 5 000) et le nuage devient lourd à manipuler. Le
            site échantillonne donc, en respectant les proportions de chaque classe. Ce
            n&apos;est pas une limitation subie : prototyper sur un extrait puis mesurer sur
            tout est exactement ce que fait un praticien.
          </p>
        </Panel>
      </div>

      <SectionTitle hint="Deux questions à se poser avec un fichier réel sous les yeux.">
        Vérifiez que c&apos;est passé
      </SectionTitle>

      <Quiz
        questions={[
          {
            id: "im1",
            question:
              "Vous importez un fichier où une colonne est un chiffre d'affaires (0 à 900 000) et l'autre un nombre d'années (0 à 40). Sans rien faire d'autre, que verra KNN ?",
            options: [
              { id: "a", label: "Les deux colonnes, à parts égales" },
              {
                id: "b",
                label:
                  "Pratiquement le chiffre d'affaires seul : la distance est dominée par la colonne aux grands nombres",
              },
              { id: "c", label: "Les années, parce qu'elles sont plus petites" },
            ],
            answer: 1,
            explanation: (
              <>
                Un écart de 20 000 € écrase un écart de 30 ans dans une somme de carrés. La
                colonne des années devient invisible sans qu&apos;aucun message d&apos;erreur ne
                le signale — c&apos;est le mode de panne le plus courant sur des données réelles.
                Activez « même échelle » et comparez les frontières.
              </>
            ),
          },
          {
            id: "im2",
            question:
              "Votre fichier a 40 000 lignes et le site n'en garde que 600. Le résultat est-il faux ?",
            options: [
              { id: "a", label: "Oui, il faudrait tout utiliser" },
              {
                id: "b",
                label:
                  "Non, mais il est moins précis : l'échantillon est stratifié, donc non biaisé, seulement plus petit",
              },
              { id: "c", label: "Oui, sauf si les données sont triées" },
            ],
            answer: 1,
            explanation: (
              <>
                Tirer au hasard en respectant les proportions de chaque classe donne une image
                fidèle, juste plus floue : les mesures auront une{" "}
                <G t="variance">variance</G> plus grande, pas un biais. Ce qui serait faux,
                c&apos;est de prendre les 600 <em>premières</em> lignes d&apos;un fichier trié
                par classe — et c&apos;est précisément pour ça que l&apos;échantillonnage est
                stratifié.
              </>
            ),
          },
        ]}
      />
    </PageShell>
  );
}

/** The dataset every other page is currently looking at. */
function CurrentDataset() {
  const { dataset, imported } = useLab();
  const counts = dataset.classNames.map(
    (_, i) => dataset.samples.filter((s) => s.y === i).length,
  );

  return (
    <div className="space-y-4 xl:sticky xl:top-4">
      <Panel
        title={imported ? "Vos données, en place" : "Données actuelles du site"}
        subtitle={
          imported
            ? "Elles sont maintenant utilisées sur toutes les pages"
            : "Générées — importez un fichier pour les remplacer"
        }
        bodyClassName="p-3"
        action={<ClassLegend classNames={dataset.classNames} counts={counts} />}
        exportName="vos-donnees"
      >
        <DataPlot dataset={dataset} aspect={1} maxWidth={380} />
        <p className="mt-2 border-t border-line pt-2.5 text-[11px] leading-snug text-ink-2">
          {dataset.featureNames[0]} en abscisse, {dataset.featureNames[1]} en ordonnée ·{" "}
          {dataset.samples.length} points · {dataset.classNames.length} classes
        </p>
      </Panel>

      {imported && (
        <Panel title="Et maintenant ?" subtitle="Vos données sur les pages qui comptent">
          <ul className="space-y-1.5 text-[12px] text-ink-2">
            {[
              { href: "/comparaison/", label: "Comparer six modèles dessus", why: "le plus parlant en premier" },
              { href: "/classification/knn/", label: "KNN", why: "et l'effet des échelles" },
              { href: "/classification/arbre-de-decision/", label: "Un arbre de décision", why: "des règles lisibles sur vos colonnes" },
              { href: "/concepts/seuil/", label: "Le seuil de décision", why: "si vous avez deux classes" },
              { href: "/concepts/validation-croisee/", label: "La validation croisée", why: "pour un chiffre défendable" },
            ].map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-accent hover:underline">
                  {l.label}
                </Link>{" "}
                <span className="text-ink-muted">— {l.why}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
