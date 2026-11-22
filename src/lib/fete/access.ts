import "server-only";
import { notFound, redirect } from "next/navigation";
import { getViewer, type Viewer } from "@/lib/viewer";
import { getCampaign, getParticipant, type Campaign } from "./queries";

/**
 * Permission checks for Fete. Use these at the top of every page *and* every
 * server action — never trust ids that arrive from a form or URL.
 */

/** Staff (teachers, office, principal) manage campaigns. */
export async function requireFeteStaff(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer.isStaff) redirect("/fete");
  return viewer;
}

/** A campaign at the staff member's own school, or 404. */
export async function requireStaffCampaign(campaignId: string): Promise<{ viewer: Viewer; campaign: Campaign }> {
  const viewer = await requireFeteStaff();
  const campaign = getCampaign(campaignId);
  if (!campaign || campaign.schoolId !== viewer.schoolId) notFound();
  return { viewer, campaign };
}

/**
 * A participant record belonging to one of the viewer's own children (or, for
 * a student, themselves). Staff may also view any participant at their school.
 */
export async function requireFamilyParticipant(participantId: string) {
  const viewer = await getViewer();
  const found = getParticipant(participantId);
  if (!found || found.campaign.schoolId !== viewer.schoolId || found.campaign.status === "draft") notFound();
  const child = viewer.students.find((s) => s.id === found.participant.studentId);
  if (!child && !viewer.isStaff) notFound();
  return { viewer, child, ...found };
}

/** Same as requireFamilyParticipant but for actions: only the family, never just "staff". */
export async function canEditParticipation(viewer: Viewer, participantId: string) {
  const found = getParticipant(participantId);
  if (!found || found.campaign.schoolId !== viewer.schoolId) return null;
  const isOwn = viewer.students.some((s) => s.id === found.participant.studentId);
  if (!isOwn && !viewer.isStaff) return null;
  return found;
}
