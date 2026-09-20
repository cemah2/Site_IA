"use client";

import * as React from "react";
import { PageShell, SectionTitle, Workbench } from "@/components/layout/PageShell";
import { Button, Callout, cx, Divider, Panel, Segmented, Slider, Stat } from "@/components/ui";
import { Levels } from "@/components/ui/Levels";
import { LiveFormula, Tex } from "@/components/math/Math";
import { DataPlot, EditHints } from "@/components/viz/DataPlot";
import { ClassLegend, ClassMark } from "@/components/viz/Legend";
import { TreeDiagram } from "@/components/viz/TreeDiagram";
import { DatasetControls } from "@/components/lab/DatasetControls";
import { computeField } from "@/lib/ml/field";
import { evaluate } from "@/lib/ml/metrics";
import {
  DecisionTree,
  countNodes,
  type Criterion,
  type TreeNode,
} from "@/lib/ml/models/decision-tree";
import { formatNumber, formatPercent } from "@/lib/viz/geometry";
import { classColor, CHROME, withAlpha } from "@/lib/viz/palette";
import { useLab } from "@/store/lab";

export function DecisionTreeLab() {
  const { dataset, setDataset } = useLab();
  const [maxDepth, setMaxDepth] = React.useState(3);
  const [minSamplesLeaf, setMinSamplesLeaf] = React.useState(4);
  const [criterion, setCriterion] = React.useState<Criterion>("gini");
  const [selectedId, setSelectedId] = React.useState<number | null>(0);
  const [query, setQuery] = React.useState<[number, number] | null>(null);
  const [walkStep, setWalkStep] = React.useState(0);

  const nClasses = dataset.classNames.length;
  const tree = React.useMemo(
    () =>
      new DecisionTree(dataset.samples, nClasses, {
        maxDepth,
        minSamplesLeaf,
        criterion,
        keepCandidates: true,
      }),
    [dataset.samples, nClasses, maxDepth, minSamplesLeaf, criterion],
  );

  // No deferral here: fitting a shallow tree and sweeping its (piecewise
  // constant) surface costs a couple of milliseconds, and deferring meant the
  // boundary redrew once during a four-second drag instead of following it.
  const field = React.useMemo(
    () => computeField(tree, dataset.domain, 128),
    [tree, dataset.domain],
  );
  const evaluation = React.useMemo(
    () => evaluate(tree, dataset.samples, dataset.classNames),
    [tree, dataset],
  );

  const path = query ? tree.path(query) : [];
  const visible = query ? path.slice(0, walkStep + 1) : [];
  const pathIds = query ? new Set(visible.map((n) => n.id)) : undefined;

  const selected = React.useMemo(() => findNode(tree.root, selectedId), [tree, selectedId]);
  const bestGain = selected?.candidates?.length
    ? Math.max(...selected.candidates.map((c) => c.gain))
    : 0;

  const counts = dataset.classNames.map((_, i) => dataset.samples.filter((s) => s.y === i).length);
  const impurityName = criterion === "gini" ? "Gini" : "Entropie";

  return (
    <PageShell
      eyebrow="Classification"
      title="Arbre de décision"
      lede={
        <>
          Un arbre pose une suite de questions simples — <Tex>{String.raw`x_1 \le 0{,}42\ ?`}</Tex>{" "}
          — et chaque réponse réduit l&apos;incertitude. La vraie question n&apos;est pas
          « comment il classe » mais <strong>« pourquoi cette coupure et pas une
          autre ? »</strong> Cliquez sur un nœud : il a gardé toutes les coupures qu&apos;il a
          envisagées, avec leur gain.
        </>
      }
      wide
    >
      <Workbench
        plot={
          <div className="space-y-5">
            <Panel
              title="L'arbre"
              subtitle="Chaque nœud affiche sa distribution de classes, son effectif et son impureté. Cliquez pour l'inspecter."
              bodyClassName="p-3"
              action={<ClassLegend classNames={dataset.classNames} counts={counts} />}
            >
              <TreeDiagram
                root={tree.root}
                classNames={dataset.classNames}
                selectedId={selectedId}
                onSelect={(n) => setSelectedId(n.id)}
                pathIds={pathIds}
              />
            </Panel>

            <Panel
              title="Le découpage du plan"
              subtitle="Chaque question de l'arbre est un trait perpendiculaire à un axe."
              bodyClassName="p-3"
            >
              <DataPlot
                dataset={dataset}
                onChange={setDataset}
                field={field}
                mode="edit"
                aspect={1}
                maxWidth={560}
                onQuery={(x, y) => {
                  setQuery([x, y]);
                  setWalkStep(0);
                }}
                styleFor={(s) => (evaluation.wrongIds.includes(s.id) ? { wrong: true } : undefined)}
                overlay={(frame) => (
                  <g clipPath="url(#plot-clip)">
                    {/* The region the walkthrough has narrowed down to so far —
                        the geometric meaning of "the path through the tree". */}
                    {query && visible.length > 0 && (() => {
                      const box = regionOf(visible, dataset.domain);
                      const [x0, y1] = frame.px(box[0][0], box[1][1]);
                      const [x1, y0] = frame.px(box[0][1], box[1][0]);
                      return (
                        <rect
                          x={x0}
                          y={y1}
                          width={x1 - x0}
                          height={y0 - y1}
                          fill={withAlpha(CHROME.accent, 0.07)}
                          stroke={CHROME.accent}
                          strokeWidth={1.5}
                          strokeDasharray="5 3"
                        />
                      );
                    })()}
                  </g>
                )}
                topOverlay={(frame) =>
                  query ? (
                    <g clipPath="url(#plot-clip)">
                      <circle
                        cx={frame.px(query[0], query[1])[0]}
                        cy={frame.px(query[0], query[1])[1]}
                        r={8}
                        fill={CHROME.surface1}
                        stroke={classColor(visible.at(-1)?.prediction ?? 0)}
                        strokeWidth={2.5}
                      />
                      <circle
                        cx={frame.px(query[0], query[1])[0]}
                        cy={frame.px(query[0], query[1])[1]}
                        r={2.5}
                        fill={CHROME.ink}
                      />
                    </g>
                  ) : null
                }
              />
              <EditHints />
            </Panel>
          </div>
        }
        controls={
          <>
            <Slider
              label="Profondeur maximale"
              value={maxDepth}
              min={1}
              max={8}
              onChange={setMaxDepth}
              hint={
                maxDepth >= 7
                  ? "Très profond : l'arbre finit par isoler des points individuels. C'est du surapprentissage, visible dans le découpage."
                  : "Combien de questions d'affilée l'arbre a le droit de poser."
              }
            />
            <Slider
              label="Échantillons minimum par feuille"
              value={minSamplesLeaf}
              min={1}
              max={30}
              onChange={setMinSamplesLeaf}
              hint="Interdit les feuilles minuscules. Le garde-fou le plus efficace contre le surapprentissage."
            />
            <Segmented
              label="Mesure d'impureté"
              value={criterion}
              options={[
                { value: "gini", label: "Gini" },
                { value: "entropy", label: "Entropie" },
              ]}
              onChange={(v) => setCriterion(v as Criterion)}
            />
            <Divider label="Prédiction pas à pas" />
            {query ? (
              <>
                <p className="text-[11px] leading-snug text-ink-muted">
                  Point de test ({formatNumber(query[0])} ; {formatNumber(query[1])}) — étape{" "}
                  {walkStep + 1} sur {path.length}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => setWalkStep(Math.max(0, walkStep - 1))}
                    disabled={walkStep === 0}
                  >
                    ←
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    className="flex-1"
                    onClick={() => setWalkStep(Math.min(path.length - 1, walkStep + 1))}
                    disabled={walkStep >= path.length - 1}
                  >
                    Descendre d&apos;un niveau →
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setQuery(null)}>
                    ✕
                  </Button>
                </div>
                <ol className="space-y-1">
                  {visible.map((n, i) => (
                    <li
                      key={n.id}
                      className="rounded-md border border-line bg-surface-2/50 px-2 py-1.5 text-[11px] leading-snug"
                    >
                      {n.feature !== undefined && n.threshold !== undefined ? (
                        <>
                          <span className="tnum text-ink">
                            {n.feature === 0 ? "x₁" : "x₂"} ={" "}
                            {formatNumber(query[n.feature])} ≤ {formatNumber(n.threshold)} ?
                          </span>{" "}
                          <span
                            className="font-semibold"
                            style={{ color: CHROME.accent }}
                          >
                            {query[n.feature] <= n.threshold ? "oui → gauche" : "non → droite"}
                          </span>
                        </>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-ink">
                          Feuille · prédiction
                          <ClassMark index={n.prediction} size={9} />
                          <strong>{dataset.classNames[n.prediction]}</strong>
                        </span>
                      )}
                      {i === 0 && n.feature !== undefined && (
                        <span className="mt-0.5 block text-ink-muted">Racine</span>
                      )}
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <p className="text-[11px] leading-snug text-ink-muted">
                Cliquez dans le graphique du bas pour faire descendre un point dans l&apos;arbre,
                étape par étape.
              </p>
            )}
            <Divider label="Données" />
            <DatasetControls />
          </>
        }
        below={
          <>
            {selected && (
              <Panel
                title={`Nœud ${selected.id}`}
                subtitle={
                  selected.feature !== undefined
                    ? "Pourquoi cette coupure a été choisie"
                    : "Feuille — pourquoi l'arbre s'est arrêté ici"
                }
              >
                <div className="grid grid-cols-2 gap-2">
                  <Stat label="Échantillons" value={selected.nSamples} />
                  <Stat
                    label={impurityName}
                    value={formatNumber(selected.impurity, 3)}
                    hint={selected.impurity === 0 ? "Nœud pur" : undefined}
                  />
                </div>

                <div className="mt-3">
                  <div className="mb-1 text-[11px] text-ink-muted">Distribution</div>
                  <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
                    {selected.counts.map((c, i) =>
                      c ? (
                        <span
                          key={i}
                          style={{
                            width: `${(c / selected.nSamples) * 100}%`,
                            background: classColor(i),
                          }}
                        />
                      ) : null,
                    )}
                  </div>
                  <div className="tnum mt-1 flex flex-wrap gap-x-3 text-[10px] text-ink-muted">
                    {selected.counts.map((c, i) => (
                      <span key={i} className="inline-flex items-center gap-1">
                        <ClassMark index={i} size={8} />
                        {dataset.classNames[i]} : {c}
                      </span>
                    ))}
                  </div>
                </div>

                {selected.stopReason && (
                  <p className="mt-3 rounded-md border border-line bg-surface-2/50 px-2.5 py-2 text-[11px] leading-snug text-ink-2">
                    {selected.stopReason}
                  </p>
                )}

                {selected.feature !== undefined && selected.candidates && (
                  <>
                    <Divider label="Coupures envisagées" />
                    <p className="mb-2 text-[11px] leading-snug text-ink-muted">
                      {selected.candidates.length} coupures ont été évaluées ici. Voici les
                      huit meilleures — la première est celle qui a été retenue.
                    </p>
                    <ul className="space-y-1">
                      {[...selected.candidates]
                        .sort((a, b) => b.gain - a.gain)
                        .slice(0, 8)
                        .map((c, i) => (
                          <li
                            key={`${c.feature}-${c.threshold}`}
                            className={cx(
                              "flex items-center gap-2 rounded-md px-2 py-1",
                              i === 0 && "bg-accent/[0.08] ring-1 ring-accent/30",
                            )}
                          >
                            <span className="tnum w-20 shrink-0 text-[11px] text-ink-2">
                              {c.feature === 0 ? "x₁" : "x₂"} ≤ {formatNumber(c.threshold)}
                            </span>
                            <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                              <span
                                className="absolute inset-y-0 left-0 rounded-full"
                                style={{
                                  width: `${(c.gain / (bestGain || 1)) * 100}%`,
                                  background: i === 0 ? CHROME.accent : CHROME.lineStrong,
                                }}
                              />
                            </span>
                            <span className="tnum w-12 shrink-0 text-right text-[11px] font-semibold text-ink">
                              {c.gain.toFixed(4)}
                            </span>
                          </li>
                        ))}
                    </ul>
                    <LiveFormula
                      className="mt-3"
                      tex={String.raw`\text{gain} = I(\text{parent}) - \frac{n_G}{n} I(G) - \frac{n_D}{n} I(D)`}
                      terms={[
                        {
                          symbol: "I(\\text{parent})",
                          value: formatNumber(selected.impurity, 4),
                        },
                        { symbol: "n", value: selected.nSamples },
                        { symbol: "\\text{gain}", value: formatNumber(selected.gain ?? 0, 4) },
                      ]}
                    />
                  </>
                )}
              </Panel>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Stat
                label="Accuracy"
                value={formatPercent(evaluation.accuracy)}
                tone={evaluation.accuracy > 0.9 ? "good" : "neutral"}
              />
              <Stat label="Feuilles" value={tree.leafCount} hint={`${countNodes(tree.root)} nœuds`} />
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
                C&apos;est un jeu de « Qui est-ce ? ». À chaque tour vous posez une question qui
                élimine le plus de possibilités possible. « Est-ce qu&apos;il porte des
                lunettes ? » est une bonne question si la moitié des personnages en portent —
                elle coupe le jeu en deux. Elle est inutile si un seul en porte.
              </p>
              <p>
                L&apos;arbre fait pareil, en testant toutes les questions possibles et en gardant
                celle qui sépare le mieux. Cette mesure de « à quel point c&apos;est mélangé » est
                l&apos;<strong>impureté</strong>, et la réduction obtenue est le{" "}
                <strong>gain</strong>.
              </p>
              <p>
                Le mot important est <strong>glouton</strong> : l&apos;arbre choisit ce qui a
                l&apos;air le mieux <em>maintenant</em>, sans anticiper. C&apos;est pour ça
                qu&apos;il produit parfois un escalier là où une seule diagonale suffirait — il
                n&apos;a pas le droit de tracer des diagonales, et il ne peut pas se dire
                « acceptons une mauvaise coupure maintenant pour une bien meilleure après ».
              </p>
            </>
          }
          technique={
            <>
              <p>
                L&apos;algorithme est CART. À chaque nœud, il essaie <strong>toutes</strong> les
                paires (feature, seuil) possibles — les seuils candidats étant les milieux entre
                deux valeurs consécutives distinctes — et retient celle de gain maximal. Puis il
                recommence, récursivement, sur chaque moitié.
              </p>
              <p>
                <strong>Gini ou entropie ?</strong> Les deux mesurent le mélange et donnent en
                pratique des arbres très proches. Gini est un peu moins cher (pas de{" "}
                <Tex>{String.raw`\log`}</Tex>) et légèrement plus enclin à isoler la classe
                majoritaire ; l&apos;entropie pénalise un peu plus fort les nœuds équilibrés.
                Basculez entre les deux : la structure change rarement.
              </p>
              <p>
                <strong>Les coupures sont perpendiculaires aux axes.</strong> Un arbre ne peut
                tester que <Tex>{String.raw`x_j \le t`}</Tex>, jamais{" "}
                <Tex>{String.raw`x_1 + x_2 \le t`}</Tex>. Mettez le dataset sur « Séparables
                linéairement » — dont la vraie frontière est une oblique — et regardez
                l&apos;escalier apparaître dans le découpage.
              </p>
              <p>
                <strong>Un arbre non élagué atteint toujours 100 % sur ses données
                d&apos;entraînement</strong> : il lui suffit de continuer à couper jusqu&apos;à
                n&apos;avoir qu&apos;un point par feuille. C&apos;est pourquoi la profondeur
                maximale et le minimum par feuille ne sont pas des réglages de confort mais la
                condition pour que le modèle généralise.
              </p>
            </>
          }
          maths={
            <>
              <p>
                Soit <Tex>p_c</Tex> la proportion de la classe <Tex>c</Tex> dans un nœud. Les
                deux mesures d&apos;impureté :
              </p>
              <LiveFormula
                tex={String.raw`I_{\text{Gini}} = 1 - \sum_{c} p_c^2
                  \qquad\qquad
                  H = -\sum_{c} p_c \log_2 p_c`}
              />
              <p>
                <strong>Ce que Gini signifie vraiment</strong> : c&apos;est la probabilité de se
                tromper si on étiquetait un échantillon du nœud en tirant une classe au hasard
                selon la distribution du nœud. <strong>Ce que l&apos;entropie signifie</strong> :
                le nombre moyen de bits nécessaires pour coder la classe d&apos;un échantillon du
                nœud. Les deux valent 0 sur un nœud pur.
              </p>
              <p>Le gain d&apos;information d&apos;une coupure en deux parties <Tex>G</Tex> et <Tex>D</Tex> :</p>
              <LiveFormula
                tex={String.raw`\text{Gain}(S, j, t) = I(S) \;-\; \frac{|G|}{|S|} I(G) \;-\; \frac{|D|}{|S|} I(D)`}
              />
              <p>
                Les poids <Tex>{String.raw`|G|/|S|`}</Tex> sont essentiels : sans eux, détacher
                un seul point pur donnerait un gain énorme pour une coupure sans intérêt.
              </p>
              <p>Et la coupure retenue :</p>
              <LiveFormula
                tex={String.raw`(j^*, t^*) = \arg\max_{j,\,t} \; \text{Gain}(S, j, t)`}
              />
              <p>
                Le coût d&apos;un nœud est <Tex>{String.raw`O(d \cdot n \log n)`}</Tex> (un tri
                par feature), et l&apos;arbre entier{" "}
                <Tex>{String.raw`O(d \cdot n \log^2 n)`}</Tex> dans le cas équilibré.
              </p>
              <Callout kind="warning" title="Trouver l'arbre optimal est NP-difficile">
                L&apos;approche gloutonne n&apos;est pas un raccourci de confort : chercher
                l&apos;arbre globalement optimal est un problème NP-difficile (Hyafil &amp;
                Rivest, 1976). Tous les arbres que vous rencontrerez en pratique sont des
                approximations gloutonnes.
              </Callout>
            </>
          }
        />

        <div className="space-y-4">
          <Callout kind="insight" title="L'expérience à faire">
            Sélectionnez la <strong>racine</strong> et regardez la liste des coupures
            envisagées. Souvent, la deuxième ou la troisième a un gain presque identique à la
            première. L&apos;arbre a tranché sur une différence minuscule — et tout ce qui suit
            en découle. C&apos;est exactement cette instabilité que{" "}
            <strong>Random Forest</strong> exploite : si le choix tenait à si peu, autant en
            faire plusieurs et voter.
          </Callout>

          <Callout kind="warning" title="Lisible ≠ fiable">
            On vend souvent les arbres comme « interprétables ». Un arbre de profondeur 3 l&apos;est.
            Montez la profondeur à 8 et regardez le diagramme : il reste techniquement lisible,
            mais plus personne ne peut en tirer une règle utile — et il aura appris le bruit.
            L&apos;interprétabilité est une propriété des <em>petits</em> arbres, pas des arbres.
          </Callout>

          <Panel title="Cas pratiques" subtitle="Où la structure en arbre est le bon outil">
            <div className="prose-lab">
              <p>
                <strong>Aide au tri en médecine.</strong> Un arbre court reproduit la logique
                d&apos;un protocole : quelques seuils sur la température, l&apos;âge, la tension.
                Sa valeur tient à ce qu&apos;un praticien peut lire la règle, la contester, et
                repérer un seuil aberrant. Un outil d&apos;aide, jamais de décision : un arbre
                appris sur des données hospitalières reproduit aussi leurs biais de recrutement.
              </p>
              <p>
                <strong>Scoring et segmentation client.</strong> « Ancienneté &gt; 2 ans et panier
                moyen &gt; 60 € » est une règle qu&apos;une équipe métier peut appliquer sans
                machine. C&apos;est souvent ça qu&apos;on cherche : pas la meilleure accuracy,
                mais une règle transmissible.
              </p>
              <p>
                <strong>Détection de risque industriel.</strong> Les arbres gèrent nativement les
                features mixtes (numériques et catégorielles) et les valeurs manquantes, sans
                normalisation préalable — un avantage pratique considérable sur des données
                capteurs hétérogènes.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}

function findNode(root: TreeNode, id: number | null): TreeNode | null {
  if (id === null) return null;
  if (root.id === id) return root;
  return (
    (root.left ? findNode(root.left, id) : null) ??
    (root.right ? findNode(root.right, id) : null)
  );
}

/**
 * The axis-aligned box a path through the tree has narrowed down to.
 *
 * This is what "descending the tree" means geometrically: every answered
 * question clips one side off the region still under consideration.
 */
function regionOf(path: TreeNode[], domain: [number, number][]): [number, number][] {
  const box: [number, number][] = [[...domain[0]], [...domain[1]]];
  for (let i = 0; i < path.length - 1; i++) {
    const node = path[i];
    if (node.feature === undefined || node.threshold === undefined) break;
    const wentLeft = path[i + 1].id === node.left?.id;
    const f = node.feature;
    if (wentLeft) box[f][1] = Math.min(box[f][1], node.threshold);
    else box[f][0] = Math.max(box[f][0], node.threshold);
  }
  return box;
}
