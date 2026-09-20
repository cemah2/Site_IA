import type { Metadata } from "next";
import { RealWorldLab } from "@/components/pages/RealWorldLab";

export const metadata: Metadata = {
  title: "Et maintenant, en vrai",
  description:
    "Le code scikit-learn qui refait exactement l'expérience à l'écran, et la table de correspondance entre chaque page du site et la ligne qui fait la même chose.",
};

export default function Page() {
  return <RealWorldLab />;
}
