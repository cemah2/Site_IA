"use client";

import * as React from "react";
import { PageShell, SectionTitle } from "@/components/layout/PageShell";
import { Callout, cx, Panel, Slider, Stat, Toggle } from "@/components/ui";
import { ClientOnly } from "@/components/ui/ClientOnly";
import { G } from "@/components/ui/Glossary";
import { Levels } from "@/components/ui/Levels";
import { Quiz } from "@/components/lab/Quiz";
import { LiveFormula, Tex, TexBlock } from "@/components/math/Math";
import { LineChart } from "@/components/viz/LineChart";
import { Plot } from "@/components/viz/Plot";
import { ACTIVATIONS, softmax, type ActivationName } from "@/lib/ml/models/activations";
import { formatNumber } from "@/lib/viz/geometry";
import { SERIES } from "@/lib/viz/palette";

const ORDER: ActivationName[] = ["sigmoid", "tanh", "relu", "leakyRelu", "linear"];

export function ActivationsLab() {
  const [x, setX] = React.useState(1.4);
  const [showDerivative, setShowDerivative] = React.useState(true);
  const [depth, setDepth] = React.useState(10);

  return (
    <PageShell
      eyebrow="Réseaux de neurones"
      title="Fonctions d'activation"
      lede={
        <>
          Sans activation, empiler des couches ne sert strictement à rien : la composée de deux
          fonctions affines est affine. L&apos;activation est donc ce qui rend la profondeur
          utile. Mais le choix n&apos;est pas neutre — c&apos;est sa <strong>dérivée</strong>{" "}
          qui décide si un réseau profond peut apprendre ou pas.
        </>
      }
      wide
    >
      <ClientOnly
        fallback={<div className="h-[520px] animate-pulse rounded-xl border border-line bg-surface-1/60" />}
      >
        <Panel
          title="Un curseur, cinq fonctions"
          subtitle={
            <>
              Déplacez <Tex>x</Tex> et lisez simultanément <Tex>f(x)</Tex> et{" "}
              <Tex>{String.raw`f'(x)`}</Tex> pour chacune.
            </>
          }
          action={
            <Toggle
              label="Afficher la dérivée"
              checked={showDerivative}
              onChange={setShowDerivative}
            />
          }
        >
          <div className="mb-5 max-w-md">
            <Slider
              label={<Tex>x</Tex>}
              value={x}
              min={-6}
              max={6}
              step={0.05}
              onChange={setX}
              format={(v) => v.toFixed(2)}
            />
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {ORDER.map((name) => (
              <ActivationCard
                key={name}
                name={name}
                x={x}
                showDerivative={showDerivative}
              />
            ))}
            <SoftmaxCard x={x} />
          </div>
        </Panel>
      </ClientOnly>

      <SectionTitle hint="Le problème que le choix de l'activation résout — ou crée.">
        Le gradient qui disparaît
      </SectionTitle>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <Panel
          title="Ce que devient le gradient après N couches"
          subtitle="Le gradient est multiplié par f′ à chaque couche traversée. Voici le produit."
        >
          <ClientOnly fallback={<div className="h-[260px] animate-pulse rounded-lg bg-surface-2/40" />}>
            <VanishingChart depth={depth} />
          </ClientOnly>
          <div className="mt-4 max-w-sm">
            <Slider
              label="Nombre de couches traversées"
              value={depth}
              min={1}
              max={30}
              onChange={setDepth}
            />
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {(["sigmoid", "tanh", "relu"] as ActivationName[]).map((name) => {
              // Best case for each: the largest value its derivative can take.
              const best = name === "sigmoid" ? 0.25 : name === "tanh" ? 1 : 1;
              const factor = best ** depth;
              return (
                <Stat
                  key={name}
                  label={ACTIVATIONS[name].label}
                  value={factor < 0.001 ? factor.toExponential(1) : factor.toFixed(3)}
                  tone={factor < 0.01 ? "critical" : factor < 0.5 ? "warning" : "good"}
                  hint={`(f′ max = ${best})^${depth}`}
                />
              );
            })}
          </div>
          <Callout kind="warning" title="Le calcul est brutal" >
            Ce sont les <em>meilleurs</em> cas. La dérivée de la sigmoid vaut au mieux 0,25 — et
            seulement en <Tex>z = 0</Tex>. Après 10 couches, le <G t="gradient">gradient</G> qui
            atteint la première
            couche est au mieux <Tex>{String.raw`0{,}25^{10} \approx 10^{-6}`}</Tex> fois celui
            de la dernière. Les premières couches n&apos;apprennent pratiquement rien.
            <br />
            <br />
            ReLU a une dérivée exactement égale à 1 côté positif : le produit reste 1, quelle que
            soit la profondeur. C&apos;est à peu près toute l&apos;explication de pourquoi les
            réseaux profonds sont devenus entraînables.
          </Callout>
        </Panel>


        <Quiz
          questions={[
            {
              id: "ac1",
              question:
                "Pourquoi la sigmoïde pose-t-elle problème dans un réseau profond ?",
              options: [
                { id: "a", label: "Elle est trop lente à calculer" },
                {
                  id: "b",
                  label:
                    "Sa dérivée ne dépasse jamais 0,25, et le produit de ces facteurs sur dix couches annule le gradient",
                },
                { id: "c", label: "Elle ne peut pas produire de valeurs négatives" },
              ],
              answer: 1,
              explanation: (
                <>
                  La <G t="backprop">backpropagation</G> multiplie les dérivées couche après
                  couche. Avec un facteur maximal de 0,25, dix couches donnent au mieux{" "}
                  <Tex>{String.raw`0{,}25^{10} \approx 10^{-6}`}</Tex> : les premières couches ne
                  reçoivent plus rien. C&apos;est le{" "}
                  <G t="vanishing">gradient qui s&apos;évanouit</G>, et il a bloqué le domaine
                  pendant des années. Affichez la courbe de dérivée au-dessus : le plafond est
                  visible.
                </>
              ),
            },
            {
              id: "ac2",
              question: "Quel est le défaut de ReLU, et d'où vient-il ?",
              options: [
                {
                  id: "a",
                  label:
                    "Sa dérivée est nulle pour z < 0 : un neurone poussé de ce côté ne reçoit plus aucun gradient et peut ne jamais revenir",
                },
                { id: "b", label: "Elle sature pour les grandes valeurs" },
                { id: "c", label: "Elle est coûteuse à dériver" },
              ],
              answer: 0,
              explanation: (
                <>
                  On appelle ça un « neurone mort ». Il ne s&apos;agit pas d&apos;une saturation —
                  ReLU ne sature jamais du côté positif, ce qui est précisément sa qualité — mais
                  d&apos;une zone plate exacte. Leaky ReLU existe pour ça : une petite pente au
                  lieu de zéro, et le neurone garde une porte de sortie.
                </>
              ),
            },
            {
              id: "ac3",
              question:
                "Pourquoi tanh est-elle généralement préférée à la sigmoïde dans les couches cachées ?",
              options: [
                { id: "a", label: "Elle est plus rapide" },
                {
                  id: "b",
                  label:
                    "Elle est centrée en zéro, donc ses sorties ne décalent pas systématiquement les entrées de la couche suivante",
                },
                { id: "c", label: "Sa dérivée est toujours égale à 1" },
              ],
              answer: 1,
              explanation: (
                <>
                  La sigmoïde ne sort que des valeurs positives : toutes les entrées de la couche
                  suivante sont donc biaisées dans le même sens, ce qui ralentit
                  l&apos;apprentissage. Tanh va de −1 à 1. Sa dérivée culmine à 1, ce qui est
                  mieux que 0,25 — mais elle vaut 1 seulement en zéro, donc le problème du
                  gradient évanescent est atténué, pas résolu.
                </>
              ),
            },
          ]}
        />

        <div className="space-y-4">
          <Panel title="Comment choisir" subtitle="Les règles pratiques, et leurs raisons">
            <div className="prose-lab">
              <h3>Couches cachées</h3>
              <p>
                <strong>ReLU</strong> par défaut. Rapide, et surtout elle ne tue pas le gradient
                en profondeur. Son défaut — les neurones morts — se corrige avec{" "}
                <strong>Leaky ReLU</strong> si on l&apos;observe.
              </p>
              <p>
                <strong>Tanh</strong> reste un choix raisonnable pour des réseaux peu profonds,
                et est centrée en zéro, ce qui aide la convergence. C&apos;est l&apos;activation
                par défaut des pages de ce site, où les réseaux font deux ou trois couches.
              </p>
              <h3>Couche de sortie</h3>
              <p>
                <strong>Softmax</strong> pour une classification multi-classe : elle produit une
                distribution de probabilité, ce qu&apos;aucune activation élément par élément ne
                peut faire.
              </p>
              <p>
                <strong>Sigmoid</strong> pour une classification binaire ou multi-label, où
                chaque sortie est une probabilité indépendante.
              </p>
              <p>
                <strong>Aucune activation</strong> pour une régression : la sortie doit pouvoir
                prendre n&apos;importe quelle valeur.
              </p>
            </div>
          </Panel>

          <Callout kind="insight" title="Le piège du neurone mort">
            Avec ReLU, un neurone dont <Tex>z</Tex> reste négatif pour toutes les entrées a une
            dérivée nulle partout. Son gradient est zéro, donc ses poids ne bougent plus{" "}
            <em>jamais</em>. Il est définitivement inutile. Un learning rate trop grand peut
            faire basculer toute une couche dans cet état en une seule mise à jour.
          </Callout>
        </div>
      </div>

      <SectionTitle hint="La même idée, à trois profondeurs de lecture.">
        Pourquoi une non-linéarité est indispensable
      </SectionTitle>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <Levels
          intuition={
            <>
              <p>
                Imaginez une chaîne de personnes qui se transmettent un nombre. Chacune a le
                droit de le multiplier par un coefficient et d&apos;ajouter une constante.
              </p>
              <p>
                Peu importe combien elles sont : le résultat final sera toujours{" "}
                <em>un coefficient fois le nombre de départ, plus une constante</em>. Dix
                personnes ne font pas mieux qu&apos;une seule. C&apos;est exactement la situation
                d&apos;un réseau sans activation.
              </p>
              <p>
                L&apos;activation casse cette chaîne. En pliant la droite — en l&apos;écrasant à
                zéro côté négatif, ou en la saturant aux extrêmes — elle rend chaque couche
                capable d&apos;ajouter quelque chose que les précédentes ne pouvaient pas faire.
              </p>
            </>
          }
          technique={
            <>
              <p>
                Une couche sans activation calcule <Tex>{String.raw`W x + b`}</Tex>. Deux
                couches enchaînées donnent{" "}
                <Tex>{String.raw`W_2(W_1 x + b_1) + b_2 = (W_2 W_1) x + (W_2 b_1 + b_2)`}</Tex> —
                soit encore une transformation affine, avec une matrice{" "}
                <Tex>{String.raw`W_2 W_1`}</Tex> qui n&apos;a pas plus d&apos;expressivité
                qu&apos;une matrice unique.
              </p>
              <p>
                <strong>Le théorème d&apos;approximation universelle</strong> dit qu&apos;un
                réseau à <em>une seule</em> couche cachée, avec une activation non polynomiale et
                assez de neurones, peut approcher n&apos;importe quelle fonction continue sur un
                compact avec la précision voulue.
              </p>
              <p>
                Attention à ce que ce théorème ne dit pas : il ne dit pas combien de neurones il
                faut (ça peut être exponentiel), ni que la descente de gradient saura les
                trouver. C&apos;est un résultat d&apos;existence, pas une recette.
              </p>
              <p>
                <strong>Le saut pratique</strong> apporté par ReLU en 2011-2012 n&apos;est pas une
                question d&apos;expressivité mais d&apos;<em>entraînabilité</em> : avec sigmoid,
                on savait déjà quoi construire, on ne savait juste pas l&apos;entraîner en
                profondeur.
              </p>
            </>
          }
          maths={
            <>
              <p>
                Le gradient d&apos;une couche <Tex>l</Tex> s&apos;obtient en remontant le produit
                des jacobiennes de toutes les couches au-dessus :
              </p>
              <LiveFormula
                tex={String.raw`\frac{\partial L}{\partial z^{(l)}}
                  = \left(\prod_{k=l+1}^{L} W^{(k)\top} \,\mathrm{diag}\bigl(f'(z^{(k-1)})\bigr)\right) \frac{\partial L}{\partial z^{(L)}}`}
              />
              <p>
                Ce produit est le cœur du problème. Si chaque facteur a une norme{" "}
                <Tex>{String.raw`\rho < 1`}</Tex>, le gradient décroît{" "}
                <strong>géométriquement</strong> avec la profondeur :
              </p>
              <LiveFormula
                tex={String.raw`\left\lVert \frac{\partial L}{\partial z^{(l)}} \right\rVert
                  \;\lesssim\; \rho^{\,L - l} \left\lVert \frac{\partial L}{\partial z^{(L)}} \right\rVert`}
              />
              <p>Les dérivées en jeu :</p>
              <LiveFormula
                tex={String.raw`\sigma'(z) = \sigma(z)(1 - \sigma(z)) \;\le\; \tfrac{1}{4}
                  \qquad
                  \tanh'(z) = 1 - \tanh^2(z) \;\le\; 1
                  \qquad
                  \mathrm{ReLU}'(z) = \mathbb{1}[z > 0]`}
              />
              <p>
                Avec la sigmoid, <Tex>{String.raw`\rho \le 1/4`}</Tex> est garanti : la
                décroissance est inévitable, ce n&apos;est pas une question de réglage. Avec
                ReLU, <Tex>{String.raw`f' \in \{0, 1\}`}</Tex> : le gradient passe intact ou ne
                passe pas du tout — il ne s&apos;atténue jamais progressivement.
              </p>
              <p>Enfin, softmax et sa dérivée, qui est une matrice et non un scalaire :</p>
              <LiveFormula
                tex={String.raw`\mathrm{softmax}(z)_i = \frac{e^{z_i}}{\sum_j e^{z_j}}
                  \qquad
                  \frac{\partial \, \mathrm{softmax}_i}{\partial z_j} = s_i(\delta_{ij} - s_j)`}
              />
              <p>
                Couplée à l&apos;entropie croisée, toute cette matrice se simplifie en{" "}
                <Tex>{String.raw`\delta = \hat{y} - y`}</Tex>. C&apos;est cette simplification
                qui fait du couple softmax + cross-entropy le standard absolu en classification.
              </p>
            </>
          }
        />

        <Panel title="Pourquoi softmax est à part">
          <div className="prose-lab">
            <p>
              Les quatre autres fonctions s&apos;appliquent <strong>élément par élément</strong> :
              chaque neurone calcule sa sortie sans savoir ce que font ses voisins.
            </p>
            <p>
              Softmax, non. Elle regarde <em>toute la couche</em> à la fois et normalise pour
              que la somme fasse 1. C&apos;est ce qui la rend capable de produire une
              distribution de probabilité — et ce qui fait que modifier un seul logit change
              toutes les sorties.
            </p>
            <p>
              Conséquence pratique : on ne met jamais softmax sur une couche cachée. Elle
              forcerait les neurones à se concurrencer pour une ressource limitée, alors
              qu&apos;on veut qu&apos;ils détectent des motifs indépendamment.
            </p>
          </div>
        </Panel>
      </div>
    </PageShell>
  );
}

