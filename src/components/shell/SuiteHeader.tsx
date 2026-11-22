"use client";

import { SignOutIcon, PersonIcon } from "@primer/octicons-react";
import { ActionList, ActionMenu } from "@primer/react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { signOut } from "@/app/actions/auth";
import { initials } from "@/lib/format";
import { ProductMark, SuiteMark } from "./ProductMark";
import { PRODUCTS, type ProductKey } from "./products";
import styles from "./shell.module.css";

const ROLE_LABEL = { admin: "School admin", staff: "Staff", parent: "Parent / carer", student: "Student" };

export type HeaderUser = {
  name: string;
  email: string;
  role: keyof typeof ROLE_LABEL;
  schoolName: string;
};

export function SuiteHeader({ user }: { user: HeaderUser }) {
  const pathname = usePathname();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <header className={styles.header}>
      <a href="#main" className={styles.skip}>
        Skip to content
      </a>
      <NextLink href="/" className={styles.brand} aria-label="Open Schools home">
        <SuiteMark size={26} />
        <span className={styles.brandText}>
          <span className={styles.brandName}>Open Schools</span>
          <span className={styles.brandSchool}>{user.schoolName}</span>
        </span>
      </NextLink>

      <nav aria-label="Apps" className={styles.switcher}>
        {(Object.keys(PRODUCTS) as ProductKey[]).map((key) => {
          const active = pathname.startsWith(PRODUCTS[key].href);
          return (
            <NextLink
              key={key}
              href={PRODUCTS[key].href}
              className={styles.switcherLink}
              data-product={key}
              aria-current={active ? "page" : undefined}
            >
              <ProductMark product={key} size={22} />
              <span className={styles.switcherLabel}>{PRODUCTS[key].name}</span>
            </NextLink>
          );
        })}
      </nav>

      <ActionMenu>
        <ActionMenu.Anchor>
          <button type="button" className={styles.avatarButton} aria-label={`Account: ${user.name}`}>
            <span className={styles.avatar} aria-hidden>
              {initials(user.name)}
            </span>
          </button>
        </ActionMenu.Anchor>
        <ActionMenu.Overlay align="end" width="medium">
          <ActionList>
            <ActionList.Group>
              <ActionList.GroupHeading>
                {user.name} · {ROLE_LABEL[user.role]}
              </ActionList.GroupHeading>
              <ActionList.LinkItem as={NextLink} href="/account">
                <ActionList.LeadingVisual>
                  <PersonIcon />
                </ActionList.LeadingVisual>
                Your account
                <ActionList.Description variant="block">{user.email}</ActionList.Description>
              </ActionList.LinkItem>
            </ActionList.Group>
            <ActionList.Divider />
            <ActionList.Item variant="danger" onSelect={() => formRef.current?.requestSubmit()}>
              <ActionList.LeadingVisual>
                <SignOutIcon />
              </ActionList.LeadingVisual>
              Sign out
            </ActionList.Item>
          </ActionList>
        </ActionMenu.Overlay>
      </ActionMenu>
      <form ref={formRef} action={signOut} hidden />
    </header>
  );
}
