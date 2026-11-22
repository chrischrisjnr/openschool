import type { ReactNode } from "react";
import { ProductLayout } from "@/components/shell/ProductLayout";

export default function QuadLayout({ children }: { children: ReactNode }) {
  return (
    <ProductLayout product="quad" nav={[{ href: "/quad", label: "Home", icon: "home", exact: true }]}>
      {children}
    </ProductLayout>
  );
}
