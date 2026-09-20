"use client";

import * as React from "react";
import { PageShell, SectionTitle, Workbench } from "@/components/layout/PageShell";
import { Button, Callout, Divider, Panel, Slider, Stat, Toggle } from "@/components/ui";
import { Levels } from "@/components/ui/Levels";
import { LiveFormula, Tex } from "@/components/math/Math";
import { LineChart } from "@/components/viz/LineChart";
import { Plot } from "@/components/viz/Plot";
import { DatasetControls } from "@/components/lab/DatasetControls";
import { kmeansSteps } from "@/lib/ml/models/kmeans";
import { shapePath, formatNumber } from "@/lib/viz/geometry";
import { classColor, classShape, CHROME, SERIES, withAlpha } from "@/lib/viz/palette";
import { useLab } from "@/store/lab";

export function ClusteringLab() {
  const { dataset, seed, reseed } = useLab();
  const [k, setK] = React.useState(3);
  const [initSeed, setInitSeed] = React.useState(1);
  const [step, setStep] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  const [showTruth, setShowTruth] = React.useState(false);

  const steps = React.useMemo(
    () => kmeansSteps(dataset.samples, k, seed + initSeed * 1013, 30),
    [dataset.samples, k, seed, initSeed],
  );

  const clamped = Math.min(step, Math.max(0, steps.length - 1));
  const current = steps[clamped];

  // Restart when the problem changes: a half-run trajectory on new data is
  // meaningless, and silently keeping it would misrepresent the algorithm.
  const runKey = `${dataset.samples.length}|${k}|${seed}|${initSeed}`;
  const [lastKey, setLastKey] = React.useState(runKey);
  if (lastKey !== runKey) {
    setLastKey(runKey);
    setStep(0);
    setPlaying(false);
  }

  React.useEffect(() => {
    if (!playing) return;
    const id = setTimeout(() => {
      setStep((s) => {
        if (s >= steps.length - 1) {
          setPlaying(false);
          return s;
        }
        return s + 1;
      });
    }, 700);
    return () => clearTimeout(id);
  }, [playing, step, steps.length]);

  // The elbow curve: inertia for every K, which is how K is chosen in practice.
  const elbow = React.useMemo(() => {
    const out: { k: number; inertia: number }[] = [];
    for (let kk = 1; kk <= 8; kk++) {
      const s = kmeansSteps(dataset.samples, kk, seed + initSeed * 1013, 30);
      out.push({ k: kk, inertia: s.at(-1)?.inertia ?? 0 });
    }
    return out;
  }, [dataset.samples, seed, initSeed]);

  const phase = clamped === 0 ? "assign" : "both";

  return (
    <PageShell
      eyebrow="Concepts"
      title="Clustering"
      lede={
        <>
          Jusqu&apos;ici, chaque point portait une étiquette. Enlevez-la : le problème change de
          nature. Il ne s&apos;agit plus de <em>prédire</em> une classe connue, mais de{" "}
          <strong>découvrir</strong> s&apos;il existe des groupes. C&apos;est
          l&apos;apprentissage non supervisé, et K-means en est l&apos;exemple le plus clair.
        </>
      }
      wide
    >
      <Workbench
        plot={
          <div className="space-y-5">
            <Panel
              title={`Itération ${clamped}`}
              subtitle={
                clamped === 0
                  ? "Initialisation (k-means++) puis première affectation : chaque point rejoint le centre le plus proche."
                  : current?.converged
                    ? "Convergé : plus aucun point ne change de groupe. L'algorithme s'arrête de lui-même."
                    : "Les centres ont bougé vers la moyenne de ce qu'ils avaient capturé, puis tout le monde se réaffecte."
              }
              bodyClassName="p-3"
            >
              <Plot
                xDomain={dataset.domain[0]}
                yDomain={dataset.domain[1]}
                aspect={1}
                maxWidth={520}
                xLabel={dataset.featureNames[0]}
                yLabel={dataset.featureNames[1]}
                ariaLabel="Nuage de points colorié par cluster"
              >
                {(frame) => (
                  <g clipPath="url(#plot-clip)">
                    {/* Assignment lines: the geometric meaning of "belongs to
                        this cluster" is simply "this centre is the nearest". */}
                    {current &&
                      dataset.samples.map((s, i) => {
                        const c = current.centroids[current.assignment[i]];
                        if (!c) return null;
                        const [px, py] = frame.px(s.x[0], s.x[1]);
                        const [cx, cy] = frame.px(c[0], c[1]);
                        return (
                          <line
                            key={`l${s.id}`}
                            x1={px}
                            y1={py}
                            x2={cx}
                            y2={cy}
                            stroke={withAlpha(classColor(current.assignment[i]), 0.22)}
                            strokeWidth={1}
                          />
                        );
                      })}

                    {current &&
                      dataset.samples.map((s, i) => {
                        const cluster = current.assignment[i];
                        const [px, py] = frame.px(s.x[0], s.x[1]);
                        return (
                          <g key={s.id}>
                            <path
                              d={shapePath(
                                showTruth ? classShape(s.y) : classShape(cluster),
                                px,
                                py,
                                4.5,
                              )}
                              fill={classColor(showTruth ? s.y : cluster)}
                              stroke={CHROME.surface1}
                              strokeWidth={1.75}
                            />
                          </g>
                        );
                      })}

                    {current?.centroids.map((c, i) => {
                      const [cx, cy] = frame.px(c[0], c[1]);
                      return (
                        <g key={`c${i}`}>
                          <circle
                            cx={cx}
                            cy={cy}
                            r={13}
                            fill={withAlpha(classColor(i), 0.2)}
                            stroke={classColor(i)}
                            strokeWidth={2}
                          />
                          <path
                            d={`M${cx - 6},${cy}h12M${cx},${cy - 6}v12`}
                            stroke={classColor(i)}
                            strokeWidth={2}
                          />
                        </g>
                      );
                    })}
                  </g>
                )}
              </Plot>
              <p className="mt-2 text-[11px] leading-snug text-ink-muted">
                {showTruth
                  ? "Couleurs : les vraies classes. K-means ne les a jamais vues — comparez-les aux groupes qu'il a trouvés."
                  : "Couleurs : les groupes découverts par l'algorithme. Elles n'ont aucun rapport avec de vraies classes."}
              </p>
            </Panel>

            <Panel
              title="Choisir K : la méthode du coude"
              subtitle="L'inertie décroît toujours avec K. Ce qu'on cherche, c'est le moment où elle cesse de décroître vite."
            >
              <LineChart
                series={[
                  {
                    key: "inertia",
                    label: "inertie",
                    color: SERIES[0],
                    points: elbow.map((e) => ({ x: e.k, y: e.inertia })),
                  },
                ]}
                height={190}
                marker={k}
                xLabel="K"
                yFormat={(v) => v.toFixed(0)}
              />
              <p className="mt-2 text-[11px] leading-snug text-ink-muted">
                Avec <Tex>K = n</Tex>, l&apos;inertie vaut exactement 0 — chaque point est son
                propre centre. Minimiser l&apos;inertie ne peut donc jamais servir à choisir{" "}
                <Tex>K</Tex> ; on cherche le <strong>coude</strong>, le point où ajouter un
                groupe cesse de payer.
              </p>
            </Panel>
          </div>
        }
        controls={
          <>
            <Slider
              label={
                <>
                  <Tex>K</Tex> — nombre de groupes
                </>
              }
              value={k}
              min={1}
              max={5}
              onChange={setK}
              hint="C'est vous qui le décidez. L'algorithme ne peut pas le deviner — c'est sa principale limite."
            />
            <Divider label="Exécution" />
            <div className="flex gap-2">
              <Button
                variant="primary"
                className="flex-1"
                onClick={() => {
                  if (clamped >= steps.length - 1) setStep(0);
                  setPlaying((p) => !p);
                }}
              >
                {playing ? "Pause" : clamped >= steps.length - 1 ? "Rejouer" : "Lancer"}
              </Button>
              <Button
                onClick={() => {
                  setPlaying(false);
                  setStep(Math.min(steps.length - 1, clamped + 1));
                }}
                disabled={clamped >= steps.length - 1}
              >
                Étape →
              </Button>
            </div>
            <Slider
              label="Itération"
              value={clamped}
              min={0}
              max={Math.max(1, steps.length - 1)}
              onChange={(v) => {
                setPlaying(false);
                setStep(v);
              }}
            />
            <Button
              size="sm"
              variant="ghost"
              className="w-full"
              onClick={() => setInitSeed((s) => s + 1)}
            >
              Autre initialisation
            </Button>
            <p className="text-[11px] leading-snug text-ink-muted">
              Relancez plusieurs fois : le résultat final n&apos;est pas toujours le même.
              K-means converge vers un minimum <em>local</em>.
            </p>

            <Divider label="Affichage" />
            <Toggle
              label="Montrer les vraies classes"
              checked={showTruth}
              onChange={setShowTruth}
              hint="Pour comparer ce que l'algorithme a trouvé à ce qu'on savait déjà — une information qu'il n'a jamais eue."
            />
            <Divider label="Données" />
            <DatasetControls />
            <Button size="sm" variant="ghost" className="w-full" onClick={reseed}>
              Autres points
            </Button>
          </>
        }
        below={
          <>
            <div className="grid grid-cols-2 gap-2">
              <Stat
                label="Inertie"
                value={current ? formatNumber(current.inertia, 2) : "—"}
                hint="Somme des carrés des distances au centre du groupe"
              />
              <Stat
                label="État"
                value={current?.converged ? "Convergé" : `Itération ${clamped}`}
                tone={current?.converged ? "good" : "neutral"}
              />
            </div>

            <Panel title="Les deux phases" subtitle="Répétées jusqu'à ce que rien ne change">
              <ol className="space-y-1.5">
                {[
                  {
                    n: "1",
                    title: "Affectation",
                    body: "Chaque point rejoint le centre le plus proche. Les centres ne bougent pas.",
                    active: phase === "assign" || phase === "both",
                  },
                  {
                    n: "2",
                    title: "Mise à jour",
                    body: "Chaque centre se déplace à la moyenne des points qu'il a capturés. Les affectations ne changent pas.",
                    active: phase === "both",
                  },
                ].map((p) => (
                  <li
                    key={p.n}
                    className="flex gap-2.5 rounded-lg border border-line bg-surface-2/50 px-2.5 py-2"
                  >
                    <span className="tnum mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[10px] font-semibold text-accent">
                      {p.n}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[12px] font-medium text-ink">{p.title}</span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-ink-muted">
                        {p.body}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
              <p className="mt-2.5 text-[11px] leading-snug text-ink-2">
                Chacune des deux phases <strong>ne peut que faire baisser l&apos;inertie</strong>.
                Comme il n&apos;y a qu&apos;un nombre fini d&apos;affectations possibles, la
                convergence est garantie — en un nombre fini d&apos;étapes.
              </p>
            </Panel>

            <Callout kind="warning" title="Ce que K-means suppose">
              Des groupes <strong>ronds</strong>, de <strong>taille comparable</strong>, et de{" "}
              <strong>densité comparable</strong>. Essayez sur « Deux lunes » ou « Spirales » :
              l&apos;algorithme coupe droit à travers les formes. Ce n&apos;est pas un défaut
              d&apos;implémentation — c&apos;est la conséquence directe de « affecter au centre
              le plus proche ».
            </Callout>
          </>
        }
      />

      <SectionTitle hint="La même idée, à trois profondeurs de lecture.">
        Comment ça marche
      </SectionTitle>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <Levels
          intuition={
            <>
              <p>
                Vous devez placer <Tex>K</Tex> antennes pour couvrir une ville, de façon à ce
                que chaque habitant soit le plus près possible d&apos;une antenne.
              </p>
              <p>
                Posez-les n&apos;importe où pour commencer. Puis répétez deux gestes :{" "}
                <strong>chaque habitant se rattache à l&apos;antenne la plus proche</strong>,
                puis <strong>chaque antenne se déplace au centre de ses habitants</strong>.
              </p>
              <p>
                Au bout de quelques tours, plus rien ne bouge. C&apos;est tout K-means.
              </p>
              <p>
                Les deux difficultés sont dehors, pas dans l&apos;algorithme :{" "}
                <strong>combien d&apos;antennes ?</strong> — personne ne vous le dira — et{" "}
                <strong>où les poser au départ ?</strong> — car le résultat final en dépend.
              </p>
            </>
          }
          technique={
            <>
              <p>
                K-means minimise l&apos;<strong>inertie intra-cluster</strong> : la somme des
                carrés des distances de chaque point au centre de son groupe. L&apos;algorithme
                de Lloyd alterne deux étapes, chacune optimale à l&apos;autre fixée. C&apos;est
                une descente de coordonnées.
              </p>
              <p>
                <strong>Convergence garantie, optimalité non.</strong> Chaque étape fait baisser
                l&apos;inertie et le nombre d&apos;affectations possibles est fini, donc ça
                s&apos;arrête. Mais le problème global est NP-difficile : ce qu&apos;on atteint
                est un minimum local, qui dépend de l&apos;initialisation. D&apos;où l&apos;usage
                de lancer plusieurs fois et de garder la meilleure inertie.
              </p>
              <p>
                <strong>k-means++</strong> — utilisé ici — choisit les centres initiaux de
                proche en proche, chaque nouveau centre étant tiré avec une probabilité
                proportionnelle au carré de sa distance aux centres déjà placés. Ça les écarte,
                et ça réduit fortement le risque de mauvais minimum.
              </p>
              <p>
                <strong>Les alternatives, selon ce qui casse.</strong> Groupes non sphériques →
                DBSCAN ou clustering spectral. Groupes de formes elliptiques ou de tailles très
                différentes → mélanges de gaussiennes. Nombre de groupes inconnu → DBSCAN ou
                clustering hiérarchique, qui ne le demandent pas.
              </p>
            </>
          }
          maths={
            <>
              <p>L&apos;objectif :</p>
              <LiveFormula
                tex={String.raw`J = \sum_{i=1}^{n} \bigl\lVert x_i - \mu_{c(i)} \bigr\rVert_2^2
                  \qquad c(i) = \arg\min_{j} \lVert x_i - \mu_j \rVert_2^2`}
              />
              <p>Les deux étapes, chacune minimisant <Tex>J</Tex> à l&apos;autre fixée :</p>
              <LiveFormula
                tex={String.raw`\textbf{affectation} \quad c(i) \leftarrow \arg\min_j \lVert x_i - \mu_j \rVert^2
                  \qquad\qquad
                  \textbf{mise à jour} \quad \mu_j \leftarrow \frac{1}{|C_j|}\sum_{i \in C_j} x_i`}
              />
              <p>
                La seconde étape est exactement la moyenne parce que la moyenne est{" "}
                <em>le</em> minimiseur de la somme des carrés :{" "}
                <Tex>{String.raw`\arg\min_\mu \sum_i \lVert x_i - \mu \rVert^2 = \bar{x}`}</Tex>.
                Le choix de la distance euclidienne n&apos;est donc pas arbitraire — c&apos;est
                lui qui rend la mise à jour aussi simple.
              </p>
              <p>
                <strong>Pourquoi les frontières sont droites.</strong> L&apos;affectation au
                centre le plus proche découpe le plan en cellules de Voronoï, dont les
                séparations sont les médiatrices entre centres. C&apos;est exactement la
                géométrie de <a href="/classification/nearest-centroid/">Nearest Centroid</a> —
                à ceci près que les centres sont découverts au lieu d&apos;être calculés à partir
                d&apos;étiquettes.
              </p>
              <p>
                <strong>Le score de silhouette</strong>, plus fiable que le coude pour choisir{" "}
                <Tex>K</Tex> :
              </p>
              <LiveFormula
                tex={String.raw`s(i) = \frac{b(i) - a(i)}{\max\bigl(a(i),\, b(i)\bigr)} \in [-1, 1]`}
              />
              <p>
                <Tex>a(i)</Tex> est la distance moyenne aux points du même groupe,{" "}
                <Tex>b(i)</Tex> celle au groupe voisin le plus proche. Proche de 1 : bien
                classé. Négatif : le point serait mieux ailleurs.
              </p>
            </>
          }
        />

        <div className="space-y-4">
          <Callout kind="insight" title="L'expérience sur l'initialisation">
            Dataset <strong>« Clusters gaussiens »</strong> avec <Tex>K = 4</Tex>. Cliquez
            plusieurs fois sur <strong>Autre initialisation</strong> et relancez.
            <br />
            <br />
            La plupart du temps, K-means retrouve les vrais groupes. Parfois, il coupe un
            cluster en deux et en fusionne deux autres — avec une inertie finale plus élevée.
            C&apos;est un minimum local, et c&apos;est pour ça qu&apos;on relance.
          </Callout>

          <Panel title="Où ça sert" subtitle="Le non-supervisé en pratique">
            <div className="prose-lab">
              <p>
                <strong>Segmentation client.</strong> Regrouper des clients par comportement
                d&apos;achat, sans catégories définies à l&apos;avance. Les groupes trouvés sont
                ensuite interprétés — et cette interprétation est humaine, pas algorithmique.
              </p>
              <p>
                <strong>Compression et quantification.</strong> Réduire une image à{" "}
                <Tex>K</Tex> couleurs : chaque pixel est remplacé par le centre de son groupe.
              </p>
              <p>
                <strong>Comme prétraitement.</strong> Les distances aux <Tex>K</Tex> centres
                deviennent de nouvelles features pour un modèle supervisé.
              </p>
              <p>
                <strong>Détection d&apos;anomalies.</strong> Un point très éloigné de tous les
                centres est atypique.
              </p>
            </div>
          </Panel>

          <Callout kind="note" title="Un cluster n'est pas une classe">
            K-means trouve des groupes qui minimisent une distance. Rien ne garantit qu&apos;ils
            correspondent à quoi que ce soit de significatif. Activez « Montrer les vraies
            classes » sur un dataset difficile : les deux découpages peuvent n&apos;avoir aucun
            rapport. Nommer un cluster est toujours une décision humaine.
          </Callout>
        </div>
      </div>
    </PageShell>
  );
}
