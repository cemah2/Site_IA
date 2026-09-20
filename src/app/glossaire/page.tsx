import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/layout/PageShell";
import { GLOSSARY } from "@/content/glossary";

export const metadata: Metadata = {
  title: "Glossaire",
  description:
    "Tout le vocabulaire du Machine Learning employé sur le site, défini simplement : feature, hyperparamètre, surapprentissage, gradient, marge, epoch…",
};

const SECTIONS: { title: string; keys: (keyof typeof GLOSSARY)[] }[] = [
  {
    title: "Les données",
    keys: ["feature", "label", "dataset", "sample", "supervise", "nonsupervise", "normalisation", "bruit", "outlier"],
  },
  { title: "Le modèle", keys: ["modele", "parametre", "hyperparametre", "frontiere", "prediction"] },
  {
    title: "Mesurer",
    keys: ["entrainement", "test", "accuracy", "baseline", "matriceconfusion", "precision", "rappel", "f1"],
  },
  {
    title: "Généraliser",
    keys: ["generalisation", "overfitting", "underfitting", "biais", "variance", "regularisation", "crossval"],
  },
  {
    title: "Les algorithmes",
    keys: ["knn", "centroide", "distance", "impurete", "entropie", "gain", "ensemble", "bagging", "marge", "vecteursupport", "kernel", "bayes", "prior", "vraisemblance"],
  },
  {
    title: "Les réseaux de neurones",
    keys: ["neurone", "poids", "biaisneurone", "activation", "couche", "forward", "backprop", "gradient", "descente", "learningrate", "epoch", "loss", "softmax", "vanishing"],
  },
];

export default function GlossairePage() {
  return (
    <PageShell
      eyebrow="Référence"
      title="Glossaire"
      lede={
        <>
          Tout le vocabulaire employé sur le site, expliqué sans supposer de connaissances
          préalables. Sur les pages, ces termes apparaissent{" "}
          <span className="border-b border-dotted border-accent/60">soulignés en pointillés</span>{" "}
          : survolez-les pour obtenir la définition sans quitter votre lecture.
        </>
      }
    >
      <nav aria-label="Sections du glossaire" className="mb-8 flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <a
            key={s.title}
            href={`#${slug(s.title)}`}
            className="rounded-lg border border-line bg-surface-1/60 px-3 py-1.5 text-[13px] text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
          >
            {s.title}
          </a>
        ))}
      </nav>

      <div className="space-y-10">
        {SECTIONS.map((section) => (
          <section key={section.title} id={slug(section.title)}>
            <h2 className="mb-4 border-b border-line pb-2 text-lg font-semibold tracking-tight text-ink">
              {section.title}
            </h2>
            <dl className="grid gap-4 md:grid-cols-2">
              {section.keys.map((key) => {
                const e = GLOSSARY[key];
                if (!e) return null;
                return (
                  <div
                    key={String(key)}
                    id={String(key)}
                    className="rounded-xl border border-line bg-surface-1/60 p-4"
                  >
                    <dt className="text-[14px] font-semibold text-ink">{e.term}</dt>
                    <dd className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{e.short}</dd>
                    {e.example && (
                      <dd className="mt-2 border-t border-line pt-2 text-[12px] leading-relaxed text-ink-muted">
                        {e.example}
                      </dd>
                    )}
                    {e.href && (
                      <dd className="mt-2.5">
                        <Link
                          href={e.href}
                          className="text-[12px] font-medium text-accent hover:underline"
                        >
                          {e.hrefLabel ?? "Voir la page"} →
                        </Link>
                      </dd>
                    )}
                  </div>
                );
              })}
            </dl>
          </section>
        ))}
      </div>
    </PageShell>
  );
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-");
}
