"use client";

import * as React from "react";
import Link from "next/link";
import { PageShell, SectionTitle } from "@/components/layout/PageShell";
import { Button, Callout, Panel, Segmented, Slider, Stat } from "@/components/ui";
import { G } from "@/components/ui/Glossary";
import { ClientOnly } from "@/components/ui/ClientOnly";
import { Levels } from "@/components/ui/Levels";
import { Tex } from "@/components/math/Math";
import { PredictFirst } from "@/components/lab/Practice";
import { Quiz } from "@/components/lab/Quiz";
import { SplitLottery } from "@/components/viz/CrossValViz";
import { runLeakExperiment, type LeakKind } from "@/lib/ml/leakage";
import { formatPercent } from "@/lib/viz/geometry";
import { STATUS } from "@/lib/viz/palette";

const LEAKS: {
  id: LeakKind;
  label: string;
  title: string;
  wrong: string;
  right: string;
}[] = [
  {
    id: "tuning",
    label: "Régler sur le test",
    title: "Choisir un hyperparamètre en regardant le jeu de test",
    wrong:
      "On essaie douze valeurs de K, on garde celle qui donne la meilleure accuracy sur le jeu de test, et on annonce cette accuracy.",
    right:
      "On choisit K sur un jeu de validation, et on n'ouvre le jeu de test qu'une fois, à la fin, pour annoncer un résultat.",
  },
  {
    id: "duplicates",
    label: "Doublons",
    title: "Les mêmes lignes des deux côtés du découpage",
    wrong:
      "Le fichier contient des lignes en double — une fusion ratée, ou plusieurs mesures du même sujet. Le découpage aléatoire en met des copies dans l'entraînement et dans le test.",
    right:
      "On dédoublonne avant de découper, ou on découpe par sujet plutôt que par ligne.",
  },
  {
    id: "scaling",
    label: "Normaliser trop tôt",
    title: "Calculer les statistiques de normalisation sur tout le jeu",
    wrong:
      "On ramène les colonnes entre 0 et 1 en utilisant le minimum et le maximum de toutes les données, puis on découpe.",
    right:
      "On calcule minimum et maximum sur l'entraînement seul, puis on applique la même transformation au test.",
  },
];

