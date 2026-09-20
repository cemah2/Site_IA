"use client";

import * as React from "react";
import { PageShell, SectionTitle, Workbench } from "@/components/layout/PageShell";
import { Callout, Divider, Panel, Slider, Stat } from "@/components/ui";
import { G } from "@/components/ui/Glossary";
import { Levels } from "@/components/ui/Levels";
import { Quiz } from "@/components/lab/Quiz";
import { LiveFormula, Tex } from "@/components/math/Math";
import { LineChart } from "@/components/viz/LineChart";
import { Plot } from "@/components/viz/Plot";
import { gaussian, makeRng } from "@/lib/rng";
import { polyEval, polyFit, type Point2 } from "@/lib/ml/models/regression";
import { CHROME, SERIES, STATUS, withAlpha } from "@/lib/viz/palette";

const DOMAIN: [number, number] = [-3, 3];
const Y_DOMAIN: [number, number] = [-2.6, 2.6];

/** The ground truth the samples are drawn from. Known exactly, which is what
 *  makes an actual bias/variance decomposition possible rather than a story. */
function truth(x: number): number {
  return 1.5 * Math.sin(x * 1.05) - 0.18 * x;
}

function sampleDataset(seed: number, n: number, noise: number): Point2[] {
  const rng = makeRng(seed);
  return Array.from({ length: n }, (_, i) => {
    const x = DOMAIN[0] + ((DOMAIN[1] - DOMAIN[0]) * (i + 0.5)) / n + gaussian(rng) * 0.1;
    return { id: i, x, y: truth(x) + gaussian(rng) * noise };
  });
}

