import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Providers } from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Open Schools", template: "%s · Open Schools" },
  description:
    "Free, open-source platforms for Australian schools: Assemble for school–family communication, Quad for community chat and Fete for fundraising.",
  applicationName: "Open Schools",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1117" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en-AU"
      data-color-mode="auto"
      data-light-theme="light"
      data-dark-theme="dark"
      suppressHydrationWarning
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
