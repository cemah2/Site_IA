"use client";

import Link from "next/link";
import * as React from "react";
import { Button, Callout, cx, Segmented, Slider, Stat } from "@/components/ui";
import { ClassLegend } from "@/components/viz/Legend";
import { DataPlot, EditHints } from "@/components/viz/DataPlot";
import { DATASET_SPECS, type DatasetId } from "@/lib/ml/datasets";
import { DEFAULT_PARAMS, type AlgoId } from "@/lib/ml/registry";
import { useFit } from "@/lib/hooks/useFit";
import { formatPercent } from "@/lib/viz/geometry";
import { useLab } from "@/store/lab";

const QUICK_ALGOS: { value: AlgoId; label: string }[] = [
  { value: "centroid", label: "Centroïde" },
  { value: "knn", label: "KNN" },
  { value: "tree", label: "Arbre" },
  { value: "svm", label: "SVM" },
  { value: "mlp", label: "Réseau" },
];

const QUICK_DATASETS: DatasetId[] = ["moons", "circles", "blobs", "spirals", "xor"];

type Stage = 0 | 1 | 2 | 3;

const STAGES = [
  { key: "data", label: "Données", detail: "Des points, chacun avec des coordonnées et une classe." },
  { key: "algo", label: "Algorithme", detail: "Une règle pour transformer ces points en décision." },
  { key: "fit", label: "Apprentissage", detail: "Les paramètres s'ajustent sur les données." },
  { key: "model", label: "Modèle", detail: "Une réponse pour chaque point du plan, même là où il n'y a aucune donnée." },
] as const;

/**
 * The first thing anyone sees: the whole pipeline, live, in one frame.
 *
 * The stage stepper is not decoration — it gates what is drawn. At stage 0 the
 * plot shows only points; the decision surface literally does not exist yet.
 * Stepping forward makes the abstract sequence "data → algorithm → training →
 * model" something the learner watches happen to their own points, which is
 * the single idea the rest of the site elaborates.
 */
