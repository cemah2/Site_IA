"use client";

import * as React from "react";
import { PageShell, SectionTitle, Workbench } from "@/components/layout/PageShell";
import { Callout, cx, Divider, Panel, Slider, Stat, Toggle } from "@/components/ui";
import { Levels } from "@/components/ui/Levels";
import { LiveFormula, Tex } from "@/components/math/Math";
import { DataPlot, EditHints } from "@/components/viz/DataPlot";
import { ClassLegend, ClassMark } from "@/components/viz/Legend";
import { MiniField } from "@/components/viz/MiniField";
import { TreeDiagram } from "@/components/viz/TreeDiagram";
import { DatasetControls } from "@/components/lab/DatasetControls";
import { computeField } from "@/lib/ml/field";
import { evaluate } from "@/lib/ml/metrics";
import { RandomForest } from "@/lib/ml/models/random-forest";
import { DecisionTree } from "@/lib/ml/models/decision-tree";
import { formatNumber, formatPercent } from "@/lib/viz/geometry";
import { classColor, CHROME } from "@/lib/viz/palette";
import { useLab } from "@/store/lab";

export function RandomForestLab() {
  const { dataset, setDataset, seed } = useLab();
  const [nTrees, setNTrees] = React.useState(9);
  const [maxDepth, setMaxDepth] = React.useState(4);
  const [featureSubsampling, setFeatureSubsampling] = React.useState(true);
  const [query, setQuery] = React.useState<[number, number]>([0.3, 0.2]);
  const [openTree, setOpenTree] = React.useState<number | null>(null);

  const nClasses = dataset.classNames.length;

  const forest = React.useMemo(
    () =>
      new RandomForest(dataset.samples, nClasses, {
        nTrees,
        maxDepth,
        minSamplesLeaf: 2,
        criterion: "gini",
        maxFeatures: featureSubsampling ? 1 : 2,
        seed,
        bagFraction: 0.8,
      }),
    [dataset.samples, nClasses, nTrees, maxDepth, featureSubsampling, seed],
  );

  // The single tree of the same depth, for the side-by-side that makes the
  // ensemble's value concrete rather than asserted.
  const single = React.useMemo(
    () =>
      new DecisionTree(dataset.samples, nClasses, {
        maxDepth,
        minSamplesLeaf: 2,
        criterion: "gini",
      }),
    [dataset.samples, nClasses, maxDepth],
  );

  const deferred = React.useDeferredValue(forest);
  const field = React.useMemo(
    () => computeField(deferred, dataset.domain, 100),
    [deferred, dataset.domain],
  );

  const detail = forest.detail(query);
  const evalForest = React.useMemo(
    () => evaluate(forest, dataset.samples, dataset.classNames),
    [forest, dataset],
  );
  const evalSingle = React.useMemo(
    () => evaluate(single, dataset.samples, dataset.classNames),
    [single, dataset],
  );

  const openNode = openTree !== null ? forest.trees[openTree] : null;

  return (
    <PageShell
      eyebrow="Classification"
      title="Random Forest"
      lede={
        <>
          Un seul arbre est instable : changez quelques points et sa structure entière bascule.
          Random Forest transforme ce défaut en méthode — entraîner beaucoup d&apos;arbres{" "}
          <strong>délibérément différents</strong>, puis voter. Ce n&apos;est pas la qualité des
          arbres qui fait la performance, c&apos;est leur <strong>désaccord</strong>.
        </>
      }
      wide
    >
      <Workbench
        plot={
          <div className="space-y-5">
            <Panel
              title="Chaque arbre voit le problème autrement"
              subtitle={`${nTrees} arbres, chacun entraîné sur son propre tirage des données. Cliquez pour ouvrir un arbre.`}
              bodyClassName="p-3"
              action={
                <ClassLegend
                  classNames={dataset.classNames}
                  counts={dataset.classNames.map(
                    (_, i) => dataset.samples.filter((s) => s.y === i).length,
                  )}
                />
              }
            >
              <div className="flex flex-wrap gap-2.5">
                {forest.trees.map((tree, i) => {
                  const vote = detail.votes[i];
                  return (
                    <MiniField
                      key={i}
                      model={tree}
                      dataset={dataset}
                      size={104}
                      res={40}
                      highlight={query}
                      onClick={() => setOpenTree(openTree === i ? null : i)}
                      label={
                        <span
                          className={cx(
                            "flex items-center gap-1",
                            openTree === i && "font-semibold text-ink",
                          )}
                        >
                          <ClassMark index={vote.prediction} size={8} />
                          Arbre {i + 1} → {dataset.classNames[vote.prediction]}
                        </span>
                      }
                    />
                  );
                })}
              </div>
            </Panel>

            {openNode !== null && openTree !== null && (
              <Panel
                title={`Arbre ${openTree + 1}`}
                subtitle={`Entraîné sur ${new Set(forest.bags[openTree]).size} points distincts, tirés avec remise parmi ${dataset.samples.length}.`}
                bodyClassName="p-3"
              >
                <TreeDiagram
                  root={openNode.root}
                  classNames={dataset.classNames}
                  pathIds={new Set(openNode.path(query).map((n) => n.id))}
                />
              </Panel>
            )}

            <Panel
              title="Le vote, et le résultat"
              subtitle="À gauche, l'arbre seul. À droite, la forêt. Cliquez dans un graphique pour déplacer le point à classer."
              bodyClassName="p-3"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="mb-2 text-[11px] font-medium text-ink-2">
                    Un seul arbre — {formatPercent(evalSingle.accuracy, 1)}
                  </p>
                  <MiniField
                    model={single}
                    dataset={dataset}
                    size={260}
                    res={90}
                    highlight={query}
                  />
                </div>
                <div>
                  <p className="mb-2 text-[11px] font-medium text-ink-2">
                    La forêt — {formatPercent(evalForest.accuracy, 1)}
                  </p>
                  <DataPlot
                    dataset={dataset}
                    onChange={setDataset}
                    field={field}
                    mode="edit"
                    aspect={1}
                    maxWidth={340}
                    onQuery={(x, y) => setQuery([x, y])}
                    topOverlay={(frame) => (
                      <g clipPath="url(#plot-clip)">
                        <circle
                          cx={frame.px(query[0], query[1])[0]}
                          cy={frame.px(query[0], query[1])[1]}
                          r={8}
                          fill={CHROME.surface1}
                          stroke={classColor(detail.predicted)}
                          strokeWidth={2.5}
                        />
                        <circle
                          cx={frame.px(query[0], query[1])[0]}
                          cy={frame.px(query[0], query[1])[1]}
                          r={2.5}
                          fill={CHROME.ink}
                        />
                      </g>
                    )}
                  />
                </div>
              </div>
              <EditHints />
            </Panel>
          </div>
        }
        controls={
          <>
            <Slider
              label="Nombre d'arbres"
              value={nTrees}
              min={1}
              max={24}
              onChange={setNTrees}
              hint="Ajouter des arbres ne fait jamais surapprendre — mais le gain sature vite. Regardez l'accord ci-dessous se stabiliser."
            />
            <Slider
              label="Profondeur de chaque arbre"
              value={maxDepth}
              min={1}
              max={8}
              onChange={setMaxDepth}
              hint="Des arbres profonds surapprennent individuellement. Le vote corrige une bonne partie de leurs erreurs, tant qu'elles ne sont pas les mêmes."
            />
            <Toggle
              label="Tirer les features par coupure"
              checked={featureSubsampling}
              onChange={setFeatureSubsampling}
              hint="Chaque coupure ne considère qu'une feature sur deux. Sans ça, tous les arbres choisissent presque la même racine et se ressemblent."
            />
            <Divider label="Données" />
            <DatasetControls />
          </>
        }
        below={
          <>
            <Panel title="Le vote" subtitle={`Point (${formatNumber(query[0])} ; ${formatNumber(query[1])})`}>
              <div className="mb-3 flex flex-wrap gap-1">
                {detail.votes.map((v) => (
                  <span
                    key={v.treeIndex}
                    title={`Arbre ${v.treeIndex + 1} → ${dataset.classNames[v.prediction]}`}
                    className="flex h-6 w-6 items-center justify-center rounded border border-line text-[9px] font-semibold"
                    style={{
                      background: `${classColor(v.prediction)}33`,
                      color: classColor(v.prediction),
                    }}
                  >
                    {dataset.classNames[v.prediction]}
                  </span>
                ))}
              </div>

              <ul className="space-y-1.5">
                {dataset.classNames.map((name, c) => (
                  <li key={name} className="flex items-center gap-2">
                    <ClassMark index={c} />
                    <span className="w-12 shrink-0 text-[11px] text-ink-2">{name}</span>
                    <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                      <span
                        className="absolute inset-y-0 left-0 rounded-full transition-all duration-200"
                        style={{
                          width: `${(detail.tally[c] / (nTrees || 1)) * 100}%`,
                          background: classColor(c),
                          opacity: detail.predicted === c ? 1 : 0.45,
                        }}
                      />
                    </span>
                    <span className="tnum w-14 shrink-0 text-right text-xs font-semibold text-ink">
                      {detail.tally[c]} / {nTrees}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex items-center gap-2 rounded-lg border border-line bg-surface-2/60 px-3 py-2">
                <ClassMark index={detail.predicted} size={13} />
                <span className="text-[13px] text-ink-2">
                  Majorité →{" "}
                  <strong className="text-ink">
                    classe {dataset.classNames[detail.predicted]}
                  </strong>{" "}
                  ({formatPercent(detail.agreement, 0)} d&apos;accord)
                </span>
              </div>
            </Panel>

            <div className="grid grid-cols-2 gap-2">
              <Stat
                label="Forêt"
                value={formatPercent(evalForest.accuracy)}
                tone={evalForest.accuracy >= evalSingle.accuracy ? "good" : "warning"}
              />
              <Stat
                label="Arbre seul"
                value={formatPercent(evalSingle.accuracy)}
                hint="Même profondeur, toutes les données"
              />
            </div>

            <Callout kind="note">
              Ces deux chiffres sont mesurés sur les données d&apos;entraînement, donc ils
              sous-estiment l&apos;écart réel : c&apos;est justement{" "}
              <em>sur des données nouvelles</em> que la forêt creuse l&apos;écart. La page{" "}
              <a href="/comparaison/">Comparer les algorithmes</a> fait la mesure honnête, sur
              un jeu de test.
            </Callout>
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
                Vous voulez estimer le nombre de billes dans un bocal. Demandez à une seule
                personne : sa réponse sera probablement loin. Demandez à cent personnes et
                faites la moyenne : le résultat est souvent étonnamment précis.
              </p>
              <p>
                Ça ne marche qu&apos;à une condition : que les erreurs des uns et des autres ne
                soient pas <strong>les mêmes</strong>. Si tout le monde a regardé sous le même
                angle et sous-estimé de la même façon, la moyenne sous-estime aussi.
              </p>
              <p>
                D&apos;où les deux astuces de Random Forest, qui ne servent qu&apos;à{" "}
                <strong>forcer les arbres à se tromper différemment</strong> : chaque arbre ne
                voit qu&apos;un tirage des données, et chaque question n&apos;a le droit de
                considérer qu&apos;une partie des features.
              </p>
              <p>
                Décochez « Tirer les features par coupure » : les arbres se mettent à se
                ressembler énormément, et l&apos;ensemble perd son intérêt.
              </p>
            </>
          }
          technique={
            <>
              <p>
                Random Forest combine deux sources de diversité. Le{" "}
                <strong>bagging</strong> (bootstrap aggregating) : chaque arbre est entraîné sur
                un tirage avec remise du jeu d&apos;entraînement. Le{" "}
                <strong>tirage de features</strong> : à chaque coupure, seul un sous-ensemble
                aléatoire de features est considéré — typiquement{" "}
                <Tex>{String.raw`\sqrt{d}`}</Tex> pour la classification.
              </p>
              <p>
                Le second est ce qui distingue une forêt aléatoire d&apos;un simple bagging
                d&apos;arbres. Sans lui, s&apos;il existe une feature très prédictive, presque
                tous les arbres la choisissent comme racine et deviennent fortement corrélés —
                ce qui annule le bénéfice de la moyenne.
              </p>
              <p>
                <strong>Ajouter des arbres ne fait pas surapprendre.</strong> C&apos;est une
                propriété remarquable et contre-intuitive : l&apos;erreur converge vers une
                limite quand <Tex>T \to \infty</Tex> au lieu de se dégrader. Plus d&apos;arbres
                coûte du temps de calcul, jamais de la généralisation.
              </p>
              <p>
                <strong>Erreur out-of-bag.</strong> Comme chaque arbre ne voit qu&apos;environ
                63 % des données, les 37 % restants forment un jeu de validation gratuit,
                différent pour chaque arbre. C&apos;est une estimation d&apos;erreur en
                généralisation sans avoir à mettre de données de côté.
              </p>
            </>
          }
          maths={
            <>
              <p>La prédiction par vote majoritaire dur :</p>
              <LiveFormula
                tex={String.raw`\hat{y}(x) = \arg\max_{c} \sum_{t=1}^{T} \mathbb{1}\bigl[\, h_t(x) = c \,\bigr]`}
              />
              <p>Par vote souple (celui utilisé pour la surface affichée) :</p>
              <LiveFormula
                tex={String.raw`\hat{y}(x) = \arg\max_{c} \; \frac{1}{T} \sum_{t=1}^{T} \hat{p}_t(c \mid x)`}
              />
              <p>
                <strong>Pourquoi la moyenne aide, en une formule.</strong> Pour{" "}
                <Tex>T</Tex> prédicteurs de variance <Tex>{String.raw`\sigma^2`}</Tex> et de
                corrélation deux à deux <Tex>{String.raw`\rho`}</Tex>, la variance de leur
                moyenne vaut :
              </p>
              <LiveFormula
                tex={String.raw`\mathrm{Var}\!\left(\frac{1}{T}\sum_t h_t\right)
                  = \rho\,\sigma^2 \;+\; \frac{1 - \rho}{T}\,\sigma^2`}
              />
              <p>
                Le second terme tend vers 0 quand <Tex>T</Tex> grandit : voilà le bénéfice
                direct du nombre d&apos;arbres. Mais le premier terme,{" "}
                <Tex>{String.raw`\rho\sigma^2`}</Tex>, <strong>ne dépend pas de <Tex>T</Tex></strong> :
                c&apos;est un plancher fixé par la corrélation entre arbres.
              </p>
              <p>
                Cette équation est toute la stratégie de Random Forest. Ajouter des arbres
                s&apos;attaque au second terme et sature. Réduire{" "}
                <Tex>{String.raw`\rho`}</Tex> — par le bagging et le tirage de features —
                s&apos;attaque au plancher lui-même. C&apos;est pourquoi la case à cocher
                « Tirer les features » compte davantage que le curseur du nombre d&apos;arbres.
              </p>
              <p>
                <strong>Les 63 %.</strong> La probabilité qu&apos;un point donné soit absent
                d&apos;un tirage avec remise de taille <Tex>n</Tex> :
              </p>
              <LiveFormula
                tex={String.raw`\left(1 - \frac{1}{n}\right)^{n} \;\xrightarrow[n \to \infty]{}\; e^{-1} \approx 0{,}368`}
              />
            </>
          }
        />

        <div className="space-y-4">
          <Callout kind="insight" title="L'expérience qui montre tout">
            Mettez <strong>1 seul arbre</strong> et une profondeur de 7. Regardez la surface :
            des régions fines et biscornues, du surapprentissage manifeste.
            <br />
            <br />
            Montez à <strong>24 arbres</strong>, même profondeur. Chaque arbre surapprend
            toujours autant — ouvrez-en un pour le vérifier — mais la surface agrégée devient
            lisse. Les erreurs individuelles ne se sont pas corrigées : elles se sont{" "}
            <em>annulées</em>.
          </Callout>

          <Callout kind="warning" title="Ce que la forêt vous fait perdre">
            Un arbre seul se lit. Vingt-quatre arbres qui votent ne se lisent pas. Random Forest
            échange l&apos;interprétabilité contre la performance — et cet échange n&apos;est pas
            toujours acceptable : dans un contexte où une décision doit être justifiée, un arbre
            court moins performant peut rester le bon choix.
          </Callout>

          <Panel title="Cas pratiques" subtitle="Le couteau suisse des données tabulaires">
            <div className="prose-lab">
              <p>
                <strong>Données tabulaires, en général.</strong> Random Forest et les méthodes
                de boosting apparentées restent des choix par défaut très solides sur des
                tableaux de features hétérogènes — là où les réseaux de neurones n&apos;apportent
                souvent rien de plus, pour bien plus de réglages.
              </p>
              <p>
                <strong>Importance des features.</strong> En mesurant combien chaque feature
                réduit l&apos;impureté à travers toute la forêt, on obtient un classement des
                variables. Très utilisé comme outil d&apos;exploration — à manier prudemment :
                cette mesure surévalue les variables à beaucoup de modalités.
              </p>
              <p>
                <strong>Télédétection et imagerie satellite.</strong> Classer chaque pixel
                (forêt, eau, urbain) à partir de canaux spectraux. Beaucoup de features
                corrélées, du bruit, pas de structure spatiale exploitée : un terrain où les
                forêts excellent.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}
