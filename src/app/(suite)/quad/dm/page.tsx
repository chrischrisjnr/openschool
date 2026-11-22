import type { Metadata } from "next";
import { PageTitle } from "@/components/ui";
import { Card } from "@/components/ui/Card";
import { listMySpaces, listRecipients } from "@/lib/quad/spaces";
import { getViewer } from "@/lib/viewer";
import { startDirectMessage } from "../actions";
import { PeoplePicker } from "../_components/PeoplePicker";
import { SpaceCards } from "../_components/SpaceList";
import styles from "../_components/quad.module.css";

export const metadata: Metadata = { title: "Direct messages · Quad" };

export default async function DirectMessagesPage({ searchParams }: { searchParams: Promise<{ to?: string }> }) {
  const { to } = await searchParams;
  const viewer = await getViewer();
  const dms = listMySpaces(viewer).filter((s) => s.kind === "direct");
  const recipients = listRecipients(viewer);
  const initial = to && recipients.some((r) => r.id === to) ? [to] : [];

  const intro =
    viewer.role === "student"
      ? "Private messages with your teachers and school staff."
      : viewer.role === "parent"
        ? "Private conversations with teachers, staff and other families."
        : "Private conversations with colleagues and families.";

  return (
    <div className={styles.page}>
      <PageTitle title="Direct messages" description={intro} />
      <div className={styles.columns}>
        <div className={styles.column}>
          <h2 className={styles.sectionTitle}>Conversations</h2>
          <SpaceCards spaces={dms} emptyText="No conversations yet. Start one with the form." />
        </div>
        <div className={styles.column}>
          <Card title="New message">
            <PeoplePicker
              people={recipients}
              action={startDirectMessage}
              name="to"
              max={8}
              label={viewer.role === "student" ? "Which teacher?" : "Who would you like to message?"}
              submitLabel="Start conversation"
              initial={initial}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
