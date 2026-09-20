"use client";

import * as React from "react";
import { PageShell, SectionTitle, Workbench } from "@/components/layout/PageShell";
import { Button, Callout, Divider, Panel, Segmented, Slider, Stat } from "@/components/ui";
import { G } from "@/components/ui/Glossary";
import { Levels } from "@/components/ui/Levels";
import { LiveFormula, Tex, TexBlock } from "@/components/math/Math";
import { Annotations } from "@/components/lab/Annotations";
import { Narrator } from "@/components/lab/Narrator";
import { Quiz } from "@/components/lab/Quiz";
import { LineChart } from "@/components/viz/LineChart";
import { DigitCanvas, DigitGrid } from "@/components/viz/DigitCanvas";
import {
  DigitConfusion,
  DigitGallery,
  HiddenActivations,
  formatProbability,
  ProbabilityBars,
  ReceptiveFields,
} from "@/components/viz/DigitNetwork";
import { DIGIT_PIXELS, digitAt, normaliseDrawing } from "@/lib/ml/digits";
import type { ActivationName } from "@/lib/ml/models/activations";
import { useDigits } from "@/lib/hooks/useDigits";
import { formatPercent } from "@/lib/viz/geometry";
import { SERIES, STATUS } from "@/lib/viz/palette";

const ARCHITECTURES = [
  { value: "0", label: "Aucune", hidden: [] as number[] },
  { value: "16", label: "16", hidden: [16] },
  { value: "32", label: "32", hidden: [32] },
  { value: "64", label: "64", hidden: [64] },
];

/** Forty held-out images, four of each digit — the gallery, fixed across runs. */
const GALLERY_PER_DIGIT = 4;

