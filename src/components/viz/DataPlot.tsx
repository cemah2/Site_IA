"use client";

import * as React from "react";
import type { Dataset, Field, Sample } from "@/lib/ml/types";
import { movePoint, relabelPoint, withoutPoint, withPoint } from "@/lib/ml/datasets";
import { formatNumber } from "@/lib/viz/geometry";
import { CHROME } from "@/lib/viz/palette";
import { plotInteraction } from "@/lib/viz/interaction";
import { DecisionField } from "./DecisionField";
import { Plot, localPoint, type PlotFrame } from "./Plot";
import { Points, type PointStyle } from "./Points";
import { PlotTooltip } from "./Tooltip";
import { ClassMark } from "./Legend";

export type EditMode = "off" | "edit";

/**
 * The dataset plot used across the whole site.
 *
 * Direct manipulation is the point: a learner who *drags a point across the
 * boundary and watches the model respond* understands the model's sensitivity
 * in a way no amount of prose achieves. So the interaction vocabulary is kept
 * small and uniform everywhere:
 *
 *   drag a point            move it
 *   click empty space       add a point of the brush class
 *   shift-click a point     cycle its class
 *   alt-click / right-click delete it
 *
 * Pages that are not about editing (comparison grids, small multiples) pass
 * `mode="off"` and get the same rendering with no interaction at all.
 */
