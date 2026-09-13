import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

const PROVIN_BLUE = "#0061D2";

/** Kvadrātisks zīmola logo Google Search / Organization JSON-LD. */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 92,
            fontWeight: 800,
            letterSpacing: "-0.04em",
            lineHeight: 1,
          }}
        >
          <span style={{ color: "#000000" }}>PRO</span>
          <span style={{ color: PROVIN_BLUE }}>VIN</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