const DIGIT_LABELS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function DigitsLab() {
  const [arch, setArch] = React.useState("32");
  const [activation, setActivation] = React.useState<ActivationName>("relu");
  const [learningRate, setLearningRate] = React.useState(0.05);
  const [trainCount, setTrainCount] = React.useState(4000);

  const hidden = React.useMemo(
    () => ARCHITECTURES.find((a) => a.value === arch)!.hidden,
    [arch],
  );

  const config = React.useMemo(
    () => ({ hidden, activation, learningRate, trainCount, seed: 7 }),
    [hidden, activation, learningRate, trainCount],
  );

  const { data, status, state, runner } = useDigits(config);

  const [drawn, setDrawn] = React.useState<Float32Array | null>(null);
  const [source, setSource] = React.useState<"draw" | number>("draw");
  const [hoverNeuron, setHoverNeuron] = React.useState<number | null>(null);

  // The pad hands back raw ink; the network was trained on centred, size-
  // normalised images, so the drawing is put through the same treatment before
  // it is judged. Without this the demo fails for reasons that have nothing to
  // do with the model.
  const shown = React.useMemo(() => {
    if (!drawn) return null;
    return source === "draw" ? normaliseDrawing(drawn) : drawn;
  }, [drawn, source]);

  React.useEffect(() => {
    if (shown) runner.predict(shown);
    else runner.clearDrawing();
  }, [shown, runner]);

  const onDraw = React.useCallback((pixels: Float32Array) => {
    let ink = 0;
    for (let i = 0; i < pixels.length; i++) ink += pixels[i];
    setSource("draw");
    setDrawn(ink > 0.3 ? pixels : null);
  }, []);

  // A fixed, balanced sample of the held-out set: the gallery must not reshuffle
  // every render, or "this one is still wrong" would be impossible to follow.
  const gallery = React.useMemo(() => {
    if (!data) return [];
    const perDigit = new Map<number, number[]>();
    for (let i = 0; i < data.count; i += 5) {
      const d = data.labels[i];
      const bucket = perDigit.get(d) ?? [];
      if (bucket.length < GALLERY_PER_DIGIT) {
        bucket.push(i);
        perDigit.set(d, bucket);
      }
    }
    // Interleaved so each row of ten shows the ten digits, not four copies of one.
    const out: number[] = [];
    for (let k = 0; k < GALLERY_PER_DIGIT; k++) {
      for (let d = 0; d < 10; d++) {
        const idx = perDigit.get(d)?.[k];
        if (idx !== undefined) out.push(idx);
      }
    }
    return out;
  }, [data]);

  React.useEffect(() => {
    if (gallery.length) runner.setGallery(gallery);
  }, [gallery, runner]);

  const pickExample = React.useCallback(
    (index: number) => {
      if (!data) return;
      setSource(index);
      setDrawn(Float32Array.from(digitAt(data, index)));
    },
    [data],
  );

  /** With no hidden layer the weight images are the ten classes themselves. */
  const deep = hidden.length > 0;
  const training = state.phase === "training";
  const last = state.history.at(-1) ?? null;
  const best = state.probs ? state.probs.indexOf(Math.max(...state.probs)) : null;
  const confidence = state.probs && best !== null ? state.probs[best] : 0;
  const trueLabel = typeof source === "number" && data ? data.labels[source] : null;

  const galleryPredictions = React.useMemo(
    () => (state.gallery ? Array.from(state.gallery, (v) => (v < 0 ? null : v)) : undefined),
    [state.gallery],
  );

  // The learning curves only move once per epoch; keeping them out of the
  // drawing path means a stroke never re-renders a chart.
  const curves = React.useMemo(
    () => (
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <p className="mb-1.5 text-[11px] font-medium text-ink-2">
            Accuracy — part des images correctement reconnues
          </p>
          <LineChart
            series={[
              {
                key: "train",
                label: "entraînement",
                color: SERIES[0],
                points: state.history.map((h) => ({ x: h.epoch, y: h.trainAcc })),
              },
              {
                key: "test",
                label: "test (jamais vues)",
                color: SERIES[1],
                dashed: true,
                points: state.history.map((h) => ({ x: h.epoch, y: h.testAcc })),
              },
            ]}
            height={190}
            xLabel="epoch"
            yDomain={[0, 1.02]}
            yFormat={(v) => `${Math.round(v * 100)} %`}
          />
        </div>
        <div>
          <p className="mb-1.5 text-[11px] font-medium text-ink-2">Loss (entropie croisée)</p>
          <LineChart
            series={[
              {
                key: "loss",
                label: "entraînement",
                color: SERIES[2],
                points: state.history.map((h) => ({ x: h.epoch, y: h.loss })),
              },
            ]}
            height={190}
            xLabel="epoch"
            yFormat={(v) => v.toFixed(2)}
          />
        </div>
      </div>
    ),
    [state.history],
  );

  return (
    <PageShell
      eyebrow="Réseaux de neurones"
      title="Reconnaître des chiffres manuscrits"
      lede={
        <>
          Cinq mille chiffres écrits à la main, un réseau que vous entraînez vous-même, et une
          zone de dessin. Rien n&apos;est pré-calculé : à l&apos;ouverture de la page le réseau
          répond n&apos;importe quoi, et c&apos;est vous qui le rendez capable — puis vous
          regardez <strong>ce qu&apos;il a appris à regarder</strong>.
        </>
      }
      wide
    >
      {status === "error" && (
        <Callout kind="critical" title="Les images n'ont pas pu être chargées">
          Le fichier <code>data/digits16.bin</code> (630 Ko) n&apos;a pas répondu. Rechargez la
          page ; si le problème persiste, c&apos;est le serveur qui ne sert pas le fichier.
        </Callout>
      )}

      <Workbench
        plot={
          <div className="space-y-5">
            <Panel
              title="Dessinez un chiffre"
              subtitle="De 0 à 9, gros et bien au centre. Le réseau répond pendant que vous tracez."
              bodyClassName="p-4"
            >
              <div className="relative grid items-start gap-6 md:grid-cols-[auto_auto_minmax(0,1fr)]">
                <DigitCanvas onChange={onDraw} size={260} />

                <div className="flex flex-col items-center gap-1.5">
                  <p className="text-[11px] font-medium text-ink-2">Ce que le réseau reçoit</p>
                  <DigitGrid pixels={shown} size={150} />
                  <p className="max-w-[160px] text-center text-[10.5px] leading-snug text-ink-muted">
                    256 nombres entre 0 et 1 : un par case. Le dessin est recentré et remis à
                    l&apos;échelle, exactement comme les images d&apos;entraînement.
                  </p>
                </div>

                <div>
                  <div className="mb-3 flex items-baseline gap-3">
                    <span
                      className="tnum text-[54px] font-semibold leading-none"
                      style={{ color: best !== null ? STATUS.good : "var(--color-ink-muted)" }}
                    >
                      {best !== null ? best : "—"}
                    </span>
                    <span className="text-[12px] leading-snug text-ink-2">
                      {best === null ? (
                        "En attente d'un dessin"
                      ) : (
                        <>
                          sûr à <strong className="tnum">{formatProbability(confidence)}</strong>
                          {trueLabel !== null && (
                            <>
                              <br />
                              <span
                                style={{
                                  color: best === trueLabel ? STATUS.good : STATUS.critical,
                                }}
                              >
                                {best === trueLabel ? "✓ correct" : "✗ faux"} — c&apos;est un{" "}
                                {trueLabel}
                              </span>
                            </>
                          )}
                        </>
                      )}
                    </span>
                  </div>
                  <ProbabilityBars probs={state.probs} />
                  <p className="mt-2 text-[11px] leading-snug text-ink-muted">
                    Dix probabilités qui font toujours 100 % à elles toutes : c&apos;est le rôle
                    du <G t="softmax">softmax</G>. Le réseau ne dit jamais « c&apos;est un 3 », il
                    dit « 3 à 94 %, 8 à 4 % ».
                  </p>
                </div>

                <Annotations
                  storageKey="digits-draw"
                  items={[
                    { x: 2, y: 4, text: "Tracez ici" },
                    { x: 32, y: 4, text: "Ce que le réseau reçoit vraiment" },
                    { x: 98, y: 4, text: "Sa réponse, chiffre par chiffre", side: "left" },
                  ]}
                />
              </div>
            </Panel>

            <Panel
              title="De vraies écritures"
              subtitle="Quarante images du jeu de test. Cadre vert : le réseau a bon. Cadre rouge : il se trompe."
              bodyClassName="p-4"
            >
              {data ? (
                <>
                  <DigitGallery
                    pixels={data.pixels}
                    indices={gallery}
                    labels={data.labels}
                    predictions={galleryPredictions}
                    selected={typeof source === "number" ? source : null}
                    onSelect={pickExample}
                  />
                  <p className="mt-2.5 text-[11.5px] leading-snug text-ink-2">
                    Cliquez une image pour la soumettre au réseau. Ces quarante-là ne sont{" "}
                    <em>jamais</em> montrées pendant l&apos;entraînement : c&apos;est le seul
                    moyen honnête de savoir si le modèle a compris ou s&apos;il a simplement
                    retenu.
                  </p>
                </>
              ) : (
                <p className="py-6 text-center text-[13px] text-ink-muted">
                  Chargement des 5 000 images…
                </p>
              )}
            </Panel>

            <Panel
              title={
                deep ? "Ce que le réseau a appris à regarder" : "Les dix gabarits du réseau"
              }
              subtitle={
                deep
                  ? `Les ${state.hiddenCount} neurones cachés : à gauche ce qu'ils cherchent, à droite ce qu'ils voient dans votre dessin`
                  : "Sans couche cachée, chaque chiffre n'a qu'une image de poids — et c'est tout le modèle"
              }
              exportName={deep ? "reseau-poids-caches" : "reseau-gabarits"}
              bodyClassName="p-4"
            >
              <div
                className={
                  deep
                    ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,260px)]"
                    : "grid gap-6"
                }
              >
                  <div>
                    <p className="mb-2 text-[11px] font-medium text-ink-2">
                      {deep
                        ? "Les 256 poids d'entrée de chaque neurone, redessinés en image 16 × 16"
                        : "Les 256 poids de chaque neurone de sortie, redessinés en image 16 × 16"}
                    </p>
                    <ReceptiveFields
                      w1={state.w1}
                      columns={deep ? 8 : 10}
                      cellSize={deep ? 44 : 64}
                      active={hoverNeuron}
                      onHover={setHoverNeuron}
                      labels={deep ? undefined : DIGIT_LABELS}
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[10.5px] text-ink-muted">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="inline-block h-2.5 w-4 rounded-[2px]"
                          style={{ background: "#d03b3b" }}
                        />
                        poids positif : « de l&apos;encre ici me fait réagir »
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span
                          className="inline-block h-2.5 w-4 rounded-[2px]"
                          style={{ background: "#3987e5" }}
                        />
                        poids négatif : « de l&apos;encre ici m&apos;éteint »
                      </span>
                    </div>
                    <p className="mt-2.5 max-w-prose text-[11.5px] leading-snug text-ink-2">
                      {state.epoch === 0
                        ? "Pour l'instant c'est du bruit pur : les poids ont été tirés au hasard, et c'est exactement à quoi ressemble un réseau qui ne sait rien. Lancez l'entraînement et revenez ici."
                        : deep
                          ? "Ce ne sont pas des chiffres, et c'est normal : chaque neurone ne surveille qu'un bout de forme — un trait à cet endroit, un vide à cet autre. Des zones cohérentes se sont formées là où il n'y avait que du grain, et personne ne les a dessinées : elles sont apparues parce que c'était le moyen de faire baisser l'erreur."
                          : "Chaque image est le « portrait-robot » d'un chiffre : en rouge les cases où de l'encre plaide pour ce chiffre, en bleu celles qui plaident contre. Prédire, ici, c'est littéralement comparer votre tracé à ces dix images et garder la plus compatible. Le 0 et le 1 sont reconnaissables ; le 8 beaucoup moins — d'où ses erreurs."}
                    </p>
                  </div>

                  {deep && (
                    <div>
                      <p className="mb-2 text-[11px] font-medium text-ink-2">
                        Activation sur votre dessin
                      </p>
                      <HiddenActivations
                        values={state.hidden}
                        columns={8}
                        active={hoverNeuron}
                        onHover={setHoverNeuron}
                      />
                      <p className="mt-2.5 text-[11.5px] leading-snug text-ink-2">
                        Case claire = neurone qui s&apos;allume. Survolez une case :
                        l&apos;image correspondante s&apos;encadre à gauche. Un neurone
                        s&apos;allume quand votre tracé ressemble à ce qu&apos;il cherche — et
                        avec ReLU, beaucoup restent éteints : c&apos;est voulu.
                      </p>
                    </div>
                  )}
                </div>
              </Panel>

            <Panel
              title="L'apprentissage, epoch par epoch"
              subtitle={
                state.epoch === 0
                  ? "Aucune epoch pour l'instant — lancez l'entraînement"
                  : `${state.epoch} epoch${state.epoch > 1 ? "s" : ""} · ${Math.round(state.lastEpochMs)} ms la dernière`
              }
            >
              {state.history.length > 1 ? (
                <>
                  {curves}
                  <p className="mt-3 max-w-prose text-[11.5px] leading-snug text-ink-2">
                    La courbe de test tressaute d&apos;une epoch à l&apos;autre, parfois de deux
                    ou trois points : normal. Les poids sont corrigés après{" "}
                    <em>chaque</em> image, donc l&apos;état du réseau à la fin d&apos;une epoch
                    dépend un peu de la dernière image vue. Ce qui compte, c&apos;est la
                    tendance — pas le chiffre d&apos;une epoch isolée.
                  </p>
                </>
              ) : (
                <p className="py-8 text-center text-[13px] text-ink-muted">
                  Les courbes apparaissent dès la deuxième epoch.
                </p>
              )}
            </Panel>

            <div className="grid gap-5 lg:grid-cols-2">
              <Panel
                title="Quels chiffres résistent"
                subtitle="Taux de reconnaissance par chiffre, sur le jeu de test"
                bodyClassName="p-4"
              >
                {state.perClass.length ? (
                  <div className="space-y-1">
                    {state.perClass.map((r, d) => (
                      <div key={d} className="flex items-center gap-2">
                        <span className="tnum w-4 text-right text-[12px] text-ink-2">{d}</span>
                        <div className="h-[14px] flex-1 overflow-hidden rounded-[3px] bg-surface-2">
                          <div
                            className="h-full rounded-[3px]"
                            style={{
                              width: `${r * 100}%`,
                              background:
                                r > 0.9
                                  ? STATUS.good
                                  : r > 0.75
                                    ? STATUS.warning
                                    : STATUS.critical,
                            }}
                          />
                        </div>
                        <span className="tnum w-20 text-right text-[11px] text-ink-muted">
                          {formatPercent(r, 0)} / {state.perClassSeen[d] ?? 0}
                        </span>
                      </div>
                    ))}
                    <p className="pt-2 text-[11px] leading-snug text-ink-2">
                      Ce taux s&apos;appelle le <G t="rappel">rappel</G> : sur tous les vrais 5,
                      combien ont été reconnus. Le 1 est presque toujours le meilleur — il a peu
                      de variantes. Le 5, le 8 et le 9 se disputent la dernière place.
                    </p>
                  </div>
                ) : (
                  <p className="py-8 text-center text-[13px] text-ink-muted">
                    Entraînez le réseau pour voir ce classement.
                  </p>
                )}
              </Panel>

              <Panel
                title="Avec quoi il les confond"
                subtitle="Matrice de confusion sur les 1 000 images de test"
                bodyClassName="p-4"
              >
                {state.confusion ? (
                  <DigitConfusion confusion={state.confusion} size={300} />
                ) : (
                  <p className="py-8 text-center text-[13px] text-ink-muted">
                    Entraînez le réseau pour voir où partent les erreurs.
                  </p>
                )}
              </Panel>
            </div>
          </div>
        }
        controls={
          <>
            <div className="flex gap-2">
              <Button
                variant="primary"
                className="flex-1"
                onClick={() => (training ? runner.pause() : runner.play())}
                disabled={status !== "ready"}
              >
                {training ? "Pause" : state.epoch === 0 ? "Entraîner" : "Continuer"}
              </Button>
              <Button
                onClick={() => runner.step(1)}
                disabled={status !== "ready" || training}
                title="Une seule epoch"
              >
                +1
              </Button>
              <Button
                variant="ghost"
                onClick={() => runner.build(config)}
                disabled={status !== "ready"}
                title="Repartir de poids aléatoires"
              >
                ↺
              </Button>
            </div>
            <p className="text-[11px] leading-snug text-ink-muted">
              Une <G t="epoch">epoch</G> = le réseau voit une fois chacune des{" "}
              {state.trainCount || trainCount} images d&apos;entraînement et corrige ses poids
              après chacune. Comptez une dizaine d&apos;epochs pour un résultat correct.
            </p>

            <Divider label="Architecture" />
            <Segmented
              label="Neurones cachés"
              value={arch}
              options={ARCHITECTURES.map((a) => ({ value: a.value, label: a.label }))}
              onChange={setArch}
              size="sm"
            />
            {hidden.length === 0 ? (
              <p className="rounded-md border border-warning/30 bg-warning/[0.06] px-2.5 py-2 text-[11px] leading-snug text-ink-2">
                Sans couche cachée, chaque chiffre est jugé par une seule image de poids : le
                réseau compare votre tracé à dix « chiffres moyens ». Ça marche déjà à ~88 %,
                et ça plafonne là. Comparez avec 32 neurones.
              </p>
            ) : (
              <p className="text-[11px] leading-snug text-ink-muted">
                Mesuré sur cette page, en moyenne sur les epochs 21 à 30 : aucune couche 88,7 % ·
                16 neurones 88,5 % · 32 neurones 92,3 % · 64 neurones 93,9 %. Notez que 16 ne fait{" "}
                <em>pas</em> mieux que rien : une couche cachée trop étroite est un goulot
                d&apos;étranglement qui perd de l&apos;information sans rien apporter.
              </p>
            )}
            <Segmented
              label="Activation"
              value={activation}
              options={[
                { value: "relu", label: "ReLU" },
                { value: "tanh", label: "Tanh" },
                { value: "sigmoid", label: "Sigmoid" },
              ]}
              onChange={(v) => setActivation(v as ActivationName)}
              size="sm"
            />

            <Divider label="Apprentissage" />
            <Slider
              label={
                <>
                  <Tex>{String.raw`\alpha`}</Tex> — <G t="learningrate">learning rate</G>
                </>
              }
              value={learningRate}
              min={0.005}
              max={0.3}
              step={0.005}
              onChange={setLearningRate}
              format={(v) => v.toFixed(3)}
              hint="Trop grand, l'accuracy oscille sans monter. Trop petit, elle monte mais très lentement."
            />
            <Slider
              label="Images d'entraînement"
              value={trainCount}
              min={250}
              max={Math.max(250, state.available || 4000)}
              step={250}
              onChange={setTrainCount}
              format={(v) => `${v}`}
              hint={`${state.testCount || 1000} images gardées de côté pour le test, quoi qu'il arrive. Réduisez à 250 : c'est la démonstration la plus rapide de ce que « manquer de données » veut dire.`}
            />

            <Divider label="Ce que ça change" />
            <Narrator
              causes={[
                { key: "arch", label: "le nombre de neurones cachés", value: state.hiddenCount },
                { key: "lr", label: "le learning rate", value: learningRate },
                {
                  key: "n",
                  label: "la taille du jeu d'entraînement",
                  value: trainCount,
                },
              ]}
              effects={[
                {
                  key: "test",
                  label: "l'accuracy de test",
                  value: last?.testAcc ?? 0,
                  format: (v) => formatPercent(v),
                  better: "up",
                  epsilon: 0.005,
                },
              ]}
              placeholder="Changez un réglage, relancez l'entraînement : l'effet sera décrit ici."
            />
          </>
        }
        below={
          <>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Epochs" value={state.epoch} />
              <Stat
                label="Accuracy test"
                value={last ? formatPercent(last.testAcc) : "—"}
                tone={
                  !last
                    ? "neutral"
                    : last.testAcc > 0.9
                      ? "good"
                      : last.testAcc > 0.8
                        ? "warning"
                        : "critical"
                }
                hint="Sur 1 000 images jamais vues"
              />
              <Stat
                label="Accuracy entraînement"
                value={last ? formatPercent(last.trainAcc) : "—"}
                hint="Sur les images apprises"
              />
              <Stat
                label={<G t="parametre">Paramètres</G>}
                value={state.parameters.toLocaleString("fr-FR")}
                hint="Poids + biais à ajuster"
              />
            </div>

            {last && last.trainAcc - last.testAcc > 0.09 && (
              <Callout kind="warning" title="Il commence à apprendre par cœur">
                {formatPercent(last.trainAcc)} sur ce qu&apos;il a vu, seulement{" "}
                {formatPercent(last.testAcc)} sur le reste : l&apos;écart, c&apos;est du{" "}
                <G t="overfitting">surapprentissage</G>. Remontez le nombre d&apos;images
                d&apos;entraînement, ou réduisez la couche cachée.
              </Callout>
            )}

            {state.epoch === 0 && status === "ready" && (
              <Callout kind="insight" title="Commencez par une seule epoch">
                Appuyez sur <strong>+1</strong>, puis regardez les images de poids : après une
                seule passe elles ont déjà cessé d&apos;être du bruit. C&apos;est le moment le
                plus spectaculaire de la page, et il ne dure qu&apos;une epoch.
              </Callout>
            )}

            <Panel title="Un chiffre, c'est 256 nombres" subtitle="Le passage de l'image au vecteur">
              <p className="text-[12px] leading-relaxed text-ink-2">
                L&apos;image est aplatie ligne par ligne en une liste de 256 valeurs, de 0 (noir)
                à 1 (blanc). Le réseau ne sait pas que la case 17 est juste sous la case 1 : pour
                lui ce sont 256 <G t="feature">features</G> sans géométrie. Tout ce qu&apos;il
                sait du voisinage, il doit le redécouvrir dans ses poids — ce que les images
                ci-dessus montrent qu&apos;il fait.
              </p>
              <LiveFormula
                className="mt-3"
                tex={String.raw`x = (x_1, x_2, \dots, x_{256}) \;\longrightarrow\; \hat{y} = (\hat{y}_0, \dots, \hat{y}_9)`}
                terms={[
                  { symbol: "256", value: DIGIT_PIXELS },
                  { symbol: String.raw`\hat{y}`, value: best !== null ? best : "—" },
                ]}
              />
            </Panel>
          </>
        }
      />

      <SectionTitle hint="La même idée, à trois niveaux de détail.">
        Comment un réseau peut-il « voir » ?
      </SectionTitle>

      <Levels
        intuition={
          <>
            <p>
              Imaginez que vous deviez reconnaître un chiffre en ne regardant jamais le dessin en
              entier, mais en posant 32 questions du type : « y a-t-il un trait horizontal en
              haut ? », « une boucle fermée en bas ? ». Chaque question reçoit une réponse entre
              « pas du tout » et « énormément ». Les 32 réponses réunies suffisent presque
              toujours à trancher.
            </p>
            <p>
              C&apos;est exactement ce que fait la couche cachée. La différence, c&apos;est que
              personne n&apos;a écrit les questions : le réseau les a inventées en essayant de se
              tromper le moins possible. Les images de poids, plus haut, <em>sont</em> ces
              questions rendues visibles.
            </p>
            <p>
              La dernière couche, elle, ne regarde plus le dessin du tout. Elle regarde seulement
              les 32 réponses et décide : « ce profil de réponses, chez moi, ça veut dire 7 ».
            </p>
          </>
        }
        technique={
          <>
            <p>
              L&apos;architecture est <strong>256 → 32 → 10</strong>, entièrement connectée. Chaque
              neurone caché calcule une somme pondérée des 256 pixels, ajoute son{" "}
              <G t="biaisneurone">biais</G>, et passe le tout dans une{" "}
              <G t="activation">fonction d&apos;activation</G>. Ses 256 poids forment une image :
              c&apos;est ce qu&apos;on appelle son champ réceptif, et c&apos;est ce qui est
              affiché plus haut.
            </p>
            <p>
              La couche de sortie a dix neurones, un par chiffre, et passe par un{" "}
              <G t="softmax">softmax</G> qui transforme dix scores quelconques en dix
              probabilités. L&apos;erreur mesurée est l&apos;<G t="loss">entropie croisée</G>, et
              les poids sont corrigés par <G t="backprop">backpropagation</G> après chaque image.
            </p>
            <p>
              Avec 32 neurones cachés, cela fait 256×32 + 32 poids pour la première couche et
              32×10 + 10 pour la seconde, soit {(256 * 32 + 32 + 32 * 10 + 10).toLocaleString("fr-FR")}{" "}
              nombres ajustés uniquement par l&apos;expérience. Aucun d&apos;eux n&apos;a été
              choisi par un humain.
            </p>
          </>
        }
        maths={
          <>
            <p>Pour une image aplatie en vecteur, deux couches suffisent à tout écrire :</p>
            <TexBlock>
              {String.raw`h = f\!\left(W^{(1)}x + b^{(1)}\right), \qquad
                s = W^{(2)}h + b^{(2)}, \qquad
                \hat{y}_c = \frac{e^{s_c}}{\sum_{k=0}^{9} e^{s_k}}`}
            </TexBlock>
            <p>
              avec <Tex>{String.raw`x \in \mathbb{R}^{256}`}</Tex>,{" "}
              <Tex>{String.raw`W^{(1)} \in \mathbb{R}^{32\times 256}`}</Tex> et{" "}
              <Tex>{String.raw`W^{(2)} \in \mathbb{R}^{10\times 32}`}</Tex>. La ligne{" "}
              <Tex>{String.raw`j`}</Tex> de <Tex>{String.raw`W^{(1)}`}</Tex>, repliée en 16×16,
              est l&apos;image affichée pour le neurone <Tex>{String.raw`j`}</Tex>.
            </p>
            <p>
              L&apos;erreur sur une image de classe <Tex>{String.raw`c^{*}`}</Tex> est
              l&apos;entropie croisée <Tex>{String.raw`L = -\log \hat{y}_{c^{*}}`}</Tex>, et le
              couplage softmax + entropie croisée donne le gradient de sortie le plus simple qui
              soit :
            </p>
            <TexBlock>
              {String.raw`\frac{\partial L}{\partial s_c} = \hat{y}_c - \mathbb{1}[c = c^{*}]`}
            </TexBlock>
            <p>
              Autrement dit : « la probabilité que tu as donnée, moins celle que tu aurais dû
              donner ». Tout le reste de la backpropagation n&apos;est que la règle de dérivation
              en chaîne appliquée à partir de là.
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
              "Vous entraînez avec 250 images seulement. L'accuracy d'entraînement monte à 100 % et celle de test plafonne à 78 %. Que se passe-t-il ?",
            options: [
              { id: "a", label: "Le learning rate est trop grand" },
              { id: "b", label: "Le réseau a mémorisé ses 250 images au lieu d'apprendre les formes" },
              { id: "c", label: "Il manque des neurones cachés" },
            ],
            answer: 1,
            explanation: (
              <>
                Réussite parfaite sur ce qu&apos;il a vu, échec sur le reste : c&apos;est la
                signature exacte du <G t="overfitting">surapprentissage</G>. Avec 250 exemples, il
                est plus simple pour le réseau de retenir 250 cas particuliers que de découvrir ce
                qui fait un 3. Remontez le curseur : l&apos;écart se referme.
              </>
            ),
          },
          {
            id: "q2",
            question:
              "Sans couche cachée, le réseau atteint ~88 %. Avec 32 neurones cachés, ~93 %. Qu'apportent ces 32 neurones ?",
            options: [
              { id: "a", label: "Ils comparent le dessin à dix chiffres moyens, en plus précis" },
              {
                id: "b",
                label: "Ils permettent de détecter des morceaux de forme, puis de les combiner",
              },
              { id: "c", label: "Ils rendent l'entraînement plus rapide" },
            ],
            answer: 1,
            explanation: (
              <>
                Sans couche cachée, chaque chiffre ne dispose que d&apos;une seule image de poids :
                le modèle ne peut faire qu&apos;une comparaison à un gabarit moyen, ce qui échoue
                dès qu&apos;un 7 est barré ou penché. La couche cachée introduit une étape
                intermédiaire — détecter des traits, des boucles — que la sortie recombine. Et
                l&apos;entraînement devient plus <em>lent</em>, pas plus rapide.
              </>
            ),
          },
          {
            id: "q3",
            question:
              "Vous dessinez un 4 tout petit dans un coin. La page le recentre et l'agrandit avant de le montrer au réseau. Pourquoi ?",
            options: [
              { id: "a", label: "Pour que ce soit plus joli à l'écran" },
              {
                id: "b",
                label: "Parce que le réseau n'a vu que des chiffres centrés, et ne sait rien du reste",
              },
              { id: "c", label: "Pour réduire la quantité de calcul" },
            ],
            answer: 1,
            explanation: (
              <>
                Le réseau n&apos;a aucune notion de position : le pixel du coin haut-gauche est la
                feature n° 1, point. Il n&apos;a jamais vu de chiffre là-bas, donc il n&apos;a
                aucune raison d&apos;y reconnaître quoi que ce soit. Recentrer, c&apos;est poser
                au modèle la question sur laquelle il a été entraîné — un traitement des données
                qui, en pratique, vaut souvent plus que dix neurones de plus.
              </>
            ),
          },
        ]}
      />
    </PageShell>
  );
}
