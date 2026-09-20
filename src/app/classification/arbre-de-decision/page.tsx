import type { Metadata } from "next";
import { DecisionTreeLab } from "@/components/pages/DecisionTreeLab";

export const metadata: Metadata = {
  title: "Arbre de décision",
  description:
    "Chaque nœud garde toutes les coupures qu'il a envisagées, avec leur impureté et leur gain d'information. Cliquez : vous obtenez les chiffres, pas une explication.",
};

export default function Page() {
  return <DecisionTreeLab />;
}
