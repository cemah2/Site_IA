"use client";

import * as React from "react";
import { PageShell, SectionTitle, Workbench } from "@/components/layout/PageShell";
import { Callout, Divider, Panel, Segmented, Slider, Stat, Toggle } from "@/components/ui";
import { G } from "@/components/ui/Glossary";
import { Levels } from "@/components/ui/Levels";
import { Quiz } from "@/components/lab/Quiz";
import { LiveFormula, Tex } from "@/components/math/Math";
import { DataPlot } from "@/components/viz/DataPlot";
import { ClassLegend, ClassMark } from "@/components/viz/Legend";
import { Scatter3D, type Point3 } from "@/components/viz/Scatter3D";
import { DatasetControls } from "@/components/lab/DatasetControls";
import { euclidean } from "@/lib/ml/models/nearest-centroid";
import { formatNumber } from "@/lib/viz/geometry";
import { useLab } from "@/store/lab";

type ThirdFeature = "none" | "radius" | "product" | "noise";

const THIRD: { value: ThirdFeature; label: string; tex: string; note: string }[] = [
  {
    value: "none",
    label: "Aucune",
    tex: String.raw`x_3 = 0`,
    note: "Le nuage reste plat : on est en 2D, simplement vu en perspective.",
  },
  {
    value: "radius",
    label: "Distance à l'origine",
    tex: String.raw`x_3 = \sqrt{x_1^2 + x_2^2}`,
    note: "Une feature qui contient de l'information utile sur « Cercles concentriques ».",
  },
  {
    value: "product",
    label: "Produit des deux",
    tex: String.raw`x_3 = x_1 \cdot x_2`,
    note: "Exactement la feature qui rend XOR séparable par un plan.",
  },
  {
    value: "noise",
    label: "Bruit pur",
    tex: String.raw`x_3 \sim \mathcal{N}(0, 1)`,
    note: "Une feature sans aucune information. À observer : elle ne fait qu'écarter les points.",
  },
];

