# Open Schools — architecture

Open Schools is **one Next.js app** that contains three products sharing one
database and one login:

| Product | Path | What it replaces |
| --- | --- | --- |
| **Assemble** | `/assemble` | Compass, Xuno, Sentral parent portals — notices, calendar, permission & payments, attendance |
| **Quad** | `/quad` | Facebook groups / WhatsApp chats / Slack — community spaces & direct messages |
| **FETE** | `/fete`, public `/give/...` | School Colour Run / fun-run fundraising platforms |

A family logs in once and moves between apps with the switcher in the header.

## Stack

- **Next.js 16 (App Router) + React 19 + TypeScript (strict)**
- **[Primer](https://primer.style)** — GitHub's design system: `@primer/react`
  components, `@primer/octicons-react` icons, `@primer/primitives` CSS tokens.
- **SQLite** via `better-sqlite3` + **Drizzle ORM**. One file
  (`data/openschools.db`), zero setup. Schema in `src/db/schema.ts`.
- **Server Components** load data; **Server Actions** change data; **client
  components** render interactive Primer UI.

## Folder layout

```
src/
  app/
    (suite)/              signed-in area (header + app switcher)
      page.tsx            Open Schools home / launcher
      assemble/ quad/ fete/   one folder per product (layout.tsx sets the product nav)
      account/
    login/                sign in (+ one-click demo accounts)
    pay/[id]/             demo checkout page (no real money)
    api/payments/...      Stripe return URL + webhook
    actions/              shared server actions (auth)
  components/
    shell/                SuiteHeader, ProductLayout, ProductMark
    ui/                   PageTitle, EmptyState, SubmitButton, FormMessage,
                          AudienceSelect, ButtonLink (client)
                          Card, Stat, Grid, VStack, InitialsAvatar, RichText (server-safe)
    icons.tsx             icon registry — refer to icons by name across the server/client boundary
  db/
    schema.ts             ALL tables (core, payments, assemble, quad, fete)
    index.ts              `db` for app code (server-only)
    connection.ts         openDatabase() — used by scripts/tests
    ids.ts                newId(), shortCode()
  lib/
    auth.ts               sessions, getCurrentUser(), requireUser(roles?)
    viewer.ts             getViewer() → user + linked students + audienceKeys
                          audienceWhere(viewer, typeCol, idCol), canSeeAudience()
    audience.ts           getAudienceOptions(), parseAudience(), audienceLabel(),
                          studentIdsInAudience(), userIdsInAudience()
    payments/             startCheckout(), completePayment() — demo or Stripe
    format.ts             formatMoney(), formatDate…(), dayKey(), yearLabel()…
    form.ts               FormState type for useActionState + zodToFormState()
    summary.ts            HomeSummary type for the home-page cards
    assemble/ quad/ fete/ per-product server logic (queries, actions, summary.ts)
scripts/
  seed.ts, seed/*.ts      demo school (npm run db:seed / db:reset)
drizzle/                  SQL migrations (generated: npx drizzle-kit generate)
```

## Conventions

**Data loading.** Pages are async server components. Call `getViewer()` (or
`requireUser([...roles])`) first, query with Drizzle, then pass *plain,
serialisable* props to a `*View.tsx` client component that renders Primer.
Never pass functions or icon components from a server to a client component —
pass an `IconName` string instead (`src/components/icons.tsx`).

**Mutations.** Put server actions in `actions.ts` files with `"use server"`.
Every action must re-check permissions itself (`requireUser`, `getViewer`) —
never trust ids from the form without checking the viewer can access them.
Validate input with `zod`. Return `FormState` (`src/lib/form.ts`) for forms
using `useActionState`; call `revalidatePath()` after writes.

**Permissions.**
- `admin` — everything, including settings and money.
- `staff` — teachers; can post, mark rolls, moderate.
- `parent` — sees things addressed to their children's year / class / house
  or the whole school; acts on behalf of their own children only.
- `student` — sees their own things.
Use `audienceWhere()` in queries and `canSeeAudience()` for single records.

**Money** is integer cents, AUD. Use `formatMoney()` and `parseMoneyToCents()`.
All payments go through `startCheckout()` in `src/lib/payments` — see the
comment at the top of that file. Demo mode works with no setup; set
`STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` for real payments.

**Dates.** Store moments as `Date` (timestamp_ms). Calendar days are
`YYYY-MM-DD` strings from `dayKey()` in the school's timezone. Format with the
helpers in `format.ts` (Australian English).

**Styling.** Use Primer components first. For layout, use CSS Modules next to
the component and *only* Primer CSS variables (`var(--fgColor-muted)`,
`var(--base-size-16)`, `var(--borderRadius-large)` …) so light and dark mode
just work. No Tailwind, no hard-coded colours. Product accents:
`--os-assemble`, `--os-quad`, `--os-fete`.

**Accessibility.** Every form control has a label (`FormControl.Label`),
interactive things are buttons or links, colour is never the only signal, and
pages have one `h1` (via `PageTitle`).

**Language.** Plain, warm Australian English. "Families" not "users",
"Foundation/Prep" via `yearLabel()`, "$" for AUD.

## Database changes

1. Edit `src/db/schema.ts`.
2. `npx drizzle-kit generate --name <what-changed>`
3. Migrations apply automatically on start.
