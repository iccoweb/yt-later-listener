import { ImageResponse } from "next/og";

/** Square podcast artwork (Apple requires 1400–3000 px, JPEG or PNG). */
export function GET() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #1f1f1f 0%, #3a0d0d 55%, #b91c1c 100%)",
        color: "white",
        fontSize: 150,
        fontWeight: 700,
        letterSpacing: -4,
      }}
    >
      <div
        style={{
          display: "flex",
          width: 420,
          height: 300,
          borderRadius: 80,
          background: "#ef4444",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 90,
        }}
      >
        <div
          style={{
            width: 0,
            height: 0,
            borderTop: "80px solid transparent",
            borderBottom: "80px solid transparent",
            borderLeft: "130px solid white",
            marginLeft: 30,
          }}
        />
      </div>
      <div style={{ display: "flex" }}>Later</div>
      <div style={{ display: "flex" }}>Listener</div>
    </div>,
    { width: 1400, height: 1400, headers: { "Cache-Control": "public, max-age=604800" } },
  );
}
