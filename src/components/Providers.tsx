"use client";

import { BaseStyles, ThemeProvider } from "@primer/react";
import type { ReactNode } from "react";

/** Primer theme (follows the device's light/dark setting) + base styles. */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider colorMode="auto" preventSSRMismatch>
      <BaseStyles>{children}</BaseStyles>
    </ThemeProvider>
  );
}
