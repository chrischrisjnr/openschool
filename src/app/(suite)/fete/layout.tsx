import type { ReactNode } from "react";
import { ProductLayout } from "@/components/shell/ProductLayout";

export default function FeteLayout({ children }: { children: ReactNode }) {
  return (
    <ProductLayout product="fete" nav={[{ href: "/fete", label: "Home", icon: "home", exact: true }]}>
      {children}
    </ProductLayout>
  );
}
