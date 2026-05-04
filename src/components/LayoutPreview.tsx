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

const btnBase: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#ffffff",
  color: "#0f172a",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 13,
};

export default function LayoutPreview({
  view,
  onSetView,
  onDownload,
  onDownloadTop,
  onDownloadA4,
  onDownloadView,
}: LayoutPreviewProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* เลือกมุมหลัก */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
        }}
      >
        <button
          type="button"
          onClick={() => onSetView("front")}
          style={{
            ...btnBase,
            border: view === "front" ? "1px solid #2563eb" : btnBase.border,
            background: view === "front" ? "#2563eb" : "#ffffff",
            color: view === "front" ? "#ffffff" : "#0f172a",
          }}
        >
          มุมหน้า
        </button>

        <button
          type="button"
          onClick={() => onSetView("angle")}
          style={{
            ...btnBase,
            border: view === "angle" ? "1px solid #2563eb" : btnBase.border,
            background: view === "angle" ? "#2563eb" : "#ffffff",
            color: view === "angle" ? "#ffffff" : "#0f172a",
          }}
        >
          มุมเอียง
        </button>
      </div>

      {/* ปุ่มดาวน์โหลดหลัก */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
        }}
      >
        <button
          type="button"
          onClick={onDownload}
          style={{
            ...btnBase,
            background: "#0f172a",
            border: "1px solid #0f172a",
            color: "#ffffff",
          }}
        >
          ดาวน์โหลดภาพ
        </button>

        <button
          type="button"
          onClick={onDownloadA4}
          style={{
            ...btnBase,
            background: "#16a34a",
            border: "1px solid #16a34a",
            color: "#ffffff",
          }}
        >
          ดาวน์โหลด A4
        </button>
      </div>

      {/* ดาวน์โหลดแยกมุม */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: 10,
          borderRadius: 14,
          border: "1px solid #e5e7eb",
          background: "rgba(255,255,255,.72)",
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: "#334155",
          }}
        >
          ดาวน์โหลดแยกแต่ละมุม
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 8,
          }}
        >
          {EXTRA_VIEWS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onDownloadView(item.key)}
              style={{
                ...btnBase,
                padding: "9px 10px",
                fontSize: 12,
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