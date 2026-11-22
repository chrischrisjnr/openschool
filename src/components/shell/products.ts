export type ProductKey = "assemble" | "quad" | "fete";

export const PRODUCTS: Record<
  ProductKey,
  { name: string; href: string; tagline: string; description: string }
> = {
  assemble: {
    name: "Assemble",
    href: "/assemble",
    tagline: "School ↔ family",
    description:
      "Notices, calendar, permission slips, payments and attendance — everything the school needs to tell families, in one calm place.",
  },
  quad: {
    name: "Quad",
    href: "/quad",
    tagline: "Community chat",
    description:
      "Friendly spaces for your class, year level, P&C and interest groups, plus private messages with teachers.",
  },
  fete: {
    name: "FETE",
    href: "/fete",
    tagline: "Fundraising",
    description:
      "Run a fun run, colour run or readathon. Every student gets a page and QR code, with live class and house leaderboards.",
  },
};
