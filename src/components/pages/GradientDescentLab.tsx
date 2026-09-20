"use client";

import * as React from "react";
import { PageShell, SectionTitle, Workbench } from "@/components/layout/PageShell";
import { Button, Callout, Divider, Panel, Segmented, Slider, Stat } from "@/components/ui";
import { Levels } from "@/components/ui/Levels";
import { LiveFormula, Tex } from "@/components/math/Math";
import { CostSurface3D } from "@/components/viz/CostSurface3D";
import { LineChart } from "@/components/viz/LineChart";
import { Plot } from "@/components/viz/Plot";
import {
  gradientDescent,
  leastSquares,
  lineCost,
  type GdStep,
} from "@/lib/ml/models/regression";
import { formatNumber } from "@/lib/viz/geometry";
import { CHROME, SERIES, STATUS } from "@/lib/viz/palette";
import { REGRESSION_DOMAIN, useRegression } from "@/store/regression";

const A_RANGE: [number, number] = [-2.6, 2.6];
const B_RANGE: [number, number] = [-3, 3];
const LR_PRESETS = [
  { value: "0.005", label: "Trop faible", lr: 0.005 },
  { value: "0.08", label: "Correct", lr: 0.08 },
  { value: "0.45", label: "Trop élevé", lr: 0.45 },
];

