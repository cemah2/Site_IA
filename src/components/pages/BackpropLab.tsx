"use client";

import * as React from "react";
import { PageShell, SectionTitle, Workbench } from "@/components/layout/PageShell";
import { Button, Callout, cx, Divider, Panel, Slider, Stat } from "@/components/ui";
import { G } from "@/components/ui/Glossary";
import { Levels } from "@/components/ui/Levels";
import { Quiz } from "@/components/lab/Quiz";
import { LiveFormula, Tex } from "@/components/math/Math";
import { DataPlot } from "@/components/viz/DataPlot";
import { ClassMark } from "@/components/viz/Legend";
import { NetworkDiagram, WeightLegend } from "@/components/viz/NetworkDiagram";
import { StageStepper } from "@/components/lab/StageStepper";
import { computeField } from "@/lib/ml/field";
import { formatNumber, formatPercent } from "@/lib/viz/geometry";
import { classColor, CHROME, DIVERGING, rampAt } from "@/lib/viz/palette";
import { useLab } from "@/store/lab";
import { useNetwork } from "@/store/network";

const STAGES = [
  { label: "Prédiction", detail: "Le forward pass donne une distribution de probabilité." },
  { label: "Loss", detail: "On mesure l'écart avec la vraie classe : l'entropie croisée." },
  { label: "δ en sortie", detail: "Pour softmax + cross-entropy, δ vaut exactement ŷ − y." },
  { label: "δ remonte", detail: "Chaque couche reçoit l'erreur de la suivante, pondérée par ses poids." },
  { label: "Gradients des poids", detail: "∂L/∂w = δ du neurone d'arrivée × activation du neurone de départ." },
  { label: "Mise à jour", detail: "Chaque poids descend d'un pas α × son gradient." },
];

