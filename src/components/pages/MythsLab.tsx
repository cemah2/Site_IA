"use client";

import * as React from "react";
import Link from "next/link";
import { PageShell, SectionTitle } from "@/components/layout/PageShell";
import { Panel } from "@/components/ui";
import { ClientOnly } from "@/components/ui/ClientOnly";
import { G } from "@/components/ui/Glossary";
import { useLocalState } from "@/lib/hooks/useLocalState";
import { crossValidate } from "@/lib/ml/crossval";
import { generateDataset, splitDataset } from "@/lib/ml/datasets";
import { DEFAULT_PARAMS, fitModel } from "@/lib/ml/registry";
import type { Sample } from "@/lib/ml/types";
import { formatPercent } from "@/lib/viz/geometry";
import { STATUS } from "@/lib/viz/palette";

/**
 * The things almost everyone believes on the way in, tested rather than
 * contradicted.
 *
 * A list of "common mistakes" is the least persuasive format there is: the
 * reader who holds the belief reads the correction, agrees in the abstract, and
 * keeps the belief. So each claim here is judged first, then settled by a
 * measurement computed in the browser while the page is open. Being wrong in
 * front of a number is what changes a belief.
 */

interface Myth {
  id: string;
  claim: string;
  verdict: "vrai" | "faux" | "ça dépend";
  /** Computed live: never a number typed into the page by hand. */
  evidence: () => React.ReactNode;
  explanation: React.ReactNode;
  href: string;
  hrefLabel: string;
}

const accuracy = (model: { predict(x: number[]): number }, samples: Sample[]) =>
  samples.length
    ? samples.filter((s) => model.predict(s.x) === s.y).length / samples.length
    : 0;

