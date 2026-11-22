import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { getCampaign, listDonations } from "@/lib/fete/queries";

export const dynamic = "force-dynamic";

/** Quote a CSV cell and neutralise spreadsheet formula injection. */
function cell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/** Staff-only CSV export of every donation in a campaign. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || !isStaff(user)) return new NextResponse("Not allowed", { status: 403 });
  const campaign = getCampaign(id);
  if (!campaign || campaign.schoolId !== user.schoolId) return new NextResponse("Not found", { status: 404 });

  const rows = listDonations(campaign.id, { includeAll: true });
  const header = ["Date", "Amount (AUD)", "Status", "Method", "Donor name", "Donor email", "Hide name publicly", "Message", "Student", "Class"];
  const lines = [header.map(cell).join(",")];
  for (const d of rows) {
    lines.push(
      [
        d.createdAt.toISOString(),
        (d.amountCents / 100).toFixed(2),
        d.status,
        d.method,
        d.donorName,
        d.donorEmail,
        d.anonymous ? "yes" : "no",
        d.message,
        d.participantId ? `${d.studentPreferredName ?? d.studentFirstName} ${d.studentLastName}` : "(general donation)",
        d.className,
      ]
        .map(cell)
        .join(","),
    );
  }
  const filename = `${campaign.slug}-donations-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(`﻿${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
