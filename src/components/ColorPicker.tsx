// src/components/ColorPicker.tsx

"use client";

import React, { useEffect, useMemo, useState } from "react";

type ColorOption = {
  label: string;
  value: string;
};

type Props = {
  label: string;
  initialColor: string;
  options: ColorOption[];
  onColorChange: (color: string) => void;
  allowCustom?: boolean;
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

export default function ColorPicker({
  label,
  initialColor,
  options,
  onColorChange,
  allowCustom = false,
}: Props) {
  const normalizedOptions = useMemo(
    () =>
      options.map((o) => ({
        ...o,
        value: normalizeHex(o.value),
      })),
    [options]
  );

  const fallbackColor = normalizedOptions[0]?.value ?? "#000000";
  const normalizedInitial = normalizeHex(initialColor);

  const initialResolved =
    allowCustom || normalizedOptions.some((o) => o.value === normalizedInitial)
      ? normalizedInitial
      : fallbackColor;

  const [value, setValue] = useState<string>(initialResolved);

  useEffect(() => {
    const next =
      allowCustom || normalizedOptions.some((o) => o.value === normalizedInitial)
        ? normalizedInitial
        : fallbackColor;
    setValue(next);
  }, [allowCustom, normalizedInitial, fallbackColor, normalizedOptions]);

  function commit(next: string) {
    const normalized = normalizeHex(next);
    const allowed = normalizedOptions.some((o) => o.value === normalized);
    const finalColor = allowCustom ? normalized : allowed ? normalized : fallbackColor;
    setValue(finalColor);
    onColorChange(finalColor);
  }

  const selectedLabel =
    normalizedOptions.find((o) => o.value === value)?.label ?? "สีอิสระ";

  /* =========================
     Styles
  ========================= */

  const containerStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "110px 1fr",
    gap: 12,
    alignItems: "start",
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
    paddingTop: 8,
  };

  const rightWrapStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  };

  const selectedStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    borderRadius: 12,
    background: "rgba(248,250,252,.95)",
    border: "1px solid rgba(148,163,184,.28)",
    fontSize: 12,
    fontWeight: 800,
    color: "#0f172a",
    width: "fit-content",
  };

  const selectedDotStyle: React.CSSProperties = {
    width: 16,
    height: 16,
    borderRadius: 999,
    border: "1px solid rgba(15,23,42,.12)",
    background: value,
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,.5)",
  };

  const optionsGridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))",
    gap: 8,
  };

  const customRowStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 14,
    background: "#ffffff",
    border: "1px solid rgba(148,163,184,.28)",
    boxShadow: "0 8px 16px rgba(15,23,42,.05)",
    width: "fit-content",
  };

  const customInputStyle: React.CSSProperties = {
    width: 40,
    height: 40,
    padding: 0,
    border: "none",
    background: "transparent",
    cursor: "pointer",
  };

  const customTextStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 800,
    color: "#0f172a",
  };

  function getSwatchButtonStyle(active: boolean, color: string): React.CSSProperties {
    return {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 8,
      padding: "10px 8px",
      borderRadius: 14,
      border: active ? "1px solid rgba(37,99,235,.55)" : "1px solid rgba(148,163,184,.28)",
      background: active ? "rgba(59,130,246,.08)" : "white",
      cursor: "pointer",
      boxShadow: active
        ? "0 12px 22px rgba(37,99,235,.14)"
        : "0 8px 16px rgba(15,23,42,.05)",
      transition: "transform .12s ease, box-shadow .18s ease, border-color .18s ease, background .18s ease",
      fontWeight: 800,
      fontSize: 12,
      color: "#0f172a",
    };
  }

  function getSwatchCircleStyle(color: string): React.CSSProperties {
    return {
      width: 28,
      height: 28,
      borderRadius: 999,
      background: color,
      border: "1px solid rgba(15,23,42,.14)",
      boxShadow: "inset 0 0 0 1px rgba(255,255,255,.45)",
      flexShrink: 0,
    };
  }

  return (
    <div style={containerStyle}>
      <div style={labelStyle}>{label}</div>

      <div style={rightWrapStyle}>
        <div style={selectedStyle}>
          <span style={selectedDotStyle} />
          เลือกอยู่: {selectedLabel} ({value.toUpperCase()})
        </div>

        <div style={optionsGridStyle}>
          {normalizedOptions.map((option) => {
            const active = value === option.value;
            return (
              <button
                key={`${option.label}-${option.value}`}
                type="button"
                onClick={() => commit(option.value)}
                style={getSwatchButtonStyle(active, option.value)}
                title={`${option.label} ${option.value}`}
              >
                <span style={getSwatchCircleStyle(option.value)} />
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>

        {allowCustom && (
          <div style={customRowStyle}>
            <input
              type="color"
              value={value}
              onChange={(e) => commit(e.target.value)}
              style={customInputStyle}
              title="เลือกสีอิสระ"
            />
            <span style={customTextStyle}>สีอิสระ: {value.toUpperCase()}</span>
          </div>
        )}
      </div>
    </div>
  );
}