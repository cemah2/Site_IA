"use client";

import * as React from "react";
import { PageShell } from "@/components/layout/PageShell";
import { Button, Callout, cx, Panel, Segmented, Slider, Stat } from "@/components/ui";
import { ClientOnly } from "@/components/ui/ClientOnly";
import { Tex } from "@/components/math/Math";
import { DataPlot } from "@/components/viz/DataPlot";
import { ClassLegend } from "@/components/viz/Legend";
import { computeField } from "@/lib/ml/field";
import { generateDataset, splitDataset, type DatasetId } from "@/lib/ml/datasets";
import { evaluate } from "@/lib/ml/metrics";
import { DEFAULT_PARAMS, fitModel, type AlgoId, type AlgoParams } from "@/lib/ml/registry";
import type { ActivationName } from "@/lib/ml/models/activations";
import { formatPercent } from "@/lib/viz/geometry";
import { STATUS } from "@/lib/viz/palette";

interface Control {
  key: string;
  label: React.ReactNode;
  kind: "slider" | "choice";
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
  format?: (v: number) => string;
}

interface Challenge {
  id: string;
  title: string;
  brief: React.ReactNode;
  dataset: { kind: DatasetId; n: number; noise: number; seed: number; nClasses: number };
  algo: AlgoId;
  controls: Control[];
  initial: Record<string, number | string>;
  /** Turn the control values into model hyper-parameters. */
  toParams: (v: Record<string, number | string>) => Partial<AlgoParams>;
  /** The bar to clear, checked live. */
  goal: (r: { testAcc: number; trainAcc: number; params: number }) => boolean;
  goalLabel: string;
  hint: React.ReactNode;
  lesson: React.ReactNode;
}

