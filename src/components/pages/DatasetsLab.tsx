"use client";

import * as React from "react";
import { PageShell, SectionTitle } from "@/components/layout/PageShell";
import { Button, Callout, cx, Panel, Slider } from "@/components/ui";
import { ClientOnly } from "@/components/ui/ClientOnly";
import { Tex } from "@/components/math/Math";
import { DataPlot, EditHints } from "@/components/viz/DataPlot";
import { ClassLegend } from "@/components/viz/Legend";
import { MiniField } from "@/components/viz/MiniField";
import { computeField } from "@/lib/ml/field";
import {
  DATASET_SPECS,
  classCountFor,
  generateDataset,
  splitDataset,
  type DatasetId,
} from "@/lib/ml/datasets";
import { evaluate } from "@/lib/ml/metrics";
import { fitModel, DEFAULT_PARAMS } from "@/lib/ml/registry";
import { formatPercent } from "@/lib/viz/geometry";
import { CHROME } from "@/lib/viz/palette";
import { useLab } from "@/store/lab";

/**
 * Difficulty is measured, not asserted: fit a linear-kernel SVM and a KNN on
 * the same split and report both. A large gap between them is exactly what
 * "this problem is not linearly separable" means, expressed as two numbers a
 * learner can check.
 */
function difficultyOf(kind: DatasetId, nClasses: number) {
  const ds = generateDataset({
    kind,
    n: 200,
    noise: 0.15,
    seed: 5,
    nClasses: classCountFor(kind, nClasses),
  });
  const { train, test } = splitDataset(ds, 0.7, 31);
  const linear = fitModel("svm", train, ds.classNames.length, {
    ...DEFAULT_PARAMS,
    kernel: "linear",
  });
  const local = fitModel("knn", train, ds.classNames.length, { ...DEFAULT_PARAMS, k: 5 });
  return {
    dataset: ds,
    linear: evaluate(linear.model, test, ds.classNames).accuracy,
    knn: evaluate(local.model, test, ds.classNames).accuracy,
  };
}

