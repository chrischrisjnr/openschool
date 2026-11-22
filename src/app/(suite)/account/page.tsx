import type { Metadata } from "next";
import { getViewer } from "@/lib/viewer";
import { yearLabel } from "@/lib/format";
import { AccountView } from "./AccountView";

export const metadata: Metadata = { title: "Your account" };

export default async function AccountPage() {
  const viewer = await getViewer();
  return (
    <AccountView
      name={viewer.name}
      email={viewer.email}
      role={viewer.role}
      schoolName={viewer.school.name}
      students={viewer.students.map((s) => ({
        id: s.id,
        name: s.displayName,
        detail: [yearLabel(s.yearLevel, viewer.school.state), s.className && `Class ${s.className}`].filter(Boolean).join(" · "),
      }))}
    />
  );
}
