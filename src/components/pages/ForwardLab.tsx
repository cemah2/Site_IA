"use client";

import * as React from "react";
import { PageShell, SectionTitle, Workbench } from "@/components/layout/PageShell";
import { Button, Callout, cx, Divider, Panel, Segmented, Slider, Stat } from "@/components/ui";
import { Levels } from "@/components/ui/Levels";
import { LiveFormula, Tex } from "@/components/math/Math";
import { DataPlot } from "@/components/viz/DataPlot";
import { ClassMark } from "@/components/viz/Legend";
import { NetworkDiagram, WeightLegend } from "@/components/viz/NetworkDiagram";
import { computeField } from "@/lib/ml/field";
import { formatNumber, formatPercent } from "@/lib/viz/geometry";
import { classColor, CHROME, rampAt, SEQUENTIAL } from "@/lib/viz/palette";
import { useLab } from "@/store/lab";
import { useNetwork } from "@/store/network";

const SPEEDS = [
  { value: "0.5", label: "Lent", ms: 1400 },
  { value: "1", label: "Normal", ms: 700 },
  { value: "2", label: "Rapide", ms: 300 },
];

export function ForwardLab() {
  const { dataset } = useLab();
  const { net, version, ensureOutputs, trainEpochs, reset } = useNetwork();
  const [query, setQuery] = React.useState<[number, number]>([0.8, 0.6]);
  const [front, setFront] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  const [speed, setSpeed] = React.useState("1");
  const [trained, setTrained] = React.useState(0);

  const nClasses = dataset.classNames.length;
  React.useEffect(() => ensureOutputs(nClasses), [nClasses, ensureOutputs]);

  // Training mutates the weight arrays in place, so the network object's
  // identity never changes; `version` is the store's signal that it did. Both
  // memos read it explicitly so the dependency is real rather than asserted.
  const trace = React.useMemo(() => {
    void version;
    return net.config.nOutputs === nClasses ? net.forward(query) : null;
  }, [net, query, nClasses, version]);

  const field = React.useMemo(() => {
    void version;
    return net.config.nOutputs === nClasses ? computeField(net, dataset.domain, 80) : null;
  }, [net, dataset.domain, nClasses, version]);

  const maxFront = net.sizes.length - 1;
  const ms = SPEEDS.find((s) => s.value === speed)!.ms;

  React.useEffect(() => {
    if (!playing) return;
    const id = setTimeout(() => {
      setFront((f) => {
        if (f >= maxFront) {
          setPlaying(false);
          return f;
        }
        return f + 1;
      });
    }, ms);
    return () => clearTimeout(id);
  }, [playing, front, maxFront, ms]);

  const layerIndex = front - 1;
  const layer = layerIndex >= 0 ? trace?.layers[layerIndex] : null;
  const isOutput = front === maxFront;

  return (
    <PageShell
      eyebrow="Réseaux de neurones"
      title="Forward propagation"
      lede={
        <>
          Une donnée entre par la gauche et ressort par la droite, transformée à chaque couche.
          C&apos;est tout ce que fait un réseau quand il prédit — et chaque étape est la même
          opération que sur la page <a href="/reseaux/neurone/">Un neurone</a>, répétée.
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
                front === 0
                  ? "La donnée est à l'entrée. Rien n'a encore été calculé."
                  : isOutput
                    ? "Couche de sortie atteinte : le softmax a produit les probabilités finales."
                    : `Couche cachée ${front} calculée. Les suivantes attendent encore.`
              }
              bodyClassName="p-4"
              action={<WeightLegend />}
            >
              <NetworkDiagram
                net={net}
                trace={trace}
                mode="activations"
                progress={front}
                classNames={dataset.classNames}
                height={300}
              />
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line pt-3 text-[10px] text-ink-muted">
                <span className="flex items-center gap-1.5">
                  Activation :
                  <span
                    className="h-2.5 w-20 rounded-full"
                    style={{
                      background: `linear-gradient(to right, ${rampAt(SEQUENTIAL, 0.15)}, ${rampAt(SEQUENTIAL, 0.9)})`,
                    }}
                    aria-hidden
                  />
                  faible → forte
                </span>
                <span>Le nombre dans chaque neurone est sa sortie <Tex>a</Tex>.</span>
              </div>
            </Panel>

            <Panel
              title="D'où vient la donnée"
              subtitle="Cliquez n'importe où : c'est ce point qui traverse le réseau."
              bodyClassName="p-3"
            >
              <DataPlot
                dataset={dataset}
                field={field}
                aspect={1}
                maxWidth={440}
                onQuery={(x, y) => {
                  setQuery([x, y]);
                  setFront(0);
                  setPlaying(false);
                }}
                topOverlay={(frame) => (
                  <g clipPath="url(#plot-clip)">
                    <circle
                      cx={frame.px(query[0], query[1])[0]}
                      cy={frame.px(query[0], query[1])[1]}
                      r={8}
                      fill={CHROME.surface1}
                      stroke={
                        trace && isOutput ? classColor(trace.predicted) : CHROME.ink
                      }
                      strokeWidth={2.5}
                    />
                    <circle
                      cx={frame.px(query[0], query[1])[0]}
                      cy={frame.px(query[0], query[1])[1]}
                      r={2.5}
                      fill={CHROME.ink}
                    />
                  </g>
                )}
              />
            </Panel>
          </div>
        }
        controls={
          <>
            <div className="flex gap-2">
              <Button
                variant="primary"
                className="flex-1"
                onClick={() => {
                  if (front >= maxFront) setFront(0);
                  setPlaying((p) => !p);
                }}
              >
                {playing ? "Pause" : front >= maxFront ? "Rejouer" : "Lancer"}
              </Button>
              <Button
                onClick={() => {
                  setPlaying(false);
                  setFront(Math.min(maxFront, front + 1));
                }}
                disabled={front >= maxFront}
              >
                Étape →
              </Button>
            </div>
            <Segmented
              label="Vitesse"
              value={speed}
              options={SPEEDS.map((s) => ({ value: s.value, label: s.label }))}
              onChange={setSpeed}
              size="sm"
            />
            <Slider
              label="Couche atteinte"
              value={front}
              min={0}
              max={maxFront}
              onChange={(v) => {
                setPlaying(false);
                setFront(v);
              }}
              format={(v) => (v === 0 ? "entrée" : v === maxFront ? "sortie" : `cachée ${v}`)}
            />

            <Divider label="Le réseau" />
            <p className="text-[11px] leading-snug text-ink-muted">
              Architecture {net.sizes.join(" → ")} · {net.parameterCount} paramètres ·{" "}
              {trained} epochs d&apos;entraînement
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                onClick={() => {
                  trainEpochs(dataset.samples, [], 25);
                  setTrained((t) => t + 25);
                }}
              >
                Entraîner 25 epochs
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  reset();
                  setTrained(0);
                }}
              >
                Réinitialiser
              </Button>
            </div>
            <p className="text-[11px] leading-snug text-ink-muted">
              Un réseau non entraîné donne des activations sans signification. Entraînez-le un
              peu, puis regardez à nouveau : les neurones cachés se mettent à réagir à des
              zones précises du plan.
            </p>
          </>
        }
        below={
          <>
            <Panel
              title={front === 0 ? "L'entrée" : isOutput ? "La sortie" : `Couche cachée ${front}`}
              subtitle={
                front === 0
                  ? "Les features brutes, telles quelles"
                  : "Le calcul de cette couche, neurone par neurone"
              }
            >
              {front === 0 ? (
                <ul className="space-y-1.5">
                  {trace?.input.map((v, i) => (
                    <li key={i} className="flex items-center justify-between text-[12px]">
                      <span className="text-ink-2">
                        <Tex>{`x_${i + 1}`}</Tex>
                      </span>
                      <span className="tnum font-semibold text-ink">{formatNumber(v, 3)}</span>
                    </li>
                  ))}
                </ul>
              ) : layer ? (
                <>
                  <LiveFormula
                    tex={
                      isOutput
                        ? String.raw`z^{(l)} = W^{(l)} a^{(l-1)} + b^{(l)}, \quad a = \mathrm{softmax}(z)`
                        : String.raw`z^{(l)} = W^{(l)} a^{(l-1)} + b^{(l)}, \quad a^{(l)} = f(z^{(l)})`
                    }
                  />
                  <table className="mt-3 w-full text-[11px]">
                    <thead className="text-ink-muted">
                      <tr className="border-b border-line">
                        <th className="pb-1.5 text-left font-medium">Neurone</th>
                        <th className="pb-1.5 text-right font-medium">
                          <Tex>z</Tex>
                        </th>
                        <th className="pb-1.5 text-right font-medium">
                          <Tex>a = f(z)</Tex>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="tnum">
                      {layer.z.map((z, i) => (
                        <tr key={i} className="border-b border-line/50">
                          <td className="py-1.5 text-ink-2">
                            {isOutput ? (
                              <span className="inline-flex items-center gap-1.5">
                                <ClassMark index={i} size={9} />
                                {dataset.classNames[i]}
                              </span>
                            ) : (
                              `n${i + 1}`
                            )}
                          </td>
                          <td className="py-1.5 text-right text-ink-2">{formatNumber(z, 3)}</td>
                          <td
                            className={cx(
                              "py-1.5 text-right font-semibold",
                              isOutput && trace?.predicted === i ? "text-ink" : "text-ink-2",
                            )}
                          >
                            {isOutput
                              ? formatPercent(layer.a[i], 1)
                              : formatNumber(layer.a[i], 3)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : null}
            </Panel>

            {isOutput && trace && (
              <div className="grid grid-cols-2 gap-2">
                <Stat
                  label="Prédiction"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <ClassMark index={trace.predicted} size={12} />
                      {dataset.classNames[trace.predicted]}
                    </span>
                  }
                />
                <Stat
                  label="Confiance"
                  value={formatPercent(trace.output[trace.predicted], 1)}
                  hint="Probabilité softmax de la classe gagnante"
                />
              </div>
            )}

            <Callout kind="insight" title="Ce qu'il faut remarquer">
              Avancez couche par couche et regardez les nombres dans les neurones cachés.
              Déplacez ensuite le point de test légèrement : certains neurones changent
              beaucoup, d&apos;autres pas du tout. Chacun s&apos;est spécialisé sur une région
              du plan — c&apos;est ce qu&apos;on appelle une <em>représentation apprise</em>.
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
                C&apos;est une chaîne de traduction. La première couche reçoit les coordonnées
                brutes. Chacun de ses neurones répond à une question simple du genre « est-ce
                que ce point est en haut à droite ? ».
              </p>
              <p>
                La deuxième couche ne voit plus les coordonnées : elle voit{" "}
                <em>les réponses de la première</em>. Elle peut donc poser des questions du
                genre « est-ce que le neurone 1 dit oui <strong>et</strong> le neurone 3 dit
                non ? » — quelque chose qu&apos;aucun neurone de la première couche ne pouvait
                exprimer.
              </p>
              <p>
                De couche en couche, les questions deviennent plus abstraites. La dernière n&apos;a
                plus qu&apos;à choisir la classe.
              </p>
            </>
          }
          technique={
            <>
              <p>
                Chaque couche est une <strong>multiplication matrice-vecteur</strong> suivie
                d&apos;une non-linéarité appliquée élément par élément. Le calcul complet est
                une composition :
              </p>
              <p>
                <code>a⁰ = x → z¹ = W¹a⁰ + b¹ → a¹ = f(z¹) → z² = W²a¹ + b² → …</code>
              </p>
              <p>
                <strong>Pourquoi c&apos;est si rapide.</strong> Tout est en algèbre linéaire
                dense, exactement ce que les GPU font le mieux. Un réseau de plusieurs milliards
                de paramètres reste une suite de produits matriciels.
              </p>
              <p>
                <strong>Le traitement par lots.</strong> En pratique on ne passe pas un vecteur
                mais une matrice de <Tex>B</Tex> exemples d&apos;un coup :{" "}
                <Tex>{String.raw`Z = X W^{\top} + b`}</Tex>. Le coût par exemple s&apos;effondre,
                parce qu&apos;un produit matrice-matrice utilise bien mieux le cache qu&apos;une
                suite de produits matrice-vecteur.
              </p>
              <p>
                <strong>Ce qui est conservé.</strong> Pendant l&apos;entraînement, chaque{" "}
                <Tex>z</Tex> et chaque <Tex>a</Tex> doivent être gardés en mémoire, parce que la{" "}
                <a href="/reseaux/backpropagation/">backpropagation</a> en aura besoin. C&apos;est
                la raison principale pour laquelle entraîner consomme beaucoup plus de mémoire
                que prédire.
              </p>
            </>
          }
          maths={
            <>
              <p>La récurrence complète, pour <Tex>L</Tex> couches :</p>
              <LiveFormula
                tex={String.raw`a^{(0)} = x
                  \qquad
                  z^{(l)} = W^{(l)} a^{(l-1)} + b^{(l)}
                  \qquad
                  a^{(l)} = f\bigl(z^{(l)}\bigr), \quad l = 1, \dots, L-1`}
              />
              <p>Et la couche de sortie, en classification :</p>
              <LiveFormula
                tex={String.raw`\hat{y} = a^{(L)} = \mathrm{softmax}\bigl(z^{(L)}\bigr),
                  \qquad
                  \hat{y}_c = \frac{e^{z^{(L)}_c}}{\sum_{c'} e^{z^{(L)}_{c'}}}`}
              />
              <p>
                <strong>Dimensions.</strong> Si la couche <Tex>l</Tex> a{" "}
                <Tex>n_l</Tex> neurones, alors{" "}
                <Tex>{String.raw`W^{(l)} \in \mathbb{R}^{n_l \times n_{l-1}}`}</Tex> et{" "}
                <Tex>{String.raw`b^{(l)} \in \mathbb{R}^{n_l}`}</Tex>. Le nombre total de
                paramètres :
              </p>
              <LiveFormula
                tex={String.raw`\#\theta = \sum_{l=1}^{L} \bigl(n_l \, n_{l-1} + n_l\bigr)`}
              />
              <p>
                Pour le réseau affiché ci-dessus : {net.sizes.join(" → ")} ={" "}
                <strong>{net.parameterCount} paramètres</strong>.
              </p>
              <p>
                <strong>Stabilité numérique du softmax.</strong>{" "}
                <Tex>{String.raw`e^{z}`}</Tex> déborde dès que <Tex>z</Tex> dépasse ~709 en
                double précision. On soustrait donc systématiquement le maximum, ce qui ne
                change rien au résultat :
              </p>
              <LiveFormula
                tex={String.raw`\mathrm{softmax}(z)_i = \frac{e^{z_i - \max_j z_j}}{\sum_k e^{z_k - \max_j z_j}}`}
              />
            </>
          }
        />

        <div className="space-y-4">
          <Callout kind="note" title="Pourquoi le réseau est le même sur trois pages">
            Ce réseau est partagé avec les pages{" "}
            <a href="/reseaux/backpropagation/">Backpropagation</a> et{" "}
            <a href="/reseaux/entrainement/">Entraînement</a>. Entraînez-le ici, allez voir
            ses gradients là-bas : ce sont les mêmes poids. Comme le dataset, qui suit lui aussi
            d&apos;une page à l&apos;autre.
          </Callout>

          <Panel title="Cas pratiques" subtitle="La même mécanique, à une autre échelle">
            <div className="prose-lab">
              <p>
                <strong>Reconnaissance de chiffres manuscrits.</strong> 784 entrées (une par
                pixel d&apos;une image 28×28), quelques couches cachées, 10 sorties. C&apos;est
                exactement le réseau de cette page, en plus large.
              </p>
              <p>
                <strong>Classification d&apos;images.</strong> Les réseaux convolutionnels
                remplacent la multiplication matricielle dense par une convolution, mais la
                structure — couche, activation, couche suivante — est identique.
              </p>
              <p>
                <strong>Modèles de langage.</strong> Un Transformer est une pile de blocs qui
                contiennent, entre autres, exactement ce type de couche dense. Le forward pass
                d&apos;un modèle à plusieurs milliards de paramètres est la même boucle.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}