export function DataPlot({
  dataset,
  onChange,
  field,
  mode = "off",
  brushClass = 0,
  styleFor,
  overlay,
  topOverlay,
  onQuery,
  aspect = 1,
  className,
  showConfidence = true,
  showBoundary = true,
  fieldOpacity = 1,
  pointRadius = 4.5,
  ariaLabel,
  extraTooltip,
  maxWidth = 620,
}: {
  dataset: Dataset;
  onChange?: (d: Dataset) => void;
  field?: Field | null;
  mode?: EditMode;
  brushClass?: number;
  styleFor?: (s: Sample) => PointStyle | undefined;
  /** Drawn above the decision field, below the points. */
  overlay?: (frame: PlotFrame) => React.ReactNode;
  /** Drawn above everything — annotations, labels, the query marker. */
  topOverlay?: (frame: PlotFrame) => React.ReactNode;
  /** Click anywhere to place a probe point (KNN, Naive Bayes, tree walkthrough). */
  onQuery?: (x: number, y: number) => void;
  aspect?: number;
  className?: string;
  showConfidence?: boolean;
  showBoundary?: boolean;
  fieldOpacity?: number;
  pointRadius?: number;
  ariaLabel?: string;
  extraTooltip?: (s: Sample) => React.ReactNode;
  /** Passed through to <Plot>. Default keeps square plots a sane size. */
  maxWidth?: number;
}) {
  const [hover, setHover] = React.useState<Sample | null>(null);
  const [cursor, setCursor] = React.useState<[number, number] | null>(null);
  const dragRef = React.useRef<{ id: number; moved: boolean } | null>(null);
  const editable = mode === "edit" && Boolean(onChange);

  /**
   * Keyboard operation.
   *
   * The whole premise of this site is that you learn by moving the data, and
   * until now that was possible only with a pointer — which locked out anyone
   * who does not use one, from the central interaction rather than from a
   * detail. The vocabulary mirrors the mouse exactly: a cursor you move, a
   * grab, a class cycle, a delete.
   */
  const [keyCursor, setKeyCursor] = React.useState<[number, number] | null>(null);
  const [grabbed, setGrabbed] = React.useState<number | null>(null);
  const [announcement, setAnnounce] = React.useState("");
  const interactive = editable || Boolean(onQuery);

  const nearestTo = React.useCallback(
    (x: number, y: number): Sample | null => {
      let best: Sample | null = null;
      let bestD = Infinity;
      const spanX = dataset.domain[0][1] - dataset.domain[0][0];
      const spanY = dataset.domain[1][1] - dataset.domain[1][0];
      for (const s of dataset.samples) {
        const dx = (s.x[0] - x) / spanX;
        const dy = (s.x[1] - y) / spanY;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = s;
        }
      }
      // Within 2.5 % of the plot's width counts as "on" a point. Measured
      // reason for the tightness: with 160 points a 4 % radius covers nearly
      // the whole plot, and "add a point" became unreachable by keyboard.
      return best && bestD <= 0.025 * 0.025 ? best : null;
    },
    [dataset],
  );

  const handlePointerDownPoint = (s: Sample, e: React.PointerEvent) => {
    if (!editable || !onChange) return;
    e.stopPropagation();
    if (e.altKey || e.button === 2) {
      onChange(withoutPoint(dataset, s.id));
      return;
    }
    if (e.shiftKey) {
      onChange(relabelPoint(dataset, s.id, (s.y + 1) % dataset.classNames.length));
      return;
    }
    dragRef.current = { id: s.id, moved: false };
    plotInteraction.begin();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };

  const handleMove = (e: React.PointerEvent<SVGSVGElement>, frame: PlotFrame) => {
    const [px, py] = localPoint(e);
    setCursor([px, py]);
    const drag = dragRef.current;
    if (!drag || !onChange) return;
    const [dx, dy] = frame.data(px, py);
    dragRef.current = { ...drag, moved: true };
    onChange(movePoint(dataset, drag.id, clamp(dx, frame.sx.domain), clamp(dy, frame.sy.domain)));
  };

  const handleUp = (e: React.PointerEvent<SVGSVGElement>, frame: PlotFrame) => {
    const wasDragging = dragRef.current;
    if (wasDragging) plotInteraction.end();
    dragRef.current = null;
    if (wasDragging) return;

    const [px, py] = localPoint(e);
    if (
      px < frame.inner.x ||
      px > frame.inner.x + frame.inner.w ||
      py < frame.inner.y ||
      py > frame.inner.y + frame.inner.h
    ) {
      return;
    }
    const [dx, dy] = frame.data(px, py);

    if (onQuery) {
      onQuery(dx, dy);
      return;
    }
    if (editable && onChange) onChange(withPoint(dataset, dx, dy, brushClass));
  };

  // What Enter would do right now, so the cursor can show it and a screen
  // reader can be told. Derived during render rather than pushed into state
  // from an effect: it is a function of where the cursor is, nothing more.
  const underCursor = keyCursor ? nearestTo(keyCursor[0], keyCursor[1]) : null;
  const underId = underCursor?.id ?? null;
  const positionHint =
    keyCursor === null || !interactive
      ? ""
      : underCursor
        ? `Sur un point de classe ${dataset.classNames[underCursor.y] ?? underCursor.y}. Entrée le saisit.`
        : editable
          ? `Espace libre. Entrée ajoute un point ici.${onQuery ? " La touche t y place le point de test." : ""}`
          : "Entrée place le point de test ici.";

  const handleKey = (e: React.KeyboardEvent<SVGSVGElement>) => {
    if (!interactive) return;
    const [xLo, xHi] = dataset.domain[0];
    const [yLo, yHi] = dataset.domain[1];
    const current: [number, number] = keyCursor ?? [(xLo + xHi) / 2, (yLo + yHi) / 2];
    // A twentieth of the plot per press, a hundredth with Shift for fine work.
    const stepX = (xHi - xLo) * (e.shiftKey ? 0.01 : 0.05);
    const stepY = (yHi - yLo) * (e.shiftKey ? 0.01 : 0.05);
    // Moving clears the last action message so the positional hint is heard.
    const move = (dx: number, dy: number) => {
      setAnnounce("");
      const next: [number, number] = [
        clamp(current[0] + dx, [xLo, xHi]),
        clamp(current[1] + dy, [yLo, yHi]),
      ];
      setKeyCursor(next);
      if (grabbed !== null && onChange) onChange(movePoint(dataset, grabbed, next[0], next[1]));
      return next;
    };

    switch (e.key) {
      case "ArrowLeft": e.preventDefault(); move(-stepX, 0); return;
      case "ArrowRight": e.preventDefault(); move(stepX, 0); return;
      case "ArrowUp": e.preventDefault(); move(0, stepY); return;
      case "ArrowDown": e.preventDefault(); move(0, -stepY); return;
      default: break;
    }

    const under = nearestTo(current[0], current[1]);

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!editable || !onChange) {
        if (onQuery) {
          onQuery(current[0], current[1]);
          setKeyCursor(current);
          setAnnounce(`Point de test placé en ${formatNumber(current[0])}, ${formatNumber(current[1])}.`);
        }
        return;
      }
      if (grabbed !== null) {
        setGrabbed(null);
        setAnnounce("Point reposé.");
      } else if (under) {
        setGrabbed(under.id);
        setKeyCursor([under.x[0], under.x[1]]);
        setAnnounce(`Point saisi. Les flèches le déplacent, Entrée le repose.`);
      } else {
        onChange(withPoint(dataset, current[0], current[1], brushClass));
        setKeyCursor(current);
        setAnnounce(`Point ajouté, classe ${dataset.classNames[brushClass] ?? brushClass}.`);
      }
      return;
    }

    // On pages that both edit and probe, Enter belongs to the edit vocabulary
    // and the probe gets its own key — otherwise the page's main interaction
    // (moving the point being classified) has no keyboard route at all.
    if ((e.key === "t" || e.key === "T") && onQuery) {
      e.preventDefault();
      onQuery(current[0], current[1]);
      setKeyCursor(current);
      setAnnounce(
        `Point de test placé en ${formatNumber(current[0])}, ${formatNumber(current[1])}.`,
      );
      return;
    }

    if (e.key === "Escape" && grabbed !== null) {
      e.preventDefault();
      setGrabbed(null);
      setAnnounce("Déplacement abandonné.");
      return;
    }

    if (!editable || !onChange) return;

    if ((e.key === "c" || e.key === "C") && under) {
      e.preventDefault();
      const next = (under.y + 1) % dataset.classNames.length;
      onChange(relabelPoint(dataset, under.id, next));
      setAnnounce(`Classe changée en ${dataset.classNames[next] ?? next}.`);
      return;
    }

    if ((e.key === "Delete" || e.key === "Backspace") && under) {
      e.preventDefault();
      onChange(withoutPoint(dataset, under.id));
      setGrabbed(null);
      setAnnounce("Point supprimé.");
    }
  };

  return (
    <div className={className} style={{ position: "relative" }}>
      {interactive && (
        <p aria-live="polite" className="sr-only">
          {announcement || positionHint}
        </p>
      )}
      <Plot
        xDomain={dataset.domain[0]}
        yDomain={dataset.domain[1]}
        aspect={aspect}
        maxWidth={maxWidth}
        xLabel={dataset.featureNames[0]}
        yLabel={dataset.featureNames[1]}
        cursor={onQuery ? "crosshair" : editable ? "crosshair" : "default"}
        ariaLabel={
          ariaLabel ??
          `Nuage de ${dataset.samples.length} points, ${dataset.classNames.length} classes`
        }
        focusable={interactive}
        onKeyDown={handleKey}
        onFocus={() =>
          setKeyCursor((c) =>
            c ?? [
              (dataset.domain[0][0] + dataset.domain[0][1]) / 2,
              (dataset.domain[1][0] + dataset.domain[1][1]) / 2,
            ],
          )
        }
        onBlur={() => setGrabbed(null)}
        ariaDescription={
          interactive
            ? `Graphique manipulable au clavier. Flèches pour déplacer le curseur, Maj pour un pas fin. ${
                editable
                  ? "Entrée saisit le point sous le curseur ou en ajoute un, c change sa classe, Suppr le supprime, Échap abandonne."
                  : "Entrée place le point de test."
              }`
            : undefined
        }
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerLeave={() => {
          setCursor(null);
          setHover(null);
          if (dragRef.current) plotInteraction.end();
          dragRef.current = null;
        }}
        onContextMenu={(e) => {
          if (editable) e.preventDefault();
        }}
      >
        {(frame) => (
          <>
            <DecisionField
              field={field ?? null}
              opacity={fieldOpacity}
              showConfidence={showConfidence}
              showBoundary={showBoundary}
            />
            {overlay?.(frame)}
            <Points
              samples={dataset.samples}
              radius={pointRadius}
              styleFor={styleFor}
              onHover={setHover}
              onPointerDownPoint={editable ? handlePointerDownPoint : undefined}
              interactive={editable}
            />
            {topOverlay?.(frame)}
            {keyCursor && (
              <g aria-hidden pointerEvents="none">
                {/* Solid when Enter would act on a point, dashed over empty
                    space: the shape says what the key will do. */}
                <circle
                  cx={frame.px(keyCursor[0], keyCursor[1])[0]}
                  cy={frame.px(keyCursor[0], keyCursor[1])[1]}
                  r={grabbed !== null ? 11 : underId !== null ? 9 : 7}
                  fill="none"
                  stroke={CHROME.ink}
                  strokeWidth={grabbed !== null ? 2 : 1.5}
                  strokeDasharray={grabbed !== null || underId !== null ? undefined : "3 3"}
                />
                <path
                  d={`M${frame.px(keyCursor[0], keyCursor[1])[0] - 14},${frame.px(keyCursor[0], keyCursor[1])[1]}h6M${frame.px(keyCursor[0], keyCursor[1])[0] + 8},${frame.px(keyCursor[0], keyCursor[1])[1]}h6M${frame.px(keyCursor[0], keyCursor[1])[0]},${frame.px(keyCursor[0], keyCursor[1])[1] - 14}v6M${frame.px(keyCursor[0], keyCursor[1])[0]},${frame.px(keyCursor[0], keyCursor[1])[1] + 8}v6`}
                  stroke={CHROME.ink}
                  strokeWidth={1.5}
                />
              </g>
            )}
          </>
        )}
      </Plot>

      {hover && cursor && (
        <PlotTooltip x={cursor[0]} y={cursor[1]} width={999} height={999}>
          <div className="flex items-center gap-1.5 font-semibold">
            <ClassMark index={hover.y} />
            Classe {dataset.classNames[hover.y] ?? "?"}
          </div>
          <div className="tnum mt-1 text-ink-2">
            {dataset.featureNames[0]} = {formatNumber(hover.x[0])}
            <br />
            {dataset.featureNames[1]} = {formatNumber(hover.x[1])}
          </div>
          {extraTooltip?.(hover)}
        </PlotTooltip>
      )}
    </div>
  );
}

function clamp(v: number, [lo, hi]: [number, number]): number {
  return Math.min(hi, Math.max(lo, v));
}

/** The interaction cheat-sheet shown under editable plots. */
export function EditHints() {
  return (
    <div className="mt-2 space-y-1 text-[11px] leading-relaxed text-ink-muted">
      <p>
        <Kbd>Glisser</Kbd> déplacer un point · <Kbd>Clic</Kbd> ajouter ·{" "}
        <Kbd>Maj + clic</Kbd> changer de classe · <Kbd>Alt + clic</Kbd> supprimer
      </p>
      <p>
        Au clavier : <Kbd>Tab</Kbd> pour entrer dans le graphique, <Kbd>←↑↓→</Kbd> pour bouger
        le curseur, <Kbd>Entrée</Kbd> pour saisir ou ajouter, <Kbd>c</Kbd> pour changer de
        classe, <Kbd>Suppr</Kbd> pour supprimer, <Kbd>t</Kbd> pour placer le point de test.
      </p>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="rounded border border-line bg-surface-2 px-1 py-px font-medium"
      style={{ color: CHROME.ink2 }}
    >
      {children}
    </span>
  );
}
