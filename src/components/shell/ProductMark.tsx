"use client";

import { CommentDiscussionIcon, HeartIcon, MegaphoneIcon } from "@primer/octicons-react";
import styles from "./shell.module.css";
import type { ProductKey } from "./products";

const ICONS = { assemble: MegaphoneIcon, quad: CommentDiscussionIcon, fete: HeartIcon };

/** The coloured square logo used for each Open Schools product. */
export function ProductMark({ product, size = 28 }: { product: ProductKey; size?: number }) {
  const Icon = ICONS[product];
  return (
    <span
      className={styles.mark}
      data-product={product}
      style={{ width: size, height: size, borderRadius: Math.round(size / 4) }}
      aria-hidden
    >
      <Icon size={Math.round(size * 0.58)} />
    </span>
  );
}

/** The Open Schools suite logo: three overlapping dots, one per product. */
export function SuiteMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className={styles.suiteMark}>
      <circle cx="11" cy="12" r="8" fill="var(--os-assemble)" opacity="0.9" />
      <circle cx="21" cy="12" r="8" fill="var(--os-quad)" opacity="0.85" />
      <circle cx="16" cy="21" r="8" fill="var(--os-fete)" opacity="0.85" />
    </svg>
  );
}
