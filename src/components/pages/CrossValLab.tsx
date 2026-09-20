"use client";

import * as React from "react";
import { PageShell, SectionTitle, Workbench } from "@/components/layout/PageShell";
import { Button, Callout, Divider, Panel, Segmented, Slider, Stat } from "@/components/ui";
import { G } from "@/components/ui/Glossary";
import { Levels } from "@/components/ui/Levels";
import { Tex, TexBlock } from "@/components/math/Math";
import { DatasetControls } from "@/components/lab/DatasetControls";
import { Narrator } from "@/components/lab/Narrator";
import { Quiz } from "@/components/lab/Quiz";
import { DataPlot } from "@/components/viz/DataPlot";
import { ClassLegend } from "@/components/viz/Legend";
import { CvSummary, FoldDiagram, SplitLottery, SweepChart } from "@/components/viz/CrossValViz";
import { assignFolds, crossValidate, sweepParameter } from "@/lib/ml/crossval";
import { splitDataset } from "@/lib/ml/datasets";
import { computeField } from "@/lib/ml/field";
import { DEFAULT_PARAMS, fitModel, type AlgoId } from "@/lib/ml/registry";
import { formatNumber, formatPercent } from "@/lib/viz/geometry";
import { CHROME } from "@/lib/viz/palette";
import { useLab } from "@/store/lab";

/** The algorithms whose main knob is worth sweeping, and the knob. */
const SWEEPS: {
  algo: AlgoId;
  label: string;
  key: "k" | "maxDepth" | "nTrees" | "C";
  axis: string;
  values: number[];
  question: string;
}[] = [
  {
    algo: "knn",
    label: "KNN",
    key: "k",
    axis: "K — nombre de voisins",
    values: [1, 2, 3, 5, 7, 9, 12, 15, 20, 25, 31, 40],
    question: "Quel K choisir ?",
  },
  {
    algo: "tree",
    label: "Arbre",
    key: "maxDepth",
    axis: "profondeur maximale de l'arbre",
    values: [1, 2, 3, 4, 5, 6, 8, 10, 12],
    question: "Jusqu'où laisser l'arbre pousser ?",
  },
  {
    algo: "forest",
    label: "Forêt",
    key: "nTrees",
    axis: "nombre d'arbres",
    values: [1, 2, 3, 5, 8, 12, 20, 30],
    question: "Combien d'arbres suffisent ?",
  },
  {
    algo: "svm",
    label: "SVM",
    key: "C",
    axis: "C — tolérance aux erreurs",
    values: [0.03, 0.1, 0.3, 1, 3, 10, 30],
    question: "Quelle marge accepter ?",
  },
];

