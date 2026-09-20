import type { Metadata } from "next";
import { NaiveBayesLab } from "@/components/pages/NaiveBayesLab";

export const metadata: Metadata = {
  title: "Naive Bayes",
  description:
    "Le théorème de Bayes assemblé terme par terme : prior, vraisemblance, produit, normalisation. Et l'hypothèse d'indépendance rendue visible.",
};

export default function Page() {
  return <NaiveBayesLab />;
}