export function DatasetsLab() {
  const { dataset, setDataset, kind, setKind, noise, setNoise, n, setN, reseed } = useLab();
  const [brush, setBrush] = React.useState(0);

  const nClasses = dataset.classNames.length;

  const gallery = React.useMemo(
    () => DATASET_SPECS.map((spec) => ({ spec, ...difficultyOf(spec.id, 3) })),
    [],
  );

  const previewModel = React.useMemo(
    () => fitModel("knn", dataset.samples, nClasses, { ...DEFAULT_PARAMS, k: 7 }).model,
    [dataset.samples, nClasses],
  );
  const field = React.useMemo(
    () => computeField(previewModel, dataset.domain, 84),
    [previewModel, dataset.domain],
  );

  return (
    <PageShell
      eyebrow="Les données"
      title="Datasets"
      lede={
        <>
          Chacune de ces dix formes a été construite pour casser une hypothèse précise. Ce ne
          sont pas des décorations : ce sont les <strong>contre-exemples</strong> qui révèlent
          ce qu&apos;un algorithme suppose sans le dire. Le dataset que vous choisissez ici vous
          suit sur toutes les autres pages du site.
        </>
      }
      wide
    >
      <ClientOnly
        fallback={<div className="h-[600px] animate-pulse rounded-xl border border-line bg-surface-1/60" />}
      >
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <Panel
            title="Le dataset actif"
            subtitle="Modifiez-le directement : les changements valent pour tout le site."
            bodyClassName="p-3"
            action={
              <ClassLegend
                classNames={dataset.classNames}
                counts={dataset.classNames.map(
                  (_, i) => dataset.samples.filter((s) => s.y === i).length,
                )}
                active={brush}
                onSelect={setBrush}
              />
            }
          >
            <DataPlot
              dataset={dataset}
              onChange={setDataset}
              field={field}
              mode="edit"
              brushClass={brush}
              aspect={1}
              maxWidth={520}
            />
            <EditHints />
            <p className="mt-2 text-[11px] leading-snug text-ink-muted">
              Le fond montre ce qu&apos;un KNN (K = 7) ferait de ces points — juste pour donner
              une idée de la difficulté. Ce n&apos;est pas un modèle entraîné pour la page.
            </p>
          </Panel>

          <div className="space-y-4">
            <Panel title="Réglages">
              <div className="space-y-3.5">
                <Slider label="Nombre de points" value={n} min={20} max={400} step={10} onChange={setN} />
                <Slider
                  label="Bruit"
                  value={noise}
                  min={0}
                  max={0.6}
                  step={0.02}
                  onChange={setNoise}
                  format={(v) => v.toFixed(2)}
                  hint="Le bruit déplace les points sans changer la règle qui les a produits. C'est ce qui rend l'apprentissage non trivial."
                />
                <Button onClick={reseed} className="w-full">
                  Autre tirage
                </Button>
              </div>
            </Panel>

            <Callout kind="insight" title="Pourquoi ça compte">
              Un algorithme qui réussit sur « Clusters gaussiens » n&apos;a rien prouvé :
              presque tout y réussit. Les datasets qui départagent sont ceux où une hypothèse
              casse — et c&apos;est pour ça qu&apos;ils sont dans cette liste.
            </Callout>
          </div>
        </div>

        <SectionTitle hint="La difficulté est mesurée, pas affirmée : accuracy d'un SVM linéaire contre celle d'un KNN, sur le même découpage.">
          Les dix formes
        </SectionTitle>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {gallery.map(({ spec, dataset: preview, linear, knn }) => {
            const gap = knn - linear;
            const active = kind === spec.id;
            return (
              <button
                key={spec.id}
                onClick={() => setKind(spec.id)}
                className={cx(
                  "flex gap-3.5 rounded-xl border p-3.5 text-left transition-colors",
                  active
                    ? "border-accent/50 bg-accent/[0.06]"
                    : "border-line bg-surface-1/60 hover:border-line-strong hover:bg-surface-2/50",
                )}
              >
                <MiniField
                  model={null}
                  dataset={preview}
                  size={96}
                  res={40}
                  label={null}
                />
                <div className="min-w-0 flex-1">
                  <h3 className="text-[13px] font-semibold text-ink">{spec.label}</h3>
                  <p className="mt-1 text-[11px] leading-snug text-ink-muted">{spec.teaches}</p>
                  <dl className="mt-2 space-y-1">
                    <div className="flex items-center gap-2">
                      <dt className="w-16 shrink-0 text-[10px] text-ink-muted">linéaire</dt>
                      <dd className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                        <span
                          className="absolute inset-y-0 left-0 rounded-full"
                          style={{
                            width: `${linear * 100}%`,
                            background: gap > 0.15 ? CHROME.inkMuted : CHROME.accent,
                          }}
                        />
                      </dd>
                      <dd className="tnum w-10 shrink-0 text-right text-[10px] text-ink-2">
                        {formatPercent(linear, 0)}
                      </dd>
                    </div>
                    <div className="flex items-center gap-2">
                      <dt className="w-16 shrink-0 text-[10px] text-ink-muted">KNN</dt>
                      <dd className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                        <span
                          className="absolute inset-y-0 left-0 rounded-full"
                          style={{ width: `${knn * 100}%`, background: CHROME.accent }}
                        />
                      </dd>
                      <dd className="tnum w-10 shrink-0 text-right text-[10px] text-ink-2">
                        {formatPercent(knn, 0)}
                      </dd>
                    </div>
                  </dl>
                  {gap > 0.15 && (
                    <p className="mt-1.5 text-[10px] leading-snug text-warning">
                      Écart de {Math.round(gap * 100)} points : ces données ne sont pas
                      linéairement séparables.
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </ClientOnly>

      <SectionTitle>Ce que le bruit fait, et ne fait pas</SectionTitle>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Le bruit ne change pas la vérité">
          <div className="prose-lab">
            <p>
              Chaque dataset est produit par une règle exacte — un cercle, une spirale, une
              droite — puis chaque point reçoit une perturbation aléatoire. La{" "}
              <strong>vraie</strong> frontière ne bouge jamais ; c&apos;est uniquement ce que le
              modèle peut en observer qui devient flou.
            </p>
            <p>
              D&apos;où une conséquence cruciale : au-delà d&apos;un certain niveau de bruit,{" "}
              <strong>aucun modèle ne peut atteindre 100 %</strong>, et un modèle qui y arrive
              n&apos;a fait que mémoriser les perturbations. Cette part incompressible est
              l&apos;<em>erreur de Bayes</em>.
            </p>
            <p>
              C&apos;est aussi pourquoi un modèle plus complexe n&apos;est pas toujours
              meilleur : passé ce seuil, la complexité supplémentaire ne sert plus qu&apos;à
              apprendre le hasard.
            </p>
          </div>
        </Panel>

        <Panel title="Pourquoi tout est reproductible">
          <div className="prose-lab">
            <p>
              Toutes les données du site viennent d&apos;un générateur pseudo-aléatoire{" "}
              <strong>graine</strong>. Même graine, mêmes points, exactement — d&apos;un
              rafraîchissement à l&apos;autre et d&apos;une page à l&apos;autre.
            </p>
            <p>
              Ce n&apos;est pas un détail technique mais une condition pédagogique : ça garantit
              que si vous changez <Tex>K</Tex> et que le résultat bouge, c&apos;est{" "}
              <Tex>K</Tex> qui en est responsable et rien d&apos;autre.
            </p>
            <p>
              Le bouton « Autre tirage » change la graine : les points changent, la règle qui
              les produit reste la même. C&apos;est exactement l&apos;expérience à faire pour
              juger de la <em>stabilité</em> d&apos;un modèle — la{" "}
              <a href="/concepts/biais-variance/">variance</a> dont parle le compromis
              biais-variance.
            </p>
          </div>
        </Panel>
      </div>
    </PageShell>
  );
}

