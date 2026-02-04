// src/components/PatternPicker.tsx
"use client";

import React from "react";

interface PatternItem {
  id: string;
  name: string;
  img: string;
  preview: string;
}

interface Props {
  patternsForSelected: PatternItem[];
  uploadedExamples: string[];
  onSelect: (imgUrl: string) => void;

  // ✅ เพิ่มมาใหม่ (ของเดิมคุณ)
  onUpload: (base64: string) => void;
  onReset: () => void;
  disableReset?: boolean;

  // ✅ เพิ่มให้: คุมขนาด thumbnail
  thumbSize?: number; // px (เช่น 56/64/72)
}

export default function PatternPicker({
  patternsForSelected,
  uploadedExamples,
  onSelect,
  onUpload,
  onReset,
  disableReset,
  thumbSize = 68,
}: Props) {
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("กรุณาเลือกไฟล์รูปภาพ (PNG / JPG)");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        onUpload(result); // ✅ ส่ง Base64
      }
    };

    reader.onerror = () => {
      alert("อ่านไฟล์ไม่สำเร็จ");
    };

    reader.readAsDataURL(file);
    e.currentTarget.value = ""; // ✅ เลือกไฟล์เดิมซ้ำได้
  }

  // ✅ grid แบบ auto-fit: หน้าจอเล็กก็ลดคอลัมน์เอง
  const gridStyle: React.CSSProperties = {
    display: "grid",
    gap: 8,
    gridTemplateColumns: `repeat(auto-fit, minmax(${thumbSize}px, 1fr))`,
  };

  // ✅ tile ที่สวยขึ้น + ไม่ยืดภาพ
  const tileStyle: React.CSSProperties = {
    width: "100%",
    aspectRatio: "1 / 1",
    borderRadius: 12,
    border: "1px solid rgba(210,218,235,.9)",
    background: "rgba(255,255,255,.9)",
    overflow: "hidden",
    cursor: "pointer",
    position: "relative",
    transition: "transform .15s ease, box-shadow .15s ease",
  };

  const imgStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  };

  const capStyle: React.CSSProperties = {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 6,
    fontSize: 10.5,
    fontWeight: 800,
    color: "rgba(20,30,60,.80)",
    background: "rgba(255,255,255,.78)",
    border: "1px solid rgba(210,218,235,.9)",
    borderRadius: 999,
    padding: "3px 8px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    pointerEvents: "none",
  };

  const sectionTitle: React.CSSProperties = {
    margin: "10px 0 8px",
    fontSize: 13,
    fontWeight: 900,
    opacity: 0.8,
  };

  return (
    <div>
      {/* ✅ แถบปุ่ม (ของเดิม + จัดให้กระชับขึ้น) */}
      <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <label
          style={{
            padding: "8px 12px",
            background: "rgba(255,255,255,.9)",
            borderRadius: 12,
            cursor: "pointer",
            border: "1px solid rgba(210,218,235,.9)",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontWeight: 900,
            userSelect: "none",
          }}
          title="อัปโหลดลาย (PNG/JPG)"
        >
          อัปโหลดลาย
          <input type="file" accept="image/png,image/jpeg" hidden onChange={handleFile} />
        </label>

        <button
          type="button"
          style={{
            padding: "8px 12px",
            borderRadius: 12,
            border: "1px solid rgba(210,218,235,.9)",
            background: "rgba(255,255,255,.9)",
            fontWeight: 900,
            cursor: disableReset ? "not-allowed" : "pointer",
            opacity: disableReset ? 0.5 : 1,
          }}
          onClick={onReset}
          disabled={!!disableReset}
          title={disableReset ? "ยังไม่มีลายให้รีเซ็ต" : "ล้างลาย/รีเซ็ต"}
        >
          รีเซ็ตลาย
        </button>
      </div>

      {/* ✅ ลายพื้นฐาน */}
      <div style={sectionTitle}>เลือกลายพื้นฐาน</div>
      <div style={gridStyle}>
        {patternsForSelected.map((p) => (
          <div
            key={p.id}
            role="button"
            tabIndex={0}
            title={p.name}
            onClick={() => onSelect(p.img)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onSelect(p.img);
            }}
            style={tileStyle}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform = "translateY(-1px)";
              (e.currentTarget as HTMLDivElement).style.boxShadow =
                "0 10px 20px rgba(30,55,90,.10)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
              (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
            }}
          >
            <img src={p.preview || p.img} alt={p.name} style={imgStyle} />
            <div style={capStyle}>{p.name}</div>
          </div>
        ))}
      </div>

      {/* ✅ ลายอัปโหลด */}
      <div style={{ ...sectionTitle, marginTop: 14 }}>ลายที่อัปโหลดเอง</div>
      {uploadedExamples.length === 0 ? (
        <div style={{ fontSize: 12, opacity: 0.65 }}>ยังไม่มีลายที่อัปโหลด</div>
      ) : (
        <div style={gridStyle}>
          {uploadedExamples.map((url, i) => (
            <div
              key={i}
              role="button"
              tabIndex={0}
              title="คลิกเพื่อเลือกใช้ลายนี้"
              onClick={() => onSelect(url)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onSelect(url);
              }}
              style={tileStyle}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform = "translateY(-1px)";
                (e.currentTarget as HTMLDivElement).style.boxShadow =
                  "0 10px 20px rgba(30,55,90,.10)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
                (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
              }}
            >
              <img src={url} alt={`upload-${i}`} style={imgStyle} />
              <div style={capStyle}>Uploaded #{i + 1}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