export function LeakageLab() {
  return (
    <PageShell
      eyebrow="Concepts"
      title="La fuite de données"
      lede={
        <>
          Une fuite, c&apos;est quand une information que le modèle ne devrait pas avoir se
          glisse dans son entraînement. Le résultat annoncé est alors{" "}
          <strong>trop beau, et faux</strong> — et rien ne le signale. Cette page mesure trois
          fuites au lieu de les réciter, et le classement qui en sort ne ressemble pas à celui
          qu&apos;on lit d&apos;habitude.
        </>
      }
      wide
    >
      <ClientOnly
        fallback={<div className="h-[520px] animate-pulse rounded-xl border border-line bg-surface-1/60" />}
      >
        <LeakBench />
      </ClientOnly>

      <SectionTitle hint="La même idée, à trois niveaux de détail.">
        Pourquoi c&apos;est si difficile à voir
      </SectionTitle>

      <Levels
        intuition={
          <>
            <p>
              Un professeur prépare un examen et, la veille, laisse traîner le sujet dans la
              salle de révision. Les notes sont excellentes. Elles ne disent plus rien sur ce
              que les élèves savent — et surtout, rien dans les copies ne permet de s&apos;en
              apercevoir. Elles ressemblent à d&apos;excellentes copies.
            </p>
            <p>
              C&apos;est toute la difficulté de la fuite de données : elle ne produit aucun
              message d&apos;erreur, aucun comportement bizarre. Elle produit un{" "}
              <em>bon</em> résultat. C&apos;est la seule catégorie de bug en apprentissage
              automatique qui se déguise en succès, et c&apos;est pour ça qu&apos;elle survit
              jusqu&apos;en production, où elle se découvre enfin — trop tard.
            </p>
            <p>
              La question à se poser n&apos;est jamais « mon score est-il bon ? » mais « au
              moment où ce chiffre a été calculé, qu&apos;est-ce que le modèle avait déjà
              vu ? ».
            </p>
          </>
        }
        technique={
          <>
            <p>
              La règle tient en une phrase : <strong>tout ce qui est appris doit l&apos;être
              sur les données d&apos;entraînement seules</strong>. Cela inclut les poids du
              modèle, mais aussi les <G t="hyperparametre">hyperparamètres</G>, les moyennes de
              normalisation, la sélection de variables, le remplissage des valeurs manquantes
              et le choix du modèle lui-même.
            </p>
            <p>
              Le cas le plus coûteux en pratique n&apos;est aucun de ceux mesurés ici : c&apos;est
              une colonne qui contient, directement ou indirectement, la réponse. Une date de
              résiliation dans un modèle qui prédit la résiliation ; un numéro de dossier
              attribué après le diagnostic. Le modèle atteint 99 %, et il a simplement appris à
              lire l&apos;étiquette.
            </p>
            <p>
              Avec des données temporelles, un découpage aléatoire est une fuite à lui tout
              seul : le modèle s&apos;entraîne sur demain pour prédire hier. Le découpage doit
              alors suivre le temps, pas le hasard.
            </p>
          </>
        }
        maths={
          <>
            <p>
              Formellement, on veut estimer le risque d&apos;un modèle sur des données
              nouvelles, <Tex>{String.raw`\mathbb{E}_{(x,y)\sim P}\,[\,L(y, \hat{f}(x))\,]`}</Tex>,
              où <Tex>{String.raw`\hat{f}`}</Tex> a été construit à partir du seul jeu
              d&apos;entraînement. L&apos;estimation par un jeu de test n&apos;est sans biais
              que si ce jeu est indépendant de tout ce qui a servi à produire{" "}
              <Tex>{String.raw`\hat{f}`}</Tex>.
            </p>
            <p>
              Choisir un hyperparamètre sur le jeu de test viole exactement cette condition :
              on ne rapporte plus une performance mais un maximum,{" "}
              <Tex>{String.raw`\max_{k} \widehat{R}_{\text{test}}(\hat{f}_k)`}</Tex>. Or le
              maximum de <Tex>m</Tex> estimateurs bruités est biaisé vers le haut, et le biais
              croît avec <Tex>m</Tex> : plus on essaie de valeurs, plus on se ment. C&apos;est
              le même phénomène que la comparaison multiple en statistique.
            </p>
            <p>
              Les doublons cassent une hypothèse encore plus fondamentale, celle
              d&apos;échantillons indépendants : un point de test identique à un point
              d&apos;entraînement n&apos;est pas un tirage nouveau, c&apos;est le même tirage
              compté deux fois.
            </p>
          </>
        }
      />

      <SectionTitle hint="Trois questions auxquelles la page ci-dessus répond.">
        Vérifiez que c&apos;est passé
      </SectionTitle>

      <PredictFirst
        id="leak-ranking"
        className="mb-5"
        question={
          <>
            Des trois fuites mesurées ci-dessus, laquelle gonfle le plus le score annoncé, à
            votre avis ?
          </>
        }
        options={["Normaliser avant de découper", "Régler l'hyperparamètre sur le test", "Les trois à égalité"]}
        answer={1}
        explanation={
          <>
            Régler sur le test coûte environ 3 points, les doublons environ 3 points aussi — et
            normaliser trop tôt ne coûte rien du tout sur ces données. C&apos;est pourtant cette
            dernière qui est citée en premier dans presque tous les cours. Mesurer plutôt que
            réciter change l&apos;ordre des priorités.
          </>
        }
      />

      <Quiz
        questions={[
          {
            id: "lk1",
            question:
              "Vous prédisez la résiliation d'un abonnement, et votre fichier contient une colonne « date de dernier contact avec le service client ». Faut-il s'en méfier ?",
            options: [
              { id: "a", label: "Non, c'est une information légitime connue à l'avance" },
              {
                id: "b",
                label:
                  "Oui : si ce contact a souvent lieu au moment de résilier, la colonne contient la réponse",
              },
              { id: "c", label: "Non, tant que la colonne n'est pas l'étiquette elle-même" },
            ],
            answer: 1,
            explanation: (
              <>
                C&apos;est la fuite la plus coûteuse en pratique, et aucune méthode statistique
                ne la détecte : il faut savoir <em>quand</em> chaque colonne devient connue. La
                question à poser pour chaque variable est « au moment où je devrai prédire, en
                vrai, cette information sera-t-elle déjà disponible ? ». Si la réponse est non,
                la colonne doit sortir, aussi utile paraisse-t-elle.
              </>
            ),
          },
          {
            id: "lk2",
            question:
              "Vos données sont des mesures répétées sur 50 patients, trois visites chacun. Comment découper ?",
            options: [
              { id: "a", label: "Au hasard, ligne par ligne" },
              { id: "b", label: "Par patient : toutes les visites d'un patient du même côté" },
              { id: "c", label: "Par date de visite" },
            ],
            answer: 1,
            explanation: (
              <>
                Deux visites du même patient se ressemblent énormément. Découpées au hasard,
                elles mettent quasiment le même individu des deux côtés — exactement la fuite
                par doublons mesurée plus haut, en un peu plus subtil. Le modèle apprend à
                reconnaître des patients, pas une maladie, et il s&apos;effondrera sur de
                nouveaux patients.
              </>
            ),
          },
          {
            id: "lk3",
            question:
              "Vous prédisez le cours d'une action et découpez vos données au hasard en 70/30. Où est la fuite ?",
            options: [
              { id: "a", label: "Il n'y en a pas, 70/30 est standard" },
              {
                id: "b",
                label:
                  "Le modèle s'entraîne sur des jours postérieurs à ceux qu'il doit prédire : il connaît le futur",
              },
              { id: "c", label: "Il faudrait 80/20" },
            ],
            answer: 1,
            explanation: (
              <>
                Avec des données ordonnées dans le temps, un tirage au hasard place des jours de
                mars dans l&apos;entraînement et des jours de février dans le test. En
                production, cette information n&apos;existera pas. Le découpage doit suivre le
                temps : tout ce qui est avant une date pour apprendre, tout ce qui est après
                pour évaluer.
              </>
            ),
          },
        ]}
      />
    </PageShell>
  );
}

