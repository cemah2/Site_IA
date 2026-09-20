"use client";

import * as React from "react";
import { PageShell, SectionTitle, Workbench } from "@/components/layout/PageShell";
import { Button, Callout, Divider, Panel, Segmented, Slider, Stat } from "@/components/ui";
import { G } from "@/components/ui/Glossary";
import { Levels } from "@/components/ui/Levels";
import { PredictFirst } from "@/components/lab/Practice";
import { Quiz } from "@/components/lab/Quiz";
import { LiveFormula, Tex } from "@/components/math/Math";
import { DataPlot, EditHints } from "@/components/viz/DataPlot";
import { LineChart } from "@/components/viz/LineChart";
import { Plot } from "@/components/viz/Plot";
import { DatasetControls } from "@/components/lab/DatasetControls";
import { computeField } from "@/lib/ml/field";
import { splitDataset } from "@/lib/ml/datasets";
import { evaluate } from "@/lib/ml/metrics";
import { polyEval, polyFit } from "@/lib/ml/models/regression";
import { fitModel, DEFAULT_PARAMS } from "@/lib/ml/registry";
import { formatPercent } from "@/lib/viz/geometry";
import { CHROME, SERIES, STATUS } from "@/lib/viz/palette";
import { useLab } from "@/store/lab";
import { REGRESSION_DOMAIN, useRegression } from "@/store/regression";

type Mode = "regression" | "classification";

