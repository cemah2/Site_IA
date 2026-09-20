"use client";

import * as React from "react";
import { Button, Divider, Segmented, Select, Slider } from "@/components/ui";
import { DATASET_SPECS, type DatasetId } from "@/lib/ml/datasets";
import { useLab } from "@/store/lab";
import { ShareLink } from "./ShareLink";
import type { ShareValue } from "@/lib/permalink";

/**
 * The dataset controls, identical on every page.
 *
 * Deliberately the same widget everywhere, bound to the same store: the learner
 * learns the controls once, and the problem they set up on one page is the
 * problem every other page inherits.
 */
export function DatasetControls({
  showClasses = true,
  showCount = true,
  compact = false,
  shareParams,
}: {
  showClasses?: boolean;
  showCount?: boolean;
  compact?: boolean;
  /** Page settings to include in the shareable link, beside the dataset. */
  shareParams?: Record<string, ShareValue>;
}) {
  const { kind, setKind, n, setN, noise, setNoise, nClasses, setNClasses, reseed, imported, clearImported } =
    useLab();
  const spec = DATASET_SPECS.find((s) => s.id === kind)!;

  // When the reader has imported a file, the generator controls would silently
  // throw it away on the first touch. Saying so, and offering the way back, is
  // the difference between a feature and a trap.
  if (imported) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-accent/35 bg-accent/[0.06] px-3 py-2.5">
          <p className="text-[12px] font-medium text-ink">Vos données</p>
          <p className="mt-0.5 text-[11px] leading-snug text-ink-2">
            {imported.name} · {imported.samples.length} points ·{" "}
            {imported.classNames.length} classes ({imported.classNames.join(", ")})
          </p>
          <p className="mt-1 text-[10.5px] leading-snug text-ink-muted">
            {imported.featureNames[0]} en abscisse, {imported.featureNames[1]} en ordonnée.
          </p>
        </div>
        <Button onClick={clearImported} className="w-full">
          Revenir aux données générées
        </Button>
        <a
          href="/donnees/vos-donnees/"
          className="block text-center text-[11px] text-accent hover:underline"
        >
          Changer de colonnes ou de fichier →
        </a>
        <ShareLink params={shareParams} label="Copier le lien de cette configuration" />
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      <Select
        label="Dataset"
        value={kind}
        options={DATASET_SPECS.map((s) => ({ value: s.id, label: s.label }))}
        onChange={(v) => setKind(v as DatasetId)}
        hint={spec.teaches}
      />

      {showCount && (
        <Slider label="Nombre de points" value={n} min={20} max={400} step={10} onChange={setN} />
      )}

      <Slider
        label="Bruit"
        value={noise}
        min={0}
        max={0.6}
        step={0.02}
        onChange={setNoise}
        format={(v) => v.toFixed(2)}
      />

      {showClasses && !spec.fixedClasses && (
        <Segmented
          label="Nombre de classes"
          value={String(nClasses)}
          options={[2, 3, 4, 5]
            .filter((c) => c <= (spec.maxClasses ?? 5))
            .map((c) => ({ value: String(c), label: String(c) }))}
          onChange={(v) => setNClasses(Number(v))}
          size="sm"
        />
      )}

      {!compact && <Divider />}
      <Button onClick={reseed} className="w-full">
        Regénérer les données
      </Button>
      <ShareLink
        params={shareParams}
        label={
          shareParams ? "Copier le lien de cette configuration" : "Copier le lien de ce jeu de données"
        }
      />
    </div>
  );
}