export function GradientDescentLab() {
  const { points, reseed } = useRegression();
  const [lr, setLr] = React.useState(0.08);
  const [step, setStep] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  const [start, setStart] = React.useState<[number, number]>([-2.1, 2.4]);
  const [view, setView] = React.useState<"3d" | "contour">("3d");

  const MAX_STEPS = 150;

  const trace = React.useMemo(
    () =>
      gradientDescent(points, {
        lr,
        steps: MAX_STEPS,
        slope0: start[0],
        intercept0: start[1],
      }),
    [points, lr, start],
  );

  const optimum = React.useMemo(() => leastSquares(points), [points]);
  const costAt = React.useCallback(
    (a: number, b: number) => lineCost(points, a, b),
    [points],
  );

  const clamped = Math.min(step, trace.length - 1);
  const current: GdStep | undefined = trace[clamped];

  // Diverged when the run either blew past the finite-cost guard or simply
  // ended worse than it started. Both are real failures; "stopped early" alone
  // is not, since a run can also be cut short by reaching the step budget.
  const last = trace[trace.length - 1];
  const diverged =
    !last ||
    !Number.isFinite(last.cost) ||
    last.cost > trace[0].cost * 1.001;

  React.useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setStep((s) => {
        if (s >= trace.length - 1) {
          setPlaying(false);
          return s;
        }
        return s + 1;
      });
    }, 45);
    return () => clearInterval(id);
  }, [playing, trace.length]);

  // Restarting is what makes a learning-rate change legible: keeping the old
  // trajectory would mix two different runs in one picture.
  const runKey = `${lr}|${start[0]}|${start[1]}|${points.length}`;
  const [lastKey, setLastKey] = React.useState(runKey);
  if (lastKey !== runKey) {
    setLastKey(runKey);
    setStep(0);
    setPlaying(false);
  }

  const costCurve = trace.map((s) => ({ x: s.step, y: s.cost }));
  const gradCurve = trace.map((s) => ({ x: s.step, y: s.gradientNorm }));
  const trajectory = trace.slice(0, clamped + 1).map((s) => ({ a: s.slope, b: s.intercept, cost: s.cost }));

  return (
    <PageShell
      eyebrow="Régression"
      title="Descente de gradient"
      lede={
        <>
          La régression linéaire a une solution exacte. Presque aucun autre modèle n&apos;en a.
          La descente de gradient est la méthode universelle de repli : partir n&apos;importe où,
          regarder la pente, et faire un pas dans la descente. Répéter. C&apos;est avec ça
          qu&apos;on entraîne absolument tous les réseaux de neurones.
        </>
      }
      wide
    >
      <Workbench
        plot={
          <div className="space-y-5">
            <Panel
              title="La surface de coût"
              subtitle="Chaque point du sol est une droite possible. La hauteur est son erreur."
              bodyClassName="p-3"
              action={
                <Segmented
                  value={view}
                  options={[
                    { value: "3d", label: "3D" },
                    { value: "contour", label: "Courbes de niveau" },
                  ]}
                  onChange={(v) => setView(v as "3d" | "contour")}
                  size="sm"
                />
              }
            >
              {view === "3d" ? (
                <CostSurface3D
                  costAt={costAt}
                  aRange={A_RANGE}
                  bRange={B_RANGE}
                  trajectory={trajectory}
                  current={
                    current
                      ? { a: current.slope, b: current.intercept, cost: current.cost }
                      : null
                  }
                  gradient={
                    current ? { da: current.dSlope, db: current.dIntercept } : null
                  }
                />
              ) : (
                <ContourView
                  costAt={costAt}
                  trace={trace}
                  upTo={clamped}
                  optimum={optimum}
                  onPick={(a, b) => setStart([a, b])}
                />
              )}
            </Panel>

            <Panel
              title="Ce que ça donne sur les données"
              subtitle="La droite correspondant à la position actuelle de la bille."
              bodyClassName="p-3"
            >
              <Plot
                xDomain={[REGRESSION_DOMAIN.xMin, REGRESSION_DOMAIN.xMax]}
                yDomain={[REGRESSION_DOMAIN.yMin, REGRESSION_DOMAIN.yMax]}
                aspect={0.5}
                maxWidth={620}
                xLabel="x"
                yLabel="y"
                ariaLabel="Données et droite courante"
              >
                {(frame) => (
                  <g clipPath="url(#plot-clip)">
                    <line
                      x1={frame.sx(REGRESSION_DOMAIN.xMin)}
                      y1={frame.sy(optimum.slope * REGRESSION_DOMAIN.xMin + optimum.intercept)}
                      x2={frame.sx(REGRESSION_DOMAIN.xMax)}
                      y2={frame.sy(optimum.slope * REGRESSION_DOMAIN.xMax + optimum.intercept)}
                      stroke={CHROME.inkMuted}
                      strokeWidth={1.25}
                      strokeDasharray="5 4"
                    />
                    {current && Number.isFinite(current.cost) && (
                      <line
                        x1={frame.sx(REGRESSION_DOMAIN.xMin)}
                        y1={frame.sy(current.slope * REGRESSION_DOMAIN.xMin + current.intercept)}
                        x2={frame.sx(REGRESSION_DOMAIN.xMax)}
                        y2={frame.sy(current.slope * REGRESSION_DOMAIN.xMax + current.intercept)}
                        stroke={SERIES[0]}
                        strokeWidth={2.25}
                      />
                    )}
                    {points.map((p) => {
                      const [px, py] = frame.px(p.x, p.y);
                      return (
                        <circle
                          key={p.id}
                          cx={px}
                          cy={py}
                          r={3.5}
                          fill={SERIES[2]}
                          stroke={CHROME.surface1}
                          strokeWidth={1.5}
                        />
                      );
                    })}
                  </g>
                )}
              </Plot>
              <p className="mt-2 text-[11px] text-ink-muted">
                Trait pointillé : la droite optimale, calculée exactement. La descente de
                gradient doit y arriver toute seule.
              </p>
            </Panel>
          </div>
        }
        controls={
          <>
            <Segmented
              label="Learning rate"
              value={
                LR_PRESETS.find((p) => Math.abs(p.lr - lr) < 1e-9)?.value ?? "custom"
              }
              options={[
                ...LR_PRESETS.map((p) => ({ value: p.value, label: p.label })),
                ...(LR_PRESETS.some((p) => Math.abs(p.lr - lr) < 1e-9)
                  ? []
                  : [{ value: "custom", label: "Réglé" }]),
              ]}
              onChange={(v) => {
                const p = LR_PRESETS.find((x) => x.value === v);
                if (p) setLr(p.lr);
              }}
              size="sm"
            />
            <Slider
              label={
                <>
                  <Tex>{String.raw`\alpha`}</Tex> — taille du pas
                </>
              }
              value={lr}
              min={0.001}
              max={0.6}
              step={0.001}
              onChange={setLr}
              format={(v) => v.toFixed(3)}
              hint={
                diverged
                  ? "Divergence : chaque pas dépasse le fond de la vallée et remonte plus haut de l'autre côté."
                  : lr < 0.02
                    ? "Convergence garantie, mais il faudra beaucoup de pas."
                    : undefined
              }
            />

            <Divider label="Exécution" />
            <div className="flex gap-2">
              <Button
                variant="primary"
                className="flex-1"
                onClick={() => {
                  if (clamped >= trace.length - 1) setStep(0);
                  setPlaying((p) => !p);
                }}
              >
                {playing ? "Pause" : clamped >= trace.length - 1 ? "Rejouer" : "Lancer"}
              </Button>
              <Button
                onClick={() => {
                  setPlaying(false);
                  setStep(Math.min(trace.length - 1, clamped + 1));
                }}
              >
                Pas à pas →
              </Button>
            </div>
            <Slider
              label="Itération"
              value={clamped}
              min={0}
              max={Math.max(1, trace.length - 1)}
              onChange={(v) => {
                setPlaying(false);
                setStep(v);
              }}
            />
            <Button
              size="sm"
              variant="ghost"
              className="w-full"
              onClick={() => {
                setStep(0);
                setPlaying(false);
                setStart([
                  A_RANGE[0] + Math.random() * (A_RANGE[1] - A_RANGE[0]),
                  B_RANGE[0] + Math.random() * (B_RANGE[1] - B_RANGE[0]),
                ]);
              }}
            >
              Repartir d&apos;un autre point
            </Button>
            <Divider label="Données" />
            <Button onClick={reseed} className="w-full">
              Regénérer les points
            </Button>
          </>
        }
        below={
          <>
            {current && (
              <Panel title="Une itération" subtitle={`Pas ${current.step} sur ${trace.length - 1}`}>
                <LiveFormula
                  tex={String.raw`\theta \leftarrow \theta - \alpha \, \nabla J(\theta)`}
                  terms={[
                    { symbol: "a", value: formatNumber(current.slope, 4) },
                    { symbol: "b", value: formatNumber(current.intercept, 4) },
                    { symbol: String.raw`\partial J/\partial a`, value: formatNumber(current.dSlope, 4) },
                    { symbol: String.raw`\partial J/\partial b`, value: formatNumber(current.dIntercept, 4) },
                  ]}
                  result={{ label: "Coût J", value: formatNumber(current.cost, 5) }}
                />
                <ol className="mt-3 space-y-1 text-[11px] leading-snug text-ink-2">
                  <li className="rounded-md border border-line bg-surface-2/50 px-2 py-1.5">
                    <strong className="text-ink">1. Gradient</strong> — la pente sous la bille,
                    norme {formatNumber(current.gradientNorm, 4)}
                  </li>
                  <li className="rounded-md border border-line bg-surface-2/50 px-2 py-1.5">
                    <strong className="text-ink">2. Pas</strong> — on avance de{" "}
                    <span className="tnum">α × gradient</span> dans le sens opposé
                  </li>
                  <li className="rounded-md border border-line bg-surface-2/50 px-2 py-1.5">
                    <strong className="text-ink">3. Nouveau coût</strong> —{" "}
                    <span className="tnum">
                      {trace[clamped + 1]
                        ? formatNumber(trace[clamped + 1].cost, 5)
                        : "fin du parcours"}
                    </span>
                  </li>
                  <li className="rounded-md border border-line bg-surface-2/50 px-2 py-1.5">
                    <strong className="text-ink">4. Recommencer</strong>
                  </li>
                </ol>
              </Panel>
            )}

            <Panel title="Le coût au fil des itérations">
              <LineChart
                series={[{ key: "J", label: "J(θ)", color: SERIES[0], points: costCurve }]}
                marker={clamped}
                height={140}
                xLabel="itération"
                yFormat={(v) => (v > 99 ? v.toExponential(0) : v.toFixed(1))}
              />
              <Divider />
              <LineChart
                series={[
                  { key: "g", label: "‖∇J‖", color: SERIES[1], points: gradCurve },
                ]}
                marker={clamped}
                height={120}
                xLabel="itération"
                yFormat={(v) => (v > 99 ? v.toExponential(0) : v.toFixed(1))}
              />
              <p className="mt-2 text-[11px] leading-snug text-ink-muted">
                La norme du gradient tend vers 0 quand on approche du minimum : les pas
                deviennent naturellement plus petits, sans qu&apos;on ait à réduire{" "}
                <Tex>{String.raw`\alpha`}</Tex>.
              </p>
            </Panel>

            <div className="grid grid-cols-2 gap-2">
              <Stat
                label="Coût actuel"
                value={current ? formatNumber(current.cost, 4) : "—"}
                tone={!diverged ? "critical" : undefined}
              />
              <Stat
                label="Optimum exact"
                value={formatNumber(lineCost(points, optimum.slope, optimum.intercept), 4)}
                hint="Calculé par les moindres carrés"
              />
            </div>

            {diverged && (
              <Callout kind="warning" title="Ça diverge">
                Le coût explose au lieu de descendre. Avec un pas trop grand, on saute par-dessus
                le fond de la vallée et on atterrit <em>plus haut</em> de l&apos;autre côté — puis
                ça s&apos;amplifie à chaque itération. Le seuil n&apos;est pas arbitraire : il
                vaut <Tex>{String.raw`\alpha < 2/L`}</Tex> où <Tex>L</Tex> est la courbure
                maximale de la surface.
              </Callout>
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
                Vous êtes sur une montagne dans un brouillard total. Vous voulez rejoindre la
                vallée. Vous ne voyez rien, mais vous sentez la pente sous vos pieds. Alors vous
                faites un pas dans la direction qui descend le plus. Puis vous recommencez.
              </p>
              <p>
                La seule décision est <strong>la longueur du pas</strong>. Des pas minuscules :
                vous arriverez, dans très longtemps. Des pas gigantesques : vous traversez la
                vallée et remontez de l&apos;autre côté, plus haut qu&apos;avant — et ça empire
                à chaque fois.
              </p>
              <p>
                Essayez les trois réglages. « Trop faible » : la bille rampe. « Correct » : une
                courbe nette vers le fond. « Trop élevé » : la trajectoire oscille d&apos;un
                versant à l&apos;autre et s&apos;envole.
              </p>
            </>
          }
          technique={
            <>
              <p>
                Le <strong>gradient</strong> <Tex>{String.raw`\nabla J`}</Tex> est le vecteur des
                dérivées partielles. Il pointe dans la direction de plus forte{" "}
                <em>montée</em> — d&apos;où le signe moins dans la mise à jour.
              </p>
              <p>
                <strong>Pourquoi cette méthode plutôt que la solution exacte ?</strong> Parce
                qu&apos;ici seulement la solution exacte existe. Dès qu&apos;on met une
                activation non linéaire dans un neurone, il n&apos;y a plus de formule fermée —
                et la descente de gradient reste applicable telle quelle, parce qu&apos;elle ne
                demande que de savoir dériver.
              </p>
              <p>
                <strong>Ici, c&apos;est facile : la surface est convexe.</strong> Un seul
                minimum, atteint quel que soit le point de départ. Cliquez sur « Repartir
                d&apos;un autre point » : la bille finit toujours au même endroit. Pour un
                réseau de neurones, la surface est pleine de vallées et de plateaux, et le point
                de départ compte.
              </p>
              <p>
                <strong>Les variantes courantes</strong> attaquent toutes le même problème — un{" "}
                <Tex>{String.raw`\alpha`}</Tex> fixe est un mauvais compromis. Le{" "}
                <em>momentum</em> accumule la vitesse pour traverser les plateaux ;{" "}
                <em>Adam</em> adapte un pas différent par paramètre ; le SGD calcule le gradient
                sur un petit lot plutôt que sur tout le jeu, ce qui est bruité mais bien plus
                rapide par itération.
              </p>
            </>
          }
          maths={
            <>
              <p>La règle de mise à jour, pour un vecteur de paramètres <Tex>{String.raw`\theta`}</Tex> :</p>
              <LiveFormula tex={String.raw`\theta_{t+1} = \theta_t - \alpha \, \nabla J(\theta_t)`} />
              <p>Pour la régression linéaire, les deux dérivées partielles se calculent à la main :</p>
              <LiveFormula
                tex={String.raw`\frac{\partial J}{\partial a} = -\frac{2}{n}\sum_{i} x_i\bigl(y_i - \hat{y}_i\bigr)
                  \qquad
                  \frac{\partial J}{\partial b} = -\frac{2}{n}\sum_{i} \bigl(y_i - \hat{y}_i\bigr)`}
              />
              <p>
                <strong>La condition de convergence.</strong> Si <Tex>J</Tex> est convexe et que
                son gradient est <Tex>L</Tex>-lipschitzien (autrement dit : la courbure est
                bornée par <Tex>L</Tex>), la descente de gradient converge à condition que :
              </p>
              <LiveFormula tex={String.raw`0 < \alpha < \frac{2}{L}`} />
              <p>
                Ce n&apos;est pas une heuristique : au-delà, chaque pas <em>augmente</em>{" "}
                strictement le coût. C&apos;est précisément ce que montre le réglage « Trop
                élevé ».
              </p>
              <p>
                Pour le coût quadratique de cette page, <Tex>L</Tex> est la plus grande valeur
                propre de la hessienne :
              </p>
              <LiveFormula
                tex={String.raw`H = \frac{2}{n}\begin{pmatrix} \sum_i x_i^2 & \sum_i x_i \\ \sum_i x_i & n \end{pmatrix}`}
              />
              <p>
                Le rapport entre la plus grande et la plus petite valeur propre est le{" "}
                <strong>conditionnement</strong>. Plus il est élevé, plus la vallée est un
                ravin étroit et plus la trajectoire zigzague — le fléau que le momentum et Adam
                cherchent à corriger.
              </p>
            </>
          }
        />

        <div className="space-y-4">
          <Callout kind="insight" title="La vue à ne pas manquer">
            Passez en <strong>Courbes de niveau</strong> : la trajectoire se lit d&apos;un coup.
            Avec un bon <Tex>{String.raw`\alpha`}</Tex>, elle coupe les courbes
            perpendiculairement et se resserre. Avec un <Tex>{String.raw`\alpha`}</Tex> trop
            grand, elle rebondit d&apos;un versant à l&apos;autre en s&apos;écartant.
            <br />
            <br />
            Cliquez dans cette vue pour choisir vous-même le point de départ.
          </Callout>

          <Callout kind="note" title="Pourquoi l'axe vertical est logarithmique">
            Le coût varie de plusieurs ordres de grandeur entre le bord de la surface et son
            fond. Tracé linéairement, tout ce qui se passe près du minimum — c&apos;est-à-dire
            l&apos;essentiel — serait une plaque plate d&apos;un pixel d&apos;épaisseur. La
            hauteur affichée est <Tex>{String.raw`\log(1 + J)`}</Tex>, et la forme du bol est
            donc adoucie par rapport à la réalité.
          </Callout>

          <Panel title="Où ça sert vraiment" subtitle="Au-delà de la régression">
            <div className="prose-lab">
              <p>
                <strong>Tous les réseaux de neurones.</strong> Sans exception. Des millions de
                paramètres, aucune solution fermée, et la même boucle en quatre lignes :
                gradient, pas, nouveau coût, recommencer. La{" "}
                <a href="/reseaux/backpropagation/">backpropagation</a> n&apos;est rien
                d&apos;autre que la méthode efficace de calculer ce gradient.
              </p>
              <p>
                <strong>Régression logistique, SVM, factorisation matricielle…</strong> Dès
                qu&apos;un modèle se définit par « minimiser une fonction dérivable », c&apos;est
                l&apos;outil par défaut.
              </p>
              <p>
                <strong>Au-delà du ML.</strong> Calibration de modèles physiques, optimisation de
                formes, reconstruction d&apos;images. La descente de gradient est un outil
                d&apos;optimisation générale, pas une technique de machine learning.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}

/**
 * Contour view: iso-cost curves plus the trajectory.
 *
 * Often more readable than the 3-D surface, because the spacing of the contours
 * IS the steepness — tightly packed lines mean a steep wall — and the zig-zag
 * of a too-large step shows as crossing the same contour repeatedly.
 */
function ContourView({
  costAt,
  trace,
  upTo,
  optimum,
  onPick,
}: {
  costAt: (a: number, b: number) => number;
  trace: GdStep[];
  upTo: number;
  optimum: { slope: number; intercept: number };
  onPick: (a: number, b: number) => void;
}) {
  const levels = React.useMemo(() => {
    const min = costAt(optimum.slope, optimum.intercept);
    const max = Math.max(
      costAt(A_RANGE[0], B_RANGE[0]),
      costAt(A_RANGE[1], B_RANGE[1]),
    );
    return Array.from({ length: 11 }, (_, i) => min + (max - min) * ((i + 1) / 12) ** 2.1);
  }, [costAt, optimum]);

  const grid = React.useMemo(() => {
    const res = 110;
    const values = new Float32Array(res * res);
    for (let j = 0; j < res; j++) {
      const b = B_RANGE[0] + ((B_RANGE[1] - B_RANGE[0]) * j) / (res - 1);
      for (let i = 0; i < res; i++) {
        const a = A_RANGE[0] + ((A_RANGE[1] - A_RANGE[0]) * i) / (res - 1);
        values[j * res + i] = costAt(a, b);
      }
    }
    return { res, values };
  }, [costAt]);

  return (
    <Plot
      xDomain={A_RANGE}
      yDomain={B_RANGE}
      aspect={0.82}
      maxWidth={560}
      xLabel="pente a"
      yLabel="ordonnée b"
      cursor="crosshair"
      ariaLabel="Courbes de niveau du coût et trajectoire de la descente"
      onPointerUp={(e, frame) => {
        const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
        const [a, b] = frame.data(e.clientX - rect.left, e.clientY - rect.top);
        onPick(
          Math.min(A_RANGE[1], Math.max(A_RANGE[0], a)),
          Math.min(B_RANGE[1], Math.max(B_RANGE[0], b)),
        );
      }}
    >
      {(frame) => (
        <g clipPath="url(#plot-clip)">
          {levels.map((lv, i) => (
            <path
              key={lv}
              d={contourPath(grid, lv, frame)}
              fill="none"
              stroke={CHROME.lineStrong}
              strokeWidth={1}
              opacity={0.35 + (0.4 * (levels.length - i)) / levels.length}
            />
          ))}

          <path
            d={trace
              .slice(0, upTo + 1)
              .filter((s) => Number.isFinite(s.cost))
              .map((s, i) => {
                const [x, y] = frame.px(s.slope, s.intercept);
                return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
              })
              .join("")}
            fill="none"
            stroke={STATUS.warning}
            strokeWidth={2}
            strokeLinejoin="round"
          />
          {trace.slice(0, upTo + 1).map((s, i) =>
            Number.isFinite(s.cost) && i % 2 === 0 ? (
              <circle
                key={s.step}
                cx={frame.px(s.slope, s.intercept)[0]}
                cy={frame.px(s.slope, s.intercept)[1]}
                r={2}
                fill={STATUS.warning}
                opacity={0.65}
              />
            ) : null,
          )}

          <path
            d={`M${frame.px(optimum.slope, optimum.intercept)[0] - 7},${frame.px(optimum.slope, optimum.intercept)[1]}h14M${frame.px(optimum.slope, optimum.intercept)[0]},${frame.px(optimum.slope, optimum.intercept)[1] - 7}v14`}
            stroke={CHROME.ink}
            strokeWidth={1.75}
          />

          {trace[upTo] && Number.isFinite(trace[upTo].cost) && (
            <circle
              cx={frame.px(trace[upTo].slope, trace[upTo].intercept)[0]}
              cy={frame.px(trace[upTo].slope, trace[upTo].intercept)[1]}
              r={5.5}
              fill={CHROME.ink}
              stroke={CHROME.surface1}
              strokeWidth={2}
            />
          )}
        </g>
      )}
    </Plot>
  );
}

function contourPath(
  grid: { res: number; values: Float32Array },
  level: number,
  frame: { px: (x: number, y: number) => [number, number] },
): string {
  const { res, values } = grid;
  const at = (i: number, j: number) => values[j * res + i] - level;
  const ax = (i: number) => A_RANGE[0] + ((A_RANGE[1] - A_RANGE[0]) * i) / (res - 1);
  const by = (j: number) => B_RANGE[0] + ((B_RANGE[1] - B_RANGE[0]) * j) / (res - 1);
  const t = (a: number, b: number) => (Math.abs(b - a) < 1e-12 ? 0.5 : -a / (b - a));
  let d = "";

  for (let j = 0; j < res - 1; j++) {
    for (let i = 0; i < res - 1; i++) {
      const v00 = at(i, j);
      const v10 = at(i + 1, j);
      const v11 = at(i + 1, j + 1);
      const v01 = at(i, j + 1);
      const code = (v00 > 0 ? 1 : 0) | (v10 > 0 ? 2 : 0) | (v11 > 0 ? 4 : 0) | (v01 > 0 ? 8 : 0);
      if (code === 0 || code === 15) continue;

      const bottom: [number, number] = [ax(i) + (ax(i + 1) - ax(i)) * t(v00, v10), by(j)];
      const right: [number, number] = [ax(i + 1), by(j) + (by(j + 1) - by(j)) * t(v10, v11)];
      const top: [number, number] = [ax(i) + (ax(i + 1) - ax(i)) * t(v01, v11), by(j + 1)];
      const left: [number, number] = [ax(i), by(j) + (by(j + 1) - by(j)) * t(v00, v01)];
      const seg = (p: [number, number], q: [number, number]) => {
        const [x1, y1] = frame.px(p[0], p[1]);
        const [x2, y2] = frame.px(q[0], q[1]);
        d += `M${x1.toFixed(1)},${y1.toFixed(1)}L${x2.toFixed(1)},${y2.toFixed(1)}`;
      };

      switch (code) {
        case 1: case 14: seg(left, bottom); break;
        case 2: case 13: seg(bottom, right); break;
        case 3: case 12: seg(left, right); break;
        case 4: case 11: seg(right, top); break;
        case 6: case 9: seg(bottom, top); break;
        case 7: case 8: seg(left, top); break;
        case 5: case 10: {
          const centre = (v00 + v10 + v01 + v11) / 4 > 0;
          if ((code === 5) === centre) {
            seg(left, top);
            seg(bottom, right);
          } else {
            seg(left, bottom);
            seg(right, top);
          }
          break;
        }
      }
    }
  }
  return d;
}
