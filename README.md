# Open Schools

**Free, open-source software for Australian school communities** — so schools can
spend their budget on students instead of software subscriptions.

Open Schools is one website with three apps that share a single login:

| | App | What it does | Replaces |
|---|---|---|---|
| 📣 | **Assemble** | Notices, calendar, permission slips & payments, attendance and absence notes | Compass, Xuno, Sentral parent portal, Operoo |
| 💬 | **Quad** | Friendly chat spaces for each class, year level, the P&C and interest groups, plus private messages with teachers | Facebook groups, WhatsApp chats, Slack |
| ❤️ | **Fete** | Fundraising for colour runs, fun runs and readathons — every student gets a page and QR code, with class, year and house leaderboards and points | Commercial fun-run fundraising platforms |

Built with GitHub's [Primer design system](https://primer.style), so it's clean,
accessible and works in light and dark mode on phones, tablets and computers.

---

## Try it on your computer (about 5 minutes)

You need [Node.js](https://nodejs.org) version 20 or newer (choose the "LTS" download).

```bash
git clone https://github.com/chrischrisjnr/openschool.git
```

```bash
cd openschool
```

```bash
npm install
```

```bash
npm run db:seed
```

```bash
npm run dev
```

Then open **http://localhost:3000**. You'll see a demo school, *Wattle Creek
Primary*, with one-click sign-in as the principal, a teacher, a parent or a student.
Every demo account uses the password `openschools`.

To wipe the demo and start again: `npm run db:reset`.

## Using it for your school

1. **Host it.** Open Schools is a normal Node.js web app with a built-in database
   file, so it runs almost anywhere: a small cloud server, a school server, or any
   host that runs Docker:

   ```bash
   docker build -t open-schools .
   ```

   ```bash
   docker run -d -p 3000:3000 -v openschools-data:/data -e DEMO_MODE=false -e APP_URL=https://your-domain open-schools
   ```

   The database lives in the `openschools-data` volume — back it up regularly (it's one file: `/data/openschools.db`).

2. **Set up.** Visit the site. With an empty database you'll be guided through
   creating your school and your administrator account.

3. **Add people.** In *School settings → Import*, upload a spreadsheet (CSV) of
   students with their class and parent/carer emails. Open Schools creates the
   classes, houses and family accounts and gives you their temporary passwords.

4. **Payments (optional).** Out of the box, payments use a safe *practice
   checkout* where no money moves. To take real card, Apple Pay and Google Pay
   payments, create a [Stripe](https://stripe.com/au) account and set
   `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` (see `.env.example`). Money
   goes straight to the school's Stripe account — Open Schools takes no cut.

All settings are listed in [`.env.example`](./.env.example).

## Privacy & child safety

- Schools host their own data. Nothing is sent to Open Schools or any third party
  (except Stripe, if you switch on real payments).
- Parents only see what's addressed to their own children's class, year level or
  house. Students can only chat in their class space and message staff — never
  other parents or students privately.
- Public fundraising pages show a student's first name and last initial only, and
  are only reachable through the student's own link or QR code.
- Quad has message reporting and a moderation queue for staff.

## For developers

- Stack: Next.js 16 (App Router), React 19, TypeScript, Primer React, SQLite via
  Drizzle ORM. No external services required.
- Read [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) before contributing — it
  explains the folder layout, permissions model and conventions.
- Useful commands: `npm run dev`, `npm run lint` (type-check), `npm test`,
  `npm run build`.

## Licence

[GNU AGPL v3](./LICENSE). You're free to use, change and share Open Schools. If
you run a modified version for others, you must share your changes under the
same licence — so improvements made by one school (or company) benefit every school.