export function BiasVarianceLab() {
  const [degree, setDegree] = React.useState(3);
  const [nSamples, setNSamples] = React.useState(20);
  const [nPoints, setNPoints] = React.useState(16);
  const [noise, setNoise] = React.useState(0.35);

  // Fit the SAME model family on many independent resamples. The spread of the
  // resulting curves IS the variance; the average curve's distance from the
  // truth IS the bias. Nothing here is illustrative — both are computed.
  const fits = React.useMemo(
    () =>
      Array.from({ length: nSamples }, (_, s) =>
        polyFit(sampleDataset(1000 + s * 97, nPoints, noise), degree, 1e-8),
      ),
    [nSamples, nPoints, noise, degree],
  );

  const grid = React.useMemo(() => {
    const xs: number[] = [];
    for (let x = DOMAIN[0]; x <= DOMAIN[1]; x += 0.04) xs.push(x);
    return xs;
  }, []);

  const decomposition = React.useMemo(() => {
    let bias2 = 0;
    let variance = 0;
    for (const x of grid) {
      const preds = fits.map((c) => polyEval(c, x));
      const mean = preds.reduce((a, b) => a + b, 0) / preds.length;
      bias2 += (mean - truth(x)) ** 2;
      variance += preds.reduce((a, p) => a + (p - mean) ** 2, 0) / preds.length;
    }
    return {
      bias2: bias2 / grid.length,
      variance: variance / grid.length,
      noise: noise ** 2,
    };
  }, [fits, grid, noise]);

  const total = decomposition.bias2 + decomposition.variance + decomposition.noise;

  const sweep = React.useMemo(() => {
    const out: { degree: number; bias2: number; variance: number; total: number }[] = [];
    for (let d = 1; d <= 12; d++) {
      const f = Array.from({ length: Math.min(nSamples, 20) }, (_, s) =>
        polyFit(sampleDataset(1000 + s * 97, nPoints, noise), d, 1e-8),
      );
      let b = 0;
      let v = 0;
      for (const x of grid) {
        const preds = f.map((c) => polyEval(c, x));
        const mean = preds.reduce((a, p) => a + p, 0) / preds.length;
        b += (mean - truth(x)) ** 2;
        v += preds.reduce((a, p) => a + (p - mean) ** 2, 0) / preds.length;
      }
      b /= grid.length;
      v /= grid.length;
      out.push({ degree: d, bias2: b, variance: v, total: b + v + noise ** 2 });
    }
    return out;
  }, [nSamples, nPoints, noise, grid]);

  const bestDegree = sweep.reduce((a, b) => (b.total < a.total ? b : a)).degree;

  const meanCurve = React.useMemo(
    () => grid.map((x) => fits.reduce((a, c) => a + polyEval(c, x), 0) / fits.length),
    [grid, fits],
  );

  return (
    <PageShell
      eyebrow="Concepts"
      title="Biais et variance"
      lede={
        <>
          Il y a deux façons de se tromper, et elles s&apos;opposent. Le{" "}
          <strong>biais</strong>, c&apos;est se tromper systématiquement, toujours dans le même
          sens. La <strong>variance</strong>, c&apos;est être instable : donner une réponse
          très différente selon l&apos;échantillon qu&apos;on a eu la chance de recevoir. Ici,
          les deux sont <em>calculées</em>, pas illustrées.
        </>
      }
      wide
    >
      <Workbench
        plot={
          <div className="space-y-5">
            <Panel
              title={`${nSamples} modèles, ${nSamples} échantillons différents`}
              subtitle="Même famille de modèle, même degré. Seules les données changent."
              bodyClassName="p-3"
            >
              <Plot
                xDomain={DOMAIN}
                yDomain={Y_DOMAIN}
                aspect={0.56}
                maxWidth={660}
                xLabel="x"
                yLabel="y"
                ariaLabel="Faisceau de modèles ajustés sur des échantillons différents"
              >
                {(frame) => (
                  <g clipPath="url(#plot-clip)">
                    {/* Every individual fit, faint: the fan-out is the variance. */}
                    {fits.map((c, i) => (
                      <path
                        key={i}
                        d={curvePath(grid, (x) => polyEval(c, x), frame)}
                        fill="none"
                        stroke={withAlpha(SERIES[0], 0.28)}
                        strokeWidth={1.25}
                      />
                    ))}
                    <path
                      d={curvePath(grid, (x) => truth(x), frame)}
                      fill="none"
                      stroke={CHROME.ink}
                      strokeWidth={2.5}
                      strokeDasharray="6 4"
                    />
                    <path
                      d={curvePathFrom(grid, meanCurve, frame)}
                      fill="none"
                      stroke={STATUS.warning}
                      strokeWidth={2.5}
                    />
                  </g>
                )}
              </Plot>
              <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] text-ink-muted">
                <span className="inline-flex items-center gap-1.5">
                  <svg width="18" height="6" aria-hidden>
                    <line x1="0" y1="3" x2="18" y2="3" stroke={CHROME.ink} strokeWidth="2.5" strokeDasharray="6 4" />
                  </svg>
                  la vraie fonction
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <svg width="18" height="6" aria-hidden>
                    <line x1="0" y1="3" x2="18" y2="3" stroke={STATUS.warning} strokeWidth="2.5" />
                  </svg>
                  le modèle <em>moyen</em>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <svg width="18" height="6" aria-hidden>
                    <line x1="0" y1="3" x2="18" y2="3" stroke={withAlpha(SERIES[0], 0.55)} strokeWidth="1.5" />
                  </svg>
                  les {nSamples} modèles individuels
                </span>
              </div>
              <p className="mt-2.5 text-[11px] leading-relaxed text-ink-2">
                <strong>Le biais</strong> est l&apos;écart entre le trait orange et le trait
                pointillé. <strong>La variance</strong> est la largeur du faisceau bleu. Un
                modèle idéal aurait les deux à zéro — ce qui est impossible dès que les données
                sont bruitées.
              </p>
            </Panel>

            <Panel
              title="La décomposition, degré par degré"
              subtitle="Le biais descend, la variance monte. Leur somme passe par un minimum."
            >
              <LineChart
                series={[
                  {
                    key: "bias",
                    label: "biais²",
                    color: SERIES[1],
                    points: sweep.map((s) => ({ x: s.degree, y: s.bias2 })),
                  },
                  {
                    key: "var",
                    label: "variance",
                    color: SERIES[0],
                    points: sweep.map((s) => ({ x: s.degree, y: s.variance })),
                  },
                  {
                    key: "total",
                    label: "erreur totale",
                    color: SERIES[3],
                    dashed: true,
                    points: sweep.map((s) => ({ x: s.degree, y: s.total })),
                  },
                ]}
                height={230}
                marker={degree}
                xLabel="degré"
                yDomain={[0, Math.min(2, Math.max(...sweep.map((s) => s.total)) * 1.1)]}
                yFormat={(v) => v.toFixed(2)}
              />
              <p className="mt-2 text-[11px] leading-snug text-ink-muted">
                Minimum de l&apos;erreur totale au{" "}
                <strong className="text-ink">degré {bestDegree}</strong>. C&apos;est le point
                d&apos;équilibre : ni assez simple pour manquer la structure, ni assez libre
                pour suivre le bruit.
              </p>
            </Panel>
          </div>
        }
        controls={
          <>
            <Slider
              label="Degré du polynôme"
              value={degree}
              min={1}
              max={12}
              onChange={setDegree}
              hint={
                degree <= 2
                  ? "Faible capacité : tous les modèles se ressemblent (variance basse) mais tous ratent la vraie courbe de la même façon (biais élevé)."
                  : degree >= 9
                    ? "Forte capacité : chaque modèle suit son propre échantillon. Le faisceau s'ouvre — c'est de la variance pure."
                    : undefined
              }
            />
            <Divider label="Protocole" />
            <Slider
              label="Nombre d'échantillons"
              value={nSamples}
              min={4}
              max={40}
              step={2}
              onChange={setNSamples}
              hint="Chacun est un tirage indépendant de la même distribution. C'est ce qui permet de mesurer la variance."
            />
            <Slider
              label="Points par échantillon"
              value={nPoints}
              min={6}
              max={60}
              step={2}
              onChange={setNPoints}
              hint="Plus de données par échantillon : la variance chute, le biais ne bouge pas."
            />
            <Slider
              label="Bruit"
              value={noise}
              min={0}
              max={1}
              step={0.05}
              onChange={setNoise}
              format={(v) => v.toFixed(2)}
              hint="Le terme irréductible. Aucun modèle, aucune quantité de données ne peut le faire descendre."
            />
          </>
        }
        below={
          <>
            <Panel title="La décomposition ici" subtitle={`Degré ${degree}, moyenne sur ${nSamples} échantillons`}>
              <ul className="space-y-2">
                {[
                  { label: "Biais²", value: decomposition.bias2, color: SERIES[1] },
                  { label: "Variance", value: decomposition.variance, color: SERIES[0] },
                  { label: "Bruit (irréductible)", value: decomposition.noise, color: CHROME.inkMuted },
                ].map((row) => (
                  <li key={row.label}>
                    <div className="mb-0.5 flex items-baseline justify-between text-[11px]">
                      <span className="text-ink-2">{row.label}</span>
                      <span className="tnum font-semibold text-ink">{row.value.toFixed(4)}</span>
                    </div>
                    <span className="block h-2 overflow-hidden rounded-full bg-surface-3">
                      <span
                        className="block h-full rounded-full transition-all"
                        style={{
                          width: `${(row.value / (total || 1)) * 100}%`,
                          background: row.color,
                        }}
                      />
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-baseline justify-between border-t border-line pt-2.5 text-[12px]">
                <span className="text-ink-2">Erreur attendue totale</span>
                <span className="tnum font-semibold text-ink">{total.toFixed(4)}</span>
              </div>
            </Panel>

            <div className="grid grid-cols-2 gap-2">
              <Stat
                label="Régime"
                value={
                  decomposition.bias2 > decomposition.variance * 2
                    ? "Biais dominant"
                    : decomposition.variance > decomposition.bias2 * 2
                      ? "Variance dominante"
                      : "Équilibré"
                }
              />
              <Stat
                label="Degré optimal ici"
                value={bestDegree}
                tone={degree === bestDegree ? "good" : "neutral"}
                hint={degree === bestDegree ? "Vous y êtes" : `Actuellement ${degree}`}
              />
            </div>

            <Callout
              kind={decomposition.bias2 > decomposition.variance * 2 ? "warning" : "insight"}
              title={
                decomposition.bias2 > decomposition.variance * 2
                  ? "Le biais domine"
                  : decomposition.variance > decomposition.bias2 * 2
                    ? "La variance domine"
                    : "Les deux s'équilibrent"
              }
            >
              {decomposition.bias2 > decomposition.variance * 2
                ? "Tous les modèles se ressemblent, et tous ratent la vraie courbe au même endroit. Ajouter des données ne servirait à rien : il faut plus de capacité."
                : decomposition.variance > decomposition.bias2 * 2
                  ? "Le modèle moyen est correct, mais chaque modèle individuel s'en écarte beaucoup. Ici, plus de données aiderait directement — montez « Points par échantillon » et regardez le faisceau se resserrer."
                  : "Ni le biais ni la variance ne domine : c'est la zone où un modèle est bien dimensionné pour ces données."}
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
                Un tireur à l&apos;arc, et une cible.
              </p>
              <p>
                <strong>Biais élevé, variance faible</strong> : toutes les flèches sont groupées,
                mais à côté du centre. Le tireur est régulier — et régulièrement à côté. Son arc
                est mal réglé, pas sa main.
              </p>
              <p>
                <strong>Biais faible, variance élevée</strong> : les flèches sont dispersées
                tout autour du centre. En moyenne il vise juste, mais aucune flèche
                individuelle n&apos;est fiable.
              </p>
              <p>
                <strong>Les deux élevés</strong> : dispersées <em>et</em> décalées. Le pire cas.
              </p>
              <p>
                Ce qu&apos;on cherche, c&apos;est groupé et centré. Et le problème est que{" "}
                <strong>les deux tirent en sens inverse</strong> : un modèle plus flexible
                s&apos;approche du centre en moyenne, mais devient plus dispersé.
              </p>
            </>
          }
          technique={
            <>
              <p>
                <strong>Le biais</strong> est l&apos;erreur du modèle <em>moyen</em> : ce
                qu&apos;aucune quantité de données ne corrigera, parce que la famille de modèles
                ne contient pas la bonne fonction. Une droite qui essaie d&apos;approcher une
                sinusoïde a un biais, et il ne dépend ni du bruit ni de la taille de
                l&apos;échantillon.
              </p>
              <p>
                <strong>La variance</strong> est la sensibilité du modèle à l&apos;échantillon
                particulier qu&apos;il a reçu. Elle décroît quand les données augmentent — c&apos;est
                la seule des trois composantes sur laquelle plus de données agit directement.
              </p>
              <p>
                <strong>Le bruit</strong> est irréductible. Si <Tex>y = f(x) + \epsilon</Tex>{" "}
                avec <Tex>{String.raw`\epsilon`}</Tex> imprévisible, aucun modèle ne peut prédire{" "}
                <Tex>{String.raw`\epsilon`}</Tex>. C&apos;est le plancher — l&apos;erreur de
                Bayes.
              </p>
              <p>
                <strong>Ce qui agit sur quoi.</strong> Plus de capacité : biais ↓, variance ↑.
                Plus de données : variance ↓, biais inchangé. Plus de régularisation : variance
                ↓, biais ↑. Ensembles (bagging) : variance ↓, biais quasi inchangé — ce qui
                explique pourquoi Random Forest marche si bien.
              </p>
            </>
          }
          maths={
            <>
              <p>
                Pour un point <Tex>x</Tex> fixé, en prenant l&apos;espérance sur tous les jeux
                d&apos;entraînement possibles <Tex>D</Tex> et sur le bruit :
              </p>
              <LiveFormula
                tex={String.raw`\mathbb{E}_{D, \epsilon}\bigl[(y - \hat{f}_D(x))^2\bigr]
                  = \underbrace{\bigl(\mathbb{E}_D[\hat{f}_D(x)] - f(x)\bigr)^2}_{\text{biais}^2(x)}
                  + \underbrace{\mathbb{E}_D\bigl[(\hat{f}_D(x) - \mathbb{E}_D[\hat{f}_D(x)])^2\bigr]}_{\text{variance}(x)}
                  + \sigma^2`}
              />
              <p>
                <strong>C&apos;est exactement ce que la page calcule.</strong> Les{" "}
                {nSamples} échantillons approchent l&apos;espérance sur <Tex>D</Tex> ; le trait
                orange est <Tex>{String.raw`\mathbb{E}_D[\hat{f}_D]`}</Tex> ; le trait pointillé
                est <Tex>f</Tex> ; la largeur du faisceau est la variance.
              </p>
              <p>
                La démonstration tient en une ligne : on ajoute et retranche{" "}
                <Tex>{String.raw`\mathbb{E}_D[\hat{f}_D(x)]`}</Tex>, on développe le carré, et le
                double produit s&apos;annule car{" "}
                <Tex>{String.raw`\mathbb{E}_D[\hat{f}_D - \mathbb{E}_D[\hat{f}_D]] = 0`}</Tex>.
              </p>
              <p>
                <strong>Effet du bagging.</strong> Pour <Tex>B</Tex> modèles de variance{" "}
                <Tex>{String.raw`\sigma^2`}</Tex> et de corrélation{" "}
                <Tex>{String.raw`\rho`}</Tex> :
              </p>
              <LiveFormula
                tex={String.raw`\mathrm{Var}\!\left(\frac{1}{B}\sum_b \hat{f}_b\right) = \rho\sigma^2 + \frac{1-\rho}{B}\sigma^2`}
              />
              <p>
                Le biais de la moyenne est le biais de chacun — inchangé. Seule la variance
                baisse. C&apos;est pourquoi on fait du bagging sur des modèles{" "}
                <em>à faible biais et forte variance</em> (des arbres profonds), jamais sur des
                modèles très contraints.
              </p>
              <Callout kind="note" title="Une limite de cette décomposition">
                Elle est exacte pour l&apos;erreur quadratique. Pour une perte 0-1
                (classification), il n&apos;existe pas de décomposition additive aussi propre :
                les définitions proposées dans la littérature diffèrent. L&apos;intuition reste
                valable, la formule ne se transpose pas telle quelle.
              </Callout>
            </>
          }
        />


        <Quiz
          questions={[
            {
              id: "bv1",
              question: "Qu'est-ce que la variance d'un modèle, concrètement ?",
              options: [
                { id: "a", label: "L'écart entre ses prédictions et la vérité" },
                {
                  id: "b",
                  label:
                    "De combien il changerait si on l'entraînait sur un autre échantillon tiré de la même source",
                },
                { id: "c", label: "La dispersion des données d'entrée" },
              ],
              answer: 1,
              explanation: (
                <>
                  La <G t="variance">variance</G> est une propriété de la <em>procédure</em>, pas
                  d&apos;un modèle donné : elle se mesure en réentraînant sur des échantillons
                  différents et en regardant à quel point les courbes obtenues divergent. C&apos;est
                  exactement ce que dessine le faisceau de cette page. Le{" "}
                  <G t="biais">biais</G>, lui, est l&apos;erreur qui reste même en moyennant
                  toutes ces courbes.
                </>
              ),
            },
            {
              id: "bv2",
              question: "Un modèle à fort biais et faible variance, à quoi ressemble-t-il ?",
              options: [
                { id: "a", label: "Il colle aux données et change à chaque réentraînement" },
                {
                  id: "b",
                  label:
                    "Il se trompe régulièrement, mais toujours de la même façon — comme une droite sur une courbe",
                },
                { id: "c", label: "Il est très précis partout" },
              ],
              answer: 1,
              explanation: (
                <>
                  Stable et faux : réentraîné sur d&apos;autres données, il donne presque la même
                  droite, et cette droite rate la courbure de la même manière. C&apos;est le
                  degré 1 dans les contrôles. La réponse (a) décrit exactement l&apos;inverse —
                  faible biais, forte variance, c&apos;est-à-dire le degré 15.
                </>
              ),
            },
            {
              id: "bv3",
              question: "Pourquoi l'erreur totale ne peut-elle jamais descendre à zéro ?",
              options: [
                { id: "a", label: "Parce qu'aucun modèle n'est parfait" },
                {
                  id: "b",
                  label:
                    "Parce qu'une part de l'erreur vient du bruit des données elles-mêmes, qu'aucun modèle ne peut expliquer",
                },
                { id: "c", label: "Parce que le calcul est approché" },
              ],
              answer: 1,
              explanation: (
                <>
                  L&apos;erreur se décompose en biais² + variance + bruit irréductible. Ce
                  dernier terme ne dépend pas du modèle : si la même entrée peut donner deux
                  sorties différentes, aucune fonction ne peut produire les deux. Un modèle qui
                  prétend atteindre zéro sur des données bruitées est en train de mémoriser le
                  bruit — c&apos;est-à-dire de sur-apprendre.
                </>
              ),
            },
          ]}
        />

        <div className="space-y-4">
          <Callout kind="insight" title="Les trois expériences">
            <ul className="mt-1.5 space-y-1.5">
              <li>
                <strong>Degré 1.</strong> Le faisceau est une bande fine — variance quasi nulle
                — mais franchement décalée de la vraie courbe. Biais pur.
              </li>
              <li>
                <strong>Degré 11.</strong> Le faisceau explose aux bords : chaque modèle part
                dans sa direction. Variance pure.
              </li>
              <li>
                <strong>Degré 11, puis 60 points par échantillon.</strong> Le faisceau se
                resserre nettement. Avec assez de données, un modèle complexe cesse d&apos;être
                dangereux — c&apos;est exactement ce qui rend les grands modèles possibles.
              </li>
            </ul>
          </Callout>

          <Callout kind="note" title="Pourquoi on ne peut pas faire ça en vrai">
            Cette page connaît la vraie fonction et peut tirer autant d&apos;échantillons
            qu&apos;elle veut. Sur des données réelles, on n&apos;a ni l&apos;une ni les autres :
            on estime la somme des trois termes par validation croisée, sans jamais pouvoir les
            séparer. La décomposition est un outil de <em>raisonnement</em>, pas de mesure.
          </Callout>
        </div>
      </div>
    </PageShell>
  );
}

function curvePath(
  grid: number[],
  f: (x: number) => number,
  frame: { px: (x: number, y: number) => [number, number] },
): string {
  return curvePathFrom(grid, grid.map(f), frame);
}

function curvePathFrom(
  grid: number[],
  values: number[],
  frame: { px: (x: number, y: number) => [number, number] },
): string {
  const pts: string[] = [];
  for (let i = 0; i < grid.length; i++) {
    const y = Math.max(Y_DOMAIN[0] - 1, Math.min(Y_DOMAIN[1] + 1, values[i]));
    const [px, py] = frame.px(grid[i], y);
    pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
  }
  return `M${pts.join("L")}`;
}
