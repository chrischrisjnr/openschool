"use client";

import { Banner } from "@primer/react";
import type { ReactNode } from "react";

export function Notice({ tone, children }: { tone: "info" | "success" | "warning"; children: ReactNode }) {
  return <Banner variant={tone} title="Note" hideTitle description={children} />;
}
