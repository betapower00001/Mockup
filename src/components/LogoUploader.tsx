// src/components/LogoUploader.tsx
"use client";

import React from "react";

interface LogoUploaderProps {
  onSelect: (url: string) => void;
}

export default function LogoUploader({ onSelect }: LogoUploaderProps) {
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;              // ✅ เพิ่ม
    const file = input.files?.[0];
    if (!file) return;

    // กันเลือกไฟล์ไม่ใช่รูป
    if (!file.type.startsWith("image/")) {
      alert("กรุณาเลือกไฟล์รูปภาพ (PNG / JPG / SVG)");
      input.value = "";                  // ✅ เพิ่ม: เคลียร์เพื่อเลือกไฟล์เดิมซ้ำได้
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        onSelect(result); // ✅ ส่ง Base64 string
      }
      input.value = "";                  // ✅ เพิ่ม: เคลียร์หลังอ่านเสร็จ
    };

    reader.onerror = () => {
      alert("อ่านไฟล์ไม่สำเร็จ");
      input.value = "";                  // ✅ เพิ่ม
    };

    reader.readAsDataURL(file); // ⭐ สำคัญมาก
  }

  return (
    <label
      style={{
        padding: "8px 12px",
        background: "#dddddd",
        borderRadius: 6,
        cursor: "pointer",
        border: "1px solid #cccccc",
        display: "inline-block",
      }}
    >
      อัปโหลด LOGO
      <input
        type="file"
        accept="image/png,image/jpeg,image/svg+xml"
        hidden
        onChange={handleFile}
        onClick={(e) => {
          // ✅ เพิ่ม: กันกรณีกดเลือกไฟล์เดิมทันที (บาง browser ไม่ยิง onChange)
          (e.currentTarget as HTMLInputElement).value = "";
        }}
      />
    </label>
  );
}
