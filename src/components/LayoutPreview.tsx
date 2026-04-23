// src/components/LayoutPreview.tsx
import React from "react";

type RenderViewName = "front" | "angle" | "left" | "right" | "back" | "top";

interface LayoutPreviewProps {
  view: "front" | "angle";
  onSetView: (v: "front" | "angle") => void;
  onDownload: () => void;
  onDownloadTop: () => void;
  onDownloadProductionSample: () => void;
  onDownloadA4: () => void;
  onDownloadView: (view: RenderViewName) => void;
}

const EXTRA_VIEWS: { key: RenderViewName; label: string }[] = [
  { key: "front", label: "หน้า" },
  { key: "angle", label: "เอียง" },
  { key: "left", label: "ซ้าย" },
  { key: "right", label: "ขวา" },
  { key: "back", label: "หลัง" },
  { key: "top", label: "บน" },
];

export default function LayoutPreview({
  view,
  onSetView,
  onDownload,
  onDownloadTop,
  onDownloadProductionSample,
  onDownloadA4,
  onDownloadView,
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
          onClick={onDownloadTop}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #7c3aed",
            background: "#7c3aed",
            color: "#ffffff",
            cursor: "pointer",
          }}
        >
          ดาวน์โหลดด้านบน
        </button>

        <button
          onClick={onDownloadProductionSample}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #ea580c",
            background: "#ea580c",
            color: "#ffffff",
            cursor: "pointer",
          }}
        >
          ส่งตัวอย่างผลิต
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

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: 10,
          borderRadius: 10,
          border: "1px solid #e5e7eb",
          background: "#f8fafc",
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "#334155",
          }}
        >
          ดาวน์โหลดแยกแต่ละมุม
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {EXTRA_VIEWS.map((item) => (
            <button
              key={item.key}
              onClick={() => onDownloadView(item.key)}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#0f172a",
                cursor: "pointer",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
