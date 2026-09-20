"use client";

import * as React from "react";
import { PageShell, SectionTitle, Workbench } from "@/components/layout/PageShell";
import { Callout, Divider, Panel, Segmented, Slider, Stat, Toggle } from "@/components/ui";
import { G } from "@/components/ui/Glossary";
import { Levels } from "@/components/ui/Levels";
import { Quiz } from "@/components/lab/Quiz";
import { LiveFormula, Tex } from "@/components/math/Math";
import { DataPlot, EditHints } from "@/components/viz/DataPlot";
import { ClassLegend } from "@/components/viz/Legend";
import { KernelLift } from "@/components/viz/KernelLift";
import { DatasetControls } from "@/components/lab/DatasetControls";
import { useAsyncFit } from "@/lib/hooks/useAsyncFit";
import { DEFAULT_PARAMS } from "@/lib/ml/registry";
import { type KernelKind } from "@/lib/ml/models/svm";
import { formatNumber, formatPercent } from "@/lib/viz/geometry";
import { classColor, CHROME } from "@/lib/viz/palette";
import { useLab } from "@/store/lab";

const C_STEPS = [0.03, 0.1, 0.3, 1, 3, 10, 30, 100];

export function SvmLab() {
  const { dataset, setDataset } = useLab();
  const [cIndex, setCIndex] = React.useState(3);
  const [kernel, setKernel] = React.useState<KernelKind>("rbf");
  const [gamma, setGamma] = React.useState(1);
  const [degree, setDegree] = React.useState(3);
  const [showMargin, setShowMargin] = React.useState(true);

  const C = C_STEPS[cIndex];
  const nClasses = dataset.classNames.length;
  const binary = nClasses === 2;

  const params = React.useMemo(
    () => ({ ...DEFAULT_PARAMS, C, kernel, gamma, degree }),
    [C, kernel, gamma, degree],
  );

  // Fitting an SVM is the most expensive thing the site does: SMO re-solves the
  // whole dual every time a point moves. On the main thread that dropped the
  // page to 8 fps and froze the surface for the length of a drag, so both the
  // fit and the two grid sweeps happen in a worker.
  const fit = useAsyncFit({
    algo: "svm",
    dataset,
    params,
    resolution: 110,
    wantDecisionGrid: binary && showMargin,
  });

  const field = fit.field;
  const evaluation = fit.evaluation;
  const supportIds = React.useMemo(
    () => new Set(fit.extra.supportIds ?? []),
    [fit.extra.supportIds],
  );

  // Margin isolines: the ±1 level sets of the decision function. For a linear
  // kernel these are the two parallel lines of the classic picture; with RBF
  // they are curves, which is worth seeing rather than being told.
  const marginField = React.useMemo(() => {
    const grid = fit.extra.decisionGrid;
    if (!grid || !field || !binary || !showMargin) return null;
    return {
      res: field.res,
      values: grid,
      xMin: field.xMin,
      xMax: field.xMax,
      yMin: field.yMin,
      yMax: field.yMax,
    };
  }, [fit.extra.decisionGrid, field, binary, showMargin]);

  const counts = dataset.classNames.map((_, i) => dataset.samples.filter((s) => s.y === i).length);
  const weights = binary ? (fit.extra.weights ?? null) : null;
  const bias = fit.extra.bias ?? 0;

  return (
    <PageShell
      eyebrow="Classification"
      title="Support Vector Machines"
      lede={
        <>
          Entre deux classes séparables il existe une infinité de droites. Le SVM en choisit
          une seule : celle qui laisse <strong>le plus de place</strong> de chaque côté — la{" "}
          <G t="marge">marge</G> la plus large. Cette
          exigence a deux conséquences remarquables — la frontière ne dépend que d&apos;une
          poignée de points, et elle peut devenir arbitrairement courbe sans jamais quitter
          les mathématiques de la ligne droite.
        </>
      }
      wide
    >
      <Workbench
        plot={
          <div className="space-y-5">
            <Panel
              title="La marge et ses gardiens"
              subtitle="Les points cerclés sont les vecteurs de support. Supprimez-en un autre : rien ne bouge."
              bodyClassName="p-3"
              action={<ClassLegend classNames={dataset.classNames} counts={counts} />}
            >
              <DataPlot
                dataset={dataset}
                onChange={setDataset}
                field={field}
                mode="edit"
                aspect={1}
                styleFor={(s) => {
                  if (supportIds.has(s.id)) return { ring: CHROME.ink, scale: 1.12 };
                  if (evaluation?.wrongIds.includes(s.id)) return { wrong: true, dim: true };
                  return { dim: true };
                }}
                overlay={(frame) =>
                  marginField ? (
                    <g clipPath="url(#plot-clip)">
                      <path
                        d={isoPath(marginField, 1, frame)}
                        fill="none"
                        stroke={classColor(1)}
                        strokeWidth={1.25}
                        strokeDasharray="5 4"
                        opacity={0.8}
                      />
                      <path
                        d={isoPath(marginField, -1, frame)}
                        fill="none"
                        stroke={classColor(0)}
                        strokeWidth={1.25}
                        strokeDasharray="5 4"
                        opacity={0.8}
                      />
                    </g>
                  ) : null
                }
              />
              <EditHints />
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-2.5 text-[11px] text-ink-muted">
                <span className="inline-flex items-center gap-1.5">
                  <svg width="14" height="14" aria-hidden>
                    <circle cx="7" cy="7" r="5.5" fill="none" stroke={CHROME.ink} strokeWidth="1.5" />
                    <circle cx="7" cy="7" r="2.5" fill={classColor(0)} />
                  </svg>
                  vecteur de support
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <svg width="18" height="6" aria-hidden>
                    <line x1="0" y1="3" x2="18" y2="3" stroke={CHROME.ink} strokeWidth="1.5" strokeDasharray="5 4" />
                  </svg>
                  bord de marge (<Tex>{String.raw`f(x) = \pm 1`}</Tex>)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <svg width="18" height="6" aria-hidden>
                    <line x1="0" y1="3" x2="18" y2="3" stroke={CHROME.ink} strokeWidth="1.5" />
                  </svg>
                  frontière (<Tex>f(x) = 0</Tex>)
                </span>
              </div>
            </Panel>

            <Panel
              title="Le kernel trick, en trois dimensions"
              subtitle="Pourquoi un problème que nulle droite ne sépare devient séparable par un plan."
              bodyClassName="p-3"
            >
              <KernelLift dataset={dataset} kernel={kernel} gamma={gamma} degree={degree} />
            </Panel>
          </div>
        }
        controls={
          <>
            <Slider
              label={
                <>
                  <Tex>C</Tex> — coût d&apos;une erreur
                </>
              }
              value={cIndex}
              min={0}
              max={C_STEPS.length - 1}
              step={1}
              onChange={setCIndex}
              format={() => (C < 1 ? C.toString() : String(C))}
              hint={
                C <= 0.1
                  ? "C très petit : la marge prime sur les erreurs. Le modèle accepte de mal classer des points pour rester simple."
                  : C >= 30
                    ? "C très grand : chaque erreur coûte cher. La frontière se contorsionne pour attraper les points isolés — c'est du surapprentissage."
                    : "C arbitre entre « marge large » et « peu d'erreurs »."
              }
            />
            <Segmented
              label="Kernel"
              value={kernel}
              options={[
                { value: "linear", label: "Linéaire", title: "Une droite, rien d'autre" },
                { value: "rbf", label: "RBF", title: "Gaussien — le plus utilisé" },
                { value: "poly", label: "Polynomial" },
              ]}
              onChange={(v) => setKernel(v as KernelKind)}
            />
            {kernel === "rbf" && (
              <Slider
                label={
                  <>
                    <Tex>{String.raw`\gamma`}</Tex> — portée d&apos;influence
                  </>
                }
                value={gamma}
                min={0.1}
                max={8}
                step={0.1}
                onChange={setGamma}
                format={(v) => v.toFixed(1)}
                hint={
                  gamma > 4
                    ? "γ élevé : chaque point n'influence que son voisinage immédiat. La frontière se fragmente en îlots autour des points."
                    : "Plus γ est grand, plus l'influence de chaque point est locale."
                }
              />
            )}
            {kernel === "poly" && (
              <Slider
                label="Degré du polynôme"
                value={degree}
                min={2}
                max={6}
                onChange={setDegree}
              />
            )}
            <Toggle
              label="Afficher les bords de marge"
              checked={showMargin}
              onChange={setShowMargin}
              hint={binary ? undefined : "Disponible uniquement en classification binaire."}
            />
            <Divider label="Données" />
            <DatasetControls showClasses={false} />
          </>
        }
        below={
          <>
            <div className="grid grid-cols-2 gap-2">
              <Stat
                label="Vecteurs de support"
                value={supportIds.size}
                hint={`sur ${dataset.samples.length} points — soit ${formatPercent(supportIds.size / Math.max(1, dataset.samples.length), 0)}`}
              />
              <Stat
                label="Accuracy"
                value={evaluation ? formatPercent(evaluation.accuracy) : "—"}
                tone={evaluation && evaluation.accuracy > 0.9 ? "good" : "neutral"}
              />
            </div>

            <Panel title="Le modèle appris" subtitle="Ce que le SVM stocke réellement">
              {weights ? (
                <LiveFormula
                  tex={String.raw`f(x) = w_1 x_1 + w_2 x_2 + b`}
                  terms={[
                    { symbol: "w_1", value: formatNumber(weights[0], 3) },
                    { symbol: "w_2", value: formatNumber(weights[1], 3) },
                    { symbol: "b", value: formatNumber(bias, 3) },
                    {
                      symbol: String.raw`\text{marge} = 2/\lVert w \rVert`,
                      value: formatNumber(2 / (Math.hypot(weights[0], weights[1]) || 1), 3),
                    },
                  ]}
                />
              ) : (
                <>
                  <LiveFormula
                    tex={String.raw`f(x) = \sum_{i \in SV} \alpha_i y_i \, K(x_i, x) + b`}
                    terms={[
                      { symbol: String.raw`|SV|`, value: supportIds.size },
                      { symbol: "b", value: formatNumber(bias, 3) },
                    ]}
                  />
                  <p className="mt-2 text-[11px] leading-snug text-ink-muted">
                    Avec un kernel non linéaire il n&apos;existe pas de vecteur{" "}
                    <Tex>w</Tex> à afficher : le modèle <em>est</em> la liste de ses vecteurs de
                    support et de leurs poids <Tex>{String.raw`\alpha_i`}</Tex>.
                  </p>
                </>
              )}
            </Panel>

            <Callout kind="insight" title="La propriété à vérifier vous-même">
              Supprimez (Alt + clic) un point qui n&apos;est <strong>pas</strong> cerclé :
              la frontière ne bouge pas d&apos;un pixel. Supprimez-en un qui l&apos;est : elle
              saute. C&apos;est littéralement ce que veut dire « vecteur de support ».
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
                Vous tracez une frontière entre deux villages. Beaucoup de tracés séparent
                correctement les maisons. Lequel choisir ? Celui qui passe{" "}
                <strong>le plus loin possible des maisons les plus proches</strong> — parce
                qu&apos;une nouvelle maison construite près de la limite aura alors le plus de
                chances de tomber du bon côté.
              </p>
              <p>
                Conséquence directe : seules les maisons <em>au bord</em> comptent. Celles du
                centre du village pourraient disparaître sans rien changer. Ce sont les{" "}
                <strong>vecteurs de support</strong>.
              </p>
              <p>
                Et quand aucune ligne droite ne marche — comme deux cercles concentriques —
                l&apos;astuce est de changer de point de vue. Soulevez le cercle intérieur en
                l&apos;air : vu de côté, un simple plan horizontal sépare maintenant les deux
                groupes. C&apos;est ce que fait le graphique 3D ci-dessus, et c&apos;est ça, le{" "}
                <strong>kernel trick</strong>.
              </p>
            </>
          }
          technique={
            <>
              <p>
                Le SVM maximise la <strong>marge</strong> : la distance entre la frontière et
                les points les plus proches. C&apos;est une différence de nature avec un
                perceptron, qui s&apos;arrête dès qu&apos;il a séparé les classes, sans se
                soucier de savoir à quel point c&apos;est juste.
              </p>
              <p>
                <strong><Tex>C</Tex> est l&apos;arbitre.</strong> Il borne l&apos;influence
                maximale d&apos;un point : un <Tex>C</Tex> faible autorise des violations de
                marge et privilégie une frontière simple ; un <Tex>C</Tex> élevé force le modèle
                à respecter chaque point, jusqu&apos;à épouser le bruit. Sur le dataset
                « Clusters + outliers », faites varier <Tex>C</Tex> et regardez la frontière
                aller chercher les points aberrants.
              </p>
              <p>
                <strong>Le kernel trick.</strong> Le problème dual ne fait intervenir les
                données que par des produits scalaires{" "}
                <Tex>{String.raw`\langle x_i, x_j \rangle`}</Tex>. On peut donc remplacer ce
                produit scalaire par une fonction <Tex>K</Tex> qui calcule le produit scalaire{" "}
                <em>dans un autre espace</em>, sans jamais y transporter les données. Pour le
                noyau RBF, cet espace est de dimension infinie — et le calcul reste une simple
                exponentielle.
              </p>
              <p>
                <strong><Tex>{String.raw`\gamma`}</Tex> règle la localité.</strong> Grand{" "}
                <Tex>{String.raw`\gamma`}</Tex>, chaque point n&apos;influence que son entourage
                immédiat : la frontière se fragmente en petites bulles autour des points
                d&apos;entraînement — c&apos;est du surapprentissage, et c&apos;est très visible.
              </p>
            </>
          }
          maths={
            <>
              <p>
                <strong>Le problème primal</strong>, formulation à marge souple. On minimise la
                norme de <Tex>w</Tex> (donc on maximise la marge{" "}
                <Tex>{String.raw`2/\lVert w \rVert`}</Tex>) en payant les violations :
              </p>
              <LiveFormula
                tex={String.raw`\min_{w, b, \xi} \;\; \tfrac{1}{2}\lVert w \rVert^2 \;+\; C \sum_{i=1}^{n} \xi_i
                  \qquad \text{s.c.} \quad y_i\bigl(w^{\!\top} x_i + b\bigr) \ge 1 - \xi_i, \;\; \xi_i \ge 0`}
              />
              <p>
                <Tex>{String.raw`\xi_i`}</Tex> mesure de combien le point <Tex>i</Tex> viole sa
                contrainte. <Tex>{String.raw`\xi_i = 0`}</Tex> : bien classé, hors marge.{" "}
                <Tex>{String.raw`0 < \xi_i < 1`}</Tex> : dans la marge mais du bon côté.{" "}
                <Tex>{String.raw`\xi_i > 1`}</Tex> : du mauvais côté.
              </p>
              <p><strong>Le dual</strong>, obtenu par les multiplicateurs de Lagrange :</p>
              <LiveFormula
                tex={String.raw`\max_{\alpha} \; \sum_{i} \alpha_i - \tfrac{1}{2}\sum_{i,j} \alpha_i \alpha_j y_i y_j \, K(x_i, x_j)
                  \qquad \text{s.c.} \quad 0 \le \alpha_i \le C, \;\; \sum_i \alpha_i y_i = 0`}
              />
              <p>
                <strong>C&apos;est ici que tout se joue.</strong> Les données n&apos;apparaissent
                que dans <Tex>{String.raw`K(x_i, x_j)`}</Tex> — jamais seules. On peut donc
                changer d&apos;espace en changeant seulement <Tex>K</Tex>.
              </p>
              <p>Et les conditions KKT donnent la sparsité :</p>
              <LiveFormula
                tex={String.raw`\alpha_i = 0 \iff y_i f(x_i) > 1
                  \qquad
                  0 < \alpha_i < C \iff y_i f(x_i) = 1
                  \qquad
                  \alpha_i = C \iff y_i f(x_i) \le 1`}
              />
              <p>
                Autrement dit : tout point strictement hors marge a{" "}
                <Tex>{String.raw`\alpha_i = 0`}</Tex> et <strong>disparaît de la
                somme</strong>. La frontière ne dépend que des points sur la marge ou à
                l&apos;intérieur. La borne supérieure <Tex>C</Tex> est ce qui empêche un seul
                point aberrant de tirer indéfiniment sur la frontière.
              </p>
              <p>Les noyaux proposés :</p>
              <LiveFormula
                tex={String.raw`K_{\text{lin}}(x, z) = x^{\!\top} z
                  \qquad
                  K_{\text{RBF}}(x, z) = e^{-\gamma \lVert x - z \rVert^2}
                  \qquad
                  K_{\text{poly}}(x, z) = (\gamma\, x^{\!\top} z + 1)^{d}`}
              />
            </>
          }
        />


        <Quiz
          questions={[
            {
              id: "svm1",
              question:
                "Vous supprimez un point loin de la frontière, qui n'est pas cerclé. Que devient le modèle ?",
              options: [
                { id: "a", label: "La frontière se déplace un peu" },
                { id: "b", label: "Rien ne change : ce point n'entrait pas dans le calcul" },
                { id: "c", label: "La marge s'élargit" },
              ],
              answer: 1,
              explanation: (
                <>
                  La solution ne dépend que des <G t="vecteursupport">vecteurs de support</G> —
                  les points cerclés, sur ou dans la marge. Tous les autres pourraient
                  disparaître sans que la droite bouge d&apos;un pixel. C&apos;est une propriété
                  qu&apos;aucun autre modèle du site ne possède : supprimez des points au hasard
                  au-dessus et regardez le compteur de vecteurs de support, lui, ne pas bouger.
                </>
              ),
            },
            {
              id: "svm2",
              question: "Que fait exactement le paramètre C quand on le fait tendre vers l'infini ?",
              options: [
                {
                  id: "a",
                  label:
                    "Il interdit toute erreur d'entraînement, quitte à réduire la marge à presque rien",
                },
                { id: "b", label: "Il élargit la marge au maximum" },
                { id: "c", label: "Il rend le modèle plus régularisé" },
              ],
              answer: 0,
              explanation: (
                <>
                  <Tex>C</Tex> est le prix d&apos;une erreur. Très grand, la moindre violation
                  coûte tellement cher que le modèle tord sa frontière pour attraper jusqu&apos;au
                  point le plus aberrant : marge étroite, <G t="overfitting">surapprentissage</G>.
                  Très petit, il accepte des erreurs pour garder une marge large et se
                  régularise. Montez et descendez <Tex>C</Tex> avec un outlier dans le nuage :
                  c&apos;est le réglage le plus visible de la page.
                </>
              ),
            },
            {
              id: "svm3",
              question:
                "Le « kernel trick » consiste à projeter les points dans un espace de plus grande dimension. Que fait-on réellement ?",
              options: [
                { id: "a", label: "On calcule les nouvelles coordonnées, puis on sépare" },
                {
                  id: "b",
                  label:
                    "On ne calcule jamais ces coordonnées : seuls les produits scalaires entre points sont nécessaires, et le kernel les donne directement",
                },
                { id: "c", label: "On ajoute des features au dataset" },
              ],
              answer: 1,
              explanation: (
                <>
                  Toute la résolution du SVM ne fait intervenir les points que par paires, à
                  travers leur produit scalaire. Un <G t="kernel">kernel</G> calcule ce produit
                  scalaire <em>tel qu&apos;il serait</em> dans l&apos;espace transformé, sans
                  jamais y aller — et pour le kernel RBF cet espace est de dimension infinie,
                  donc littéralement incalculable. L&apos;animation 3D montre l&apos;idée ;
                  l&apos;algorithme, lui, reste en 2D.
                </>
              ),
            },
          ]}
        />

        <div className="space-y-4">
          <Callout kind="insight" title="Les trois expériences">
            <ul className="mt-1.5 space-y-1.5">
              <li>
                Dataset « Cercles concentriques », kernel <strong>linéaire</strong> : échec
                total, ~50 % d&apos;accuracy. Passez en <strong>RBF</strong> : ~100 %. Le
                graphique 3D montre pourquoi.
              </li>
              <li>
                Kernel RBF, <Tex>{String.raw`\gamma = 8`}</Tex> : la frontière se casse en
                bulles autour des points. Le nombre de vecteurs de support explose — c&apos;est
                le signal d&apos;alarme du surapprentissage chez un SVM.
              </li>
              <li>
                « Classes qui se recouvrent », <Tex>{String.raw`C = 0{,}03`}</Tex> puis{" "}
                <Tex>C = 100</Tex>. Observez la proportion de vecteurs de support : quand{" "}
                <Tex>C</Tex> est petit, presque tous les points en deviennent.
              </li>
            </ul>
          </Callout>

          <Callout kind="warning" title="Le coût caché du kernel">
            Un SVM à noyau stocke ses vecteurs de support et doit calculer un noyau contre
            chacun à chaque prédiction. Si 60 % de vos données deviennent vecteurs de support,
            vous avez un modèle presque aussi lourd que KNN — sans son avantage de simplicité.
            Le nombre affiché n&apos;est pas une curiosité : c&apos;est une mesure du coût.
          </Callout>

          <Panel title="Cas pratiques" subtitle="Là où les SVM restent le bon outil">
            <div className="prose-lab">
              <p>
                <strong>Classification de texte en haute dimension.</strong> Avec des milliers
                de features et peu d&apos;exemples, les SVM linéaires restent très compétitifs :
                la maximisation de marge est une forme de régularisation qui les rend robustes
                quand <Tex>{String.raw`d > n`}</Tex>, une situation où beaucoup de modèles s&apos;effondrent.
              </p>
              <p>
                <strong>Bio-informatique.</strong> Classification de séquences protéiques ou
                d&apos;expression génique : quelques dizaines d&apos;échantillons, des dizaines
                de milliers de features. Des noyaux spécialisés (noyaux de chaînes, noyaux de
                graphes) permettent d&apos;appliquer la même machinerie à des objets qui ne sont
                pas des vecteurs.
              </p>
              <p>
                <strong>Reconnaissance de motifs sur petits jeux de données.</strong> Avant les
                réseaux profonds, les SVM sur descripteurs HOG dominaient la détection
                d&apos;objets. Sur quelques centaines d&apos;images étiquetées, ils restent
                souvent préférables à un réseau qu&apos;on n&apos;a pas de quoi entraîner.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}

/**
 * Marching-squares isoline of the decision function at a given level, returned
 * as an SVG path. Used for the ±1 margin borders, which for a kernel SVM are
 * curves and not the two parallel lines of the textbook picture.
 */
function isoPath(
  grid: { res: number; values: Float32Array; xMin: number; xMax: number; yMin: number; yMax: number },
  level: number,
  frame: { px: (x: number, y: number) => [number, number] },
): string {
  const { res, values, xMin, xMax, yMin, yMax } = grid;
  const at = (i: number, j: number) => values[j * res + i] - level;
  const dx = (xMax - xMin) / res;
  const dy = (yMax - yMin) / res;
  const cx = (i: number) => xMin + dx * (i + 0.5);
  const cy = (j: number) => yMin + dy * (j + 0.5);
  const lerp = (a: number, b: number) => (Math.abs(b - a) < 1e-12 ? 0.5 : -a / (b - a));

  let d = "";
  for (let j = 0; j < res - 1; j++) {
    for (let i = 0; i < res - 1; i++) {
      const v00 = at(i, j);
      const v10 = at(i + 1, j);
      const v11 = at(i + 1, j + 1);
      const v01 = at(i, j + 1);
      const code = (v00 > 0 ? 1 : 0) | (v10 > 0 ? 2 : 0) | (v11 > 0 ? 4 : 0) | (v01 > 0 ? 8 : 0);
      if (code === 0 || code === 15) continue;

      const bottom: [number, number] = [cx(i) + dx * lerp(v00, v10), cy(j)];
      const right: [number, number] = [cx(i + 1), cy(j) + dy * lerp(v10, v11)];
      const top: [number, number] = [cx(i) + dx * lerp(v01, v11), cy(j + 1)];
      const left: [number, number] = [cx(i), cy(j) + dy * lerp(v00, v01)];
      const seg = (a: [number, number], b: [number, number]) => {
        const [ax, ay] = frame.px(a[0], a[1]);
        const [bx, by] = frame.px(b[0], b[1]);
        d += `M${ax.toFixed(1)},${ay.toFixed(1)}L${bx.toFixed(1)},${by.toFixed(1)}`;
      };

      switch (code) {
        case 1: case 14: seg(left, bottom); break;
        case 2: case 13: seg(bottom, right); break;
        case 3: case 12: seg(left, right); break;
        case 4: case 11: seg(right, top); break;
        case 6: case 9: seg(bottom, top); break;
        case 7: case 8: seg(left, top); break;
        case 5:
        case 10: {
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
