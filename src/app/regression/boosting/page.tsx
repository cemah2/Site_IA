import type { Metadata } from "next";
import { BoostingLab } from "@/components/pages/BoostingLab";

export const metadata: Metadata = {
  title: "Boosting",
  description:
    "Des arbres qui poussent à la file, chacun ajusté sur ce que les précédents ont raté. L'opposé exact d'une forêt aléatoire, montré côte à côte.",
};

export default function Page() {
  return <BoostingLab />;
}
