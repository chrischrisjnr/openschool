"use client";

import { Button, UnderlineNav } from "@primer/react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { icons } from "@/components/icons";
import { ButtonLink, PageTitle } from "@/components/ui";
import { setCampaignStatus } from "../../actions";
import { StatusLabel, type CampaignStatus } from "../../_views/StaffHomeView";
import styles from "./campaign.module.css";

const TABS = [
  { path: "", label: "Overview", icon: icons.graph },
  { path: "/donations", label: "Donations", icon: icons.heart },
  { path: "/participants", label: "Students", icon: icons.people },
  { path: "/points", label: "Points", icon: icons.star },
  { path: "/prizes", label: "Prizes", icon: icons.gift },
  { path: "/qr", label: "QR sheets", icon: icons.mobile },
  { path: "/settings", label: "Settings", icon: icons.gear },
];

function StatusButton({ id, to, children, variant }: { id: string; to: CampaignStatus; children: string; variant?: "primary" | "danger" | "default" }) {
  return (
    <form action={setCampaignStatus}>
      <input type="hidden" name="campaignId" value={id} />
      <input type="hidden" name="status" value={to} />
      <Button type="submit" variant={variant ?? "default"}>
        {children}
      </Button>
    </form>
  );
}

export function CampaignHeader({
  id,
  name,
  slug,
  status,
  dates,
  timeLabel,
}: {
  id: string;
  name: string;
  slug: string;
  status: CampaignStatus;
  dates: string;
  timeLabel: string | null;
}) {
  const pathname = usePathname();
  const base = `/fete/campaigns/${id}`;
  return (
    <div className={styles.header}>
      <PageTitle
        back={{ href: "/fete", label: "All campaigns" }}
        title={
          <span className={styles.titleRow}>
            {name} <StatusLabel status={status} />
          </span>
        }
        description={`${dates}${timeLabel ? ` · ${timeLabel}` : ""}`}
        actions={
          <>
            {status !== "draft" ? (
              <ButtonLink href={`/give/${slug}`} leadingIcon="link" target="_blank">
                Public page
              </ButtonLink>
            ) : null}
            {status === "draft" ? <StatusButton id={id} to="live" variant="primary">Go live 🚀</StatusButton> : null}
            {status === "live" ? <StatusButton id={id} to="closed">Close campaign</StatusButton> : null}
            {status === "closed" ? <StatusButton id={id} to="live">Reopen</StatusButton> : null}
          </>
        }
      />
      <UnderlineNav aria-label="Campaign sections">
        {TABS.map((t) => {
          const href = `${base}${t.path}`;
          const active = t.path === "" ? pathname === base : pathname.startsWith(href);
          return (
            <UnderlineNav.Item key={t.path} as={NextLink} href={href} icon={t.icon} aria-current={active ? "page" : undefined}>
              {t.label}
            </UnderlineNav.Item>
          );
        })}
      </UnderlineNav>
    </div>
  );
}
