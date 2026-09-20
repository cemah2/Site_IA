"use client";

import * as React from "react";
import { PageShell, SectionTitle, Workbench } from "@/components/layout/PageShell";
import { Button, Callout, Divider, Panel, Segmented, Slider, Stat, Toggle } from "@/components/ui";
import { G } from "@/components/ui/Glossary";
import { Levels } from "@/components/ui/Levels";
import { LiveFormula, Tex, TexBlock } from "@/components/math/Math";
import { Annotations } from "@/components/lab/Annotations";
import { DatasetControls } from "@/components/lab/DatasetControls";
import { Narrator } from "@/components/lab/Narrator";
import { Quiz } from "@/components/lab/Quiz";
import { DataPlot, EditHints } from "@/components/viz/DataPlot";
import { ClassLegend } from "@/components/viz/Legend";
import { LineChart } from "@/components/viz/LineChart";
import { LogLossCurve, SigmoidCurve } from "@/components/viz/SigmoidCurve";
import type { PlotFrame } from "@/components/viz/Plot";
import { computeField } from "@/lib/ml/field";
import {
  leastSquaresBoundary,
  LogisticRegression,
  sigmoid,
} from "@/lib/ml/models/logistic";
import { splitDataset } from "@/lib/ml/datasets";
import { evaluate } from "@/lib/ml/metrics";
import type { Sample } from "@/lib/ml/types";
import { formatNumber, formatPercent } from "@/lib/viz/geometry";
import { classColor, CHROME, SERIES, STATUS } from "@/lib/viz/palette";
import { useLab } from "@/store/lab";

/** Iso-probability levels drawn beside the boundary, as z = log(p/(1−p)). */
const ISO = [
  { p: 0.25, z: Math.log(0.25 / 0.75) },
  { p: 0.75, z: Math.log(0.75 / 0.25) },
];

