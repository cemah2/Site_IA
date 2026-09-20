"use client";

import * as React from "react";
import { PageShell, SectionTitle, Workbench } from "@/components/layout/PageShell";
import { Callout, cx, Divider, Panel, Slider, Stat, Toggle } from "@/components/ui";
import { Tex } from "@/components/math/Math";
import { G } from "@/components/ui/Glossary";
import { Quiz } from "@/components/lab/Quiz";
import { ConfusionMatrix } from "@/components/viz/ConfusionMatrix";
import { DataPlot, EditHints } from "@/components/viz/DataPlot";
import { ClassLegend } from "@/components/viz/Legend";
import { MiniField } from "@/components/viz/MiniField";
import { DatasetControls } from "@/components/lab/DatasetControls";
import { computeField } from "@/lib/ml/field";
import { splitDataset } from "@/lib/ml/datasets";
import { evaluate, type Evaluation } from "@/lib/ml/metrics";
import { ALGO_ORDER, ALGOS, DEFAULT_PARAMS, fitModel, type AlgoId } from "@/lib/ml/registry";
import type { Classifier } from "@/lib/ml/types";
import { formatPercent } from "@/lib/viz/geometry";
import { CHROME } from "@/lib/viz/palette";
import { useLab } from "@/store/lab";

interface Row {
  id: AlgoId;
  model: Classifier;
  evaluation: Evaluation;
  trainMs: number;
  parameters: number;
}

