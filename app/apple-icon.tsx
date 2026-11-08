import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2f4fa3",
        }}
      >
        <svg width="180" height="180" viewBox="0 0 64 64">
          <g fill="none" stroke="#fbfaf7" strokeWidth="3.25">
            <rect x="19" y="19" width="26" height="26" />
            <rect x="19" y="19" width="26" height="26" transform="rotate(45 32 32)" />
          </g>
          <circle cx="32" cy="32" r="3.25" fill="#fbfaf7" />
        </svg>
      </div>
    ),
    size,
  );
}
