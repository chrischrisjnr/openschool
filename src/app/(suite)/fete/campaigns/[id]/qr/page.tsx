import type { Metadata } from "next";
import { requireStaffCampaign } from "@/lib/fete/access";
import { publicStudentName } from "@/lib/fete/privacy";
import { publicUrls, qrSvg, scoreboard } from "@/lib/fete/queries";
import { displayUrl, studentPath } from "@/lib/fete/share";
import { QrCode } from "../../../_components/Visuals";
import styles from "../campaign.module.css";
import { Banner, QrToolbar } from "./QrToolbar";

export const metadata: Metadata = { title: "QR sheets" };
export const dynamic = "force-dynamic";

const PER_PAGE = 12; // 3 × 4 cards on A4

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Printable A4 sheets of cut-out QR cards, one class per page. */
export default async function QrSheetsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ class?: string }>;
}) {
  const { id } = await params;
  const { class: classParam } = await searchParams;
  const { campaign } = await requireStaffCampaign(id);
  const board = scoreboard(campaign.id);
  const classes = board.classes.filter((c) => c.participantCount > 0);
  const selected = classParam === "all" ? "all" : (classes.find((c) => c.id === classParam)?.id ?? classes[0]?.id ?? "all");
  const { base } = await publicUrls(campaign.slug);

  const shown = selected === "all" ? classes : classes.filter((c) => c.id === selected);
  const sheets = await Promise.all(
    shown.map(async (c) => {
      const kids = board.participants
        .filter((p) => p.classId === c.id)
        .sort((a, b) => a.firstName.localeCompare(b.firstName));
      const cards = await Promise.all(
        kids.map(async (p) => {
          const url = `${base}${studentPath(campaign.slug, p.code)}`;
          return { id: p.participantId, name: publicStudentName(p), url, svg: await qrSvg(url) };
        }),
      );
      return { id: c.id, name: c.name, pages: chunk(cards, PER_PAGE) };
    }),
  );

  return (
    <div className={styles.printRoot}>
      <div className={styles.noPrint}>
        {campaign.status === "draft" ? (
          <Banner>
            This campaign is still a draft — the QR codes will work once you press Go live.
          </Banner>
        ) : null}
        <QrToolbar
          classes={classes.map((c) => ({ id: c.id, name: c.name, count: c.participantCount }))}
          selected={selected}
        />
      </div>
      {sheets.length === 0 ? <p className={styles.muted}>Enrol students first to print their QR cards.</p> : null}
      {sheets.map((s) =>
        s.pages.map((page, i) => (
          <section key={`${s.id}-${i}`} aria-label={`Class ${s.name} QR cards${s.pages.length > 1 ? `, page ${i + 1}` : ""}`}>
            <h2 className={styles.sheetHeading}>
              Class {s.name}
              {s.pages.length > 1 ? ` (page ${i + 1} of ${s.pages.length})` : ""}
            </h2>
            <div className={styles.sheetPage}>
              {page.map((card) => (
                <div key={card.id} className={styles.qrCard}>
                  <span className={styles.qrCardEvent}>{campaign.name}</span>
                  <span className={styles.qrCardName}>{card.name}</span>
                  <span className={styles.qrCardClass}>Class {s.name}</span>
                  <span className={styles.qrCardQr}>
                    <QrCode svg={card.svg} label={`QR code for ${card.name}`} />
                  </span>
                  <span className={styles.qrCardCta}>Scan to sponsor me! 🌈</span>
                  <span className={styles.qrCardUrl}>{displayUrl(card.url)}</span>
                </div>
              ))}
            </div>
          </section>
        )),
      )}
    </div>
  );
}
