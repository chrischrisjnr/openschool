"use client";

import { Button } from "@primer/react";
import { icons } from "@/components/icons";

export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <Button variant="primary" leadingVisual={icons.report} onClick={() => window.print()}>
      {label}
    </Button>
  );
}
