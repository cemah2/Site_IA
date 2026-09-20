"use client";

import * as React from "react";
import { PageShell, SectionTitle, Workbench } from "@/components/layout/PageShell";
import { Callout, Divider, Panel, Stat, Toggle } from "@/components/ui";
import { G } from "@/components/ui/Glossary";
import { Levels } from "@/components/ui/Levels";
import { NumericExercise } from "@/components/lab/Practice";
import { Quiz } from "@/components/lab/Quiz";
import { LiveFormula, Tex } from "@/components/math/Math";
import { DataPlot, EditHints } from "@/components/viz/DataPlot";
import { ClassLegend, ClassMark } from "@/components/viz/Legend";
import { DatasetControls } from "@/components/lab/DatasetControls";
import { StageStepper } from "@/components/lab/StageStepper";
import { computeField } from "@/lib/ml/field";
import { evaluate } from "@/lib/ml/metrics";
import { NearestCentroid } from "@/lib/ml/models/nearest-centroid";
import { formatNumber, formatPercent } from "@/lib/viz/geometry";
import { classColor, CHROME, withAlpha } from "@/lib/viz/palette";
import { useLab } from "@/store/lab";

const STAGES = [
  { label: "Les données", detail: "Des points étiquetés. Rien de calculé pour l'instant." },
  {
    label: "Les centroïdes",
    detail: "Un point par classe : la moyenne de ses coordonnées. C'est tout le modèle.",
  },
  {
    label: "Les distances",
    detail: "Cliquez n'importe où : on mesure la distance jusqu'à chaque centroïde.",
  },
  {
    label: "La classification",
    detail: "La plus petite distance gagne. Répétez partout : c'est la frontière.",
  },
];