function ActivationCard({
  name,
  x,
  showDerivative,
}: {
  name: ActivationName;
  x: number;
  showDerivative: boolean;
}) {
  const act = ACTIVATIONS[name];
  const curve = React.useMemo(() => {
    const f: { x: number; y: number }[] = [];
    const d: { x: number; y: number }[] = [];
    for (let v = -6; v <= 6.0001; v += 0.08) {
      f.push({ x: v, y: act.f(v) });
      d.push({ x: v, y: act.df(v) });
    }
    return { f, d };
  }, [act]);

  const fx = act.f(x);
  const dfx = act.df(x);
  const saturated = Math.abs(dfx) < 0.02;

  return (
    <div className="rounded-lg border border-line bg-surface-2/40 p-3">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <h3 className="text-[13px] font-semibold text-ink">{act.label}</h3>
        <span className="text-[10px] text-ink-muted">{act.range}</span>
      </div>
      <TexBlock className="!py-0 text-[11px]">{act.formula}</TexBlock>

      <LineChart
        className="mt-2"
        series={[
          { key: "f", label: "f(x)", color: SERIES[0], points: curve.f },
          ...(showDerivative
            ? [{ key: "d", label: "f′(x)", color: SERIES[1], points: curve.d, dashed: true }]
            : []),
        ]}
        height={120}
        marker={x}
        zeroFloor={false}
        yDomain={[-1.35, Math.max(1.35, name === "relu" || name === "leakyRelu" || name === "linear" ? 6.3 : 1.35)]}
        xFormat={(v) => v.toFixed(0)}
        yFormat={(v) => v.toFixed(1)}
      />

      <dl className="mt-2 grid grid-cols-2 gap-2 border-t border-line pt-2">
        <div>
          <dt className="text-[10px] text-ink-muted">f({x.toFixed(2)})</dt>
          <dd className="tnum text-sm font-semibold text-ink">{formatNumber(fx, 4)}</dd>
        </div>
        <div>
          <dt className="text-[10px] text-ink-muted">f′({x.toFixed(2)})</dt>
          <dd
            className={cx(
              "tnum text-sm font-semibold",
              saturated ? "text-critical" : "text-ink",
            )}
          >
            {formatNumber(dfx, 4)}
          </dd>
        </div>
      </dl>
      {saturated && (
        <p className="mt-1.5 text-[10px] leading-snug text-critical">
          Dérivée quasi nulle ici : un neurone dans cette zone ne reçoit presque aucun gradient.
        </p>
      )}
      <p className="mt-2 text-[11px] leading-snug text-ink-muted">{act.gradientNote}</p>
    </div>
  );
}

