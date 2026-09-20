import type { Metadata } from "next";
import { LinearRegressionLab } from "@/components/pages/LinearRegressionLab";

export const metadata: Metadata = {
  title: "Régression linéaire",
  description:
    "Résidus tracés, coût calculé, droite des moindres carrés recalculée à chaque déplacement de point. Et pourquoi c'est le carré de l'erreur qui est minimisé.",
};

export default function Page() {
  return <LinearRegressionLab />;
}