export function NearestCentroidLab() {
  const { dataset, setDataset } = useLab();
  const [stage, setStage] = React.useState(2);
  const [query, setQuery] = React.useState<[number, number] | null>([1.2, 0.9]);
  const [showErrors, setShowErrors] = React.useState(true);

  const model = React.useMemo(
    () => new NearestCentroid(dataset.samples, dataset.classNames.length),
    [dataset],
  );

  const field = React.useMemo(
    () => (stage >= 3 ? computeField(model, dataset.domain, 110) : null),
    [model, dataset.domain, stage],
  );

  const evaluation = React.useMemo(
    () => evaluate(model, dataset.samples, dataset.classNames),
    [model, dataset],
  );

  const detail = query ? model.detail([query[0], query[1]]) : null;
  const wrongIds = React.useMemo(() => new Set(evaluation.wrongIds), [evaluation]);

  const counts = dataset.classNames.map(
    (_, i) => dataset.samples.filter((s) => s.y === i).length,
  );

  return (
    <PageShell
      eyebrow="Classification"
      title="Nearest Centroid"
      lede={
        <>
          Résumez chaque classe par un seul point — la moyenne — puis répondez
          « la classe dont le centre est le plus proche ». C&apos;est le modèle le plus
          simple qui apprenne réellement quelque chose : il tient en{" "}
          <Tex>{String.raw`k \times d`}</Tex> nombres et s&apos;entraîne en une seule passe.
          Tout le vocabulaire est cliquable : <G t="centroide">centroïde</G>,{" "}
          <G t="distance">distance euclidienne</G>, <G t="frontiere">frontière de décision</G>.
        </>
      }
    >
      <Workbench
        plot={
          <Panel
            title="Le plan de décision"
              exportName="nearest-centroid-frontiere"
            subtitle={
              stage >= 2
                ? "Cliquez dans le graphique pour déplacer le point de test."
                : "Glissez les points : les centroïdes suivent immédiatement."
            }
            bodyClassName="p-3"
            action={
              <ClassLegend classNames={dataset.classNames} counts={counts} />
            }
          >
            <DataPlot
              dataset={dataset}
              onChange={setDataset}
              field={field}
              mode="edit"
              aspect={1}
              onQuery={stage >= 2 ? (x, y) => setQuery([x, y]) : undefined}
              styleFor={(s) =>
                showErrors && stage >= 3 && wrongIds.has(s.id) ? { wrong: true } : undefined
              }
              overlay={(frame) => (
                <g clipPath="url(#plot-clip)">
                  {/* Distance segments: the quantity the algorithm actually
                      compares, drawn rather than described. */}
                  {stage >= 2 &&
                    query &&
                    detail &&
                    model.centroids.map((c, i) => {
                      if (!Number.isFinite(c[0])) return null;
                      const [qx, qy] = frame.px(query[0], query[1]);
                      const [cx, cy] = frame.px(c[0], c[1]);
                      const isNearest = detail.nearest === i;
                      return (
                        <g key={`d${i}`}>
                          <line
                            x1={qx}
                            y1={qy}
                            x2={cx}
                            y2={cy}
                            stroke={classColor(i)}
                            strokeWidth={isNearest ? 2 : 1}
                            strokeDasharray={isNearest ? undefined : "3 3"}
                            opacity={isNearest ? 0.95 : 0.4}
                          />
                          <text
                            x={(qx + cx) / 2}
                            y={(qy + cy) / 2 - 4}
                            textAnchor="middle"
                            fontSize={10}
                            className="tnum"
                            fill={isNearest ? CHROME.ink : CHROME.inkMuted}
                            style={{ paintOrder: "stroke", stroke: CHROME.surface1, strokeWidth: 3 }}
                          >
                            {formatNumber(detail.distances[i])}
                          </text>
                        </g>
                      );
                    })}
                </g>
              )}
              topOverlay={(frame) => (
                <g clipPath="url(#plot-clip)">
                  {stage >= 1 &&
                    model.centroids.map((c, i) => {
                      if (!Number.isFinite(c[0])) return null;
                      const [cx, cy] = frame.px(c[0], c[1]);
                      return (
                        <g key={`c${i}`}>
                          <circle
                            cx={cx}
                            cy={cy}
                            r={13}
                            fill={withAlpha(classColor(i), 0.18)}
                            stroke={classColor(i)}
                            strokeWidth={1.5}
                          />
                          <path
                            d={`M${cx - 6},${cy}h12M${cx},${cy - 6}v12`}
                            stroke={classColor(i)}
                            strokeWidth={1.75}
                          />
                          <text
                            x={cx}
                            y={cy - 18}
                            textAnchor="middle"
                            fontSize={10}
                            fontWeight={600}
                            fill={classColor(i)}
                            style={{ paintOrder: "stroke", stroke: CHROME.surface1, strokeWidth: 3 }}
                          >
                            c{dataset.classNames[i]}
                          </text>
                        </g>
                      );
                    })}

                  {stage >= 2 && query && detail && (
                    <g>
                      <circle
                        cx={frame.px(query[0], query[1])[0]}
                        cy={frame.px(query[0], query[1])[1]}
                        r={7}
                        fill={CHROME.surface1}
                        stroke={stage >= 3 ? classColor(detail.nearest) : CHROME.ink}
                        strokeWidth={2.5}
                      />
                      <circle
                        cx={frame.px(query[0], query[1])[0]}
                        cy={frame.px(query[0], query[1])[1]}
                        r={2}
                        fill={CHROME.ink}
                      />
                    </g>
                  )}
                </g>
              )}
            />
            <EditHints />
          </Panel>
        }
        controls={
          <>
            <StageStepper stages={STAGES} stage={stage} setStage={setStage} />
            <Divider label="Données" />
            <DatasetControls />
            <Divider label="Affichage" />
            <Toggle
              label="Marquer les erreurs"
              checked={showErrors}
              onChange={setShowErrors}
              hint="Les points barrés d'une croix sont mal classés par le modèle."
            />
          </>
        }
        below={
          <>
            {stage >= 2 && detail && query && (
              <Panel title="Le calcul, en direct" subtitle="Point de test → distances → décision">
                <LiveFormula
                  tex={String.raw`d(x, c) = \sqrt{\sum_{i}(x_i - c_i)^2}`}
                  terms={[
                    { symbol: "x_1", value: formatNumber(query[0]) },
                    { symbol: "x_2", value: formatNumber(query[1]) },
                  ]}
                />
                <ul className="mt-3 space-y-1.5">
                  {model.centroids.map((c, i) => {
                    if (!Number.isFinite(c[0])) return null;
                    const isNearest = detail.nearest === i;
                    const max = Math.max(...detail.distances.filter(Number.isFinite));
                    return (
                      <li key={i} className="flex items-center gap-2">
                        <ClassMark index={i} />
                        <span className="w-14 shrink-0 text-[11px] text-ink-2">
                          Classe {dataset.classNames[i]}
                        </span>
                        <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                          <span
                            className="absolute inset-y-0 left-0 rounded-full transition-all"
                            style={{
                              width: `${(detail.distances[i] / (max || 1)) * 100}%`,
                              background: classColor(i),
                              opacity: isNearest ? 1 : 0.45,
                            }}
                          />
                        </span>
                        <span
                          className="tnum w-11 shrink-0 text-right text-xs font-semibold"
                          style={{ color: isNearest ? CHROME.ink : CHROME.inkMuted }}
                        >
                          {formatNumber(detail.distances[i])}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {stage >= 3 && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg border border-line bg-surface-2/60 px-3 py-2">
                    <ClassMark index={detail.nearest} size={13} />
                    <span className="text-[13px] text-ink-2">
                      Distance minimale → prédiction{" "}
                      <strong className="text-ink">
                        classe {dataset.classNames[detail.nearest]}
                      </strong>
                    </span>
                  </div>
                )}
              </Panel>
            )}

            {stage >= 3 && (
              <div className="grid grid-cols-2 gap-2">
                <Stat
                  label="Accuracy"
                  value={formatPercent(evaluation.accuracy)}
                  tone={evaluation.accuracy > 0.85 ? "good" : "warning"}
                  hint={`Baseline (classe majoritaire) : ${formatPercent(evaluation.baseline)}`}
                />
                <Stat
                  label="Paramètres du modèle"
                  value={model.centroids.flat().length}
                  hint="2 coordonnées × nombre de classes"
                />
              </div>
            )}
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
                Imaginez deux groupes de personnes dans une salle. Pour décider à quel groupe
                appartient un nouvel arrivant, vous pourriez calculer le <strong>centre de
                gravité</strong> de chaque groupe, puis regarder de quel centre l&apos;arrivant
                est le plus proche.
              </p>
              <p>
                C&apos;est exactement Nearest Centroid. L&apos;apprentissage consiste à faire une
                moyenne. La prédiction consiste à comparer des distances.
              </p>
              <p>
                Ce que ça implique : le modèle ne retient <strong>rien</strong> de la forme des
                groupes. Deux classes en forme de croissants imbriqués ont des centres presque
                au même endroit — et là, le modèle est perdu. Essayez « Deux lunes » ou
                « Cercles concentriques » dans les contrôles.
              </p>
            </>
          }
          technique={
            <>
              <p>
                Pour chaque classe <Tex>c</Tex>, on calcule le vecteur moyen de ses{" "}
                <G t="sample">échantillons</G> d&apos;<G t="entrainement">entraînement</G>. La règle de décision assigne un point au
                centroïde le plus proche au sens euclidien.
              </p>
              <p>
                Cette règle produit une frontière <strong>linéaire par morceaux</strong> : c&apos;est
                le <strong>diagramme de Voronoï</strong> des centroïdes. Entre deux classes, la
                frontière est la médiatrice du segment qui joint leurs centres. Avec deux classes,
                on obtient donc toujours une droite — jamais autre chose.
              </p>
              <p>
                Complexité : entraînement en <Tex>O(n \cdot d)</Tex>, prédiction en{" "}
                <Tex>O(k \cdot d)</Tex>, mémoire en <Tex>O(k \cdot d)</Tex>. C&apos;est le modèle
                le plus économique du site, à tous les points de vue.
              </p>
              <p>
                Conséquence directe : il est{" "}
                <strong>
                  extrêmement sensible aux <G t="outlier">outliers</G>
                </strong>,
                parce que la moyenne l&apos;est. Un seul point très éloigné déplace le centroïde de
                toute sa classe. Glissez un point loin dans le graphique et regardez le{" "}
                <Tex>+</Tex> bouger.
              </p>
            </>
          }
          maths={
            <>
              <p>Le centroïde de la classe {String.fromCharCode(99)} :</p>
              <LiveFormula
                tex={String.raw`\mu_c = \frac{1}{|S_c|} \sum_{x \in S_c} x
                  \qquad S_c = \{x_i : y_i = c\}`}
              />
              <p>La règle de décision :</p>
              <LiveFormula
                tex={String.raw`\hat{y}(x) = \arg\min_{c} \; \lVert x - \mu_c \rVert_2
                  = \arg\min_{c} \sqrt{\sum_{i=1}^{d} (x_i - \mu_{c,i})^2}`}
              />
              <p>
                <strong>Pourquoi la frontière est une droite.</strong> Entre deux classes{" "}
                <Tex>a</Tex> et <Tex>b</Tex>, la frontière est l&apos;ensemble des points
                équidistants. En développant les normes, les termes en{" "}
                <Tex>{String.raw`\lVert x \rVert^2`}</Tex> s&apos;annulent :
              </p>
              <LiveFormula
                tex={String.raw`\lVert x - \mu_a \rVert^2 = \lVert x - \mu_b \rVert^2
                  \;\Longleftrightarrow\;
                  2\,(\mu_b - \mu_a)^{\!\top} x = \lVert \mu_b \rVert^2 - \lVert \mu_a \rVert^2`}
              />
              <p>
                Le membre de gauche est <strong>linéaire en <Tex>x</Tex></strong>. C&apos;est
                l&apos;équation d&apos;un hyperplan, de vecteur normal{" "}
                <Tex>{String.raw`\mu_b - \mu_a`}</Tex> : perpendiculaire au segment qui joint les
                deux centres, et passant par son milieu.
              </p>
              <p>
                Ce résultat dit aussi <em>pourquoi</em> le modèle échoue sur les cercles
                concentriques : aucune quantité linéaire en <Tex>x</Tex> ne peut séparer un
                intérieur d&apos;un extérieur.
              </p>
            </>
          }
        />


        <NumericExercise
          id="centroid-distance"
          className="mb-5"
          prompt={
            <>
              Le centroïde de la classe A est en <strong>(1 ; 2)</strong>, celui de la classe B en{" "}
              <strong>(6 ; 5)</strong>. Un point arrive en <strong>(4 ; 6)</strong>. Quelle est sa
              distance euclidienne au centroïde de <strong>A</strong> ?
            </>
          }
          answer={5}
          tolerance={0.02}
          steps={[
            <>Écart horizontal : 4 − 1 = 3.</>,
            <>Écart vertical : 6 − 2 = 4.</>,
            <>
              Racine de la somme des carrés :{" "}
              <Tex>{String.raw`\sqrt{3^2 + 4^2} = \sqrt{25}`}</Tex>.
            </>,
          ]}
        />
        <Quiz
          questions={[
            {
              id: "nc1",
              question:
                "Vous glissez un seul point très loin, hors du nuage de sa classe. Qu'arrive-t-il à la frontière ?",
              options: [
                { id: "a", label: "Rien : un point isolé ne pèse presque pas" },
                { id: "b", label: "Elle se déplace, parce que la moyenne de la classe se déplace" },
                { id: "c", label: "Elle se courbe autour du point" },
              ],
              answer: 1,
              explanation: (
                <>
                  Tout le modèle est une moyenne, et une moyenne n&apos;a aucune défense contre
                  une valeur extrême : un point sur cinquante placé dix fois plus loin déplace le
                  centroïde d&apos;un cinquantième de cette distance. Essayez-le au-dessus, le{" "}
                  <Tex>+</Tex> bouge à vue d&apos;œil. La frontière, elle, reste une droite : ce
                  modèle n&apos;a aucun moyen d&apos;en produire une autre.
                </>
              ),
            },
            {
              id: "nc2",
              question:
                "Sur « Cercles concentriques », l'accuracy tombe autour de 50 %. Pourquoi aucun réglage n'y changera rien ?",
              options: [
                { id: "a", label: "Il faudrait plus de points" },
                {
                  id: "b",
                  label:
                    "Les deux classes ont presque le même centre, et la règle ne compare que des distances à des centres",
                },
                { id: "c", label: "Les centroïdes sont mal initialisés" },
              ],
              answer: 1,
              explanation: (
                <>
                  Le cercle intérieur et l&apos;anneau extérieur ont le même centre de gravité.
                  Les deux distances sont donc quasi égales partout, et la décision devient un
                  tirage au sort. Il n&apos;y a rien à régler — ce modèle n&apos;a pas de
                  réglage — il faut changer de modèle. C&apos;est du{" "}
                  <G t="underfitting">sous-apprentissage</G> par construction.
                </>
              ),
            },
            {
              id: "nc3",
              question:
                "Avec 3 classes au lieu de 2, à quoi ressemble la frontière ?",
              options: [
                { id: "a", label: "À trois droites qui se rejoignent en un point" },
                { id: "b", label: "À une courbe" },
                { id: "c", label: "À une seule droite, comme avant" },
              ],
              answer: 0,
              explanation: (
                <>
                  Entre chaque paire de centres, la frontière est la médiatrice de leur segment —
                  une droite. Avec trois centres, ces médiatrices se coupent en un point commun et
                  découpent le plan en trois régions : c&apos;est le{" "}
                  <strong>diagramme de Voronoï</strong> des centroïdes. Passez à 3 classes dans
                  les contrôles pour le voir apparaître.
                </>
              ),
            },
          ]}
        />

        <div className="space-y-4">
          <Callout kind="insight" title="L'expérience à faire">
            Passez le dataset sur <strong>Clusters + outliers</strong>. Les points aberrants
            sont placés à l&apos;intérieur d&apos;un cluster rival. Regardez de combien ils tirent
            le centroïde — et comparez avec KNN, qui les ignore presque.
          </Callout>

          <Callout kind="warning" title="Ce que « confiance » veut dire ici">
            L&apos;ombrage du plan vient d&apos;un <G t="softmax">softmax</G> sur les distances
            négatives. Ce n&apos;est{" "}
            <strong>pas</strong> une probabilité : Nearest Centroid n&apos;est pas un modèle
            probabiliste. C&apos;est une reformulation monotone de la distance, utile pour voir
            où la décision est serrée, rien de plus. Pour de vraies probabilités, voir{" "}
            Naive Bayes.
          </Callout>

          <Panel title="Cas pratique" subtitle="Où ce modèle est le bon choix">
            <div className="prose-lab">
              <p>
                <strong>Classification de documents par centroïde de classe (méthode de
                Rocchio).</strong> Chaque document devient un vecteur de fréquences de mots ;
                chaque catégorie devient le vecteur moyen de ses documents. Un nouveau document
                est rangé dans la catégorie dont le vecteur moyen est le plus proche.
              </p>
              <p>
                Ça marche bien parce que le coût de prédiction ne dépend pas du nombre de
                documents — contrairement à KNN, qui devrait tous les comparer. Sur des millions
                de documents, la différence n&apos;est pas théorique.
              </p>
              <p>
                Ça échoue quand une catégorie est <em>multimodale</em> : « sport » qui contient
                à la fois des articles d&apos;échecs et de rugby a un centroïde situé au milieu,
                c&apos;est-à-dire nulle part.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}
