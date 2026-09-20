import type { Metadata } from "next";
import { PageShell } from "@/components/layout/PageShell";
import { CoursePathway } from "@/components/lab/CoursePathway";

export const metadata: Metadata = {
  title: "Parcours guidé",
  description:
    "Le site dans l'ordre, de « qu'est-ce qu'une donnée » jusqu'aux réseaux de neurones. Chaque étape annonce ce qu'elle apporte et combien de temps elle prend.",
};

export default function ParcoursPage() {
  return (
    <PageShell
      eyebrow="Commencer"
      title="Parcours guidé"
      lede={
        <>
          La barre latérale est une table des matières : pratique quand on sait ce qu&apos;on
          cherche, intimidante sinon. Voici l&apos;autre entrée — le site dans l&apos;ordre, où
          chaque étape dit ce qu&apos;elle vous apportera et combien de temps elle prend. Aucun
          prérequis au-delà du lycée, et chaque page n&apos;utilise que des idées introduites
          avant elle.
        </>
      }
    >
      <CoursePathway />
    </PageShell>
  );
}
