import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ProductLayout, type NavItem } from "@/components/shell/ProductLayout";
import { familyActionCount } from "@/lib/assemble/charges";
import { classesTaughtBy } from "@/lib/assemble/access";
import { notesAwaitingReview } from "@/lib/assemble/attendance";
import { unreadNoticeCount } from "@/lib/assemble/notices";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: { default: "Assemble", template: "%s · Assemble" } };

export default async function AssembleLayout({ children }: { children: ReactNode }) {
  const viewer = await getViewer();
  const nav: NavItem[] = [
    { href: "/assemble", label: "Today", icon: "home", exact: true },
    { href: "/assemble/notices", label: "Notices", icon: "megaphone", count: unreadNoticeCount(viewer) },
    { href: "/assemble/calendar", label: "Calendar", icon: "calendar" },
    {
      href: "/assemble/payments",
      label: "Forms & payments",
      icon: "card",
      count: viewer.isStaff ? undefined : familyActionCount(viewer),
    },
    {
      href: "/assemble/attendance",
      label: "Attendance",
      icon: "checklist",
      count: viewer.isStaff
        ? notesAwaitingReview(
            viewer.schoolId,
            viewer.isAdmin ? undefined : classesTaughtBy(viewer.id).map((c) => c.id),
          ).length
        : undefined,
    },
  ];
  if (viewer.isStaff) {
    nav.push({ href: "/assemble/students", label: "Students", icon: "people", section: "Manage" });
  }
  return (
    <ProductLayout product="assemble" nav={nav}>
      {children}
    </ProductLayout>
  );
}
