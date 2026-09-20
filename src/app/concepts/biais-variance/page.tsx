import type { Metadata } from "next";
import { BiasVarianceLab } from "@/components/pages/BiasVarianceLab";

export const metadata: Metadata = {
  title: "Biais et variance",
  description:
    "Le même modèle entraîné sur vingt échantillons différents : biais, variance et bruit calculés séparément, pas illustrés.",
};

export default function Page() {
  return <BiasVarianceLab />;
}
