import type { Metadata } from "next";
import { ImportLab } from "@/components/pages/ImportLab";

export const metadata: Metadata = {
  title: "Vos propres données",
  description:
    "Importez un CSV — il ne quitte pas votre navigateur — et faites tourner les vingt-neuf pages du site sur vos données. Iris et manchots de Palmer fournis.",
};

export default function Page() {
  return <ImportLab />;
}
