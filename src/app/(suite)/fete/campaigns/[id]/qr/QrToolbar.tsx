"use client";

import { Banner as PrimerBanner, FormControl, Select } from "@primer/react";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { PrintButton } from "../../../_components/PrintButton";
import styles from "../campaign.module.css";

export function Banner({ children }: { children: ReactNode }) {
  return <PrimerBanner variant="warning" title="Draft" description={children} hideTitle />;
}

export function QrToolbar({
  classes,
  selected,
}: {
  classes: { id: string; name: string; count: number }[];
  selected: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <div className={styles.sheetToolbar} style={{ marginTop: "var(--base-size-8)" }}>
      <FormControl>
        <FormControl.Label>Class</FormControl.Label>
        <Select value={selected} onChange={(e) => router.push(`${pathname}?class=${encodeURIComponent(e.target.value)}`)}>
          {classes.map((c) => (
            <Select.Option key={c.id} value={c.id}>
              Class {c.name} ({c.count})
            </Select.Option>
          ))}
          <Select.Option value="all">All classes</Select.Option>
        </Select>
      </FormControl>
      <div className={styles.row}>
        <span className={styles.muted}>A4 · 12 cards per page · cut along the dashed lines</span>
        <PrintButton label="Print QR cards" />
      </div>
    </div>
  );
}
