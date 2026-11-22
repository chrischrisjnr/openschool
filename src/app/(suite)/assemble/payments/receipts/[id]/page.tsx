import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getReceipt } from "@/lib/assemble/charges";
import { formatLongDate, formatTime } from "@/lib/format";
import { getViewer } from "@/lib/viewer";
import { ReceiptView } from "./ReceiptView";

export const metadata: Metadata = { title: "Receipt" };

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  const receipt = getReceipt(viewer, id);
  if (!receipt) notFound();
  const s = viewer.school;
  return (
    <ReceiptView
      school={{ name: s.name, suburb: s.suburb, state: s.state, abn: s.abn, phone: s.phone, email: s.email }}
      receipt={{ ...receipt, dateLabel: `${formatLongDate(receipt.date, s.timezone)} at ${formatTime(receipt.date, s.timezone)}` }}
      backHref={viewer.isStaff ? "/assemble/payments" : "/assemble/payments#history"}
    />
  );
}
