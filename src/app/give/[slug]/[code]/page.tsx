import type { Metadata } from "next";
import NextLink from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { formatMoney } from "@/lib/format";
import { daysLeftLabel } from "@/lib/fete/dates";
import { firstNameOf, publicDonorName, publicStudentName } from "@/lib/fete/privacy";
import { getDonationByPayment, getParticipantByCode, getTiers, listDonations, scoreboard } from "@/lib/fete/queries";
import { tierProgress } from "@/lib/fete/tiers";
import { activeProvider } from "@/lib/payments";
import { DonationList, ProgressRing, TierBadges } from "../../../(suite)/fete/_components/Visuals";
import { DonateForm } from "../../_components/DonateForm";
import { Notice } from "../../_components/Notice";
import { Hero, PublicBar, PublicFooter } from "../../_components/Shell";
import { ThankYou } from "../../_components/ThankYou";
import styles from "../../give.module.css";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string; code: string }>;
  searchParams: Promise<{ payment?: string; status?: string }>;
};

async function load(slug: string, code: string) {
  const found = getParticipantByCode(slug, code);
  if (!found) return null;
  if (found.campaign.status === "draft") {
    const user = await getCurrentUser();
    if (!user || !isStaff(user) || user.schoolId !== found.school.id) return null;
  }
  return found;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, code } = await params;
  const found = await load(slug, code);
  if (!found) return { title: "Page not found" };
  const name = publicStudentName(found.student);
  const first = firstNameOf(found.student);
  const title = `Sponsor ${name} in the ${found.campaign.name}`;
  const description = `${first} is raising money for ${found.school.shortName}${found.campaign.cause ? ` — ${found.campaign.cause.toLowerCase()}` : ""}. Every dollar helps! 🌈`;
  return {
    title: { absolute: title },
    description,
    openGraph: { title, description, type: "website", siteName: found.school.name, locale: "en_AU" },
    twitter: { card: "summary_large_image", title, description },
    // Children's pages are shared by link, never listed by search engines.
    robots: { index: false, follow: false },
  };
}

