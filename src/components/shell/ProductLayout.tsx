"use client";

import { CounterLabel, NavList, UnderlineNav } from "@primer/react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { icons, type IconName } from "@/components/icons";
import { ProductMark } from "./ProductMark";
import { PRODUCTS, type ProductKey } from "./products";
import styles from "./shell.module.css";

export type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  /** Badge count, e.g. unread notices. Hidden when 0/undefined. */
  count?: number;
  /** Only highlight on an exact path match (use for the product's home). */
  exact?: boolean;
  /** Visual group heading in the sidebar, e.g. "Manage". */
  section?: string;
};

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/**
 * Standard layout for a product: sidebar navigation on desktop, a scrolling
 * tab bar on phones, and a centred content column.
 *
 * `aside` renders under the nav on desktop (e.g. Quad's list of spaces).
 */
export function ProductLayout({
  product,
  nav,
  aside,
  children,
  wide = false,
}: {
  product: ProductKey;
  nav: NavItem[];
  aside?: ReactNode;
  children: ReactNode;
  /** Let content use the full width (e.g. chat). */
  wide?: boolean;
}) {
  const pathname = usePathname();
  const sections = [...new Set(nav.map((n) => n.section ?? ""))];

  return (
    <div className={styles.product} data-product={product}>
      <aside className={styles.sidebar} aria-label={`${PRODUCTS[product].name} navigation`}>
        <div className={styles.sidebarTitle}>
          <ProductMark product={product} size={32} />
          <div>
            <div className={styles.sidebarName}>{PRODUCTS[product].name}</div>
            <div className={styles.sidebarTagline}>{PRODUCTS[product].tagline}</div>
          </div>
        </div>
        <NavList aria-label={PRODUCTS[product].name}>
          {sections.map((section) => {
            const items = nav.filter((n) => (n.section ?? "") === section).map((item) => {
              const Icon = icons[item.icon];
              return (
                <NavList.Item
                  key={item.href}
                  as={NextLink}
                  href={item.href}
                  aria-current={isActive(pathname, item) ? "page" : undefined}
                >
                  <NavList.LeadingVisual>
                    <Icon />
                  </NavList.LeadingVisual>
                  {item.label}
                  {item.count ? (
                    <NavList.TrailingVisual>
                      <CounterLabel>{item.count}</CounterLabel>
                    </NavList.TrailingVisual>
                  ) : null}
                </NavList.Item>
              );
            });
            return section ? (
              <NavList.Group key={section} title={section}>
                {items}
              </NavList.Group>
            ) : (
              items
            );
          })}
        </NavList>
        {aside ? <div className={styles.sidebarAside}>{aside}</div> : null}
      </aside>

      <div className={styles.mobileNav}>
        <UnderlineNav aria-label={PRODUCTS[product].name}>
          {nav.map((item) => (
            <UnderlineNav.Item
              key={item.href}
              as={NextLink}
              href={item.href}
              icon={icons[item.icon]}
              counter={item.count || undefined}
              aria-current={isActive(pathname, item) ? "page" : undefined}
            >
              {item.label}
            </UnderlineNav.Item>
          ))}
        </UnderlineNav>
      </div>

      <main id="main" className={wide ? styles.mainWide : styles.main}>
        {children}
      </main>
    </div>
  );
}
