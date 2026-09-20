"use client";

import * as React from "react";
import { PageShell, Workbench } from "@/components/layout/PageShell";
import { G } from "@/components/ui/Glossary";
import { Button, Callout, cx, Divider, Panel, Segmented, Select, Slider, Stat, Toggle } from "@/components/ui";
import { Tex } from "@/components/math/Math";
import { ConfusionMatrix } from "@/components/viz/ConfusionMatrix";
import { DataPlot, EditHints } from "@/components/viz/DataPlot";
import { ClassLegend } from "@/components/viz/Legend";
import { DatasetControls } from "@/components/lab/DatasetControls";
import { computeField } from "@/lib/ml/field";
import { splitDataset } from "@/lib/ml/datasets";
import { evaluate } from "@/lib/ml/metrics";
import { diagnose } from "@/lib/ml/diagnose";
import {
  ALGO_ORDER,
  ALGOS,
  DEFAULT_PARAMS,
  fitModel,
  type AlgoId,
  type AlgoParams,
} from "@/lib/ml/registry";
import type { ActivationName } from "@/lib/ml/models/activations";
import { formatPercent } from "@/lib/viz/geometry";
import { CHROME } from "@/lib/viz/palette";
import { useLab } from "@/store/lab";

const ARCHITECTURES: { value: string; label: string; hidden: number[] }[] = [
  { value: "none", label: "Aucune", hidden: [] },
  { value: "s", label: "4", hidden: [4] },
  { value: "m", label: "6-4", hidden: [6, 4] },
  { value: "l", label: "10-8-6", hidden: [10, 8, 6] },
];

