import type { Metadata } from "next";
import { LogisticLab } from "@/components/pages/LogisticLab";

export const metadata: Metadata = {
  title: "Régression logistique",
  description:
    "Un score linéaire écrasé entre 0 et 1 par la sigmoïde : le plus simple des modèles qui répond en probabilité, et le chaînon manquant vers le neurone.",
};

export default function Page() {
  return <LogisticLab />;
}
