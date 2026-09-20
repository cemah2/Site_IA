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
import { DataPlot, EditHints } from "@/components/viz/DataPlot";
import { ClassLegend } from "@/components/viz/Legend";
import {
  ConfusionBlocks,
  PrCurve,
  RocCurve,
  ScoreStrip,
} from "@/components/viz/ThresholdViz";
import { computeField } from "@/lib/ml/field";
import { ALGOS, DEFAULT_PARAMS, fitModel, type AlgoId } from "@/lib/ml/registry";
import {
  auc,
  auprc,
  bestThreshold,
  curvePoints,
  metricsAt,
  outOfFoldScores,
  type ThresholdRule,
} from "@/lib/ml/threshold";
import { formatNumber, formatPercent } from "@/lib/viz/geometry";
import { CHROME } from "@/lib/viz/palette";
import { useLab } from "@/store/lab";

/** Models whose probabilities are worth cutting. */
const MODELS: AlgoId[] = ["bayes", "knn", "forest", "tree", "mlp"];

const RULES: { value: ThresholdRule; label: string; why: string }[] = [
  { value: "accuracy", label: "Accuracy", why: "Maximise le nombre total de bonnes réponses. Ignore complètement quelle erreur coûte quoi." },
  { value: "f1", label: "F1", why: "Équilibre précision et rappel. Le réflexe par défaut quand on n'a rien de mieux." },
  { value: "youden", label: "Youden", why: "Maximise rappel + spécificité − 1. C'est le point le plus haut au-dessus de la diagonale du ROC." },
  { value: "cost", label: "Coût", why: "La seule qui pose la vraie question : combien de fausses alertes accepteriez-vous pour éviter un oubli ?" },
];

