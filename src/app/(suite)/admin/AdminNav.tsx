"use client";

import { GearIcon, PeopleIcon, UploadIcon, StackIcon } from "@primer/octicons-react";
import { UnderlineNav } from "@primer/react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "School", icon: GearIcon },
  { href: "/admin/people", label: "People", icon: PeopleIcon },
  { href: "/admin/classes", label: "Classes & houses", icon: StackIcon },
  { href: "/admin/import", label: "Import", icon: UploadIcon },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <UnderlineNav aria-label="School settings">
      {TABS.map((t) => (
        <UnderlineNav.Item
          key={t.href}
          as={NextLink}
          href={t.href}
          icon={t.icon}
          aria-current={pathname === t.href ? "page" : undefined}
        >
          {t.label}
        </UnderlineNav.Item>
      ))}
    </UnderlineNav>
  );
}
