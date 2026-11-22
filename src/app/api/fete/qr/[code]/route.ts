import { and, eq, ne } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { feteCampaigns, feteParticipants } from "@/db/schema";
import { publicUrls, qrSvg } from "@/lib/fete/queries";

export const dynamic = "force-dynamic";

/**
 * Downloadable SVG QR code for a student's page. Codes are unguessable and
 * the QR only encodes the public page's URL, so no login is needed.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const row = db
    .select({ slug: feteCampaigns.slug })
    .from(feteParticipants)
    .innerJoin(feteCampaigns, eq(feteCampaigns.id, feteParticipants.campaignId))
    .where(and(eq(feteParticipants.code, code), ne(feteCampaigns.status, "draft")))
    .get();
  if (!row) return new NextResponse("Not found", { status: 404 });
  const { studentUrl } = await publicUrls(row.slug, code);
  const svg = await qrSvg(studentUrl!);
  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Content-Disposition": `attachment; filename="sponsor-me-${code}.svg"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
