import type { Metadata } from "next";
import { familyCharges, listItems, paymentHistory } from "@/lib/assemble/charges";
import { formatDate, formatShortDate } from "@/lib/format";
import { getViewer } from "@/lib/viewer";
import { FamilyPayments, StaffPayments, type ChargeView } from "./PaymentsView";

export const metadata: Metadata = { title: "Forms & payments" };

type Status = "success" | "cancelled" | "processing";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; show?: string }>;
}) {
  const viewer = await getViewer();
  const sp = await searchParams;
  const tz = viewer.school.timezone;
  const status = (["success", "cancelled", "processing"] as const).find((s) => s === sp.status) ?? null;

  if (viewer.isStaff) {
    const items = listItems(viewer);
    const show = sp.show === "closed" ? "closed" : "open";
    return (
      <StaffPayments
        show={show}
        openCount={items.filter((i) => !i.closed).length}
        closedCount={items.filter((i) => i.closed).length}
        items={items
          .filter((i) => (show === "closed" ? i.closed : !i.closed))
          .map((i) => ({ ...i, due: i.dueAt ? formatShortDate(i.dueAt, tz) : null, overdue: !!i.dueAt && i.dueAt < new Date() }))}
        showMoney={viewer.isAdmin}
      />
    );
  }

  const now = new Date();
  const charges: ChargeView[] = familyCharges(viewer).map((c) => ({
    ...c,
    due: c.dueAt ? formatShortDate(c.dueAt, tz) : null,
    overdue: !!c.dueAt && c.dueAt < now && c.needsAction,
    paidOn: c.paidAt ? formatShortDate(c.paidAt, tz) : null,
  }));
  return (
    <FamilyPayments
      status={status as Status | null}
      canAct={viewer.role === "parent"}
      kids={viewer.students.map((s) => ({ id: s.id, name: s.preferredName ?? s.firstName, fullName: s.displayName, className: s.className }))}
      charges={charges}
      history={paymentHistory(viewer).map((h) => ({ ...h, dateLabel: formatDate(h.date, tz) }))}
    />
  );
}