/** Softmax needs its own card: it is a function of a whole vector, not of one x. */
function SoftmaxCard({ x }: { x: number }) {
  const logits = [x, 0.6, -0.4];
  const probs = softmax(logits);
  const labels = ["z₁ (le curseur)", "z₂ = 0,6", "z₃ = −0,4"];

  return (
    <div className="rounded-lg border border-line bg-surface-2/40 p-3">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <h3 className="text-[13px] font-semibold text-ink">Softmax</h3>
        <span className="text-[10px] text-ink-muted">somme = 1</span>
      </div>
      <TexBlock className="!py-0 text-[11px]">
        {String.raw`s_i = \frac{e^{z_i}}{\sum_j e^{z_j}}`}
      </TexBlock>

      <ul className="mt-3 space-y-2">
        {probs.map((p, i) => (
          <li key={i}>
            <div className="mb-0.5 flex items-baseline justify-between text-[10px]">
              <span className="text-ink-muted">{labels[i]}</span>
              <span className="tnum font-semibold text-ink">{(p * 100).toFixed(1)} %</span>
            </div>
            <span className="block h-2 overflow-hidden rounded-full bg-surface-3">
              <span
                className="block h-full rounded-full transition-all duration-150"
                style={{ width: `${p * 100}%`, background: SERIES[i] }}
              />
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[11px] leading-snug text-ink-muted">
        Ce n&apos;est pas une fonction d&apos;un seul nombre : elle regarde toute la couche.
        Bougez le curseur et regardez les <em>trois</em> barres bouger — augmenter un logit
        retire nécessairement de la probabilité aux autres.
      </p>
    </div>
  );
}

/** The product of the best-case derivative, layer after layer. */
function VanishingChart({ depth }: { depth: number }) {
  const series = React.useMemo(() => {
    const make = (name: ActivationName, best: number, color: string) => ({
      key: name,
      label: `${ACTIVATIONS[name].label} (f′ max = ${best})`,
      color,
      points: Array.from({ length: 31 }, (_, l) => ({ x: l, y: best ** l })),
    });
    return [
      make("relu", 1, SERIES[2]),
      make("tanh", 1, SERIES[1]),
      make("sigmoid", 0.25, SERIES[0]),
    ];
  }, []);

  // Tanh and ReLU both sit at exactly 1 in the best case, so one hides the
  // other; that coincidence is itself the point and is called out in the text.
  return (
    <div>
      <LineChart
        series={series}
        height={230}
        marker={depth}
        xLabel="couche"
        yDomain={[0, 1.08]}
        yFormat={(v) => v.toFixed(2)}
      />
      <p className="mt-2 text-[11px] leading-snug text-ink-muted">
        Tanh et ReLU se superposent à 1 : dans leur <em>meilleur</em> cas, toutes deux laissent
        passer le gradient intact. La différence est que ReLU atteint réellement ce maximum sur
        toute sa moitié positive, alors que tanh ne l&apos;atteint qu&apos;en{" "}
        <Tex>z = 0</Tex> exactement, et s&apos;en éloigne dès que le neurone sature.
      </p>
      <div className="mt-2">
        <Plot
          xDomain={[-4, 4]}
          yDomain={[0, 1.05]}
          aspect={0.3}
          maxWidth={520}
          xLabel="z"
          yLabel="f′(z) réelle"
          ariaLabel="Dérivées réelles en fonction de z"
        >
          {(frame) => (
            <g clipPath="url(#plot-clip)">
              {(["sigmoid", "tanh", "relu"] as ActivationName[]).map((name, i) => {
                const pts: string[] = [];
                for (let z = -4; z <= 4; z += 0.05) {
                  const [px, py] = frame.px(z, Math.min(1.05, ACTIVATIONS[name].df(z)));
                  pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
                }
                return (
                  <path
                    key={name}
                    d={`M${pts.join("L")}`}
                    fill="none"
                    stroke={[SERIES[0], SERIES[1], SERIES[2]][i]}
                    strokeWidth={2}
                  />
                );
              })}
            </g>
          )}
        </Plot>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
          {(["sigmoid", "tanh", "relu"] as ActivationName[]).map((name, i) => (
            <span key={name} className="flex items-center gap-1.5 text-[10px] text-ink-2">
              <svg width="14" height="6" aria-hidden>
                <line
                  x1="0"
                  y1="3"
                  x2="14"
                  y2="3"
                  stroke={[SERIES[0], SERIES[1], SERIES[2]][i]}
                  strokeWidth="2"
                />
              </svg>
              {ACTIVATIONS[name].label}
            </span>
          ))}
          <span className="text-[10px] text-ink-muted">
            (courbe du haut : produit sur N couches · courbe du bas : dérivée réelle)
          </span>
        </div>
      </div>
    </div>
  );
}
