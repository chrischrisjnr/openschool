import type { Metadata } from "next";
import { yearLabel } from "@/lib/format";
import { groupRows } from "@/lib/fete/boards";
import { daysLeftLabel } from "@/lib/fete/dates";
import { firstNameOf, publicDonorName } from "@/lib/fete/privacy";
import { childProgress } from "@/lib/fete/progress";
import {
  getTiers,
  listCampaigns,
  listDonations,
  participationsFor,
  publicUrls,
  qrSvg,
  scoreboard,
} from "@/lib/fete/queries";
import { campaignPath, studentPath } from "@/lib/fete/share";
import { getViewer } from "@/lib/viewer";
import { FamilyHomeView, type FamilyCampaign } from "./_views/FamilyHomeView";
import { StaffHomeView } from "./_views/StaffHomeView";
import { StudentView } from "./_views/StudentView";

export const metadata: Metadata = { title: "Fete fundraising" };
export const dynamic = "force-dynamic";

export default async function FeteHome() {
  const viewer = await getViewer();
  const now = new Date();

  if (viewer.isStaff) {
    const campaigns = listCampaigns(viewer.schoolId).map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      tagline: c.tagline,
      status: c.status,
      raisedCents: c.raisedCents,
      goalCents: c.goalCents,
      participantCount: c.participantCount,
      startsAt: c.startsAt.toISOString(),
      endsAt: c.endsAt.toISOString(),
      timeLabel: c.status === "live" ? daysLeftLabel(c.endsAt, now, viewer.school.timezone) : null,
    }));
    return <StaffHomeView campaigns={campaigns} />;
  }

  // Families and students: group each child's participations by campaign.
  const rows = participationsFor(
    viewer.students.map((s) => s.id),
    viewer.schoolId,
  );
  // Live campaigns first, soonest-ending first (that's the one to share now).
  const ordered = [...rows].sort((a, b) => {
    const live = Number(b.campaign.status === "live") - Number(a.campaign.status === "live");
    if (live) return live;
    return a.campaign.status === "live"
      ? a.campaign.endsAt.getTime() - b.campaign.endsAt.getTime()
      : b.campaign.startsAt.getTime() - a.campaign.startsAt.getTime();
  });
  const byCampaign = new Map<string, typeof rows>();
  for (const r of ordered) byCampaign.set(r.campaign.id, [...(byCampaign.get(r.campaign.id) ?? []), r]);

  const campaigns: FamilyCampaign[] = [];
  for (const group of byCampaign.values()) {
    const campaign = group[0]!.campaign;
    const board = scoreboard(campaign.id);
    const tiers = getTiers(campaign.id);
    const { campaignUrl } = await publicUrls(campaign.slug);
    const children = [];
    for (const r of group) {
      const student = viewer.students.find((s) => s.id === r.participant.studentId)!;
      const progress = childProgress(board, r.participant.id, tiers);
      if (!progress) continue;
      children.push({
        participantId: r.participant.id,
        firstName: firstNameOf(student),
        detail: [yearLabel(student.yearLevel, viewer.school.state), student.className && `Class ${student.className}`].filter(Boolean).join(" · "),
        publicPath: studentPath(campaign.slug, r.participant.code),
        progress,
      });
    }
    campaigns.push({
      id: campaign.id,
      name: campaign.name,
      slug: campaign.slug,
      tagline: campaign.tagline,
      cause: campaign.cause,
      status: campaign.status,
      eventDate: campaign.eventDate,
      timeLabel: daysLeftLabel(campaign.endsAt, now, viewer.school.timezone),
      raisedCents: board.totals.raisedCents,
      goalCents: campaign.goalCents,
      publicPath: campaignPath(campaign.slug),
      campaignUrl,
      tiers,
      children,
    });
  }

  if (viewer.role === "student") {
    const live = campaigns.find((c) => c.status === "live") ?? campaigns[0];
    const me = live?.children[0];
    if (!live || !me) return <StudentView data={null} />;
    const board = scoreboard(live.id);
    const self = board.participants.find((p) => p.participantId === me.participantId)!;
    const { studentUrl } = await publicUrls(live.slug, me.progress.code);
    const donations = listDonations(live.id, { participantId: me.participantId, limit: 30 });
    return (
      <StudentView
        data={{
          firstName: me.firstName,
          campaign: { name: live.name, tagline: live.tagline, cause: live.cause, timeLabel: live.timeLabel, status: live.status },
          progress: me.progress,
          tiers: live.tiers,
          studentUrl: studentUrl!,
          qr: await qrSvg(studentUrl!),
          supporters: donations.map((d) => ({
            id: d.id,
            who: publicDonorName(d),
            message: d.message,
            amountCents: null,
            createdAt: d.createdAt.toISOString(),
          })),
          classBoard: groupRows(board.classes, self.classId, { hideEmpty: true }),
          houseBoard: groupRows(board.houses, self.houseId),
        }}
        now={now.toISOString()}
      />
    );
  }

  return (
    <FamilyHomeView
      firstNames={viewer.students.map(firstNameOf)}
      schoolName={viewer.school.shortName}
      campaigns={campaigns}
    />
  );
}
