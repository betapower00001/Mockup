// src/components/LayoutPreview.tsx
import React from "react";

type RenderViewName =
  | "front"
  | "angle"
  | "left"
  | "right"
  | "back"
  | "top"
  | "bottom"
  | "topRight";

interface LayoutPreviewProps {
  view: RenderViewName;
  onSetView: (v: RenderViewName) => void;
  onDownload: () => void;
  onDownloadTop: () => void;
  onDownloadProductionSample: () => void;
  onDownloadA4: () => void;
  onDownloadView: (view: RenderViewName) => void;
}

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

export default function LayoutPreview({
  onDownloadTop,
  onDownloadProductionSample,
  onDownloadA4,
  onDownloadView,
}: LayoutPreviewProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: 8,
        }}
      >
        <button
          type="button"
          onClick={onDownloadTop}
          style={downloadBtn("linear-gradient(135deg,#8b5cf6,#ec4899)")}
        >
          🔝 โหลดมุมบน
        </button>

        <button
          type="button"
          onClick={() => onDownloadView("angle")}
          style={downloadBtn("linear-gradient(135deg,#f97316,#ef4444)")}
        >
          🧊 โหลดมุมเอียง
        </button>

        <button
          type="button"
          onClick={() => onDownloadView("topRight")}
          style={downloadBtn("linear-gradient(135deg,#06b6d4,#6366f1)")}
        >
          ↗️ โหลดบนเอียงขวา
        </button>

        <button
          type="button"
          onClick={onDownloadProductionSample}
          style={downloadBtn("linear-gradient(135deg,#0f172a,#475569)")}
        >
          🏭 โหลดไฟล์ผลิต
        </button>

        <button
          type="button"
          onClick={onDownloadA4}
          style={downloadBtn("linear-gradient(135deg,#22c55e,#14b8a6)")}
        >
          📄 ดาวน์โหลด A4
        </button>
      </div>
    </div>
  );
}