export function SpaceLab() {
  const { dataset, seed } = useLab();
  const [third, setThird] = React.useState<ThirdFeature>("radius");
  const [planeHeight, setPlaneHeight] = React.useState(1.6);
  const [showPlane, setShowPlane] = React.useState(true);
  const [showProjection, setShowProjection] = React.useState(false);
  const [selected, setSelected] = React.useState<number | null>(null);

  const points3 = React.useMemo<Point3[]>(() => {
    // A fixed offset per sample id keeps the "noise" feature stable while the
    // camera moves — a feature that flickers is unreadable.
    const pseudo = (id: number) => {
      const t = Math.sin(id * 12.9898 + seed * 78.233) * 43758.5453;
      return (t - Math.floor(t)) * 4 - 2;
    };
    return dataset.samples.map((s) => {
      const [a, b] = s.x;
      let z = 0;
      if (third === "radius") z = Math.hypot(a, b) - 1.6;
      else if (third === "product") z = a * b * 0.8;
      else if (third === "noise") z = pseudo(s.id);
      return { id: s.id, x: a, y: b, z, c: s.y };
    });
  }, [dataset.samples, third, seed]);

  const selectedPoint = points3.find((p) => p.id === selected) ?? null;

  // How well a horizontal plane at this height would separate the classes —
  // the honest measure of whether the third feature actually helps.
  const planeAccuracy = React.useMemo(() => {
    if (dataset.classNames.length !== 2 || third === "none") return null;
    let correct = 0;
    for (const p of points3) {
      const above = p.z > planeHeight - 1.6;
      if ((above ? 1 : 0) === p.c) correct += 1;
    }
    // A plane and its mirror are equally valid separators.
    return Math.max(correct, points3.length - correct) / (points3.length || 1);
  }, [points3, planeHeight, dataset.classNames.length, third]);

  const spec = THIRD.find((t) => t.value === third)!;

  const neighbours = React.useMemo(() => {
    if (!selectedPoint) return [];
    return points3
      .filter((p) => p.id !== selectedPoint.id)
      .map((p) => ({
        p,
        d2: euclidean([p.x, p.y], [selectedPoint.x, selectedPoint.y]),
        d3: euclidean([p.x, p.y, p.z], [selectedPoint.x, selectedPoint.y, selectedPoint.z]),
      }))
      .sort((a, b) => a.d3 - b.d3)
      .slice(0, 5);
  }, [selectedPoint, points3]);

  return (
    <PageShell
      eyebrow="Les données"
      title="Espace 2D / 3D"
      lede={
        <>
          Un plan est facile à dessiner, mais il cache l&apos;essentiel : les modèles
          travaillent dans un espace à autant de dimensions qu&apos;il y a de features. Passer à
          trois dimensions suffit à rendre concrètes des notions qui restent sinon abstraites —{" "}
          <strong>hyperplan</strong>, <strong>projection</strong>, et surtout{" "}
          <strong>pourquoi ajouter une feature peut tout résoudre</strong>.
        </>
      }
      wide
    >
      <Workbench
        plot={
          <div className="space-y-5">
            <Panel
              title="Le nuage en trois dimensions"
              subtitle="Faites-le tourner. Cliquez un point pour l'inspecter."
              bodyClassName="p-3"
              action={<ClassLegend classNames={dataset.classNames} />}
            >
              <Scatter3D
                points={points3}
                plane={showPlane && third !== "none" ? { a: 0, b: 0, c: planeHeight - 1.6 } : null}
                showProjection={showProjection}
                selected={selected}
                onSelect={setSelected}
                axisLabels={["x₁", "x₂", "x₃"]}
              />
            </Panel>

            <Panel
              title="La projection sur le plan x₁ x₂"
              subtitle="Ce que vous verriez en écrasant la 3ᵉ dimension : exactement la vue 2D des autres pages."
              bodyClassName="p-3"
            >
              <DataPlot
                dataset={dataset}
                aspect={1}
                maxWidth={380}
                styleFor={(s) =>
                  selected !== null
                    ? s.id === selected
                      ? { ring: "#eef2f8", scale: 1.3 }
                      : { dim: true }
                    : undefined
                }
              />
              <p className="mt-2 text-[11px] leading-snug text-ink-muted">
                Deux points qui se superposent ici peuvent être très éloignés en 3D. C&apos;est
                ce que « perdre de l&apos;information par projection » veut dire, et c&apos;est
                pourquoi visualiser des données en haute dimension est si trompeur.
              </p>
            </Panel>
          </div>
        }
        controls={
          <>
            <Segmented
              label="Troisième feature"
              value={third}
              options={THIRD.map((t) => ({ value: t.value, label: t.label }))}
              onChange={(v) => setThird(v as ThirdFeature)}
              size="sm"
            />
            <div className="rounded-lg border border-line bg-surface-2/40 px-3 py-2.5">
              <LiveFormula tex={spec.tex} className="!border-0 !bg-transparent !p-0" />
              <p className="mt-1.5 text-[11px] leading-snug text-ink-muted">{spec.note}</p>
            </div>

            <Toggle
              label="Plan séparateur"
              checked={showPlane}
              onChange={setShowPlane}
              hint="Un hyperplan en 3D est un plan. En 2D c'était une droite. En 100D, c'est un objet de dimension 99."
            />
            {showPlane && third !== "none" && (
              <Slider
                label="Hauteur du plan"
                value={planeHeight}
                min={-1}
                max={4}
                step={0.05}
                onChange={setPlaneHeight}
                format={(v) => (v - 1.6).toFixed(2)}
              />
            )}
            <Toggle
              label="Projections au sol"
              checked={showProjection}
              onChange={setShowProjection}
              hint="Chaque point projette son ombre sur le plan x₁ x₂."
            />

            <Divider label="Données" />
            <DatasetControls />
          </>
        }
        below={
          <>
            {planeAccuracy !== null && (
              <Stat
                label="Séparation par ce plan horizontal"
                value={`${(planeAccuracy * 100).toFixed(1)} %`}
                tone={planeAccuracy > 0.95 ? "good" : planeAccuracy > 0.75 ? "warning" : "critical"}
                hint="Un simple seuil sur x₃ suffit-il à séparer les classes ?"
              />
            )}

            {third === "radius" && (
              <Callout kind="insight" title="Essayez sur « Cercles concentriques »">
                Avec <Tex>{String.raw`x_3 = \sqrt{x_1^2 + x_2^2}`}</Tex>, les deux cercles se
                séparent verticalement et un simple plan horizontal les distingue à ~100 %.
                <br />
                <br />
                C&apos;est <strong>exactement</strong> ce que fait le kernel trick d&apos;un
                SVM, à ceci près qu&apos;il n&apos;a même pas besoin de calculer cette
                coordonnée.
              </Callout>
            )}

            {third === "noise" && (
              <Callout kind="warning" title="Une feature inutile n'est pas neutre">
                Le bruit n&apos;apporte aucune information, mais il{" "}
                <strong>écarte les points les uns des autres</strong>. Sélectionnez un point et
                comparez ses distances 2D et 3D ci-dessous : en 3D, tout le monde est plus loin,
                et les vrais voisins se noient. C&apos;est le premier étage de la{" "}
                <em>malédiction de la dimension</em>.
              </Callout>
            )}

            {selectedPoint && (
              <Panel
                title="Le point sélectionné"
                subtitle="Ses cinq plus proches voisins, mesurés dans les deux espaces"
              >
                <div className="tnum mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                  <span className="text-ink-muted">
                    x₁ <span className="text-ink">{formatNumber(selectedPoint.x, 3)}</span>
                  </span>
                  <span className="text-ink-muted">
                    x₂ <span className="text-ink">{formatNumber(selectedPoint.y, 3)}</span>
                  </span>
                  <span className="text-ink-muted">
                    x₃ <span className="text-ink">{formatNumber(selectedPoint.z, 3)}</span>
                  </span>
                </div>
                <table className="w-full text-[11px]">
                  <thead className="text-ink-muted">
                    <tr className="border-b border-line">
                      <th className="pb-1 text-left font-medium">Voisin</th>
                      <th className="pb-1 text-right font-medium">d en 2D</th>
                      <th className="pb-1 text-right font-medium">d en 3D</th>
                    </tr>
                  </thead>
                  <tbody className="tnum">
                    {neighbours.map(({ p, d2, d3 }) => (
                      <tr key={p.id} className="border-b border-line/50">
                        <td className="py-1">
                          <span className="inline-flex items-center gap-1.5 text-ink-2">
                            <ClassMark index={p.c} size={9} />
                            {dataset.classNames[p.c]}
                          </span>
                        </td>
                        <td className="py-1 text-right text-ink-2">{formatNumber(d2, 3)}</td>
                        <td className="py-1 text-right font-semibold text-ink">
                          {formatNumber(d3, 3)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>
            )}
          </>
        }
      />

      <SectionTitle hint="La même idée, à trois profondeurs de lecture.">
        Hyperplan, projection, dimension
      </SectionTitle>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <Levels
          intuition={
            <>
              <p>
                Une <strong>feature</strong> est un axe. Deux features, un plan. Trois, un
                volume. Dix features font un espace à dix axes, qu&apos;on ne peut pas dessiner
                — mais où toutes les formules continuent de marcher à l&apos;identique.
              </p>
              <p>
                Un <strong>hyperplan</strong> est simplement « ce qui coupe l&apos;espace en
                deux ». Une droite dans un plan, un plan dans un volume, et dans un espace à dix
                axes, un objet à neuf axes qu&apos;on ne visualise pas mais qui joue exactement
                le même rôle.
              </p>
              <p>
                Une <strong>projection</strong>, c&apos;est l&apos;ombre. Elle est toujours plus
                simple que l&apos;objet — et perd toujours de l&apos;information. Deux points
                qui se superposent dans l&apos;ombre peuvent être très éloignés en réalité.
              </p>
            </>
          }
          technique={
            <>
              <p>
                Dans <Tex>{String.raw`\mathbb{R}^d`}</Tex>, un hyperplan est l&apos;ensemble des{" "}
                <Tex>x</Tex> vérifiant <Tex>{String.raw`w^{\top}x + b = 0`}</Tex>. C&apos;est un
                sous-espace affine de dimension <Tex>d - 1</Tex>, et c&apos;est exactement ce
                que produisent la régression logistique, un SVM linéaire, Nearest Centroid, et
                un neurone unique.
              </p>
              <p>
                <strong>Ajouter une feature n&apos;est jamais neutre.</strong> Une feature
                informative peut rendre séparable ce qui ne l&apos;était pas — c&apos;est le
                réglage « distance à l&apos;origine » sur les cercles. Une feature purement
                bruitée n&apos;ajoute que de la distance, et dégrade tout ce qui repose sur le
                voisinage.
              </p>
              <p>
                <strong>La malédiction de la dimension.</strong> En grande dimension, le volume
                se concentre dans les coins et la distance entre le plus proche et le plus
                lointain voisin devient négligeable devant la distance moyenne. « Le plus
                proche » cesse alors d&apos;avoir un sens.
              </p>
              <p>
                <strong>Deux réponses possibles.</strong> Réduire la dimension (PCA, t-SNE,
                UMAP) ou choisir des modèles qui n&apos;en souffrent pas — les arbres, qui ne
                regardent qu&apos;une feature à la fois, s&apos;en tirent bien.
              </p>
            </>
          }
          maths={
            <>
              <p>L&apos;hyperplan et la distance signée d&apos;un point à celui-ci :</p>
              <LiveFormula
                tex={String.raw`\mathcal{H} = \{x \in \mathbb{R}^d : w^{\!\top}x + b = 0\}
                  \qquad
                  \mathrm{dist}(x, \mathcal{H}) = \frac{w^{\!\top}x + b}{\lVert w \rVert_2}`}
              />
              <p>La projection orthogonale de <Tex>x</Tex> sur <Tex>{String.raw`\mathcal{H}`}</Tex> :</p>
              <LiveFormula
                tex={String.raw`\mathrm{proj}_{\mathcal{H}}(x) = x - \frac{w^{\!\top}x + b}{\lVert w \rVert_2^2}\, w`}
              />
              <p>
                <strong>La concentration des distances</strong>, qui formalise la malédiction.
                Pour <Tex>n</Tex> points tirés uniformément dans{" "}
                <Tex>{String.raw`[0,1]^d`}</Tex> :
              </p>
              <LiveFormula
                tex={String.raw`\lim_{d \to \infty} \frac{\mathbb{E}\bigl[d_{\max} - d_{\min}\bigr]}{\mathbb{E}\bigl[d_{\min}\bigr]} \;\longrightarrow\; 0`}
              />
              <p>
                Le point le plus proche et le plus lointain finissent à la même distance
                relative. Toute méthode fondée sur le voisinage perd son sens — pas
                progressivement, mais assez vite : l&apos;effet est déjà net vers{" "}
                <Tex>d \approx 20</Tex> pour des données non structurées.
              </p>
              <p>
                <strong>Ce qui sauve les données réelles</strong> : elles ne remplissent pas
                leur espace. Des images de 784 pixels vivent sur une variété de dimension
                intrinsèque bien plus faible. C&apos;est l&apos;hypothèse de variété, et c&apos;est
                ce qui rend l&apos;apprentissage possible en haute dimension.
              </p>
            </>
          }
        />


        <Quiz
          questions={[
            {
              id: "sp1",
              question: "Qu'est-ce qu'un hyperplan, en une phrase ?",
              options: [
                { id: "a", label: "Une surface courbe qui sépare deux classes" },
                {
                  id: "b",
                  label:
                    "L'objet plat qui a une dimension de moins que l'espace : un point sur une droite, une droite dans un plan, un plan dans l'espace",
                },
                { id: "c", label: "Un plan dans un espace à plus de trois dimensions" },
              ],
              answer: 1,
              explanation: (
                <>
                  C&apos;est une définition relative, pas absolue : « hyperplan » ne veut rien
                  dire sans préciser dans quel espace. En dimension 100, un hyperplan a 99
                  dimensions — il est immense, et pourtant il reste « plat », c&apos;est-à-dire
                  décrit par une seule équation linéaire. Toute la <G t="frontiere">frontière</G>{" "}
                  d&apos;un modèle linéaire tient dans cette équation.
                </>
              ),
            },
            {
              id: "sp2",
              question:
                "Ajouter une troisième feature rend un problème séparable par un plan. Le problème était-il plus simple qu'il n'en avait l'air ?",
              options: [
                { id: "a", label: "Oui : il était déjà linéaire, on ne le voyait pas" },
                {
                  id: "b",
                  label:
                    "Non : il était non linéaire dans les deux features de départ, et il le reste. C'est le changement d'espace qui a créé la séparabilité",
                },
                { id: "c", label: "La question n'a pas de sens" },
              ],
              answer: 1,
              explanation: (
                <>
                  La séparabilité n&apos;est pas une propriété des données seules, mais du couple
                  (données, espace de description). Projetée à nouveau sur les deux features
                  d&apos;origine, la frontière plane redevient une courbe. Voir cette
                  double-lecture — plan là-haut, courbe en bas — est l&apos;argument entier de
                  cette page.
                </>
              ),
            },
            {
              id: "sp3",
              question:
                "En très grande dimension, que devient la distance entre deux points tirés au hasard ?",
              options: [
                { id: "a", label: "Elle tend vers zéro" },
                {
                  id: "b",
                  label:
                    "Toutes les distances deviennent presque égales, et « le plus proche voisin » cesse de vouloir dire grand-chose",
                },
                { id: "c", label: "Elle devient imprévisible" },
              ],
              answer: 1,
              explanation: (
                <>
                  Chaque dimension supplémentaire ajoute un écart au carré à la somme : le total
                  grandit, mais sa <em>variation</em> relative d&apos;une paire à l&apos;autre
                  s&apos;écrase. C&apos;est la « malédiction de la dimension », et c&apos;est la
                  raison pour laquelle <G t="knn">KNN</G> est excellent en 2D et douteux en 100D.
                </>
              ),
            },
          ]}
        />

        <div className="space-y-4">
          <Callout kind="insight" title="L'expérience à faire avec XOR">
            Dataset <strong>XOR</strong>, troisième feature{" "}
            <strong>« Produit des deux »</strong>. Les quatre quadrants se séparent
            verticalement : les deux quadrants d&apos;une classe montent, les deux autres
            descendent. Un plan horizontal les sépare parfaitement.
            <br />
            <br />
            Le problème qui avait bloqué le perceptron pendant vingt ans se résout avec{" "}
            <em>une feature en plus</em>, calculée en une multiplication.
          </Callout>

          <Panel title="Pourquoi tout le site est en 2D">
            <div className="prose-lab">
              <p>
                Les autres pages travaillent volontairement avec deux features. Ce n&apos;est pas
                une limite technique : c&apos;est la seule dimension où l&apos;on peut{" "}
                <strong>voir la <G t="frontiere">frontière de décision</G> en entier</strong>,
                partout, y compris là
                où il n&apos;y a pas de données.
              </p>
              <p>
                Tous les algorithmes du site fonctionnent en dimension quelconque — le code ne
                suppose nulle part <Tex>d = 2</Tex>. Ce qui ne se généralise pas, c&apos;est
                l&apos;image.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}
