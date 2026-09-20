/**
 * Save a visualisation as a PNG.
 *
 * The point is not decoration: these plots are the argument of a lesson, and a
 * lesson people can paste into their own notes, slides or homework travels much
 * further than one they can only look at. Everything here exists to make the
 * exported file look like what was on screen.
 *
 * Three things have to be handled explicitly, and each one is a visible defect
 * if it is not:
 *
 *  - **A background.** The site is dark and its plots rely on it; a transparent
 *    PNG dropped into a white document renders pale grey text on white.
 *  - **Fonts.** Serialised SVG is rendered in isolation, with none of the
 *    page's CSS, so the font stack is written into the clone.
 *  - **Device pixel ratio.** Exporting at CSS size produces a blurry image on
 *    any modern screen; the canvas is drawn at a fixed 2× instead.
 */

const FONT_STACK =
  "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export interface ExportOptions {
  /** File name without extension. */
  name?: string;
  /** Background colour painted under the drawing. */
  background?: string;
  scale?: number;
}

export async function exportSvgToPng(
  svg: SVGSVGElement,
  { name = "visualisation", background = "#0b0e14", scale = 2 }: ExportOptions = {},
): Promise<void> {
  const rect = svg.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width || Number(svg.getAttribute("width")) || 600));
  const height = Math.max(1, Math.round(rect.height || Number(svg.getAttribute("height")) || 400));

  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  if (!clone.getAttribute("viewBox")) {
    clone.setAttribute("viewBox", `0 0 ${width} ${height}`);
  }

  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = `
    text { font-family: ${FONT_STACK}; }
    .tnum { font-variant-numeric: tabular-nums; }
  `;
  clone.insertBefore(style, clone.firstChild);

  const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bg.setAttribute("x", "0");
  bg.setAttribute("y", "0");
  bg.setAttribute("width", String(width));
  bg.setAttribute("height", String(height));
  bg.setAttribute("fill", background);
  clone.insertBefore(bg, style.nextSibling);

  const source = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  try {
    const image = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    await download(canvas, name);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Canvas-based visualisations (the 16×16 weight images) export directly. */
export async function exportCanvasToPng(
  canvas: HTMLCanvasElement,
  { name = "visualisation", background = "#0b0e14", scale = 2 }: ExportOptions = {},
): Promise<void> {
  const out = document.createElement("canvas");
  out.width = canvas.width * scale;
  out.height = canvas.height * scale;
  const ctx = out.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(canvas, 0, 0, out.width, out.height);
  await download(out, name);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("SVG non rendu"));
    img.src = url;
  });
}

function download(canvas: HTMLCanvasElement, name: string): Promise<void> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve();
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug(name)}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Revoking immediately can cancel the download in some browsers.
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      resolve();
    }, "image/png");
  });
}

function slug(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "visualisation"
  );
}
