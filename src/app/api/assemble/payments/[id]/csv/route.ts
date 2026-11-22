import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canManageItem, itemDetail } from "@/lib/assemble/charges";
import { dayKey } from "@/lib/format";
import { getViewer } from "@/lib/viewer";

/** CSV of every student's permission and payment status for one item (staff only). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentUser())) return new NextResponse("Please sign in.", { status: 401 });
  const viewer = await getViewer();
  if (!viewer.isStaff) return new NextResponse("Staff only.", { status: 403 });
  const { id } = await params;
  const detail = itemDetail(viewer, id);
  if (!detail) return new NextResponse("Not found.", { status: 404 });

  const { item, rows } = detail;
  const tz = viewer.school.timezone;
  const money = viewer.isAdmin || canManageItem(viewer, item);
  const header = ["Student", "Class", "Year", "Permission", "Permission given by", "Payment status", "Amount", "Paid on", "Method"];
  const lines = rows.map((r) => [
    r.studentName,
    r.className ?? "",
    String(r.yearLevel),
    r.consent ?? "",
    r.consent && r.consent !== "pending" ? (r.consentByName ?? "") : "",
    item.amountCents > 0 ? (r.status === "waived" ? "no charge" : r.status) : "",
    item.amountCents > 0 && money ? (r.amountCents / 100).toFixed(2) : "",
    r.paidAt ? dayKey(r.paidAt, tz) : "",
    r.method ?? "",
  ]);
  const csv = [header, ...lines].map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
  const slug = item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "item";
  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}

/** Quote a CSV cell and neutralise spreadsheet formulas. */
function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
