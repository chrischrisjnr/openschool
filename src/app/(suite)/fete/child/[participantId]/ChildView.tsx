"use client";

import { DownloadIcon } from "@primer/octicons-react";
import { FormControl, Label, LinkButton, TextInput, Textarea } from "@primer/react";
import { useActionState } from "react";
import { ButtonLink, FormMessage, PageTitle, SubmitButton } from "@/components/ui";
import { Card } from "@/components/ui/Card";
import { formatMoney } from "@/lib/format";
import { ordinal, type ChildProgress } from "@/lib/fete/progress";
import { displayUrl } from "@/lib/fete/share";
import type { PrizeTier } from "@/lib/fete/tiers";
import { updateParticipation } from "../../actions";
import { keepValuesOnSubmit } from "../../_components/useKeepValues";
import { ShareActions } from "../../_components/ShareActions";
import { DonationList, ProgressRing, QrCode, Swatch, TierBadges, type DonationItem } from "../../_components/Visuals";
import styles from "../../_views/views.module.css";

export function ChildView({
  participantId,
  firstName,
  canEdit,
  campaign,
  schoolName,
  progress: p,
  tiers,
  studentUrl,
  publicPath,
  qr,
  qrDownload,
  donations,
  now,
}: {
  participantId: string;
  firstName: string;
  canEdit: boolean;
  campaign: { name: string; status: string; cause: string | null; timeLabel: string };
  schoolName: string;
  progress: ChildProgress;
  tiers: PrizeTier[];
  studentUrl: string;
  publicPath: string;
  qr: string;
  qrDownload: string;
  donations: DonationItem[];
  now: string;
}) {
  const [state, action] = useActionState(updateParticipation, undefined);
  const shareMessage = `${firstName} is taking part in the ${schoolName} ${campaign.name}${campaign.cause ? ` to raise money for ${campaign.cause.toLowerCase()}` : ""}. Please sponsor ${firstName}!`;

  return (
    <>
      <PageTitle
        back={{ href: "/fete", label: "Fundraising" }}
        title={`${firstName}’s ${campaign.name}`}
        description={campaign.status === "live" ? `${campaign.timeLabel} · Share this page with family and friends so they can sponsor ${firstName}.` : "This fundraiser has finished — thank you!"}
        actions={
          <>
            <ButtonLink href={publicPath} leadingIcon="link">
              View page
            </ButtonLink>
            {campaign.status === "live" ? (
              <ButtonLink href={`${publicPath}#donate`} variant="primary" leadingIcon="heart">
                Donate yourself
              </ButtonLink>
            ) : null}
          </>
        }
      />

      <div className={styles.childLayout}>
        <div className={styles.stack}>
          <Card title="Progress">
            <div className={styles.stackSmall}>
              <div className={styles.progressPanel}>
                <ProgressRing raisedCents={p.raisedCents} goalCents={p.goalCents} size={136} stroke={14} />
                <div>
                  <div className={styles.bigNumber}>{formatMoney(p.raisedCents, { whole: true })}</div>
                  <div className={styles.muted}>
                    raised of {formatMoney(p.goalCents, { whole: true })} goal · {p.donationCount} {p.donationCount === 1 ? "supporter" : "supporters"}
                  </div>
                </div>
              </div>
              <dl className={styles.facts}>
                <div className={styles.fact}>
                  <dt>Points</dt>
                  <dd>{p.points.toLocaleString("en-AU")}</dd>
                </div>
                <div className={styles.fact}>
                  <dt>In {p.className ?? "class"}</dt>
                  <dd>{p.classRank ? `${ordinal(p.classRank.rank)} of ${p.classRank.of}` : "—"}</dd>
                </div>
                <div className={styles.fact}>
                  <dt>
                    <Swatch color={p.houseColor} /> {p.houseName ?? "House"}
                  </dt>
                  <dd>{p.housePlace ? `${ordinal(p.housePlace.rank)} of ${p.housePlace.of}` : "—"}</dd>
                </div>
              </dl>
            </div>
          </Card>

          {tiers.length ? (
            <Card
              title="Prizes"
              action={p.nextTier ? <Label variant="severe">{formatMoney(p.toNextCents, { whole: true })} to {p.nextTier.emoji} {p.nextTier.name}</Label> : null}
            >
              <TierBadges tiers={tiers} raisedCents={p.raisedCents} />
            </Card>
          ) : null}

          {canEdit ? (
            <Card title={`Edit ${firstName}’s page`}>
              <form action={action} onSubmit={keepValuesOnSubmit(action)} className={styles.stackSmall}>
                <input type="hidden" name="participantId" value={participantId} />
                <FormControl>
                  <FormControl.Label>Message to supporters</FormControl.Label>
                  <Textarea
                    name="pitch"
                    block
                    rows={4}
                    maxLength={500}
                    defaultValue={p.pitch ?? ""}
                    placeholder={`e.g. Hi! I'm running in the ${campaign.name} to help my school. Every dollar helps — thank you!`}
                  />
                  <FormControl.Caption>Shown on {firstName}’s public page. Avoid surnames, addresses or other personal details.</FormControl.Caption>
                  {state?.fieldErrors?.pitch ? <FormControl.Validation variant="error">{state.fieldErrors.pitch}</FormControl.Validation> : null}
                </FormControl>
                <FormControl>
                  <FormControl.Label>Personal goal</FormControl.Label>
                  <TextInput name="goal" leadingVisual="$" inputMode="decimal" defaultValue={String(p.goalCents / 100)} style={{ maxWidth: 160 }} />
                  {state?.fieldErrors?.goal ? <FormControl.Validation variant="error">{state.fieldErrors.goal}</FormControl.Validation> : null}
                </FormControl>
                <FormMessage state={state} />
                <div>
                  <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
                </div>
              </form>
            </Card>
          ) : null}

          <Card title={`Supporters (${donations.length})`}>
            {donations.length ? (
              <DonationList items={donations} now={now} />
            ) : (
              <p className={styles.muted}>No donations yet. Share the link to get the first one!</p>
            )}
          </Card>
        </div>

        <div className={styles.stack}>
          <Card title="Share">
            <div className={styles.stackSmall}>
              <div className={styles.qrPanel}>
                <div className={styles.qrBox}>
                  <QrCode svg={qr} label={`QR code linking to ${firstName}'s sponsorship page`} />
                </div>
                <span className={styles.muted}>{displayUrl(studentUrl)}</span>
                <LinkButton href={qrDownload} download="sponsor-qr.svg" size="small" leadingVisual={DownloadIcon}>
                  Download QR code
                </LinkButton>
              </div>
              <ShareActions url={studentUrl} message={shareMessage} title={`Sponsor ${firstName}`} />
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
