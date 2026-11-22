import type { ReactNode } from "react";
import { ProductLayout } from "@/components/shell/ProductLayout";

export default function AssembleLayout({ children }: { children: ReactNode }) {
  return (
    <ProductLayout product="assemble" nav={[{ href: "/assemble", label: "Home", icon: "home", exact: true }]}>
      {children}
    </ProductLayout>
  );
}
