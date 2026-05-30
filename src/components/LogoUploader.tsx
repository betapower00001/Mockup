// src/components/LogoUploader.tsx
"use client";

import React from "react";

interface LogoUploaderProps {
  id: string;
  label?: string;
  currentUrl?: string;
  onSelect: (id: string, url: string) => void;
  onRemove?: (id: string) => void;
}

export default function LogoUploader({
  id,
  label = "โลโก้",
  currentUrl,
  onSelect,
  onRemove,
}: LogoUploaderProps) {
  const hasLogo = !!currentUrl;

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("กรุณาเลือกไฟล์รูปภาพ PNG / JPG / SVG");
      input.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        onSelect(id, result);
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
    <div
      style={{
        width: "100%",
        marginBottom: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: 10,
          borderRadius: 14,
          background: hasLogo
            ? "linear-gradient(135deg, #ecfeff, #f0fdfa)"
            : "linear-gradient(135deg, #ffffff, #f8fafc)",
          border: hasLogo ? "1px solid #06b6d4" : "1px solid #dbe3ef",
          boxShadow: hasLogo
            ? "0 8px 22px rgba(6, 182, 212, 0.16)"
            : "0 6px 18px rgba(15, 23, 42, 0.08)",
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: hasLogo ? "#ffffff" : "#eef2ff",
            border: hasLogo ? "1px solid #a5f3fc" : "1px solid #dbeafe",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {hasLogo ? (
            <img
              src={currentUrl}
              alt={label}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                padding: 5,
              }}
            />
          ) : (
            <span style={{ fontSize: 20 }}>＋</span>
          )}
        </div>

        <label
          style={{
            flex: 1,
            minHeight: 46,
            borderRadius: 12,
            cursor: "pointer",
            background: hasLogo
              ? "linear-gradient(135deg, #0891b2, #0f766e)"
              : "linear-gradient(135deg, #2563eb, #7c3aed)",
            color: "#ffffff",
            border: "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            letterSpacing: 0.2,
            boxShadow: hasLogo
              ? "0 8px 18px rgba(15, 118, 110, 0.28)"
              : "0 8px 18px rgba(37, 99, 235, 0.28)",
            userSelect: "none",
          }}
        >
          <span style={{ fontSize: 14 }}>
            {hasLogo ? `เปลี่ยน ${label}` : `อัปโหลด ${label}`}
          </span>

          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              opacity: 0.86,
              marginTop: 2,
            }}
          >
            PNG / JPG / SVG
          </span>

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

        {hasLogo && onRemove && (
          <button
            type="button"
            onClick={() => onRemove(id)}
            style={{
              minWidth: 58,
              height: 46,
              borderRadius: 12,
              cursor: "pointer",
              background: "#fff1f2",
              color: "#be123c",
              border: "1px solid #fecdd3",
              fontWeight: 800,
              boxShadow: "0 6px 14px rgba(190, 18, 60, 0.12)",
            }}
          >
            ลบ
          </button>
        )}
      </div>
    </div>
  );
}