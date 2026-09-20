import type { Metadata } from "next";
import { DigitsLab } from "@/components/pages/DigitsLab";

export const metadata: Metadata = {
  title: "Reconnaître des chiffres manuscrits",
  description:
    "Dessinez un chiffre, entraînez le réseau vous-même et regardez ce qu'il a appris à regarder : 5 000 images manuscrites, 256 pixels, dix probabilités.",
};

export default function Page() {
  return <DigitsLab />;
}
