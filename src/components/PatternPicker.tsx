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
  thumbSize = 70, // ปรับค่า default ให้เป็น 70px ตามที่ส่งมาจาก Customizer
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

  // ⭐️ จุดที่แก้ไข: บังคับ 3 คอลัมน์ ขนาดตาม thumbSize และจัดชิดซ้าย
  const gridStyle: React.CSSProperties = {
    display: "grid",
    gap: 10,
    gridTemplateColumns: `repeat(3, ${thumbSize}px)`, 
    justifyContent: "start",
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
    transition: "transform .15s ease, box-shadow .15s ease, border-color .15s ease",
  };

  const imgStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  };

  // ปรับขนาดฟอนต์ของ Caption ลงเล็กน้อยเพื่อให้พอดีกับกล่อง 70px
  const capStyle: React.CSSProperties = {
    position: "absolute",
    left: 4,
    right: 4,
    bottom: 4,
    fontSize: 9.5,
    fontWeight: 800,
    color: "rgba(20,30,60,.90)",
    background: "rgba(255,255,255,.85)",
    border: "1px solid rgba(210,218,235,.9)",
    borderRadius: 999,
    padding: "2px 6px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    pointerEvents: "none",
    textAlign: "center",
  };

  const sectionTitle: React.CSSProperties = {
    margin: "12px 0 8px",
    fontSize: 13,
    fontWeight: 900,
    opacity: 0.8,
  };

  return (
    <div>
      {/* ✅ แถบปุ่ม (แยกโซนปุ่มออกมาชัดเจน ไม่ให้ไปปนกับ Grid รูปภาพ) */}
      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", justifyContent: "space-between" }}>
        
        {/* กล่องซ้าย: เลเบลข้อความแนะนำ */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>เลือกลายด้านล่าง</span>
        </div>

        {/* กล่องขวา: ปุ่มอัปโหลด & รีเซ็ต */}
        <div style={{ display: "flex", gap: 8 }}>
          <label
            style={{
              padding: "6px 10px",
              background: "rgba(0, 179, 185, 0.95)",
              color: "#fff", // เพิ่มสีตัวหนังสือเป็นสีขาว
              borderRadius: 8,
              cursor: "pointer",
              border: "1px solid rgba(0, 150, 150, 0.9)",
              display: "inline-flex",
              alignItems: "center",
              fontSize: 12,
              fontWeight: 900,
              userSelect: "none",
              transition: "transform 0.1s ease",
            }}
            title="อัปโหลดลาย (PNG/JPG)"
            onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.02)")}
            onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            + อัปโหลดเอง
            <input type="file" accept="image/png,image/jpeg" hidden onChange={handleFile} />
          </label>

          <button
            type="button"
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid rgba(160, 0, 0, 0.9)",
              background: "rgba(200, 30, 30, 0.9)",
              color: "#fff", // เพิ่มสีตัวหนังสือเป็นสีขาว
              fontSize: 12,
              fontWeight: 900,
              cursor: disableReset ? "not-allowed" : "pointer",
              opacity: disableReset ? 0.5 : 1,
            }}
            onClick={onReset}
            disabled={!!disableReset}
            title={disableReset ? "ยังไม่มีลายให้รีเซ็ต" : "ล้างลาย/รีเซ็ต"}
          >
            ล้างลาย
          </button>
        </div>
      </div>

      <div style={{ height: 1, background: "rgba(226,232,240,1)", margin: "0 0 12px 0" }} />

      {/* ✅ ลายพื้นฐาน */}
      <div style={sectionTitle}>ลายจากระบบ</div>
      {patternsForSelected.length === 0 ? (
        <div style={{ fontSize: 12, opacity: 0.65 }}>ไม่มีลวดลายสำหรับรุ่นนี้</div>
      ) : (
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
                (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
                (e.currentTarget as HTMLDivElement).style.boxShadow = "0 6px 12px rgba(30,55,90,.12)";
                (e.currentTarget as HTMLDivElement).style.borderColor = "#3b82f6";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
                (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(210,218,235,.9)";
              }}
            >
              <img src={p.preview || p.img} alt={p.name} style={imgStyle} />
              <div style={capStyle}>{p.name}</div>
            </div>
          ))}
        </div>
      )}

      {/* ✅ ลายอัปโหลด */}
      {uploadedExamples.length > 0 && (
        <>
          <div style={{ ...sectionTitle, marginTop: 16 }}>ลายที่คุณอัปโหลด</div>
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
                  (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
                  (e.currentTarget as HTMLDivElement).style.boxShadow = "0 6px 12px rgba(30,55,90,.12)";
                  (e.currentTarget as HTMLDivElement).style.borderColor = "#3b82f6";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
                  (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                  (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(210,218,235,.9)";
                }}
              >
                <img src={url} alt={`upload-${i}`} style={imgStyle} />
                <div style={capStyle}>Upload {i + 1}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}