const CHALLENGES: Challenge[] = [
  {
    id: "k",
    title: "Trouvez le bon K",
    brief: (
      <>
        Ces données sont bruitées. Un <Tex>K</Tex> trop petit suit le bruit, un{" "}
        <Tex>K</Tex> trop grand efface la structure. Trouvez la valeur qui atteint{" "}
        <strong>au moins 90 % sur le jeu de test</strong>.
      </>
    ),
    dataset: { kind: "moons", n: 200, noise: 0.4, seed: 17, nClasses: 2 },
    algo: "knn",
    controls: [{ key: "k", label: <Tex>K</Tex>, kind: "slider", min: 1, max: 60 }],
    initial: { k: 1 },
    toParams: (v) => ({ k: Number(v.k) }),
    goal: (r) => r.testAcc >= 0.9,
    goalLabel: "Accuracy de test ≥ 90 %",
    hint: (
      <>
        Avec <Tex>K = 1</Tex> l&apos;accuracy d&apos;entraînement est de 100 % et celle de test
        bien plus basse : c&apos;est la signature du surapprentissage. Montez progressivement et
        regardez quand l&apos;écart se referme.
      </>
    ),
    lesson: (
      <>
        Le meilleur <Tex>K</Tex> n&apos;est jamais 1, et il dépend du bruit. Multipliez le
        bruit par deux et le <Tex>K</Tex> optimal monte aussi.
      </>
    ),
  },
  {
    id: "spirals",
    title: "Résolvez les spirales",
    brief: (
      <>
        Trois spirales imbriquées. Trouvez des réglages qui dépassent{" "}
        <strong>88 % sur le jeu de test</strong>. Deux pièges vous attendent : un réseau trop
        petit n&apos;y arrivera jamais, et un learning rate trop grand non plus — même avec un
        grand réseau et beaucoup d&apos;epochs.
      </>
    ),
    dataset: { kind: "spirals", n: 300, noise: 0.06, seed: 9, nClasses: 3 },
    algo: "mlp",
    controls: [
      {
        key: "arch",
        label: "Couches cachées",
        kind: "choice",
        options: [
          { value: "4", label: "4" },
          { value: "16", label: "16" },
          { value: "20-16", label: "20-16" },
          { value: "24-16-12", label: "24-16-12" },
        ],
      },
      {
        key: "lr",
        label: <Tex>{String.raw`\alpha`}</Tex>,
        kind: "choice",
        options: [
          { value: "0.05", label: "0,05" },
          { value: "0.15", label: "0,15" },
          { value: "0.3", label: "0,3" },
        ],
      },
      { key: "epochs", label: "Epochs", kind: "slider", min: 100, max: 900, step: 100 },
    ],
    initial: { arch: "4", lr: "0.3", epochs: 100 },
    toParams: (v) => ({
      hidden: String(v.arch).split("-").map(Number),
      activation: "tanh" as ActivationName,
      epochs: Number(v.epochs),
      learningRate: Number(v.lr),
    }),
    goal: (r) => r.testAcc >= 0.88,
    goalLabel: "Accuracy de test ≥ 88 %",
    hint: (
      <>
        Commencez par augmenter les epochs avec la petite architecture : vous verrez
        qu&apos;elle plafonne. Ça, c&apos;est du <strong>biais</strong> — il faut plus de capacité.
        Ensuite, avec un grand réseau, essayez les trois learning rates : le plus grand donne
        le <em>pire</em> résultat.
      </>
    ),
    lesson: (
      <>
        Deux conditions indépendantes. Assez de neurones pour <em>représenter</em> une frontière
        aussi courbée, et un pas assez petit pour que la descente de gradient la{" "}
        <em>trouve</em> au lieu d&apos;osciller autour. Un réseau surdimensionné avec{" "}
        <Tex>{String.raw`\alpha = 0{,}3`}</Tex> reste bloqué très bas.
      </>
    ),
  },
  {
    id: "kernel",
    title: "Rendez ce problème séparable",
    brief: (
      <>
        Deux cercles concentriques. Un SVM linéaire plafonne autour de 50 % — le hasard. Trouvez
        les réglages qui atteignent <strong>98 % sur le jeu de test</strong>.
      </>
    ),
    dataset: { kind: "circles", n: 200, noise: 0.12, seed: 4, nClasses: 2 },
    algo: "svm",
    controls: [
      {
        key: "kernel",
        label: "Kernel",
        kind: "choice",
        options: [
          { value: "linear", label: "Linéaire" },
          { value: "rbf", label: "RBF" },
          { value: "poly", label: "Polynomial" },
        ],
      },
      { key: "gamma", label: <Tex>{String.raw`\gamma`}</Tex>, kind: "slider", min: 0.1, max: 6, step: 0.1, format: (v) => v.toFixed(1) },
      { key: "logC", label: <Tex>C</Tex>, kind: "slider", min: -2, max: 2, step: 0.5, format: (v) => String(10 ** v) },
    ],
    initial: { kernel: "linear", gamma: 1, logC: 0 },
    toParams: (v) => ({
      kernel: v.kernel as AlgoParams["kernel"],
      gamma: Number(v.gamma),
      C: Number((10 ** Number(v.logC)).toPrecision(2)),
    }),
    goal: (r) => r.testAcc >= 0.98,
    goalLabel: "Accuracy de test ≥ 98 %",
    hint: (
      <>
        Aucune droite ne sépare un intérieur d&apos;un extérieur. Il faut changer d&apos;espace —
        c&apos;est exactement ce que fait le <a href="/classification/svm/">kernel trick</a>.
      </>
    ),
    lesson: (
      <>
        Le noyau RBF résout ce problème sans réglage fin. Le noyau polynomial y arrive aussi,
        parce que la frontière est un cercle et qu&apos;un cercle est un polynôme de degré 2 en{" "}
        <Tex>x_1</Tex> et <Tex>x_2</Tex>.
      </>
    ),
  },
  {
    id: "overfit",
    title: "Un arbre qui ne triche pas",
    brief: (
      <>
        Un arbre profond atteint 100 % sur ses données d&apos;entraînement, et c&apos;est
        précisément le problème. Trouvez des réglages qui dépassent{" "}
        <strong>86 % en test</strong> avec un <strong>écart entraînement / test inférieur à
        8 points</strong>.
      </>
    ),
    dataset: { kind: "moons", n: 160, noise: 0.3, seed: 23, nClasses: 2 },
    algo: "tree",
    controls: [
      { key: "maxDepth", label: "Profondeur maximale", kind: "slider", min: 1, max: 12 },
      { key: "minLeaf", label: "Minimum par feuille", kind: "slider", min: 1, max: 30 },
    ],
    initial: { maxDepth: 12, minLeaf: 1 },
    toParams: (v) => ({ maxDepth: Number(v.maxDepth), minSamplesLeaf: Number(v.minLeaf) }),
    goal: (r) => r.testAcc >= 0.86 && r.trainAcc - r.testAcc < 0.08,
    goalLabel: "Test ≥ 86 % et écart < 8 points",
    hint: (
      <>
        Deux leviers, et le second est souvent le plus efficace : interdire les feuilles
        minuscules empêche l&apos;arbre d&apos;isoler des points individuels, même à grande
        profondeur.
      </>
    ),
    lesson: (
      <>
        Un modèle « meilleur » n&apos;est pas celui qui maximise l&apos;accuracy
        d&apos;entraînement. Ce défi ne peut pas se gagner en poussant la profondeur — il faut
        accepter de moins bien coller aux données vues.
      </>
    ),
  },
];

