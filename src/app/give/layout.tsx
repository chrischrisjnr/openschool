import type { Metadata } from "next";
import type { ReactNode } from "react";
import { appBaseUrl } from "@/lib/payments";
import feteStyles from "../(suite)/fete/_components/fete.module.css";
import styles from "./give.module.css";

export async function generateMetadata(): Promise<Metadata> {
  return { metadataBase: new URL(await appBaseUrl()) };
}

/** Public Fete pages: no login, no suite chrome — just the fundraiser. */
export default function GiveLayout({ children }: { children: ReactNode }) {
  return <div className={`${feteStyles.theme} ${styles.page}`}>{children}</div>;
}
