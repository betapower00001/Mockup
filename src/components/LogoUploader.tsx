// src/components/LogoUploader.tsx
"use client";

import React from "react";

interface LogoUploaderProps {
  id: string; // ✅ เพิ่ม ID เพื่อระบุว่าเป็นโลโก้ช่องที่เท่าไหร่
  label?: string; // ✅ ชื่อปุ่ม (เช่น โลโก้ 1, โลโก้ 2)
  currentUrl?: string; // ✅ เอาไว้เช็คว่าตอนนี้ช่องนี้มีรูปหรือยัง
  onSelect: (id: string, url: string) => void; // ✅ ส่ง id กลับไปด้วย
  onRemove?: (id: string) => void; // ✅ ฟังก์ชันสำหรับลบโลโก้
}

export default function LogoUploader({ 
  id, 
  label = "อัปโหลด LOGO", 
  currentUrl, 
  onSelect, 
  onRemove 
}: LogoUploaderProps) {
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("กรุณาเลือกไฟล์รูปภาพ (PNG / JPG / SVG)");
      input.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        onSelect(id, result); // ⭐ ส่ง id กลับไปพร้อม base64
      }
      input.value = "";
    };

    reader.onerror = () => {
      alert("อ่านไฟล์ไม่สำเร็จ");
      input.value = "";
    };

    reader.readAsDataURL(file);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
      <label
        style={{
          padding: "8px 12px",
          background: currentUrl ? "#e0f7fa" : "#dddddd", // เปลี่ยนสีถ้าอัปโหลดแล้ว
          borderRadius: 6,
          cursor: "pointer",
          border: currentUrl ? "1px solid #00acc1" : "1px solid #cccccc",
          display: "inline-block",
          flex: 1,
          textAlign: "center",
        }}
      >
        {currentUrl ? `✅ เปลี่ยน ${label}` : `⬆️ อัปโหลด ${label}`}
        <input
          type="file"
          accept="image/png,image/jpeg,image/svg+xml"
          hidden
          onChange={handleFile}
          onClick={(e) => {
            (e.currentTarget as HTMLInputElement).value = "";
          }}
        />
      </label>

      {/* ปุ่มลบ จะแสดงก็ต่อเมื่อมีรูปถูกอัปโหลดไว้แล้ว */}
      {currentUrl && onRemove && (
        <button
          onClick={() => onRemove(id)}
          style={{
            padding: "8px 12px",
            background: "#ffebee",
            color: "#c62828",
            border: "1px solid #ffcdd2",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          ลบ
        </button>
      )}
    </div>
  );
}