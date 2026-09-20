"use client";

import * as React from "react";
import { PageShell, SectionTitle, Workbench } from "@/components/layout/PageShell";
import { Button, Callout, cx, Divider, Panel, Segmented, Slider, Stat } from "@/components/ui";
import { G } from "@/components/ui/Glossary";
import { Levels } from "@/components/ui/Levels";
import { Quiz } from "@/components/lab/Quiz";
import { LiveFormula, Tex } from "@/components/math/Math";
import { DataPlot } from "@/components/viz/DataPlot";
import { ClassLegend } from "@/components/viz/Legend";
import { LineChart } from "@/components/viz/LineChart";
import { NetworkDiagram, WeightLegend } from "@/components/viz/NetworkDiagram";
import { DatasetControls } from "@/components/lab/DatasetControls";
import { computeField } from "@/lib/ml/field";
import { splitDataset } from "@/lib/ml/datasets";
import { evaluate } from "@/lib/ml/metrics";
import type { ActivationName } from "@/lib/ml/models/activations";
import { formatNumber, formatPercent } from "@/lib/viz/geometry";
import { DIVERGING, rampAt, SERIES, STATUS } from "@/lib/viz/palette";
import { useLab } from "@/store/lab";
import { useNetwork } from "@/store/network";

const ARCHITECTURES: { value: string; label: string; hidden: number[] }[] = [
  { value: "0", label: "Aucune", hidden: [] },
  { value: "1", label: "4", hidden: [4] },
  { value: "2", label: "5-4", hidden: [5, 4] },
  { value: "3", label: "8-8-6", hidden: [8, 8, 6] },
];

const SPEEDS = [
  { value: "1", label: "×1", epochs: 1 },
  { value: "5", label: "×5", epochs: 5 },
  { value: "20", label: "×20", epochs: 20 },
];

