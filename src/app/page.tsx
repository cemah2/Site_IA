import Link from "next/link";
import { Hero } from "@/components/home/Hero";
import { NAV } from "@/lib/nav";

const HIGHLIGHTS = [
  {
    title: "Les distances, vraiment tracées",
    body: "Quand Nearest Centroid compare des distances, les segments sont dessinés et mesurés. Quand KNN choisit K voisins, ce sont ces K-là qui s'allument.",
    href: "/classification/knn/",
    cta: "Voir KNN",
  },
  {
    title: "Les probabilités, terme par terme",
    body: "Naive Bayes montre le prior, la vraisemblance, le produit et la normalisation séparément. Vous voyez le théorème de Bayes s'assembler, pas son résultat.",
    href: "/classification/naive-bayes/",
    cta: "Voir Naive Bayes",
  },
  {
    title: "Pourquoi cette coupure et pas une autre",
    body: "Chaque nœud d'arbre garde toutes les coupures qu'il a envisagées, avec leur gain. Cliquez : vous obtenez les chiffres, pas une explication.",
    href: "/classification/arbre-de-decision/",
    cta: "Voir les arbres",
  },
  {
    title: "L'intérieur du réseau",
    body: "Les activations de chaque neurone, les gradients qui remontent, les poids qui changent après une itération. Visibles pendant l'entraînement.",
    href: "/reseaux/backpropagation/",
    cta: "Voir la backpropagation",
  },
];

export default function HomePage() {
  return (
    <>
      <Hero />

      <div className="mx-auto max-w-[1400px] px-5 py-12 lg:px-10 lg:py-16">
        <section>
          <h2 className="text-xl font-semibold tracking-tight text-ink">
            Ce que ce site montre que les cours ne montrent pas
          </h2>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-2">
            Une frontière de décision finie ne dit pas comment on y est arrivé. Ici, chaque
            visualisation affiche la quantité que l&apos;algorithme est en train de calculer,
            au moment où il la calcule.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {HIGHLIGHTS.map((h) => (
              <Link
                key={h.href}
                href={h.href}
                className="group rounded-xl border border-line bg-surface-1/70 p-5 transition-colors hover:border-line-strong hover:bg-surface-2/50"
              >
                <h3 className="text-[15px] font-semibold text-ink">{h.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-2">{h.body}</p>
                <span className="mt-3 inline-block text-[13px] font-medium text-accent">
                  {h.cta} →
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-14">
          <h2 className="text-xl font-semibold tracking-tight text-ink">Le parcours complet</h2>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-2">
            Chaque page suit le même rythme : une visualisation, des contrôles, une explication
            à trois niveaux de lecture, puis les mathématiques. Le dataset que vous manipulez
            vous suit d&apos;une page à l&apos;autre.
          </p>

          <div className="mt-6 grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
            {NAV.filter((s) => s.title !== "Commencer").map((section) => (
              <div key={section.title}>
                <h3 className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                  {section.title}
                </h3>
                <ul className="space-y-2">
                  {section.items.map((item) => (
                    <li key={item.href}>
                      <Link href={item.href} className="group block">
                        <span className="text-[13px] font-medium text-ink group-hover:text-accent">
                          {item.label}
                        </span>
                        {item.blurb && (
                          <span className="mt-0.5 block text-[12px] leading-snug text-ink-muted">
                            {item.blurb}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
