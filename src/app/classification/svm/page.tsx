import type { Metadata } from "next";
import { SvmLab } from "@/components/pages/SvmLab";

export const metadata: Metadata = {
  title: "Support Vector Machines",
  description:
    "La marge, les vecteurs de support et le kernel trick : pourquoi un problème non linéaire devient séparable après passage dans un espace de dimension supérieure.",
};

export default function Page() {
  return <SvmLab />;
}
