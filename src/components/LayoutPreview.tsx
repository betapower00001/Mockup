// src/components/LayoutPreview.tsx
import React from "react";

interface LayoutPreviewProps {
  view: "front" | "angle";
  onSetView: (v: "front" | "angle") => void;
  onDownload: () => void;
  onDownloadA4: () => void;
}

export default function LayoutPreview({
  view,
  onSetView,
  onDownload,
  onDownloadA4,
}: LayoutPreviewProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => onSetView("front")}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #0b76d1",
            background: view === "front" ? "#0b76d1" : "#ffffff",
            color: view === "front" ? "#ffffff" : "#000000",
            cursor: "pointer",
          }}
        >
          หน้า
        </button>

        <button
          onClick={() => onSetView("angle")}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #0b76d1",
            background: view === "angle" ? "#0b76d1" : "#ffffff",
            color: view === "angle" ? "#ffffff" : "#000000",
            cursor: "pointer",
          }}
        >
          มุมเอียง
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={onDownload}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #0b76d1",
            background: "#0b76d1",
            color: "#ffffff",
            cursor: "pointer",
          }}
        >
          ดาวน์โหลดภาพ
        </button>

        <button
          onClick={onDownloadA4}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #16a34a",
            background: "#16a34a",
            color: "#ffffff",
            cursor: "pointer",
          }}
        >
          ดาวน์โหลด A4 (6 มุม)
        </button>
      </div>
    </div>
  );
}
