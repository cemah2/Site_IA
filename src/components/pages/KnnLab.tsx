"use client";

import * as React from "react";
import { PageShell, SectionTitle, Workbench } from "@/components/layout/PageShell";
import { Callout, Divider, Panel, Segmented, Slider, Stat, Toggle } from "@/components/ui";
import { Levels } from "@/components/ui/Levels";
import { LiveFormula, Tex } from "@/components/math/Math";
import { DataPlot, EditHints } from "@/components/viz/DataPlot";
import { ClassLegend, ClassMark } from "@/components/viz/Legend";
import { DatasetControls } from "@/components/lab/DatasetControls";
import { Narrator } from "@/components/lab/Narrator";
import { boundarySegments, computeField } from "@/lib/ml/field";
import { evaluate } from "@/lib/ml/metrics";
import { Knn, type Metric } from "@/lib/ml/models/knn";
import { splitDataset } from "@/lib/ml/datasets";
import { formatNumber, formatPercent } from "@/lib/viz/geometry";
import { classColor, CHROME, withAlpha } from "@/lib/viz/palette";
import { useLab } from "@/store/lab";

const K_PRESETS = [1, 3, 5, 10, 20, 40];

export function KnnLab() {
  const { dataset, setDataset, trainRatio } = useLab();
  const [k, setK] = React.useState(5);
  const [metric, setMetric] = React.useState<Metric>("euclidean");
  const [weighted, setWeighted] = React.useState(false);
  const [query, setQuery] = React.useState<[number, number]>([0.6, 0.4]);
  const [showField, setShowField] = React.useState(true);

  const nClasses = dataset.classNames.length;
  const model = React.useMemo(
    () => new Knn(dataset.samples, nClasses, k, metric, weighted),
    [dataset.samples, nClasses, k, metric, weighted],
  );

  const deferredModel = React.useDeferredValue(model);
  const field = React.useMemo(
    () => (showField ? computeField(deferredModel, dataset.domain, 84) : null),
    [deferredModel, dataset.domain, showField],
  );

  const detail = model.detail(query);

  // How convoluted the boundary is, as a count of its segments. This is the
  // quantity the page is actually about — K controls smoothness — and unlike
  // accuracy it moves on every change of K, so the narrator always has
  // something true to report.
  const boundaryComplexity = React.useMemo(
    () => (field ? boundarySegments(field).length : 0),
    [field],
  );

  // Measured on held-out points, never on the training set. Narrating training
  // accuracy would say "smaller K is always better" — which is the exact trap
  // this page warns about, stated by the page itself.
  const liveEval = React.useMemo(() => {
    const { train, test } = splitDataset(dataset, trainRatio, 1234);
    if (!test.length) return null;
    return evaluate(new Knn(train, nClasses, k, metric, weighted), test, dataset.classNames);
  }, [dataset, trainRatio, nClasses, k, metric, weighted]);
  const neighbourIds = React.useMemo(
    () => new Set(detail.neighbours.map((n) => n.sample.id)),
    [detail],
  );

  // Held-out accuracy across K: the U-shape that makes "too small / too large"
  // a measurement rather than a claim.
  const sweep = React.useMemo(() => {
    const { train, test } = splitDataset(dataset, trainRatio, 1234);
    if (!test.length) return [];
    return K_PRESETS.map((kk) => {
      const m = new Knn(train, nClasses, kk, metric, weighted);
      return { k: kk, acc: evaluate(m, test, dataset.classNames).accuracy };
    });
  }, [dataset, nClasses, metric, weighted, trainRatio]);

  const bestK = sweep.length ? sweep.reduce((a, b) => (b.acc > a.acc ? b : a)) : null;
  const counts = dataset.classNames.map((_, i) => dataset.samples.filter((s) => s.y === i).length);
  const totalVotes = detail.votes.reduce((a, b) => a + b, 0) || 1;

  return (
    <PageShell
      eyebrow="Classification"
      title="K-Nearest Neighbors"
      lede={
        <>
          KNN ne s&apos;entraîne pas. Le modèle <em>est</em> le jeu de données, et tout le
          travail arrive au moment de répondre : regarder les <Tex>K</Tex> points les plus
          proches, et prendre la classe majoritaire. Ce qui rend <Tex>K</Tex> si intéressant,
          c&apos;est qu&apos;il règle une seule chose — <strong>jusqu&apos;où le modèle regarde
          avant de répondre</strong>.
        </>
      }
    >
      <Workbench
        plot={
          <Panel
            title="Prédire un point"
            subtitle="Cliquez n'importe où dans le graphique pour déplacer le point à classer."
            bodyClassName="p-3"
            action={<ClassLegend classNames={dataset.classNames} counts={counts} />}
          >
            <DataPlot
              dataset={dataset}
              onChange={setDataset}
              field={field}
              mode="edit"
              aspect={1}
              onQuery={(x, y) => setQuery([x, y])}
              styleFor={(s) =>
                neighbourIds.has(s.id)
                  ? { ring: classColor(s.y), scale: 1.15 }
                  : { dim: true }
              }
              overlay={(frame) => {
                const [qx, qy] = frame.px(query[0], query[1]);
                // Radius of the K-th neighbour: the "how far it looked" circle.
                const [rx] = frame.px(query[0] + detail.radius, query[1]);
                return (
                  <g clipPath="url(#plot-clip)">
                    {metric === "euclidean" ? (
                      <circle
                        cx={qx}
                        cy={qy}
                        r={Math.abs(rx - qx)}
                        fill={withAlpha(CHROME.ink, 0.03)}
                        stroke={CHROME.lineStrong}
                        strokeWidth={1}
                        strokeDasharray="4 4"
                      />
                    ) : (
                      // Manhattan's unit ball is a diamond, not a circle. Drawing
                      // the right shape is the clearest way to show that "near"
                      // depends on the metric you chose.
                      <path
                        d={`M${qx},${qy - Math.abs(rx - qx)}L${qx + Math.abs(rx - qx)},${qy}L${qx},${qy + Math.abs(rx - qx)}L${qx - Math.abs(rx - qx)},${qy}Z`}
                        fill={withAlpha(CHROME.ink, 0.03)}
                        stroke={CHROME.lineStrong}
                        strokeWidth={1}
                        strokeDasharray="4 4"
                      />
                    )}
                    {detail.neighbours.map((nb) => {
                      const [nx, ny] = frame.px(nb.sample.x[0], nb.sample.x[1]);
                      return (
                        <line
                          key={nb.sample.id}
                          x1={qx}
                          y1={qy}
                          x2={nx}
                          y2={ny}
                          stroke={classColor(nb.sample.y)}
                          strokeWidth={weighted ? Math.max(0.6, Math.min(3, nb.weight * 1.5)) : 1.25}
                          opacity={0.75}
                        />
                      );
                    })}
                  </g>
                );
              }}
              topOverlay={(frame) => {
                const [qx, qy] = frame.px(query[0], query[1]);
                return (
                  <g clipPath="url(#plot-clip)">
                    <circle
                      cx={qx}
                      cy={qy}
                      r={8}
                      fill={CHROME.surface1}
                      stroke={classColor(detail.predicted)}
                      strokeWidth={2.5}
                    />
                    <circle cx={qx} cy={qy} r={2.5} fill={CHROME.ink} />
                    <text
                      x={qx}
                      y={qy - 14}
                      textAnchor="middle"
                      fontSize={10}
                      fontWeight={600}
                      fill={CHROME.ink}
                      style={{ paintOrder: "stroke", stroke: CHROME.surface1, strokeWidth: 3.5 }}
                    >
                      → {dataset.classNames[detail.predicted]}
                    </text>
                  </g>
                );
              }}
            />
            <EditHints />
            <Narrator
              className="mt-3"
              placeholder="Bougez le curseur K : l'effet sur la frontière et sur les erreurs sera décrit ici."
              causes={[
                { key: "k", label: "K", value: k },
                { key: "metric", label: "la distance", value: metric === "euclidean" ? "euclidienne" : "Manhattan", feminine: true },
                { key: "weighted", label: "la pondération", value: weighted ? "activée" : "désactivée", feminine: true },
              ]}
              effects={
                liveEval
                  ? [
                      {
                        key: "acc",
                        label: "l'accuracy sur les points jamais vus",
                        value: liveEval.accuracy,
                        format: (v) => formatPercent(v, 1),
                        better: "up",
                        epsilon: 0.0001,
                      },
                      {
                        key: "errors",
                        label: "le nombre d'erreurs",
                        value: liveEval.wrongIds.length,
                        format: (v) => String(Math.round(v)),
                        better: "down",
                        epsilon: 0.5,
                      },
                      {
                        key: "complexity",
                        label: "la complexité de la frontière",
                        value: boundaryComplexity,
                        format: (v) => `${Math.round(v)} segments`,
                        epsilon: 2,
                      },
                    ]
                  : []
              }
            />
          </Panel>
        }
        controls={
          <>
            <Slider
              label={
                <>
                  <Tex>K</Tex> — nombre de voisins consultés
                </>
              }
              value={k}
              min={1}
              max={Math.min(60, Math.max(2, dataset.samples.length))}
              step={1}
              onChange={setK}
              hint={
                k === 1
                  ? "K = 1 : la frontière passe exactement entre les points. Chaque point de bruit crée son propre îlot."
                  : k >= dataset.samples.length * 0.5
                    ? "K très grand : le modèle répond presque toujours la classe majoritaire, où que vous cliquiez."
                    : undefined
              }
            />
            <Segmented
              value={String(k)}
              options={K_PRESETS.filter((p) => p <= dataset.samples.length).map((p) => ({
                value: String(p),
                label: String(p),
              }))}
              onChange={(v) => setK(Number(v))}
              size="sm"
            />
            <Divider label="Notion de proximité" />
            <Segmented
              label="Distance"
              value={metric}
              options={[
                { value: "euclidean", label: "Euclidienne", title: "À vol d'oiseau" },
                { value: "manhattan", label: "Manhattan", title: "En suivant les axes" },
              ]}
              onChange={(v) => setMetric(v as Metric)}
              size="sm"
            />
            <Toggle
              label="Pondérer par la distance"
              checked={weighted}
              onChange={setWeighted}
              hint="Chaque voisin vote avec un poids 1/d². Un voisin lointain compte moins qu'un voisin collé."
            />
            <Toggle label="Afficher la frontière" checked={showField} onChange={setShowField} />
            <Divider label="Données" />
            <DatasetControls />
          </>
        }
        below={
          <>
            <Panel title="Le vote" subtitle={`Les ${detail.neighbours.length} voisins retenus`}>
              <ul className="space-y-1.5">
                {dataset.classNames.map((name, i) => {
                  const share = detail.votes[i] / totalVotes;
                  const isWinner = detail.predicted === i;
                  return (
                    <li key={name} className="flex items-center gap-2">
                      <ClassMark index={i} />
                      <span className="w-12 shrink-0 text-[11px] text-ink-2">{name}</span>
                      <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                        <span
                          className="absolute inset-y-0 left-0 rounded-full transition-all duration-200"
                          style={{
                            width: `${share * 100}%`,
                            background: classColor(i),
                            opacity: isWinner ? 1 : 0.4,
                          }}
                        />
                      </span>
                      <span className="tnum w-12 shrink-0 text-right text-xs font-semibold text-ink">
                        {weighted ? formatNumber(detail.votes[i]) : detail.votes[i]}
                      </span>
                    </li>
                  );
                })}
              </ul>

              <Divider />

              <div className="max-h-44 overflow-y-auto">
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0 bg-surface-1 text-ink-muted">
                    <tr>
                      <th className="pb-1 text-left font-medium">#</th>
                      <th className="pb-1 text-left font-medium">Classe</th>
                      <th className="pb-1 text-right font-medium">Distance</th>
                      {weighted && <th className="pb-1 text-right font-medium">Poids</th>}
                    </tr>
                  </thead>
                  <tbody className="tnum text-ink-2">
                    {detail.neighbours.map((nb, i) => (
                      <tr key={nb.sample.id} className="border-t border-line/60">
                        <td className="py-1">{i + 1}</td>
                        <td className="py-1">
                          <span className="inline-flex items-center gap-1.5">
                            <ClassMark index={nb.sample.y} size={9} />
                            {dataset.classNames[nb.sample.y]}
                          </span>
                        </td>
                        <td className="py-1 text-right">{formatNumber(nb.distance, 3)}</td>
                        {weighted && (
                          <td className="py-1 text-right">{formatNumber(nb.weight, 2)}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>

            {sweep.length > 0 && (
              <Panel
                title="Quel K choisir ?"
                subtitle="Accuracy mesurée sur des points que le modèle n'a pas vus"
              >
                <ul className="space-y-1.5">
                  {sweep.map((row) => (
                    <li key={row.k} className="flex items-center gap-2">
                      <span className="tnum w-8 shrink-0 text-[11px] text-ink-muted">
                        K={row.k}
                      </span>
                      <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                        <span
                          className="absolute inset-y-0 left-0 rounded-full"
                          style={{
                            width: `${row.acc * 100}%`,
                            background: row.k === bestK?.k ? CHROME.accent : CHROME.lineStrong,
                          }}
                        />
                      </span>
                      <span className="tnum w-12 shrink-0 text-right text-[11px] font-semibold text-ink">
                        {formatPercent(row.acc, 0)}
                      </span>
                    </li>
                  ))}
                </ul>
                {bestK && (
                  <p className="mt-2.5 text-[11px] leading-snug text-ink-muted">
                    Meilleur ici : <strong className="text-ink">K = {bestK.k}</strong>. Ce chiffre
                    dépend du bruit et de la densité — augmentez le bruit et regardez-le monter.
                  </p>
                )}
              </Panel>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Stat
                label="Rayon consulté"
                value={formatNumber(detail.radius)}
                hint="Distance jusqu'au K-ième voisin"
              />
              <Stat
                label="Paramètres appris"
                value="0"
                hint={`Le modèle stocke les ${dataset.samples.length} points, mais n'apprend rien`}
              />
            </div>
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
                Vous arrivez dans une ville inconnue et vous voulez savoir si un quartier est
                calme ou animé. Une méthode raisonnable : regarder les{" "}
                <Tex>K</Tex> rues les plus proches et prendre la réponse majoritaire.
              </p>
              <p>
                <strong>Avec <Tex>K = 1</Tex></strong>, vous copiez la rue d&apos;à côté. Si elle
                est atypique, vous vous trompez — mais vous captez aussi les détails fins.
              </p>
              <p>
                <strong>Avec <Tex>K = 40</Tex></strong>, vous faites une moyenne sur tout le
                quartier. Le bruit disparaît, mais les détails aussi : une petite poche animée au
                milieu d&apos;une zone calme devient invisible.
              </p>
              <p>
                Il n&apos;y a pas de bon <Tex>K</Tex> universel. Il y a un bon <Tex>K</Tex> pour
                un dataset donné, et le panneau « Quel K choisir ? » le mesure au lieu de le
                deviner.
              </p>
            </>
          }
          technique={
            <>
              <p>
                KNN est un modèle <strong>non paramétrique</strong> et{" "}
                <strong>paresseux</strong> : il n&apos;a pas de phase d&apos;apprentissage, aucun
                paramètre n&apos;est ajusté, et le coût est entièrement reporté sur la prédiction.
                Chaque requête coûte <Tex>O(n \cdot d)</Tex> — il compare au dataset entier.
              </p>
              <p>
                <strong><Tex>K</Tex> contrôle le compromis biais-variance.</strong> Petit{" "}
                <Tex>K</Tex> : variance élevée, biais faible — la frontière colle aux données, y
                compris à leur bruit. Grand <Tex>K</Tex> : variance faible, biais élevé — la
                frontière se lisse, jusqu&apos;à devenir constante quand <Tex>K = n</Tex>.
              </p>
              <p>
                <strong>Le choix de la distance fait partie du modèle.</strong> Passez en
                Manhattan : la boule unité devient un losange, et les voisins retenus changent.
                Conséquence pratique majeure : <strong>les features doivent être
                normalisées</strong>. Une feature en euros (0 à 50 000) écrase totalement une
                feature en années (0 à 80) dans le calcul de distance.
              </p>
              <p>
                <strong>La malédiction de la dimension.</strong> En haute dimension, tous les
                points deviennent à peu près équidistants les uns des autres — la notion de
                « plus proche voisin » perd son sens. KNN est excellent en 2D, douteux en 100D.
              </p>
            </>
          }
          maths={
            <>
              <p>
                Soit <Tex>{String.raw`N_K(x)`}</Tex> l&apos;ensemble des <Tex>K</Tex> points
                d&apos;entraînement minimisant la distance à <Tex>x</Tex>. La règle de vote
                majoritaire :
              </p>
              <LiveFormula
                tex={String.raw`\hat{y}(x) = \arg\max_{c} \sum_{i \in N_K(x)} \mathbb{1}[\, y_i = c \,]`}
              />
              <p>Avec pondération par l&apos;inverse du carré de la distance :</p>
              <LiveFormula
                tex={String.raw`\hat{y}(x) = \arg\max_{c} \sum_{i \in N_K(x)} \frac{1}{d(x, x_i)^2} \; \mathbb{1}[\, y_i = c \,]`}
              />
              <p>Les deux distances proposées sont des cas particuliers de la norme <Tex>L_p</Tex> :</p>
              <LiveFormula
                tex={String.raw`d_p(x, z) = \Bigl( \sum_{i=1}^{d} |x_i - z_i|^p \Bigr)^{1/p}
                  \qquad p = 2 \;\text{(euclidienne)}, \quad p = 1 \;\text{(Manhattan)}`}
              />
              <p>
                <strong>Un résultat qui mérite d&apos;être connu.</strong> Quand{" "}
                <Tex>{String.raw`n \to \infty`}</Tex>, le taux d&apos;erreur de KNN avec{" "}
                <Tex>K = 1</Tex> est borné par deux fois l&apos;erreur de Bayes{" "}
                <Tex>R^*</Tex> — l&apos;erreur du meilleur classifieur possible :
              </p>
              <LiveFormula tex={String.raw`R^* \;\le\; R_{1\text{-NN}} \;\le\; 2R^*\left(1 - \frac{k}{k-1}R^*\right) \;\le\; 2R^*`} />
              <p>
                Autrement dit : <em>copier son plus proche voisin</em> ne peut jamais être pire
                que deux fois l&apos;optimum théorique. C&apos;est une garantie remarquable pour
                une règle aussi naïve.
              </p>
            </>
          }
        />

        <div className="space-y-4">
          <Callout kind="insight" title="Les trois expériences à faire">
            <ul className="mt-1.5 space-y-1.5">
              <li>
                Mettez <Tex>K = 1</Tex> et montez le bruit à 0,4. Regardez les îlots isolés
                apparaître dans la frontière : le modèle mémorise le bruit.
              </li>
              <li>
                Remontez <Tex>K</Tex> à 20. Les îlots disparaissent — mais sur « Spirales », la
                vraie structure disparaît aussi.
              </li>
              <li>
                Dataset « Clusters + outliers », <Tex>K = 1</Tex> puis <Tex>K = 15</Tex>. Un
                outlier isolé ne peut plus gagner un vote à 15 voix.
              </li>
            </ul>
          </Callout>

          <Callout kind="warning" title="Le piège classique">
            Choisir <Tex>K</Tex> en regardant l&apos;accuracy sur les données d&apos;entraînement
            donne toujours <Tex>K = 1</Tex> — parce qu&apos;avec <Tex>K = 1</Tex> le plus proche
            voisin d&apos;un point d&apos;entraînement est lui-même, et l&apos;accuracy vaut 100 %.
            Le panneau « Quel K choisir ? » mesure sur des points mis de côté, jamais sur ceux
            qui ont servi.
          </Callout>

          <Panel title="Cas pratiques" subtitle="Où KNN est réellement utilisé">
            <div className="prose-lab">
              <p>
                <strong>Systèmes de recommandation.</strong> « Les utilisateurs qui vous
                ressemblent ont aimé ceci. » La similarité entre profils remplace la distance
                euclidienne, mais la logique est identique : trouver les <Tex>K</Tex> plus
                proches, agréger leurs choix.
              </p>
              <p>
                <strong>Classification d&apos;espèces (le dataset Iris).</strong> Quatre mesures
                de pétales et sépales suffisent à séparer trois espèces d&apos;iris avec KNN. C&apos;est
                l&apos;exemple pédagogique historique, et il marche parce que les features sont
                peu nombreuses, continues et de même ordre de grandeur.
              </p>
              <p>
                <strong>Détection d&apos;anomalies.</strong> Si la distance au{" "}
                <Tex>K</Tex>-ième voisin est anormalement grande, le point est isolé — donc
                suspect. C&apos;est le rayon qu&apos;affiche le graphique.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}
