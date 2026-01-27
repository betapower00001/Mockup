// src/components/PlugSelector.tsx
import React from "react";

export interface PlugType {
  id: string;
  name: string;
  modelPath: string;
  thumb?: string;
}

export default function PlugSelector({
  items,
  selected,
  onSelect,
}: {
  items: PlugType[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
        gap: 12,
      }}
    >
      {items.map((it) => {
        const active = it.id === selected;

        return (
          <button
            key={it.id}
            type="button"
            onClick={() => onSelect(it.id)}
            style={{
              textAlign: "left",
              borderRadius: 14,
              padding: 10,
              border: active ? "2px solid #2563eb" : "1px solid #e5e7eb",
              background: active
                ? "linear-gradient(180deg, #eff6ff 0%, #ffffff 55%)"
                : "#ffffff",
              cursor: "pointer",
              boxShadow: active
                ? "0 10px 25px rgba(37, 99, 235, 0.18)"
                : "0 8px 18px rgba(0,0,0,0.10)",
              transform: "translateY(0px)",
              transition: "transform .15s ease, box-shadow .15s ease, border-color .15s ease",
              position: "relative",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = active
                ? "0 14px 30px rgba(37, 99, 235, 0.22)"
                : "0 14px 26px rgba(0,0,0,0.14)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0px)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = active
                ? "0 10px 25px rgba(37, 99, 235, 0.18)"
                : "0 8px 18px rgba(0,0,0,0.10)";
            }}
            aria-pressed={active}
            title={`${it.id} - ${it.name}`}
          >
            {/* badge */}
            {active && (
              <div
                style={{
                  position: "absolute",
                  top: 10,
                  right: 10,
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "4px 8px",
                  borderRadius: 999,
                  background: "#2563eb",
                  color: "#fff",
                  letterSpacing: 0.2,
                }}
              >
                Selected
              </div>
            )}

            {/* thumbnail */}
            <div
              style={{
                width: "100%",
                aspectRatio: "1 / 1",
                borderRadius: 12,
                overflow: "hidden",
                background: "linear-gradient(180deg, #f3f4f6 0%, #ffffff 100%)",
                border: "1px solid rgba(0,0,0,0.06)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {it.thumb ? (
                <img
                  src={it.thumb}
                  alt={it.name}
                  loading="lazy"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                  onError={(e) => {
                    // ถ้ารูปหาย ให้ซ่อนรูป แล้วโชว์ fallback text
                    const img = e.currentTarget as HTMLImageElement;
                    img.style.display = "none";
                  }}
                />
              ) : (
                <span style={{ fontSize: 12, color: "#6b7280" }}>No image</span>
              )}
            </div>

            {/* text */}
            <div style={{ marginTop: 10, lineHeight: 1.2 }}>
              <div style={{ fontSize: 11, color: "#6b7280" }}>{it.id}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#111827" }}>
                {it.name}
              </div>
            </div>

            {/* subtle footer */}
            <div
              style={{
                marginTop: 8,
                fontSize: 11,
                color: "#6b7280",
                display: "flex",
                gap: 6,
                alignItems: "center",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: active ? "#2563eb" : "#d1d5db",
                  display: "inline-block",
                }}
              />
              <span>{active ? "กำลังใช้งานรุ่นนี้" : "คลิกเพื่อเลือก"}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
