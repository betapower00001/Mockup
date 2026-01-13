// src/components/PlugSelector.tsx
import React from "react";

export interface PlugType {
  id: string;
  name: string;
  modelPath: string;
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
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {items.map((it) => (
        <button
          key={it.id}
          onClick={() => onSelect(it.id)}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: it.id === selected ? "2px solid #0b76d1" : "1px solid #d0d6dd",
            background: it.id === selected ? "#eaf6ff" : "#fff",
            cursor: "pointer",
            minWidth: 60,
            textAlign: "center"
          }}
        >
          {it.id}
        </button>
      ))}
    </div>
  );
}