export function ThresholdLab() {
  const { dataset, setDataset } = useLab();
  const [algo, setAlgo] = React.useState<AlgoId>("bayes");
  const [threshold, setThreshold] = React.useState(0.5);
  const [costRatio, setCostRatio] = React.useState(5);
  const [rule, setRule] = React.useState<ThresholdRule>("f1");

  const binary = dataset.classNames.length === 2;

  // Scores come from cross-validation, not from one held-out split: every point
  // gets a score from a model that never saw it, so the curves are drawn from
  // the whole dataset instead of from the forty-odd points a 70/30 split would
  // leave. The decision surface behind the plot is the model fitted on
  // everything, which is the model you would actually deploy.
  const { scored, field } = React.useMemo(() => {
    if (!binary || dataset.samples.length < 20) return { scored: [], field: null };
    const { model } = fitModel(algo, dataset.samples, 2, DEFAULT_PARAMS);
    return {
      scored: outOfFoldScores(algo, dataset.samples, 2, DEFAULT_PARAMS, 5, 909),
      field: computeField(model, dataset.domain, 88),
    };
  }, [algo, binary, dataset.samples, dataset.domain]);

  const points = React.useMemo(() => curvePoints(scored), [scored]);
  const m = React.useMemo(() => metricsAt(scored, threshold), [scored, threshold]);
  const aucValue = React.useMemo(() => auc(points), [points]);
  const auprcValue = React.useMemo(() => auprc(points), [points]);
  const positives = scored.filter((s) => s.label === 1).length;
  const baseRate = scored.length ? positives / scored.length : 0;

  const suggested = React.useMemo(
    () => (scored.length ? bestThreshold(scored, rule, costRatio) : 0.5),
    [scored, rule, costRatio],
  );

  // The model never changes here; only where we cut it. Keeping the fitted
  // model fixed while the threshold moves is the entire point of the page.
  const flaggedIds = React.useMemo(
    () => new Set(scored.filter((s) => s.score >= threshold).map((s) => s.id)),
    [scored, threshold],
  );
  const wrongIds = React.useMemo(
    () =>
      new Set(
        scored
          .filter((s) => (s.score >= threshold ? 1 : 0) !== s.label)
          .map((s) => s.id),
      ),
    [scored, threshold],
  );

  return (
    <PageShell
      eyebrow="Concepts"
      title="Le seuil de décision"
      lede={
        <>
          Toutes les autres pages coupent à 50 % sans le dire. Pourtant un modèle ne répond pas
          « oui », il répond « 0,63 » — et transformer ce nombre en décision est un choix{" "}
          <strong>séparé du modèle</strong>, qui dépend de ce que coûtent vos erreurs. Un test de
          dépistage et un filtre anti-spam peuvent partager le même modèle et ne doivent
          surtout pas couper au même endroit.
        </>
      }
      wide
    >
      {!binary && (
        <Callout kind="warning" title="Deux classes nécessaires">
          Un seuil sépare un « oui » d&apos;un « non ». Passez le dataset à 2 classes dans les
          contrôles pour que cette page ait un sens.
        </Callout>
      )}

      <Workbench
        plot={
          <div className="space-y-5">
            <Panel
              title="Où tombent les scores, et où vous coupez"
              subtitle="Glissez la ligne. Le modèle ne bouge pas — seule votre décision change."
              bodyClassName="p-4"
              exportName="seuil-scores"
            >
              <ScoreStrip
                scored={scored}
                threshold={threshold}
                onThreshold={setThreshold}
                classNames={dataset.classNames}
                height={200}
              />
              <p className="mt-2 text-[11px] leading-snug text-ink-muted">
                Chaque point a été noté par un modèle entraîné sans lui (validation croisée à 5
                plis). C&apos;est plus honnête qu&apos;un seul découpage — et ça donne assez de
                points pour que les courbes veuillent dire quelque chose.
              </p>
              <p className="mt-3 max-w-prose text-[12px] leading-relaxed text-ink-2">
                Si les deux histogrammes étaient séparés, il n&apos;y aurait aucune décision à
                prendre : n&apos;importe quelle coupure entre les deux ferait l&apos;affaire.
                Ils se chevauchent, et c&apos;est précisément dans ce chevauchement que vivent
                toutes les erreurs possibles. Déplacer la ligne ne les supprime pas — elle les{" "}
                <strong>échange</strong>.
              </p>
            </Panel>

            <div className="grid gap-5 lg:grid-cols-2">
              <Panel
                title="Les quatre issues"
                subtitle={`Sur les ${scored.length} points, chacun noté par un modèle qui ne l'avait pas vu`}
                bodyClassName="p-4"
              >
                <ConfusionBlocks m={m} classNames={dataset.classNames} />
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Stat
                    label={<G t="precision">Précision</G>}
                    value={formatPercent(m.precision, 0)}
                    hint="Parmi les signalés"
                  />
                  <Stat
                    label={<G t="rappel">Rappel</G>}
                    value={formatPercent(m.recall, 0)}
                    hint="Parmi les vrais"
                  />
                  <Stat label={<G t="f1">F1</G>} value={formatNumber(m.f1, 2)} />
                </div>
                <p className="mt-3 text-[11.5px] leading-snug text-ink-2">
                  Précision et rappel tirent dans des directions opposées :{" "}
                  <strong>baisser le seuil</strong> attrape plus de vrais cas (rappel ↑) au prix
                  de fausses alertes (précision ↓). Il n&apos;existe aucun réglage qui améliore
                  les deux — c&apos;est une propriété de la donnée, pas du modèle.
                </p>
              </Panel>

              <Panel
                title="Le nuage, au seuil courant"
                subtitle="Points cerclés : signalés positifs. Croix rouge : erreur."
                bodyClassName="p-3"
                action={<ClassLegend classNames={dataset.classNames} />}
              >
                <DataPlot
                  dataset={dataset}
                  onChange={setDataset}
                  mode="edit"
                  field={field}
                  aspect={1}
                  maxWidth={380}
                  styleFor={(s) => {
                    const style: { ring?: string; wrong?: boolean; dim?: boolean } = {};
                    if (wrongIds.has(s.id)) style.wrong = true;
                    if (flaggedIds.has(s.id)) style.ring = CHROME.ink;
                    else if (!wrongIds.has(s.id)) style.dim = true;
                    return style;
                  }}
                />
                <EditHints />
              </Panel>
            </div>

            <Panel
              title="Les deux courbes"
              subtitle="Chacune résume tous les seuils possibles d'un seul coup. Cliquez un point pour y aller."
              bodyClassName="p-4"
              exportName="seuil-courbes"
            >
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-[11px] font-medium text-ink-2">
                    ROC — rappel contre fausses alertes
                  </p>
                  <RocCurve
                    points={points}
                    current={m}
                    aucValue={aucValue}
                    onPick={setThreshold}
                    size={270}
                  />
                  <p className="mt-1.5 text-[11.5px] leading-snug text-ink-2">
                    Aire sous la courbe : <strong className="tnum">{aucValue.toFixed(3)}</strong>.
                    Elle se lit comme une probabilité : celle que le modèle donne un score plus
                    élevé à un vrai {dataset.classNames[1]} qu&apos;à un vrai{" "}
                    {dataset.classNames[0]} tirés au hasard. 0,5 = il n&apos;a rien appris.
                  </p>
                </div>
                <div>
                  <p className="mb-2 text-[11px] font-medium text-ink-2">
                    Précision – rappel
                  </p>
                  <PrCurve
                    points={points}
                    current={m}
                    baseline={baseRate}
                    onPick={setThreshold}
                    size={270}
                  />
                  <p className="mt-1.5 text-[11.5px] leading-snug text-ink-2">
                    Aire : <strong className="tnum">{auprcValue.toFixed(3)}</strong>, à comparer
                    au <span className="tnum">{formatPercent(baseRate, 0)}</span> du hasard.
                    C&apos;est cette courbe-là qu&apos;il faut regarder quand une classe est
                    rare : le ROC, lui, reste flatteur parce que les vrais négatifs, très
                    nombreux, écrasent le dénominateur des fausses alertes.
                  </p>
                </div>
              </div>
            </Panel>
          </div>
        }
        controls={
          <>
            <Slider
              label="Seuil de décision"
              value={threshold}
              min={0}
              max={1}
              step={0.01}
              onChange={setThreshold}
              format={(v) => v.toFixed(2)}
              hint="Au-dessus, le modèle répond « oui ». En dessous, « non »."
            />
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => setThreshold(0.5)}>
                Revenir à 0,50
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={() => setThreshold(suggested)}
              >
                Aller au seuil conseillé
              </Button>
            </div>

            <Divider label="Selon quel objectif ?" />
            <Segmented
              label="Règle de choix"
              value={rule}
              options={RULES.map((r) => ({ value: r.value, label: r.label }))}
              onChange={(v) => setRule(v as ThresholdRule)}
              size="sm"
            />
            <p className="rounded-md border border-line bg-surface-2/50 px-2.5 py-2 text-[11px] leading-snug text-ink-2">
              {RULES.find((r) => r.value === rule)!.why}
              <br />
              <span className="tnum text-ink">
                Seuil conseillé : {suggested.toFixed(2)}
              </span>
            </p>
            {rule === "cost" && (
              <Slider
                label="Un oubli coûte combien de fausses alertes ?"
                value={costRatio}
                min={1}
                max={30}
                step={1}
                onChange={setCostRatio}
                format={(v) => `${v} × `}
                hint="Dépistage d'un cancer : très élevé. Filtre anti-spam : faible — personne ne veut perdre un vrai courrier."
              />
            )}

            <Divider label="Modèle" />
            <Segmented
              label="Qui produit les scores"
              value={algo}
              options={MODELS.map((id) => ({ value: id, label: ALGOS[id].label }))}
              onChange={(v) => setAlgo(v as AlgoId)}
              size="sm"
            />
            <p className="text-[11px] leading-snug text-ink-muted">
              Changez de modèle : la courbe ROC bouge, parce que c&apos;est une propriété du
              modèle. Le seuil, lui, reste votre décision.
            </p>

            <Divider label="Données" />
            <DatasetControls shareParams={{ a: algo, t: threshold, cr: costRatio }} />

            <Divider label="Ce que ça change" />
            <Narrator
              causes={[
                { key: "t", label: "le seuil", value: threshold, format: (v) => Number(v).toFixed(2) },
                { key: "algo", label: "le modèle", value: algo },
              ]}
              effects={[
                {
                  key: "p",
                  label: "la précision",
                  value: m.precision,
                  format: (v) => formatPercent(v, 0),
                  epsilon: 0.005,
                },
                {
                  key: "r",
                  label: "le rappel",
                  value: m.recall,
                  format: (v) => formatPercent(v, 0),
                  epsilon: 0.005,
                },
                {
                  key: "fn",
                  label: "le nombre de cas manqués",
                  value: m.fn,
                  format: (v) => String(Math.round(v)),
                  better: "down",
                  epsilon: 0.5,
                },
              ]}
              placeholder="Glissez le seuil : ce qu'il échange contre quoi sera décrit ici."
            />
          </>
        }
        below={
          <>
            <div className="grid grid-cols-2 gap-2">
              <Stat label={<G t="accuracy">Accuracy</G>} value={formatPercent(m.accuracy)} />
              <Stat
                label="AUC"
                value={aucValue.toFixed(3)}
                tone={aucValue > 0.9 ? "good" : aucValue > 0.75 ? "neutral" : "warning"}
                hint="Indépendante du seuil"
              />
              <Stat
                label="Cas manqués"
                value={m.fn}
                tone={m.fn === 0 ? "good" : m.fn > m.tp ? "critical" : "warning"}
              />
              <Stat
                label="Fausses alertes"
                value={m.fp}
                tone={m.fp === 0 ? "good" : "neutral"}
              />
            </div>

            {baseRate < 0.3 && (
              <Callout kind="warning" title="Classe rare : l'accuracy ment">
                Les {dataset.classNames[1]} ne représentent que{" "}
                {formatPercent(baseRate, 0)} des points. Un modèle qui répondrait{" "}
                <em>toujours</em> « {dataset.classNames[0]} » afficherait déjà{" "}
                {formatPercent(1 - baseRate, 0)} d&apos;accuracy sans rien détecter du tout.
                C&apos;est la courbe précision–rappel qu&apos;il faut lire, pas le ROC ni
                l&apos;accuracy.
              </Callout>
            )}

            {m.fn === 0 && m.fp > 0 && (
              <Callout kind="insight" title="Vous ne manquez plus rien">
                Rappel de 100 % : aucun {dataset.classNames[1]} ne passe entre les mailles. Le
                prix est affiché juste à côté — {m.fp} fausses alertes. Selon le domaine,
                c&apos;est excellent ou inacceptable, et aucun calcul ne peut trancher à votre
                place.
              </Callout>
            )}

            <Panel title="Le même modèle, trois métiers" subtitle="Où couper, et pourquoi">
              <ul className="space-y-2 text-[12px] leading-relaxed text-ink-2">
                <li>
                  <strong>Dépistage médical.</strong> Un cas manqué peut tuer ; une fausse alerte
                  coûte un examen de contrôle. Seuil très bas, rappel proche de 100 %, et on
                  assume des centaines de fausses alertes.
                </li>
                <li>
                  <strong>Filtre anti-spam.</strong> Un spam qui passe est une nuisance ; un vrai
                  courrier classé en spam est une catastrophe. Seuil très haut, précision
                  maximale.
                </li>
                <li>
                  <strong>Détection de fraude bancaire.</strong> Chaque alerte occupe un analyste.
                  Le seuil se règle sur la <em>capacité de traitement</em> : combien de dossiers
                  par jour l&apos;équipe peut-elle examiner.
                </li>
              </ul>
            </Panel>
          </>
        }
      />

      <SectionTitle hint="La même idée, à trois niveaux de détail.">
        Un score n&apos;est pas une décision
      </SectionTitle>

      <Levels
        intuition={
          <>
            <p>
              Un détecteur de fumée a un réglage de sensibilité. Très sensible : il sonne pour
              une poêle un peu chaude, mais jamais un incendie ne lui échappera. Peu sensible :
              il ne sonne plus pour rien — et il pourrait rater un vrai départ de feu.
            </p>
            <p>
              Le détecteur ne change pas entre les deux réglages. Sa capacité à distinguer une
              vraie fumée d&apos;une vapeur de cuisine est la même. Ce qui change, c&apos;est
              l&apos;endroit où on décide de déclencher l&apos;alarme — et cet endroit ne se
              déduit d&apos;aucune mesure. Il se déduit de ce qui vous coûte le plus cher.
            </p>
            <p>
              C&apos;est exactement le seuil. Le modèle donne un degré de conviction ; vous
              décidez à partir de quand on agit. Deux équipes peuvent utiliser le même modèle et
              couper à deux endroits différents, et avoir toutes les deux raison.
            </p>
          </>
        }
        technique={
          <>
            <p>
              Un classifieur probabiliste sort <Tex>{String.raw`p(y = 1 \mid x)`}</Tex>. La
              règle « prédire 1 si <Tex>{String.raw`p \ge 0{,}5`}</Tex> » n&apos;a rien
              d&apos;obligatoire : c&apos;est celle qui minimise le nombre total d&apos;erreurs
              <em> quand les deux erreurs coûtent pareil</em>, ce qui est presque toujours faux.
            </p>
            <p>
              Faire varier le seuil de 1 à 0 engendre la courbe <strong>ROC</strong> (rappel
              contre taux de fausses alertes) et la courbe <strong>précision–rappel</strong>.
              Leurs aires — AUC et AUPRC — résument le modèle indépendamment du seuil, et
              servent donc à comparer des modèles ; elles ne disent rien sur la décision à
              prendre.
            </p>
            <p>
              Sur une classe rare, le ROC est trompeur : son axe des fausses alertes se divise
              par le nombre de vrais négatifs, énorme, donc quelques centaines de fausses
              alertes y paraissent négligeables. La courbe précision–rappel, elle, les compte au
              dénominateur de la précision et le montre immédiatement.
            </p>
          </>
        }
        maths={
          <>
            <p>
              Avec un coût <Tex>{String.raw`c_{\text{FN}}`}</Tex> pour un oubli et{" "}
              <Tex>{String.raw`c_{\text{FP}}`}</Tex> pour une fausse alerte, le coût espéré de
              répondre « positif » sur un point de probabilité <Tex>p</Tex> est{" "}
              <Tex>{String.raw`(1-p)\,c_{\text{FP}}`}</Tex>, et celui de répondre « négatif »{" "}
              <Tex>{String.raw`p\,c_{\text{FN}}`}</Tex>. On répond positif quand le premier est
              le plus petit, d&apos;où le seuil optimal :
            </p>
            <TexBlock>
              {String.raw`t^{*} = \frac{c_{\text{FP}}}{c_{\text{FP}} + c_{\text{FN}}}`}
            </TexBlock>
            <p>
              Coûts égaux : <Tex>{String.raw`t^{*} = 0{,}5`}</Tex>, et on retrouve la règle
              habituelle. Un oubli dix fois plus grave :{" "}
              <Tex>{String.raw`t^{*} = 1/11 \approx 0{,}09`}</Tex>. Le curseur « coût » de cette
              page applique exactement ce calcul.
            </p>
            <p>
              L&apos;AUC admet une lecture probabiliste exacte, qui est la seule à retenir :
            </p>
            <TexBlock>
              {String.raw`\mathrm{AUC} = \mathbb{P}\bigl(\,s(x^{+}) > s(x^{-})\,\bigr)`}
            </TexBlock>
            <p>
              pour un positif et un négatif tirés au hasard. Un modèle à 0,5 ne fait pas mieux
              que pile ou face ; un modèle à 1 range tous les positifs devant tous les négatifs
              — ce qui, notons-le, ne dit toujours pas où couper.
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
            id: "th1",
            question:
              "Vous baissez le seuil de 0,50 à 0,20. Qu'arrive-t-il à la précision et au rappel ?",
            options: [
              { id: "a", label: "Les deux augmentent" },
              { id: "b", label: "Le rappel augmente, la précision baisse" },
              { id: "c", label: "Les deux baissent" },
            ],
            answer: 1,
            explanation: (
              <>
                Un seuil plus bas signale davantage de points : on attrape plus de vrais cas
                (<G t="rappel">rappel</G> ↑) mais on ramasse aussi plus de faux
                (<G t="precision">précision</G> ↓). Les deux ne peuvent pas monter ensemble —
                le seul moyen d&apos;y parvenir serait un meilleur modèle, ce qui déplace la{" "}
                <em>courbe</em> et pas le point sur la courbe.
              </>
            ),
          },
          {
            id: "th2",
            question:
              "Un modèle a une AUC de 0,97 et, à 0,50, une précision de 12 %. Est-ce contradictoire ?",
            options: [
              { id: "a", label: "Oui, une AUC aussi haute impose une bonne précision" },
              {
                id: "b",
                label:
                  "Non : si la classe positive est très rare, même un excellent classement laisse beaucoup de négatifs au-dessus du seuil",
              },
              { id: "c", label: "Non, mais cela signifie que l'AUC est mal calculée" },
            ],
            answer: 1,
            explanation: (
              <>
                Avec 1 % de positifs, classer presque parfaitement laisse tout de même, parmi les
                points signalés, une majorité de négatifs — ils sont cent fois plus nombreux au
                départ. C&apos;est le piège classique de l&apos;AUC sur les classes rares, et
                c&apos;est pour ça que la courbe précision–rappel existe. Réglez le dataset sur
                « Déséquilibré » pour le voir.
              </>
            ),
          },
          {
            id: "th3",
            question:
              "Dans votre application, manquer un cas coûte 9 fois plus cher qu'une fausse alerte. Où couper ?",
            options: [
              { id: "a", label: "À 0,9" },
              { id: "b", label: "À 0,1" },
              { id: "c", label: "À 0,5, le seuil est indépendant des coûts" },
            ],
            answer: 1,
            explanation: (
              <>
                Le seuil qui minimise le coût espéré vaut{" "}
                <Tex>{String.raw`c_{\text{FP}} / (c_{\text{FP}} + c_{\text{FN}})`}</Tex>, soit{" "}
                <Tex>{String.raw`1/(1+9) = 0{,}1`}</Tex>. On signale dès 10 % de conviction,
                parce qu&apos;il vaut mieux neuf vérifications inutiles qu&apos;un oubli.
                Mettez la règle sur « Coût » et le curseur sur 9 : la page tombe sur la même
                valeur.
              </>
            ),
          },
        ]}
      />
    </PageShell>
  );
}
