import Link from "next/link";
import { Hero } from "@/components/home/Hero";
import { CoursePathway } from "@/components/lab/CoursePathway";
import { TourButton } from "@/components/lab/Tour";
import { NAV } from "@/lib/nav";
import { COURSE_STEPS } from "@/lib/course";

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
        <section className="mb-16">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:items-start">
            <div className="max-w-2xl">
              <h2 className="text-xl font-semibold tracking-tight text-ink">
                Jamais fait de Machine Learning ? Commencez ici.
              </h2>
              <div className="prose-lab mt-4">
                <p>
                  Le Machine Learning, c&apos;est <strong>faire trouver une règle à une machine
                  à partir d&apos;exemples</strong>, au lieu de la lui écrire nous-mêmes.
                </p>
                <p>
                  Pour reconnaître un spam, personne ne sait écrire la liste complète des
                  règles : il y a trop de cas. En revanche, on sait facilement rassembler dix
                  mille messages en disant de chacun « celui-ci est un spam, celui-là non ».
                  Un algorithme d&apos;apprentissage part de ces exemples et en déduit une règle
                  qui marchera sur des messages qu&apos;il n&apos;a jamais vus.
                </p>
                <p>
                  Trois mots reviendront partout sur ce site, et ils suffisent pour démarrer :
                </p>
                <ul>
                  <li>
                    <strong>Les données</strong> — les exemples, chacun décrit par des nombres.
                    Sur nos graphiques, un exemple est un point.
                  </li>
                  <li>
                    <strong>L&apos;apprentissage</strong> — la phase où l&apos;algorithme ajuste
                    sa règle pour coller aux exemples.
                  </li>
                  <li>
                    <strong>Le modèle</strong> — la règle obtenue. Sur nos graphiques, c&apos;est
                    le fond coloré : la réponse de la machine en tout point du plan.
                  </li>
                </ul>
                <p>
                  Le reste — les algorithmes, les formules, les réseaux de neurones — n&apos;est
                  que des façons différentes de faire ces trois choses. Vous n&apos;avez besoin
                  d&apos;aucune connaissance en mathématiques au-delà du lycée : chaque page
                  propose trois niveaux de lecture, et le premier n&apos;utilise aucune formule.
                </p>
              </div>
              <p className="mt-4 text-[13px] text-ink-muted">
                Perdu dans l&apos;interface ? <TourButton>Relancez la visite guidée</TourButton>.
              </p>
            </div>

            <div className="rounded-xl border border-line bg-surface-1/70 p-4">
              <h3 className="text-[14px] font-semibold text-ink">
                Le parcours complet, dans l&apos;ordre
              </h3>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-2">
                {COURSE_STEPS.length} étapes, chacune construite sur les précédentes. Votre
                progression est mémorisée dans votre navigateur.
              </p>
              <div className="mt-4">
                <CoursePathway compact />
              </div>
            </div>
          </div>
        </section>

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
