"use client";

import * as React from "react";
import { PageShell, SectionTitle, Workbench } from "@/components/layout/PageShell";
import { Callout, Divider, Panel, Segmented, Slider, Stat } from "@/components/ui";
import { G } from "@/components/ui/Glossary";
import { Levels } from "@/components/ui/Levels";
import { Quiz } from "@/components/lab/Quiz";
import { LiveFormula, Tex } from "@/components/math/Math";
import { DataPlot } from "@/components/viz/DataPlot";
import { ClassLegend } from "@/components/viz/Legend";
import { DatasetControls } from "@/components/lab/DatasetControls";
import { computeField } from "@/lib/ml/field";
import { evaluate } from "@/lib/ml/metrics";
import { Knn } from "@/lib/ml/models/knn";
import type { Dataset } from "@/lib/ml/types";
import { formatNumber, formatPercent } from "@/lib/viz/geometry";
import { useLab } from "@/store/lab";

type Transform = "raw" | "scaled" | "polar" | "poly";

const TRANSFORMS: { value: Transform; label: string; formula: string; note: string }[] = [
  {
    value: "raw",
    label: "Brut",
    formula: String.raw`(x_1,\; x_2)`,
    note: "Les coordonnées telles quelles.",
  },
  {
    value: "scaled",
    label: "Échelle déséquilibrée",
    formula: String.raw`(x_1,\; \kappa \cdot x_2)`,
    note: "Une feature multipliée par un facteur. Regardez ce que ça fait aux distances.",
  },
  {
    value: "polar",
    label: "Coordonnées polaires",
    formula: String.raw`\bigl(\sqrt{x_1^2 + x_2^2},\; \operatorname{atan2}(x_2, x_1)\bigr)`,
    note: "Rayon et angle plutôt qu'abscisse et ordonnée.",
  },
  {
    value: "poly",
    label: "Élévation au carré",
    formula: String.raw`\bigl(x_1^2,\; x_2^2\bigr)`,
    note: "Une transformation non linéaire simple.",
  },
];

function transformDataset(d: Dataset, t: Transform, kappa: number): Dataset {
  if (t === "raw") return d;
  const samples = d.samples.map((s) => {
    const [a, b] = s.x;
    switch (t) {
      case "scaled":
        return { ...s, x: [a, b * kappa] };
      case "polar":
        return { ...s, x: [Math.hypot(a, b), Math.atan2(b, a)] };
      case "poly":
        return { ...s, x: [a * a, b * b] };
      default:
        return s;
    }
  });
  const xs = samples.map((s) => s.x[0]);
  const ys = samples.map((s) => s.x[1]);
  const pad = 0.12;
  const span = (v: number[]): [number, number] => {
    const lo = Math.min(...v);
    const hi = Math.max(...v);
    const m = (hi - lo) * pad || 0.5;
    return [lo - m, hi + m];
  };
  const names: Record<Transform, [string, string]> = {
    raw: ["x₁", "x₂"],
    scaled: ["x₁", "κ · x₂"],
    polar: ["r", "θ"],
    poly: ["x₁²", "x₂²"],
  };
  return {
    ...d,
    samples,
    featureNames: names[t],
    domain: [span(xs), span(ys)],
  };
}

