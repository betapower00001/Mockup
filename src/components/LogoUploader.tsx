// src/components/LogoUploader.tsx
"use client";

import React from "react";

interface LogoUploaderProps {
  onSelect: (url: string) => void;
}

export default function LogoUploader({ onSelect }: LogoUploaderProps) {
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // กันเลือกไฟล์ไม่ใช่รูป
    if (!file.type.startsWith("image/")) {
      alert("กรุณาเลือกไฟล์รูปภาพ (PNG / JPG / SVG)");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        onSelect(result); // ✅ ส่ง Base64 string
      }
    };

    reader.onerror = () => {
      alert("อ่านไฟล์ไม่สำเร็จ");
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
      <input type="file" accept="image/png,image/jpeg,image/svg+xml" hidden onChange={handleFile} />
    </label>
  );
}
