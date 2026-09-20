"use client";

import * as React from "react";
import { PageShell, SectionTitle, Workbench } from "@/components/layout/PageShell";
import { Button, Callout, Divider, Panel, Segmented, Slider, Stat } from "@/components/ui";
import { G } from "@/components/ui/Glossary";
import { Levels } from "@/components/ui/Levels";
import { Narrator } from "@/components/lab/Narrator";
import { Quiz } from "@/components/lab/Quiz";
import { LiveFormula, Tex } from "@/components/math/Math";
import { LineChart } from "@/components/viz/LineChart";
import { Plot } from "@/components/viz/Plot";
import { polyEval, polyFit, type Point2 } from "@/lib/ml/models/regression";
import { formatNumber } from "@/lib/viz/geometry";
import { CHROME, DIVERGING, rampAt, SERIES, STATUS } from "@/lib/viz/palette";
import { REGRESSION_DOMAIN, REGRESSION_SHAPES, useRegression, type RegressionShape } from "@/store/regression";

const LAMBDAS = [0, 1e-6, 1e-5, 1e-4, 1e-3, 1e-2, 0.1, 1, 10];

export function RegularisationLab() {
  const { points, shape, setShape, noise, setNoise, reseed } = useRegression();
  const [degree, setDegree] = React.useState(11);
  const [lambdaIdx, setLambdaIdx] = React.useState(0);

  const lambda = LAMBDAS[lambdaIdx];

  const split = React.useMemo(() => {
    const train = points.filter((_, i) => i % 3 !== 0);
    const val = points.filter((_, i) => i % 3 === 0);
    return { train, val };
  }, [points]);

  const coeffs = React.useMemo(
    () => polyFit(split.train, degree, Math.max(lambda, 1e-12)),
    [split.train, degree, lambda],
  );

  const sweep = React.useMemo(
    () =>
      LAMBDAS.map((l, i) => {
        const c = polyFit(split.train, degree, Math.max(l, 1e-12));
        return {
          i,
          lambda: l,
          train: mse(split.train, c),
          val: mse(split.val, c),
          norm: Math.sqrt(c.slice(1).reduce((a, v) => a + v * v, 0)),
        };
      }),
    [split, degree],
  );

  const best = sweep.reduce((a, b) => (b.val < a.val ? b : a));
  const here = sweep[lambdaIdx];
  const maxCoeff = Math.max(1e-9, ...coeffs.map(Math.abs));

  return (
    <PageShell
      eyebrow="Concepts"
      title="Régularisation"
      lede={
        <>
          Plutôt que d&apos;interdire la complexité, on la <strong>fait payer</strong>. On
          ajoute au coût un terme qui pénalise les grands coefficients, et le modèle doit alors
          arbitrer : une oscillation ne vaut la peine que si elle améliore suffisamment
          l&apos;ajustement. Le résultat : un modèle qui <em>peut</em> être complexe, mais qui
          ne l&apos;est que là où les données le justifient.
        </>
      }
      wide
    >
      <Workbench
        plot={
          <div className="space-y-5">
            <Panel
              title={`Degré ${degree}, λ = ${lambda === 0 ? "0" : lambda.toExponential(0)}`}
              subtitle="Le modèle a toujours autant de paramètres. Seule la pénalité change."
              bodyClassName="p-3"
            >
              <Plot
                xDomain={[REGRESSION_DOMAIN.xMin, REGRESSION_DOMAIN.xMax]}
                yDomain={[REGRESSION_DOMAIN.yMin, REGRESSION_DOMAIN.yMax]}
                aspect={0.56}
                maxWidth={660}
                xLabel="x"
                yLabel="y"
                ariaLabel="Ajustement polynomial régularisé"
              >
                {(frame) => (
                  <g clipPath="url(#plot-clip)">
                    <path
                      d={polyPath(coeffs, frame)}
                      fill="none"
                      stroke={SERIES[0]}
                      strokeWidth={2.25}
                      strokeLinejoin="round"
                    />
                    {split.train.map((p) => (
                      <circle
                        key={`t${p.id}`}
                        cx={frame.px(p.x, p.y)[0]}
                        cy={frame.px(p.x, p.y)[1]}
                        r={4.5}
                        fill={SERIES[2]}
                        stroke={CHROME.surface1}
                        strokeWidth={1.75}
                      />
                    ))}
                    {split.val.map((p) => (
                      <circle
                        key={`v${p.id}`}
                        cx={frame.px(p.x, p.y)[0]}
                        cy={frame.px(p.x, p.y)[1]}
                        r={5}
                        fill="none"
                        stroke={STATUS.warning}
                        strokeWidth={2}
                      />
                    ))}
                  </g>
                )}
              </Plot>
            </Panel>

            <div className="grid gap-5 lg:grid-cols-2">
              <Panel
                title="Les coefficients"
                subtitle="Ce que la pénalité fait réellement : elle les écrase vers zéro."
              >
                <ul className="space-y-1.5">
                  {coeffs.map((c, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="tnum w-8 shrink-0 text-[10px] text-ink-muted">
                        a{i}
                      </span>
                      <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                        <span className="absolute inset-y-0 left-1/2 w-px bg-line-strong" />
                        <span
                          className="absolute inset-y-0 rounded-full transition-all"
                          style={{
                            left: c >= 0 ? "50%" : `${50 + (c / maxCoeff) * 50}%`,
                            width: `${(Math.abs(c) / maxCoeff) * 50}%`,
                            background: rampAt(
                              DIVERGING,
                              (Math.max(-1, Math.min(1, c / maxCoeff)) + 1) / 2,
                            ),
                          }}
                        />
                      </span>
                      <span className="tnum w-20 shrink-0 text-right text-[10px] text-ink-2">
                        {Math.abs(c) > 1000 ? c.toExponential(1) : formatNumber(c, 3)}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex items-baseline justify-between border-t border-line pt-2.5 text-[12px]">
                  <span className="text-ink-2">
                    Norme <Tex>{String.raw`\lVert a \rVert_2`}</Tex> (hors constante)
                  </span>
                  <span className="tnum font-semibold text-ink">
                    {here.norm > 1000 ? here.norm.toExponential(2) : here.norm.toFixed(3)}
                  </span>
                </div>
              </Panel>

              <Panel
                title="L'erreur en fonction de λ"
                subtitle="Une courbe en U, comme pour la complexité — mais sur un axe continu."
              >
                <LineChart
                  series={[
                    {
                      key: "train",
                      label: "entraînement",
                      color: SERIES[0],
                      points: sweep.map((s) => ({ x: s.i, y: s.train })),
                    },
                    {
                      key: "val",
                      label: "validation",
                      color: SERIES[1],
                      dashed: true,
                      points: sweep.map((s) => ({ x: s.i, y: s.val })),
                    },
                  ]}
                  height={190}
                  marker={lambdaIdx}
                  xLabel="λ"
                  xFormat={(v) => {
                    const l = LAMBDAS[Math.round(v)];
                    return l === undefined ? "" : l === 0 ? "0" : l.toExponential(0);
                  }}
                  yDomain={[0, Math.min(4, Math.max(...sweep.map((s) => s.val)) * 1.1)]}
                  yFormat={(v) => v.toFixed(2)}
                />
                <p className="mt-2 text-[11px] leading-snug text-ink-muted">
                  Meilleure validation à{" "}
                  <strong className="text-ink">
                    λ = {best.lambda === 0 ? "0" : best.lambda.toExponential(0)}
                  </strong>
                  . Trop peu : le modèle oscille. Trop : il devient une droite.
                </p>
              </Panel>
            </div>
          </div>
        }
        controls={
          <>
            <Slider
              label={
                <>
                  <Tex>{String.raw`\lambda`}</Tex> — force de la pénalité
                </>
              }
              value={lambdaIdx}
              min={0}
              max={LAMBDAS.length - 1}
              onChange={setLambdaIdx}
              format={() => (lambda === 0 ? "0" : lambda.toExponential(0))}
              hint={
                lambda === 0
                  ? "Aucune pénalité : le modèle est libre d'utiliser des coefficients énormes qui se compensent."
                  : lambda >= 1
                    ? "Pénalité écrasante : les coefficients sont forcés vers zéro et la courbe devient quasi plate."
                    : undefined
              }
            />
            <div className="flex gap-2">
              <Button size="sm" className="flex-1" onClick={() => setLambdaIdx(0)}>
                Aucune
              </Button>
              <Button size="sm" className="flex-1" onClick={() => setLambdaIdx(best.i)}>
                Optimale
              </Button>
              <Button size="sm" className="flex-1" onClick={() => setLambdaIdx(LAMBDAS.length - 1)}>
                Excessive
              </Button>
            </div>
            <Slider
              label="Degré du polynôme"
              value={degree}
              min={2}
              max={14}
              onChange={setDegree}
              hint="Gardez-le élevé : l'intérêt de la régularisation est justement de rendre un modèle sur-dimensionné utilisable."
            />
            <Divider label="Ce que ça change" />
            <Narrator
              causes={[
                { key: "lambda", label: "λ", value: here.lambda },
                { key: "degree", label: "le degré", value: degree },
              ]}
              effects={[
                {
                  key: "val",
                  label: "l'erreur de validation",
                  value: here.val,
                  // A badly regularised degree-11 fit reaches errors in the
                  // hundreds; three decimals on 776 is noise, not precision.
                  format: (v) => formatNumber(v, v >= 10 ? 1 : 3),
                  better: "down",
                  epsilon: 0.0005,
                },
                {
                  key: "norm",
                  label: "la taille des coefficients",
                  value: here.norm,
                  format: (v) => formatNumber(v, 2),
                  better: "down",
                  epsilon: 0.01,
                },
              ]}
              placeholder="Montez λ : l'erreur de validation et la taille des coefficients seront comparées ici."
            />

            <Divider label="Données" />
            <Segmented
              label="Forme"
              value={shape}
              options={REGRESSION_SHAPES.slice(0, 3).map((s) => ({
                value: s.id,
                label: s.label.split(" ")[s.label.split(" ").length - 1],
              }))}
              onChange={(v) => setShape(v as RegressionShape)}
              size="sm"
            />
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
              Autre tirage
            </Button>
          </>
        }
        below={
          <>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Erreur d'entraînement" value={here.train.toFixed(4)} />
              <Stat
                label="Erreur de validation"
                value={here.val.toFixed(4)}
                tone={here.val <= best.val * 1.05 ? "good" : "warning"}
              />
            </div>

            <Callout kind="insight" title="Le point essentiel">
              Le modèle a <strong>toujours {degree + 1} paramètres</strong>, quelle que soit la
              valeur de <Tex>{String.raw`\lambda`}</Tex>. Ce n&apos;est pas la <em>capacité</em>{" "}
              qui change, c&apos;est le <em>coût</em> de s&apos;en servir.
              <br />
              <br />
              C&apos;est ce qui distingue la régularisation d&apos;une simple réduction de
              complexité : le modèle garde la liberté d&apos;être complexe là où les données le
              justifient, et redevient simple partout ailleurs.
            </Callout>

            <Panel title="Ridge, Lasso, Elastic Net" subtitle="Trois pénalités, trois effets">
              <div className="prose-lab">
                <p>
                  <strong>Ridge (<Tex>L_2</Tex>)</strong> — pénalise la somme des{" "}
                  <em>carrés</em>. Rétrécit tous les coefficients proportionnellement, sans
                  jamais les annuler exactement. C&apos;est ce que fait cette page, et c&apos;est
                  le <em>weight decay</em> des réseaux de neurones.
                </p>
                <p>
                  <strong>Lasso (<Tex>L_1</Tex>)</strong> — pénalise la somme des{" "}
                  <em>valeurs absolues</em>. Met certains coefficients{" "}
                  <strong>exactement à zéro</strong> : il fait donc aussi de la{" "}
                  <em>sélection de variables</em>. Utile quand on soupçonne que la plupart des
                  features sont inutiles.
                </p>
                <p>
                  <strong>Elastic Net</strong> — les deux à la fois. Garde la sélection du
                  Lasso tout en gérant mieux les features corrélées, que le Lasso a tendance à
                  choisir arbitrairement.
                </p>
              </div>
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
                Un modèle non régularisé, c&apos;est un budget illimité. Pour passer exactement
                par tous les points, il utilise des coefficients gigantesques qui se compensent
                mutuellement : <code>+10 000</code> ici, <code>−9 998</code> là. Entre deux
                points, cet équilibre fragile part dans tous les sens.
              </p>
              <p>
                La régularisation impose une facture. Chaque coefficient coûte, et le modèle ne
                paie que si ça en vaut la peine. Les oscillations qui n&apos;améliorent
                l&apos;ajustement que marginalement disparaissent d&apos;elles-mêmes.
              </p>
              <p>
                Regardez la liste des coefficients pendant que vous montez{" "}
                <Tex>{String.raw`\lambda`}</Tex> : ils se rétractent visiblement vers zéro.
              </p>
            </>
          }
          technique={
            <>
              <p>
                On minimise <Tex>{String.raw`J_{\text{data}} + \lambda \Omega(\theta)`}</Tex>.
                Le second terme ne dépend pas des données : il exprime une{" "}
                <strong>préférence a priori</strong> pour les modèles simples.
              </p>
              <p>
                <strong>Trois lectures de la même chose.</strong> Géométriquement, on contraint{" "}
                <Tex>{String.raw`\theta`}</Tex> à rester dans une boule. Statistiquement, c&apos;est
                un <em>a priori</em> bayésien — gaussien pour Ridge, laplacien pour Lasso. Du
                point de vue biais-variance, on accepte un peu de biais contre beaucoup de
                variance en moins.
              </p>
              <p>
                <strong>Pourquoi le Lasso annule et Ridge non.</strong> La boule{" "}
                <Tex>L_1</Tex> (un losange) a des <em>coins</em> sur les axes. La solution
                contrainte touche souvent un coin, et un coin signifie qu&apos;une coordonnée
                vaut exactement zéro. La boule <Tex>L_2</Tex> est ronde : aucun point
                privilégié, donc rien ne s&apos;annule exactement.
              </p>
              <p>
                <strong>Ne jamais pénaliser l&apos;ordonnée à l&apos;origine.</strong> Ce
                coefficient ne mesure aucune complexité : le pénaliser tire la courbe entière
                vers zéro au lieu de la tirer vers la platitude. Le code de cette page l&apos;exclut
                explicitement.
              </p>
            </>
          }
          maths={
            <>
              <p>Ridge — sa solution reste fermée, contrairement au Lasso :</p>
              <LiveFormula
                tex={String.raw`\hat{\theta}_{\text{ridge}} = \arg\min_{\theta} \; \lVert y - X\theta \rVert_2^2 + \lambda \lVert \theta \rVert_2^2
                  \;=\; (X^{\!\top}X + \lambda I)^{-1} X^{\!\top} y`}
              />
              <p>
                Le terme <Tex>{String.raw`\lambda I`}</Tex> ajoute{" "}
                <Tex>{String.raw`\lambda`}</Tex> à toutes les valeurs propres de{" "}
                <Tex>{String.raw`X^{\top}X`}</Tex>. <strong>La matrice devient donc toujours
                inversible</strong>, même avec des features colinéaires ou plus de features que
                d&apos;observations — un bénéfice numérique, en plus du bénéfice statistique.
              </p>
              <p>Lasso, qui n&apos;a pas de solution fermée :</p>
              <LiveFormula
                tex={String.raw`\hat{\theta}_{\text{lasso}} = \arg\min_{\theta} \; \lVert y - X\theta \rVert_2^2 + \lambda \lVert \theta \rVert_1`}
              />
              <p>
                Dans le cas orthonormal, sa solution s&apos;écrit comme un{" "}
                <em>seuillage doux</em> — la formule qui montre littéralement l&apos;annulation :
              </p>
              <LiveFormula
                tex={String.raw`\hat{\theta}_j = \mathrm{sign}(\hat{\theta}_j^{\text{OLS}}) \cdot \max\bigl(|\hat{\theta}_j^{\text{OLS}}| - \lambda,\; 0\bigr)`}
              />
              <p>
                Tout coefficient dont la valeur des moindres carrés est inférieure à{" "}
                <Tex>{String.raw`\lambda`}</Tex> est mis exactement à zéro. Ridge, lui, ne fait
                que multiplier : <Tex>{String.raw`\hat{\theta}_j = \hat{\theta}_j^{\text{OLS}} / (1 + \lambda)`}</Tex>,
                ce qui ne vaut jamais zéro pour un{" "}
                <Tex>{String.raw`\lambda`}</Tex> fini.
              </p>
              <p>
                <strong>Weight decay.</strong> Dans une{" "}
                <G t="descente">descente de gradient</G>, la pénalité{" "}
                <Tex>L_2</Tex> donne :
              </p>
              <LiveFormula
                tex={String.raw`\theta \leftarrow (1 - \alpha\lambda)\,\theta - \alpha \nabla J_{\text{data}}`}
              />
              <p>
                Chaque pas multiplie les poids par un facteur légèrement inférieur à 1 : une
                décroissance exponentielle, contrée seulement par le gradient des données.
              </p>
            </>
          }
        />


        <Quiz
          questions={[
            {
              id: "rg1",
              question: "Que pénalise exactement la régularisation L2 ?",
              options: [
                { id: "a", label: "Le nombre de paramètres du modèle" },
                { id: "b", label: "La somme des carrés des poids" },
                { id: "c", label: "Le nombre d'erreurs sur l'entraînement" },
              ],
              answer: 1,
              explanation: (
                <>
                  Le modèle garde tous ses paramètres ; on lui fait simplement payer leur{" "}
                  <em>amplitude</em>. Or de gros <G t="poids">poids</G> sont ce qui permet des
                  variations brusques : les brider revient à exiger une fonction plus lisse, sans
                  jamais rien retirer au modèle.
                </>
              ),
            },
            {
              id: "rg2",
              question: "Quelle est la différence pratique majeure entre L1 et L2 ?",
              options: [
                {
                  id: "a",
                  label:
                    "L1 met certains poids exactement à zéro — elle sélectionne des features ; L2 les rapetisse tous sans jamais les annuler",
                },
                { id: "b", label: "L1 est plus rapide à calculer" },
                { id: "c", label: "L2 fonctionne uniquement pour la régression" },
              ],
              answer: 0,
              explanation: (
                <>
                  La pénalité L1 garde une pente constante jusqu&apos;à zéro, donc elle continue
                  de pousser un petit poids jusqu&apos;à l&apos;annuler ; celle de L2 s&apos;affaiblit
                  à mesure que le poids rapetisse, et il ne l&apos;atteint jamais. D&apos;où
                  l&apos;usage de L1 quand on cherche <em>quelles</em> features comptent, et de L2
                  quand on veut seulement de la stabilité.
                </>
              ),
            },
            {
              id: "rg3",
              question: "Que se passe-t-il si λ devient très grand ?",
              options: [
                { id: "a", label: "Le modèle devient parfait" },
                {
                  id: "b",
                  label:
                    "Les poids sont écrasés vers zéro : le modèle prédit une constante, et on passe du surapprentissage au sous-apprentissage",
                },
                { id: "c", label: "L'entraînement diverge" },
              ],
              answer: 1,
              explanation: (
                <>
                  La <G t="regularisation">régularisation</G> est un curseur entre deux erreurs,
                  pas une amélioration gratuite. Poussez <Tex>{String.raw`\lambda`}</Tex> au
                  maximum ci-dessus : la courbe s&apos;aplatit jusqu&apos;à devenir une ligne
                  horizontale. Le bon <Tex>{String.raw`\lambda`}</Tex> se choisit par{" "}
                  <a href="/concepts/validation-croisee/">validation croisée</a>, jamais à
                  l&apos;œil.
                </>
              ),
            },
          ]}
        />

        <div className="space-y-4">
          <Callout kind="insight" title="L'expérience à faire">
            Degré <strong>14</strong>, <Tex>{String.raw`\lambda = 0`}</Tex>. Regardez la liste
            des coefficients : certains dépassent le millier. La courbe oscille violemment.
            <br />
            <br />
            Passez à <Tex>{String.raw`\lambda = 10^{-3}`}</Tex>. Les coefficients retombent à
            des valeurs raisonnables, la courbe se calme, et l&apos;erreur de validation
            s&apos;effondre — <strong>sans avoir retiré un seul paramètre</strong>.
          </Callout>

          <Callout kind="warning" title="Standardiser d'abord">
            La pénalité traite tous les coefficients de la même façon, donc une feature dont
            l&apos;échelle est petite — et dont le coefficient doit donc être grand — est
            pénalisée bien plus lourdement qu&apos;une autre. La régularisation n&apos;a de sens
            que sur des features mises à la même échelle. Voir{" "}
            <a href="/donnees/features/">Features</a>.
          </Callout>

          <Panel title="Ailleurs sur le site">
            <div className="prose-lab">
              <p>
                <a href="/reseaux/entrainement/">Entraînement</a> — le curseur{" "}
                <Tex>{String.raw`\lambda`}</Tex> agit sur un réseau de neurones. Les cartes de
                chaleur des matrices de poids pâlissent visiblement quand on l&apos;augmente.
              </p>
              <p>
                <a href="/classification/svm/">SVM</a> — le paramètre <Tex>C</Tex> est
                l&apos;inverse d&apos;une force de régularisation : petit <Tex>C</Tex>, forte
                régularisation.
              </p>
              <p>
                <a href="/classification/arbre-de-decision/">Arbres</a> — la profondeur maximale
                et le minimum par feuille jouent le même rôle, mais en interdisant plutôt
                qu&apos;en facturant.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}

function mse(points: Point2[], coeffs: number[]): number {
  if (!points.length) return 0;
  let s = 0;
  for (const p of points) s += (p.y - polyEval(coeffs, p.x)) ** 2;
  return s / points.length;
}

function polyPath(
  coeffs: number[],
  frame: { px: (x: number, y: number) => [number, number] },
): string {
  const pts: string[] = [];
  for (let x = REGRESSION_DOMAIN.xMin; x <= REGRESSION_DOMAIN.xMax; x += 0.02) {
    const y = polyEval(coeffs, x);
    const [px, py] = frame.px(
      x,
      Math.max(REGRESSION_DOMAIN.yMin - 1, Math.min(REGRESSION_DOMAIN.yMax + 1, y)),
    );
    pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
  }
  return `M${pts.join("L")}`;
}