export function PlaygroundLab() {
  const { dataset, setDataset, kind, trainRatio, setTrainRatio } = useLab();
  const [algo, setAlgo] = React.useState<AlgoId>("knn");
  const [params, setParams] = React.useState<AlgoParams>(DEFAULT_PARAMS);
  const [cell, setCell] = React.useState<{ trueClass: number; predicted: number } | null>(null);
  const [showTestOnly, setShowTestOnly] = React.useState(false);

  const set = <K extends keyof AlgoParams>(key: K, value: AlgoParams[K]) =>
    setParams((p) => ({ ...p, [key]: value }));

  const nClasses = dataset.classNames.length;
  const split = React.useMemo(() => splitDataset(dataset, trainRatio, 777), [dataset, trainRatio]);
  const deferredSplit = React.useDeferredValue(split);
  const deferredParams = React.useDeferredValue(params);

  const result = React.useMemo(() => {
    if (!deferredSplit.train.length) return null;
    const { model, trainMs, parameters } = fitModel(
      algo,
      deferredSplit.train,
      nClasses,
      deferredParams,
    );
    return {
      model,
      trainMs,
      parameters,
      field: computeField(model, dataset.domain, 88),
      train: evaluate(model, deferredSplit.train, dataset.classNames),
      test: evaluate(
        model,
        deferredSplit.test.length ? deferredSplit.test : deferredSplit.train,
        dataset.classNames,
      ),
    };
  }, [algo, deferredSplit, deferredParams, nClasses, dataset.domain, dataset.classNames]);

  const diagnoses = React.useMemo(
    () =>
      result
        ? diagnose({
            algo,
            params: deferredParams,
            train: result.train,
            test: result.test,
            dataset: kind,
            nTrain: deferredSplit.train.length,
          })
        : [],
    [result, algo, deferredParams, kind, deferredSplit.train.length],
  );

  const testIds = React.useMemo(
    () => new Set(deferredSplit.test.map((s) => s.id)),
    [deferredSplit],
  );

  const cellIds = React.useMemo(() => {
    if (!cell || !result) return null;
    const pool = deferredSplit.test.length ? deferredSplit.test : deferredSplit.train;
    const ids = new Set<number>();
    for (const s of pool) {
      if (s.y === cell.trueClass && result.model.predict(s.x) === cell.predicted) ids.add(s.id);
    }
    return ids;
  }, [cell, result, deferredSplit]);

  return (
    <PageShell
      eyebrow="Laboratoire"
      title="Playground"
      lede={
        <>
          Tout est réglable ici. Choisissez un problème, un algorithme, poussez ses{" "}
          <G t="hyperparametre">hyperparamètres</G> jusqu&apos;à ce qu&apos;ils cassent quelque
          chose, et lisez le diagnostic. Vous pouvez
          aussi dessiner votre propre dataset directement dans le graphique.
        </>
      }
      wide
    >
      <Workbench
        controlsTitle="1 · Le problème et le modèle"
        plot={
          <div className="space-y-5">
            <Panel
              title="Résultat"
              subtitle="Cliquez ou glissez dans le graphique pour modifier les données."
              bodyClassName="p-3"
              action={<ClassLegend classNames={dataset.classNames} />}
            >
              <DataPlot
                dataset={dataset}
                onChange={setDataset}
                field={result?.field ?? null}
                mode="edit"
                aspect={1}
                maxWidth={520}
                styleFor={(s) => {
                  if (cellIds) {
                    return cellIds.has(s.id)
                      ? { ring: CHROME.accent, scale: 1.25 }
                      : { dim: true };
                  }
                  if (showTestOnly && !testIds.has(s.id)) return { dim: true };
                  if (result?.test.wrongIds.includes(s.id)) return { wrong: true };
                  return undefined;
                }}
              />
              <EditHints />
            </Panel>

            {result && (
              <div className="grid gap-5 lg:grid-cols-2">
                <Panel title="Matrice de confusion" subtitle="Sur le jeu de test">
                  <ConfusionMatrix
                    matrix={result.test.matrix}
                    classNames={dataset.classNames}
                    selected={cell}
                    onSelect={setCell}
                  />
                </Panel>

                <Panel title="Par classe" subtitle="Précision, rappel et F1">
                  <table className="w-full text-[11px]">
                    <thead className="text-ink-muted">
                      <tr className="border-b border-line">
                        <th className="pb-1.5 text-left font-medium">Classe</th>
                        <th className="pb-1.5 text-right font-medium">Support</th>
                        <th className="pb-1.5 text-right font-medium">Précision</th>
                        <th className="pb-1.5 text-right font-medium">Rappel</th>
                        <th className="pb-1.5 text-right font-medium">F1</th>
                      </tr>
                    </thead>
                    <tbody className="tnum">
                      {result.test.perClass.map((c) => (
                        <tr key={c.name} className="border-b border-line/50">
                          <td className="py-1.5 text-ink-2">{c.name}</td>
                          <td className="py-1.5 text-right text-ink-2">{c.support}</td>
                          <td className="py-1.5 text-right text-ink-2">
                            {(c.precision * 100).toFixed(1)} %
                          </td>
                          <td className="py-1.5 text-right text-ink-2">
                            {(c.recall * 100).toFixed(1)} %
                          </td>
                          <td className="py-1.5 text-right font-semibold text-ink">
                            {c.f1.toFixed(3)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-2.5 text-[11px] leading-snug text-ink-muted">
                    <strong>Précision</strong> : parmi les points prédits dans cette classe,
                    combien en sont vraiment. <strong>Rappel</strong> : parmi les points de cette
                    classe, combien ont été retrouvés. Les deux se compensent, et F1 est leur
                    moyenne harmonique.
                  </p>
                </Panel>
              </div>
            )}
          </div>
        }
        controls={
          <>
            <Select
              label="Algorithme"
              value={algo}
              options={ALGO_ORDER.map((id) => ({ value: id, label: ALGOS[id].label }))}
              onChange={(v) => {
                setAlgo(v as AlgoId);
                setCell(null);
              }}
              hint={ALGOS[algo].assumption}
            />

            <Divider label="Hyperparamètres" />

            {algo === "knn" && (
              <>
                <Slider
                  label={<Tex>K</Tex>}
                  value={params.k}
                  min={1}
                  max={Math.max(2, Math.min(60, split.train.length))}
                  onChange={(v) => set("k", v)}
                />
                <Toggle
                  label="Pondérer par la distance"
                  checked={params.weighted}
                  onChange={(v) => set("weighted", v)}
                />
              </>
            )}

            {(algo === "tree" || algo === "forest") && (
              <>
                <Slider
                  label="Profondeur maximale"
                  value={params.maxDepth}
                  min={1}
                  max={10}
                  onChange={(v) => set("maxDepth", v)}
                />
                <Slider
                  label="Minimum par feuille"
                  value={params.minSamplesLeaf}
                  min={1}
                  max={25}
                  onChange={(v) => set("minSamplesLeaf", v)}
                />
                <Segmented
                  label="Impureté"
                  value={params.criterion}
                  options={[
                    { value: "gini", label: "Gini" },
                    { value: "entropy", label: "Entropie" },
                  ]}
                  onChange={(v) => set("criterion", v as "gini" | "entropy")}
                  size="sm"
                />
              </>
            )}

            {algo === "forest" && (
              <Slider
                label="Nombre d'arbres"
                value={params.nTrees}
                min={1}
                max={40}
                onChange={(v) => set("nTrees", v)}
              />
            )}

            {algo === "svm" && (
              <>
                <Segmented
                  label="Kernel"
                  value={params.kernel}
                  options={[
                    { value: "linear", label: "Linéaire" },
                    { value: "rbf", label: "RBF" },
                    { value: "poly", label: "Poly" },
                  ]}
                  onChange={(v) => set("kernel", v as AlgoParams["kernel"])}
                  size="sm"
                />
                <Slider
                  label={<Tex>C</Tex>}
                  value={Math.log10(params.C)}
                  min={-2}
                  max={2}
                  step={0.25}
                  onChange={(v) => set("C", Number((10 ** v).toPrecision(2)))}
                  format={() => String(params.C)}
                />
                {params.kernel === "rbf" && (
                  <Slider
                    label={<Tex>{String.raw`\gamma`}</Tex>}
                    value={params.gamma}
                    min={0.1}
                    max={8}
                    step={0.1}
                    onChange={(v) => set("gamma", v)}
                    format={(v) => v.toFixed(1)}
                  />
                )}
                {params.kernel === "poly" && (
                  <Slider
                    label="Degré"
                    value={params.degree}
                    min={2}
                    max={6}
                    onChange={(v) => set("degree", v)}
                  />
                )}
              </>
            )}

            {algo === "mlp" && (
              <>
                <Segmented
                  label="Couches cachées"
                  value={
                    ARCHITECTURES.find((a) => a.hidden.join("-") === params.hidden.join("-"))
                      ?.value ?? "m"
                  }
                  options={ARCHITECTURES.map((a) => ({ value: a.value, label: a.label }))}
                  onChange={(v) => set("hidden", ARCHITECTURES.find((a) => a.value === v)!.hidden)}
                  size="sm"
                />
                <Segmented
                  label="Activation"
                  value={params.activation}
                  options={[
                    { value: "tanh", label: "Tanh" },
                    { value: "relu", label: "ReLU" },
                    { value: "sigmoid", label: "Sigmoid" },
                  ]}
                  onChange={(v) => set("activation", v as ActivationName)}
                  size="sm"
                />
                <Slider
                  label={<Tex>{String.raw`\alpha`}</Tex>}
                  value={params.learningRate}
                  min={0.005}
                  max={0.5}
                  step={0.005}
                  onChange={(v) => set("learningRate", v)}
                  format={(v) => v.toFixed(3)}
                />
                <Slider
                  label="Epochs"
                  value={params.epochs}
                  min={10}
                  max={400}
                  step={10}
                  onChange={(v) => set("epochs", v)}
                />
                <Slider
                  label={<Tex>{String.raw`\lambda`}</Tex>}
                  value={params.l2}
                  min={0}
                  max={0.05}
                  step={0.001}
                  onChange={(v) => set("l2", v)}
                  format={(v) => v.toFixed(3)}
                />
              </>
            )}

            {(algo === "centroid" || algo === "bayes") && (
              <p className="rounded-md border border-line bg-surface-2/50 px-2.5 py-2 text-[11px] leading-snug text-ink-2">
                {ALGOS[algo].label} n&apos;a aucun hyperparamètre : il est entièrement déterminé
                par les données. C&apos;est une qualité — rien à régler, rien à mal régler.
              </p>
            )}

            <Button
              size="sm"
              variant="ghost"
              className="w-full"
              onClick={() => setParams(DEFAULT_PARAMS)}
            >
              Réinitialiser les paramètres
            </Button>

            <Divider label="Découpage" />
            <Slider
              label="Part entraînement / test"
              value={trainRatio}
              min={0.3}
              max={0.9}
              step={0.05}
              onChange={setTrainRatio}
              format={(v) => `${Math.round(v * 100)} / ${Math.round((1 - v) * 100)}`}
              hint={`${split.train.length} points d'entraînement, ${split.test.length} de test`}
            />
            <Toggle
              label="Estomper les points d'entraînement"
              checked={showTestOnly}
              onChange={setShowTestOnly}
              hint="Pour ne regarder que ce que le modèle n'a jamais vu."
            />

            <Divider label="Données" />
            <DatasetControls />
          </>
        }
        below={
          <>
            {result && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Stat
                    label="Accuracy test"
                    value={formatPercent(result.test.accuracy)}
                    tone={
                      result.test.accuracy > 0.9
                        ? "good"
                        : result.test.accuracy > result.test.baseline + 0.05
                          ? "neutral"
                          : "critical"
                    }
                  />
                  <Stat
                    label="Accuracy entraînement"
                    value={formatPercent(result.train.accuracy)}
                    hint="Sur les points que le modèle a vus"
                  />
                  <Stat
                    label="Entraînement"
                    value={`${result.trainMs.toFixed(1)} ms`}
                    hint="Mesuré à l'instant"
                  />
                  <Stat label="Paramètres" value={result.parameters} />
                </div>

                <Panel title="Lecture du résultat" subtitle="Ce que ces chiffres disent">
                  <div className="space-y-3">
                    {diagnoses.length === 0 && (
                      <p className="text-[12px] leading-relaxed text-ink-2">
                        Rien de particulier à signaler : le modèle fait mieux que la baseline,
                        et l&apos;écart entre entraînement et test reste raisonnable.
                      </p>
                    )}
                    {diagnoses.map((d) => (
                      <div
                        key={d.title}
                        className={cx(
                          "rounded-lg border px-3 py-2.5",
                          d.tone === "critical" && "border-critical/35 bg-critical/[0.06]",
                          d.tone === "warning" && "border-warning/30 bg-warning/[0.06]",
                          d.tone === "good" && "border-good/30 bg-good/[0.06]",
                          d.tone === "note" && "border-line bg-surface-2/50",
                        )}
                      >
                        <p className="text-[12px] font-semibold text-ink">{d.title}</p>
                        <p className="mt-1 text-[11px] leading-relaxed text-ink-2">{d.body}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 border-t border-line pt-2.5 text-[10px] leading-snug text-ink-muted">
                    Ces remarques viennent d&apos;une poignée de règles simples appliquées aux
                    chiffres affichés — pas d&apos;un modèle. Chacune dit sur quoi elle
                    s&apos;appuie, pour que vous puissiez la contester.
                  </p>
                </Panel>
              </>
            )}

            <Callout kind="insight" title="Le protocole à prendre">
              <ol className="mt-1.5 space-y-1">
                <li>1. Notez l&apos;accuracy de test avec les réglages par défaut.</li>
                <li>2. Changez <strong>un seul</strong> paramètre et relevez l&apos;écart.</li>
                <li>3. Poussez-le jusqu&apos;à ce que le résultat se dégrade.</li>
                <li>4. Regardez <em>où</em> les erreurs se produisent, pas seulement combien.</li>
              </ol>
              C&apos;est exactement la boucle d&apos;un praticien — à ceci près qu&apos;ici elle
              prend deux secondes au lieu de deux heures.
            </Callout>
          </>
        }
      />
    </PageShell>
  );
}
