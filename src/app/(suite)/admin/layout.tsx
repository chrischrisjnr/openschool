import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PageTitle } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { AdminNav } from "./AdminNav";
import styles from "./admin.module.css";

export const metadata: Metadata = { title: "School settings" };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const me = await requireUser(["admin"]);
  return (
    <main id="main" className={styles.page}>
      <PageTitle title="School settings" description={`Manage ${me.school.name}'s details, people and classes.`} />
      <AdminNav />
      <div className={styles.body}>{children}</div>
    </main>
  );
}