export function BackpropLab() {
  const { dataset } = useLab();
  const { net, version, ensureOutputs, applyOneStep, reset, learningRate, setLearningRate } =
    useNetwork();
  const [sampleIdx, setSampleIdx] = React.useState(0);
  const [stage, setStage] = React.useState(0);
  const [lastLoss, setLastLoss] = React.useState<{ before: number; after: number } | null>(null);

  const nClasses = dataset.classNames.length;
  React.useEffect(() => ensureOutputs(nClasses), [nClasses, ensureOutputs]);

  const sample = dataset.samples[Math.min(sampleIdx, dataset.samples.length - 1)];
  const ready = net.config.nOutputs === nClasses && Boolean(sample);

  const { trace, grad, field } = React.useMemo(() => {
    void version;
    if (!ready) return { trace: null, grad: null, field: null };
    const t = net.forward(sample.x);
    return {
      trace: t,
      grad: net.backward(t, sample.y),
      field: computeField(net, dataset.domain, 76),
    };
  }, [net, sample, ready, dataset.domain, version]);

  const L = net.W.length;
  const maxGrad = grad
    ? Math.max(1e-9, ...grad.gradW.flatMap((l) => l.flatMap((r) => r.map(Math.abs))))
    : 1;

  const doStep = () => {
    if (!trace) return;
    const before = grad!.loss;
    applyOneStep(sample, learningRate);
    const after = -Math.log(Math.max(net.forward(sample.x).output[sample.y] ?? 1e-12, 1e-12));
    setLastLoss({ before, after });
    setStage(0);
  };

  return (
    <PageShell
      eyebrow="Réseaux de neurones"
      title="Backpropagation"
      lede={
        <>
          Le forward pass donne une réponse. La backpropagation répond à la question suivante :{" "}
          <strong>de combien faut-il bouger chacun des {net.parameterCount} poids pour que
          cette réponse soit meilleure ?</strong> C&apos;est la règle de dérivation des
          fonctions composées, appliquée avec méthode — rien de plus mystérieux.
        </>
      }
      wide
    >
      <Workbench
        plot={
          <div className="space-y-5">
            <Panel
              title="Le réseau"
              subtitle={
                stage < 3
                  ? "Poids actuels. L'épaisseur est l'intensité, la couleur le signe."
                  : "Gradients : l'épaisseur est l'intensité du gradient, la couleur son signe."
              }
              bodyClassName="p-4"
              action={<WeightLegend label={stage < 3 ? "Poids" : "Gradient ∂L/∂w"} />}
            >
              {ready && (
                <NetworkDiagram
                  net={net}
                  trace={trace}
                  grad={stage >= 3 ? grad : null}
                  mode={stage >= 4 ? "gradients" : "activations"}
                  classNames={dataset.classNames}
                  height={300}
                />
              )}
              {stage >= 3 && grad && (
                <div className="mt-3 border-t border-line pt-3">
                  <p className="mb-2 text-[11px] font-medium text-ink-2">
                    δ par couche — l&apos;erreur telle qu&apos;elle arrive à chaque neurone
                  </p>
                  <div className="space-y-2">
                    {grad.delta
                      .map((d, l) => ({ d, l }))
                      .reverse()
                      .map(({ d, l }) => (
                        <div key={l} className="flex items-center gap-2">
                          <span className="w-20 shrink-0 text-[10px] text-ink-muted">
                            {l === L - 1 ? "sortie" : `cachée ${l + 1}`}
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {d.map((v, i) => (
                              <span
                                key={i}
                                className="tnum rounded px-1.5 py-0.5 text-[10px] font-medium"
                                style={{
                                  background: rampAt(
                                    DIVERGING,
                                    (Math.max(-1, Math.min(1, v / (Math.max(...d.map(Math.abs)) || 1))) + 1) / 2,
                                  ),
                                  color: CHROME.plane,
                                }}
                              >
                                {v.toFixed(3)}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </Panel>

            {stage >= 4 && grad && (
              <Panel
                title="Les gradients, poids par poids"
                subtitle="∂L/∂w pour chaque connexion. Le signe dit dans quel sens le poids va bouger."
                bodyClassName="p-3"
              >
                <div className="space-y-4">
                  {grad.gradW.map((layer, l) => (
                    <div key={l}>
                      <p className="mb-1.5 text-[11px] font-medium text-ink-2">
                        Couche {l + 1} — matrice {layer.length} × {layer[0]?.length ?? 0}
                      </p>
                      <div className="overflow-x-auto">
                        <table className="text-[10px]">
                          <tbody>
                            {layer.map((row, j) => (
                              <tr key={j}>
                                <td className="pr-2 text-ink-muted">n{j + 1}</td>
                                {row.map((g, i) => (
                                  <td key={i} className="p-0.5">
                                    <span
                                      className="tnum block rounded px-1.5 py-1 text-center font-medium"
                                      style={{
                                        background: rampAt(
                                          DIVERGING,
                                          (Math.max(-1, Math.min(1, g / maxGrad)) + 1) / 2,
                                        ),
                                        color: CHROME.plane,
                                        minWidth: 52,
                                      }}
                                      title={`∂L/∂w[${j}][${i}] = ${g}`}
                                    >
                                      {g.toFixed(3)}
                                    </span>
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            )}

            <Panel
              title="Le point d'entraînement choisi"
              subtitle="Cliquez sur un point du nuage pour faire remonter l'erreur de celui-là."
              bodyClassName="p-3"
            >
              <DataPlot
                dataset={dataset}
                field={field}
                aspect={1}
                maxWidth={420}
                styleFor={(s) =>
                  s.id === sample?.id ? { ring: CHROME.ink, scale: 1.3 } : { dim: true }
                }
                onQuery={(x, y) => {
                  // Snap to the nearest real sample: backpropagation needs a
                  // LABELLED point, and an arbitrary click has no true class.
                  let best = 0;
                  let bestD = Infinity;
                  dataset.samples.forEach((s, i) => {
                    const d = (s.x[0] - x) ** 2 + (s.x[1] - y) ** 2;
                    if (d < bestD) {
                      bestD = d;
                      best = i;
                    }
                  });
                  setSampleIdx(best);
                  setStage(0);
                }}
              />
              <p className="mt-2 text-[11px] text-ink-muted">
                La backpropagation a besoin d&apos;une <strong>vraie classe</strong> pour
                mesurer une erreur : le clic se cale sur le point d&apos;entraînement le plus
                proche.
              </p>
            </Panel>
          </div>
        }
        controls={
          <>
            <StageStepper stages={STAGES} stage={stage} setStage={setStage} />
            <Divider label="Mise à jour" />
            <Slider
              label={
                <>
                  <Tex>{String.raw`\alpha`}</Tex> — learning rate
                </>
              }
              value={learningRate}
              min={0.005}
              max={1}
              step={0.005}
              onChange={setLearningRate}
              format={(v) => v.toFixed(3)}
            />
            <Button variant="primary" className="w-full" onClick={doStep} disabled={!ready}>
              Appliquer cette itération
            </Button>
            {lastLoss && (
              <div className="rounded-lg border border-line bg-surface-2/50 px-3 py-2 text-[11px] leading-snug">
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">Loss avant</span>
                  <span className="tnum text-ink">{formatNumber(lastLoss.before, 4)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">Loss après</span>
                  <span
                    className={cx(
                      "tnum font-semibold",
                      lastLoss.after < lastLoss.before ? "text-good" : "text-critical",
                    )}
                  >
                    {formatNumber(lastLoss.after, 4)}
                  </span>
                </div>
                <p className="mt-1 text-ink-muted">
                  {lastLoss.after < lastLoss.before
                    ? "La loss a baissé sur ce point : le pas est allé dans le bon sens."
                    : "La loss a monté : le pas était trop grand pour la courbure locale."}
                </p>
              </div>
            )}
            <Divider label="Le réseau" />
            <Button size="sm" variant="ghost" className="w-full" onClick={reset}>
              Réinitialiser les poids
            </Button>
            <p className="text-[11px] leading-snug text-ink-muted">
              Architecture {net.sizes.join(" → ")}. Partagée avec les pages{" "}
              <a href="/reseaux/forward/">Forward</a> et{" "}
              <a href="/reseaux/entrainement/">Entraînement</a>.
            </p>
          </>
        }
        below={
          <>
            {trace && grad && sample && (
              <Panel title="Ce que l'étape affiche" subtitle={STAGES[stage].label}>
                {stage === 0 && (
                  <>
                    <ul className="space-y-1.5">
                      {trace.output.map((p, c) => (
                        <li key={c} className="flex items-center gap-2">
                          <ClassMark index={c} />
                          <span className="w-10 shrink-0 text-[11px] text-ink-2">
                            {dataset.classNames[c]}
                          </span>
                          <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                            <span
                              className="absolute inset-y-0 left-0 rounded-full"
                              style={{ width: `${p * 100}%`, background: classColor(c) }}
                            />
                          </span>
                          <span className="tnum w-12 shrink-0 text-right text-xs font-semibold text-ink">
                            {formatPercent(p, 1)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2.5 text-[11px] leading-snug text-ink-2">
                      Vraie classe :{" "}
                      <strong className="text-ink">{dataset.classNames[sample.y]}</strong> · le
                      réseau dit{" "}
                      <strong className="text-ink">{dataset.classNames[trace.predicted]}</strong>
                    </p>
                  </>
                )}

                {stage === 1 && (
                  <LiveFormula
                    tex={String.raw`L = -\log \hat{y}_{\,c^{*}}`}
                    terms={[
                      { symbol: "c^{*}", value: dataset.classNames[sample.y] },
                      {
                        symbol: String.raw`\hat{y}_{c^{*}}`,
                        value: formatNumber(trace.output[sample.y], 4),
                      },
                    ]}
                    result={{ label: "Loss sur ce point", value: formatNumber(grad.loss, 4) }}
                  />
                )}

                {stage === 2 && (
                  <>
                    <LiveFormula tex={String.raw`\delta^{(L)} = \hat{y} - y`} />
                    <table className="mt-2 w-full text-[11px]">
                      <thead className="text-ink-muted">
                        <tr className="border-b border-line">
                          <th className="pb-1 text-left font-medium">Classe</th>
                          <th className="pb-1 text-right font-medium">ŷ</th>
                          <th className="pb-1 text-right font-medium">y</th>
                          <th className="pb-1 text-right font-medium">δ</th>
                        </tr>
                      </thead>
                      <tbody className="tnum">
                        {trace.output.map((p, c) => (
                          <tr key={c} className="border-b border-line/50">
                            <td className="py-1 text-ink-2">
                              <span className="inline-flex items-center gap-1.5">
                                <ClassMark index={c} size={9} />
                                {dataset.classNames[c]}
                              </span>
                            </td>
                            <td className="py-1 text-right text-ink-2">{p.toFixed(4)}</td>
                            <td className="py-1 text-right text-ink-2">
                              {c === sample.y ? 1 : 0}
                            </td>
                            <td className="py-1 text-right font-semibold text-ink">
                              {grad.delta[L - 1][c].toFixed(4)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="mt-2 text-[11px] leading-snug text-ink-muted">
                      Un δ positif veut dire « cette classe est prédite trop fort » ; négatif,
                      « pas assez ». Pour la vraie classe, δ est toujours négatif tant que la
                      prédiction n&apos;est pas parfaite.
                    </p>
                  </>
                )}

                {stage === 3 && (
                  <>
                    <LiveFormula
                      tex={String.raw`\delta^{(l)} = \bigl(W^{(l+1)\top} \delta^{(l+1)}\bigr) \odot f'\bigl(z^{(l)}\bigr)`}
                    />
                    <p className="mt-2 text-[11px] leading-relaxed text-ink-2">
                      Deux facteurs, et les deux comptent. Le premier répartit l&apos;erreur de
                      la couche suivante <strong>proportionnellement aux poids</strong> : un
                      neurone qui influence beaucoup reçoit beaucoup de responsabilité. Le
                      second la multiplie par <Tex>{String.raw`f'(z)`}</Tex> : un neurone saturé
                      a <Tex>{String.raw`f' \approx 0`}</Tex> et ne reçoit donc presque rien.
                    </p>
                    <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
                      C&apos;est exactement le mécanisme du{" "}
                      <a href="/reseaux/activations/">vanishing gradient</a> : ce facteur se
                      multiplie à chaque couche traversée.
                    </p>
                  </>
                )}

                {stage === 4 && (
                  <>
                    <LiveFormula
                      tex={String.raw`\frac{\partial L}{\partial w^{(l)}_{ji}} = \delta^{(l)}_j \cdot a^{(l-1)}_i
                        \qquad
                        \frac{\partial L}{\partial b^{(l)}_j} = \delta^{(l)}_j`}
                    />
                    <p className="mt-2 text-[11px] leading-relaxed text-ink-2">
                      Une multiplication, c&apos;est tout. Conséquence directe : si
                      l&apos;activation d&apos;entrée <Tex>{String.raw`a_i`}</Tex> est nulle, le
                      gradient du poids est nul et ce poids ne bouge pas — un neurone qui ne
                      s&apos;active jamais n&apos;apprend rien, et n&apos;apprend rien à ses
                      poids entrants non plus.
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Stat label="Plus grand |∂L/∂w|" value={formatNumber(maxGrad, 4)} />
                      <Stat
                        label="Pas maximal"
                        value={formatNumber(maxGrad * learningRate, 4)}
                        hint="α × le plus grand gradient"
                      />
                    </div>
                  </>
                )}

                {stage === 5 && (
                  <>
                    <LiveFormula
                      tex={String.raw`w \leftarrow w - \alpha \, \frac{\partial L}{\partial w}`}
                      terms={[{ symbol: String.raw`\alpha`, value: formatNumber(learningRate, 3) }]}
                    />
                    <p className="mt-2 text-[11px] leading-relaxed text-ink-2">
                      Cliquez sur <strong>Appliquer cette itération</strong> : les poids
                      changent, la <G t="frontiere">frontière de décision</G> bouge, et la{" "}
                      <G t="loss">loss</G> sur ce point est
                      recalculée avant/après.
                    </p>
                    <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
                      Un vrai entraînement fait ça des milliers de fois, sur tous les points.
                      C&apos;est l&apos;objet de la page{" "}
                      <a href="/reseaux/entrainement/">Entraînement</a>.
                    </p>
                  </>
                )}
              </Panel>
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
                Une entreprise sort un produit raté. Le directeur ne peut pas interroger chaque
                employé individuellement. Alors il dit à ses trois chefs de service : « vous
                avez collectivement 10 points d&apos;erreur ». Chaque chef reçoit une part
                proportionnelle à son influence sur le résultat, puis répartit sa part entre{" "}
                <em>ses</em> subordonnés, selon le même principe.
              </p>
              <p>
                En deux passes — une qui descend, une qui remonte — tout le monde sait de
                combien il doit se corriger. C&apos;est exactement la backpropagation.
              </p>
              <p>
                Le mot « propagation » est bien choisi : rien ne se calcule globalement. Chaque
                couche ne parle qu&apos;à sa voisine.
              </p>
            </>
          }
          technique={
            <>
              <p>
                La backpropagation n&apos;est <strong>pas</strong> un algorithme
                d&apos;apprentissage. C&apos;est une méthode de calcul du gradient. La descente
                de gradient, elle, est ce qui utilise ce gradient — les deux sont souvent
                confondues.
              </p>
              <p>
                <strong>Ce qui la rend indispensable, c&apos;est son coût.</strong> Estimer le
                gradient par différences finies demanderait un forward pass par paramètre : pour
                un million de poids, un million de passes. La backpropagation obtient{" "}
                <em>tous</em> les gradients en{" "}
                <strong>une seule passe arrière</strong>, soit environ deux fois le coût du
                forward.
              </p>
              <p>
                C&apos;est un cas particulier de la <em>différentiation automatique en mode
                inverse</em>, et la raison mathématique de son efficacité est précise : quand une
                fonction a beaucoup d&apos;entrées et une seule sortie — exactement le cas
                d&apos;une loss — le mode inverse est optimal.
              </p>
              <p>
                <strong>Le coût caché : la mémoire.</strong> Toutes les activations du forward
                doivent être conservées jusqu&apos;à la passe arrière. C&apos;est ce qui limite
                la taille des lots sur un GPU, bien avant la puissance de calcul.
              </p>
            </>
          }
          maths={
            <>
              <p>
                Toute la backpropagation tient dans la règle de dérivation des fonctions
                composées, appliquée en remontant :
              </p>
              <LiveFormula
                tex={String.raw`\frac{\partial L}{\partial z^{(l)}}
                  = \frac{\partial L}{\partial z^{(l+1)}} \cdot \frac{\partial z^{(l+1)}}{\partial a^{(l)}} \cdot \frac{\partial a^{(l)}}{\partial z^{(l)}}`}
              />
              <p>En notant <Tex>{String.raw`\delta^{(l)} = \partial L / \partial z^{(l)}`}</Tex>, les quatre équations :</p>
              <LiveFormula
                tex={String.raw`\begin{aligned}
                  \delta^{(L)} &= \nabla_a L \odot f'\bigl(z^{(L)}\bigr) \\[2pt]
                  \delta^{(l)} &= \bigl(W^{(l+1)\top}\delta^{(l+1)}\bigr) \odot f'\bigl(z^{(l)}\bigr) \\[2pt]
                  \partial L / \partial b^{(l)} &= \delta^{(l)} \\[2pt]
                  \partial L / \partial W^{(l)} &= \delta^{(l)} \bigl(a^{(l-1)}\bigr)^{\!\top}
                \end{aligned}`}
              />
              <p>
                <strong>La simplification softmax + entropie croisée.</strong> Avec{" "}
                <Tex>{String.raw`L = -\sum_c y_c \log \hat{y}_c`}</Tex> et{" "}
                <Tex>{String.raw`\hat{y} = \mathrm{softmax}(z)`}</Tex>, la jacobienne du softmax
                et le gradient de la log-vraisemblance se compensent exactement :
              </p>
              <LiveFormula tex={String.raw`\delta^{(L)} = \hat{y} - y`} />
              <p>
                Pas de <Tex>{String.raw`f'`}</Tex> résiduel, pas de division par{" "}
                <Tex>{String.raw`\hat{y}`}</Tex> qui pourrait exploser quand la prédiction est
                très mauvaise. C&apos;est pour cette raison de stabilité numérique, autant que
                pour l&apos;élégance, que ce couple est le standard.
              </p>
              <p>
                <strong>Coût.</strong> Le forward est en{" "}
                <Tex>{String.raw`O\left(\sum_l n_l n_{l-1}\right)`}</Tex> et la passe arrière en{" "}
                <Tex>{String.raw`O\left(2\sum_l n_l n_{l-1}\right)`}</Tex> : un produit
                matrice-vecteur pour remonter <Tex>{String.raw`\delta`}</Tex>, un produit
                extérieur pour former les gradients.
              </p>
            </>
          }
        />

        <Quiz
          questions={[
            {
              id: "bp1",
              question:
                "Avec un softmax et une entropie croisée, que vaut le δ de la couche de sortie ?",
              options: [
                { id: "a", label: "La dérivée de l'activation multipliée par l'erreur" },
                { id: "b", label: "Simplement la prédiction moins la vérité : ŷ − y" },
                { id: "c", label: "La somme des gradients de toutes les couches" },
              ],
              answer: 1,
              explanation: (
                <>
                  C&apos;est la raison pour laquelle ce couple est universel : les dérivées du
                  softmax et de l&apos;entropie croisée se simplifient exactement, et il ne reste
                  que « ce que tu as dit, moins ce que tu aurais dû dire ». Aucune règle de
                  dérivation en chaîne n&apos;est nécessaire pour le premier pas.
                </>
              ),
            },
            {
              id: "bp2",
              question: "Pourquoi le gradient d'un poids vaut-il « δ du neurone × entrée du poids » ?",
              options: [
                {
                  id: "a",
                  label:
                    "Parce que ce poids n'influence la loss qu'en multipliant cette entrée : son effet est proportionnel à elle",
                },
                { id: "b", label: "Par convention de calcul" },
                { id: "c", label: "Parce que les poids sont initialisés au hasard" },
              ],
              answer: 0,
              explanation: (
                <>
                  Si l&apos;entrée d&apos;un poids vaut zéro, le modifier ne change rien à la
                  sortie — son <G t="gradient">gradient</G> est nul, et c&apos;est ce que dit la
                  formule. Conséquence pratique : un neurone éteint par ReLU n&apos;apprend pas,
                  et les poids qui partent de lui non plus.
                </>
              ),
            },
            {
              id: "bp3",
              question: "En quoi la backpropagation est-elle « efficace » ?",
              options: [
                { id: "a", label: "Elle trouve le minimum global de la loss" },
                {
                  id: "b",
                  label:
                    "Elle obtient les gradients de tous les poids en une seule remontée, au lieu de re-tester chaque poids un par un",
                },
                { id: "c", label: "Elle évite d'avoir à faire la forward propagation" },
              ],
              answer: 1,
              explanation: (
                <>
                  Estimer numériquement le gradient demanderait deux passes avant par poids : sur
                  un million de poids, deux millions de passes pour un seul pas. La
                  backpropagation réutilise les calculs intermédiaires et obtient tout en une
                  remontée — environ le coût d&apos;une passe avant. Sans cette astuce, aucun
                  réseau moderne ne serait entraînable.
                </>
              ),
            },
          ]}
        />

        <div className="space-y-4">
          <Callout kind="insight" title="L'expérience à faire absolument">
            Choisissez un point que le réseau classe <strong>mal</strong> (le fond coloré
            diffère de la couleur du point). Passez à l&apos;étape 4 et regardez la matrice des
            gradients : les valeurs sont grandes.
            <br />
            <br />
            Choisissez maintenant un point loin de la frontière, bien classé. Les gradients sont
            minuscules. <strong>Un réseau n&apos;apprend que de ses erreurs</strong> — et cette
            phrase est littéralement vraie au niveau des nombres.
          </Callout>

          <Callout kind="warning" title="Une itération ne garantit pas une amélioration">
            Appliquez l&apos;itération avec <Tex>{String.raw`\alpha = 1`}</Tex> : la loss peut
            très bien <em>monter</em>. Le gradient ne donne que la direction de descente{" "}
            <strong>locale</strong> ; rien ne dit que la descente reste valable sur toute la
            longueur du pas.
          </Callout>

          <Panel title="Le détail qui fait la différence" subtitle="Un point, ou tout le lot ?">
            <div className="prose-lab">
              <p>
                Cette page applique le gradient d&apos;<strong>un seul point</strong>. C&apos;est
                la descente de gradient stochastique pure : bruyante, mais chaque mise à jour
                coûte presque rien.
              </p>
              <p>
                En pratique, on moyenne les gradients sur un <strong>mini-lot</strong> de 32 à
                256 exemples. Le bruit diminue, les produits matriciels deviennent efficaces, et
                le peu de bruit qui reste aide même à sortir des mauvais minima.
              </p>
              <p>
                Moyenner sur <em>tout</em> le dataset (batch gradient descent) donne la
                direction la plus juste, mais une seule mise à jour par passe complète — bien
                trop lent dès que les données sont volumineuses.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}
