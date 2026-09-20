import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { THEME_BOOTSTRAP } from "@/lib/viz/theme";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

/**
 * Absolute URLs for the social card.
 *
 * `metadataBase` has no sensible default in a static export: Next falls back to
 * localhost, and every shared link would then advertise an image nobody can
 * fetch. The deploy workflow sets `NEXT_PUBLIC_SITE_URL`; the fallback is the
 * GitHub Pages address the site is published to.
 */
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://cemah2.github.io/Site_IA/";

const description =
  "Un laboratoire interactif pour comprendre comment les algorithmes de Machine Learning fonctionnent de l'intérieur : distances, probabilités, impuretés, marges, gradients et activations, manipulables en temps réel.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Machine Learning Lab — comprendre en manipulant",
    template: "%s · Machine Learning Lab",
  },
  description,
  // No title or description here on purpose: setting them at the layout level
  // pins every page's share card to the site's own title. Left out, Next fills
  // og:title and og:description from each page's resolved metadata.
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "Machine Learning Lab",
    images: [
      {
        url: "og.png",
        width: 1200,
        height: 630,
        alt: "Un nuage de points séparé par une frontière, et le mot d'ordre du site : comprendre en manipulant.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#080b12",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Before first paint: a theme read in an effect would flash the wrong
            one on every page load. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
