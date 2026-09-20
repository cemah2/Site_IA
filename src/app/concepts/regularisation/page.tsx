import type { Metadata } from "next";
import { RegularisationLab } from "@/components/pages/RegularisationLab";

export const metadata: Metadata = {
  title: "Régularisation",
  description:
    "Payer la complexité au lieu de l'interdire : effet de λ sur les coefficients, la courbe et l'erreur de validation. Ridge contre Lasso.",
};

export default function Page() {
  return <RegularisationLab />;
}
