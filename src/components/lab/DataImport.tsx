"use client";

import * as React from "react";
import { Button, Callout, Panel, Select, Slider, Stat, Toggle } from "@/components/ui";
import { buildDataset, parseCsv, summarise, type ColumnSummary, type ParsedTable } from "@/lib/ml/csv";
import { formatNumber } from "@/lib/viz/geometry";
import { useLab } from "@/store/lab";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Files shipped with the site, loaded through exactly the same path as an upload. */
const SAMPLES = [
  {
    file: "iris.csv",
    label: "Iris",
    blurb:
      "150 fleurs, 3 espèces, 4 mesures. Le jeu de données le plus utilisé de l'histoire de la discipline, publié en 1936.",
    source: "R. A. Fisher, 1936 — domaine public",
  },
  {
    file: "penguins.csv",
    label: "Manchots de Palmer",
    blurb:
      "344 manchots de l'Antarctique, 3 espèces, mesures de bec et de nageoires. Deux lignes ont des valeurs manquantes, ce qui est réaliste.",
    source: "Horst, Hill & Gorman, palmerpenguins — CC0",
  },
];

interface Loaded {
  name: string;
  table: ParsedTable;
  columns: ColumnSummary[];
}

/**
 * Bring your own data.
 *
 * The file never leaves the machine — there is no server to send it to, the
 * whole site is static files — and that is worth saying out loud, because the
 * people most likely to have an interesting spreadsheet are also the ones least
 * likely to upload it somewhere.
 *
 * The column mapping is the part that decides whether this is usable at all.
 * Every real table has more than two numeric columns, so the question is not
 * "can you read my file" but "which two of my columns should I look at" — and
 * the page answers it by ranking the pairs rather than leaving the reader to
 * guess.
 */