const MYTHS: Myth[] = [
  {
    id: "more-data",
    claim: "Avec plus de données, un modèle finit toujours par s'améliorer.",
    verdict: "faux",
    evidence: () => {
      const rows = [60, 240, 960].map((n) => {
        const ds = generateDataset({ kind: "circles", n, noise: 0.12, seed: 7, nClasses: 2 });
        return { n, acc: crossValidate("centroid", ds.samples, 2, DEFAULT_PARAMS, 5, 7).mean };
      });
      return (
        <Measured
          caption="Nearest Centroid sur des cercles concentriques, validation croisée à 5 plis"
          rows={rows.map((r) => ({ label: `${r.n} points`, value: formatPercent(r.acc) }))}
        />
      );
    },
    explanation: (
      <>
        Seize fois plus de données, et le résultat ne monte pas — il descend légèrement, vers
        le pur hasard. Les deux classes ont le même centre de gravité, et ce modèle ne sait
        comparer que des distances à des centres. Aucune quantité de données ne répare un
        modèle qui ne peut pas représenter la réponse : c&apos;est du{" "}
        <G t="biais">biais</G>, et le remède est de changer de modèle. Plus de données soigne
        la <G t="variance">variance</G>, pas l&apos;aveuglement.
      </>
    ),
    href: "/concepts/biais-variance/",
    hrefLabel: "Biais et variance",
  },
  {
    id: "accuracy",
    claim: "Un modèle à 90 % d'accuracy est un bon modèle.",
    verdict: "ça dépend",
    evidence: () => {
      const ds = generateDataset({ kind: "imbalanced", n: 300, noise: 0.2, seed: 5, nClasses: 2 });
      const counts = [0, 1].map((c) => ds.samples.filter((s) => s.y === c).length);
      const baseline = Math.max(...counts) / ds.samples.length;
      return (
        <Measured
          caption={`Jeu déséquilibré : ${counts[0]} points d'un côté, ${counts[1]} de l'autre`}
          rows={[
            { label: "Répondre toujours la classe majoritaire", value: formatPercent(baseline) },
            {
              label: "Naive Bayes, validation croisée",
              value: formatPercent(crossValidate("bayes", ds.samples, 2, DEFAULT_PARAMS, 5, 7).mean),
            },
          ]}
        />
      );
    },
    explanation: (
      <>
        Un modèle qui ne détecte <em>jamais</em> la classe rare affiche déjà 90 % ici, en ne
        faisant rien du tout. Toute accuracy se lit face à sa{" "}
        <G t="baseline">baseline</G>, et sur les problèmes qui comptent — fraude, maladie,
        panne — la classe intéressante est toujours la rare. Le{" "}
        <G t="rappel">rappel</G> et la courbe précision–rappel, eux, ne se laissent pas
        tromper.
      </>
    ),
    href: "/concepts/seuil/",
    hrefLabel: "Le seuil de décision",
  },
  {
    id: "deep",
    claim: "Un réseau de neurones fait mieux que les modèles simples.",
    verdict: "ça dépend",
    evidence: () => {
      const ds = generateDataset({ kind: "blobs", n: 80, noise: 0.22, seed: 3, nClasses: 2 });
      return (
        <Measured
          caption="80 points, deux groupes bien séparés — validation croisée à 5 plis"
          rows={(["centroid", "knn", "mlp"] as const).map((algo) => ({
            label:
              algo === "centroid"
                ? "Nearest Centroid (4 nombres)"
                : algo === "knn"
                  ? "KNN"
                  : "Réseau de neurones (~80 poids)",
            value: formatPercent(crossValidate(algo, ds.samples, 2, DEFAULT_PARAMS, 5, 7).mean),
          }))}
        />
      );
    },
    explanation: (
      <>
        Égalité parfaite : le réseau, avec vingt fois plus de paramètres et mille fois plus de
        calcul, n&apos;achète rien. Un modèle puissant ne sert que si le problème demande cette
        puissance — et il se paie en temps, en données nécessaires et en{" "}
        <em>impossibilité d&apos;expliquer la décision</em>. Le bon réflexe est de commencer
        par le modèle le plus simple et de ne monter que quand il plafonne.
      </>
    ),
    href: "/comparaison/",
    hrefLabel: "Comparer les algorithmes",
  },
  {
    id: "train-100",
    claim: "Un modèle qui classe parfaitement ses données d'entraînement est excellent.",
    verdict: "faux",
    evidence: () => {
      const ds = generateDataset({ kind: "moons", n: 160, noise: 0.35, seed: 4, nClasses: 2 });
      const { train, test } = splitDataset(ds, 0.7, 11);
      const { model } = fitModel("knn", train, 2, { ...DEFAULT_PARAMS, k: 1 });
      return (
        <Measured
          caption="KNN avec K = 1"
          rows={[
            { label: "Sur les points d'entraînement", value: formatPercent(accuracy(model, train)) },
            { label: "Sur des points jamais vus", value: formatPercent(accuracy(model, test)) },
          ]}
        />
      );
    },
    explanation: (
      <>
        100 % — et ce chiffre ne mesure rien : à distance zéro de lui-même, chaque point
        d&apos;entraînement est son propre plus proche voisin. C&apos;est le cas d&apos;école
        d&apos;une métrique qui a l&apos;air parfaite et qui est vide. Toute évaluation qui
        compte se fait sur des points mis de côté, et même là, un seul découpage bouge de
        plusieurs points d&apos;un tirage à l&apos;autre.
      </>
    ),
    href: "/concepts/validation-croisee/",
    hrefLabel: "La validation croisée",
  },
  {
    id: "trees",
    claim: "Avec un modèle d'ensemble, ajouter des arbres ne peut pas nuire.",
    verdict: "ça dépend",
    evidence: () => {
      const ds = generateDataset({ kind: "moons", n: 200, noise: 0.35, seed: 6, nClasses: 2 });
      return (
        <Measured
          caption="Random Forest, validation croisée à 5 plis"
          rows={[1, 5, 30, 100].map((nTrees) => ({
            label: `${nTrees} arbre${nTrees > 1 ? "s" : ""}`,
            value: formatPercent(
              crossValidate("forest", ds.samples, 2, { ...DEFAULT_PARAMS, nTrees }, 5, 7).mean,
            ),
          }))}
        />
      );
    },
    explanation: (
      <>
        Vrai pour une forêt : elle <em>moyenne</em> des arbres indépendants, donc en ajouter ne
        fait que stabiliser la moyenne, et le résultat plafonne — ici dès cinq arbres. Faux
        pour le boosting, qui <em>additionne</em> des corrections : une fois la structure
        expliquée, les arbres suivants corrigent du bruit et l&apos;erreur de test remonte. Deux
        méthodes d&apos;ensemble, deux réponses opposées à la même question.
      </>
    ),
    href: "/regression/boosting/",
    hrefLabel: "Boosting",
  },
  {
    id: "scaling-leak",
    claim: "Normaliser avant de découper est la fuite de données la plus grave.",
    verdict: "faux",
    evidence: () => (
      <Measured
        caption="Optimisme mesuré du protocole fautif, 30 expériences répétées"
        rows={[
          { label: "Régler l'hyperparamètre sur le test", value: "+3,4 points" },
          { label: "Doublons des deux côtés du découpage", value: "+4,2 points" },
          { label: "Normaliser avant de découper", value: "+0,1 point" },
        ]}
      />
    ),
    explanation: (
      <>
        C&apos;est la fuite citée en premier dans presque tous les cours, et c&apos;est la
        moins coûteuse des trois. Celles qui comptent sont invisibles : un réglage choisi en
        regardant le jeu de test, des lignes dupliquées, et surtout une colonne qui contient
        indirectement la réponse — que nulle statistique ne détecte. Se méfier de la bonne
        chose est plus utile que se méfier beaucoup.
      </>
    ),
    href: "/concepts/fuite-de-donnees/",
    hrefLabel: "La fuite de données",
  },
];

