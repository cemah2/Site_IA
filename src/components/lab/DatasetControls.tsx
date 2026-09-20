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
  const { kind, setKind, n, setN, noise, setNoise, nClasses, setNClasses, reseed } = useLab();
  const spec = DATASET_SPECS.find((s) => s.id === kind)!;

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
