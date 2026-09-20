import type { Metadata } from "next";
import { ForwardLab } from "@/components/pages/ForwardLab";

export const metadata: Metadata = {
  title: "Forward propagation",
  description:
    "Une donnée traverse le réseau couche par couche. Valeurs qui circulent, vitesse réglable, pause à chaque étape.",
};

export default function Page() {
  return <ForwardLab />;
}