export function TrainingLab() {
  const { dataset, trainRatio, setTrainRatio } = useLab();
  const {
    net,
    version,
    hidden,
    setHidden,
    activation,
    setActivation,
    learningRate,
    setLearningRate,
    l2,
    setL2,
    ensureOutputs,
    trainEpochs,
    reset,
  } = useNetwork();

  const [playing, setPlaying] = React.useState(false);
  const [speed, setSpeed] = React.useState("5");

  const nClasses = dataset.classNames.length;
  React.useEffect(() => ensureOutputs(nClasses), [nClasses, ensureOutputs]);

  const split = React.useMemo(
    () => splitDataset(dataset, trainRatio, 909),
    [dataset, trainRatio],
  );

  const ready = net.config.nOutputs === nClasses;
  const epochsPerTick = SPEEDS.find((s) => s.value === speed)!.epochs;

  React.useEffect(() => {
    if (!playing || !ready) return;
    const id = setInterval(() => {
      trainEpochs(split.train, split.test, epochsPerTick);
    }, 60);
    return () => clearInterval(id);
  }, [playing, ready, split, epochsPerTick, trainEpochs]);

  // Restart whenever the problem or the architecture changes: continuing to
  // train a network on data it was not built for would show a meaningless curve.
  const runKey = `${dataset.samples.length}|${dataset.name}|${hidden.join("-")}|${activation}|${trainRatio}`;
  const [lastKey, setLastKey] = React.useState(runKey);
  if (lastKey !== runKey) {
    setLastKey(runKey);
    setPlaying(false);
  }

  const { field, evalTrain, evalTest } = React.useMemo(() => {
    void version;
    if (!ready) return { field: null, evalTrain: null, evalTest: null };
    return {
      field: computeField(net, dataset.domain, 84),
      evalTrain: evaluate(net, split.train, dataset.classNames),
      evalTest: split.test.length ? evaluate(net, split.test, dataset.classNames) : null,
    };
  }, [net, ready, dataset.domain, dataset.classNames, split, version]);

  const history = net.history;
  const gap =
    evalTrain && evalTest ? evalTrain.accuracy - evalTest.accuracy : 0;

  return (
    <PageShell
      eyebrow="Réseaux de neurones"
      title="Entraînement"
      lede={
        <>
          Tout ce que les pages précédentes ont décrit séparément, en boucle et simultanément :
          les poids changent, la frontière se déforme, la loss descend. Regardez surtout{" "}
          <strong>l&apos;écart entre la courbe d&apos;entraînement et celle de test</strong> —
          c&apos;est là que se lit le surapprentissage.
        </>
      }
      wide
    >
      <Workbench
        plot={
          <div className="space-y-5">
            <div className="grid gap-5 lg:grid-cols-2">
              <Panel
                title="La frontière"
                subtitle={`Epoch ${net.epoch}`}
                bodyClassName="p-3"
                action={<ClassLegend classNames={dataset.classNames} />}
              >
                <DataPlot
                  dataset={dataset}
                  field={field}
                  aspect={1}
                  maxWidth={400}
                  styleFor={(s) =>
                    evalTest && evalTest.wrongIds.includes(s.id) ? { wrong: true } : undefined
                  }
                />
              </Panel>

              <Panel
                title="Le réseau"
                subtitle="Épaisseur = intensité du poids, couleur = signe"
                bodyClassName="p-3"
                action={<WeightLegend />}
              >
                {ready && (
                  <NetworkDiagram
                    net={net}
                    mode="weights"
                    classNames={dataset.classNames}
                    height={240}
                    showValues={false}
                  />
                )}
                <div className="mt-3 border-t border-line pt-3">
                  <p className="mb-2 text-[11px] font-medium text-ink-2">
                    Matrices de poids
                  </p>
                  <WeightHeatmaps net={net} version={version} />
                </div>
              </Panel>
            </div>

            <Panel title="Les courbes d'apprentissage" subtitle="Une échelle par grandeur — jamais deux axes dans un même cadre.">
              {history.length > 1 ? (
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <p className="mb-1.5 text-[11px] font-medium text-ink-2">
                      Loss (entropie croisée)
                    </p>
                    <LineChart
                      series={[
                        {
                          key: "trainLoss",
                          label: "entraînement",
                          color: SERIES[0],
                          points: history.map((h) => ({ x: h.epoch, y: h.trainLoss })),
                        },
                        {
                          key: "testLoss",
                          label: "test",
                          color: SERIES[1],
                          dashed: true,
                          points: history.map((h) => ({ x: h.epoch, y: h.testLoss })),
                        },
                      ]}
                      height={190}
                      xLabel="epoch"
                      yFormat={(v) => v.toFixed(2)}
                    />
                  </div>
                  <div>
                    <p className="mb-1.5 text-[11px] font-medium text-ink-2">Accuracy</p>
                    <LineChart
                      series={[
                        {
                          key: "trainAcc",
                          label: "entraînement",
                          color: SERIES[0],
                          points: history.map((h) => ({ x: h.epoch, y: h.trainAcc })),
                        },
                        {
                          key: "testAcc",
                          label: "test",
                          color: SERIES[1],
                          dashed: true,
                          points: history.map((h) => ({ x: h.epoch, y: h.testAcc })),
                        },
                      ]}
                      height={190}
                      xLabel="epoch"
                      yDomain={[0, 1.02]}
                      yFormat={(v) => `${Math.round(v * 100)} %`}
                    />
                  </div>
                </div>
              ) : (
                <p className="py-8 text-center text-[13px] text-ink-muted">
                  Lancez l&apos;entraînement pour voir les courbes apparaître.
                </p>
              )}
            </Panel>
          </div>
        }
        controls={
          <>
            <div className="flex gap-2">
              <Button
                variant="primary"
                className="flex-1"
                onClick={() => setPlaying((p) => !p)}
                disabled={!ready}
              >
                {playing ? "Pause" : net.epoch === 0 ? "Entraîner" : "Continuer"}
              </Button>
              <Button
                onClick={() => {
                  setPlaying(false);
                  trainEpochs(split.train, split.test, 1);
                }}
                disabled={!ready}
              >
                +1
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setPlaying(false);
                  reset();
                }}
              >
                ↺
              </Button>
            </div>
            <Segmented
              label="Vitesse"
              value={speed}
              options={SPEEDS.map((s) => ({ value: s.value, label: s.label }))}
              onChange={setSpeed}
              size="sm"
            />

            <Divider label="Architecture" />
            <Segmented
              label="Couches cachées"
              value={
                ARCHITECTURES.find((a) => a.hidden.join("-") === hidden.join("-"))?.value ?? "2"
              }
              options={ARCHITECTURES.map((a) => ({ value: a.value, label: a.label }))}
              onChange={(v) => {
                setPlaying(false);
                setHidden(ARCHITECTURES.find((a) => a.value === v)!.hidden);
              }}
              size="sm"
            />
            {hidden.length === 0 && (
              <p className="rounded-md border border-warning/30 bg-warning/[0.06] px-2.5 py-2 text-[11px] leading-snug text-ink-2">
                Sans couche cachée, le réseau est une régression logistique : sa frontière ne
                peut être qu&apos;une droite. Essayez-le sur « Deux lunes ».
              </p>
            )}
            <Segmented
              label="Activation"
              value={activation}
              options={[
                { value: "tanh", label: "Tanh" },
                { value: "relu", label: "ReLU" },
                { value: "sigmoid", label: "Sigmoid" },
              ]}
              onChange={(v) => {
                setPlaying(false);
                setActivation(v as ActivationName);
              }}
              size="sm"
            />

            <Divider label="Optimisation" />
            <Slider
              label={
                <>
                  <Tex>{String.raw`\alpha`}</Tex> — learning rate
                </>
              }
              value={learningRate}
              min={0.005}
              max={0.6}
              step={0.005}
              onChange={setLearningRate}
              format={(v) => v.toFixed(3)}
            />
            <Slider
              label={
                <>
                  <Tex>{String.raw`\lambda`}</Tex> — régularisation L2
                </>
              }
              value={l2}
              min={0}
              max={0.05}
              step={0.001}
              onChange={setL2}
              format={(v) => v.toFixed(3)}
              hint="Pénalise les gros poids. Augmentez-la si l'écart entraînement / test se creuse."
            />
            <Slider
              label="Part des données pour l'entraînement"
              value={trainRatio}
              min={0.3}
              max={0.9}
              step={0.05}
              onChange={setTrainRatio}
              format={(v) => `${Math.round(v * 100)} %`}
              hint={`${split.train.length} points d'entraînement, ${split.test.length} de test`}
            />

            <Divider label="Données" />
            <DatasetControls compact />
          </>
        }
        below={
          <>
            <div className="grid grid-cols-2 gap-2">
              <Stat
                label="Accuracy entraînement"
                value={evalTrain ? formatPercent(evalTrain.accuracy) : "—"}
              />
              <Stat
                label="Accuracy test"
                value={evalTest ? formatPercent(evalTest.accuracy) : "—"}
                tone={
                  evalTest
                    ? evalTest.accuracy > 0.9
                      ? "good"
                      : evalTest.accuracy > 0.7
                        ? "neutral"
                        : "warning"
                    : "neutral"
                }
              />
              <Stat
                label="Écart"
                value={formatPercent(gap, 1)}
                tone={gap > 0.12 ? "critical" : gap > 0.06 ? "warning" : "good"}
                hint="Entraînement moins test"
              />
              <Stat label="Paramètres" value={net.parameterCount} />
            </div>

            {gap > 0.12 && (
              <Callout kind="warning" title="Surapprentissage en cours">
                Le réseau réussit nettement mieux sur les points qu&apos;il a vus que sur les
                autres : il mémorise au lieu de généraliser. Trois remèdes, à essayer dans cet
                ordre : augmenter <Tex>{String.raw`\lambda`}</Tex>, réduire l&apos;architecture,
                ou ajouter des données. La page{" "}
                <a href="/concepts/overfitting/">Sur / sous-apprentissage</a> décortique ça.
              </Callout>
            )}

            <Panel title="La boucle d'entraînement" subtitle="Ce que fait chaque epoch">
              <ol className="space-y-1 text-[11px] leading-snug text-ink-2">
                {[
                  "Mélanger les points d'entraînement",
                  "Pour chaque point : forward pass",
                  "Calculer la loss",
                  "Backward pass : tous les gradients",
                  "Mettre à jour tous les poids",
                  "Mesurer loss et accuracy sur entraînement et test",
                ].map((line, i) => (
                  <li
                    key={line}
                    className="flex gap-2 rounded-md border border-line bg-surface-2/50 px-2 py-1.5"
                  >
                    <span className="tnum text-ink-muted">{i + 1}.</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ol>
              <LiveFormula
                className="mt-3"
                tex={String.raw`L = -\frac{1}{n}\sum_{i=1}^{n} \log \hat{y}_{i, c^{*}_i}
                  \;+\; \frac{\lambda}{2}\sum_{l}\lVert W^{(l)} \rVert_F^2`}
                terms={[
                  { symbol: String.raw`\lambda`, value: formatNumber(l2, 3) },
                  { symbol: "n", value: split.train.length },
                ]}
              />
            </Panel>
          </>
        }
      />

      <SectionTitle hint="La même idée, à trois profondeurs de lecture.">
        Comment lire ces courbes
      </SectionTitle>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <Levels
          intuition={
            <>
              <p>
                Deux courbes, deux questions différentes. La courbe{" "}
                <strong>entraînement</strong> dit « le réseau retient-il ce qu&apos;on lui
                montre ? ». La courbe <strong>test</strong> dit « a-t-il compris quelque chose
                d&apos;utile ? ».
              </p>
              <p>
                <strong>Les deux descendent ensemble</strong> : tout va bien, laissez tourner.
              </p>
              <p>
                <strong>L&apos;entraînement descend, le test remonte</strong> : le réseau
                apprend les détails de ses exemples, pas la règle générale. C&apos;est le
                surapprentissage, et le bon moment pour s&apos;arrêter est juste avant que ça
                commence.
              </p>
              <p>
                <strong>Aucune des deux ne descend</strong> : le modèle est trop simple, ou le
                learning rate est mal réglé. Mettez « Couches cachées : Aucune » sur « Deux
                lunes » pour voir ce cas.
              </p>
            </>
          }
          technique={
            <>
              <p>
                Une <strong>epoch</strong> est une passe complète sur les données
                d&apos;entraînement. Ce n&apos;est pas une unité de temps intrinsèque : une
                epoch sur 20 points et une epoch sur 20 000 points n&apos;ont rien à voir.
              </p>
              <p>
                <strong>Le jeu de test ne sert jamais à entraîner.</strong> C&apos;est toute sa
                valeur. Dès qu&apos;on choisit un hyperparamètre en regardant le score de test,
                celui-ci cesse d&apos;être une estimation honnête — d&apos;où l&apos;usage d&apos;un
                troisième jeu, de validation, dans un vrai protocole.
              </p>
              <p>
                <strong>L&apos;early stopping</strong> consiste simplement à garder les poids de
                l&apos;epoch où la loss de validation était minimale. C&apos;est la
                régularisation la moins chère qui existe : elle ne coûte qu&apos;une copie des
                poids.
              </p>
              <p>
                <strong>La régularisation L2</strong> ajoute{" "}
                <Tex>{String.raw`\lambda \lVert W \rVert^2`}</Tex> à la loss. Son effet sur le
                gradient est d&apos;ajouter <Tex>{String.raw`\lambda w`}</Tex> : chaque poids est
                tiré vers zéro à chaque pas, proportionnellement à sa taille. D&apos;où son
                autre nom, <em>weight decay</em>. Regardez les matrices de poids pâlir quand
                vous montez <Tex>{String.raw`\lambda`}</Tex>.
              </p>
            </>
          }
          maths={
            <>
              <p>La loss d&apos;entropie croisée sur un lot, avec pénalité L2 :</p>
              <LiveFormula
                tex={String.raw`L(\theta) = -\frac{1}{n}\sum_{i=1}^{n}\sum_{c} y_{i,c} \log \hat{y}_{i,c}
                  \;+\; \frac{\lambda}{2}\sum_{l}\lVert W^{(l)}\rVert_F^2`}
              />
              <p>
                <strong>Pourquoi l&apos;entropie croisée et pas l&apos;erreur quadratique ?</strong>{" "}
                Avec une MSE sur une sortie sigmoïde, le gradient contient un facteur{" "}
                <Tex>{String.raw`f'(z)`}</Tex> qui s&apos;annule quand le réseau est{" "}
                <em>confiant et faux</em> — exactement quand il aurait le plus besoin
                d&apos;apprendre. L&apos;entropie croisée élimine ce facteur.
              </p>
              <p>Le gradient de la pénalité :</p>
              <LiveFormula
                tex={String.raw`\frac{\partial}{\partial W}\left(\frac{\lambda}{2}\lVert W \rVert_F^2\right) = \lambda W
                  \qquad\Longrightarrow\qquad
                  W \leftarrow (1 - \alpha\lambda)\,W - \alpha \frac{\partial L_{\text{data}}}{\partial W}`}
              />
              <p>
                Le facteur <Tex>{String.raw`(1 - \alpha\lambda)`}</Tex> multiplie tous les poids
                à chaque pas : c&apos;est une décroissance exponentielle vers zéro, contrée
                uniquement par le gradient des données. Un poids que les données ne justifient
                pas finit par s&apos;éteindre.
              </p>
              <p>
                <strong>Le compromis biais-variance</strong>, qui explique la forme en U de la
                courbe de test :
              </p>
              <LiveFormula
                tex={String.raw`\mathbb{E}\bigl[(y - \hat{f}(x))^2\bigr]
                  = \underbrace{\bigl(\mathbb{E}[\hat{f}] - f\bigr)^2}_{\text{biais}^2}
                  + \underbrace{\mathrm{Var}(\hat{f})}_{\text{variance}}
                  + \underbrace{\sigma^2}_{\text{bruit}}`}
              />
              <p>
                Le troisième terme est irréductible : aucun modèle, aucune quantité de données
                ne peut le faire descendre. C&apos;est ce qui rend 100 % impossible sur le
                dataset « Classes qui se recouvrent ».
              </p>
            </>
          }
        />


        <Quiz
          questions={[
            {
              id: "tr1",
              question:
                "La loss d'entraînement baisse toujours, mais celle de test remonte depuis l'epoch 40. Que faire ?",
              options: [
                { id: "a", label: "Continuer : elle finira par redescendre" },
                {
                  id: "b",
                  label:
                    "S'arrêter autour de l'epoch 40 — ou régulariser. Après, le réseau apprend le bruit du jeu d'entraînement",
                },
                { id: "c", label: "Augmenter le learning rate" },
              ],
              answer: 1,
              explanation: (
                <>
                  Le point où les deux courbes se séparent est le meilleur modèle que cette
                  configuration produira : c&apos;est le principe de l&apos;<em>early stopping</em>.
                  Tout ce qui suit est du <G t="overfitting">surapprentissage</G>. Monter{" "}
                  <Tex>{String.raw`\lambda`}</Tex> ou réduire l&apos;architecture repousse ce
                  point ; insister, jamais.
                </>
              ),
            },
            {
              id: "tr2",
              question: "Que se passe-t-il si vous retirez toutes les couches cachées ?",
              options: [
                { id: "a", label: "Le réseau refuse de s'entraîner" },
                {
                  id: "b",
                  label:
                    "Il devient une régression logistique : sa frontière ne peut plus être qu'une droite",
                },
                { id: "c", label: "Il devient plus lent mais reste aussi puissant" },
              ],
              answer: 1,
              explanation: (
                <>
                  Entrées, poids, softmax : il ne reste que ça, ce qui est mot pour mot le modèle
                  de la page <a href="/regression/logistique/">régression logistique</a>.
                  Essayez-le sur « Deux lunes » : la loss se bloque et la frontière reste droite,
                  quel que soit le nombre d&apos;epochs.
                </>
              ),
            },
            {
              id: "tr3",
              question: "Une epoch, c'est quoi exactement ?",
              options: [
                { id: "a", label: "Une mise à jour des poids" },
                { id: "b", label: "Un passage complet sur toutes les données d'entraînement" },
                { id: "c", label: "Un test sur le jeu de validation" },
              ],
              answer: 1,
              explanation: (
                <>
                  Une <G t="epoch">epoch</G> contient autant de mises à jour qu&apos;il y a
                  d&apos;exemples (ou de lots). C&apos;est pour ça que doubler le nombre de points
                  double le temps d&apos;une epoch sans rien dire sur le nombre d&apos;epochs
                  nécessaires — les deux quantités sont indépendantes, et les confondre est une
                  source classique de comparaisons fausses.
                </>
              ),
            },
          ]}
        />

        <div className="space-y-4">
          <Callout kind="insight" title="Les quatre expériences">
            <ul className="mt-1.5 space-y-1.5">
              <li>
                <strong>« Deux lunes », aucune couche cachée.</strong> Une droite, ~85 %. Passez
                à 5-4 : la frontière se courbe, ~98 %.
              </li>
              <li>
                <strong>« Spirales », 8-8-6.</strong> Il faut beaucoup d&apos;epochs. Regardez
                la frontière s&apos;enrouler progressivement.
              </li>
              <li>
                <strong>Part d&apos;entraînement à 30 %, architecture 8-8-6.</strong> L&apos;écart
                se creuse : peu de données, beaucoup de paramètres.
              </li>
              <li>
                <strong>Learning rate à 0,6.</strong> La loss oscille au lieu de descendre.
              </li>
            </ul>
          </Callout>

          <Callout kind="note" title="Ce qui n'est pas simulé ici">
            Ce réseau fait de la descente de gradient stochastique pure, sans momentum, sans
            Adam, sans dropout, sans batch normalization, et avec un learning rate constant. Un
            entraînement réel utilise presque toujours plusieurs de ces techniques — elles
            accélèrent la convergence, mais ne changent pas la boucle de fond que vous voyez
            tourner.
          </Callout>
        </div>
      </div>
    </PageShell>
  );
}

/** Weight matrices as heatmaps — the fastest way to see regularisation work. */
function WeightHeatmaps({ net, version }: { net: { W: number[][][] }; version: number }) {
  const max = React.useMemo(() => {
    void version;
    return Math.max(1e-6, ...net.W.flatMap((l) => l.flatMap((r) => r.map(Math.abs))));
  }, [net, version]);

  return (
    <div className="flex flex-wrap gap-4">
      {net.W.map((layer, l) => (
        <div key={l}>
          <div className="mb-1 text-[10px] text-ink-muted">
            W<sup>({l + 1})</sup> · {layer.length}×{layer[0]?.length ?? 0}
          </div>
          <div
            className="grid gap-px"
            style={{ gridTemplateColumns: `repeat(${layer[0]?.length ?? 1}, 12px)` }}
          >
            {layer.flatMap((row, j) =>
              row.map((w, i) => (
                <span
                  key={`${j}-${i}`}
                  title={`w[${j}][${i}] = ${w.toFixed(4)}`}
                  className={cx("block h-3 w-3 rounded-[2px]")}
                  style={{
                    background: rampAt(
                      DIVERGING,
                      (Math.max(-1, Math.min(1, w / max)) + 1) / 2,
                    ),
                  }}
                />
              )),
            )}
          </div>
        </div>
      ))}
      <div className="text-[10px] text-ink-muted">
        <div className="mb-1">max |w|</div>
        <div className="tnum font-semibold text-ink-2">{max.toFixed(2)}</div>
        <div className="mt-2" style={{ color: STATUS.warning }}>
          {max > 8 ? "Poids très grands" : ""}
        </div>
      </div>
    </div>
  );
}