export function ChallengesLab() {
  const [active, setActive] = React.useState(0);
  const challenge = CHALLENGES[active];
  const [values, setValues] = React.useState<Record<string, number | string>>(
    CHALLENGES[0].initial,
  );
  const [showHint, setShowHint] = React.useState(false);
  const [solved, setSolved] = React.useState<Record<string, boolean>>({});

  // Switching challenge resets the controls, during render rather than in an
  // effect so the new challenge never paints with the old settings.
  const [lastId, setLastId] = React.useState(challenge.id);
  if (lastId !== challenge.id) {
    setLastId(challenge.id);
    setValues(challenge.initial);
    setShowHint(false);
  }

  const dataset = React.useMemo(
    () => generateDataset(challenge.dataset),
    [challenge.dataset],
  );
  const split = React.useMemo(() => splitDataset(dataset, 0.65, 555), [dataset]);

  const deferred = React.useDeferredValue(values);
  const result = React.useMemo(() => {
    const params: AlgoParams = { ...DEFAULT_PARAMS, ...challenge.toParams(deferred) };
    const { model, parameters } = fitModel(
      challenge.algo,
      split.train,
      dataset.classNames.length,
      params,
    );
    return {
      model,
      parameters,
      field: computeField(model, dataset.domain, 82),
      train: evaluate(model, split.train, dataset.classNames),
      test: evaluate(model, split.test, dataset.classNames),
    };
  }, [challenge, deferred, split, dataset]);

  const passed = challenge.goal({
    testAcc: result.test.accuracy,
    trainAcc: result.train.accuracy,
    params: result.parameters,
  });

  // Record the win once, during render, so the badge in the challenge list
  // persists after the learner moves on.
  if (passed && !solved[challenge.id]) {
    setSolved((s) => ({ ...s, [challenge.id]: true }));
  }

  const testIds = React.useMemo(() => new Set(split.test.map((s) => s.id)), [split]);

  return (
    <PageShell
      eyebrow="Laboratoire"
      title="Défis"
      lede={
        <>
          Quatre problèmes qui ne se résolvent pas en poussant tous les curseurs au maximum.
          Chacun a un critère de réussite vérifié en direct, et chacun a été construit autour
          d&apos;une idée précise — que vous découvrirez en essayant, pas en lisant.
        </>
      }
      wide
    >
      <ClientOnly
        fallback={<div className="h-[600px] animate-pulse rounded-xl border border-line bg-surface-1/60" />}
      >
        <div className="mb-5 flex flex-wrap gap-2">
          {CHALLENGES.map((c, i) => (
            <button
              key={c.id}
              onClick={() => setActive(i)}
              className={cx(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] transition-colors",
                i === active
                  ? "border-accent/50 bg-accent/[0.08] font-medium text-ink"
                  : "border-line bg-surface-1/60 text-ink-2 hover:border-line-strong",
              )}
            >
              {solved[c.id] ? (
                <span aria-hidden style={{ color: STATUS.good }}>
                  ✓
                </span>
              ) : (
                <span className="tnum text-ink-muted">{i + 1}</span>
              )}
              {c.title}
            </button>
          ))}
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            <Panel
              title={challenge.title}
              subtitle={challenge.goalLabel}
              bodyClassName="p-3"
              action={<ClassLegend classNames={dataset.classNames} />}
            >
              <p className="mb-3 px-1 text-[13px] leading-relaxed text-ink-2">
                {challenge.brief}
              </p>
              <DataPlot
                dataset={dataset}
                field={result.field}
                aspect={1}
                maxWidth={480}
                styleFor={(s) => {
                  if (!testIds.has(s.id)) return { dim: true };
                  if (result.test.wrongIds.includes(s.id)) return { wrong: true };
                  return undefined;
                }}
              />
              <p className="mt-2 text-[11px] leading-snug text-ink-muted">
                Les points estompés ont servi à entraîner. Seuls les points nets comptent pour
                le score.
              </p>
            </Panel>

            <div
              className={cx(
                "rounded-xl border px-4 py-3.5 transition-colors",
                passed ? "border-good/40 bg-good/[0.07]" : "border-line bg-surface-1/60",
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className="text-base"
                    style={{ color: passed ? STATUS.good : undefined }}
                  >
                    {passed ? "✓" : "○"}
                  </span>
                  <span className={cx("text-[14px]", passed ? "font-semibold text-ink" : "text-ink-2")}>
                    {passed ? "Défi réussi" : challenge.goalLabel}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Stat label="Test" value={formatPercent(result.test.accuracy)} />
                  <Stat label="Entraînement" value={formatPercent(result.train.accuracy)} />
                  <Stat
                    label="Écart"
                    value={formatPercent(result.train.accuracy - result.test.accuracy, 1)}
                  />
                </div>
              </div>
              {passed && (
                <p className="mt-3 border-t border-good/25 pt-3 text-[12px] leading-relaxed text-ink-2">
                  {challenge.lesson}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <Panel title="Vos réglages">
              <div className="space-y-4">
                {challenge.controls.map((ctrl) =>
                  ctrl.kind === "slider" ? (
                    <Slider
                      key={ctrl.key}
                      label={ctrl.label}
                      value={Number(values[ctrl.key])}
                      min={ctrl.min ?? 0}
                      max={ctrl.max ?? 10}
                      step={ctrl.step ?? 1}
                      onChange={(v) => setValues((s) => ({ ...s, [ctrl.key]: v }))}
                      format={ctrl.format}
                    />
                  ) : (
                    <Segmented
                      key={ctrl.key}
                      label={ctrl.label}
                      value={String(values[ctrl.key])}
                      options={ctrl.options ?? []}
                      onChange={(v) => setValues((s) => ({ ...s, [ctrl.key]: v }))}
                      size="sm"
                    />
                  ),
                )}
              </div>
              <div className="mt-4 flex gap-2">
                <Button size="sm" className="flex-1" onClick={() => setValues(challenge.initial)}>
                  Recommencer
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowHint((h) => !h)}>
                  {showHint ? "Masquer l'indice" : "Indice"}
                </Button>
              </div>
            </Panel>

            {showHint && (
              <Callout kind="insight" title="Indice">
                {challenge.hint}
              </Callout>
            )}

            <Panel title="Ce que le modèle voit">
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Points d'entraînement" value={split.train.length} />
                <Stat label="Points de test" value={split.test.length} />
                <Stat label="Paramètres du modèle" value={result.parameters} />
                <Stat
                  label="Baseline"
                  value={formatPercent(result.test.baseline, 0)}
                  hint="Classe majoritaire"
                />
              </div>
            </Panel>

            <Callout kind="note" title="Pourquoi ces seuils">
              Chaque objectif est atteignable, mais aucun ne s&apos;obtient en maximisant un
              seul curseur. Le dernier défi est même impossible à gagner en poussant la
              profondeur : il faut accepter de moins bien coller aux données vues.
            </Callout>
          </div>
        </div>
      </ClientOnly>
    </PageShell>
  );
}
