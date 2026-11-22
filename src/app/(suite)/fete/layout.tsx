import type { ReactNode } from "react";
import { ProductLayout, type NavItem } from "@/components/shell/ProductLayout";
import { firstNameOf } from "@/lib/fete/privacy";
import { liveCampaigns, participationsFor } from "@/lib/fete/queries";
import { getViewer } from "@/lib/viewer";
import styles from "./_components/fete.module.css";

export default async function FeteLayout({ children }: { children: ReactNode }) {
  const viewer = await getViewer();
  const nav: NavItem[] = [];

  if (viewer.isStaff) {
    nav.push({ href: "/fete", label: "Campaigns", icon: "trophy", exact: true });
    for (const c of liveCampaigns(viewer.schoolId)) {
      nav.push({ href: `/fete/campaigns/${c.id}`, label: c.name, icon: "flame", section: "Live now" });
    }
    nav.push({ href: "/fete/campaigns/new", label: "New campaign", icon: "plus", section: "Manage" });
  } else if (viewer.role === "student") {
    nav.push({ href: "/fete", label: "My fundraising", icon: "star", exact: true });
  } else {
    nav.push({ href: "/fete", label: "Overview", icon: "home", exact: true });
    const live = participationsFor(
      viewer.students.map((s) => s.id),
      viewer.schoolId,
    ).filter((p) => p.campaign.status === "live");
    for (const p of live) {
      const child = viewer.students.find((s) => s.id === p.participant.studentId);
      if (!child) continue;
      nav.push({
        href: `/fete/child/${p.participant.id}`,
        label: `${firstNameOf(child)}’s page`,
        icon: "person",
        section: live.length > viewer.students.length ? p.campaign.name : "Share & track",
      });
    }
  }

  return (
    <ProductLayout product="fete" nav={nav}>
      <div className={styles.theme}>{children}</div>
    </ProductLayout>
  );
}