export function OverfittingLab() {
  const [mode, setMode] = React.useState<Mode>("regression");
  return (
    <PageShell
      eyebrow="Concepts"
      title="Sur / sous-apprentissage"
      lede={
        <>
          Un modèle trop simple ne voit pas la structure. Un modèle trop complexe voit une
          structure qui n&apos;existe pas — il apprend le bruit. Entre les deux, il y a un
          point optimal, et <strong>on ne peut pas le trouver en regardant l&apos;erreur
          d&apos;entraînement</strong>, qui ne fait que descendre.
        </>
      }
      wide
    >
      <div className="mb-5 max-w-sm">
        <Segmented
          label="Type de problème"
          value={mode}
          options={[
            { value: "regression", label: "Régression" },
            { value: "classification", label: "Classification" },
          ]}
          onChange={(v) => setMode(v as Mode)}
        />
      </div>

      {mode === "regression" ? <RegressionView /> : <ClassificationView />}

      <SectionTitle hint="La même idée, à trois profondeurs de lecture.">
        Comment ça marche
      </SectionTitle>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <Levels
          intuition={
            <>
              <p>
                Un élève révise un examen avec dix annales corrigées. Il peut{" "}
                <strong>comprendre la méthode</strong>, ou <strong>apprendre les dix corrigés
                par cœur</strong>. Sur ces dix sujets, le second obtient 20/20 — mieux que le
                premier.
              </p>
              <p>
                Le jour de l&apos;examen, avec un sujet inédit, le premier s&apos;en sort et le
                second s&apos;effondre. Pourtant, <em>sur les données d&apos;entraînement</em>,
                il était meilleur.
              </p>
              <p>
                C&apos;est exactement ce que montrent les deux courbes : une seule des deux dit
                quelque chose d&apos;utile sur l&apos;avenir. Et elles divergent précisément au
                moment où le modèle cesse d&apos;apprendre la règle pour commencer à mémoriser
                les exemples.
              </p>
            </>
          }
          technique={
            <>
              <p>
                <strong>Sous-apprentissage</strong> : le modèle est trop contraint pour
                représenter la vraie relation. Les deux erreurs sont élevées, et elles sont
                proches. Plus de données n&apos;aide pas — c&apos;est un problème de{" "}
                <em><G t="biais">biais</G></em>.
              </p>
              <p>
                <strong>Surapprentissage</strong> : le modèle a assez de liberté pour épouser le
                bruit. L&apos;erreur d&apos;entraînement est très basse, celle de validation est
                haute, et l&apos;écart entre les deux est le symptôme. Plus de données aide —
                c&apos;est un problème de <em><G t="variance">variance</G></em>.
              </p>
              <p>
                <strong>La capacité n&apos;est pas qu&apos;une question de paramètres.</strong>{" "}
                Elle dépend aussi du nombre d&apos;exemples, de la durée d&apos;entraînement, et
                de la <G t="regularisation">régularisation</G>. Un même réseau peut
                sous-apprendre à 10 <G t="epoch">epochs</G> et
                surapprendre à 10 000.
              </p>
              <p>
                <strong>Le diagnostic, en pratique.</strong> Erreurs hautes et proches →
                augmenter la capacité. Erreur d&apos;entraînement basse et grand écart → plus de
                données, plus de régularisation, ou moins de capacité. Erreur d&apos;entraînement
                déjà au niveau du bruit → vous avez atteint le plancher.
              </p>
            </>
          }
          maths={
            <>
              <p>
                L&apos;erreur attendue d&apos;un modèle en un point se décompose en trois termes
                indépendants :
              </p>
              <LiveFormula
                tex={String.raw`\mathbb{E}\bigl[(y - \hat{f}(x))^2\bigr]
                  = \underbrace{\bigl(\mathbb{E}[\hat{f}(x)] - f(x)\bigr)^2}_{\text{biais}^2}
                  + \underbrace{\mathbb{E}\bigl[(\hat{f}(x) - \mathbb{E}[\hat{f}(x)])^2\bigr]}_{\text{variance}}
                  + \underbrace{\sigma^2}_{\text{bruit}}`}
              />
              <p>
                Augmenter la capacité <strong>baisse le biais</strong> et{" "}
                <strong>monte la variance</strong>. Leur somme passe par un minimum : c&apos;est
                la forme en U de la courbe de validation.
              </p>
              <p>
                <strong>La dimension de Vapnik–Chervonenkis</strong> mesure la capacité par le
                plus grand nombre de points qu&apos;un modèle peut séparer dans toutes les
                configurations possibles. Elle borne l&apos;écart entre erreur empirique et
                erreur réelle : avec probabilité <Tex>{String.raw`1 - \delta`}</Tex>,
              </p>
              <LiveFormula
                tex={String.raw`R(\hat{f}) \;\le\; \hat{R}(\hat{f}) + \sqrt{\frac{h\bigl(\log(2n/h) + 1\bigr) - \log(\delta/4)}{n}}`}
              />
              <p>
                Le second terme croît avec la capacité <Tex>h</Tex> et décroît en{" "}
                <Tex>{String.raw`1/\sqrt{n}`}</Tex>. C&apos;est la formalisation de « plus de
                paramètres exige plus de données ».
              </p>
              <Callout kind="note" title="Une nuance moderne">
                Cette borne est très pessimiste pour les réseaux profonds, qui ont des millions
                de paramètres et généralisent pourtant bien. Le phénomène de{" "}
                <em>double descente</em> montre même que l&apos;erreur de test peut redescendre
                après le pic du surapprentissage, quand on dépasse largement le point
                d&apos;interpolation. La forme en U reste le bon modèle mental pour les modèles
                de cette taille, mais ce n&apos;est pas toute l&apos;histoire.
              </Callout>
            </>
          }
        />


        <PredictFirst
          id="of-more-data"
          className="mb-5"
          question={
            <>
              Un modèle affiche 99 % à l&apos;entraînement et 71 % en validation. Vous multipliez le
              nombre de données par dix, sans rien changer d&apos;autre. Que devient l&apos;écart ?
            </>
          }
          options={["Il se réduit", "Il reste identique", "Il se creuse"]}
          answer={0}
          explanation={
            <>
              Plus de données rendent la mémorisation plus coûteuse : le modèle ne peut plus
              contourner chaque point un par un, et se rabat sur la régularité. C&apos;est le remède
              au surapprentissage. Attention au piège symétrique : si les deux chiffres étaient bas
              <em> et proches</em>, dix fois plus de données n&apos;y changerait rien du tout.
            </>
          }
        />
        <Quiz
          questions={[
            {
              id: "of1",
              question:
                "Accuracy d'entraînement 99 %, accuracy de test 71 %. Quel est le diagnostic, et le remède ?",
              options: [
                {
                  id: "a",
                  label:
                    "Surapprentissage : simplifier le modèle, régulariser, ou ajouter des données",
                },
                { id: "b", label: "Sous-apprentissage : prendre un modèle plus puissant" },
                { id: "c", label: "Un bug dans le découpage" },
              ],
              answer: 0,
              explanation: (
                <>
                  Le signe distinctif du <G t="overfitting">surapprentissage</G> est l&apos;
                  <em>écart</em>, pas le niveau : le modèle réussit sur ce qu&apos;il a vu et
                  échoue ailleurs, donc il a mémorisé au lieu de généraliser. Le{" "}
                  <G t="underfitting">sous-apprentissage</G>, lui, donne deux chiffres bas et
                  proches — 68 % et 66 %, par exemple.
                </>
              ),
            },
            {
              id: "of2",
              question:
                "Accuracy d'entraînement 66 %, accuracy de test 65 %. Ajouter dix fois plus de données va-t-il aider ?",
              options: [
                { id: "a", label: "Oui, plus de données aide toujours" },
                {
                  id: "b",
                  label:
                    "Non : le modèle n'arrive déjà pas à expliquer les données qu'il a. C'est le modèle qu'il faut changer",
                },
                { id: "c", label: "Impossible à dire" },
              ],
              answer: 1,
              explanation: (
                <>
                  Plus de données soigne la mémorisation, pas l&apos;aveuglement. Quand un modèle
                  échoue déjà sur son propre jeu d&apos;entraînement, il lui manque de la
                  capacité — une frontière plus riche, une feature en plus, une couche cachée.
                  C&apos;est la distinction la plus rentable de tout le machine learning, et la
                  page <a href="/concepts/biais-variance/">Biais et variance</a> la formalise.
                </>
              ),
            },
            {
              id: "of3",
              question: "Pourquoi augmenter le bruit rend-il le surapprentissage plus facile ?",
              options: [
                { id: "a", label: "Parce que le bruit réduit le nombre de points utiles" },
                {
                  id: "b",
                  label:
                    "Parce qu'il y a davantage de détails aléatoires à mémoriser, et qu'ils ne se reproduiront pas dans le jeu de test",
                },
                { id: "c", label: "Parce que le modèle devient plus lent" },
              ],
              answer: 1,
              explanation: (
                <>
                  Un modèle assez souple finit toujours par trouver une frontière qui contourne
                  chaque point mal placé. Cette frontière décrit parfaitement le{" "}
                  <G t="bruit">bruit</G> de <em>cet</em> échantillon — et le bruit, par
                  définition, ne se répète pas. Montez le curseur de bruit et regardez les îlots
                  apparaître : ce sont des explications d&apos;accidents.
                </>
              ),
            },
          ]}
        />

        <div className="space-y-4">
          <Callout kind="insight" title="Le protocole honnête">
            <ol className="mt-1.5 space-y-1">
              <li>
                <strong>1. Entraînement</strong> — pour ajuster les paramètres du modèle.
              </li>
              <li>
                <strong>2. Validation</strong> — pour choisir les hyperparamètres (degré, K,
                profondeur…).
              </li>
              <li>
                <strong>3. Test</strong> — regardé <em>une seule fois</em>, à la toute fin.
              </li>
            </ol>
            Choisir un hyperparamètre en regardant le test le transforme en jeu de validation,
            et son score cesse d&apos;être une estimation honnête. C&apos;est l&apos;erreur de
            protocole la plus courante.
          </Callout>

          <Panel title="Les remèdes" subtitle="Par ordre d'efficacité">
            <div className="prose-lab">
              <p>
                <strong>Plus de données.</strong> Le remède le plus efficace et le plus cher.
                La variance décroît en <Tex>1/n</Tex>.
              </p>
              <p>
                <strong>Régularisation.</strong> Pénaliser la complexité plutôt que
                l&apos;interdire. Voir la page{" "}
                <a href="/concepts/regularisation/">Régularisation</a>.
              </p>
              <p>
                <strong>Early stopping.</strong> S&apos;arrêter quand la validation cesse de
                s&apos;améliorer. Gratuit.
              </p>
              <p>
                <strong>Réduire la capacité.</strong> Moins de couches, moins de profondeur, K
                plus grand. Efficace, mais un modèle trop bridé sous-apprend.
              </p>
              <p>
                <strong>Ensembles.</strong> Moyenner plusieurs modèles réduit la variance sans
                augmenter le biais. C&apos;est tout{" "}
                <a href="/classification/random-forest/">Random Forest</a>.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}

/** Polynomial fit: the cleanest place to see the U-curve, because capacity is
 *  a single integer and the fitted curve is directly visible. */
function RegressionView() {
  const { points, shape, setShape, noise, setNoise, n, setN, reseed } = useRegression();
  const [degree, setDegree] = React.useState(3);

  const split = React.useMemo(() => {
    // Deterministic interleaved split: every third point is held out. Keeps the
    // two halves spread across the whole x-range, which a random split does not
    // guarantee on 28 points.
    const train = points.filter((_, i) => i % 3 !== 0);
    const val = points.filter((_, i) => i % 3 === 0);
    return { train, val };
  }, [points]);

  const curves = React.useMemo(() => {
    const out: { degree: number; trainMse: number; valMse: number }[] = [];
    for (let d = 1; d <= 14; d++) {
      const coeffs = polyFit(split.train, d, 1e-9);
      out.push({
        degree: d,
        trainMse: mseOf(split.train, coeffs),
        valMse: mseOf(split.val, coeffs),
      });
    }
    return out;
  }, [split]);

  const coeffs = React.useMemo(() => polyFit(split.train, degree, 1e-9), [split.train, degree]);
  const best = curves.reduce((a, b) => (b.valMse < a.valMse ? b : a));
  const here = curves[degree - 1];

  return (
    <Workbench
      plot={
        <div className="space-y-5">
          <Panel
            title={`Polynôme de degré ${degree}`}
            subtitle="Les points pleins servent à ajuster. Les points cerclés sont tenus à l'écart."
            bodyClassName="p-3"
          >
            <Plot
              xDomain={[REGRESSION_DOMAIN.xMin, REGRESSION_DOMAIN.xMax]}
              yDomain={[REGRESSION_DOMAIN.yMin, REGRESSION_DOMAIN.yMax]}
              aspect={0.58}
              maxWidth={640}
              xLabel="x"
              yLabel="y"
              ariaLabel="Ajustement polynomial"
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

          <Panel
            title="L'erreur en fonction de la complexité"
            subtitle="La courbe d'entraînement ne fait que descendre. La validation, non."
          >
            <LineChart
              series={[
                {
                  key: "train",
                  label: "erreur d'entraînement",
                  color: SERIES[0],
                  points: curves.map((c) => ({ x: c.degree, y: c.trainMse })),
                },
                {
                  key: "val",
                  label: "erreur de validation",
                  color: SERIES[1],
                  dashed: true,
                  points: curves.map((c) => ({ x: c.degree, y: c.valMse })),
                },
              ]}
              height={220}
              marker={degree}
              xLabel="degré"
              yDomain={[0, Math.min(6, Math.max(...curves.map((c) => c.valMse)) * 1.1)]}
              yFormat={(v) => v.toFixed(2)}
            />
            <p className="mt-2 text-[11px] leading-snug text-ink-muted">
              Minimum de validation au <strong className="text-ink">degré {best.degree}</strong>.
              Au-delà, chaque degré supplémentaire améliore l&apos;ajustement sur les points vus
              et dégrade la prédiction sur les autres.
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
            max={14}
            onChange={setDegree}
            hint={
              degree === 1
                ? "Une droite. Trop simple pour une relation courbe : c'est du sous-apprentissage."
                : degree >= 10
                  ? "La courbe passe par presque tous les points d'entraînement — et oscille violemment entre eux."
                  : undefined
            }
          />
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" onClick={() => setDegree(1)}>
              Trop simple
            </Button>
            <Button size="sm" className="flex-1" onClick={() => setDegree(best.degree)}>
              Optimal
            </Button>
            <Button size="sm" className="flex-1" onClick={() => setDegree(14)}>
              Trop complexe
            </Button>
          </div>

          <Divider label="Données" />
          <Segmented
            label="Forme"
            value={shape}
            options={[
              { value: "linear", label: "Droite" },
              { value: "curved", label: "Courbe" },
              { value: "noisy", label: "Bruitée" },
            ]}
            onChange={(v) => setShape(v as typeof shape)}
            size="sm"
          />
          <Slider label="Nombre de points" value={n} min={8} max={80} step={2} onChange={setN} />
          <Slider
            label="Bruit"
            value={noise}
            min={0}
            max={2}
            step={0.05}
            onChange={setNoise}
            format={(v) => v.toFixed(2)}
            hint="Plus il y a de bruit, plus tôt le surapprentissage commence."
          />
          <Button onClick={reseed} className="w-full">
            Autre tirage
          </Button>
        </>
      }
      below={
        <>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Erreur d'entraînement" value={here.trainMse.toFixed(4)} />
            <Stat
              label="Erreur de validation"
              value={here.valMse.toFixed(4)}
              tone={
                here.valMse > best.valMse * 1.5
                  ? "critical"
                  : here.valMse > best.valMse * 1.15
                    ? "warning"
                    : "good"
              }
            />
            <Stat label="Paramètres" value={degree + 1} hint="Coefficients du polynôme" />
            <Stat label="Points d'entraînement" value={split.train.length} />
          </div>

          <Callout
            kind={
              degree < best.degree - 1
                ? "warning"
                : degree > best.degree + 2
                  ? "critical"
                  : "insight"
            }
            title={
              degree < best.degree - 1
                ? "Sous-apprentissage"
                : degree > best.degree + 2
                  ? "Surapprentissage"
                  : "Zone correcte"
            }
          >
            {degree < best.degree - 1
              ? "Les deux erreurs sont élevées et proches. Le modèle n'a pas assez de liberté pour suivre la vraie relation — lui donner plus de données n'y changerait rien."
              : degree > best.degree + 2
                ? `L'erreur d'entraînement (${here.trainMse.toFixed(4)}) est bien plus basse que celle de validation (${here.valMse.toFixed(4)}). Regardez la courbe entre deux points d'entraînement : elle part dans des directions que rien ne justifie.`
                : "Les deux erreurs sont basses et du même ordre. Le modèle a capté la structure sans mémoriser le bruit."}
          </Callout>

          <Callout kind="note" title="Pourquoi ce découpage régulier">
            Un point sur trois est mis de côté, en alternance plutôt qu&apos;au hasard. Sur
            trente points, un tirage aléatoire laisse souvent des zones entières de{" "}
            <Tex>x</Tex> sans aucun point de validation — et l&apos;erreur mesurée dépendrait
            alors surtout de la chance.
          </Callout>
        </>
      }
    />
  );
}

/** The same phenomenon in classification: complexity becomes a KNN K or a tree
 *  depth, and the "too complex" boundary is visibly chasing individual points. */
function ClassificationView() {
  const { dataset, setDataset, trainRatio } = useLab();
  const [complexity, setComplexity] = React.useState(6);
  const [family, setFamily] = React.useState<"knn" | "tree">("knn");

  const split = React.useMemo(() => splitDataset(dataset, trainRatio, 4242), [dataset, trainRatio]);
  const nClasses = dataset.classNames.length;

  // KNN capacity grows as K shrinks, so the slider is inverted for it: left is
  // always "simple" and right always "complex", whichever family is selected.
  const paramsFor = React.useCallback(
    (c: number) =>
      family === "knn"
        ? { ...DEFAULT_PARAMS, k: Math.max(1, 41 - c * 4) }
        : { ...DEFAULT_PARAMS, maxDepth: c, minSamplesLeaf: 1 },
    [family],
  );

  const sweep = React.useMemo(() => {
    const out: { c: number; train: number; val: number }[] = [];
    for (let c = 1; c <= 10; c++) {
      const { model } = fitModel(family, split.train, nClasses, paramsFor(c));
      out.push({
        c,
        train: evaluate(model, split.train, dataset.classNames).accuracy,
        val: split.test.length ? evaluate(model, split.test, dataset.classNames).accuracy : 0,
      });
    }
    return out;
  }, [family, split, nClasses, dataset.classNames, paramsFor]);

  const current = React.useMemo(
    () => fitModel(family, split.train, nClasses, paramsFor(complexity)),
    [family, split.train, nClasses, complexity, paramsFor],
  );
  const field = React.useMemo(
    () => computeField(current.model, dataset.domain, 88),
    [current, dataset.domain],
  );
  const here = sweep[complexity - 1];
  const best = sweep.reduce((a, b) => (b.val > a.val ? b : a));
  const testIds = React.useMemo(() => new Set(split.test.map((s) => s.id)), [split]);

  return (
    <Workbench
      plot={
        <div className="space-y-5">
          <Panel
            title="La frontière"
              exportName="surapprentissage-frontiere"
            subtitle="Les points estompés ont servi à entraîner. Les autres sont le jeu de validation."
            bodyClassName="p-3"
          >
            <DataPlot
              dataset={dataset}
              onChange={setDataset}
              mode="edit"
              field={field}
              aspect={1}
              maxWidth={480}
              styleFor={(s) => (testIds.has(s.id) ? undefined : { dim: true })}
            />
            <EditHints />
            <p className="mt-1.5 text-[11px] leading-snug text-ink-2">
              Ajoutez trois ou quatre points du mauvais côté de la frontière : le modèle
              complexe ira les chercher un par un, le modèle simple les ignorera. C&apos;est la
              différence entre mémoriser et généraliser, en dix secondes.
            </p>
          </Panel>

          <Panel title="Accuracy en fonction de la complexité">
            <LineChart
              series={[
                {
                  key: "train",
                  label: "entraînement",
                  color: SERIES[0],
                  points: sweep.map((s) => ({ x: s.c, y: s.train })),
                },
                {
                  key: "val",
                  label: "validation",
                  color: SERIES[1],
                  dashed: true,
                  points: sweep.map((s) => ({ x: s.c, y: s.val })),
                },
              ]}
              height={210}
              marker={complexity}
              xLabel="complexité"
              yDomain={[0, 1.02]}
              yFormat={(v) => `${Math.round(v * 100)} %`}
            />
            <p className="mt-2 text-[11px] leading-snug text-ink-muted">
              La courbe d&apos;entraînement monte presque toujours jusqu&apos;à 100 %. Celle de
              validation passe par un maximum — ici au niveau {best.c} — puis redescend.
            </p>
          </Panel>
        </div>
      }
      controls={
        <>
          <Segmented
            label="Famille de modèle"
            value={family}
            options={[
              { value: "knn", label: "KNN" },
              { value: "tree", label: "Arbre" },
            ]}
            onChange={(v) => setFamily(v as "knn" | "tree")}
            size="sm"
          />
          <Slider
            label="Complexité du modèle"
            value={complexity}
            min={1}
            max={10}
            onChange={setComplexity}
            format={(v) =>
              family === "knn" ? `K = ${Math.max(1, 41 - v * 4)}` : `profondeur ${v}`
            }
            hint={
              family === "knn"
                ? "À gauche : K grand, frontière lisse. À droite : K petit, frontière qui suit chaque point."
                : "À gauche : arbre court. À droite : arbre profond, qui isole des points individuels."
            }
          />
          <Divider label="Données" />
          <DatasetControls />
        </>
      }
      below={
        <>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Accuracy entraînement" value={formatPercent(here.train)} />
            <Stat
              label="Accuracy validation"
              value={formatPercent(here.val)}
              tone={here.val >= best.val - 0.01 ? "good" : "warning"}
            />
            <Stat
              label="Écart"
              value={formatPercent(here.train - here.val, 1)}
              tone={here.train - here.val > 0.12 ? "critical" : "neutral"}
            />
            <Stat label="Paramètres" value={current.parameters} />
          </div>

          <Callout kind="insight" title="Ce qu'il faut regarder dans la frontière">
            Poussez la complexité au maximum et cherchez les{" "}
            <strong>petites îles isolées</strong> autour de points uniques. Chacune est le
            modèle qui a décidé qu&apos;un point de bruit méritait sa propre région du plan.
            C&apos;est ça, apprendre le bruit — et c&apos;est visible à l&apos;œil.
          </Callout>
        </>
      }
    />
  );
}

function mseOf(points: { x: number; y: number }[], coeffs: number[]): number {
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
    // Clamp rather than drop: a wildly oscillating fit should visibly run off
    // the top of the frame, not silently disappear.
    const [px, py] = frame.px(x, Math.max(REGRESSION_DOMAIN.yMin - 1, Math.min(REGRESSION_DOMAIN.yMax + 1, y)));
    pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
  }
  return `M${pts.join("L")}`;
}
