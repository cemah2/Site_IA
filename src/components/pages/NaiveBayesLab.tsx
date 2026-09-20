"use client";

import * as React from "react";
import { PageShell, SectionTitle, Workbench } from "@/components/layout/PageShell";
import { Callout, cx, Divider, Panel, Stat, Toggle } from "@/components/ui";
import { Levels } from "@/components/ui/Levels";
import { LiveFormula, Tex, TexBlock } from "@/components/math/Math";
import { DataPlot, EditHints } from "@/components/viz/DataPlot";
import { ClassLegend, ClassMark } from "@/components/viz/Legend";
import { MarginalCurve } from "@/components/viz/MarginalCurve";
import { DatasetControls } from "@/components/lab/DatasetControls";
import { computeField } from "@/lib/ml/field";
import { evaluate } from "@/lib/ml/metrics";
import { NaiveBayes } from "@/lib/ml/models/naive-bayes";
import { formatNumber, formatPercent } from "@/lib/viz/geometry";
import { classColor, CHROME, withAlpha } from "@/lib/viz/palette";
import { useLab } from "@/store/lab";

export function NaiveBayesLab() {
  const { dataset, setDataset } = useLab();
  const [query, setQuery] = React.useState<[number, number]>([0.4, 0.5]);
  const [showEllipses, setShowEllipses] = React.useState(true);
  const [showField, setShowField] = React.useState(true);
  const [focus, setFocus] = React.useState<number | null>(null);

  const nClasses = dataset.classNames.length;
  const model = React.useMemo(
    () => new NaiveBayes(dataset.samples, nClasses),
    [dataset.samples, nClasses],
  );

  const deferred = React.useDeferredValue(model);
  const field = React.useMemo(
    () => (showField ? computeField(deferred, dataset.domain, 96) : null),
    [deferred, dataset.domain, showField],
  );

  const detail = model.detail(query);
  const evaluation = React.useMemo(
    () => evaluate(model, dataset.samples, dataset.classNames),
    [model, dataset],
  );

  // Pearson correlation inside each class. This is the number that says whether
  // the "naive" independence assumption is defensible on THIS dataset.
  const correlations = React.useMemo(
    () =>
      dataset.classNames.map((_, c) => {
        const pts = dataset.samples.filter((s) => s.y === c);
        if (pts.length < 3) return 0;
        const mx = pts.reduce((a, s) => a + s.x[0], 0) / pts.length;
        const my = pts.reduce((a, s) => a + s.x[1], 0) / pts.length;
        let cov = 0;
        let vx = 0;
        let vy = 0;
        for (const s of pts) {
          cov += (s.x[0] - mx) * (s.x[1] - my);
          vx += (s.x[0] - mx) ** 2;
          vy += (s.x[1] - my) ** 2;
        }
        return vx && vy ? cov / Math.sqrt(vx * vy) : 0;
      }),
    [dataset],
  );

  const worstCorr = Math.max(...correlations.map(Math.abs));
  const counts = dataset.classNames.map((_, i) => dataset.samples.filter((s) => s.y === i).length);

  return (
    <PageShell
      eyebrow="Classification"
      title="Naive Bayes"
      lede={
        <>
          Plutôt que de tracer une frontière, Naive Bayes répond à une question de
          probabilité : <em>sachant ce point, quelle classe est la plus probable ?</em> Le
          théorème de Bayes donne la réponse, à condition de savoir calculer chaque terme —
          et c&apos;est exactement ce que cette page montre, un terme à la fois.
        </>
      }
    >
      <Workbench
        plot={
          <Panel
            title="Le modèle de chaque classe"
            subtitle="Cliquez pour déplacer le point à classer. Les ellipses sont les gaussiennes ajustées."
            bodyClassName="p-3"
            action={
              <ClassLegend
                classNames={dataset.classNames}
                counts={counts}
                active={focus}
                onSelect={(i) => setFocus(focus === i ? null : i)}
              />
            }
          >
            <DataPlot
              dataset={dataset}
              onChange={setDataset}
              field={field}
              mode="edit"
              aspect={1}
              onQuery={(x, y) => setQuery([x, y])}
              styleFor={(s) => (focus !== null && s.y !== focus ? { dim: true } : undefined)}
              overlay={(frame) => (
                <g clipPath="url(#plot-clip)">
                  {showEllipses &&
                    model.stats.map((perFeature, c) => {
                      if (focus !== null && focus !== c) return null;
                      const [cx, cy] = frame.px(perFeature[0].mean, perFeature[1].mean);
                      // Axis-aligned by construction: that IS the naive
                      // assumption, drawn. If the class is tilted, the ellipse
                      // visibly fails to follow it.
                      return [1, 2].map((k) => {
                        const [ex] = frame.px(
                          perFeature[0].mean + k * perFeature[0].std,
                          perFeature[1].mean,
                        );
                        const [, ey] = frame.px(
                          perFeature[0].mean,
                          perFeature[1].mean + k * perFeature[1].std,
                        );
                        return (
                          <ellipse
                            key={`${c}-${k}`}
                            cx={cx}
                            cy={cy}
                            rx={Math.abs(ex - cx)}
                            ry={Math.abs(ey - cy)}
                            fill={k === 1 ? withAlpha(classColor(c), 0.07) : "none"}
                            stroke={classColor(c)}
                            strokeWidth={k === 1 ? 1.5 : 1}
                            strokeDasharray={k === 1 ? undefined : "4 4"}
                            opacity={k === 1 ? 0.85 : 0.5}
                          />
                        );
                      });
                    })}
                </g>
              )}
              topOverlay={(frame) => {
                const [qx, qy] = frame.px(query[0], query[1]);
                return (
                  <g clipPath="url(#plot-clip)">
                    {/* Guides tying the query to the two marginal charts below. */}
                    <line
                      x1={qx}
                      x2={qx}
                      y1={frame.inner.y}
                      y2={frame.inner.y + frame.inner.h}
                      stroke={CHROME.ink}
                      strokeWidth={1}
                      strokeDasharray="3 3"
                      opacity={0.45}
                    />
                    <line
                      x1={frame.inner.x}
                      x2={frame.inner.x + frame.inner.w}
                      y1={qy}
                      y2={qy}
                      stroke={CHROME.ink}
                      strokeWidth={1}
                      strokeDasharray="3 3"
                      opacity={0.45}
                    />
                    <circle
                      cx={qx}
                      cy={qy}
                      r={8}
                      fill={CHROME.surface1}
                      stroke={classColor(detail.predicted)}
                      strokeWidth={2.5}
                    />
                    <circle cx={qx} cy={qy} r={2.5} fill={CHROME.ink} />
                  </g>
                );
              }}
            />
            <EditHints />

            <div className="mt-4 grid gap-5 border-t border-line pt-4 sm:grid-cols-2">
              <MarginalCurve
                label={`${dataset.featureNames[0]} — vraisemblance`}
                stats={model.stats.map((f) => f[0])}
                classNames={dataset.classNames}
                domain={dataset.domain[0]}
                value={query[0]}
                highlight={focus}
              />
              <MarginalCurve
                label={`${dataset.featureNames[1]} — vraisemblance`}
                stats={model.stats.map((f) => f[1])}
                classNames={dataset.classNames}
                domain={dataset.domain[1]}
                value={query[1]}
                highlight={focus}
              />
            </div>
          </Panel>
        }
        controls={
          <>
            <Toggle
              label="Gaussiennes ajustées"
              checked={showEllipses}
              onChange={setShowEllipses}
              hint="Les ellipses à 1σ et 2σ. Toujours alignées sur les axes — c'est l'hypothèse naïve, dessinée."
            />
            <Toggle label="Frontière de décision" checked={showField} onChange={setShowField} />
            <Divider label="Données" />
            <DatasetControls />
          </>
        }
        below={
          <>
            <Panel title="Le théorème, assemblé" subtitle="Chaque terme, avec sa valeur">
              <TexBlock>
                {String.raw`P(c \mid x) = \frac{\overbrace{P(c)}^{\text{prior}} \cdot \overbrace{\textstyle\prod_j p(x_j \mid c)}^{\text{vraisemblance}}}{\underbrace{P(x)}_{\text{évidence}}}`}
              </TexBlock>

              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead className="text-ink-muted">
                    <tr className="border-b border-line">
                      <th className="pb-1.5 text-left font-medium">Classe</th>
                      <th className="pb-1.5 text-right font-medium">
                        <Tex>P(c)</Tex>
                      </th>
                      <th className="pb-1.5 text-right font-medium">
                        <Tex>{String.raw`p(x_1\!\mid\! c)`}</Tex>
                      </th>
                      <th className="pb-1.5 text-right font-medium">
                        <Tex>{String.raw`p(x_2\!\mid\! c)`}</Tex>
                      </th>
                      <th className="pb-1.5 text-right font-medium">produit</th>
                      <th className="pb-1.5 text-right font-medium">
                        <Tex>{String.raw`P(c\!\mid\! x)`}</Tex>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="tnum">
                    {dataset.classNames.map((name, c) => (
                      <tr
                        key={name}
                        className={cx(
                          "border-b border-line/50",
                          detail.predicted === c ? "text-ink" : "text-ink-muted",
                        )}
                      >
                        <td className="py-1.5">
                          <span className="inline-flex items-center gap-1.5">
                            <ClassMark index={c} size={9} />
                            {name}
                          </span>
                        </td>
                        <td className="py-1.5 text-right">{detail.priors[c].toFixed(3)}</td>
                        <td className="py-1.5 text-right">{detail.likelihood[c][0].toFixed(4)}</td>
                        <td className="py-1.5 text-right">{detail.likelihood[c][1].toFixed(4)}</td>
                        <td className="py-1.5 text-right">{detail.unnormalised[c].toExponential(2)}</td>
                        <td className="py-1.5 text-right font-semibold">
                          {formatPercent(detail.posterior[c], 1)}
                        </td>
                      </tr>
                    ))}
                    <tr className="text-ink-muted">
                      <td className="pt-1.5" colSpan={4}>
                        <Tex>{String.raw`P(x) = \sum_c`}</Tex> (l&apos;évidence)
                      </td>
                      <td className="pt-1.5 text-right">{detail.evidence.toExponential(2)}</td>
                      <td className="pt-1.5 text-right">100 %</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-3 space-y-1.5">
                {dataset.classNames.map((name, c) => (
                  <div key={name} className="flex items-center gap-2">
                    <ClassMark index={c} />
                    <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                      <span
                        className="absolute inset-y-0 left-0 rounded-full transition-all duration-200"
                        style={{
                          width: `${detail.posterior[c] * 100}%`,
                          background: classColor(c),
                          opacity: detail.predicted === c ? 1 : 0.45,
                        }}
                      />
                    </span>
                    <span className="tnum w-12 shrink-0 text-right text-xs font-semibold text-ink">
                      {formatPercent(detail.posterior[c], 0)}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel
              title="L'hypothèse naïve tient-elle ?"
              subtitle="Corrélation linéaire entre les deux features, dans chaque classe"
            >
              <ul className="space-y-1.5">
                {dataset.classNames.map((name, c) => (
                  <li key={name} className="flex items-center gap-2">
                    <ClassMark index={c} />
                    <span className="w-12 shrink-0 text-[11px] text-ink-2">{name}</span>
                    <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                      {/* Diverging: the sign of a correlation is meaningful, so
                          the bar grows from the centre in both directions. */}
                      <span className="absolute inset-y-0 left-1/2 w-px bg-line-strong" />
                      <span
                        className="absolute inset-y-0 rounded-full"
                        style={{
                          left: correlations[c] >= 0 ? "50%" : `${50 + correlations[c] * 50}%`,
                          width: `${Math.abs(correlations[c]) * 50}%`,
                          background: correlations[c] >= 0 ? "#3987e5" : "#d03b3b",
                        }}
                      />
                    </span>
                    <span className="tnum w-12 shrink-0 text-right text-xs font-semibold text-ink">
                      {formatNumber(correlations[c])}
                    </span>
                  </li>
                ))}
              </ul>
              {worstCorr >= 0.2 ? (
                <p className="mt-2.5 text-[11px] leading-snug text-ink-muted">
                  Nettement non nul : les features sont corrélées dans au moins une classe. Le
                  modèle suppose le contraire, donc ses ellipses ne peuvent pas suivre
                  l&apos;inclinaison réelle du nuage — regardez-les.
                </p>
              ) : (
                <p className="mt-2.5 text-[11px] leading-snug text-ink-muted">
                  Proche de zéro — mais attention :{" "}
                  <strong className="text-ink-2">
                    une corrélation nulle ne veut pas dire indépendance
                  </strong>
                  . Pearson ne mesure que le lien <em>linéaire</em>. Sur « Deux lunes » ou
                  « Cercles concentriques », elle vaut presque 0 alors que les deux features sont
                  fortement liées : connaître <Tex>x_1</Tex> restreint beaucoup{" "}
                  <Tex>x_2</Tex>, mais pas de façon droite. Comparez plutôt la forme des ellipses
                  avec celle du nuage : c&apos;est le vrai test.
                </p>
              )}
            </Panel>

            <div className="grid grid-cols-2 gap-2">
              <Stat
                label="Accuracy"
                value={formatPercent(evaluation.accuracy)}
                tone={evaluation.accuracy > 0.85 ? "good" : "warning"}
              />
              <Stat
                label="Paramètres"
                value={nClasses + nClasses * 2 * 2}
                hint="1 prior + (moyenne, écart-type) par feature et par classe"
              />
            </div>
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
                Un médecin voit un patient qui tousse. Deux questions différentes :
              </p>
              <ul>
                <li>
                  « Si c&apos;est une grippe, quelle chance qu&apos;il tousse ? » — facile, on
                  l&apos;observe sur tous les grippés. C&apos;est la <strong>vraisemblance</strong>.
                </li>
                <li>
                  « Il tousse ; quelle chance que ce soit une grippe ? » — c&apos;est la question
                  utile, et c&apos;est la <strong>probabilité a posteriori</strong>.
                </li>
              </ul>
              <p>
                Le théorème de Bayes fait passer de la première à la seconde. Il faut juste
                ajouter une information : à quel point la grippe est fréquente en général.
                C&apos;est le <strong>prior</strong>. Une maladie rarissime reste improbable même
                avec un symptôme typique.
              </p>
              <p>
                La partie <strong>« naïve »</strong> : le modèle suppose que les symptômes sont
                indépendants entre eux à l&apos;intérieur d&apos;une maladie. C&apos;est souvent
                faux — fièvre et courbatures vont ensemble — mais ça rend le calcul trivial, et
                curieusement, la réponse finale reste souvent correcte.
              </p>
            </>
          }
          technique={
            <>
              <p>
                Naive Bayes est un modèle <strong>génératif</strong> : au lieu d&apos;apprendre
                directement la frontière, il apprend à quoi ressemble chaque classe — ici, une
                gaussienne par feature et par classe — puis retourne le raisonnement avec Bayes.
              </p>
              <p>
                <strong>L&apos;hypothèse d&apos;indépendance conditionnelle</strong> transforme
                une densité jointe en <Tex>d</Tex> dimensions en un produit de{" "}
                <Tex>d</Tex> densités en 1 dimension. Le gain est énorme : estimer une gaussienne
                jointe en 100 dimensions demande une matrice de covariance de 5 050 paramètres,
                contre 200 pour le modèle naïf.
              </p>
              <p>
                Géométriquement, ça force les ellipses à rester{" "}
                <strong>alignées sur les axes</strong>. Une classe dont le nuage est incliné est
                donc forcément mal modélisée — c&apos;est visible directement sur le graphique.
              </p>
              <p>
                <strong>Et pourtant ça marche.</strong> Parce qu&apos;on ne demande pas au modèle
                les bonnes probabilités, seulement le bon <Tex>{String.raw`\arg\max`}</Tex>. Les
                probabilités renvoyées par Naive Bayes sont souvent très mal calibrées (écrasées
                vers 0 ou 1) tout en désignant la bonne classe.
              </p>
              <p>
                <strong>Le lissage est indispensable.</strong> Si une classe n&apos;a qu&apos;un
                seul échantillon, sa variance est nulle et sa densité devient infinie en un point
                et nulle partout ailleurs. Le code ajoute <Tex>{String.raw`10^{-3}`}</Tex> à chaque variance
                pour cette raison.
              </p>
            </>
          }
          maths={
            <>
              <p>Le théorème de Bayes, sans approximation :</p>
              <LiveFormula
                tex={String.raw`P(c \mid x) = \frac{P(x \mid c)\,P(c)}{P(x)},
                  \qquad P(x) = \sum_{c'} P(x \mid c')\,P(c')`}
              />
              <p>
                L&apos;hypothèse naïve : les features sont mutuellement indépendantes{" "}
                <em>conditionnellement à la classe</em>.
              </p>
              <LiveFormula
                tex={String.raw`P(x_1, \dots, x_d \mid c) \;\stackrel{\text{naïf}}{=}\; \prod_{j=1}^{d} p(x_j \mid c)`}
              />
              <p>Avec des vraisemblances gaussiennes :</p>
              <LiveFormula
                tex={String.raw`p(x_j \mid c) = \frac{1}{\sqrt{2\pi}\,\sigma_{c,j}}
                  \exp\!\left(-\frac{(x_j - \mu_{c,j})^2}{2\sigma_{c,j}^2}\right)`}
              />
              <p>
                <strong>En pratique, on travaille en logarithmes.</strong> Le produit de{" "}
                <Tex>d</Tex> densités toutes inférieures à 1 s&apos;annule numériquement dès que{" "}
                <Tex>d</Tex> dépasse quelques dizaines. Comme <Tex>{String.raw`\log`}</Tex> est
                strictement croissant, l&apos;<Tex>{String.raw`\arg\max`}</Tex> est inchangé :
              </p>
              <LiveFormula
                tex={String.raw`\hat{y}(x) = \arg\max_{c} \; \log P(c) + \sum_{j=1}^{d} \log p(x_j \mid c)`}
              />
              <p>
                <Tex>P(x)</Tex> disparaît de cette expression : c&apos;est la même constante pour
                toutes les classes, donc elle ne peut pas changer le gagnant. On ne la calcule que
                pour normaliser et obtenir de vraies probabilités — le tableau ci-dessus l&apos;affiche
                justement pour ça.
              </p>
            </>
          }
        />

        <div className="space-y-4">
          <Callout kind="insight" title="L'expérience décisive">
            Passez sur le dataset <strong>« Deux gaussiennes »</strong> : il a été généré
            exactement selon l&apos;hypothèse du modèle (axes alignés, variances inégales). Les
            ellipses collent parfaitement et l&apos;accuracy est excellente.
            <br />
            <br />
            Puis passez sur <strong>« Séparables linéairement »</strong> : le nuage est incliné
            à 35°, les ellipses n&apos;arrivent plus à le suivre, et la corrélation intra-classe
            devient nettement non nulle. C&apos;est l&apos;hypothèse naïve qui casse, visible à
            l&apos;œil.
          </Callout>

          <Callout kind="warning" title="Probabilité ≠ confiance">
            Naive Bayes affiche volontiers « 99,97 % ». Ce chiffre vient de multiplier des
            densités supposées indépendantes : chaque feature corrélée compte plusieurs fois la
            même information, ce qui gonfle artificiellement la certitude. Le classement des
            classes reste utile ; le chiffre lui-même, non.
          </Callout>

          <Panel title="Cas pratiques" subtitle="Là où Naive Bayes est vraiment bon">
            <div className="prose-lab">
              <p>
                <strong>Filtrage de spam.</strong> L&apos;application historique. Chaque mot est
                une feature ; l&apos;hypothèse naïve suppose que les mots d&apos;un message sont
                indépendants — manifestement faux — et pourtant les filtres bayésiens ont
                fonctionné remarquablement bien pendant des années. La raison : il y a des
                milliers de features faibles, et leurs erreurs de corrélation se compensent.
              </p>
              <p>
                <strong>Classification de texte par thème.</strong> Même principe. Avec un
                vocabulaire de 50 000 mots, tout modèle qui estimerait les corrélations serait
                hors de portée ; Naive Bayes s&apos;entraîne en une passe sur le corpus.
              </p>
              <p>
                <strong>Analyse de sentiment simple.</strong> Fonctionne sur les cas nets, échoue
                sur la négation et l&apos;ironie — précisément parce que « pas » + « bon » est une
                dépendance entre features, ce que le modèle ne peut pas représenter.
              </p>
              <p>
                <strong>Comme baseline.</strong> Rapide à entraîner, quasi sans hyperparamètre.
                Un modèle compliqué qui ne bat pas Naive Bayes ne sert à rien.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}
