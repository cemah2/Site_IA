"use client";

import * as React from "react";
import { PageShell, SectionTitle, Workbench } from "@/components/layout/PageShell";
import { Button, Callout, Divider, Panel, Segmented, Slider, Stat } from "@/components/ui";
import { G } from "@/components/ui/Glossary";
import { Levels } from "@/components/ui/Levels";
import { Quiz } from "@/components/lab/Quiz";
import { LiveFormula, Tex } from "@/components/math/Math";
import { Plot } from "@/components/viz/Plot";
import { WeightLegend } from "@/components/viz/NetworkDiagram";
import { ACTIVATIONS, type ActivationName } from "@/lib/ml/models/activations";
import { formatNumber } from "@/lib/viz/geometry";
import { CHROME, DIVERGING, SEQUENTIAL, SERIES, rampAt, toRgbTriple, withAlpha } from "@/lib/viz/palette";

export function NeuronLab() {
  const [w1, setW1] = React.useState(1.2);
  const [w2, setW2] = React.useState(-0.8);
  const [b, setB] = React.useState(0.3);
  const [x1, setX1] = React.useState(0.9);
  const [x2, setX2] = React.useState(0.4);
  const [act, setAct] = React.useState<ActivationName>("tanh");

  const activation = ACTIVATIONS[act];
  const terms = [w1 * x1, w2 * x2];
  const z = terms[0] + terms[1] + b;
  const a = activation.f(z);
  const maxTerm = Math.max(Math.abs(terms[0]), Math.abs(terms[1]), Math.abs(b), 0.01);

  return (
    <PageShell
      eyebrow="Réseaux de neurones"
      title="Un neurone"
      lede={
        <>
          Tout réseau, quelle que soit sa taille, est fait de cette unique brique. Elle fait
          deux choses : une <strong>somme pondérée</strong> de ses entrées, puis une{" "}
          <strong>fonction non linéaire</strong> appliquée au résultat. Rien de plus. Toute la
          difficulté est de comprendre pourquoi ces deux opérations suffisent.
        </>
      }
    >
      <Workbench
        plot={
          <div className="space-y-5">
            <Panel title="Le neurone" subtitle="Bougez n'importe quel curseur : tout se recalcule." bodyClassName="p-4">
              <NeuronSchematic
                w={[w1, w2]}
                x={[x1, x2]}
                b={b}
                z={z}
                a={a}
                actLabel={activation.label}
                maxTerm={maxTerm}
              />
              <div className="mt-3 border-t border-line pt-2.5">
                <WeightLegend label="Contribution w·x" />
              </div>
            </Panel>

            <Panel
              title="Ce que ce neurone décide dans le plan"
              subtitle="Chaque point du plan est une paire (x₁, x₂). La couleur est la sortie du neurone."
              bodyClassName="p-3"
            >
              <Plot
                xDomain={[-3, 3]}
                yDomain={[-3, 3]}
                aspect={1}
                maxWidth={440}
                xLabel="x₁"
                yLabel="x₂"
                ariaLabel="Sortie du neurone en fonction de ses deux entrées"
              >
                {(frame) => (
                  <g clipPath="url(#plot-clip)">
                    <NeuronField w1={w1} w2={w2} b={b} act={act} frame={frame} />
                    {/* z = 0 is where the activation switches regime: for a
                        single neuron this line IS the decision boundary. */}
                    {Math.abs(w2) > 1e-6 ? (
                      <line
                        x1={frame.sx(-3)}
                        y1={frame.sy((-b - w1 * -3) / w2)}
                        x2={frame.sx(3)}
                        y2={frame.sy((-b - w1 * 3) / w2)}
                        stroke={CHROME.ink}
                        strokeWidth={2}
                      />
                    ) : Math.abs(w1) > 1e-6 ? (
                      <line
                        x1={frame.sx(-b / w1)}
                        y1={frame.sy(-3)}
                        x2={frame.sx(-b / w1)}
                        y2={frame.sy(3)}
                        stroke={CHROME.ink}
                        strokeWidth={2}
                      />
                    ) : null}

                    {/* The weight vector: normal to the boundary, pointing the
                        way z increases. */}
                    <line
                      x1={frame.sx(0)}
                      y1={frame.sy(0)}
                      x2={frame.sx(w1)}
                      y2={frame.sy(w2)}
                      stroke={CHROME.accent}
                      strokeWidth={2}
                      markerEnd="url(#arrow)"
                    />
                    <defs>
                      <marker
                        id="arrow"
                        viewBox="0 0 8 8"
                        refX="6"
                        refY="4"
                        markerWidth="5"
                        markerHeight="5"
                        orient="auto"
                      >
                        <path d="M0,0 L8,4 L0,8 z" fill={CHROME.accent} />
                      </marker>
                    </defs>

                    <circle
                      cx={frame.sx(x1)}
                      cy={frame.sy(x2)}
                      r={7}
                      fill={CHROME.surface1}
                      stroke={CHROME.ink}
                      strokeWidth={2.5}
                    />
                    <circle cx={frame.sx(x1)} cy={frame.sy(x2)} r={2.5} fill={CHROME.ink} />
                  </g>
                )}
              </Plot>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-muted">
                <span className="inline-flex items-center gap-1.5">
                  <svg width="18" height="6" aria-hidden>
                    <line x1="0" y1="3" x2="18" y2="3" stroke={CHROME.ink} strokeWidth="2" />
                  </svg>
                  <Tex>z = 0</Tex> — la frontière
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <svg width="18" height="6" aria-hidden>
                    <line x1="0" y1="3" x2="18" y2="3" stroke={CHROME.accent} strokeWidth="2" />
                  </svg>
                  le vecteur <Tex>w</Tex> — perpendiculaire à la frontière, pointant vers les{" "}
                  <Tex>z</Tex> croissants
                </span>
                <WeightLegend label="Sortie a" />
              </div>
            </Panel>
          </div>
        }
        controls={
          <>
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                Entrées
              </p>
              <div className="space-y-3">
                <Slider label={<Tex>x_1</Tex>} value={x1} min={-3} max={3} step={0.05} onChange={setX1} format={(v) => v.toFixed(2)} />
                <Slider label={<Tex>x_2</Tex>} value={x2} min={-3} max={3} step={0.05} onChange={setX2} format={(v) => v.toFixed(2)} />
              </div>
            </div>
            <Divider label="Paramètres appris" />
            <div className="space-y-3">
              <Slider label={<Tex>w_1</Tex>} value={w1} min={-3} max={3} step={0.05} onChange={setW1} format={(v) => v.toFixed(2)} />
              <Slider label={<Tex>w_2</Tex>} value={w2} min={-3} max={3} step={0.05} onChange={setW2} format={(v) => v.toFixed(2)} />
              <Slider
                label={<Tex>b</Tex>}
                value={b}
                min={-3}
                max={3}
                step={0.05}
                onChange={setB}
                format={(v) => v.toFixed(2)}
                hint="Le biais déplace la frontière sans la faire tourner. Sans lui, elle passerait forcément par l'origine."
              />
            </div>
            <Divider label="Activation" />
            <Segmented
              value={act}
              options={[
                { value: "tanh", label: "Tanh" },
                { value: "sigmoid", label: "Sigmoid" },
                { value: "relu", label: "ReLU" },
                { value: "linear", label: "Aucune" },
              ]}
              onChange={(v) => setAct(v as ActivationName)}
              size="sm"
            />
            <Button
              size="sm"
              variant="ghost"
              className="w-full"
              onClick={() => {
                setW1(1.2);
                setW2(-0.8);
                setB(0.3);
                setX1(0.9);
                setX2(0.4);
              }}
            >
              Réinitialiser
            </Button>
          </>
        }
        below={
          <>
            <Panel title="Le calcul" subtitle="Deux étapes, dans cet ordre">
              <LiveFormula
                tex={String.raw`z = w_1 x_1 + w_2 x_2 + b`}
                terms={[
                  { symbol: "w_1 x_1", value: formatNumber(terms[0], 3), color: rampAt(DIVERGING, (Math.max(-1, Math.min(1, terms[0] / maxTerm)) + 1) / 2) },
                  { symbol: "w_2 x_2", value: formatNumber(terms[1], 3), color: rampAt(DIVERGING, (Math.max(-1, Math.min(1, terms[1] / maxTerm)) + 1) / 2) },
                  { symbol: "b", value: formatNumber(b, 3) },
                ]}
                result={{ label: "Pré-activation z", value: formatNumber(z, 4) }}
              />
              <LiveFormula
                className="mt-3"
                tex={`a = ${activation.formula.replace("\\sigma(z)", "f(z)").replace("\\tanh(z)", "f(z)").replace("\\mathrm{ReLU}(z)", "f(z)").replace("f(z)", "f(z)")}`}
                result={{ label: "Sortie a", value: formatNumber(a, 4) }}
              />
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Stat label="Dérivée f′(z)" value={formatNumber(activation.df(z), 4)} hint="Ce qui décide combien ce neurone apprendra" />
                <Stat label="Domaine de f" value={activation.range} />
              </div>
            </Panel>

            <Callout kind="insight" title="L'expérience qui explique tout">
              Mettez l&apos;<G t="activation">activation</G> sur <strong>Aucune</strong>. Le
              neurone devient une <a href="/regression/lineaire/">régression linéaire</a> — la
              couleur varie en dégradé continu, sans seuil.
              <br />
              <br />
              Repassez sur <strong>Tanh</strong> : une zone de transition apparaît autour de la
              frontière, et loin d&apos;elle la sortie <em>sature</em>. C&apos;est cette
              saturation qui permet à un neurone de dire « oui » ou « non » plutôt que
              « beaucoup » ou « peu » — et c&apos;est ce qui rend l&apos;empilement de couches
              utile.
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
                Un neurone est un <strong>votant pondéré</strong>. Chaque entrée lui donne une
                information, et chaque poids dit à quel point cette information compte — et dans
                quel sens.
              </p>
              <p>
                Un poids positif : « plus cette entrée est grande, plus je penche vers oui ».
                Un poids négatif : l&apos;inverse. Un poids proche de zéro : « cette entrée ne
                m&apos;intéresse pas ».
              </p>
              <p>
                Le <strong>biais</strong> est son a priori, avant même de regarder les entrées :
                à quel point il est déjà enclin à dire oui. Mettez les deux entrées à zéro et
                bougez <Tex>b</Tex> : la sortie change quand même.
              </p>
              <p>
                Enfin l&apos;<strong>activation</strong> transforme ce total en décision. Sans
                elle, le neurone renverrait un score continu ; avec elle, il tranche.
              </p>
            </>
          }
          technique={
            <>
              <p>
                <Tex>{String.raw`z = w^{\top}x + b`}</Tex> est un produit scalaire. Sa géométrie
                est exactement celle d&apos;un hyperplan :{" "}
                <Tex>w</Tex> est le <strong>vecteur normal</strong> à la frontière, et{" "}
                <Tex>b</Tex> la décale de l&apos;origine. La flèche bleue du graphique{" "}
                <em>est</em> ce vecteur — elle reste toujours perpendiculaire au trait blanc.
              </p>
              <p>
                <strong>La norme de <Tex>w</Tex> contrôle la netteté de la transition.</strong>{" "}
                Doublez <Tex>w_1</Tex> et <Tex>w_2</Tex> : la frontière ne bouge pas, mais le
                dégradé se resserre. Le neurone devient plus « sûr de lui » plus vite. C&apos;est
                pourquoi la régularisation, qui limite la norme des poids, produit des modèles
                plus prudents.
              </p>
              <p>
                <strong>Sans activation, empiler des couches ne sert à rien.</strong> La
                composée de deux fonctions affines est affine : un réseau de vingt couches
                linéaires est mathématiquement équivalent à un seul neurone linéaire. La
                non-linéarité n&apos;est pas un détail d&apos;implémentation, c&apos;est ce qui
                donne son sens à la profondeur.
              </p>
              <p>
                <strong>Un seul neurone ne peut pas tout.</strong> Sa frontière est toujours une
                droite. Le problème XOR — deux classes en diagonale — lui est inaccessible, et
                c&apos;est le contre-exemple historique qui a motivé les couches cachées.
              </p>
            </>
          }
          maths={
            <>
              <p>Le neurone, en notation vectorielle :</p>
              <LiveFormula
                tex={String.raw`z = w^{\!\top} x + b = \sum_{i=1}^{d} w_i x_i + b
                  \qquad a = f(z)`}
              />
              <p>
                Le produit scalaire a une lecture géométrique directe, qui explique tout ce que
                fait le graphique :
              </p>
              <LiveFormula
                tex={String.raw`w^{\!\top} x = \lVert w \rVert \, \lVert x \rVert \cos\theta`}
              />
              <p>
                <Tex>{String.raw`\theta`}</Tex> est l&apos;angle entre l&apos;entrée et le
                vecteur de poids. Le neurone répond fort quand l&apos;entrée est{" "}
                <em>alignée</em> avec ses poids : c&apos;est un détecteur de motif, et son motif
                est <Tex>w</Tex> lui-même.
              </p>
              <p>La distance signée d&apos;un point à la frontière :</p>
              <LiveFormula
                tex={String.raw`\mathrm{dist}(x, \mathcal{H}) = \frac{w^{\!\top}x + b}{\lVert w \rVert} = \frac{z}{\lVert w \rVert}`}
              />
              <p>
                Les deux dérivées dont la <a href="/reseaux/backpropagation/">backpropagation</a>{" "}
                a besoin, et elles sont d&apos;une simplicité trompeuse :
              </p>
              <LiveFormula
                tex={String.raw`\frac{\partial z}{\partial w_i} = x_i
                  \qquad
                  \frac{\partial z}{\partial b} = 1
                  \qquad
                  \frac{\partial a}{\partial z} = f'(z)`}
              />
              <p>
                La première explique une règle pratique importante :{" "}
                <strong>le gradient d&apos;un poids est proportionnel à son entrée</strong>. Une
                feature à très grande échelle produit de très grands gradients pour son poids —
                c&apos;est la raison profonde pour laquelle on normalise les entrées avant
                d&apos;entraîner un réseau.
              </p>
            </>
          }
        />


        <Quiz
          questions={[
            {
              id: "nu1",
              question: "À quoi sert le biais b ?",
              options: [
                { id: "a", label: "À corriger les erreurs du neurone" },
                {
                  id: "b",
                  label:
                    "À décaler le seuil de déclenchement : sans lui, la frontière passerait forcément par l'origine",
                },
                { id: "c", label: "À normaliser la sortie entre 0 et 1" },
              ],
              answer: 1,
              explanation: (
                <>
                  Avec <Tex>{String.raw`z = w_1x_1 + w_2x_2`}</Tex> seul, <Tex>z = 0</Tex> est
                  toujours une droite passant par (0, 0). Le <G t="biaisneurone">biais</G>{" "}
                  l&apos;autorise à être ailleurs. Mettez-le à zéro dans les contrôles : la
                  frontière se recolle à l&apos;origine et y reste, quoi que fassent les poids.
                </>
              ),
            },
            {
              id: "nu2",
              question: "Que se passerait-il si on empilait des neurones sans fonction d'activation ?",
              options: [
                { id: "a", label: "Le réseau serait plus lent mais plus précis" },
                {
                  id: "b",
                  label:
                    "La composition de fonctions linéaires reste linéaire : dix couches auraient exactement le pouvoir d'une seule",
                },
                { id: "c", label: "Les gradients exploseraient" },
              ],
              answer: 1,
              explanation: (
                <>
                  C&apos;est le seul argument qui justifie l&apos;existence des{" "}
                  <G t="activation">fonctions d&apos;activation</G>, et il est purement
                  algébrique : une matrice multipliée par une matrice est une matrice. Toute la
                  profondeur ne sert à rien tant qu&apos;une non-linéarité ne s&apos;intercale pas
                  entre les couches.
                </>
              ),
            },
            {
              id: "nu3",
              question:
                "Vous multipliez w₁ et w₂ par 10, en laissant b proportionnel. Qu'est-ce qui change ?",
              options: [
                { id: "a", label: "La frontière tourne" },
                {
                  id: "b",
                  label:
                    "La frontière reste au même endroit, mais la transition de la sortie devient beaucoup plus abrupte",
                },
                { id: "c", label: "Rien du tout" },
              ],
              answer: 1,
              explanation: (
                <>
                  <Tex>z = 0</Tex> définit le même ensemble de points quand toute
                  l&apos;équation est multipliée par 10. En revanche un point qui avait{" "}
                  <Tex>{String.raw`z = 0{,}3`}</Tex> passe à 3 : la sigmoïde, elle, distingue très bien les
                  deux. Grands <G t="poids">poids</G> = modèle catégorique, et c&apos;est
                  exactement ce que la <G t="regularisation">régularisation</G> empêche.
                </>
              ),
            },
          ]}
        />

        <div className="space-y-4">
          <Callout kind="warning" title="Le biais n'est pas optionnel">
            Mettez <Tex>b = 0</Tex> et essayez de faire passer la frontière ailleurs que par
            l&apos;origine. Impossible — quelles que soient les valeurs de{" "}
            <Tex>w_1</Tex> et <Tex>w_2</Tex>. C&apos;est une restriction sévère, et c&apos;est
            pour ça que tout neurone en a un.
          </Callout>

          <Panel title="Et ensuite" subtitle="Les pages qui suivent, dans l'ordre">
            <div className="prose-lab">
              <p>
                <a href="/reseaux/activations/">Les fonctions d&apos;activation</a> — comparer
                leurs courbes, leurs dérivées, et leur effet sur la propagation du gradient.
              </p>
              <p>
                <a href="/reseaux/forward/">Forward propagation</a> — ce que devient le calcul
                quand on met plusieurs de ces neurones bout à bout.
              </p>
              <p>
                <a href="/reseaux/backpropagation/">Backpropagation</a> — comment on trouve les
                bons <Tex>w</Tex> et <Tex>b</Tex>, qui jusqu&apos;ici sont réglés à la main.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}

/** The classic neuron schematic, with live values on every wire. */
function NeuronSchematic({
  w,
  x,
  b,
  z,
  a,
  actLabel,
  maxTerm,
}: {
  w: number[];
  x: number[];
  b: number;
  z: number;
  a: number;
  actLabel: string;
  maxTerm: number;
}) {
  const rows = [
    { label: "x₁", value: x[0], weight: w[0], y: 34 },
    { label: "x₂", value: x[1], weight: w[1], y: 86 },
    { label: "biais", value: 1, weight: b, y: 138 },
  ];
  const colorFor = (v: number) =>
    rampAt(DIVERGING, (Math.max(-1, Math.min(1, v / maxTerm)) + 1) / 2);

  return (
    <svg viewBox="0 0 520 180" className="w-full" role="img" aria-label="Schéma du neurone">
      {rows.map((r) => {
        const product = r.value * r.weight;
        return (
          <g key={r.label}>
            <text x={8} y={r.y + 4} fontSize={11} fill={CHROME.ink2} className="tnum">
              {r.label}
            </text>
            <text x={44} y={r.y + 4} fontSize={11} fill={CHROME.ink} className="tnum">
              {r.value.toFixed(2)}
            </text>
            <path
              d={`M82,${r.y} H175 Q210,${r.y} 210,${r.y > 86 ? r.y - 20 : r.y + 20} V86 H252`}
              fill="none"
              stroke={colorFor(product)}
              strokeWidth={1 + Math.min(4, Math.abs(product / maxTerm) * 4)}
              opacity={0.9}
            />
            <rect x={108} y={r.y - 11} width={54} height={22} rx={5} fill={CHROME.surface3} />
            <text
              x={135}
              y={r.y + 4}
              textAnchor="middle"
              fontSize={10}
              fill={CHROME.ink}
              className="tnum"
            >
              {r.label === "biais" ? "b" : "w"}={r.weight.toFixed(2)}
            </text>
            <text x={186} y={r.y - 6} fontSize={9} fill={CHROME.inkMuted} className="tnum">
              {product.toFixed(2)}
            </text>
          </g>
        );
      })}

      <circle cx={276} cy={86} r={24} fill={CHROME.surface2} stroke={CHROME.lineStrong} strokeWidth={1.5} />
      <text x={276} y={82} textAnchor="middle" fontSize={15} fill={CHROME.ink}>
        Σ
      </text>
      <text x={276} y={96} textAnchor="middle" fontSize={9} fill={CHROME.ink2} className="tnum">
        {z.toFixed(2)}
      </text>

      <line x1={300} y1={86} x2={344} y2={86} stroke={CHROME.lineStrong} strokeWidth={1.5} />
      <text x={322} y={78} textAnchor="middle" fontSize={9} fill={CHROME.inkMuted}>
        z
      </text>

      <rect x={344} y={62} width={76} height={48} rx={7} fill={CHROME.surface2} stroke={CHROME.lineStrong} strokeWidth={1.5} />
      <text x={382} y={82} textAnchor="middle" fontSize={10} fill={CHROME.ink}>
        {actLabel}
      </text>
      <text x={382} y={97} textAnchor="middle" fontSize={9} fill={CHROME.inkMuted}>
        f(z)
      </text>

      <line x1={420} y1={86} x2={462} y2={86} stroke={CHROME.lineStrong} strokeWidth={1.5} />
      <circle
        cx={484}
        cy={86}
        r={22}
        fill={withAlpha(rampAt(SEQUENTIAL, 0.2 + Math.min(1, Math.abs(a)) * 0.7), 0.35)}
        stroke={SERIES[0]}
        strokeWidth={2}
      />
      <text x={484} y={90} textAnchor="middle" fontSize={11} fill={CHROME.ink} className="tnum">
        {a.toFixed(2)}
      </text>
      <text x={484} y={126} textAnchor="middle" fontSize={9} fill={CHROME.inkMuted}>
        sortie a
      </text>
    </svg>
  );
}

/** The neuron's output over the whole input plane, as a canvas image. */
function NeuronField({
  w1,
  w2,
  b,
  act,
  frame,
}: {
  w1: number;
  w2: number;
  b: number;
  act: ActivationName;
  frame: { inner: { x: number; y: number; w: number; h: number } };
}) {
  const url = React.useMemo(() => {
    if (typeof document === "undefined") return null;
    const res = 90;
    const canvas = document.createElement("canvas");
    canvas.width = res;
    canvas.height = res;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const img = ctx.createImageData(res, res);
    const f = ACTIVATIONS[act].f;

    // Normalise by the largest |a| on the grid so the picture keeps its
    // contrast whatever the activation's own range happens to be.
    const values = new Float32Array(res * res);
    let maxAbs = 1e-6;
    for (let j = 0; j < res; j++) {
      const y = -3 + (6 * j) / (res - 1);
      for (let i = 0; i < res; i++) {
        const x = -3 + (6 * i) / (res - 1);
        const v = f(w1 * x + w2 * y + b);
        values[j * res + i] = v;
        maxAbs = Math.max(maxAbs, Math.abs(v));
      }
    }

    for (let j = 0; j < res; j++) {
      for (let i = 0; i < res; i++) {
        const v = values[j * res + i] / maxAbs;
        const dst = ((res - 1 - j) * res + i) * 4;
        const rgb = toRgbTriple(rampAt(DIVERGING, (Math.max(-1, Math.min(1, v)) + 1) / 2));
        img.data[dst] = rgb[0];
        img.data[dst + 1] = rgb[1];
        img.data[dst + 2] = rgb[2];
        img.data[dst + 3] = 120;
      }
    }
    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL();
  }, [w1, w2, b, act]);

  if (!url) return null;
  return (
    <image
      href={url}
      x={frame.inner.x}
      y={frame.inner.y}
      width={frame.inner.w}
      height={frame.inner.h}
      preserveAspectRatio="none"
      aria-hidden
    />
  );
}


