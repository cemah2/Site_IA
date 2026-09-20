"use client";

import * as React from "react";
import { PageShell, SectionTitle, Workbench } from "@/components/layout/PageShell";
import { Button, Callout, Divider, Panel, Segmented, Slider, Stat } from "@/components/ui";
import { G } from "@/components/ui/Glossary";
import { Levels } from "@/components/ui/Levels";
import { PredictFirst } from "@/components/lab/Practice";
import { Quiz } from "@/components/lab/Quiz";
import { LiveFormula, Tex } from "@/components/math/Math";
import { CostSurface3D } from "@/components/viz/CostSurface3D";
import { LineChart } from "@/components/viz/LineChart";
import { Plot } from "@/components/viz/Plot";
import {
  gradientDescent,
  leastSquares,
  lineCost,
  type GdStep,
  type Optimiser,
} from "@/lib/ml/models/regression";
import type { Point2 } from "@/lib/ml/models/regression";
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

      <SectionTitle hint="La descente simple n'est presque jamais celle qu'on utilise vraiment.">
        Trois façons de descendre
      </SectionTitle>

      <OptimiserRace points={points} />

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


        <PredictFirst
          id="gd-big-lr"
          className="mb-5"
          question={
            <>
              La surface de coût d&apos;une régression linéaire n&apos;a qu&apos;un seul minimum. Avec
              un pas beaucoup trop grand, où finit la bille ?
            </>
          }
          options={[
            "Au minimum, mais lentement",
            "Dans un autre minimum",
            "Nulle part : elle s'éloigne de plus en plus",
          ]}
          answer={2}
          explanation={
            <>
              Un pas trop long saute par-dessus le fond et atterrit plus haut de l&apos;autre côté ;
              la pente y est plus forte, donc le pas suivant est plus long encore. Le mécanisme
              s&apos;emballe tout seul. « Un autre minimum » est impossible ici — il n&apos;y en a
              qu&apos;un — mais deviendra la bonne réponse sur un réseau de neurones.
            </>
          }
        />
        <Quiz
          questions={[
            {
              id: "gd1",
              question: "Le learning rate est trop grand. Qu'observe-t-on sur la courbe de coût ?",
              options: [
                { id: "a", label: "Elle descend très lentement" },
                { id: "b", label: "Elle oscille et peut remonter jusqu'à exploser" },
                { id: "c", label: "Elle se stabilise à une valeur trop élevée" },
              ],
              answer: 1,
              explanation: (
                <>
                  Un pas trop long saute par-dessus le minimum et atterrit plus haut de
                  l&apos;autre côté ; au pas suivant, la pente est plus forte encore, donc le pas
                  est plus long. Le mécanisme s&apos;emballe de lui-même. La réponse (a) décrit un{" "}
                  <G t="learningrate">learning rate</G> trop <em>petit</em>, et la réponse (c)
                  décrit un minimum local — un autre problème.
                </>
              ),
            },
            {
              id: "gd2",
              question: "Que se passe-t-il quand le gradient devient nul ?",
              options: [
                { id: "a", label: "Le modèle a trouvé la meilleure solution possible" },
                {
                  id: "b",
                  label:
                    "Les pas s'arrêtent, mais rien ne garantit que ce point soit le minimum global",
                },
                { id: "c", label: "L'algorithme redémarre ailleurs" },
              ],
              answer: 1,
              explanation: (
                <>
                  Le <G t="gradient">gradient</G> est local : il dit seulement qu&apos;on est au
                  fond d&apos;<em>une</em> cuvette. Sur la surface de coût d&apos;une régression
                  linéaire il n&apos;y en a qu&apos;une, donc c&apos;est bien le minimum global ;
                  sur celle d&apos;un réseau de neurones, il y en a une infinité. Rien dans
                  l&apos;algorithme ne permet de faire la différence.
                </>
              ),
            },
            {
              id: "gd3",
              question:
                "Deux paramètres ont des échelles très différentes : la cuvette de coût est un ravin allongé. Quel est l'effet ?",
              options: [
                { id: "a", label: "Aucun, la descente suit la pente" },
                {
                  id: "b",
                  label:
                    "La trajectoire zigzague en travers du ravin et avance très lentement dans le sens de la longueur",
                },
                { id: "c", label: "La descente diverge systématiquement" },
              ],
              answer: 1,
              explanation: (
                <>
                  Le gradient pointe vers la plus forte pente, qui est la pente <em>latérale</em>
                  du ravin, pas sa direction de descente. On rebondit donc de paroi en paroi.
                  C&apos;est le second grand argument pour{" "}
                  <G t="normalisation">normaliser les features</G> — le premier étant les
                  distances — et la raison d&apos;être des optimiseurs à moment.
                </>
              ),
            },
          ]}
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

