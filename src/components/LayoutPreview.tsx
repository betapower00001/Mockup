// src/components/LayoutPreview.tsx
import React from "react";

type RenderViewName = "front" | "angle" | "left" | "right" | "back" | "top";
type MainViewName = "front" | "angle" | "top";

interface LayoutPreviewProps {
  view: MainViewName;
  onSetView: (v: MainViewName) => void;
  onDownload: () => void;
  onDownloadTop: () => void;
  onDownloadProductionSample: () => void;
  onDownloadA4: () => void;
  onDownloadView: (view: RenderViewName) => void;
}

const EXTRA_VIEWS: { key: RenderViewName; label: string; icon: string }[] = [
  { key: "front", label: "หน้า", icon: "⬆️" },
  { key: "angle", label: "เอียง", icon: "🧊" },
  { key: "left", label: "ซ้าย", icon: "⬅️" },
  { key: "right", label: "ขวา", icon: "➡️" },
  { key: "back", label: "หลัง", icon: "⬇️" },
  { key: "top", label: "บน", icon: "🔝" },
];

const mainBtn = (active: boolean, gradient: string, soft: string): React.CSSProperties => ({
  padding: "12px 14px",
  borderRadius: 16,
  border: active ? "2px solid rgba(255,255,255,.95)" : "1px solid rgba(255,255,255,.65)",
  background: active ? gradient : soft,
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 13,
  boxShadow: active
    ? "0 14px 28px rgba(15,23,42,.22)"
    : "0 8px 18px rgba(15,23,42,.12)",
  transition: "transform .16s ease, box-shadow .16s ease, filter .16s ease",
});

const downloadBtn = (gradient: string): React.CSSProperties => ({
  padding: "12px 14px",
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,.65)",
  background: gradient,
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 13,
  boxShadow: "0 12px 24px rgba(15,23,42,.16)",
  transition: "transform .16s ease, box-shadow .16s ease, filter .16s ease",
});

const smallBtn: React.CSSProperties = {
  padding: "10px 8px",
  borderRadius: 13,
  border: "1px solid #e5e7eb",
  background: "linear-gradient(180deg,#ffffff,#f8fafc)",
  color: "#0f172a",
  cursor: "pointer",
  fontWeight: 850,
  fontSize: 12,
  boxShadow: "0 6px 14px rgba(15,23,42,.08)",
  transition: "transform .16s ease, box-shadow .16s ease",
};

export default function LayoutPreview({
  view,
  onSetView,
  onDownload,
  onDownloadA4,
  onDownloadView,
}: LayoutPreviewProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <button
          type="button"
          onClick={() => onSetView("top")}
          style={mainBtn(
            view === "top",
            "linear-gradient(135deg,#8b5cf6,#ec4899)",
            "linear-gradient(135deg,#c084fc,#f472b6)"
          )}
        >
          🔝 มุมบน
        </button>

        <button
          type="button"
          onClick={() => onSetView("angle")}
          style={mainBtn(
            view === "angle",
            "linear-gradient(135deg,#2563eb,#06b6d4)",
            "linear-gradient(135deg,#60a5fa,#22d3ee)"
          )}
        >
          🧊 มุมเอียง
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <button
          type="button"
          onClick={onDownload}
          style={downloadBtn("linear-gradient(135deg,#f97316,#ef4444)")}
        >
          📥 ดาวน์โหลดภาพ
        </button>

        <button
          type="button"
          onClick={onDownloadA4}
          style={downloadBtn("linear-gradient(135deg,#22c55e,#14b8a6)")}
        >
          📄 ดาวน์โหลด A4
        </button>
      </div>

      <div
        style={{
          padding: 12,
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,.72)",
          background: "rgba(255,255,255,.78)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          boxShadow: "0 12px 30px rgba(15,23,42,.10)",
        }}
      >
        <div style={{ fontWeight: 900, marginBottom: 8, color: "#334155", fontSize: 13 }}>
          📐 ดาวน์โหลดแยกแต่ละมุม
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          {EXTRA_VIEWS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onDownloadView(item.key)}
              style={smallBtn}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