export function DataImport() {
  const { adoptImported, imported, clearImported } = useLab();
  const [loaded, setLoaded] = React.useState<Loaded | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [xCol, setXCol] = React.useState(0);
  const [yCol, setYCol] = React.useState(1);
  const [labelCol, setLabelCol] = React.useState(-1);
  const [standardise, setStandardise] = React.useState(false);
  const [maxPoints, setMaxPoints] = React.useState(600);
  const [dragOver, setDragOver] = React.useState(false);

  const adopt = React.useCallback(
    (name: string, text: string) => {
      try {
        const table = parseCsv(text);
        if (!table.rows.length || table.columns.length < 2) {
          setError("Le fichier ne contient pas au moins deux colonnes et une ligne de données.");
          return;
        }
        const columns = summarise(table);
        const numeric = columns.filter((c) => c.numeric);
        if (numeric.length < 2) {
          setError(
            `Il faut au moins deux colonnes de nombres. Colonnes lues : ${columns.map((c) => c.name).join(", ")}.`,
          );
          return;
        }
        // A sensible first guess: the two most informative numeric columns and
        // the categorical column with the fewest distinct values.
        const label = columns
          .filter((c) => !c.numeric && c.distinct.length >= 2 && c.distinct.length <= 8)
          .sort((a, b) => a.distinct.length - b.distinct.length)[0];
        setXCol(numeric[0].index);
        setYCol(numeric[1].index);
        setLabelCol(label ? label.index : -1);
        setLoaded({ name, table, columns });
        setError(null);
      } catch {
        setError("Le fichier n'a pas pu être lu. Est-ce bien un CSV ?");
      }
    },
    [],
  );

  const onFile = React.useCallback(
    async (file: File) => {
      setBusy(true);
      try {
        if (file.size > 8 * 1024 * 1024) {
          setError("Fichier trop gros (plus de 8 Mo). Exportez un extrait.");
          return;
        }
        adopt(file.name.replace(/\.[^.]+$/, ""), await file.text());
      } finally {
        setBusy(false);
      }
    },
    [adopt],
  );

  const loadSample = React.useCallback(
    async (file: string, label: string) => {
      setBusy(true);
      try {
        const res = await fetch(`${BASE}/data/${file}`);
        if (!res.ok) throw new Error();
        adopt(label, await res.text());
      } catch {
        setError("Le jeu d'exemple n'a pas pu être chargé.");
      } finally {
        setBusy(false);
      }
    },
    [adopt],
  );

  const built = React.useMemo(() => {
    if (!loaded) return null;
    return buildDataset(
      loaded.table,
      { x: xCol, y: yCol, label: labelCol },
      loaded.name,
      { maxPoints, standardise },
    );
  }, [loaded, xCol, yCol, labelCol, maxPoints, standardise]);

  // Which pairs of columns separate the classes best, by a one-dimensional
  // separability score per axis. Cheap, and enough to stop the reader from
  // staring at two columns that happen to be alphabetically first.
  const ranking = React.useMemo(() => {
    if (!loaded || labelCol < 0) return [];
    const numeric = loaded.columns.filter((c) => c.numeric);
    const dc = loaded.table.decimalComma;
    const score = (idx: number): number => {
      const byClass = new Map<string, number[]>();
      for (const row of loaded.table.rows) {
        const v = Number(dc ? (row[idx] ?? "").replace(",", ".") : row[idx]);
        if (!Number.isFinite(v)) continue;
        const k = (row[labelCol] ?? "").trim();
        const b = byClass.get(k);
        if (b) b.push(v);
        else byClass.set(k, [v]);
      }
      const groups = [...byClass.values()].filter((g) => g.length > 1);
      if (groups.length < 2) return 0;
      const means = groups.map((g) => g.reduce((a, b) => a + b, 0) / g.length);
      const vars = groups.map(
        (g, i) => g.reduce((a, b) => a + (b - means[i]) ** 2, 0) / g.length,
      );
      const grand = means.reduce((a, b) => a + b, 0) / means.length;
      const between = means.reduce((a, m) => a + (m - grand) ** 2, 0) / means.length;
      const within = vars.reduce((a, b) => a + b, 0) / vars.length || 1e-9;
      return between / within;
    };
    const scored = numeric.map((c) => ({ c, s: score(c.index) })).sort((a, b) => b.s - a.s);
    return scored.slice(0, 4);
  }, [loaded, labelCol]);

  const columnOptions = (includeNone: boolean) => [
    ...(includeNone ? [{ value: "-1", label: "— aucune (une seule classe) —" }] : []),
    ...(loaded?.columns ?? []).map((c) => ({
      value: String(c.index),
      label: `${c.name}${c.numeric ? "" : " (texte)"}`,
    })),
  ];

  return (
    <div className="space-y-5">
      <Panel title="Votre fichier" subtitle="CSV, jusqu'à 8 Mo. Il ne quitte pas votre ordinateur.">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void onFile(file);
          }}
          className={`rounded-xl border-2 border-dashed px-5 py-8 text-center transition-colors ${
            dragOver ? "border-accent bg-accent/[0.06]" : "border-line"
          }`}
        >
          <p className="text-[13px] text-ink-2">
            Glissez un fichier CSV ici, ou
          </p>
          <label className="mt-2 inline-block cursor-pointer rounded-md border border-accent/50 bg-accent/15 px-3 py-1.5 text-[13px] font-medium text-accent transition-colors hover:bg-accent/25">
            Choisir un fichier
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onFile(file);
              }}
            />
          </label>
          <p className="mt-3 text-[11px] leading-snug text-ink-muted">
            Les exports Excel français sont acceptés tels quels : point-virgules, virgules
            décimales, accents.
          </p>
        </div>

        <div className="mt-4 border-t border-line pt-4">
          <p className="mb-2 text-[11px] font-medium text-ink-2">
            Ou essayez avec de vraies données, déjà prêtes
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {SAMPLES.map((s) => (
              <button
                key={s.file}
                onClick={() => void loadSample(s.file, s.label)}
                disabled={busy}
                className="rounded-lg border border-line bg-surface-2/60 px-3 py-2.5 text-left transition-colors hover:border-line-strong disabled:opacity-50"
              >
                <span className="block text-[13px] font-medium text-ink">{s.label}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-ink-2">{s.blurb}</span>
                <span className="mt-1 block text-[10px] text-ink-muted">{s.source}</span>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <Callout kind="critical" title="Fichier non exploitable">
            {error}
          </Callout>
        )}
      </Panel>

      {loaded && built && (
        <>
          <Panel
            title="Quelles colonnes regarder"
            subtitle={`${loaded.table.rows.length} lignes lues, ${loaded.columns.length} colonnes — le site en dessine deux à la fois`}
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <Select
                label="Axe horizontal"
                value={String(xCol)}
                options={columnOptions(false)}
                onChange={(v) => setXCol(Number(v))}
              />
              <Select
                label="Axe vertical"
                value={String(yCol)}
                options={columnOptions(false)}
                onChange={(v) => setYCol(Number(v))}
              />
              <Select
                label="Colonne des classes"
                value={String(labelCol)}
                options={columnOptions(true)}
                onChange={(v) => setLabelCol(Number(v))}
              />
            </div>

            {ranking.length > 1 && (
              <div className="mt-4 rounded-lg border border-line bg-surface-2/50 p-3">
                <p className="mb-2 text-[11px] font-medium text-ink-2">
                  Les colonnes qui séparent le mieux vos classes
                </p>
                <div className="flex flex-wrap gap-2">
                  {ranking.map((r, i) => (
                    <button
                      key={r.c.index}
                      onClick={() => (i === 0 ? setXCol(r.c.index) : setYCol(r.c.index))}
                      className="rounded-md border border-line bg-surface-3/60 px-2.5 py-1.5 text-left text-[11px] transition-colors hover:border-line-strong"
                    >
                      <span className="block font-medium text-ink">{r.c.name}</span>
                      <span className="tnum block text-[10px] text-ink-muted">
                        pouvoir séparateur {formatNumber(r.s, 2)}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[10.5px] leading-snug text-ink-muted">
                  Rapport de la variance entre classes sur la variance à l&apos;intérieur des
                  classes, colonne par colonne. Plus c&apos;est élevé, plus cette mesure à elle
                  seule distingue vos groupes. Cliquez pour l&apos;envoyer sur un axe.
                </p>
              </div>
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Slider
                label="Points conservés"
                value={maxPoints}
                min={50}
                max={1500}
                step={50}
                onChange={setMaxPoints}
                hint="Échantillon stratifié. Au-delà d'un millier, le SVM garde une matrice de n × n nombres et le nuage devient lourd à manipuler."
              />
              <Toggle
                label="Mettre les deux axes à la même échelle"
                checked={standardise}
                onChange={setStandardise}
                hint="À activer si vos colonnes n'ont pas le même ordre de grandeur — sinon KNN et le SVM ne verront que la plus grande."
              />
            </div>
          </Panel>

          <Panel title="Ce que le site recevra" subtitle="Vérifiez avant d'adopter">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Points" value={built.dataset.samples.length} />
              <Stat label="Classes" value={built.dataset.classNames.length} />
              <Stat
                label="Lignes écartées"
                value={built.droppedRows}
                tone={built.droppedRows > built.totalRows * 0.2 ? "warning" : "neutral"}
                hint="Valeurs manquantes"
              />
              <Stat
                label="Sur un total de"
                value={built.totalRows}
                hint={built.totalRows > built.dataset.samples.length ? "échantillonné" : "tout gardé"}
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {built.dataset.classNames.map((c, i) => (
                <span
                  key={c}
                  className="rounded-md border border-line bg-surface-2/60 px-2 py-1 text-[11px] text-ink-2"
                >
                  {c}
                  <span className="tnum ml-1.5 text-ink-muted">
                    {built.dataset.samples.filter((s) => s.y === i).length}
                  </span>
                </span>
              ))}
            </div>

            {built.mergedClasses.length > 0 && (
              <Callout kind="warning" title="Classes en trop">
                Le site dessine au plus cinq classes — au-delà, les couleurs ne sont plus
                distinguables pour un lecteur daltonien. Ces valeurs ont été écartées :{" "}
                {built.mergedClasses.join(", ")}. Regroupez-les dans votre fichier si elles
                comptent.
              </Callout>
            )}

            {built.dataset.samples.length < 20 && (
              <Callout kind="warning" title="Très peu de points">
                {built.dataset.samples.length} points, c&apos;est trop peu pour que les mesures
                du site veuillent dire quoi que ce soit. Vérifiez la colonne des classes et le
                format des nombres.
              </Callout>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="primary"
                onClick={() => adoptImported(built.dataset)}
                disabled={built.dataset.samples.length < 10}
              >
                Utiliser ces données sur tout le site
              </Button>
              {imported && (
                <Button variant="ghost" onClick={clearImported}>
                  Revenir aux données générées
                </Button>
              )}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