const RACERS: { id: Optimiser; label: string; colour: string; blurb: string }[] = [
  {
    id: "sgd",
    label: "Descente simple",
    colour: SERIES[0],
    blurb: "Un pas proportionnel à la pente. Rien d'autre.",
  },
  {
    id: "momentum",
    label: "Momentum",
    colour: SERIES[1],
    blurb: "Le pas garde l'élan des précédents, comme une bille qui prend de la vitesse.",
  },
  {
    id: "adam",
    label: "Adam",
    colour: SERIES[2],
    blurb: "Chaque coordonnée avance à son propre rythme, normalisée par l'ampleur de ses gradients.",
  },
];

/**
 * The same surface, the same start, three update rules.
 *
 * The honest version of this comparison, and the reason it is worth a section:
 * on a round bowl the plain descent wins, and Adam — which the literature
 * treats as the default — is the slowest of the three. Its advantage only
 * appears when the surface is badly conditioned, which is why the shape of the
 * valley is a control here rather than a fixed choice.
 */
function OptimiserRace({ points }: { points: Point2[] }) {
  const [shape, setShape] = React.useState<"bowl" | "ravine">("ravine");
  const [lr, setLr] = React.useState(0.04);
  const [adamLr, setAdamLr] = React.useState(0.3);
  const [step, setStep] = React.useState(150);
  const STEPS = 150;
  const START: [number, number] = [-2.1, 2.4];

  // Shifting the x values away from zero makes the slope and the intercept
  // strongly correlated, which turns the round bowl into a long narrow valley.
  // The points themselves are untouched — only where they sit on the axis.
  const racePoints = React.useMemo(
    () => (shape === "bowl" ? points : points.map((p) => ({ ...p, x: p.x + 1.6 }))),
    [points, shape],
  );

  const costAt = React.useCallback(
    (a: number, b: number) => lineCost(racePoints, a, b),
    [racePoints],
  );
  const optimum = React.useMemo(() => leastSquares(racePoints), [racePoints]);
  const floor = costAt(optimum.slope, optimum.intercept);

  const traces = React.useMemo(
    () =>
      RACERS.map((r) => ({
        ...r,
        trace: gradientDescent(racePoints, {
          lr: r.id === "adam" ? adamLr : lr,
          steps: STEPS,
          slope0: START[0],
          intercept0: START[1],
          optimiser: r.id,
        }),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [racePoints, lr, adamLr],
  );

  const levels = React.useMemo(() => {
    const max = Math.max(costAt(A_RANGE[0], B_RANGE[0]), costAt(A_RANGE[1], B_RANGE[1]));
    return Array.from({ length: 11 }, (_, i) => floor + (max - floor) * ((i + 1) / 12) ** 2.1);
  }, [costAt, floor]);

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

  // "Arrived" means within 5 % of the best cost this surface allows — a
  // threshold, not a promise, but the same one for all three.
  const reached = traces.map((t) => {
    const i = t.trace.findIndex((s) => s.cost < floor * 1.05);
    return { id: t.id, steps: i < 0 ? null : i, final: t.trace[t.trace.length - 1].cost };
  });

  const upTo = Math.min(step, STEPS);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
      <Panel
        title="La course"
        subtitle="Même surface, même point de départ, trois règles de mise à jour"
        bodyClassName="p-3"
      >
        <Plot
          xDomain={A_RANGE}
          yDomain={B_RANGE}
          aspect={0.8}
          maxWidth={620}
          xLabel="pente a"
          yLabel="ordonnée b"
          ariaLabel="Trajectoires de trois optimiseurs sur les courbes de niveau du coût"
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
                  opacity={0.3 + (0.35 * (levels.length - i)) / levels.length}
                />
              ))}

              {traces.map((t) => {
                const pts = t.trace.slice(0, upTo + 1).filter((s) => Number.isFinite(s.cost));
                const head = pts[pts.length - 1];
                return (
                  <g key={t.id}>
                    <path
                      d={pts
                        .map((s, i) => {
                          const [x, y] = frame.px(s.slope, s.intercept);
                          return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
                        })
                        .join("")}
                      fill="none"
                      stroke={t.colour}
                      strokeWidth={2}
                      strokeLinejoin="round"
                      opacity={0.9}
                    />
                    {head && (
                      <circle
                        cx={frame.px(head.slope, head.intercept)[0]}
                        cy={frame.px(head.slope, head.intercept)[1]}
                        r={5}
                        fill={t.colour}
                        stroke={CHROME.surface1}
                        strokeWidth={2}
                      />
                    )}
                  </g>
                );
              })}

              <path
                d={`M${frame.px(optimum.slope, optimum.intercept)[0] - 7},${frame.px(optimum.slope, optimum.intercept)[1]}h14M${frame.px(optimum.slope, optimum.intercept)[0]},${frame.px(optimum.slope, optimum.intercept)[1] - 7}v14`}
                stroke={CHROME.ink}
                strokeWidth={1.75}
              />
            </g>
          )}
        </Plot>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-2.5 text-[11px]">
          {RACERS.map((r) => (
            <span key={r.id} className="inline-flex items-center gap-1.5 text-ink-2">
              <svg width="18" height="6" aria-hidden>
                <line x1="0" y1="3" x2="18" y2="3" stroke={r.colour} strokeWidth="2.5" />
              </svg>
              {r.label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5 text-ink-muted">
            <svg width="14" height="14" aria-hidden>
              <path d="M2,7h10M7,2v10" stroke={CHROME.ink} strokeWidth="1.75" />
            </svg>
            optimum
          </span>
        </div>

        <div className="mt-4 border-t border-line pt-3">
          <p className="mb-1.5 text-[11px] font-medium text-ink-2">
            Coût au fil des pas — échelle logarithmique, sans quoi les trois courbes se
            confondent au fond
          </p>
          <LineChart
            series={traces.map((t) => ({
              key: t.id,
              label: t.label,
              color: t.colour,
              points: t.trace
                .slice(0, upTo + 1)
                .filter((s) => Number.isFinite(s.cost) && s.cost > 0)
                .map((s) => ({ x: s.step, y: Math.log10(s.cost) })),
            }))}
            height={180}
            xLabel="pas"
            yFormat={(v) => `10^${v.toFixed(1)}`}
            zeroFloor={false}
          />
        </div>
      </Panel>

      <div className="space-y-4">
        <Panel title="Réglages" bodyClassName="space-y-4 p-4">
          <Segmented
            label="Forme de la cuvette"
            value={shape}
            options={[
              { value: "bowl", label: "Ronde" },
              { value: "ravine", label: "Ravin" },
            ]}
            onChange={(v) => setShape(v as "bowl" | "ravine")}
            size="sm"
          />
          <p className="text-[11px] leading-snug text-ink-muted">
            {shape === "bowl"
              ? "Cuvette bien proportionnée : la direction de plus forte pente pointe à peu près vers le fond."
              : "Les mêmes points, décalés le long de l'axe des x. Ça suffit à corréler la pente et l'ordonnée, et la cuvette devient une vallée étroite où la plus forte pente pointe vers la paroi d'en face, pas vers le fond."}
          </p>

          <Slider
            label="Pas — descente simple et momentum"
            value={lr}
            min={0.005}
            max={0.2}
            step={0.005}
            onChange={setLr}
            format={(v) => v.toFixed(3)}
          />
          <Slider
            label="Pas — Adam"
            value={adamLr}
            min={0.02}
            max={1}
            step={0.02}
            onChange={setAdamLr}
            format={(v) => v.toFixed(2)}
            hint="Séparé, et c'est le point : Adam divise par l'ampleur des gradients, donc son pas vaut à peu près ce nombre quelle que soit la pente. Il vit sur une autre échelle."
          />
          <Slider
            label="Pas affichés"
            value={step}
            min={0}
            max={STEPS}
            step={1}
            onChange={setStep}
            hint="Ramenez-le à zéro puis remontez pour rejouer la course."
          />
        </Panel>

        <Panel title="Qui arrive, et en combien de pas" subtitle="Seuil : à 5 % du meilleur coût">
          <div className="space-y-2">
            {reached.map((r) => {
              const racer = RACERS.find((x) => x.id === r.id)!;
              return (
                <div
                  key={r.id}
                  className="rounded-lg border border-line bg-surface-2/50 px-3 py-2"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[12px] font-medium" style={{ color: racer.colour }}>
                      {racer.label}
                    </span>
                    <span className="tnum text-[12px] text-ink">
                      {r.steps === null ? "pas arrivé" : `${r.steps} pas`}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10.5px] leading-snug text-ink-muted">
                    {racer.blurb}
                  </p>
                </div>
              );
            })}
          </div>
        </Panel>

        <Callout kind="insight" title="Adam n'est pas magique">
          Sur la cuvette ronde, la descente simple gagne — et c&apos;est mesurable ici, pas une
          opinion. L&apos;avantage de momentum et d&apos;Adam apparaît sur le ravin, où la plus
          forte pente pointe vers la paroi d&apos;en face : la descente simple y rebondit sans
          avancer, momentum lisse ces allers-retours, et Adam, qui donne à chaque coordonnée son
          propre pas, se moque de la disproportion entre les axes. Sur un vrai réseau, toutes les
          surfaces ressemblent à des ravins — d&apos;où le réglage par défaut de la profession.
        </Callout>
      </div>
    </div>
  );
}
