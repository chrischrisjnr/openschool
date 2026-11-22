import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RichText } from "@/components/ui/Card";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { formatLongDate, formatMoney, pluralise } from "@/lib/format";
import { publicBoards } from "@/lib/fete/boards";
import { daysLeftLabel } from "@/lib/fete/dates";
import { publicDonorName } from "@/lib/fete/privacy";
import { getCampaignBySlug, getDonationByPayment, listDonations, scoreboard } from "@/lib/fete/queries";
import { percentOf } from "@/lib/fete/tiers";
import { activeProvider } from "@/lib/payments";
import { Leaderboard } from "../../(suite)/fete/_components/Leaderboard";
import { DonationList, Thermometer } from "../../(suite)/fete/_components/Visuals";
import { DonateForm } from "../_components/DonateForm";
import { Notice } from "../_components/Notice";
import { Hero, PublicBar, PublicFooter } from "../_components/Shell";
import { ThankYou } from "../_components/ThankYou";
import styles from "../give.module.css";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ payment?: string; status?: string }>;
};

/** Live campaigns are public; drafts only for the school's own staff (preview). */
async function load(slug: string) {
  const found = getCampaignBySlug(slug);
  if (!found) return null;
  if (found.campaign.status === "draft") {
    const user = await getCurrentUser();
    if (!user || !isStaff(user) || user.schoolId !== found.school.id) return null;
  }
  return found;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const found = await load(slug);
  if (!found) return { title: "Fundraiser not found" };
  const { campaign, school } = found;
  const board = scoreboard(campaign.id);
  const description = `${campaign.tagline ?? `Support ${school.name}.`}${campaign.cause ? ` Raising money for ${campaign.cause.toLowerCase()}.` : ""} ${formatMoney(board.totals.raisedCents, { whole: true })} raised so far!`;
  const title = `${campaign.name} · ${school.shortName}`;
  return {
    title: { absolute: title },
    description,
    openGraph: { title, description, type: "website", siteName: school.name, locale: "en_AU" },
    twitter: { card: "summary_large_image", title, description },
    robots: campaign.status === "draft" ? { index: false } : undefined,
  };
}

export default async function CampaignPublicPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { payment, status } = await searchParams;
  const found = await load(slug);
  if (!found) notFound();
  const { campaign, school } = found;
  const tz = school.timezone;
  const now = new Date();
  const board = scoreboard(campaign.id);
  const t = board.totals;
  const recent = listDonations(campaign.id, { limit: 8 });
  const live = campaign.status === "live";

  // Returning from checkout: only trust a payment that belongs to this page.
  const donation = payment ? getDonationByPayment(payment) : undefined;
  const mine = donation && donation.campaignId === campaign.id && donation.participantId === null ? donation : undefined;

  return (
    <>
      <PublicBar schoolName={school.shortName} homeHref={`/give/${campaign.slug}`} />
      <Hero
        eyebrow={school.name}
        title={campaign.name}
        tagline={campaign.tagline}
        chips={[
          campaign.cause ? `🎯 ${campaign.cause}` : null,
          campaign.eventDate ? `📅 ${formatLongDate(`${campaign.eventDate}T12:00:00`, tz)}` : null,
          live ? `⏳ ${daysLeftLabel(campaign.endsAt, now, tz)}` : campaign.status === "closed" ? "🏁 Finished" : "📝 Preview",
        ]}
      />
      <main id="main" className={styles.body}>
        {campaign.status === "draft" ? <Notice tone="warning">Staff preview — this page isn’t public until the campaign goes live.</Notice> : null}
        {campaign.status === "closed" ? (
          <Notice tone="success">
            This fundraiser has finished. Together we raised {formatMoney(t.raisedCents, { whole: true })} — thank you, everyone! 🎉
          </Notice>
        ) : null}

        {mine && status === "success" ? (
          <ThankYou
            name={mine.anonymous ? null : mine.donorName.split(" ")[0]!}
            amountCents={mine.amountCents}
            confirmed={mine.status === "succeeded"}
            recipient={school.shortName}
            shareUrl={`/give/${campaign.slug}`}
            shareMessage={`I just donated to the ${school.shortName} ${campaign.name}! Join me:`}
          />
        ) : null}
        {mine && status === "cancelled" ? <Notice tone="info">No worries — your donation was cancelled and you haven’t been charged.</Notice> : null}

        <section className={styles.panel} aria-label="Fundraising progress">
          <Thermometer raisedCents={t.raisedCents} goalCents={campaign.goalCents} size="large" label="raised" />
          <div className={styles.stats}>
            <div className={styles.statBox}>
              <div className={styles.statValue}>{t.donorCount.toLocaleString("en-AU")}</div>
              <div className={styles.statLabel}>supporters</div>
            </div>
            <div className={styles.statBox}>
              <div className={styles.statValue}>{t.participantCount.toLocaleString("en-AU")}</div>
              <div className={styles.statLabel}>students taking part</div>
            </div>
            <div className={styles.statBox}>
              <div className={styles.statValue}>{percentOf(t.raisedCents, campaign.goalCents)}%</div>
              <div className={styles.statLabel}>of our goal</div>
            </div>
          </div>
          {live ? (
            <p className={styles.muted} style={{ margin: 0 }}>
              Got a link or QR code from a student? Use that to sponsor them — their class and house earn points! Or give to the school directly below.
            </p>
          ) : null}
        </section>

        {campaign.description || campaign.cause ? (
          <section className={styles.panel} aria-labelledby="about">
            <h2 id="about" className={styles.panelTitle}>
              About the {campaign.name}
            </h2>
            {campaign.cause ? (
              <p style={{ margin: 0 }}>
                <strong>Where the money goes:</strong> {campaign.cause}
              </p>
            ) : null}
            {campaign.description ? <RichText text={campaign.description} /> : null}
          </section>
        ) : null}

        <div className={styles.two}>
          <section className={styles.panel} aria-labelledby="leaders">
            <h2 id="leaders" className={styles.panelTitle}>
              🏆 Leaderboard
            </h2>
            <Leaderboard boards={publicBoards(board)} limit={12} label="Leaderboard" />
          </section>
          <section className={styles.panel} aria-labelledby="recent">
            <h2 id="recent" className={styles.panelTitle}>
              💛 Recent supporters
            </h2>
            {recent.length ? (
              <DonationList
                now={now.toISOString()}
                items={recent.map((d) => ({
                  id: d.id,
                  who: publicDonorName(d),
                  // Child privacy: no student names on the campaign page.
                  forLabel: d.participantId ? `sponsored a student${d.className ? ` in ${d.className}` : ""}` : "gave to the school",
                  message: d.message,
                  amountCents: d.amountCents,
                  createdAt: d.createdAt.toISOString(),
                }))}
              />
            ) : (
              <p className={styles.muted}>Be the very first supporter!</p>
            )}
            {t.donationCount > recent.length ? <p className={styles.muted}>…and {pluralise(t.donationCount - recent.length, "more donation")}.</p> : null}
          </section>
        </div>

        {live ? (
          <section id="donate" className={`${styles.panel} ${styles.donate}`} aria-labelledby="donate-title">
            <h2 id="donate-title" className={styles.panelTitle}>
              💝 Donate to {school.shortName}
            </h2>
            <DonateForm campaignSlug={campaign.slug} recipient={school.shortName} demoMode={activeProvider() === "demo"} />
          </section>
        ) : null}
      </main>
      <PublicFooter schoolName={school.name} abn={school.abn} />
    </>
  );
}
