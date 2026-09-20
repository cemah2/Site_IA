import type { NextConfig } from "next";

/**
 * Static export: every page is pre-rendered to HTML at build time and every
 * computation (dataset generation, model fitting, decision boundaries) happens
 * in the browser. No server is involved at runtime, so the site can be hosted
 * on GitHub Pages or any static file host.
 *
 * `NEXT_PUBLIC_BASE_PATH` is set by the deploy workflow to "/Site_IA" so that
 * assets resolve under https://<user>.github.io/Site_IA/. Locally it is empty.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath: basePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