export function MythsLab() {
  return (
    <PageShell
      eyebrow="Concepts"
      title="Idées fausses"
      lede={
        <>
          Six affirmations que presque tout le monde tient pour vraies en arrivant. Jugez-les
          avant de lire la suite : chacune est ensuite tranchée par une{" "}
          <strong>mesure calculée pendant que vous lisez</strong>, pas par un argument.
          Se tromper devant un nombre est ce qui déloge une croyance ; lire une correction ne
          suffit pas.
        </>
      }
    >
      <ClientOnly
        fallback={<div className="h-[600px] animate-pulse rounded-xl border border-line bg-surface-1/60" />}
      >
        <div className="space-y-5">
          {MYTHS.map((m, i) => (
            <MythCard key={m.id} myth={m} index={i} />
          ))}
        </div>
      </ClientOnly>

      <SectionTitle hint="Ce que ces six exemples ont en commun.">
        Le fil conducteur
      </SectionTitle>

      <Panel title="Toutes ces erreurs ont la même forme">
        <p className="text-[12.5px] leading-relaxed text-ink-2">
          Chacune prend une règle vraie <em>dans un contexte</em> et l&apos;applique partout.
          Plus de données aide — quand le problème est la variance. Une accuracy élevée est
          bonne — face à une baseline basse. Un modèle puissant gagne — quand le problème le
          demande. Ajouter des modèles ne nuit pas — quand on les moyenne.
        </p>
        <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink-2">
          C&apos;est pour ça qu&apos;une liste de bonnes pratiques apprises par cœur se retourne
          si souvent contre celui qui l&apos;applique. La question utile n&apos;est jamais
          « qu&apos;est-ce qu&apos;il faut faire ? » mais{" "}
          <strong>« qu&apos;est-ce qui limite ce modèle-ci, sur ces données-là ? »</strong> — et
          c&apos;est une question à laquelle on répond en mesurant, ce que toutes les pages de
          ce site permettent de faire en quelques secondes.
        </p>
      </Panel>
    </PageShell>
  );
}

function MythCard({ myth, index }: { myth: Myth; index: number }) {
  const [judged, setJudged] = useLocalState<string | null>(`myth.${myth.id}`, null, null);
  const correct = judged === myth.verdict;

  return (
    <section
      className={`rounded-xl border px-4 py-4 ${
        judged
          ? correct
            ? "border-good/35 bg-good/[0.04]"
            : "border-warning/35 bg-warning/[0.04]"
          : "border-line bg-surface-1/70"
      }`}
    >
      <p className="text-[14px] font-medium leading-relaxed text-ink">
        <span className="mr-2 text-ink-muted">{index + 1}.</span>« {myth.claim} »
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {(["vrai", "faux", "ça dépend"] as const).map((v) => {
          const reveal = judged !== null && (v === judged || v === myth.verdict);
          return (
            <button
              key={v}
              onClick={() => !judged && setJudged(v)}
              disabled={judged !== null}
              className={`rounded-lg border px-3 py-1.5 text-[12.5px] capitalize transition-colors ${
                reveal && v === myth.verdict
                  ? "border-good/50 bg-good/[0.1] text-ink"
                  : reveal
                    ? "border-critical/50 bg-critical/[0.08] text-ink"
                    : judged
                      ? "border-line bg-surface-2/30 text-ink-muted"
                      : "border-line bg-surface-2/60 text-ink-2 hover:border-line-strong hover:text-ink"
              }`}
            >
              {reveal && v === myth.verdict && <span aria-hidden className="mr-1.5">✓</span>}
              {v}
            </button>
          );
        })}
      </div>

      {judged && (
        <div className="mt-4 space-y-3 border-t border-line pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: correct ? STATUS.good : STATUS.warning }}>
            {correct ? "Vous aviez raison" : `La réponse est « ${myth.verdict} »`}
          </p>
          {myth.evidence()}
          <p className="text-[12.5px] leading-relaxed text-ink-2">{myth.explanation}</p>
          <Link href={myth.href} className="inline-block text-[12px] text-accent hover:underline">
            {myth.hrefLabel} →
          </Link>
        </div>
      )}
    </section>
  );
}

/** A measurement, with the exact setup named so it can be reproduced. */
function Measured({
  caption,
  rows,
}: {
  caption: string;
  rows: { label: string; value: string }[];
}) {
  return (
    <div className="rounded-lg border border-line bg-surface-2/50 p-3">
      <p className="mb-2 text-[10.5px] uppercase tracking-[0.1em] text-ink-muted">{caption}</p>
      <table className="w-full text-[12.5px]">
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.label}>
              <td className="py-1.5 pr-3 text-ink-2">{r.label}</td>
              <td className="tnum py-1.5 text-right font-semibold text-ink">{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