export function Hero() {
  const { dataset, setDataset, kind, setKind, noise, setNoise, reseed } = useLab();
  const [algo, setAlgo] = React.useState<AlgoId>("knn");
  const [stage, setStage] = React.useState<Stage>(0);
  const [brush, setBrush] = React.useState(0);

  const params = React.useMemo(
    () => ({ ...DEFAULT_PARAMS, k: 7, epochs: 90, hidden: [8, 6] }),
    [],
  );

  const { field, evaluation, trainMs } = useFit({
    algo,
    dataset,
    params,
    resolution: 76,
    enabled: stage >= 2,
  });

  // Changing the problem or the algorithm invalidates a model that was already
  // shown as trained — silently keeping the old surface would be a lie. Done
  // during render (React's documented "reset state when a prop changes"
  // pattern) rather than in an effect, so the stale surface is never painted.
  const runKey = `${algo}|${kind}`;
  const [lastRunKey, setLastRunKey] = React.useState(runKey);
  if (lastRunKey !== runKey) {
    setLastRunKey(runKey);
    setStage(0);
  }

  return (
    <section className="border-b border-line bg-[radial-gradient(120%_80%_at_10%_-10%,rgba(37,132,245,0.09),transparent_60%)]">
      <div className="mx-auto max-w-[1400px] px-5 py-10 lg:px-10 lg:py-16">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,460px)] xl:items-center">
          <div className="order-2 xl:order-1">
            <div className="rounded-xl border border-line bg-surface-1/80 p-3">
              <DataPlot
                dataset={dataset}
                onChange={setDataset}
                field={stage >= 3 ? field : null}
                mode="edit"
                brushClass={brush}
                aspect={1}
                maxWidth={560}
                showConfidence={stage >= 3}
                ariaLabel="Nuage de points interactif : ajoutez, déplacez et reclassez des points, puis entraînez un modèle"
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2.5">
                <ClassLegend
                  classNames={dataset.classNames}
                  active={brush}
                  onSelect={setBrush}
                  title="Pinceau :"
                />
                <span className="tnum text-[11px] text-ink-muted">
                  {dataset.samples.length} points
                </span>
              </div>
              <EditHints />
            </div>
          </div>

          <div className="order-1 xl:order-2">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
              Laboratoire interactif
            </p>
            <h1 className="text-[34px] font-semibold leading-[1.08] tracking-tight text-ink lg:text-[44px]">
              Voir comment
              <br />
              une machine apprend.
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ink-2">
              Ces points sont vos données. Déplacez-les, ajoutez-en, changez leur classe.
              Puis choisissez un algorithme et regardez-le découper le plan. Tout se calcule
              dans votre navigateur, en temps réel.
            </p>

            <div className="mt-6 space-y-4 rounded-xl border border-line bg-surface-1/80 p-4">
              <Segmented
                label="Algorithme"
                value={algo}
                options={QUICK_ALGOS}
                onChange={setAlgo}
                size="sm"
              />

              <ol className="space-y-1.5">
                {STAGES.map((s, i) => {
                  const done = stage >= i;
                  const isCurrent = stage === i;
                  return (
                    <li
                      key={s.key}
                      className={cx(
                        "flex gap-2.5 rounded-lg border px-2.5 py-2 transition-colors",
                        done ? "border-line bg-surface-2/60" : "border-transparent",
                      )}
                    >
                      <span
                        className={cx(
                          "tnum mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                          done ? "bg-accent/20 text-accent" : "bg-surface-3 text-ink-muted",
                        )}
                      >
                        {i + 1}
                      </span>
                      <span className="min-w-0">
                        <span
                          className={cx(
                            "block text-[13px] font-medium",
                            done ? "text-ink" : "text-ink-muted",
                          )}
                        >
                          {s.label}
                        </span>
                        {(isCurrent || done) && (
                          <span className="mt-0.5 block text-[11px] leading-snug text-ink-muted">
                            {s.detail}
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ol>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  onClick={() => setStage((s) => (s >= 3 ? 0 : ((s + 1) as Stage)))}
                >
                  {stage === 0
                    ? "Choisir l'algorithme →"
                    : stage === 1
                      ? "Lancer l'apprentissage →"
                      : stage === 2
                        ? "Afficher le modèle →"
                        : "Recommencer"}
                </Button>
                <Button onClick={reseed}>Nouvelles données</Button>
              </div>

              {stage >= 3 && evaluation && (
                <div className="grid grid-cols-2 gap-2">
                  <Stat
                    label="Accuracy sur ces points"
                    value={formatPercent(evaluation.accuracy, 1)}
                    tone={evaluation.accuracy > 0.9 ? "good" : "neutral"}
                  />
                  <Stat label="Temps d'entraînement" value={trainMs.toFixed(1)} unit="ms" />
                </div>
              )}
            </div>

            <div className="mt-4 space-y-3">
              <Segmented
                label="Forme du problème"
                value={kind}
                options={QUICK_DATASETS.map((d) => {
                  const spec = DATASET_SPECS.find((s) => s.id === d)!;
                  return { value: d, label: spec.short, title: spec.teaches };
                })}
                onChange={(v) => setKind(v)}
                size="sm"
              />
              <Slider
                label="Bruit ajouté aux coordonnées"
                value={noise}
                min={0}
                max={0.6}
                step={0.02}
                onChange={setNoise}
                format={(v) => v.toFixed(2)}
                hint="Le bruit ne change pas la vraie frontière — seulement ce que le modèle peut en voir."
              />
            </div>

            {stage >= 3 && evaluation && evaluation.accuracy < 0.8 && (
              <Callout kind="insight" title="Ce modèle a du mal">
                Regardez <em>où</em> il se trompe dans le nuage. Un autre algorithme
                découperait ce plan autrement — c&apos;est exactement ce que compare la{" "}
                <Link href="/comparaison/">page de comparaison</Link>.
              </Callout>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