function LeakBench() {
  const [kind, setKind] = React.useState<LeakKind>("tuning");
  const [reps, setReps] = React.useState(30);
  const [noise, setNoise] = React.useState(0.3);
  const [outlier, setOutlier] = React.useState(20);

  const result = React.useMemo(
    () => runLeakExperiment(kind, reps, noise, outlier),
    [kind, reps, noise, outlier],
  );
  const spec = LEAKS.find((l) => l.id === kind)!;
  const flatters = result.optimism > 0.004;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,330px)]">
      <div className="space-y-5">
        <Panel title={spec.title} subtitle={`${reps} expériences répétées, refaites à chaque réglage`} exportName={`fuite-${kind}`}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-critical/35 bg-critical/[0.06] p-3">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-critical">
                Protocole fautif
              </p>
              <p className="text-[12px] leading-relaxed text-ink-2">{spec.wrong}</p>
              <p className="tnum mt-2 text-[22px] font-semibold" style={{ color: STATUS.critical }}>
                {formatPercent(result.leakyMean)}
              </p>
            </div>
            <div className="rounded-lg border border-good/35 bg-good/[0.06] p-3">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-good">
                Protocole correct
              </p>
              <p className="text-[12px] leading-relaxed text-ink-2">{spec.right}</p>
              <p className="tnum mt-2 text-[22px] font-semibold" style={{ color: STATUS.good }}>
                {formatPercent(result.honestMean)}
              </p>
            </div>
          </div>

          <div className="mt-4 border-t border-line pt-3">
            <p className="mb-1.5 text-[11px] font-medium text-ink-2">
              Ce qu&apos;annonce le protocole fautif, expérience par expérience
            </p>
            <SplitLottery
              draws={result.runs.map((r) => r.leaky)}
              cvMean={result.honestMean}
              height={110}
            />
            <p className="mt-1 text-[11px] leading-snug text-ink-muted">
              Chaque point est une expérience complète. La ligne verte est la moyenne du
              protocole correct — la valeur à laquelle il faudrait croire.
            </p>
          </div>
        </Panel>

        <Callout
          kind={flatters ? "critical" : "insight"}
          title={
            flatters
              ? `Le protocole fautif vous flatte de ${formatPercent(result.optimism, 1)}`
              : result.optimism < -0.004
                ? `Surprise : le protocole fautif fait ${formatPercent(-result.optimism, 1)} de moins`
                : "Sur ces données, cette fuite ne change rien de mesurable"
          }
        >
          {kind === "tuning" && (
            <>
              Douze valeurs essayées, et on garde la meilleure : le chiffre annoncé n&apos;est
              plus une performance, c&apos;est un <em>maximum</em>. Le maximum de douze mesures
              bruitées est systématiquement trop haut, et l&apos;excès grandit avec le nombre de
              valeurs essayées. C&apos;est le même phénomène que la comparaison multiple en
              statistique — et c&apos;est exactement ce que la{" "}
              <Link href="/concepts/validation-croisee/" className="text-accent hover:underline">
                validation croisée
              </Link>{" "}
              sert à éviter.
            </>
          )}
          {kind === "duplicates" && (
            <>
              Avec <Tex>K = 1</Tex>, un point de test qui a son jumeau dans l&apos;entraînement
              est reconnu à distance zéro : le modèle n&apos;a rien généralisé, il a retrouvé une
              copie. Rien dans les métriques ne le dit. C&apos;est la fuite la plus fréquente
              sur des données réelles issues de plusieurs fichiers fusionnés.
            </>
          )}
          {kind === "scaling" && (
            <>
              C&apos;est la fuite que tous les cours citent en premier, et sur ces données elle
              ne rapporte rien. Pire : avec une valeur aberrante, le protocole fautif obtient un
              score <em>plus bas</em>, parce que l&apos;étendue commune écrase toutes les
              données réelles dans un coin de l&apos;intervalle des deux côtés. Faites glisser
              « valeur aberrante » et regardez l&apos;écart changer de signe. Cela ne rend pas la
              règle inutile — elle protège d&apos;autres situations — mais cela remet cette
              fuite-là à sa place dans l&apos;ordre des priorités.
            </>
          )}
        </Callout>
      </div>

      <div className="space-y-4">
        <Panel title="Quelle fuite" bodyClassName="space-y-4 p-4">
          <Segmented
            label="Expérience"
            value={kind}
            options={LEAKS.map((l) => ({ value: l.id, label: l.label }))}
            onChange={(v) => setKind(v as LeakKind)}
            size="sm"
          />
          <Slider
            label="Expériences répétées"
            value={reps}
            min={10}
            max={60}
            step={5}
            onChange={setReps}
            hint="Chaque expérience regénère les données et refait les deux protocoles."
          />
          <Slider
            label="Bruit des données"
            value={noise}
            min={0.1}
            max={0.5}
            step={0.05}
            onChange={setNoise}
            format={(v) => v.toFixed(2)}
            hint="Plus il y a de bruit, plus il y a de place pour que la chance se fasse passer pour de la performance."
          />
          {kind === "scaling" && (
            <Slider
              label="Valeur aberrante"
              value={outlier}
              min={1}
              max={200}
              step={1}
              onChange={setOutlier}
              format={(v) => `× ${v}`}
              hint="Une mesure mal saisie, comme il y en a dans tout fichier réel. À 1, il n'y en a pas."
            />
          )}
          <Button variant="ghost" className="w-full" onClick={() => setReps((r) => (r === 30 ? 31 : 30))}>
            Relancer
          </Button>
        </Panel>

        <div className="grid grid-cols-2 gap-2">
          <Stat
            label="Écart"
            value={formatPercent(result.optimism, 1)}
            tone={flatters ? "critical" : result.optimism < -0.004 ? "warning" : "good"}
            hint="Fautif moins correct"
          />
          <Stat label="Calcul" value={`${Math.round(result.ms)} ms`} hint={`${reps} expériences`} />
        </div>

        <Panel title="L'ordre qui compte" subtitle="Mesuré ici, pas récité">
          <ol className="space-y-2 text-[12px] leading-relaxed text-ink-2">
            <li>
              <strong>1. Une colonne qui contient la réponse.</strong> Non mesurable ici parce
              qu&apos;elle dépend du métier — et de loin la plus coûteuse en vrai.
            </li>
            <li>
              <strong>2. Régler sur le test</strong> — environ 3 points, et ça grandit avec le
              nombre de réglages essayés.
            </li>
            <li>
              <strong>3. Les doublons</strong> — environ 3 points, et parfaitement invisible.
            </li>
            <li>
              <strong>4. Normaliser trop tôt</strong> — négligeable ici, malgré sa place
              habituelle en tête de liste.
            </li>
          </ol>
        </Panel>
      </div>
    </div>
  );
}
