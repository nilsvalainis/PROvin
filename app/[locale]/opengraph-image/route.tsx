import { ImageResponse } from "next/og";

/** Saskan ar `lib/client-report-pdf-layout-draft.ts` — `PDF_BRAND_BLUE_HEX` */
const PROVIN_BLUE = "#0061D2";

/**
 * Route Handler formāts — Vercel build meklē `…/opengraph-image/route.*`;
 * `opengraph-image.tsx` līmenī izraisīja brīdinājumu par trūkstošu `route` failu.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ locale: string }> },
) {
  await context.params;
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          background: "#ffffff",
          padding: 72,
          fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 64,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
          }}
        >
          <span style={{ color: "#000000" }}>PRO</span>
          <span style={{ color: PROVIN_BLUE }}>VIN</span>
          <span style={{ color: "#000000" }}>.LV</span>
        </div>
        <div
          style={{
            marginTop: 32,
            fontSize: 34,
            fontWeight: 500,
            color: "#424245",
            maxWidth: 920,
            lineHeight: 1.35,
          }}
        >
          VIN un sludinājuma analīze pirms auto pirkuma
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
