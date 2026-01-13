// src/components/ColorPicker.tsx
"use client";

import React, { useEffect, useState } from "react";

type Props = {
  label: string;
  initialColor: string;
  onColorChange: (color: string) => void;
};

export default function ColorPicker({ label, initialColor, onColorChange }: Props) {
  const [value, setValue] = useState<string>(initialColor);

  useEffect(() => {
    setValue(initialColor);
  }, [initialColor]);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 70, fontSize: 14 }}>{label}</div>

      <input
        type="color"
        value={value}
        onChange={(e) => {
          const c = e.target.value;
          setValue(c);
          onColorChange(c);
        }}
        style={{ width: 42, height: 32, border: "1px solid #ddd", borderRadius: 8, padding: 0, background: "transparent" }}
      />

      <input
        type="text"
        value={value}
        onChange={(e) => {
          const c = e.target.value;
          setValue(c);
          onColorChange(c);
        }}
        style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
      />
    </div>
  );
}
