import type { Metadata } from "next";
import { CrossValLab } from "@/components/pages/CrossValLab";

export const metadata: Metadata = {
  title: "Validation croisée",
  description:
    "Une accuracy de test dépend de la chance du découpage, souvent de cinq à dix points. Voyez l'écart, puis la mesure qui le supprime.",
};

export default function Page() {
  return <CrossValLab />;
}
