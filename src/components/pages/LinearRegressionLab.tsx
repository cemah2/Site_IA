"use client";

import * as React from "react";
import { PageShell, SectionTitle, Workbench } from "@/components/layout/PageShell";
import { Button, Callout, Divider, Panel, Select, Slider, Stat, Toggle } from "@/components/ui";
import { G } from "@/components/ui/Glossary";
import { Levels } from "@/components/ui/Levels";
import { Quiz } from "@/components/lab/Quiz";
import { LiveFormula, Tex } from "@/components/math/Math";
import { Plot, localPoint, type PlotFrame } from "@/components/viz/Plot";
import { LineChart } from "@/components/viz/LineChart";
import { leastSquares, lineCost } from "@/lib/ml/models/regression";
import { r2 } from "@/lib/ml/metrics";
import { formatNumber } from "@/lib/viz/geometry";
import { CHROME, SERIES, STATUS, withAlpha } from "@/lib/viz/palette";
import {
  REGRESSION_DOMAIN,
  REGRESSION_SHAPES,
  useRegression,
  type RegressionShape,
} from "@/store/regression";

export function LinearRegressionLab() {
  const { points, setPoints, shape, setShape, n, setN, noise, setNoise, reseed } = useRegression();
  const [manual, setManual] = React.useState(false);
  const [slope, setSlope] = React.useState(0.5);
  const [intercept, setIntercept] = React.useState(0);
  const [showResiduals, setShowResiduals] = React.useState(true);
  const [showSquares, setShowSquares] = React.useState(false);

  const best = React.useMemo(() => leastSquares(points), [points]);
  const line = manual ? { slope, intercept } : best;

  const cost = lineCost(points, line.slope, line.intercept);
  const bestCost = lineCost(points, best.slope, best.intercept);
  const predictions = points.map((p) => line.slope * p.x + line.intercept);
  const score = r2(points.map((p) => p.y), predictions);

  // Cost as a function of the slope, with the intercept held at its optimum.
  // A 1-D slice of the bowl — enough to show convexity without leaving 2-D.
  const costCurve = React.useMemo(() => {
    const pts: { x: number; y: number }[] = [];
    for (let s = -2.5; s <= 2.5; s += 0.05) {
      pts.push({ x: s, y: lineCost(points, s, line.intercept) });
    }
    return pts;
  }, [points, line.intercept]);

  const dragRef = React.useRef<number | null>(null);

  const onMove = (e: React.PointerEvent<SVGSVGElement>, frame: PlotFrame) => {
    if (dragRef.current === null) return;
    const [px, py] = localPoint(e);
    const [x, y] = frame.data(px, py);
    setPoints(
      points.map((p) =>
        p.id === dragRef.current
          ? {
              ...p,
              x: clamp(x, REGRESSION_DOMAIN.xMin, REGRESSION_DOMAIN.xMax),
              y: clamp(y, REGRESSION_DOMAIN.yMin, REGRESSION_DOMAIN.yMax),
            }
          : p,
      ),
    );
  };

  return (
    <PageShell
      eyebrow="Régression"
      title="Régression linéaire"
      lede={
        <>
          Prédire un <em>nombre</em>, pas une classe. La question devient : quelle droite passe
          le mieux au milieu de ces points ? Encore faut-il définir « le mieux » — et ce choix,
          élever l&apos;erreur au carré, a des conséquences très concrètes que cette page rend
          visibles.
        </>
      }
    >
      <Workbench
        plot={
          <Panel
            title="Les points, la droite et les résidus"
            subtitle="Glissez un point : la droite optimale se recalcule à chaque pixel."
            bodyClassName="p-3"
          >
            <Plot
              xDomain={[REGRESSION_DOMAIN.xMin, REGRESSION_DOMAIN.xMax]}
              yDomain={[REGRESSION_DOMAIN.yMin, REGRESSION_DOMAIN.yMax]}
              aspect={0.78}
              maxWidth={620}
              xLabel="x"
              yLabel="y"
              cursor="crosshair"
              ariaLabel="Nuage de points avec droite de régression et résidus"
              onPointerMove={onMove}
              onPointerUp={() => (dragRef.current = null)}
              onPointerLeave={() => (dragRef.current = null)}
            >
              {(frame) => (
                <g clipPath="url(#plot-clip)">
                  {/* Squared residuals drawn as actual squares — the literal
                      picture of "least squares", and the clearest way to show
                      why one distant point dominates the total. */}
                  {showSquares &&
                    points.map((p) => {
                      const yHat = line.slope * p.x + line.intercept;
                      const [px, py] = frame.px(p.x, p.y);
                      const [, pyHat] = frame.px(p.x, yHat);
                      const side = Math.abs(py - pyHat);
                      return (
                        <rect
                          key={`sq${p.id}`}
                          x={p.y > yHat ? px : px - side}
                          y={Math.min(py, pyHat)}
                          width={side}
                          height={side}
                          fill={withAlpha(STATUS.critical, 0.12)}
                          stroke={withAlpha(STATUS.critical, 0.4)}
                          strokeWidth={1}
                        />
                      );
                    })}

                  {showResiduals &&
                    points.map((p) => {
                      const yHat = line.slope * p.x + line.intercept;
                      const [px, py] = frame.px(p.x, p.y);
                      const [, pyHat] = frame.px(p.x, yHat);
                      return (
                        <line
                          key={`r${p.id}`}
                          x1={px}
                          y1={py}
                          x2={px}
                          y2={pyHat}
                          stroke={STATUS.critical}
                          strokeWidth={1.25}
                          opacity={0.7}
                        />
                      );
                    })}

                  {/* The optimal line stays visible as a faint reference while
                      the learner drags their own — otherwise "how far off am I?"
                      has no answer. */}
                  {manual && (
                    <line
                      x1={frame.sx(REGRESSION_DOMAIN.xMin)}
                      y1={frame.sy(best.slope * REGRESSION_DOMAIN.xMin + best.intercept)}
                      x2={frame.sx(REGRESSION_DOMAIN.xMax)}
                      y2={frame.sy(best.slope * REGRESSION_DOMAIN.xMax + best.intercept)}
                      stroke={CHROME.inkMuted}
                      strokeWidth={1.25}
                      strokeDasharray="5 4"
                    />
                  )}

                  <line
                    x1={frame.sx(REGRESSION_DOMAIN.xMin)}
                    y1={frame.sy(line.slope * REGRESSION_DOMAIN.xMin + line.intercept)}
                    x2={frame.sx(REGRESSION_DOMAIN.xMax)}
                    y2={frame.sy(line.slope * REGRESSION_DOMAIN.xMax + line.intercept)}
                    stroke={SERIES[0]}
                    strokeWidth={2.25}
                  />

                  {points.map((p) => {
                    const [px, py] = frame.px(p.x, p.y);
                    return (
                      <g key={p.id}>
                        <circle
                          cx={px}
                          cy={py}
                          r={11}
                          fill="transparent"
                          style={{ cursor: "grab" }}
                          onPointerDown={(e) => {
                            dragRef.current = p.id;
                            (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
                          }}
                        />
                        <circle
                          cx={px}
                          cy={py}
                          r={4.5}
                          fill={SERIES[2]}
                          stroke={CHROME.surface1}
                          strokeWidth={1.75}
                        />
                      </g>
                    );
                  })}
                </g>
              )}
            </Plot>
            <p className="mt-2 text-[11px] text-ink-muted">
              Chaque trait vertical rouge est un <strong>résidu</strong> :{" "}
              <Tex>{String.raw`y_i - \hat{y}_i`}</Tex>, l&apos;écart entre ce qui est observé et
              ce que la droite prédit.
            </p>
          </Panel>
        }
        controls={
          <>
            <Toggle
              label="Placer la droite moi-même"
              checked={manual}
              onChange={(v) => {
                if (v) {
                  setSlope(best.slope);
                  setIntercept(best.intercept);
                }
                setManual(v);
              }}
              hint="Essayez de battre les moindres carrés. Le coût vous dira si vous y arrivez (vous n'y arriverez pas)."
            />
            {manual && (
              <>
                <Slider
                  label="Pente a"
                  value={slope}
                  min={-2.5}
                  max={2.5}
                  step={0.01}
                  onChange={setSlope}
                  format={(v) => v.toFixed(2)}
                />
                <Slider
                  label="Ordonnée à l'origine b"
                  value={intercept}
                  min={-3}
                  max={3}
                  step={0.01}
                  onChange={setIntercept}
                  format={(v) => v.toFixed(2)}
                />
                <Button
                  size="sm"
                  onClick={() => {
                    setSlope(best.slope);
                    setIntercept(best.intercept);
                  }}
                >
                  Revenir à l&apos;optimum
                </Button>
              </>
            )}
            <Divider label="Affichage" />
            <Toggle label="Résidus" checked={showResiduals} onChange={setShowResiduals} />
            <Toggle
              label="Carrés des résidus"
              checked={showSquares}
              onChange={setShowSquares}
              hint="L'aire de chaque carré est exactement ce que le coût additionne."
            />
            <Divider label="Données" />
            <Select
              label="Forme de la relation"
              value={shape}
              options={REGRESSION_SHAPES.map((s) => ({ value: s.id, label: s.label }))}
              onChange={(v) => setShape(v as RegressionShape)}
              hint={REGRESSION_SHAPES.find((s) => s.id === shape)?.teaches}
            />
            <Slider label="Nombre de points" value={n} min={6} max={120} step={2} onChange={setN} />
            <Slider
              label="Bruit"
              value={noise}
              min={0}
              max={2}
              step={0.05}
              onChange={setNoise}
              format={(v) => v.toFixed(2)}
            />
            <Button onClick={reseed} className="w-full">
              Regénérer
            </Button>
          </>
        }
        below={
          <>
            <Panel title="Le coût" subtitle="Ce que la droite optimale minimise">
              <LiveFormula
                tex={String.raw`J(a, b) = \frac{1}{n}\sum_{i=1}^{n}\bigl(y_i - (a x_i + b)\bigr)^2`}
                terms={[
                  { symbol: "a", value: formatNumber(line.slope, 3) },
                  { symbol: "b", value: formatNumber(line.intercept, 3) },
                  { symbol: "n", value: points.length },
                ]}
                result={{ label: "Coût (MSE)", value: formatNumber(cost, 4) }}
              />
              {manual && (
                <p className="mt-2 text-[11px] leading-snug text-ink-muted">
                  Optimum : {formatNumber(bestCost, 4)}. Votre droite est{" "}
                  <strong className="text-ink">
                    {cost <= bestCost + 1e-9
                      ? "à l'optimum"
                      : `${formatNumber(((cost - bestCost) / (bestCost || 1)) * 100, 1)} % au-dessus`}
                  </strong>
                  .
                </p>
              )}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Stat label="RMSE" value={formatNumber(Math.sqrt(cost), 3)} hint="Dans l'unité de y" />
                <Stat
                  label="R²"
                  value={formatNumber(score, 3)}
                  tone={score > 0.7 ? "good" : score > 0.3 ? "warning" : "critical"}
                  hint="Part de la variance expliquée"
                />
              </div>
            </Panel>

            <Panel
              title="La forme du coût"
              subtitle="Coût en fonction de la pente, ordonnée fixée à sa valeur actuelle"
            >
              <LineChart
                series={[
                  { key: "cost", label: "J(a)", color: SERIES[0], points: costCurve },
                ]}
                marker={line.slope}
                height={150}
                xLabel="pente a"
                xFormat={(v) => v.toFixed(1)}
                yFormat={(v) => v.toFixed(1)}
              />
              <p className="mt-2 text-[11px] leading-snug text-ink-muted">
                Une parabole : un seul minimum, pas de piège local. C&apos;est cette convexité
                qui rend la régression linéaire résoluble exactement — et qui fait de la{" "}
                <a href="/regression/descente-de-gradient/">descente de gradient</a> une méthode
                garantie de converger ici.
              </p>
            </Panel>
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
                On cherche la droite qui « passe le mieux ». Reste à décider ce que ça veut
                dire. La convention est : <strong>la somme des carrés des écarts
                verticaux</strong> doit être la plus petite possible.
              </p>
              <p>
                Activez « Carrés des résidus ». Chaque point porte un carré dont le côté est son
                erreur. Le coût est la moyenne de leurs aires. Maintenant glissez un point loin
                de la droite : son carré grandit de façon <strong>quadratique</strong>, et la
                droite entière part le rejoindre.
              </p>
              <p>
                C&apos;est toute l&apos;histoire des moindres carrés : très sensible aux points
                extrêmes, parce que doubler une erreur la quadruple dans le total.
              </p>
            </>
          }
          technique={
            <>
              <p>
                La régression linéaire a une <strong>solution exacte</strong>, obtenue en
                annulant les dérivées du coût. Pas d&apos;itérations, pas
                d&apos;hyperparamètres, pas de hasard : deux formules donnent directement le
                résultat.
              </p>
              <p>
                <strong>Pourquoi le carré et pas la valeur absolue ?</strong> Trois raisons. La
                fonction est dérivable partout, ce qui permet la solution fermée. Elle est
                convexe, donc un seul minimum. Et elle correspond à l&apos;estimateur du maximum
                de vraisemblance si le bruit est gaussien de variance constante.
              </p>
              <p>
                Cette dernière hypothèse est vérifiable. Passez le dataset sur{" "}
                <strong>Bruit croissant</strong> : la variance augmente avec{" "}
                <Tex>x</Tex>, l&apos;hypothèse tombe, et les moindres carrés accordent
                implicitement trop d&apos;importance à la zone bruitée.
              </p>
              <p>
                <strong>R² se lit avec prudence.</strong> Il vaut 1 pour un ajustement parfait,
                0 pour un modèle qui ne fait pas mieux que prédire la moyenne, et peut être{" "}
                <em>négatif</em> pour un modèle pire que ça. Un R² élevé ne dit rien sur la
                justesse de la forme du modèle : sur « Relation courbe », une droite peut encore
                afficher un R² honorable tout en étant structurellement fausse.
              </p>
            </>
          }
          maths={
            <>
              <p>Le modèle et son coût :</p>
              <LiveFormula
                tex={String.raw`\hat{y}_i = a x_i + b
                  \qquad
                  J(a,b) = \frac{1}{n}\sum_{i=1}^{n}(y_i - \hat{y}_i)^2`}
              />
              <p>
                On annule les deux dérivées partielles. De{" "}
                <Tex>{String.raw`\partial J/\partial b = 0`}</Tex> vient d&apos;abord un fait
                remarquable — <strong>la droite passe toujours par le centre de gravité du
                nuage</strong> :
              </p>
              <LiveFormula tex={String.raw`\bar{y} = a\bar{x} + b`} />
              <p>Puis, de la dérivée en <Tex>a</Tex> :</p>
              <LiveFormula
                tex={String.raw`a = \frac{\sum_i (x_i - \bar{x})(y_i - \bar{y})}{\sum_i (x_i - \bar{x})^2}
                  = \frac{\mathrm{Cov}(x, y)}{\mathrm{Var}(x)}
                  \qquad
                  b = \bar{y} - a\bar{x}`}
              />
              <p>
                <strong>Forme matricielle</strong>, qui se généralise à <Tex>d</Tex> features —
                les fameuses équations normales :
              </p>
              <LiveFormula
                tex={String.raw`\hat{\theta} = (X^{\!\top} X)^{-1} X^{\!\top} y`}
              />
              <p>
                <Tex>{String.raw`X^{\top}X`}</Tex> n&apos;est inversible que si les colonnes de{" "}
                <Tex>X</Tex> sont linéairement indépendantes. Deux features colinéaires rendent
                le problème mal posé — c&apos;est exactement ce que la{" "}
                <a href="/concepts/regularisation/">régularisation ridge</a> répare, en ajoutant{" "}
                <Tex>{String.raw`\lambda I`}</Tex> à la diagonale.
              </p>
              <p>Et le coefficient de détermination :</p>
              <LiveFormula
                tex={String.raw`R^2 = 1 - \frac{\sum_i (y_i - \hat{y}_i)^2}{\sum_i (y_i - \bar{y})^2}`}
              />
            </>
          }
        />


        <Quiz
          questions={[
            {
              id: "lr1",
              question:
                "Vous éloignez un seul point très loin de la droite. Pourquoi la droite le suit-elle autant ?",
              options: [
                { id: "a", label: "Parce qu'il y a peu de points" },
                {
                  id: "b",
                  label:
                    "Parce que le coût élève l'erreur au carré : un résidu deux fois plus grand pèse quatre fois plus",
                },
                { id: "c", label: "Parce que la droite passe toujours par tous les extrêmes" },
              ],
              answer: 1,
              explanation: (
                <>
                  Le carré est ce qui rend le problème résoluble d&apos;un trait de plume — il
                  existe une formule exacte — mais c&apos;est aussi ce qui donne un pouvoir
                  démesuré aux <G t="outlier">points aberrants</G>. Avec une valeur absolue à la
                  place, la droite les ignorerait davantage, au prix d&apos;un calcul itératif.
                  Rien n&apos;est gratuit.
                </>
              ),
            },
            {
              id: "lr2",
              question: "Que mesure exactement un résidu ?",
              options: [
                { id: "a", label: "La distance la plus courte entre le point et la droite" },
                { id: "b", label: "L'écart vertical entre la vraie valeur et celle prédite" },
                { id: "c", label: "L'erreur de la droite sur l'ensemble des points" },
              ],
              answer: 1,
              explanation: (
                <>
                  Verticalement, pas perpendiculairement : le modèle prédit <Tex>y</Tex> à partir
                  de <Tex>x</Tex>, donc l&apos;erreur ne se mesure que sur <Tex>y</Tex>. Ça a
                  l&apos;air d&apos;un détail et ça ne l&apos;est pas — la droite obtenue en
                  minimisant les distances perpendiculaires est une <em>autre</em> droite, et
                  elle répond à une autre question.
                </>
              ),
            },
            {
              id: "lr3",
              question:
                "Pourquoi cette page peut-elle afficher la meilleure droite instantanément, alors que la page suivante a besoin d'une descente de gradient ?",
              options: [
                { id: "a", label: "Parce qu'elle a moins de points" },
                {
                  id: "b",
                  label:
                    "Parce que le coût quadratique a un minimum donné par une formule fermée ; presque aucun autre modèle n'en a",
                },
                { id: "c", label: "Parce que la descente de gradient est plus précise" },
              ],
              answer: 1,
              explanation: (
                <>
                  Annuler la dérivée du coût donne ici un système linéaire, donc une solution
                  directe. C&apos;est une chance, et c&apos;est l&apos;exception : dès qu&apos;on
                  ajoute une sigmoïde, une couche cachée ou une marge, la formule disparaît et il
                  faut <G t="descente">descendre</G>.
                </>
              ),
            },
          ]}
        />

        <div className="space-y-4">
          <Callout kind="insight" title="L'expérience en trois clics">
            Dataset <strong>« Avec un point aberrant »</strong>, carrés des résidus activés.
            Deux points sont placés très loin de la tendance. Leurs carrés sont énormes, et la
            droite est visiblement tirée vers eux.
            <br />
            <br />
            Maintenant glissez l&apos;un de ces deux points vers le nuage : toute la droite
            pivote. Un point sur trente décide d&apos;une bonne partie du modèle.
          </Callout>

          <Callout kind="warning" title="Corrélation n'est pas causalité">
            Une droite ajustée avec un R² de 0,9 dit qu&apos;un lien statistique existe entre{" "}
            <Tex>x</Tex> et <Tex>y</Tex> dans ces données. Elle ne dit pas que <Tex>x</Tex>{" "}
            cause <Tex>y</Tex>, ni que la relation tiendra hors de la plage observée. Prolonger
            la droite au-delà des données est une extrapolation, et rien dans le modèle ne la
            justifie.
          </Callout>

          <Panel title="Cas pratiques" subtitle="Simple, mais loin d'être dépassé">
            <div className="prose-lab">
              <p>
                <strong>Comme référence obligatoire.</strong> Avant tout modèle compliqué, on
                ajuste une régression linéaire. Si le modèle sophistiqué ne la bat pas
                nettement, il ne se justifie pas.
              </p>
              <p>
                <strong>Quand les coefficients sont le résultat.</strong> En économétrie ou en
                épidémiologie, on veut souvent moins prédire que quantifier : « à quoi
                correspond une unité de plus de <Tex>x</Tex> ? » Un coefficient de régression
                répond à ça, avec un intervalle de confiance. Un réseau de neurones, non.
              </p>
              <p>
                <strong>Comme brique d&apos;autres modèles.</strong> Un neurone est une
                régression linéaire suivie d&apos;une fonction d&apos;activation. Tout ce qui est
                sur cette page réapparaît, à l&apos;identique, dans la section{" "}
                <a href="/reseaux/neurone/">réseaux de neurones</a>.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}