export function LogisticLab() {
  const { dataset, trainRatio } = useLab();
  const [learningRate, setLearningRate] = React.useState(0.5);
  const [l2, setL2] = React.useState(0);
  const [manual, setManual] = React.useState(false);
  const [manualW, setManualW] = React.useState<[number, number]>([1, 1]);
  const [manualB, setManualB] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  const [hovered, setHovered] = React.useState<Sample | null>(null);
  const [showLeastSquares, setShowLeastSquares] = React.useState(false);
  const [version, setVersion] = React.useState(0);

  const binary = dataset.classNames.length === 2;
  const nClasses = dataset.classNames.length;
  const split = React.useMemo(
    () => splitDataset(dataset, trainRatio, 909),
    [dataset, trainRatio],
  );

  // Rebuilt only when the *shape* of the problem changes. Editing points swaps
  // the training set in (see `setTrain`) without discarding the descent: a drag
  // should show what this model says about the new data, not restart it.
  const model = React.useMemo(
    () => new LogisticRegression(split.train, nClasses, { learningRate, l2 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nClasses],
  );

  const runKey = `${nClasses}|${dataset.name}`;
  const [lastKey, setLastKey] = React.useState(runKey);
  if (lastKey !== runKey) {
    setLastKey(runKey);
    setPlaying(false);
  }

  const stepOnce = React.useCallback(
    (n = 1) => {
      for (let i = 0; i < n; i++) model.step();
      setVersion((v) => v + 1);
    },
    [model],
  );

  React.useEffect(() => {
    if (!playing || manual) return;
    const id = setInterval(() => stepOnce(2), 60);
    return () => clearInterval(id);
  }, [playing, manual, stepOnce]);

  // Everything the page draws is derived here, and the model is brought
  // up to date in the same pass. Doing it during render rather than in an
  // effect is what keeps the line, the sigmoid and the numbers from ever
  // disagreeing by one frame — which, on a page whose whole claim is "the
  // model you see is the model being measured", would be a lie.
  const { field, evalTrain, evalTest, leastSquares } = React.useMemo(() => {
    void version;
    model.setTrain(split.train);
    model.setOptions({ learningRate, l2 });
    if (manual && binary) model.setParams([[manualW[0], manualW[1]]], [manualB]);
    return {
      field: computeField(model, dataset.domain, 96),
      evalTrain: evaluate(model, split.train, dataset.classNames),
      evalTest: split.test.length ? evaluate(model, split.test, dataset.classNames) : null,
      leastSquares: binary ? leastSquaresBoundary(split.train) : null,
    };
  }, [
    model,
    dataset.domain,
    dataset.classNames,
    split,
    version,
    binary,
    manual,
    manualW,
    manualB,
    learningRate,
    l2,
  ]);

  const last = model.history.at(-1) ?? null;

  // Scores are recomputed whenever anything the model depends on changes; the
  // curve gets values, never a closure over a mutable object.
  const scored = React.useMemo(
    () => (binary ? split.train.map((sample) => ({ sample, z: model.score(sample.x) })) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [binary, split.train, model, version, manual, manualW, manualB, field],
  );

  const hoveredTrueP = hovered ? model.predictProba(hovered.x)[hovered.y] : null;

  const norm = binary ? Math.hypot(model.w[0][0], model.w[0][1]) : 0;

  /** Clip `w·x + b = level` to the plot frame, as an SVG path. */
  const lineAt = React.useCallback(
    (frame: PlotFrame, level: number): string | null => {
      if (!binary) return null;
      const [w1, w2] = model.w[0];
      const b = model.b[0] - level;
      const [x0, x1] = dataset.domain[0];
      const [y0, y1] = dataset.domain[1];
      const pts: [number, number][] = [];
      if (Math.abs(w2) > 1e-9) {
        for (const x of [x0, x1]) {
          const y = -(w1 * x + b) / w2;
          if (y >= y0 - 1e-9 && y <= y1 + 1e-9) pts.push([x, y]);
        }
      }
      if (Math.abs(w1) > 1e-9) {
        for (const y of [y0, y1]) {
          const x = -(w2 * y + b) / w1;
          if (x >= x0 - 1e-9 && x <= x1 + 1e-9) pts.push([x, y]);
        }
      }
      if (pts.length < 2) return null;
      const [a, c] = pts;
      const pa = frame.px(a[0], a[1]);
      const pc = frame.px(c[0], c[1]);
      return `M ${pa[0]} ${pa[1]} L ${pc[0]} ${pc[1]}`;
    },
    [binary, model, dataset.domain],
  );

  const lsLine = React.useCallback(
    (frame: PlotFrame): string | null => {
      if (!leastSquares) return null;
      const [w1, w2] = leastSquares.w;
      const b = leastSquares.b;
      const [x0, x1] = dataset.domain[0];
      const [y0, y1] = dataset.domain[1];
      const pts: [number, number][] = [];
      if (Math.abs(w2) > 1e-9) {
        for (const x of [x0, x1]) {
          const y = -(w1 * x + b) / w2;
          if (y >= y0 - 1e-9 && y <= y1 + 1e-9) pts.push([x, y]);
        }
      }
      if (Math.abs(w1) > 1e-9) {
        for (const y of [y0, y1]) {
          const x = -(w2 * y + b) / w1;
          if (x >= x0 - 1e-9 && x <= x1 + 1e-9) pts.push([x, y]);
        }
      }
      if (pts.length < 2) return null;
      const pa = frame.px(pts[0][0], pts[0][1]);
      const pc = frame.px(pts[1][0], pts[1][1]);
      return `M ${pa[0]} ${pa[1]} L ${pc[0]} ${pc[1]}`;
    },
    [leastSquares, dataset.domain],
  );

  const lsPrediction =
    hovered && leastSquares
      ? leastSquares.w[0] * hovered.x[0] + leastSquares.w[1] * hovered.x[1] + leastSquares.b + 0.5
      : null;

  return (
    <PageShell
      eyebrow="Régression"
      title="Régression logistique"
      lede={
        <>
          Le chaînon manquant entre la droite de régression et le neurone. Le modèle calcule un
          seul nombre — un score — puis l&apos;écrase entre 0 et 1 pour en faire une{" "}
          <strong>probabilité</strong>. C&apos;est le plus simple des modèles qui répond « 78 % »
          plutôt que « oui ».
        </>
      }
      wide
    >
      <Workbench
        plot={
          <div className="space-y-5">
            <div className="grid gap-5 xl:grid-cols-2">
              <Panel
                title="La frontière"
              exportName="logistique-frontiere"
                subtitle="Trait plein : probabilité 50 %. Traits pointillés : 25 % et 75 %."
                bodyClassName="p-3"
                action={<ClassLegend classNames={dataset.classNames} />}
              >
                <div className="relative">
                  <DataPlot
                    dataset={dataset}
                    onChange={useLab.getState().setDataset}
                    mode="edit"
                    field={field}
                    aspect={1}
                    maxWidth={440}
                    showBoundary={!binary}
                    styleFor={(s) =>
                      evalTrain.wrongIds.includes(s.id) || evalTest?.wrongIds.includes(s.id)
                        ? { wrong: true }
                        : undefined
                    }
                    extraTooltip={(s) => (
                      <span className="tnum">
                        score {formatNumber(model.score(s.x), 2)} · p ={" "}
                        {formatPercent(model.predictProba(s.x)[1] ?? 0)}
                      </span>
                    )}
                    overlay={(frame) =>
                      binary ? (
                        <g clipPath="url(#plot-clip)">
                          {ISO.map((iso) => {
                            const d = lineAt(frame, iso.z);
                            return d ? (
                              <path
                                key={iso.p}
                                d={d}
                                fill="none"
                                stroke={classColor(iso.p > 0.5 ? 1 : 0)}
                                strokeWidth={1.1}
                                strokeDasharray="5 4"
                                opacity={0.75}
                              />
                            ) : null;
                          })}
                          {(() => {
                            const d = lineAt(frame, 0);
                            return d ? (
                              <path d={d} fill="none" stroke={CHROME.ink} strokeWidth={1.8} />
                            ) : null;
                          })()}
                          {showLeastSquares &&
                            (() => {
                              const d = lsLine(frame);
                              return d ? (
                                <path
                                  d={d}
                                  fill="none"
                                  stroke={STATUS.warning}
                                  strokeWidth={1.6}
                                  strokeDasharray="2 4"
                                />
                              ) : null;
                            })()}
                        </g>
                      ) : null
                    }
                  />
                  <Annotations
                    storageKey="logistic-plot"
                    items={[
                      { x: 50, y: 6, text: "Déplacez un point : tout se recalcule" },
                    ]}
                  />
                </div>
                <EditHints />
                {binary && (
                  <p className="mt-2 border-t border-line pt-2.5 text-[11px] leading-snug text-ink-2">
                    L&apos;écart entre les deux pointillés est la{" "}
                    <strong>zone d&apos;hésitation</strong>. Elle se resserre quand les poids
                    grandissent : un modèle sûr de lui a de gros poids, et c&apos;est exactement
                    ce que la <G t="regularisation">régularisation</G> empêche.
                  </p>
                )}
              </Panel>

              <Panel
                title="Le même problème, vu par le modèle"
                subtitle="Les deux dimensions écrasées sur l'unique nombre dont il se sert"
                bodyClassName="p-3"
              >
                {binary ? (
                  <>
                    <SigmoidCurve
                      scored={scored}
                      selected={hovered}
                      onSelect={setHovered}
                      height={200}
                    />
                    <LiveFormula
                      className="mt-3"
                      tex={String.raw`z = w_1 x_1 + w_2 x_2 + b
                        \qquad p = \sigma(z) = \frac{1}{1 + e^{-z}}`}
                      terms={[
                        { symbol: "w_1", value: formatNumber(model.w[0][0], 2) },
                        { symbol: "w_2", value: formatNumber(model.w[0][1], 2) },
                        { symbol: "b", value: formatNumber(model.b[0], 2) },
                        {
                          symbol: "p",
                          value: hovered ? formatPercent(sigmoid(model.score(hovered.x))) : "—",
                        },
                      ]}
                    />
                  </>
                ) : (
                  <p className="py-10 text-center text-[13px] leading-relaxed text-ink-muted">
                    Avec {dataset.classNames.length} classes, le modèle n&apos;a plus un seul
                    score mais un par classe, et la sigmoïde est remplacée par le{" "}
                    <G t="softmax">softmax</G>. Passez à 2 classes pour retrouver la courbe.
                  </p>
                )}
              </Panel>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <Panel
                title="La descente"
                subtitle={`${model.epoch} pas de gradient`}
                bodyClassName="p-4"
              >
                {model.history.length > 2 ? (
                  <LineChart
                    series={[
                      {
                        key: "loss",
                        label: "log-loss (entraînement)",
                        color: SERIES[0],
                        points: model.history.map((h) => ({ x: h.epoch, y: h.loss })),
                      },
                    ]}
                    height={180}
                    xLabel="pas"
                    yFormat={(v) => v.toFixed(2)}
                  />
                ) : (
                  <p className="py-10 text-center text-[13px] text-ink-muted">
                    Lancez la descente pour voir le coût baisser.
                  </p>
                )}
                <p className="mt-2 text-[11px] leading-snug text-ink-2">
                  Contrairement à la régression linéaire, il n&apos;existe{" "}
                  <strong>aucune formule</strong> qui donne directement les meilleurs poids ici :
                  il faut descendre. C&apos;est la première fois sur ce site que
                  l&apos;apprentissage est obligatoirement itératif.
                </p>
              </Panel>

              <Panel
                title="Le coût d'un seul point"
                subtitle={
                  hovered
                    ? `Point survolé : le modèle donne ${formatPercent(hoveredTrueP ?? 0)} à sa vraie classe`
                    : "Survolez un point du nuage ou de la courbe"
                }
                bodyClassName="p-4"
              >
                <LogLossCurve probability={hoveredTrueP} height={160} />
                <p className="mt-2 text-[11px] leading-snug text-ink-2">
                  Le coût d&apos;un point est <Tex>{String.raw`-\log(p)`}</Tex> où{" "}
                  <Tex>p</Tex> est la probabilité donnée à la <em>bonne</em> réponse. À 50 % il
                  vaut 0,69 ; à 10 % il vaut 2,3 ; à 1 % il vaut 4,6. Se tromper en étant sûr de
                  soi coûte donc bien plus cher que d&apos;hésiter — et c&apos;est toute la
                  différence avec « compter les erreurs ».
                </p>
              </Panel>
            </div>

            {binary && (
              <Panel
                title="Pourquoi pas simplement une droite de régression ?"
                subtitle="La question que tout le monde se pose en arrivant ici"
                bodyClassName="p-4"
              >
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,260px)]">
                  <div className="space-y-2.5 text-[12px] leading-relaxed text-ink-2">
                    <p>
                      On pourrait coder les classes 0 et 1 et leur ajuster une droite par{" "}
                      <G t="regularisation">moindres carrés</G>, comme sur la page de régression
                      linéaire. Activez-la : la frontière obtenue est souvent proche.
                    </p>
                    <p>
                      Le problème n&apos;est pas la frontière, c&apos;est la{" "}
                      <strong>sortie</strong>. Une droite ne connaît pas de limites : elle
                      prédit 1,4 ou −0,3 sans sourciller, et « 140 % de chances » n&apos;a aucun
                      sens. La sigmoïde existe précisément pour rendre ce résultat impossible.
                    </p>
                    {hovered && lsPrediction !== null && (
                      <div className="rounded-lg border border-line bg-surface-2/60 p-3">
                        <p className="mb-1.5 text-[11px] font-medium text-ink-2">
                          Pour le point survolé
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-[10.5px] text-ink-muted">Droite (moindres carrés)</p>
                            <p
                              className="tnum text-[17px] font-semibold"
                              style={{
                                color:
                                  lsPrediction < 0 || lsPrediction > 1
                                    ? STATUS.critical
                                    : CHROME.ink,
                              }}
                            >
                              {formatNumber(lsPrediction, 2)}
                            </p>
                            {(lsPrediction < 0 || lsPrediction > 1) && (
                              <p className="text-[10.5px]" style={{ color: STATUS.critical }}>
                                hors de [0, 1] — illisible comme probabilité
                              </p>
                            )}
                          </div>
                          <div>
                            <p className="text-[10.5px] text-ink-muted">Régression logistique</p>
                            <p className="tnum text-[17px] font-semibold text-ink">
                              {formatPercent(sigmoid(model.score(hovered.x)))}
                            </p>
                            <p className="text-[10.5px] text-ink-muted">
                              toujours entre 0 % et 100 %
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <Toggle
                      label="Afficher la droite des moindres carrés"
                      checked={showLeastSquares}
                      onChange={setShowLeastSquares}
                      hint="En pointillés jaunes sur le nuage."
                    />
                    <p className="text-[11px] leading-snug text-ink-muted">
                      Astuce : ajoutez quelques points très à l&apos;écart, du bon côté de la
                      frontière. La droite des moindres carrés cherche à passer <em>près</em> de
                      leurs valeurs 0/1 et se laisse tirer ; la logistique, qui ne regarde que
                      des probabilités déjà saturées, les ignore presque.
                    </p>
                  </div>
                </div>
              </Panel>
            )}
          </div>
        }
        controls={
          <>
            <Segmented
              label="Qui règle les poids ?"
              value={manual ? "manual" : "auto"}
              options={[
                { value: "auto", label: "La descente" },
                { value: "manual", label: "Vous" },
              ]}
              onChange={(v) => {
                const next = v === "manual";
                setManual(next);
                setPlaying(false);
                if (next && binary) {
                  // Snapped to the slider's step, so the thumb sits where the
                  // number says it does.
                  const snap = (v: number) => Math.round(v * 10) / 10;
                  setManualW([snap(model.w[0][0]), snap(model.w[0][1])]);
                  setManualB(snap(model.b[0]));
                }
              }}
              size="sm"
            />

            {manual && binary ? (
              <>
                <Slider
                  label={
                    <>
                      <Tex>w_1</Tex> — poids de {dataset.featureNames[0]}
                    </>
                  }
                  value={manualW[0]}
                  min={-8}
                  max={8}
                  step={0.1}
                  onChange={(v) => setManualW([v, manualW[1]])}
                  format={(v) => v.toFixed(1)}
                />
                <Slider
                  label={
                    <>
                      <Tex>w_2</Tex> — poids de {dataset.featureNames[1]}
                    </>
                  }
                  value={manualW[1]}
                  min={-8}
                  max={8}
                  step={0.1}
                  onChange={(v) => setManualW([manualW[0], v])}
                  format={(v) => v.toFixed(1)}
                />
                <Slider
                  label={
                    <>
                      <Tex>b</Tex> — biais
                    </>
                  }
                  value={manualB}
                  min={-6}
                  max={6}
                  step={0.1}
                  onChange={setManualB}
                  format={(v) => v.toFixed(1)}
                  hint="Décale la frontière sans la faire tourner."
                />
                <p className="rounded-md border border-line bg-surface-2/50 px-2.5 py-2 text-[11px] leading-snug text-ink-2">
                  Essayez d&apos;atteindre à la main la log-loss que la descente obtient toute
                  seule. C&apos;est plus dur qu&apos;il n&apos;y paraît avec trois nombres — et
                  un réseau en ajuste des milliers.
                </p>
              </>
            ) : (
              <>
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    className="flex-1"
                    onClick={() => setPlaying((p) => !p)}
                  >
                    {playing ? "Pause" : model.epoch === 0 ? "Descendre" : "Continuer"}
                  </Button>
                  <Button
                    onClick={() => {
                      setPlaying(false);
                      stepOnce(1);
                    }}
                  >
                    +1
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setPlaying(false);
                      model.reset();
                      setVersion((v) => v + 1);
                    }}
                    title="Remettre tous les poids à zéro"
                  >
                    ↺
                  </Button>
                </div>
                <Slider
                  label={
                    <>
                      <Tex>{String.raw`\alpha`}</Tex> — <G t="learningrate">learning rate</G>
                    </>
                  }
                  value={learningRate}
                  min={0.01}
                  max={5}
                  step={0.01}
                  onChange={setLearningRate}
                  format={(v) => v.toFixed(2)}
                  hint="Ici la surface de coût est convexe : trop grand ralentit, mais ne fait jamais diverger définitivement."
                />
                <Slider
                  label={
                    <>
                      <Tex>{String.raw`\lambda`}</Tex> — <G t="regularisation">régularisation</G> L2
                    </>
                  }
                  value={l2}
                  min={0}
                  max={0.5}
                  step={0.01}
                  onChange={setL2}
                  format={(v) => v.toFixed(2)}
                  hint="Empêche les poids de grandir : la zone d'hésitation reste large, et le modèle reste prudent."
                />
              </>
            )}

            <Divider label="Données" />
            <DatasetControls compact />

            <Divider label="Ce que ça change" />
            <Narrator
              causes={[
                { key: "lr", label: "le learning rate", value: learningRate },
                { key: "l2", label: "la régularisation", value: l2 },
                { key: "steps", label: "le nombre de pas", value: model.epoch },
              ]}
              effects={[
                {
                  key: "loss",
                  label: "la log-loss",
                  value: last?.loss ?? 0,
                  format: (v) => formatNumber(v, 3),
                  better: "down",
                  epsilon: 0.002,
                },
                {
                  key: "acc",
                  label: "l'accuracy d'entraînement",
                  value: evalTrain.accuracy,
                  format: (v) => formatPercent(v),
                  better: "up",
                  epsilon: 0.005,
                },
              ]}
            />
          </>
        }
        below={
          <>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Log-loss" value={formatNumber(last?.loss ?? 0, 3)} hint="Ce qui est minimisé" />
              <Stat
                label="Accuracy test"
                value={evalTest ? formatPercent(evalTest.accuracy) : "—"}
                tone={
                  !evalTest
                    ? "neutral"
                    : evalTest.accuracy > 0.9
                      ? "good"
                      : evalTest.accuracy > 0.75
                        ? "warning"
                        : "critical"
                }
              />
              <Stat
                label={<Tex>{String.raw`\lVert w \rVert`}</Tex>}
                value={binary ? formatNumber(norm, 2) : "—"}
                hint="Grand = frontière tranchée"
              />
              <Stat label={<G t="parametre">Paramètres</G>} value={model.parameterCount} />
            </div>

            {binary && evalTrain.accuracy < 0.92 && model.epoch > 30 && (
              <Callout kind="insight" title="Une droite ne suffit pas ici">
                {formatPercent(evalTrain.accuracy)} sur l&apos;entraînement, et la descente a
                convergé : ce n&apos;est pas un problème d&apos;optimisation, c&apos;est la forme
                du modèle. Pour voir la régression logistique dans son élément, essayez un
                dataset séparable par une droite.
                <span className="mt-2 block">
                  <Button
                    size="sm"
                    onClick={() => useLab.getState().setKind("linear")}
                  >
                    Passer au dataset « Linéaire »
                  </Button>
                </span>
              </Callout>
            )}

            {binary && norm > 12 && (
              <Callout kind="warning" title="Le modèle devient catégorique">
                Les poids sont énormes : presque tous les points reçoivent 0 % ou 100 %, et la
                zone d&apos;hésitation a disparu. Sur des données parfaitement séparables, la
                descente pousse les poids vers l&apos;infini sans jamais s&apos;arrêter. Montez{" "}
                <Tex>{String.raw`\lambda`}</Tex> : c&apos;est exactement le problème que la
                régularisation a été inventée pour résoudre.
              </Callout>
            )}

            {!binary && (
              <Callout kind="note" title="Plus de deux classes">
                Le modèle passe automatiquement en régression <em>softmax</em> :{" "}
                {dataset.classNames.length} scores au lieu d&apos;un, normalisés pour faire 100 %
                à eux tous. C&apos;est mot pour mot la dernière couche du réseau qui lit les
                chiffres manuscrits.
              </Callout>
            )}

            <Panel title="Un neurone, littéralement" subtitle="Le lien avec le chapitre suivant">
              <p className="text-[12px] leading-relaxed text-ink-2">
                <Tex>{String.raw`z = w_1x_1 + w_2x_2 + b`}</Tex> puis{" "}
                <Tex>{String.raw`\sigma(z)`}</Tex> : c&apos;est la définition d&apos;un{" "}
                <G t="neurone">neurone</G> à fonction d&apos;activation sigmoïde. Une régression
                logistique <em>est</em> un réseau de neurones sans couche cachée. Tout ce que la
                suite ajoute, c&apos;est d&apos;empiler ces briques — et c&apos;est cet empilement
                qui permet des frontières autres qu&apos;une droite.
              </p>
            </Panel>
          </>
        }
      />

      <SectionTitle hint="La même idée, à trois niveaux de détail.">
        Transformer un score en probabilité
      </SectionTitle>

      <Levels
        intuition={
          <>
            <p>
              Imaginez un jury qui note un dossier. Chaque critère a un poids : l&apos;expérience
              compte double, la distance compte en négatif, et ainsi de suite. On additionne, on
              obtient un score — un nombre qui peut valoir −7 comme +12.
            </p>
            <p>
              Ce score ne peut pas être annoncé tel quel : « ce dossier vaut 4,2 » ne veut rien
              dire pour un candidat. Il faut le traduire en « 85 % de chances d&apos;être
              accepté ». La sigmoïde est ce traducteur : elle prend n&apos;importe quel nombre et
              rend une valeur entre 0 et 1, avec 0 qui devient 50 %.
            </p>
            <p>
              Toute la subtilité est dans la forme de la traduction. Un score de 3 ou de 30 donne
              à peu près la même réponse (« quasi certain ») : passé un certain point, être
              encore plus loin de la frontière ne change presque plus rien. C&apos;est exactement
              ce que fait un humain qui dit « de toute façon, c&apos;est plié ».
            </p>
          </>
        }
        technique={
          <>
            <p>
              Le modèle calcule un score linéaire <Tex>{String.raw`z = w \cdot x + b`}</Tex>,
              strictement le même objet que sur la page de régression linéaire, puis applique la{" "}
              <strong>fonction logistique</strong>{" "}
              <Tex>{String.raw`\sigma(z) = 1/(1 + e^{-z})`}</Tex>. La frontière de décision est la
              ligne <Tex>{String.raw`z = 0`}</Tex>, donc une droite : le modèle est linéaire, la
              non-linéarité ne sert qu&apos;à produire une probabilité.
            </p>
            <p>
              L&apos;entraînement minimise la <G t="loss">log-loss</G>, aussi appelée entropie
              croisée. Elle n&apos;a pas de solution analytique, d&apos;où la{" "}
              <G t="descente">descente de gradient</G>. Sa surface est convexe : il n&apos;y a
              qu&apos;un minimum, donc pas de « mauvais départ » possible — une propriété que les
              réseaux profonds perdent immédiatement.
            </p>
            <p>
              La norme de <Tex>w</Tex> contrôle la <em>netteté</em> : doubler tous les poids ne
              déplace pas la frontière d&apos;un millimètre mais rend toutes les probabilités plus
              extrêmes. Sur des données séparables, rien n&apos;arrête cette croissance — d&apos;où
              la régularisation.
            </p>
          </>
        }
        maths={
          <>
            <p>Pour deux classes, avec <Tex>{String.raw`y \in \{0, 1\}`}</Tex> :</p>
            <TexBlock>
              {String.raw`p(y = 1 \mid x) = \sigma(w \cdot x + b), \qquad
                \sigma(z) = \frac{1}{1 + e^{-z}}`}
            </TexBlock>
            <p>
              L&apos;estimation par maximum de vraisemblance revient à minimiser la log-loss
              moyenne :
            </p>
            <TexBlock>
              {String.raw`L(w, b) = -\frac{1}{n}\sum_{i=1}^{n}
                \Big[y_i \log p_i + (1 - y_i)\log(1 - p_i)\Big]
                + \frac{\lambda}{2}\lVert w \rVert^2`}
            </TexBlock>
            <p>
              Le gradient prend une forme remarquablement simple, parce que la dérivée de la
              sigmoïde <Tex>{String.raw`\sigma' = \sigma(1-\sigma)`}</Tex> s&apos;annule contre le
              dénominateur de la log-loss :
            </p>
            <TexBlock>
              {String.raw`\frac{\partial L}{\partial w} = \frac{1}{n}\sum_{i=1}^{n}(p_i - y_i)\,x_i + \lambda w`}
            </TexBlock>
            <p>
              « Erreur × entrée » : c&apos;est la règle de mise à jour d&apos;un neurone, et c&apos;est
              la même expression que celle obtenue à la fin de la page{" "}
              <a href="/reseaux/backpropagation/">backpropagation</a>. Pour{" "}
              <Tex>k</Tex> classes, <Tex>{String.raw`\sigma`}</Tex> devient le softmax et la
              formule du gradient ne change pas d&apos;une lettre.
            </p>
          </>
        }
      />

      <SectionTitle hint="Trois questions auxquelles la page ci-dessus répond.">
        Vérifiez que c&apos;est passé
      </SectionTitle>

      <Quiz
        questions={[
          {
            id: "q1",
            question:
              "Vous multipliez w₁, w₂ et b par 3 avec les curseurs. Qu'arrive-t-il à la frontière et aux probabilités ?",
            options: [
              { id: "a", label: "La frontière tourne, les probabilités ne bougent pas" },
              {
                id: "b",
                label: "La frontière ne bouge pas, les probabilités deviennent plus extrêmes",
              },
              { id: "c", label: "Les deux changent" },
            ],
            answer: 1,
            explanation: (
              <>
                La frontière est l&apos;ensemble des points où <Tex>z = 0</Tex> ; multiplier toute
                l&apos;équation par 3 ne change pas où elle s&apos;annule. En revanche un point
                qui avait <Tex>z = 1</Tex> (73 %) passe à <Tex>z = 3</Tex> (95 %). Essayez : la
                zone d&apos;hésitation entre les deux pointillés se resserre sans que le trait
                plein bouge.
              </>
            ),
          },
          {
            id: "q2",
            question:
              "Pourquoi entraîner sur la log-loss plutôt que sur le simple nombre d'erreurs ?",
            options: [
              { id: "a", label: "La log-loss est plus rapide à calculer" },
              {
                id: "b",
                label:
                  "Le nombre d'erreurs ne bouge pas quand on déplace légèrement la frontière : il n'indique aucune direction",
              },
              { id: "c", label: "La log-loss donne toujours une meilleure accuracy" },
            ],
            answer: 1,
            explanation: (
              <>
                Le nombre d&apos;erreurs est un escalier : il reste constant puis saute d&apos;un
                cran. Une pente nulle ne dit pas dans quel sens avancer, donc la descente de
                gradient n&apos;a rien à descendre. La log-loss, elle, bouge un peu pour tout
                déplacement — et punit d&apos;autant plus fort qu&apos;on se trompe avec
                assurance. Ce n&apos;est pas une histoire de vitesse ni d&apos;accuracy finale,
                mais d&apos;existence d&apos;une pente.
              </>
            ),
          },
          {
            id: "q3",
            question:
              "Sur « Deux lunes », la régression logistique plafonne vers 85 % quoi que vous fassiez. Pourquoi ?",
            options: [
              { id: "a", label: "Il faut plus de pas de descente" },
              { id: "b", label: "Sa frontière est forcément une droite, et deux lunes ne se séparent pas par une droite" },
              { id: "c", label: "Le learning rate est mal réglé" },
            ],
            answer: 1,
            explanation: (
              <>
                Aucun réglage n&apos;y changera rien : le modèle ne dispose que de trois nombres,
                qui décrivent une droite. C&apos;est du <G t="underfitting">sous-apprentissage</G>{" "}
                par construction. Le remède n&apos;est pas d&apos;optimiser mieux mais de changer
                de modèle — ajouter une couche cachée, ou passer par un{" "}
                <G t="kernel">kernel</G>.
              </>
            ),
          },
        ]}
      />
    </PageShell>
  );
}
