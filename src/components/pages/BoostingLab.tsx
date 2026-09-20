"use client";

import * as React from "react";
import Link from "next/link";
import { PageShell, SectionTitle, Workbench } from "@/components/layout/PageShell";
import { Button, Callout, Divider, Panel, Segmented, Slider, Stat } from "@/components/ui";
import { G } from "@/components/ui/Glossary";
import { Levels } from "@/components/ui/Levels";
import { Tex, TexBlock } from "@/components/math/Math";
import { Narrator } from "@/components/lab/Narrator";
import { PredictFirst } from "@/components/lab/Practice";
import { Quiz } from "@/components/lab/Quiz";
import { LineChart } from "@/components/viz/LineChart";
import { Plot } from "@/components/viz/Plot";
import { fitBoosting } from "@/lib/ml/models/boosting";
import { formatNumber } from "@/lib/viz/geometry";
import { CHROME, SERIES, STATUS, withAlpha } from "@/lib/viz/palette";
import { REGRESSION_DOMAIN, REGRESSION_SHAPES, useRegression, type RegressionShape } from "@/store/regression";

const MAX_TREES = 80;

export function BoostingLab() {
  const { points, shape, setShape, noise, setNoise, n, setN, reseed } = useRegression();
  const [step, setStep] = React.useState(6);
  const [depth, setDepth] = React.useState(2);
  const [lr, setLr] = React.useState(0.3);
  const [playing, setPlaying] = React.useState(false);

  // Every third point held out: enough to show when adding trees stops helping.
  const { train, test } = React.useMemo(
    () => ({
      train: points.filter((_, i) => i % 3 !== 0),
      test: points.filter((_, i) => i % 3 === 0),
    }),
    [points],
  );

  const result = React.useMemo(
    () =>
      fitBoosting(train, test, {
        nTrees: MAX_TREES,
        depth,
        learningRate: lr,
        domain: [REGRESSION_DOMAIN.xMin, REGRESSION_DOMAIN.xMax],
      }),
    [train, test, depth, lr],
  );

  const clamped = Math.min(step, result.stages.length - 1);
  const stage = result.stages[clamped];
  const best = result.stages.reduce((a, b) => (b.testMse < a.testMse ? b : a));

  React.useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setStep((s) => {
        if (s >= MAX_TREES) {
          setPlaying(false);
          return s;
        }
        return s + 1;
      });
    }, 110);
    return () => clearInterval(id);
  }, [playing]);

  const runKey = `${shape}|${n}|${noise}|${depth}|${lr}`;
  const [lastKey, setLastKey] = React.useState(runKey);
  if (lastKey !== runKey) {
    setLastKey(runKey);
    setPlaying(false);
  }

  const xDomain: [number, number] = [REGRESSION_DOMAIN.xMin, REGRESSION_DOMAIN.xMax];
  const yDomain: [number, number] = [REGRESSION_DOMAIN.yMin, REGRESSION_DOMAIN.yMax];

  return (
    <PageShell
      eyebrow="Régression"
      title="Boosting"
      lede={
        <>
          Une forêt fait pousser ses arbres <strong>en parallèle</strong>, chacun de son côté,
          puis fait la moyenne. Le boosting les fait pousser <strong>à la file</strong>, et
          chacun n&apos;apprend qu&apos;une chose : ce que les précédents ont raté. Aucun arbre
          après le premier ne voit jamais la vraie cible.
        </>
      }
      wide
    >
      <Workbench
        plot={
          <div className="space-y-5">
            <Panel
              title={stage.step === 0 ? "Avant le premier arbre" : `Après ${stage.step} arbre${stage.step > 1 ? "s" : ""}`}
              subtitle="En blanc, la prédiction de l'ensemble. En pointillés, ce que l'arbre qui vient d'être ajouté corrige."
              bodyClassName="p-3"
              exportName="boosting-ajustement"
            >
              <Plot
                xDomain={xDomain}
                yDomain={yDomain}
                aspect={0.62}
                maxWidth={640}
                xLabel="x"
                yLabel="y"
                ariaLabel="Ajustement du boosting après le nombre d'arbres choisi"
              >
                {(frame) => (
                  <g clipPath="url(#plot-clip)">
                    {test.map((p) => {
                      const [x, y] = frame.px(p.x, p.y);
                      return (
                        <rect key={`t${p.id}`} x={x - 3} y={y - 3} width={6} height={6} fill={withAlpha(SERIES[1], 0.8)} />
                      );
                    })}
                    {train.map((p) => {
                      const [x, y] = frame.px(p.x, p.y);
                      return <circle key={p.id} cx={x} cy={y} r={3.2} fill={withAlpha(SERIES[0], 0.85)} />;
                    })}

                    {stage.step > 0 && (
                      <path
                        d={`M ${result.grid
                          .map((x, i) => {
                            const [px, py] = frame.px(x, result.base + stage.correction[i]);
                            return `${px.toFixed(1)},${py.toFixed(1)}`;
                          })
                          .join(" L ")}`}
                        fill="none"
                        stroke={STATUS.warning}
                        strokeWidth={1.4}
                        strokeDasharray="5 4"
                        opacity={0.85}
                      />
                    )}

                    <path
                      d={`M ${result.grid
                        .map((x, i) => {
                          const [px, py] = frame.px(x, stage.curve[i]);
                          return `${px.toFixed(1)},${py.toFixed(1)}`;
                        })
                        .join(" L ")}`}
                      fill="none"
                      stroke={CHROME.ink}
                      strokeWidth={2.2}
                    />
                  </g>
                )}
              </Plot>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-2.5 text-[11px] text-ink-muted">
                <span className="inline-flex items-center gap-1.5">
                  <svg width="14" height="14" aria-hidden><circle cx="7" cy="7" r="3.2" fill={SERIES[0]} /></svg>
                  entraînement
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <svg width="14" height="14" aria-hidden><rect x="4" y="4" width="6" height="6" fill={SERIES[1]} /></svg>
                  test
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <svg width="18" height="6" aria-hidden><line x1="0" y1="3" x2="18" y2="3" stroke={CHROME.ink} strokeWidth="2.2" /></svg>
                  l&apos;ensemble
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <svg width="18" height="6" aria-hidden><line x1="0" y1="3" x2="18" y2="3" stroke={STATUS.warning} strokeWidth="1.6" strokeDasharray="4 3" /></svg>
                  le dernier arbre, seul
                </span>
              </div>
            </Panel>

            <div className="grid gap-5 lg:grid-cols-2">
              <Panel
                title="Ce qu'il reste à corriger"
                subtitle="Les résidus — c'est sur eux, et seulement sur eux, que le prochain arbre sera ajusté"
                bodyClassName="p-3"
              >
                <Plot
                  xDomain={xDomain}
                  yDomain={[-2.2, 2.2]}
                  aspect={0.62}
                  maxWidth={420}
                  xLabel="x"
                  yLabel="y − prédiction"
                  ariaLabel="Résidus après le nombre d'arbres choisi"
                >
                  {(frame) => (
                    <g clipPath="url(#plot-clip)">
                      <line
                        x1={frame.px(xDomain[0], 0)[0]}
                        y1={frame.px(xDomain[0], 0)[1]}
                        x2={frame.px(xDomain[1], 0)[0]}
                        y2={frame.px(xDomain[1], 0)[1]}
                        stroke={CHROME.lineStrong}
                        strokeWidth={1}
                      />
                      {stage.residuals.map((r, i) => {
                        const [x, y] = frame.px(r.x, Math.max(-2.2, Math.min(2.2, r.y)));
                        const [, zero] = frame.px(r.x, 0);
                        return (
                          <g key={i}>
                            <line x1={x} y1={zero} x2={x} y2={y} stroke={CHROME.line} strokeWidth={1} />
                            <circle cx={x} cy={y} r={2.8} fill={withAlpha(r.y >= 0 ? SERIES[0] : SERIES[1], 0.85)} />
                          </g>
                        );
                      })}
                    </g>
                  )}
                </Plot>
                <p className="mt-2 text-[11.5px] leading-snug text-ink-2">
                  {stage.step === 0
                    ? "Au départ, le modèle prédit la moyenne partout : les résidus dessinent encore toute la forme des données."
                    : "Plus les points se tassent sur la ligne zéro, moins il reste de structure à expliquer. Quand il n'y a plus que du bruit, les arbres suivants se mettent à l'apprendre."}
                </p>
              </Panel>

              <Panel title="L'erreur, arbre par arbre" bodyClassName="p-4" exportName="boosting-erreur">
                <LineChart
                  series={[
                    {
                      key: "train",
                      label: "entraînement",
                      color: SERIES[0],
                      points: result.stages.map((s) => ({ x: s.step, y: s.trainMse })),
                    },
                    {
                      key: "test",
                      label: "test",
                      color: SERIES[1],
                      dashed: true,
                      points: result.stages.map((s) => ({ x: s.step, y: s.testMse })),
                    },
                  ]}
                  height={210}
                  xLabel="nombre d'arbres"
                  marker={clamped}
                  yFormat={(v) => v.toFixed(2)}
                />
                <p className="mt-2 text-[11.5px] leading-snug text-ink-2">
                  L&apos;erreur d&apos;entraînement ne remonte jamais : on peut toujours ajouter
                  un arbre de plus pour coller un peu mieux. Celle de test, si — et c&apos;est
                  la différence entre boosting et forêt. Meilleur test au pas{" "}
                  <strong className="tnum">{best.step}</strong>.
                </p>
              </Panel>
            </div>
          </div>
        }
        controls={
          <>
            <div className="flex gap-2">
              <Button variant="primary" className="flex-1" onClick={() => setPlaying((p) => !p)}>
                {playing ? "Pause" : "Dérouler"}
              </Button>
              <Button onClick={() => setStep((s) => Math.min(MAX_TREES, s + 1))}>+1</Button>
              <Button variant="ghost" onClick={() => { setPlaying(false); setStep(0); }}>
                ↺
              </Button>
            </div>
            <Slider
              label="Arbres ajoutés"
              value={clamped}
              min={0}
              max={MAX_TREES}
              step={1}
              onChange={(v) => { setPlaying(false); setStep(v); }}
            />
            <Slider
              label={<><Tex>{String.raw`\nu`}</Tex> — taux d&apos;apprentissage</>}
              value={lr}
              min={0.05}
              max={1}
              step={0.05}
              onChange={setLr}
              format={(v) => v.toFixed(2)}
              hint="Chaque arbre n'est appliqué qu'à cette fraction. Petit : il faut beaucoup d'arbres, mais le résultat généralise mieux. C'est le réglage le plus important du boosting."
            />
            <Slider
              label="Profondeur de chaque arbre"
              value={depth}
              min={1}
              max={4}
              step={1}
              onChange={setDepth}
              hint="1 = une seule coupure, un « moignon ». En boosting on garde les arbres délibérément faibles — l'inverse exact d'une forêt."
            />

            <Divider label="Données" />
            <Segmented
              label="Forme"
              value={shape}
              options={REGRESSION_SHAPES.slice(0, 3).map((s) => ({ value: s.id, label: s.label }))}
              onChange={(v) => setShape(v as RegressionShape)}
              size="sm"
            />
            <Slider label="Nombre de points" value={n} min={16} max={120} step={4} onChange={setN} />
            <Slider
              label="Bruit"
              value={noise}
              min={0.1}
              max={1.2}
              step={0.05}
              onChange={setNoise}
              format={(v) => v.toFixed(2)}
              hint="Montez-le : la courbe de test se met à remonter bien avant le dernier arbre."
            />
            <Button variant="ghost" className="w-full" onClick={reseed}>
              Autre tirage
            </Button>

            <Divider label="Ce que ça change" />
            <Narrator
              causes={[
                { key: "trees", label: "le nombre d'arbres", value: clamped },
                { key: "lr", label: "le taux d'apprentissage", value: lr },
                { key: "depth", label: "la profondeur", value: depth },
              ]}
              effects={[
                {
                  key: "train",
                  label: "l'erreur d'entraînement",
                  value: stage.trainMse,
                  format: (v) => formatNumber(v, 3),
                  better: "down",
                  epsilon: 0.002,
                },
                {
                  key: "test",
                  label: "l'erreur de test",
                  value: stage.testMse,
                  format: (v) => formatNumber(v, 3),
                  better: "down",
                  epsilon: 0.002,
                },
              ]}
            />
          </>
        }
        below={
          <>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Erreur entraînement" value={formatNumber(stage.trainMse, 3)} />
              <Stat
                label="Erreur test"
                value={formatNumber(stage.testMse, 3)}
                tone={stage.step > best.step + 5 ? "warning" : "good"}
              />
              <Stat label="Meilleur au pas" value={best.step} hint="Sur le jeu de test" />
              <Stat label="Arbres utilisés" value={clamped} />
            </div>

            {stage.step > best.step + 8 && (
              <Callout kind="warning" title="Vous avez dépassé le point utile">
                Le meilleur résultat sur le test était au pas {best.step}, et vous en êtes à{" "}
                {stage.step}. Les arbres suivants continuent d&apos;améliorer
                l&apos;entraînement en apprenant le <G t="bruit">bruit</G>. C&apos;est la
                faiblesse structurelle du boosting : contrairement à une forêt, en ajouter trop
                <em> nuit</em>.
              </Callout>
            )}

            <Panel title="Forêt et boosting" subtitle="Deux façons opposées d'assembler des arbres">
              <table className="w-full text-[11.5px] leading-snug">
                <tbody className="divide-y divide-line">
                  {[
                    ["Les arbres poussent", "en parallèle, indépendamment", "à la file, chacun après l'autre"],
                    ["Chacun apprend", "le problème entier", "les erreurs des précédents"],
                    ["Les arbres sont", "profonds, chacun bon seul", "faibles exprès, souvent un moignon"],
                    ["Assemblage", "moyenne ou vote", "somme des corrections"],
                    ["Trop d'arbres", "sans danger, ça plafonne", "nuit : le bruit finit par être appris"],
                    ["Réduit surtout", "la variance", "le biais"],
                  ].map(([what, forest, boost]) => (
                    <tr key={what}>
                      <td className="py-1.5 pr-2 font-medium text-ink-2">{what}</td>
                      <td className="py-1.5 pr-2 text-ink-2">{forest}</td>
                      <td className="py-1.5 text-ink">{boost}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2.5 text-[11.5px] leading-snug text-ink-muted">
                Colonne du milieu :{" "}
                <Link href="/classification/random-forest/" className="text-accent hover:underline">
                  Random Forest
                </Link>
                . Colonne de droite : cette page.
              </p>
            </Panel>
          </>
        }
      />

      <SectionTitle hint="La même idée, à trois niveaux de détail.">
        Apprendre de ses propres erreurs
      </SectionTitle>

      <Levels
        intuition={
          <>
            <p>
              Un premier relecteur corrige un texte et laisse passer des fautes. Un deuxième ne
              relit pas le texte d&apos;origine : il relit seulement ce que le premier a laissé
              passer. Un troisième s&apos;occupe de ce qui reste après les deux premiers. Aucun
              n&apos;est excellent ; leur somme l&apos;est.
            </p>
            <p>
              C&apos;est exactement le boosting, et c&apos;est pour ça qu&apos;on y utilise des
              arbres délibérément médiocres. Un relecteur parfait dès le premier tour ne
              laisserait rien à faire aux suivants — et surtout, il aurait « corrigé » des
              choses qui n&apos;étaient pas des fautes.
            </p>
            <p>
              La prudence a un nom ici : le taux d&apos;apprentissage. À 0,3, chaque arbre
              n&apos;applique que trois dixièmes de sa correction. On avance plus lentement, on
              a besoin de plus d&apos;arbres, et on se trompe moins.
            </p>
          </>
        }
        technique={
          <>
            <p>
              Le modèle est une somme : <Tex>{String.raw`F_m(x) = F_{m-1}(x) + \nu\,h_m(x)`}</Tex>,
              où <Tex>{String.raw`h_m`}</Tex> est un petit arbre ajusté non pas sur{" "}
              <Tex>y</Tex> mais sur les <strong>résidus</strong>{" "}
              <Tex>{String.raw`y - F_{m-1}(x)`}</Tex>, et <Tex>{String.raw`\nu`}</Tex> le taux
              d&apos;apprentissage.
            </p>
            <p>
              Le nom « gradient boosting » vient de là : avec l&apos;erreur quadratique, le
              résidu <em>est</em> l&apos;opposé du gradient de la perte par rapport à la
              prédiction. Ajuster un arbre sur les résidus, c&apos;est faire un pas de{" "}
              <G t="descente">descente de gradient</G> — non pas dans l&apos;espace des poids,
              mais dans celui des fonctions.
            </p>
            <p>
              Conséquence pratique : <Tex>{String.raw`\nu`}</Tex> et le nombre d&apos;arbres se
              règlent ensemble. Diviser <Tex>{String.raw`\nu`}</Tex> par deux demande à peu près
              deux fois plus d&apos;arbres, pour un modèle qui généralise généralement mieux.
              C&apos;est pourquoi les implémentations sérieuses utilisent un{" "}
              <em>early stopping</em> sur un jeu de validation plutôt qu&apos;un nombre
              d&apos;arbres fixé à l&apos;avance.
            </p>
          </>
        }
        maths={
          <>
            <p>
              On veut minimiser <Tex>{String.raw`\sum_i L(y_i, F(x_i))`}</Tex> sur un espace de
              fonctions. À l&apos;étape <Tex>m</Tex>, la direction de plus forte descente en
              chaque point observé est l&apos;opposé du gradient :
            </p>
            <TexBlock>
              {String.raw`r_{i,m} = -\left[\frac{\partial L(y_i, F(x_i))}{\partial F(x_i)}\right]_{F = F_{m-1}}`}
            </TexBlock>
            <p>
              Avec la perte quadratique <Tex>{String.raw`L = \tfrac{1}{2}(y - F)^2`}</Tex>, cette
              dérivée vaut <Tex>{String.raw`F - y`}</Tex>, donc{" "}
              <Tex>{String.raw`r_{i,m} = y_i - F_{m-1}(x_i)`}</Tex> : le résidu ordinaire. C&apos;est
              le cas affiché sur cette page, et c&apos;est le seul où « ajuster sur les résidus »
              est littéralement exact plutôt qu&apos;une approximation.
            </p>
            <p>
              Cette direction n&apos;existe qu&apos;aux points observés ; l&apos;arbre{" "}
              <Tex>{String.raw`h_m`}</Tex> sert à l&apos;étendre partout ailleurs. On pose enfin{" "}
              <Tex>{String.raw`F_m = F_{m-1} + \nu h_m`}</Tex>, où{" "}
              <Tex>{String.raw`\nu \in\, ]0, 1]`}</Tex> joue exactement le rôle du pas dans une
              descente de gradient classique — y compris son compromis : trop grand, on dépasse ;
              trop petit, il faut beaucoup d&apos;étapes.
            </p>
            <p>
              Avec une autre perte — log-loss pour la classification, perte absolue pour
              résister aux valeurs aberrantes — seule la formule de{" "}
              <Tex>{String.raw`r_{i,m}`}</Tex> change. Toute la mécanique reste la même, et
              c&apos;est ce qui fait la généralité de la méthode.
            </p>
          </>
        }
      />

      <SectionTitle hint="Trois questions auxquelles la page ci-dessus répond.">
        Vérifiez que c&apos;est passé
      </SectionTitle>

      <PredictFirst
        id="boost-vs-forest"
        className="mb-5"
        question={
          <>
            Vous passez de 80 arbres à 400, sur des données bruitées. Qu&apos;arrive-t-il à
            l&apos;erreur de test — pour une forêt aléatoire, puis pour le boosting ?
          </>
        }
        options={[
          "Elle baisse dans les deux cas",
          "Elle plafonne pour la forêt, et remonte pour le boosting",
          "Elle remonte dans les deux cas",
        ]}
        answer={1}
        explanation={
          <>
            Une forêt moyenne des modèles indépendants : en ajouter ne fait que stabiliser la
            moyenne, et le résultat plafonne. Le boosting <em>additionne</em> des corrections, et
            une fois la structure expliquée les corrections suivantes portent sur du bruit.
            C&apos;est la raison pour laquelle une forêt se règle avec « autant d&apos;arbres
            qu&apos;on peut se payer » et le boosting avec un arrêt anticipé.
          </>
        }
      />

      <Quiz
        questions={[
          {
            id: "bo1",
            question:
              "Pourquoi utilise-t-on volontairement des arbres très peu profonds en boosting ?",
            options: [
              { id: "a", label: "Pour aller plus vite" },
              {
                id: "b",
                label:
                  "Parce que chaque arbre ne doit apporter qu'une petite correction : un arbre profond expliquerait tout, bruit compris, dès le premier tour",
              },
              { id: "c", label: "Parce que les arbres profonds ne savent pas prédire des résidus" },
            ],
            answer: 1,
            explanation: (
              <>
                C&apos;est l&apos;inverse exact d&apos;une forêt, où l&apos;on met des arbres
                profonds parce que la moyenne se charge d&apos;éteindre leur{" "}
                <G t="variance">variance</G>. Ici la somme n&apos;éteint rien : chaque
                correction est conservée, donc chacune doit être petite et prudente. Mettez la
                profondeur à 4 avec un taux de 1 : le modèle colle aux points en une poignée
                d&apos;arbres, et la courbe de test remonte aussitôt.
              </>
            ),
          },
          {
            id: "bo2",
            question: "Sur quoi le troisième arbre est-il ajusté ?",
            options: [
              { id: "a", label: "Sur les données d'origine, comme les autres" },
              { id: "b", label: "Sur ce que les deux premiers arbres n'ont pas réussi à expliquer" },
              { id: "c", label: "Sur un tirage aléatoire des données" },
            ],
            answer: 1,
            explanation: (
              <>
                Seul le premier voit la cible réelle. Tous les suivants voient des résidus —
                et le graphique du milieu les montre s&apos;aplatir arbre après arbre. La
                réponse (c) décrit le <G t="bagging">bagging</G>, c&apos;est-à-dire la forêt
                aléatoire.
              </>
            ),
          },
          {
            id: "bo3",
            question:
              "Vous divisez le taux d'apprentissage par deux sans rien changer d'autre. Que faut-il faire ?",
            options: [
              { id: "a", label: "Rien, le résultat sera identique" },
              { id: "b", label: "À peu près doubler le nombre d'arbres" },
              { id: "c", label: "Doubler la profondeur" },
            ],
            answer: 1,
            explanation: (
              <>
                Chaque arbre n&apos;applique plus que la moitié de sa correction, donc il en faut
                environ deux fois plus pour parcourir la même distance. Le résultat est
                généralement <em>meilleur</em> : avancer par petits pas laisse moins de place aux
                corrections excessives. Essayez 0,1 puis 0,05 avec le curseur d&apos;arbres au
                maximum.
              </>
            ),
          },
        ]}
      />
    </PageShell>
  );
}