export function FeaturesLab() {
  const { dataset } = useLab();
  const [transform, setTransform] = React.useState<Transform>("raw");
  const [kappa, setKappa] = React.useState(6);
  const [k, setK] = React.useState(5);

  const transformed = React.useMemo(
    () => transformDataset(dataset, transform, kappa),
    [dataset, transform, kappa],
  );

  const nClasses = dataset.classNames.length;

  const modelRaw = React.useMemo(
    () => new Knn(dataset.samples, nClasses, k),
    [dataset.samples, nClasses, k],
  );
  const modelT = React.useMemo(
    () => new Knn(transformed.samples, nClasses, k),
    [transformed.samples, nClasses, k],
  );

  const fieldRaw = React.useMemo(
    () => computeField(modelRaw, dataset.domain, 76),
    [modelRaw, dataset.domain],
  );
  const fieldT = React.useMemo(
    () => computeField(modelT, transformed.domain, 76),
    [modelT, transformed.domain],
  );

  const accRaw = evaluate(modelRaw, dataset.samples, dataset.classNames).accuracy;
  const accT = evaluate(modelT, transformed.samples, dataset.classNames).accuracy;

  const spec = TRANSFORMS.find((t) => t.value === transform)!;
  const sample = dataset.samples[0];
  const tSample = transformed.samples[0];

  return (
    <PageShell
      eyebrow="Les données"
      title="Features"
      lede={
        <>
          Un <G t="modele">modèle</G> ne voit ni des images, ni des personnes, ni des fleurs. Il
          voit <strong>des vecteurs de nombres</strong> — ses{" "}
          <G t="feature">features</G>. Le choix de ces nombres — leur nature, leur
          échelle, leur système de coordonnées — change davantage le résultat que le choix de
          l&apos;algorithme.
        </>
      }
      wide
    >
      <Workbench
        plot={
          <Panel
            title="La même donnée, deux représentations"
            subtitle="Même algorithme (KNN), même K, mêmes points. Seules les coordonnées changent."
            bodyClassName="p-3"
            action={<ClassLegend classNames={dataset.classNames} />}
          >
            <div className="grid gap-5 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-[11px] font-medium text-ink-2">
                  Représentation brute — {formatPercent(accRaw, 1)}
                </p>
                <DataPlot dataset={dataset} field={fieldRaw} aspect={1} maxWidth={360} />
              </div>
              <div>
                <p className="mb-2 text-[11px] font-medium text-ink-2">
                  {spec.label} — {formatPercent(accT, 1)}
                </p>
                <DataPlot dataset={transformed} field={fieldT} aspect={1} maxWidth={360} />
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-line bg-surface-2/40 p-3">
              <p className="mb-2 text-[11px] font-medium text-ink-2">
                Un point, dans les deux systèmes
              </p>
              {sample && tSample && (
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px]">
                  <span className="tnum text-ink-2">
                    ({formatNumber(sample.x[0], 3)} ; {formatNumber(sample.x[1], 3)})
                  </span>
                  <span className="text-ink-muted">→</span>
                  <span className="tnum font-semibold text-ink">
                    ({formatNumber(tSample.x[0], 3)} ; {formatNumber(tSample.x[1], 3)})
                  </span>
                  <span className="text-[11px] text-ink-muted">
                    C&apos;est le même point du monde réel. Seule sa description a changé.
                  </span>
                </div>
              )}
            </div>
          </Panel>
        }
        controls={
          <>
            <Segmented
              label="Transformation"
              value={transform}
              options={TRANSFORMS.map((t) => ({ value: t.value, label: t.label }))}
              onChange={(v) => setTransform(v as Transform)}
              size="sm"
            />
            <div className="rounded-lg border border-line bg-surface-2/40 px-3 py-2.5">
              <LiveFormula tex={spec.formula} className="!border-0 !bg-transparent !p-0" />
              <p className="mt-1.5 text-[11px] leading-snug text-ink-muted">{spec.note}</p>
            </div>

            {transform === "scaled" && (
              <Slider
                label={
                  <>
                    <Tex>{String.raw`\kappa`}</Tex> — facteur d&apos;échelle
                  </>
                }
                value={kappa}
                min={1}
                max={40}
                onChange={setKappa}
                hint="Simule deux features dans des unités différentes : des euros et des années, par exemple."
              />
            )}

            <Slider label={<Tex>K</Tex>} value={k} min={1} max={30} onChange={setK} />

            <Divider label="Données" />
            <DatasetControls />
          </>
        }
        below={
          <>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Accuracy brute" value={formatPercent(accRaw)} />
              <Stat
                label={`Accuracy ${spec.label.toLowerCase()}`}
                value={formatPercent(accT)}
                tone={
                  accT > accRaw + 0.02 ? "good" : accT < accRaw - 0.02 ? "critical" : "neutral"
                }
              />
            </div>

            {transform === "scaled" && kappa > 5 && (
              <Callout kind="warning" title="La distance est devenue aveugle">
                Avec <Tex>{String.raw`\kappa = ` + kappa}</Tex>, un écart d&apos;une unité sur{" "}
                <Tex>x_2</Tex> compte {kappa} fois plus qu&apos;un écart d&apos;une unité sur{" "}
                <Tex>x_1</Tex> dans le calcul de distance. KNN ne regarde pratiquement plus
                que <Tex>x_2</Tex>. <strong>Aucun réglage de K ne corrige ça</strong> — le
                problème est dans les données, pas dans le modèle.
              </Callout>
            )}

            {transform === "polar" && (
              <Callout kind="insight" title="Essayez sur « Cercles concentriques »">
                En coordonnées polaires, deux cercles concentriques deviennent{" "}
                <strong>deux bandes horizontales</strong> : la classe ne dépend plus que du
                rayon. N&apos;importe quel modèle linéaire les sépare désormais.
                <br />
                <br />
                C&apos;est le <em>feature engineering</em> : un problème difficile pour
                l&apos;algorithme devient trivial parce qu&apos;on a changé la description, pas
                le modèle.
              </Callout>
            )}

            <Panel title="Le réflexe à prendre" subtitle="Avant tout modèle fondé sur des distances">
              <div className="prose-lab">
                <p>
                  <strong>Standardiser.</strong> Ramener chaque feature à moyenne 0 et
                  écart-type 1. C&apos;est le choix par défaut, et il est indispensable pour
                  KNN, les SVM, les k-means, et les réseaux de neurones.
                </p>
                <p>
                  <strong>Normaliser</strong> (ramener à [0, 1]) quand les bornes sont connues
                  et que l&apos;on veut les préserver — des pixels, par exemple.
                </p>
                <p>
                  <strong>Ne rien faire</strong> pour les arbres et les forêts : ils ne
                  comparent que des seuils au sein d&apos;une même feature, jamais des features
                  entre elles. Ils sont insensibles à toute transformation monotone.
                </p>
              </div>
            </Panel>
          </>
        }
      />

      <SectionTitle hint="La même idée, à trois profondeurs de lecture.">
        Pourquoi l&apos;échelle compte tant
      </SectionTitle>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <Levels
          intuition={
            <>
              <p>
                Vous comparez des appartements sur deux critères : le prix (entre 100 000 et
                500 000 €) et le nombre de pièces (entre 1 et 6).
              </p>
              <p>
                Si vous calculez une « distance » entre deux appartements en additionnant
                bêtement les écarts, l&apos;écart de prix se chiffre en dizaines de milliers et
                l&apos;écart de pièces en unités. <strong>Le nombre de pièces devient
                invisible</strong> — non pas parce qu&apos;il est moins important, mais parce
                que son unité est plus petite.
              </p>
              <p>
                Standardiser revient à exprimer chaque critère en « nombre d&apos;écarts-types
                par rapport à la moyenne ». Les deux deviennent comparables, et c&apos;est la
                seule façon de les mettre honnêtement sur un pied d&apos;égalité.
              </p>
            </>
          }
          technique={
            <>
              <p>
                Le problème est purement géométrique : la distance euclidienne somme des{" "}
                <em>carrés</em> d&apos;écarts. Multiplier une feature par{" "}
                <Tex>{String.raw`\kappa`}</Tex> multiplie sa contribution par{" "}
                <Tex>{String.raw`\kappa^2`}</Tex>. Un facteur 10 sur une feature la rend 100 fois
                plus importante dans la distance.
              </p>
              <p>
                <strong>Qui est concerné.</strong> Tout ce qui calcule une distance ou un
                produit scalaire : KNN, k-means, SVM, PCA, réseaux de neurones. Et tout ce qui
                régularise : une pénalité <Tex>L_2</Tex> pénalise plus fort les poids des
                features à petite échelle, qui doivent être grands pour compenser.
              </p>
              <p>
                <strong>Qui ne l&apos;est pas.</strong> Les arbres et leurs ensembles. Une
                coupure <Tex>{String.raw`x_j \le t`}</Tex> reste la même coupure après
                n&apos;importe quelle transformation croissante de{" "}
                <Tex>x_j</Tex> — seul le seuil change.
              </p>
              <p>
                <strong>Le piège classique.</strong> Standardiser avant de séparer entraînement
                et test fait fuiter la moyenne et l&apos;écart-type du test dans le modèle. Les
                statistiques doivent être calculées <em>sur l&apos;entraînement seul</em>, puis
                appliquées au test.
              </p>
            </>
          }
          maths={
            <>
              <p>Standardisation (z-score), la transformation par défaut :</p>
              <LiveFormula
                tex={String.raw`x'_j = \frac{x_j - \mu_j}{\sigma_j}
                  \qquad
                  \mu_j = \frac{1}{n}\sum_i x_{ij}, \quad
                  \sigma_j^2 = \frac{1}{n}\sum_i (x_{ij} - \mu_j)^2`}
              />
              <p>Normalisation min-max :</p>
              <LiveFormula
                tex={String.raw`x'_j = \frac{x_j - \min_j}{\max_j - \min_j} \in [0, 1]`}
              />
              <p>Effet d&apos;un changement d&apos;échelle sur la distance euclidienne :</p>
              <LiveFormula
                tex={String.raw`d^2(x, z) = \sum_j \kappa_j^2 \,(x_j - z_j)^2`}
              />
              <p>
                Les <Tex>{String.raw`\kappa_j^2`}</Tex> sont des poids implicites imposés par le
                choix des unités. Standardiser revient à poser{" "}
                <Tex>{String.raw`\kappa_j = 1/\sigma_j`}</Tex> : chaque feature contribue à la
                hauteur de sa variabilité, pas de son unité.
              </p>
              <p>
                <strong>Généralisation : la distance de Mahalanobis</strong>, qui corrige aussi
                les corrélations entre features :
              </p>
              <LiveFormula
                tex={String.raw`d_M(x, z) = \sqrt{(x - z)^{\!\top} \Sigma^{-1} (x - z)}`}
              />
              <p>
                Avec <Tex>{String.raw`\Sigma`}</Tex> la matrice de covariance. Quand{" "}
                <Tex>{String.raw`\Sigma = I`}</Tex>, on retombe sur la distance euclidienne ;
                quand <Tex>{String.raw`\Sigma`}</Tex> est diagonale, sur la distance euclidienne
                après standardisation.
              </p>
            </>
          }
        />


        <Quiz
          questions={[
            {
              id: "ft1",
              question:
                "Une feature va de 0 à 50 000, l'autre de 0 à 1. Quels modèles en souffrent, et lesquels s'en moquent ?",
              options: [
                { id: "a", label: "Tous en souffrent également" },
                {
                  id: "b",
                  label:
                    "Ceux qui calculent des distances en souffrent (KNN, SVM, k-means) ; les arbres, qui comparent une feature à la fois, s'en moquent",
                },
                { id: "c", label: "Aucun : les modèles normalisent automatiquement" },
              ],
              answer: 1,
              explanation: (
                <>
                  Une <G t="distance">distance euclidienne</G> additionne des écarts au carré :
                  celui de la grande feature écrase l&apos;autre, qui devient invisible. Un arbre,
                  lui, ne pose jamais de question mêlant deux features — « cette colonne
                  dépasse-t-elle ce seuil ? » a le même sens quelle que soit l&apos;unité. Savoir
                  dans quelle catégorie tombe un modèle évite la moitié des mauvaises surprises.
                </>
              ),
            },
            {
              id: "ft2",
              question:
                "Passer un problème en coordonnées polaires rend les cercles concentriques séparables par une droite. Qu'a-t-on gagné ?",
              options: [
                { id: "a", label: "Des données supplémentaires" },
                {
                  id: "b",
                  label:
                    "Rien dans les données : on a seulement donné au modèle un système de coordonnées où sa forme de frontière suffit",
                },
                { id: "c", label: "Un modèle plus puissant" },
              ],
              answer: 1,
              explanation: (
                <>
                  Les points n&apos;ont pas bougé — seule leur description a changé. Mais un
                  modèle linéaire ne peut tracer qu&apos;une droite : dans les bonnes
                  coordonnées, cette droite suffit ; dans les mauvaises, aucun réglage ne le
                  sauvera. C&apos;est l&apos;idée entière du <G t="kernel">kernel trick</G>, et
                  c&apos;est aussi ce qu&apos;une couche cachée de réseau apprend à faire toute
                  seule.
                </>
              ),
            },
            {
              id: "ft3",
              question:
                "Quelle différence entre normaliser (min-max) et standardiser (centrer-réduire) ?",
              options: [
                {
                  id: "a",
                  label:
                    "Min-max force l'intervalle [0, 1] et se fait écraser par un outlier ; centrer-réduire met la moyenne à 0 et l'écart-type à 1, sans borner",
                },
                { id: "b", label: "Ce sont deux noms pour la même chose" },
                { id: "c", label: "Centrer-réduire ne marche que sur des données gaussiennes" },
              ],
              answer: 0,
              explanation: (
                <>
                  Un seul point à 100 fois l&apos;échelle habituelle suffit à tasser toutes les
                  autres valeurs du min-max dans les premiers centièmes. Le centrage-réduction
                  résiste mieux et ne borne pas — ce qui est un avantage ou un inconvénient selon
                  ce qui suit. Aucune des deux ne <em>suppose</em> une gaussienne ; elles se
                  contentent d&apos;utiliser moyenne et écart-type, qui existent toujours.
                </>
              ),
            },
          ]}
        />

        <div className="space-y-4">
          <Panel title="Types de features" subtitle="Tout doit finir en nombres">
            <div className="prose-lab">
              <p>
                <strong>Numériques continues</strong> — taille, prix, température. Directement
                utilisables, après mise à l&apos;échelle.
              </p>
              <p>
                <strong>Catégorielles</strong> — couleur, pays, catégorie. Encodées en
                one-hot : une colonne binaire par modalité. Les numéroter 1, 2, 3 créerait un
                ordre qui n&apos;existe pas, et une notion de distance absurde.
              </p>
              <p>
                <strong>Ordinales</strong> — petit / moyen / grand. L&apos;ordre est réel, donc
                un encodage numérique se défend ; mais il impose aussi des écarts égaux, ce qui
                est rarement vrai.
              </p>
              <p>
                <strong>Texte</strong> — sac de mots, TF-IDF, ou plongements appris. Chaque
                document devient un vecteur de plusieurs milliers de dimensions.
              </p>
              <p>
                <strong>Images</strong> — un vecteur de pixels, ou les activations
                intermédiaires d&apos;un réseau pré-entraîné.
              </p>
            </div>
          </Panel>

          <Callout kind="note" title="La feature la plus importante est souvent celle qui manque">
            Aucun modèle ne peut apprendre à partir d&apos;une information absente des données.
            Un classifieur qui plafonne à 70 % ne manque pas forcément de capacité : il manque
            peut-être simplement de la variable qui explique les 30 % restants. Regardez{" "}
            <em>quels</em> points sont mal classés avant de changer d&apos;algorithme.
          </Callout>
        </div>
      </div>
    </PageShell>
  );
}
