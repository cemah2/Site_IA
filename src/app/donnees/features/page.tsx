import type { Metadata } from "next";
import { FeaturesLab } from "@/components/pages/FeaturesLab";

export const metadata: Metadata = {
  title: "Features",
  description:
    "Ce que le modèle voit réellement : des nombres. Effet de l'échelle sur les distances, et comment un changement de représentation peut rendre un problème trivial.",
};

export default function Page() {
  return <FeaturesLab />;
}
