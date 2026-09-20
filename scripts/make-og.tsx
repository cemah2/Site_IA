/**
 * Render the social card to `public/og.png`.
 *
 * Next can generate this from an `opengraph-image` route, but a static export
 * writes it to a file with no extension, and a host like GitHub Pages then
 * serves it as `application/octet-stream` — which the scrapers reject. Writing
 * a real `.png` into `public/` sidesteps the whole problem.
 *
 *   npx tsx scripts/make-og.tsx
 */
import { ImageResponse } from "next/og";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = join(process.cwd(), "public", "og.png");

// A deterministic scatter: the card must be byte-identical between runs, so
// nothing here may call Math.random. The boundary below is the same line the
// classes are split by, so the picture is consistent rather than decorative.
const SLOPE = -0.34;
const boundaryAt = (x: number) => 330 + SLOPE * (x - 300);

const points = Array.from({ length: 96 }, (_, i) => {
  const a = (i * 2.399963) % (Math.PI * 2);
  const r = 40 + ((i * 37) % 215);
  const x = 300 + Math.cos(a) * r;
  const y = 330 + Math.sin(a) * r * 0.66;
  return { x, y, cls: y < boundaryAt(x) ? 0 : 1 };
});

function findFont(): { name: string; data: Buffer } {
  // Satori needs real font bytes; the project already ships a variable font
  // through next/font, and the cache under .next holds the extracted files.
  const candidates = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
  ];
  for (const path of candidates) {
    try {
      return { name: "sans", data: readFileSync(path) };
    } catch {
      continue;
    }
  }
  throw new Error("Aucune police trouvée pour le rendu de la carte");
}

const font = findFont();

const card = (
  <div
    style={{
      width: "100%",
      height: "100%",
      display: "flex",
      background: "#080b12",
      color: "#e7ecf3",
      fontFamily: "sans",
      position: "relative",
    }}
  >
    <svg width={1200} height={630} style={{ position: "absolute", left: 0, top: 0 }}>
      <rect width={1200} height={630} fill="#080b12" />
      {Array.from({ length: 13 }, (_, i) => (
        <line key={`v${i}`} x1={i * 100} y1={0} x2={i * 100} y2={630} stroke="#141a24" strokeWidth={1} />
      ))}
      {Array.from({ length: 7 }, (_, i) => (
        <line key={`h${i}`} x1={0} y1={i * 100} x2={1200} y2={i * 100} stroke="#141a24" strokeWidth={1} />
      ))}
      <line
        x1={40}
        y1={boundaryAt(40)}
        x2={600}
        y2={boundaryAt(600)}
        stroke="#4a5769"
        strokeWidth={3}
      />
    </svg>

    {/* Points as positioned boxes rather than SVG shapes: satori renders
        <circle> unevenly at this size, and a rounded box is exact. */}
    {points.map((p, i) => (
      <div
        key={i}
        style={{
          position: "absolute",
          left: p.x - 7,
          top: p.y - 7,
          width: 14,
          height: 14,
          background: p.cls === 0 ? "#2584f5" : "#e45a20",
          borderRadius: p.cls === 0 ? 7 : 2,
        }}
      />
    ))}

    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        position: "absolute",
        right: 64,
        top: 0,
        bottom: 0,
        width: 560,
      }}
    >
      <div style={{ fontSize: 22, letterSpacing: 4, color: "#7aa2ff", marginBottom: 18 }}>
        MACHINE LEARNING LAB
      </div>
      <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.05, marginBottom: 22 }}>
        Comprendre en manipulant
      </div>
      <div style={{ fontSize: 26, lineHeight: 1.4, color: "#9aa7b8" }}>
        Déplacez un point, changez un paramètre, regardez l’algorithme réagir. KNN, arbres, SVM,
        réseaux de neurones — de l’intérieur.
      </div>
    </div>
  </div>
);

const response = new ImageResponse(card, {
  width: 1200,
  height: 630,
  fonts: [{ name: font.name, data: font.data as unknown as ArrayBuffer, style: "normal" }],
});

async function main() {
  const buffer = Buffer.from(await response.arrayBuffer());
  writeFileSync(OUT, buffer);
  console.log(`écrit ${OUT} — ${(buffer.length / 1024).toFixed(0)} Ko`);
}

void main();