export function CompareLab() {
  const { dataset, setDataset, trainRatio, setTrainRatio } = useLab();
  const [focus, setFocus] = React.useState<AlgoId>("knn");
  const [cell, setCell] = React.useState<{ trueClass: number; predicted: number } | null>(null);
  const [onTest, setOnTest] = React.useState(true);

  const nClasses = dataset.classNames.length;
  const split = React.useMemo(
    () => splitDataset(dataset, trainRatio, 2024),
    [dataset, trainRatio],
  );

  const deferredSplit = React.useDeferredValue(split);
  const evalSet = onTest && deferredSplit.test.length ? deferredSplit.test : deferredSplit.train;

  const rows = React.useMemo<Row[]>(() => {
    if (!deferredSplit.train.length) return [];
    return ALGO_ORDER.map((id) => {
      const { model, trainMs, parameters } = fitModel(
        id,
        deferredSplit.train,
        nClasses,
        DEFAULT_PARAMS,
      );
      return {
        id,
        model,
        trainMs,
        parameters,
        evaluation: evaluate(model, evalSet, dataset.classNames),
      };
    });
  }, [deferredSplit, evalSet, nClasses, dataset.classNames]);

  const focused = rows.find((r) => r.id === focus) ?? rows[0];
  const focusedField = React.useMemo(
    () => (focused ? computeField(focused.model, dataset.domain, 92) : null),
    [focused, dataset.domain],
  );

  // Points sitting in the selected confusion cell: the answer to "show me the
  // ones it got wrong in this particular way".
  const cellIds = React.useMemo(() => {
    if (!cell || !focused) return null;
    const ids = new Set<number>();
    for (const s of evalSet) {
      if (s.y === cell.trueClass && focused.model.predict(s.x) === cell.predicted) ids.add(s.id);
    }
    return ids;
  }, [cell, focused, evalSet]);

  const best = rows.length
    ? rows.reduce((a, b) => (b.evaluation.accuracy > a.evaluation.accuracy ? b : a))
    : null;
  const testIds = React.useMemo(
    () => new Set(deferredSplit.test.map((s) => s.id)),
    [deferredSplit],
  );

  return (
    <PageShell
      eyebrow="Laboratoire"
      title="Comparer les algorithmes"
      lede={
        <>
          Même dataset, même découpage entraînement / test, même code d&apos;évaluation. Seul
          l&apos;algorithme change. C&apos;est la seule façon honnête de comparer — et ce que
          ça montre surtout, c&apos;est à quel point{" "}
          <strong>des modèles différents inventent des explications différentes des mêmes
          points</strong>.
        </>
      }
      wide
    >
      <Workbench
        plot={
          <div className="space-y-5">
            <Panel
              title={`${ALGO_ORDER.length} façons de découper le même plan`}
              exportName="comparaison-modeles"
              subtitle="Chaque vignette est un modèle entraîné sur les mêmes points. Cliquez pour l'examiner."
              bodyClassName="p-3"
              action={<ClassLegend classNames={dataset.classNames} />}
            >
              <div className="flex flex-wrap gap-3">
                {rows.map((row) => (
                  <MiniField
                    key={row.id}
                    model={row.model}
                    dataset={dataset}
                    size={128}
                    res={48}
                    onClick={() => {
                      setFocus(row.id);
                      setCell(null);
                    }}
                    label={
                      <span
                        className={cx(
                          "block",
                          focus === row.id ? "font-semibold text-ink" : "text-ink-muted",
                        )}
                      >
                        {ALGOS[row.id].label}
                        <span className="tnum ml-1">
                          {formatPercent(row.evaluation.accuracy, 0)}
                        </span>
                      </span>
                    }
                  />
                ))}
              </div>
            </Panel>

            {focused && (
              <Panel
                title={ALGOS[focused.id].label}
                subtitle={ALGOS[focused.id].assumption}
                bodyClassName="p-3"
                action={
                  <a
                    href={ALGOS[focused.id].href}
                    className="text-[12px] font-medium text-accent hover:underline"
                  >
                    Page détaillée →
                  </a>
                }
              >
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto]">
                  <div>
                  <DataPlot
                    dataset={dataset}
                    onChange={setDataset}
                    mode="edit"
                    field={focusedField}
                    aspect={1}
                    maxWidth={420}
                    styleFor={(s) => {
                      if (cellIds) {
                        return cellIds.has(s.id)
                          ? { ring: CHROME.accent, scale: 1.25 }
                          : { dim: true };
                      }
                      if (onTest && !testIds.has(s.id)) return { dim: true };
                      if (focused.evaluation.wrongIds.includes(s.id)) return { wrong: true };
                      return undefined;
                    }}
                  />
                    <EditHints />
                    <p className="mt-1.5 text-[11px] leading-snug text-ink-2">
                      Déplacez un point et regardez les six vignettes du haut réagir
                      simultanément : certaines frontières se tordent pour le rattraper,
                      d&apos;autres ne bougent pas du tout. C&apos;est la comparaison la plus
                      parlante de la page.
                    </p>
                  </div>
                  <div className="space-y-4">
                    <ConfusionMatrix
                      matrix={focused.evaluation.matrix}
                      classNames={dataset.classNames}
                      selected={cell}
                      onSelect={setCell}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Stat
                        label="Accuracy"
                        value={formatPercent(focused.evaluation.accuracy)}
                        tone={
                          focused.evaluation.accuracy >= (best?.evaluation.accuracy ?? 1) - 1e-9
                            ? "good"
                            : "neutral"
                        }
                      />
                      <Stat
                        label="Baseline"
                        value={formatPercent(focused.evaluation.baseline)}
                        hint="Toujours répondre la classe majoritaire"
                      />
                    </div>
                  </div>
                </div>
                {cellIds && (
                  <p className="mt-2 text-[11px] text-ink-2">
                    {cellIds.size} point{cellIds.size > 1 ? "s" : ""} mis en évidence :
                    des <strong>{dataset.classNames[cell!.trueClass]}</strong> que ce modèle
                    prend pour des <strong>{dataset.classNames[cell!.predicted]}</strong>.
                  </p>
                )}
              </Panel>
            )}

            <Panel
              title="Le tableau complet"
              subtitle={`Évalué sur ${onTest ? `${deferredSplit.test.length} points de test` : `${deferredSplit.train.length} points d'entraînement`}`}
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-[12px]">
                  <thead className="text-ink-muted">
                    <tr className="border-b border-line">
                      <th className="pb-2 text-left font-medium">Algorithme</th>
                      <th className="pb-2 text-right font-medium">Accuracy</th>
                      <th className="pb-2 text-right font-medium">F1 moyen</th>
                      <th className="pb-2 text-right font-medium">Entraînement</th>
                      <th className="pb-2 text-right font-medium">Paramètres</th>
                      <th className="pb-2 text-left font-medium">Coût d&apos;une prédiction</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...rows]
                      .sort((a, b) => b.evaluation.accuracy - a.evaluation.accuracy)
                      .map((row) => {
                        const f1 =
                          row.evaluation.perClass.reduce((a, c) => a + c.f1, 0) /
                          (row.evaluation.perClass.length || 1);
                        return (
                          <tr
                            key={row.id}
                            onClick={() => {
                              setFocus(row.id);
                              setCell(null);
                            }}
                            className={cx(
                              "cursor-pointer border-b border-line/50 transition-colors hover:bg-surface-2/50",
                              focus === row.id && "bg-surface-2/70",
                            )}
                          >
                            <td className="py-2 font-medium text-ink">{ALGOS[row.id].label}</td>
                            <td className="tnum py-2 text-right">
                              <span className="inline-flex items-center gap-2">
                                <span className="relative hidden h-1.5 w-16 overflow-hidden rounded-full bg-surface-3 sm:block">
                                  <span
                                    className="absolute inset-y-0 left-0 rounded-full"
                                    style={{
                                      width: `${row.evaluation.accuracy * 100}%`,
                                      background:
                                        row.id === best?.id ? CHROME.accent : CHROME.lineStrong,
                                    }}
                                  />
                                </span>
                                <span className="font-semibold text-ink">
                                  {formatPercent(row.evaluation.accuracy)}
                                </span>
                              </span>
                            </td>
                            <td className="tnum py-2 text-right text-ink-2">{f1.toFixed(3)}</td>
                            <td className="tnum py-2 text-right text-ink-2">
                              {row.trainMs.toFixed(1)} ms
                            </td>
                            <td className="tnum py-2 text-right text-ink-2">{row.parameters}</td>
                            <td className="py-2 text-ink-muted">{ALGOS[row.id].predictCost}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
              <p className="mt-2.5 text-[11px] leading-snug text-ink-muted">
                Les temps sont mesurés réellement, dans votre navigateur, à l&apos;instant.
                Ils varient d&apos;un rafraîchissement à l&apos;autre — ce sont des ordres de
                grandeur, pas des références.
              </p>
            </Panel>
          </div>
        }
        controls={
          <>
            <Toggle
              label="Évaluer sur le jeu de test"
              checked={onTest}
              onChange={(v) => {
                setOnTest(v);
                setCell(null);
              }}
              hint="Décochez pour évaluer sur les données d'entraînement — et voir KNN afficher 100 %, ce qui ne veut rien dire."
            />
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
            <Divider label="Données" />
            <DatasetControls />
            <Divider />
            <p className="text-[11px] leading-snug text-ink-muted">
              Les hyperparamètres sont fixés à leurs valeurs par défaut pour que la comparaison
              soit reproductible. Pour les régler, allez au{" "}
              <a href="/playground/">Playground</a>.
            </p>
          </>
        }
        below={
          <>
            {best && (
              <Callout kind="insight" title={`Ici, ${ALGOS[best.id].label} gagne`}>
                {formatPercent(best.evaluation.accuracy)} sur le jeu{" "}
                {onTest ? "de test" : "d'entraînement"}. Changez de dataset : le classement
                change. Il n&apos;existe pas de meilleur algorithme — seulement des hypothèses
                qui collent, ou pas, à la forme des données.
              </Callout>
            )}

            <Panel title="Ce que chaque modèle suppose" subtitle="La vraie différence entre eux">
              <ul className="space-y-2">
                {ALGO_ORDER.map((id) => (
                  <li key={id} className="text-[11px] leading-snug">
                    <span className="font-semibold text-ink">{ALGOS[id].label}</span>
                    <span className="block text-ink-muted">{ALGOS[id].assumption}</span>
                  </li>
                ))}
              </ul>
            </Panel>

            <Callout kind="warning" title="Accuracy seule : un mauvais juge">
              Prenez le dataset <strong>« Classes déséquilibrées »</strong> (90 % / 10 %).
              Un modèle qui répond toujours la classe majoritaire obtient 90 %, et la colonne
              « Baseline » l&apos;affiche. Regardez alors la matrice de confusion : une ligne
              entière est vide. Le F1 moyen, lui, s&apos;effondre — c&apos;est pour ça
              qu&apos;il est dans le tableau.
            </Callout>
          </>
        }
      />

      <SectionTitle hint="Pourquoi la réponse n'est jamais « le meilleur algorithme ».">
        Le théorème du No Free Lunch
      </SectionTitle>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="L'énoncé">
          <div className="prose-lab">
            <p>
              Wolpert et Macready ont démontré en 1997 un résultat qui rend la question
              « quel est le meilleur algorithme ? » mal posée :{" "}
              <strong>moyennés sur tous les problèmes possibles, deux algorithmes
              d&apos;apprentissage ont exactement la même performance</strong>.
            </p>
            <p>
              Y compris l&apos;algorithme qui répond au hasard. Toute supériorité d&apos;une
              méthode sur un problème est exactement compensée par son infériorité sur un autre.
            </p>
            <p>
              Ce n&apos;est pas du relativisme : ça dit que la performance d&apos;un modèle ne
              vient pas du modèle, mais de{" "}
              <strong>l&apos;adéquation entre ses hypothèses et la structure réelle des
              données</strong>. Nearest Centroid suppose des nuages ronds. Sur des nuages ronds,
              il gagne. Sur des spirales, il perd — et aucun réglage ne le sauvera.
            </p>
            <p>
              La question utile n&apos;est donc jamais « quel algorithme ? » mais{" "}
              <strong>« que sais-je de la forme de mes données ? »</strong>
            </p>
          </div>
        </Panel>

        <Panel title="À vérifier vous-même">
          <div className="prose-lab">
            <p>
              <strong>Clusters gaussiens.</strong> Presque tout marche, y compris Nearest
              Centroid — le modèle le plus pauvre du lot. Un problème facile ne départage rien.
            </p>
            <p>
              <strong>Cercles concentriques.</strong> Nearest Centroid et un SVM linéaire
              s&apos;effondrent vers 50 %. KNN et le SVM à noyau RBF montent à ~100 %. La
              différence n&apos;est pas la puissance : c&apos;est que les premiers ne peuvent
              produire que des frontières droites.
            </p>
            <p>
              <strong>Spirales à 3 classes.</strong> Seuls les modèles à forte capacité — KNN
              avec un petit <Tex>K</Tex>, Random Forest, le réseau de neurones — suivent. Les
              arbres y produisent un escalier caractéristique.
            </p>
            <p>
              <strong>Classes qui se recouvrent.</strong> Personne ne dépasse ~85 %, et
              c&apos;est normal : les classes se chevauchent vraiment. Une partie de
              l&apos;erreur est <em>irréductible</em>, et un modèle qui afficherait 100 %
              n&apos;aurait fait que mémoriser le bruit.
            </p>
          </div>
        </Panel>

        <Quiz
          questions={[
            {
              id: "cp1",
              question:
                "Deux modèles affichent 88,0 % et 88,9 % sur le même jeu de test de 48 points. Lequel est meilleur ?",
              options: [
                { id: "a", label: "Le second, clairement" },
                {
                  id: "b",
                  label:
                    "Rien ne permet de trancher : 0,9 point sur 48 points, c'est moins d'un demi-point de données",
                },
                { id: "c", label: "Le premier, parce qu'il est plus simple" },
              ],
              answer: 1,
              explanation: (
                <>
                  Sur 48 points, une seule prédiction vaut 2,1 points d&apos;accuracy. Un écart
                  plus petit que ça ne veut rien dire. C&apos;est exactement ce que la{" "}
                  <a href="/concepts/validation-croisee/">validation croisée</a> permet de
                  chiffrer : elle donne une dispersion, donc un seuil en dessous duquel il faut
                  se taire.
                </>
              ),
            },
            {
              id: "cp2",
              question:
                "Le temps d'entraînement de KNN est quasi nul, mais son coût de prédiction est le plus élevé. Pourquoi ?",
              options: [
                {
                  id: "a",
                  label:
                    "Parce qu'il ne fait rien à l'entraînement : tout le travail — comparer au dataset entier — arrive au moment de répondre",
                },
                { id: "b", label: "Parce qu'il recalcule ses paramètres à chaque requête" },
                { id: "c", label: "Parce que sa frontière est complexe à évaluer" },
              ],
              answer: 0,
              explanation: (
                <>
                  <G t="knn">KNN</G> est le cas extrême du modèle « paresseux » : le{" "}
                  <G t="modele">modèle</G> <em>est</em> le jeu de données. À l&apos;autre bout,
                  un réseau de neurones met longtemps à s&apos;entraîner puis répond en quelques
                  multiplications. La colonne « coût de prédiction » de ce tableau est souvent
                  celle qui décide en production.
                </>
              ),
            },
            {
              id: "cp3",
              question:
                "Sur « Classes qui se recouvrent », aucun modèle ne dépasse 85 %. Que faut-il en conclure ?",
              options: [
                { id: "a", label: "Qu'il faut un modèle plus puissant" },
                {
                  id: "b",
                  label:
                    "Que les classes se chevauchent réellement : une part de l'erreur est irréductible, et un modèle à 100 % aurait mémorisé le bruit",
                },
                { id: "c", label: "Que les données sont mal générées" },
              ],
              answer: 1,
              explanation: (
                <>
                  Là où les deux distributions se superposent, la même position peut légitimement
                  appartenir aux deux classes. Aucune fonction ne peut renvoyer deux réponses.
                  Reconnaître un plafond irréductible évite des semaines passées à optimiser
                  contre du <G t="bruit">bruit</G>.
                </>
              ),
            },
          ]}
        />

      </div>
    </PageShell>
  );
}
