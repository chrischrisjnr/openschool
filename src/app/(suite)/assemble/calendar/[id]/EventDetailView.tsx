"use client";

import { CalendarIcon, ClockIcon, CreditCardIcon, DownloadIcon, LocationIcon, PeopleIcon } from "@primer/octicons-react";
import { LinkButton } from "@primer/react";
import type { EventCategory } from "@/db/schema";
import { ButtonLink, PageTitle } from "@/components/ui";
import { Card, RichText } from "@/components/ui/Card";
import { ConfirmButton } from "../../_components/ConfirmButton";
import { EventCategoryLabel, Row, RowList } from "../../_components/bits";
import shared from "../../_components/assemble.module.css";
import { deleteEvent } from "../actions";
import styles from "../calendar.module.css";

export function EventDetailView({
  event: e,
  items,
  canEdit,
}: {
  event: {
    id: string;
    title: string;
    description: string | null;
    location: string | null;
    category: EventCategory;
    when: string;
    audience: string;
    month: string;
  };
  items: { id: string; title: string; detail: string }[];
  canEdit: boolean;
}) {
  return (
    <div className={`${shared.stack} ${shared.narrow}`}>
      <PageTitle
        back={{ href: `/assemble/calendar?month=${e.month}`, label: "Calendar" }}
        title={e.title}
        actions={
          canEdit ? (
            <>
              <ButtonLink href={`/assemble/calendar/${e.id}/edit`} leadingIcon="pencil">
                Edit
              </ButtonLink>
              <ConfirmButton
                action={deleteEvent}
                fields={{ id: e.id }}
                title="Delete this event?"
                body="It will be removed from everyone's calendar. This can't be undone."
                confirmLabel="Delete event"
              >
                Delete
              </ConfirmButton>
            </>
          ) : undefined
        }
      />
      <Card>
        <dl className={styles.detailGrid}>
          <dt>
            <CalendarIcon /> <span className="sr-only">Category</span>
          </dt>
          <dd>
            <EventCategoryLabel category={e.category} />
          </dd>
          <dt>
            <ClockIcon /> <span className="sr-only">When</span>
          </dt>
          <dd>{e.when}</dd>
          {e.location ? (
            <>
              <dt>
                <LocationIcon /> <span className="sr-only">Where</span>
              </dt>
              <dd>{e.location}</dd>
            </>
          ) : null}
          <dt>
            <PeopleIcon /> <span className="sr-only">Who</span>
          </dt>
          <dd>{e.audience}</dd>
        </dl>
        {e.description ? (
          <div className={styles.description}>
            <RichText text={e.description} />
          </div>
        ) : null}
        <div className={styles.detailActions}>
          <LinkButton href={`/api/assemble/calendar.ics?event=${e.id}`} leadingVisual={DownloadIcon} download="">
            Add to my calendar
          </LinkButton>
        </div>
      </Card>
      {items.length ? (
        <Card title="Permission & payment" padded={false}>
          <RowList>
            {items.map((i) => (
              <Row
                key={i.id}
                href={`/assemble/payments/${i.id}`}
                leading={<CreditCardIcon />}
                title={i.title}
                meta={i.detail}
                trailing={<span className={shared.cardLink}>Open →</span>}
              />
            ))}
          </RowList>
        </Card>
      ) : null}
    </div>
  );
}
