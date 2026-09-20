"use client";

import * as React from "react";
import { Button } from "@/components/ui";
import { DATASET_SPECS } from "@/lib/ml/datasets";
import {
  decodeDatasetParams,
  encodeParams,
  readHashParams,
  shareUrl,
  type ShareValue,
} from "@/lib/permalink";
import { loadImported } from "@/lib/imported-store";
import { useLab } from "@/store/lab";

const VALID_KINDS = DATASET_SPECS.map((s) => s.id);

/**
 * "Copy a link that reproduces exactly this."
 *
 * Every page of this site is a configured experiment, and an experiment that
 * cannot be handed to someone else is half an experiment. The button writes the
 * current settings into the URL fragment and copies the result, so a teacher
 * can send "look at what K = 1 does here" rather than a list of instructions.
 */
export function ShareLink({
  params = {},
  label = "Copier le lien de cette configuration",
}: {
  /** Page-specific settings to include alongside the dataset. */
  params?: Record<string, ShareValue>;
  label?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const { kind, n, noise, seed, nClasses, trainRatio } = useLab();

  React.useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2200);
    return () => clearTimeout(id);
  }, [copied]);

  const onClick = async () => {
    const hash = encodeParams({ kind, n, noise, seed, nClasses, trainRatio }, params);
    // The fragment is updated whether or not the clipboard works, so the reader
    // can always copy from the address bar themselves.
    window.history.replaceState(null, "", `#${hash}`);
    const url = shareUrl(hash);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div>
      <Button onClick={onClick} className="w-full" size="sm">
        {copied ? "Lien copié ✓" : label}
      </Button>
      <p className="mt-1 text-[10.5px] leading-snug text-ink-muted">
        {copied
          ? "Collez-le où vous voulez : il rouvrira cette page avec exactement ces réglages."
          : "L'adresse de la page est mise à jour ; elle contient tous les réglages actuels."}
      </p>
    </div>
  );
}

/**
 * Restore the dataset from the URL fragment, once, on first paint.
 *
 * Mounted at the shell level so every page benefits, including those without
 * dataset controls. It deliberately does nothing after that first read: a
 * reader who then moves a slider is exploring, not navigating, and having the
 * page snap back to the link's values would be maddening.
 */
export function PermalinkLoader() {
  const applyParams = useLab((s) => s.applyParams);
  const adoptImported = useLab((s) => s.adoptImported);
  const done = React.useRef(false);

  React.useEffect(() => {
    if (done.current) return;
    done.current = true;
    const patch = decodeDatasetParams(readHashParams(), VALID_KINDS);
    if (Object.keys(patch).length) {
      // A link's settings win over a stored import: following a link is an
      // explicit request for that configuration, and silently substituting the
      // reader's own file would show them something the sender never saw.
      applyParams(patch);
      return;
    }
    const stored = loadImported();
    if (stored) adoptImported(stored);
  }, [applyParams, adoptImported]);

  return null;
}
