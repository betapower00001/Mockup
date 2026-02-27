// src/components/ColorPicker.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";

type Props = {
  label: string;
  initialColor: string;
  onColorChange: (color: string) => void;
};

/* =========================
   Helpers
========================= */

function normalizeHex(input: string) {
  const v = input.trim();
  if (!v) return "#000000";

  if (v.startsWith("#")) {
    if (v.length === 4) {
      const r = v[1];
      const g = v[2];
      const b = v[3];
      return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
    }
    return v.slice(0, 7).toLowerCase();
  }

  const hex = v.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);

  if (hex.length === 3) {
    const r = hex[0];
    const g = hex[1];
    const b = hex[2];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  if (hex.length === 6) return `#${hex}`.toLowerCase();

  return "#000000";
}

/* =========================
   Component
========================= */

export default function ColorPicker({ label, initialColor, onColorChange }: Props) {
  const [value, setValue] = useState<string>(normalizeHex(initialColor));

  useEffect(() => {
    setValue(normalizeHex(initialColor));
  }, [initialColor]);

  function commit(next: string) {
    const normalized = normalizeHex(next);
    setValue(normalized);
    onColorChange(normalized);
  }

  /* =========================
     Styles (Professional UI)
  ========================= */

  const containerStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "110px 52px 1fr",
    alignItems: "center",
    gap: 12,
    padding: "10px 14px",
    borderRadius: 16,
    background: "rgba(255,255,255,.94)",
    border: "1px solid rgba(148,163,184,.25)",
    boxShadow: "0 12px 24px rgba(15,23,42,.06)",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 900,
    color: "#0f172a",
    letterSpacing: ".3px",
  };

  const swatchStyle: React.CSSProperties = {
    width: 48,
    height: 36,
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,.45)",
    padding: 0,
    cursor: "pointer",
    boxShadow: "0 10px 18px rgba(15,23,42,.08)",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,.45)",
    background: "white",
    color: "#0f172a",
    fontWeight: 800,
    fontSize: 13,
    letterSpacing: ".4px",
    outline: "none",
    boxShadow: "0 8px 16px rgba(15,23,42,.05)",
  };

  /* =========================
     Render
  ========================= */

  return (
    <div style={containerStyle}>
      <div style={labelStyle}>{label}</div>

      <input
        type="color"
        value={value}
        onChange={(e) => commit(e.target.value)}
        style={swatchStyle}
      />

      <input
        type="text"
        value={value}
        onChange={(e) => commit(e.target.value)}
        style={inputStyle}
        spellCheck={false}
      />
    </div>
  );
}