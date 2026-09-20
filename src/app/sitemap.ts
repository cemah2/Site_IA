import type { MetadataRoute } from "next";
import { ALL_ITEMS } from "@/lib/nav";

/**
 * Generated at build time into the static export.
 *
 * Derived from the navigation rather than written by hand, so a page that is
 * added to the site is in the sitemap by construction — a hand-kept list is a
 * list that silently goes stale.
 */
export const dynamic = "force-static";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://cemah2.github.io/Site_IA/";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = SITE.endsWith("/") ? SITE.slice(0, -1) : SITE;
  const now = new Date();

  return ALL_ITEMS.map((item) => ({
    url: `${base}${item.href}`,
    lastModified: now,
    // The home page and the guided path are the two doors in; the rest are
    // reference pages of equal standing, so they share one priority rather
    // than being ranked by guesswork.
    changeFrequency: "monthly" as const,
    priority: item.href === "/" ? 1 : item.href === "/parcours/" ? 0.9 : 0.7,
  }));
}
