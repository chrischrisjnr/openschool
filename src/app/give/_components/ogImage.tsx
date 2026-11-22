import { ImageResponse } from "next/og";
import { formatMoney } from "@/lib/format";
import { percentOf } from "@/lib/fete/tiers";

export const OG_SIZE = { width: 1200, height: 630 };

/**
 * Social preview card. Images can't read CSS variables, so this uses fixed
 * colours chosen to match Primer's display palette.
 */
export function ogCard({
  eyebrow,
  title,
  subtitle,
  raisedCents,
  goalCents,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  raisedCents: number;
  goalCents: number;
}) {
  const pct = percentOf(raisedCents, goalCents);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          color: "#ffffff",
          background: "linear-gradient(135deg, #e16f24 0%, #ce2c85 50%, #8250df 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 32, opacity: 0.92, fontWeight: 600 }}>{eyebrow}</div>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, letterSpacing: -1 }}>{title}</div>
          <div style={{ fontSize: 34, opacity: 0.95, lineHeight: 1.3, maxWidth: 980 }}>{subtitle}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 36, fontWeight: 700 }}>
            <span>{formatMoney(raisedCents, { whole: true })} raised</span>
            <span style={{ opacity: 0.9 }}>
              {pct}% of {formatMoney(goalCents, { whole: true })}
            </span>
          </div>
          <div style={{ display: "flex", height: 28, borderRadius: 14, background: "rgba(255,255,255,0.3)" }}>
            <div
              style={{
                width: `${Math.max(4, pct)}%`,
                height: 28,
                borderRadius: 14,
                background: "linear-gradient(90deg, #ffd33d, #2da44e, #0969da)",
              }}
            />
          </div>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
