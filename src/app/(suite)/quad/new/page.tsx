import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageTitle } from "@/components/ui";
import { Card } from "@/components/ui/Card";
import { getViewer } from "@/lib/viewer";
import { createSpace } from "../actions";
import { SpaceForm } from "../_components/SpaceForm";
import styles from "../_components/quad.module.css";

export const metadata: Metadata = { title: "New group · Quad" };

export default async function NewGroupPage() {
  const viewer = await getViewer();
  if (viewer.role === "student") redirect("/quad");
  return (
    <div className={styles.narrow}>
      <PageTitle
        title="Create a group"
        back={{ href: "/quad/browse", label: "Browse groups" }}
        description={
          viewer.isStaff
            ? "Groups can be open to the whole community or invite only."
            : "Community groups are open to every family at the school. You'll be the group's moderator."
        }
      />
      <Card>
        <SpaceForm
          action={createSpace}
          submitLabel="Create group"
          initial={{ name: "", emoji: "💬", description: "", visibility: "open", postingPolicy: "everyone" }}
          showVisibility={viewer.isStaff}
          showPostingPolicy={viewer.isStaff}
        />
      </Card>
    </div>
  );
}
