import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://cemah2.github.io/Site_IA/";

/**
 * Everything is public and nothing is generated per visitor, so there is
 * nothing to hide from a crawler — the only job here is to point at the
 * sitemap so the whole site is found rather than only what happens to be
 * linked from outside.
 */
export default function robots(): MetadataRoute.Robots {
  const base = SITE.endsWith("/") ? SITE.slice(0, -1) : SITE;
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${base}/sitemap.xml`,
  };
}