export function CrossValLab() {
  const { dataset } = useLab();
  const [k, setK] = React.useState(5);
  const [foldSeed, setFoldSeed] = React.useState(7);
  const [which, setWhich] = React.useState(0);
  const [hoverFold, setHoverFold] = React.useState<number | null>(null);
  const [hoverSweep, setHoverSweep] = React.useState<number | null>(null);
  const [draws, setDraws] = React.useState<{ seed: number; acc: number }[]>([]);

  const spec = SWEEPS[which];
  const nClasses = dataset.classNames.length;
  const samples = dataset.samples;

  const params = React.useMemo(() => ({ ...DEFAULT_PARAMS }), []);

  const cv = React.useMemo(
    () => crossValidate(spec.algo, samples, nClasses, params, k, foldSeed),
    [spec.algo, samples, nClasses, params, k, foldSeed],
  );

  const assignment = React.useMemo(
    () => assignFolds(samples, k, foldSeed),
    [samples, k, foldSeed],
  );

  const holdout = React.useMemo(() => splitDataset(dataset, 0.7, 909), [dataset]);

  const sweep = React.useMemo(
    () =>
      sweepParameter(
        spec.algo,
        samples,
        nClasses,
        params,
        spec.key,
        spec.values,
        k,
        foldSeed,
        holdout,
      ),
    [spec, samples, nClasses, params, k, foldSeed, holdout],
  );

  const bestCv = sweep.reduce((b, p, i) => (p.cv.mean > sweep[b].cv.mean ? i : b), 0);
  const bestSingle = sweep.reduce((b, p, i) => (p.single > sweep[b].single ? i : b), 0);
  const disagree = sweep[bestCv]?.value !== sweep[bestSingle]?.value;

  // The model shown on the plot is the one from the hovered fold, so the
  // diagram, the scatter and the accuracy always describe the same thing.
  const shownFold = hoverFold ?? 0;
  const { field, testIds } = React.useMemo(() => {
    const test = samples.filter((_, i) => assignment[i] === shownFold);
    const train = samples.filter((_, i) => assignment[i] !== shownFold);
    if (!train.length) return { field: null, testIds: new Set<number>() };
    const { model } = fitModel(spec.algo, train, nClasses, params);
    return {
      field: computeField(model, dataset.domain, 80),
      testIds: new Set(test.map((s) => s.id)),
    };
  }, [samples, assignment, shownFold, spec.algo, nClasses, params, dataset.domain]);

  const drawOnce = React.useCallback(
    (count: number) => {
      setDraws((prev) => {
        const next = [...prev];
        for (let i = 0; i < count; i++) {
          const seed = 1000 + next.length * 7919 + i;
          const split = splitDataset(dataset, 0.7, seed);
          const { model } = fitModel(spec.algo, split.train, nClasses, params);
          let ok = 0;
          for (const s of split.test) if (model.predict(s.x) === s.y) ok += 1;
          next.push({ seed, acc: split.test.length ? ok / split.test.length : 0 });
        }
        return next.slice(-60);
      });
    },
    [dataset, spec.algo, nClasses, params],
  );

  // A new problem invalidates the draws: showing accuracies measured on data
  // that is no longer on screen would be the exact dishonesty this page is about.
  const runKey = `${dataset.name}|${samples.length}|${spec.algo}`;
  const [lastKey, setLastKey] = React.useState(runKey);
  if (lastKey !== runKey) {
    setLastKey(runKey);
    setDraws([]);
  }

  const accs = draws.map((d) => d.acc);
  const spread = accs.length > 1 ? Math.max(...accs) - Math.min(...accs) : 0;

  return (
    <PageShell
      eyebrow="Concepts"
      title="Validation croisée"
      lede={
        <>
          Toutes les pages précédentes affichent une « accuracy de test ». Celle-ci montre à quel
          point ce nombre dépend de la <strong>chance du découpage</strong> — souvent cinq à dix
          points — et comment obtenir une mesure qu&apos;on peut réellement comparer.
        </>
      }
      wide
    >
      <Workbench
        plot={
          <div className="space-y-5">
            <Panel
              title="Le même modèle, la même donnée, dix mesures différentes"
              subtitle="Chaque point : un découpage 70 / 30 tiré au hasard, puis l'accuracy obtenue"
              bodyClassName="p-4"
            >
              <div className="flex flex-wrap items-center gap-2 pb-3">
                <Button onClick={() => drawOnce(1)}>Tirer un découpage</Button>
                <Button onClick={() => drawOnce(20)}>Tirer 20 fois</Button>
                <Button variant="ghost" onClick={() => setDraws([])}>
                  Effacer
                </Button>
                <span className="tnum text-[11px] text-ink-muted">
                  {draws.length} tirage{draws.length > 1 ? "s" : ""}
                </span>
              </div>

              {draws.length ? (
                <>
                  <SplitLottery draws={accs} cvMean={cv.mean} height={120} />
                  <p className="mt-2 max-w-prose text-[12px] leading-relaxed text-ink-2">
                    {accs.length > 1 ? (
                      <>
                        Entre le tirage le plus chanceux et le plus malchanceux :{" "}
                        <strong className="tnum">{formatPercent(spread, 1)}</strong>{" "}
                        d&apos;écart. Rien n&apos;a changé — ni le modèle, ni les réglages, ni les
                        données. Seul le hasard du découpage a parlé. Annoncer « mon modèle fait{" "}
                        {formatPercent(accs[accs.length - 1])} » sur la foi d&apos;un seul tirage,
                        c&apos;est annoncer un nombre dont on ne contrôle pas{" "}
                        {formatPercent(spread, 1)}.
                      </>
                    ) : (
                      <>
                        Un seul tirage :{" "}
                        <strong className="tnum">{formatPercent(accs[0])}</strong>. Tirez-en
                        d&apos;autres et regardez où ils tombent.
                      </>
                    )}
                  </p>
                </>
              ) : (
                <p className="py-6 text-center text-[13px] text-ink-muted">
                  Tirez un découpage pour commencer — puis un deuxième.
                </p>
              )}
            </Panel>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
              <Panel
                title={`Le pli ${shownFold + 1}`}
                subtitle="Entraîné sur tout le reste, testé sur les points entourés"
                bodyClassName="p-3"
                action={<ClassLegend classNames={dataset.classNames} />}
              >
                <DataPlot
                  dataset={dataset}
                  field={field}
                  aspect={1}
                  maxWidth={360}
                  styleFor={(s) =>
                    testIds.has(s.id) ? { ring: CHROME.ink, scale: 1.15 } : { dim: true }
                  }
                />
                <p className="mt-2 border-t border-line pt-2.5 text-[11px] leading-snug text-ink-2">
                  Survolez une ligne du diagramme : le modèle affiché est celui entraîné sans les
                  points de ce pli. Il change à chaque fois — c&apos;est précisément ce que la
                  validation croisée mesure.
                </p>
              </Panel>

              <Panel
                title={`${k} plis, ${k} entraînements`}
                subtitle="Chaque point sert exactement une fois de test, et K − 1 fois d'entraînement"
                bodyClassName="p-4"
              >
                <FoldDiagram
                  assignment={assignment}
                  k={k}
                  results={cv.folds}
                  active={hoverFold}
                  onHover={setHoverFold}
                />
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <Stat label="Moyenne" value={formatPercent(cv.mean)} />
                  <Stat
                    label="Écart-type"
                    value={formatPercent(cv.std, 1)}
                    tone={cv.std > 0.06 ? "warning" : "neutral"}
                    hint="Entre les plis"
                  />
                  <Stat
                    label="Étendue"
                    value={`${Math.round(cv.min * 100)}–${Math.round(cv.max * 100)} %`}
                    hint="Du pire au meilleur pli"
                  />
                </div>
                <p className="mt-3 max-w-prose text-[12px] leading-relaxed text-ink-2">
                  Le résultat honnête n&apos;est pas un nombre mais un nombre{" "}
                  <em>et sa dispersion</em> : <CvSummary cv={cv} />. Si deux modèles sont séparés
                  par moins que cet écart, les déclarer différents n&apos;est pas justifié par la
                  mesure.
                </p>
              </Panel>
            </div>

            <Panel
              title={spec.question}
              subtitle="Trait plein : validation croisée (bande = du pire au meilleur pli). Pointillés : un seul découpage."
              bodyClassName="p-4"
            >
              <SweepChart
                points={sweep}
                label={spec.axis}
                height={230}
                active={hoverSweep}
                onHover={setHoverSweep}
              />
              {hoverSweep !== null && sweep[hoverSweep] && (
                <p className="mt-1 text-[11.5px] text-ink-2">
                  <span className="tnum">
                    {spec.axis.split(" ")[0]} = {sweep[hoverSweep].value}
                  </span>{" "}
                  → validation croisée <CvSummary cv={sweep[hoverSweep].cv} />, découpage unique{" "}
                  <span className="tnum">{formatPercent(sweep[hoverSweep].single)}</span>.
                </p>
              )}
              <div className="mt-3 max-w-prose space-y-2 text-[12px] leading-relaxed text-ink-2">
                {disagree ? (
                  <p>
                    Les deux méthodes ne recommandent <strong>pas</strong> le même réglage : le
                    découpage unique préfère{" "}
                    <span className="tnum">{sweep[bestSingle].value}</span>, la validation croisée{" "}
                    <span className="tnum">{sweep[bestCv].value}</span>. Choisir sur un seul
                    découpage revient à optimiser le tirage au sort autant que le modèle.
                  </p>
                ) : (
                  <p>
                    Ici les deux méthodes tombent d&apos;accord sur{" "}
                    <span className="tnum">{sweep[bestCv].value}</span> — ça arrive, surtout quand
                    la courbe a un maximum franc. Augmentez le bruit ou réduisez le nombre de
                    points : l&apos;accord ne survit généralement pas.
                  </p>
                )}
                <p>
                  Regardez surtout la <strong>largeur de la bande</strong>. Quand elle est plus
                  haute que l&apos;écart entre deux réglages voisins, leur classement n&apos;est
                  pas fiable : la courbe dit « ces valeurs se valent », pas « celle-ci gagne ».
                </p>
              </div>
            </Panel>
          </div>
        }
        controls={
          <>
            <Segmented
              label="Modèle et réglage à choisir"
              value={String(which)}
              options={SWEEPS.map((s, i) => ({ value: String(i), label: s.label }))}
              onChange={(v) => setWhich(Number(v))}
              size="sm"
            />
            <Slider
              label="K — nombre de plis"
              value={k}
              min={2}
              max={10}
              step={1}
              onChange={setK}
              hint={`${k} entraînements par réglage testé. Chaque pli met de côté environ ${Math.round(samples.length / k)} points.`}
            />
            <div className="rounded-md border border-line bg-surface-2/50 px-2.5 py-2 text-[11px] leading-snug text-ink-2">
              <p className="mb-1 font-medium text-ink-2">Le compromis sur K</p>
              <p>
                K petit : peu de calcul, mais chaque modèle s&apos;entraîne sur beaucoup moins de
                données que le modèle final — la mesure est <em>pessimiste</em>. K grand : chaque
                modèle voit presque tout, mais les K modèles se ressemblent tellement que leurs
                erreurs se ressemblent aussi. 5 et 10 sont les valeurs usuelles, et ce n&apos;est
                pas un hasard.
              </p>
            </div>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setFoldSeed((s) => (s * 1103515245 + 12345) % 100000)}
            >
              Retirer les plis au sort
            </Button>
            <p className="text-[11px] leading-snug text-ink-muted">
              La validation croisée bouge aussi quand on change le découpage en plis — mais
              beaucoup moins. Comparez l&apos;amplitude de ce mouvement à celle des tirages
              uniques.
            </p>

            <Divider label="Données" />
            <DatasetControls compact showClasses />

            <Divider label="Ce que ça change" />
            <Narrator
              causes={[
                { key: "k", label: "le nombre de plis", value: k },
                { key: "algo", label: "le modèle", value: spec.label },
              ]}
              effects={[
                {
                  key: "mean",
                  label: "l'accuracy moyenne",
                  value: cv.mean,
                  format: (v) => formatPercent(v),
                  better: "up",
                  epsilon: 0.005,
                },
                {
                  key: "std",
                  label: "l'écart entre les plis",
                  value: cv.std,
                  format: (v) => formatPercent(v, 1),
                  better: "down",
                  epsilon: 0.004,
                },
              ]}
            />
          </>
        }
        below={
          <>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Validation croisée" value={formatPercent(cv.mean)} tone="good" />
              <Stat
                label="Découpage unique"
                value={accs.length ? formatPercent(accs[accs.length - 1]) : "—"}
                hint="Le dernier tirage"
              />
              <Stat
                label="Écart entre tirages"
                value={accs.length > 1 ? formatPercent(spread, 1) : "—"}
                tone={spread > 0.08 ? "critical" : spread > 0.04 ? "warning" : "neutral"}
              />
              <Stat
                label="Entraînements"
                value={`${k} × ${sweep.length}`}
                hint={`${formatNumber(sweep.reduce((a, p) => a + p.cv.ms, 0), 0)} ms au total`}
              />
            </div>

            <Callout kind="warning" title="Le piège, et il est partout">
              Si vous choisissez un hyperparamètre en regardant le jeu de test, ce jeu n&apos;est
              plus un jeu de test : vous venez de l&apos;utiliser pour apprendre. L&apos;accuracy
              qu&apos;il affiche devient optimiste, parfois de plusieurs points. La parade
              standard : choisir les réglages par validation croisée sur les données
              d&apos;entraînement, et ne toucher au vrai jeu de test qu&apos;<em>une seule fois</em>,
              à la fin, pour annoncer un résultat.
            </Callout>

            <Panel title="Le coût" subtitle="Pourquoi on ne le fait pas toujours">
              <p className="text-[12px] leading-relaxed text-ink-2">
                Une validation croisée à {k} plis coûte {k} entraînements au lieu d&apos;un. Sur
                cette page c&apos;est instantané ; sur un modèle qui met trois jours à
                s&apos;entraîner, c&apos;est {k} × trois jours. C&apos;est exactement pourquoi les
                gros réseaux se contentent généralement d&apos;un seul jeu de validation fixe — et
                pourquoi leurs résultats publiés sont accompagnés de plusieurs graines aléatoires
                quand les auteurs sont sérieux.
              </p>
            </Panel>
          </>
        }
      />

      <SectionTitle hint="La même idée, à trois niveaux de détail.">
        Mesurer sans se mentir
      </SectionTitle>

      <Levels
        intuition={
          <>
            <p>
              Un professeur veut savoir si un élève a compris. Il lui pose une question. L&apos;élève
              répond juste. Peut-on conclure ? Non : la question pouvait tomber exactement sur ce
              qu&apos;il avait révisé. Avec dix questions tirées au hasard, on sait déjà beaucoup
              mieux — et surtout, on sait si les résultats sont réguliers ou si l&apos;élève brille
              sur certains sujets et s&apos;effondre sur d&apos;autres.
            </p>
            <p>
              La validation croisée fait cela avec des données. On découpe le jeu en K paquets. À
              tour de rôle, chaque paquet joue le rôle de l&apos;examen et tous les autres servent
              de révisions. On obtient K notes au lieu d&apos;une. Leur moyenne est plus fiable, et
              leur dispersion dit à quel point on aurait pu se tromper avec une seule.
            </p>
            <p>
              L&apos;autre règle est plus sévère qu&apos;elle n&apos;en a l&apos;air : dès qu&apos;on
              regarde les résultats de l&apos;examen pour décider quoi changer, cet examen ne
              mesure plus rien. Il faut garder un sujet qu&apos;on n&apos;a jamais ouvert.
            </p>
          </>
        }
        technique={
          <>
            <p>
              La <G t="crossval">K-fold cross-validation</G> partitionne le jeu en K plis de
              tailles égales — <strong>stratifiés</strong>, c&apos;est-à-dire respectant les
              proportions de chaque classe, sans quoi un pli peut ne contenir aucun exemple d&apos;une
              classe rare et mesurer autre chose que les autres.
            </p>
            <p>
              On entraîne K modèles, chacun sur K − 1 plis, et on évalue chacun sur le pli laissé
              de côté. Chaque exemple est donc testé exactement une fois, par un modèle qui ne
              l&apos;a jamais vu. On rapporte la moyenne et l&apos;écart-type.
            </p>
            <p>
              Le cas K = n s&apos;appelle <em>leave-one-out</em> : chaque modèle voit toutes les
              données sauf un point. Sa moyenne est quasi non biaisée, mais les n modèles sont
              presque identiques, donc leurs erreurs sont corrélées et l&apos;estimation devient
              instable — et il faut n entraînements. C&apos;est pourquoi K = 5 ou 10 domine en
              pratique.
            </p>
          </>
        }
        maths={
          <>
            <p>
              Soit <Tex>{String.raw`\mathcal{D}`}</Tex> partitionné en K plis disjoints{" "}
              <Tex>{String.raw`\mathcal{D}_1, \dots, \mathcal{D}_K`}</Tex>, et{" "}
              <Tex>{String.raw`\hat{f}^{(-j)}`}</Tex> le modèle entraîné sur tout sauf le pli{" "}
              <Tex>j</Tex>. L&apos;estimation vaut :
            </p>
            <TexBlock>
              {String.raw`\widehat{\mathrm{Err}}_{\mathrm{CV}}
                = \frac{1}{K}\sum_{j=1}^{K}
                \frac{1}{|\mathcal{D}_j|}\sum_{i \in \mathcal{D}_j}
                L\!\left(y_i,\ \hat{f}^{(-j)}(x_i)\right)`}
            </TexBlock>
            <p>
              L&apos;écart-type affiché ici est celui des K scores de plis. Attention : ce
              n&apos;est <em>pas</em> une erreur-type valide de la moyenne, parce que les K
              modèles partagent leurs données d&apos;entraînement et que leurs scores sont donc
              corrélés ; diviser par <Tex>{String.raw`\sqrt{K}`}</Tex> sous-estimerait
              l&apos;incertitude. Pris pour ce qu&apos;il est — une mesure de dispersion entre
              plis — il reste la meilleure indication disponible d&apos;instabilité.
            </p>
            <p>
              Le biais de l&apos;estimation vient de ce que chaque modèle voit{" "}
              <Tex>{String.raw`n(K-1)/K`}</Tex> exemples au lieu de <Tex>n</Tex>. Comme la
              performance croît avec la taille du jeu, la validation croisée est structurellement{" "}
              <strong>pessimiste</strong>, d&apos;autant plus que K est petit.
            </p>
          </>
        }
      />

      <SectionTitle hint="Trois questions auxquelles la page ci-dessus répond.">
        Vérifiez que c&apos;est passé
      </SectionTitle>

      <Quiz
        questions={[
          {
            id: "q1",
            question:
              "Modèle A obtient 91,2 % ± 4,1 en validation croisée, modèle B 92,0 % ± 3,8. Que peut-on conclure ?",
            options: [
              { id: "a", label: "B est meilleur que A" },
              { id: "b", label: "Rien : l'écart entre eux est bien plus petit que la dispersion entre les plis" },
              { id: "c", label: "A est plus stable, donc préférable" },
            ],
            answer: 1,
            explanation: (
              <>
                0,8 point d&apos;écart quand les plis d&apos;un même modèle varient de 4 points :
                la mesure ne permet pas de les départager. Ce n&apos;est pas une conclusion
                faible, c&apos;est la seule honnête. Et « A est plus stable » ne se lit pas non
                plus ici : les deux écarts-types sont eux aussi trop proches.
              </>
            ),
          },
          {
            id: "q2",
            question:
              "Vous essayez 40 valeurs d'hyperparamètre et gardez celle qui donne la meilleure accuracy sur votre jeu de test. Le problème ?",
            options: [
              { id: "a", label: "Aucun, c'est la bonne méthode" },
              {
                id: "b",
                label:
                  "Le jeu de test a servi à choisir : sur 40 essais, le gagnant est en partie le plus chanceux, et son score est optimiste",
              },
              { id: "c", label: "40 valeurs, c'est trop peu" },
            ],
            answer: 1,
            explanation: (
              <>
                En tirant 40 fois, on finit par trouver une valeur qui convient particulièrement
                bien <em>à ce jeu de test précis</em>. Le score retenu contient donc cette chance,
                et il ne se reproduira pas sur de nouvelles données. C&apos;est du
                surapprentissage, non pas sur les données d&apos;entraînement mais sur le jeu de
                test — parfois appelé le pire, parce qu&apos;il est invisible.
              </>
            ),
          },
          {
            id: "q3",
            question:
              "Pourquoi les plis sont-ils « stratifiés », c'est-à-dire construits pour respecter la proportion de chaque classe ?",
            options: [
              { id: "a", label: "Pour aller plus vite" },
              {
                id: "b",
                label:
                  "Sans ça, un pli peut ne contenir presque aucun exemple d'une classe rare et mesurer un autre problème que les autres",
              },
              { id: "c", label: "Pour que tous les plis aient exactement la même taille" },
            ],
            answer: 1,
            explanation: (
              <>
                Essayez avec le dataset « Déséquilibré » : sur 5 plis et une classe minoritaire à
                10 %, un pli peut n&apos;en recevoir que deux ou trois exemples. Son accuracy
                devient alors presque insensible à cette classe, et la moyenne des plis mélange
                des mesures qui ne portent pas sur la même chose. La stratification coûte trois
                lignes de code et supprime le problème.
              </>
            ),
          },
        ]}
      />
    </PageShell>
  );
}
