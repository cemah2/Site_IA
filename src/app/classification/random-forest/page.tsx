import type { Metadata } from "next";
import { RandomForestLab } from "@/components/pages/RandomForestLab";

export const metadata: Metadata = {
  title: "Random Forest",
  description:
    "Beaucoup d'arbres délibérément différents, puis un vote. Voyez la surface de chaque arbre, son vote, et pourquoi le désaccord est ce qui fait la force de l'ensemble.",
};

export default function Page() {
  return <RandomForestLab />;
}
