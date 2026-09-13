import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const PROVIN_BLUE = "#0061D2";

export default function AppleIcon() {
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
            fontSize: 36,
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
