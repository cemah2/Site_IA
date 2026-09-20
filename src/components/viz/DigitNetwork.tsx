"use client";

import * as React from "react";
import { cx } from "@/lib/cx";
import { DIGIT_PIXELS, DIGIT_SIZE } from "@/lib/ml/digits";
import { CHROME, DIVERGING, rampAt, SEQUENTIAL, STATUS, toRgbTriple } from "@/lib/viz/palette";

/**
 * The three things a classifier's answer is made of, drawn separately.
 *
 * A single "it says 7" is a magic trick. Ten probabilities, the hidden layer
 * that produced them, and the weight images that decide what the hidden layer
 * reacts to, together make it an explanation.
 */

/**
 * A softmax output is never exactly 0 or 1, and rounding it to those is a small
 * lie a beginner will take literally. Clamp the display instead.
 */
export function formatProbability(p: number): string {
  if (p > 0 && p < 0.0005) return "< 0,1 %";
  if (p < 1 && p > 0.9995) return "> 99,9 %";
  return `${(p * 100).toFixed(1).replace(".", ",")} %`;
}

/** The ten output probabilities, as a ranked bar chart. */
export function ProbabilityBars({
  probs,
  className,
  height = 22,
}: {
  probs: number[] | null;
  className?: string;
  height?: number;
}) {
  const best = probs ? probs.indexOf(Math.max(...probs)) : -1;

  return (
    <div className={cx("space-y-[3px]", className)}>
      {Array.from({ length: 10 }, (_, d) => {
        const p = probs?.[d] ?? 0;
        const win = d === best && p > 0;
        return (
          <div key={d} className="flex items-center gap-2" style={{ height }}>
            <span
              className={cx(
                "tnum w-4 text-right text-[12px]",
                win ? "font-semibold text-ink" : "text-ink-muted",
              )}
            >
              {d}
            </span>
            <div className="relative h-full flex-1 overflow-hidden rounded-[3px] bg-surface-2">
              <div
                className="h-full rounded-[3px] transition-[width] duration-150"
                style={{
                  width: `${Math.max(p * 100, p > 0.001 ? 1 : 0)}%`,
                  background: win ? STATUS.good : CHROME.lineStrong,
                }}
              />
            </div>
            <span
              className={cx(
                "tnum w-11 text-right text-[11px]",
                win ? "text-ink" : "text-ink-muted",
              )}
            >
              {probs ? formatProbability(p) : "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** The hidden layer: one square per neuron, brightness = how strongly it fired. */
export function HiddenActivations({
  values,
  columns = 8,
  className,
  onHover,
  active,
}: {
  values: number[] | null;
  columns?: number;
  className?: string;
  onHover?: (index: number | null) => void;
  active?: number | null;
}) {
  const max = values?.length ? Math.max(...values, 1e-6) : 1;

  if (!values?.length) {
    return (
      <p className={cx("text-[11px] text-ink-muted", className)}>
        Tracez un chiffre pour voir la couche cachée s&apos;allumer.
      </p>
    );
  }

  return (
    <div
      className={cx("grid gap-[3px]", className)}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      onMouseLeave={() => onHover?.(null)}
    >
      {values.map((v, i) => (
        <button
          key={i}
          type="button"
          onMouseEnter={() => onHover?.(i)}
          onFocus={() => onHover?.(i)}
          title={`Neurone ${i + 1} : ${v.toFixed(2)}`}
          aria-label={`Neurone caché ${i + 1}, activation ${v.toFixed(2)}`}
          className={cx(
            "aspect-square rounded-[3px] border transition-colors",
            active === i ? "border-accent" : "border-line",
          )}
          style={{
            background:
              v <= 0
                ? "transparent"
                : rampAt(SEQUENTIAL, 0.25 + 0.75 * Math.min(1, v / max)),
          }}
        />
      ))}
    </div>
  );
}

/**
 * The first weight matrix, one 16×16 image per hidden neuron.
 *
 * This is the page's payoff: at epoch 0 these are pure noise, and a dozen
 * epochs later they are loops, bars and diagonals. Nobody has to be told the
 * network "learned features" — it is visible.
 *
 * Drawn on canvas rather than as SVG because a 32-neuron layer is 8192 cells,
 * and 8192 DOM nodes re-created every epoch is how a page starts to stutter.
 */
export function ReceptiveFields({
  w1,
  columns = 8,
  cellSize = 46,
  className,
  active,
  onHover,
  labels,
}: {
  w1: Float32Array | null;
  columns?: number;
  cellSize?: number;
  className?: string;
  active?: number | null;
  onHover?: (index: number | null) => void;
  /** A caption under each image — the class name, when there is one. */
  labels?: string[];
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const count = w1 ? Math.floor(w1.length / DIGIT_PIXELS) : 0;
  const rows = Math.ceil(count / columns);
  const gap = 4;
  const caption = labels ? 14 : 0;
  const width = columns * cellSize + (columns - 1) * gap;
  const height = rows * (cellSize + caption) + (rows - 1) * gap;

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !w1 || !count) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(2, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // One tiny offscreen tile per neuron, scaled up in one drawImage: the
    // browser's smoothing then does the interpolation, and 16×16 rectangles
    // never land on fractional pixels.
    const tile = document.createElement("canvas");
    tile.width = DIGIT_SIZE;
    tile.height = DIGIT_SIZE;
    const tctx = tile.getContext("2d");
    if (!tctx) return;
    const img = tctx.createImageData(DIGIT_SIZE, DIGIT_SIZE);

    for (let n = 0; n < count; n++) {
      const base = n * DIGIT_PIXELS;
      let maxAbs = 1e-6;
      for (let p = 0; p < DIGIT_PIXELS; p++) {
        const a = Math.abs(w1[base + p]);
        if (a > maxAbs) maxAbs = a;
      }
      // Scaled per neuron: an absolute scale would leave the quiet neurons
      // blank and say nothing about what they look for.
      for (let p = 0; p < DIGIT_PIXELS; p++) {
        const t = w1[base + p] / maxAbs;
        const [r, g, b] = toRgbTriple(rampAt(DIVERGING, (t + 1) / 2));
        img.data[p * 4] = r;
        img.data[p * 4 + 1] = g;
        img.data[p * 4 + 2] = b;
        img.data[p * 4 + 3] = 255;
      }
      tctx.putImageData(img, 0, 0);
      const x = (n % columns) * (cellSize + gap);
      const y = Math.floor(n / columns) * (cellSize + caption + gap);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(tile, x, y, cellSize, cellSize);
      ctx.strokeStyle = active === n ? CHROME.accent : CHROME.line;
      ctx.lineWidth = active === n ? 2 : 1;
      ctx.strokeRect(x + 0.5, y + 0.5, cellSize - 1, cellSize - 1);

      if (labels?.[n]) {
        ctx.fillStyle = CHROME.inkMuted;
        ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(labels[n], x + cellSize / 2, y + cellSize + 11);
      }
    }
  }, [w1, count, columns, cellSize, caption, labels, width, height, active]);

  if (!count) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height }}
      className={cx("block max-w-full", className)}
      role="img"
      aria-label={`Poids d'entrée des ${count} neurones cachés, en images 16 × 16`}
      onMouseLeave={() => onHover?.(null)}
      onMouseMove={(e) => {
        if (!onHover) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const scale = width / rect.width;
        const px = (e.clientX - rect.left) * scale;
        const py = (e.clientY - rect.top) * scale;
        const col = Math.floor(px / (cellSize + gap));
        const row = Math.floor(py / (cellSize + caption + gap));
        const index = row * columns + col;
        onHover(col >= 0 && col < columns && index >= 0 && index < count ? index : null);
      }}
    />
  );
}

/** Where the mistakes go: a 10 × 10 truth × guess grid of the held-out set. */
export function DigitConfusion({
  confusion,
  size = 300,
  className,
}: {
  confusion: Int32Array | null;
  size?: number;
  className?: string;
}) {
  const [hover, setHover] = React.useState<{ t: number; g: number } | null>(null);
  const pad = 20;
  const cell = (size - pad) / 10;
  const max = confusion
    ? Math.max(
        1,
        ...Array.from({ length: 100 }, (_, i) =>
          Math.floor(i / 10) === i % 10 ? 0 : confusion[i],
        ),
      )
    : 1;
  const diagMax = confusion
    ? Math.max(1, ...Array.from({ length: 10 }, (_, d) => confusion[d * 10 + d]))
    : 1;

  return (
    <div className={className}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="block max-w-full"
        role="img"
        aria-label="Matrice de confusion : chiffre réel en lignes, réponse du réseau en colonnes"
      >
        {Array.from({ length: 10 }, (_, d) => (
          <g key={d}>
            <text
              x={pad + d * cell + cell / 2}
              y={12}
              textAnchor="middle"
              className="tnum"
              fontSize={9}
              fill={CHROME.inkMuted}
            >
              {d}
            </text>
            <text
              x={pad - 6}
              y={pad + d * cell + cell / 2 + 3}
              textAnchor="end"
              className="tnum"
              fontSize={9}
              fill={CHROME.inkMuted}
            >
              {d}
            </text>
          </g>
        ))}
        {confusion &&
          Array.from({ length: 100 }, (_, i) => {
            const t = Math.floor(i / 10);
            const g = i % 10;
            const v = confusion[i];
            const diag = t === g;
            return (
              <rect
                key={i}
                x={pad + g * cell}
                y={pad + t * cell}
                width={cell - 1}
                height={cell - 1}
                rx={2}
                fill={
                  v === 0
                    ? "transparent"
                    : diag
                      ? `rgba(39, 163, 126, ${0.12 + 0.3 * (v / diagMax)})`
                      : // Square-rooted: with a hundred errors spread over ninety
                        // cells, a linear scale paints "1" and "8" nearly the same.
                        rampAt(SEQUENTIAL, 0.05 + 0.95 * Math.sqrt(v / max))
                }
                stroke={hover && hover.t === t && hover.g === g ? CHROME.accent : CHROME.line}
                strokeWidth={hover && hover.t === t && hover.g === g ? 1.5 : 0.5}
                onMouseEnter={() => setHover({ t, g })}
                onMouseLeave={() => setHover(null)}
              />
            );
          })}
      </svg>
      <p className="mt-1 min-h-[2.5em] text-[11px] leading-snug text-ink-2">
        {hover && confusion ? (
          hover.t === hover.g ? (
            <>
              <strong>{confusion[hover.t * 10 + hover.g]}</strong> images du chiffre{" "}
              {hover.t} ont bien été reconnues.
            </>
          ) : (
            <>
              <strong>{confusion[hover.t * 10 + hover.g]}</strong> fois, un {hover.t} a été pris
              pour un {hover.g}.
            </>
          )
        ) : (
          "Ligne = le chiffre réel, colonne = la réponse du réseau. La diagonale, ce sont les réussites ; tout le reste, des confusions."
        )}
      </p>
    </div>
  );
}

/**
 * A strip of real images from the dataset, clickable.
 *
 * Drawing your own digit is the hook, but a mouse-drawn 4 is not what the
 * network was trained on. Being able to feed it genuine handwriting — and see
 * it still get some of them wrong — is what keeps the demonstration honest.
 */
export function DigitGallery({
  pixels,
  indices,
  labels,
  predictions,
  selected,
  onSelect,
  cellSize = 40,
  columns = 10,
  className,
}: {
  /** The whole dataset, `count × 256`. */
  pixels: Float32Array;
  /** Which images to show. */
  indices: number[];
  labels: Uint8Array;
  /** Optional predicted label per shown image, for the correct/wrong ring. */
  predictions?: (number | null)[];
  selected?: number | null;
  onSelect?: (index: number) => void;
  cellSize?: number;
  columns?: number;
  className?: string;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const gap = 4;
  const rows = Math.ceil(indices.length / columns);
  const width = columns * cellSize + (columns - 1) * gap;
  const height = rows * cellSize + (rows - 1) * gap;

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = Math.min(2, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const tile = document.createElement("canvas");
    tile.width = DIGIT_SIZE;
    tile.height = DIGIT_SIZE;
    const tctx = tile.getContext("2d");
    if (!tctx) return;
    const img = tctx.createImageData(DIGIT_SIZE, DIGIT_SIZE);

    indices.forEach((source, n) => {
      const base = source * DIGIT_PIXELS;
      for (let p = 0; p < DIGIT_PIXELS; p++) {
        const v = Math.round(pixels[base + p] * 255);
        img.data[p * 4] = v;
        img.data[p * 4 + 1] = v;
        img.data[p * 4 + 2] = v;
        img.data[p * 4 + 3] = 255;
      }
      tctx.putImageData(img, 0, 0);
      const x = (n % columns) * (cellSize + gap);
      const y = Math.floor(n / columns) * (cellSize + gap);
      ctx.fillStyle = "#000000";
      ctx.fillRect(x, y, cellSize, cellSize);
      ctx.drawImage(tile, x, y, cellSize, cellSize);

      const guess = predictions?.[n];
      const isSelected = selected === source;
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.strokeStyle = isSelected
        ? CHROME.accent
        : guess === null || guess === undefined
          ? CHROME.line
          : guess === labels[source]
            ? STATUS.good
            : STATUS.critical;
      ctx.strokeRect(x + 0.5, y + 0.5, cellSize - 1, cellSize - 1);
    });
  }, [pixels, indices, labels, predictions, selected, cellSize, columns, width, height]);

  const hit = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = width / rect.width;
    const col = Math.floor(((e.clientX - rect.left) * scale) / (cellSize + gap));
    const row = Math.floor(((e.clientY - rect.top) * scale) / (cellSize + gap));
    const n = row * columns + col;
    if (col >= 0 && col < columns && n >= 0 && n < indices.length) onSelect?.(indices[n]);
  };

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height }}
      className={cx("block max-w-full cursor-pointer", className)}
      role="img"
      aria-label={`${indices.length} images du jeu de test ; cliquez pour en soumettre une au réseau`}
      onClick={hit}
    />
  );
}