export default async function StudentPublicPage({ params, searchParams }: Props) {
  const { slug, code } = await params;
  const { payment, status } = await searchParams;
  const found = await load(slug, code);
  if (!found) notFound();
  const { campaign, school, participant, student } = found;
  const tz = school.timezone;
  const now = new Date();
  const name = publicStudentName(student);
  const first = firstNameOf(student);
  const board = scoreboard(campaign.id);
  const me = board.participants.find((p) => p.participantId === participant.id)!;
  const tiers = getTiers(campaign.id);
  const tp = tierProgress(me.raisedCents, tiers);
  const supporters = listDonations(campaign.id, { participantId: participant.id, limit: 20 });
  const live = campaign.status === "live";
  const selfPath = `/give/${campaign.slug}/${participant.code}`;

  const donation = payment ? getDonationByPayment(payment) : undefined;
  const mine = donation && donation.participantId === participant.id ? donation : undefined;

  return (
    <>
      <PublicBar schoolName={school.shortName} homeHref={`/give/${campaign.slug}`} />
      <Hero
        eyebrow={`${school.shortName} · ${campaign.name}`}
        title={`Sponsor ${first}!`}
        tagline={campaign.cause ? `Help ${first} raise money for ${campaign.cause.toLowerCase()}.` : campaign.tagline}
        chips={[
          found.className ? `🏫 Class ${found.className}` : null,
          found.houseName ? `🏠 ${found.houseName} house` : null,
          live ? `⏳ ${daysLeftLabel(campaign.endsAt, now, tz)}` : campaign.status === "closed" ? "🏁 Finished" : "📝 Preview",
        ]}
      />
      <main id="main" className={styles.body}>
        {campaign.status === "draft" ? <Notice tone="warning">Staff preview — this page isn’t public until the campaign goes live.</Notice> : null}
        {campaign.status === "closed" ? (
          <Notice tone="success">
            The {campaign.name} has finished — {first} raised {formatMoney(me.raisedCents, { whole: true })}. Thank you to every supporter! 🎉
          </Notice>
        ) : null}

        {mine && status === "success" ? (
          <ThankYou
            name={mine.donorName.split(" ")[0]!}
            amountCents={mine.amountCents}
            confirmed={mine.status === "succeeded"}
            recipient={first}
            shareUrl={selfPath}
            shareMessage={`I just sponsored ${first} in the ${school.shortName} ${campaign.name}! You can too:`}
          />
        ) : null}
        {mine && status === "cancelled" ? <Notice tone="info">No worries — your donation was cancelled and you haven’t been charged. You can try again below.</Notice> : null}

        <section className={styles.panel} aria-label={`${name}'s progress`}>
          <div className={styles.studentTop}>
            <span className={styles.avatar} aria-hidden>
              {first.charAt(0)}
            </span>
            <div>
              <h2 className={styles.studentName}>{name}</h2>
              <div className={styles.muted}>
                {found.className ? `Class ${found.className} · ` : ""}
                {school.shortName}
              </div>
            </div>
          </div>
          <p className={styles.bubble}>
            {participant.pitch ??
              `Hi! I'm taking part in the ${campaign.name} to raise money for my school${campaign.cause ? ` — ${campaign.cause.toLowerCase()}` : ""}. Thank you for sponsoring me!`}
          </p>
          <div className={styles.progressRow}>
            <ProgressRing raisedCents={me.raisedCents} goalCents={me.goalCents} size={112} stroke={12} />
            <div>
              <div className={styles.raised}>{formatMoney(me.raisedCents, { whole: true })}</div>
              <div className={styles.muted}>
                raised of {formatMoney(me.goalCents, { whole: true })} goal · {supporters.length} {supporters.length === 1 ? "supporter" : "supporters"}
              </div>
            </div>
          </div>
          {tp.next ? (
            <p className={styles.nextPrize}>
              {tp.current ? `${tp.current.emoji} ${first} has unlocked ${tp.current.name}! ` : ""}
              Just {formatMoney(tp.toNextCents, { whole: true })} more to unlock {tp.next.emoji} <strong>{tp.next.name}</strong>.
            </p>
          ) : tp.current ? (
            <p className={styles.nextPrize}>🦄 {first} has unlocked every prize — wow!</p>
          ) : null}
        </section>

        {live ? (
          <section id="donate" className={`${styles.panel} ${styles.donate}`} aria-labelledby="donate-title">
            <h2 id="donate-title" className={styles.panelTitle}>
              💝 Sponsor {first}
            </h2>
            <DonateForm campaignSlug={campaign.slug} code={participant.code} recipient={first} demoMode={activeProvider() === "demo"} />
          </section>
        ) : null}

        <div className={styles.two}>
          <section className={styles.panel} aria-labelledby="supporters">
            <h2 id="supporters" className={styles.panelTitle}>
              💛 {first}’s supporters
            </h2>
            {supporters.length ? (
              <DonationList
                now={now.toISOString()}
                items={supporters.map((d) => ({
                  id: d.id,
                  who: publicDonorName(d),
                  message: d.message,
                  amountCents: d.amountCents,
                  createdAt: d.createdAt.toISOString(),
                }))}
              />
            ) : (
              <p className={styles.muted}>Be {first}’s first supporter! 🌟</p>
            )}
          </section>
          {tiers.length ? (
            <section className={styles.panel} aria-labelledby="prizes">
              <h2 id="prizes" className={styles.panelTitle}>
                🎁 Prizes {first} can unlock
              </h2>
              <TierBadges tiers={tiers} raisedCents={me.raisedCents} />
            </section>
          ) : null}
        </div>

        <p className={styles.fine}>
          <NextLink href={`/give/${campaign.slug}`}>See how the whole school is going →</NextLink>
        </p>
      </main>
      <PublicFooter schoolName={school.name} abn={school.abn} />
    </>
  );
}
