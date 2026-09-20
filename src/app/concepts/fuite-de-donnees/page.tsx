import type { Metadata } from "next";
import { LeakageLab } from "@/components/pages/LeakageLab";

export const metadata: Metadata = {
  title: "La fuite de données",
  description:
    "Le seul bug en apprentissage automatique qui se déguise en succès. Trois fuites mesurées plutôt que récitées — et le classement surprend.",
};

export default function Page() {
  return <LeakageLab />;
}
