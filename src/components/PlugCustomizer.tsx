// src/components/PlugCustomizer.tsx
"use client";

import React, { useMemo, useState } from "react";
import plugTypes from "../data/plugTypes";
import patterns from "../data/patterns";
import Plug3D from "./Plug3D";
import ColorPicker from "./ColorPicker";
import PlugSelector from "./PlugSelector";
import PatternPicker from "./PatternPicker";
import LayoutPreview from "./LayoutPreview";
import LogoUploader from "./LogoUploader";
import { getPlugConfig } from "../data/plugConfig";

interface Props {
  plugId: string;
}

interface CustomizationState {
  topColor: string;
  bottomColor: string;
  switchColor: string;
  patternUrl: string;
  logoUrl?: string;
  view: "front" | "angle";
}

export type LogoTransform = {
  x: number; // -0.5..0.5
  y: number; // -0.5..0.5
  scale: number; // 0.05..0.6
  rot: number; // radians
};

function normalizeHex(hex?: string) {
  if (!hex) return hex;
  const h = hex.trim();
  if (!h.startsWith("#")) return h;
  return h.length >= 7 ? h.slice(0, 7) : h;
}

export default function PlugCustomizer({ plugId }: Props) {
  const [selectedPlugId, setSelectedPlugId] = useState<string>(plugId);
  const plug = plugTypes.find((p) => p.id === selectedPlugId)!;

  const initialPattern = patterns[selectedPlugId]?.[0]?.img ?? "";

  const [customization, setCustomization] = useState<CustomizationState>({
    topColor: "#ffffff",
    bottomColor: "#eaeaea",
    switchColor: "#ffffff",
    patternUrl: initialPattern,
    logoUrl: undefined,
    view: "angle",
  });

  const [dragLogoMode, setDragLogoMode] = useState(false);

  const [logoTransform, setLogoTransform] = useState<LogoTransform>({
    x: 0,
    y: 0,
    scale: 0.25,
    rot: 0,
  });

  const plugConfig = useMemo(
    () => getPlugConfig(selectedPlugId, { modelPath: plug.modelPath }),
    [selectedPlugId, plug.modelPath]
  );

  function handleLogoSelect(url: string) {
    setCustomization((s) => ({ ...s, logoUrl: url }));
  }

  const hasLogo = !!customization.logoUrl;

  return (
    <div style={{ display: "flex", gap: 20, padding: 20, maxWidth: 1400, margin: "0 auto" }}>
      {/* LEFT */}
      <div style={{ flex: 2, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ height: 520, background: "#f2f6fb", borderRadius: 12, padding: 10 }}>
          <Plug3D
            key={plugConfig.modelPath}
            config={plugConfig}
            logoUrl={customization.logoUrl}
            patternUrl={customization.patternUrl}
            colors={{
              top: normalizeHex(customization.topColor),
              bottom: normalizeHex(customization.bottomColor),
              switch: normalizeHex(customization.switchColor),
            }}
            logoTransform={logoTransform}
            onLogoTransformChange={setLogoTransform}
            dragLogoMode={dragLogoMode && hasLogo}
          />
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <LogoUploader onSelect={handleLogoSelect} />
          <button type="button" style={{ padding: "8px 14px", borderRadius: 8 }} onClick={() => setLogoTransform({ x: 0, y: 0, scale: 0.25, rot: 0 })}>
            รีเซ็ตโลโก้
          </button>
        </div>
      </div>

      {/* RIGHT */}
      <div style={{ flex: 1.2, padding: 20, borderLeft: "1px solid #dee2e6" }}>
        <h3>เลือกโมเดล (รุ่น)</h3>
        <PlugSelector
          items={plugTypes}
          selected={selectedPlugId}
          onSelect={(id) => {
            setSelectedPlugId(id);
            const p = patterns[id]?.[0]?.img ?? "";
            setCustomization((s) => ({ ...s, patternUrl: p }));
            setLogoTransform({ x: 0, y: 0, scale: 0.25, rot: 0 });
            setDragLogoMode(false);
          }}
        />

        <h3 style={{ marginTop: 18 }}>โลโก้ (Sticker + AutoUV)</h3>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={dragLogoMode} disabled={!hasLogo} onChange={(e) => setDragLogoMode(e.target.checked)} />
          โหมดลากโลโก้ (เมาส์)
        </label>

        <div style={{ marginTop: 10, opacity: hasLogo ? 1 : 0.5 }}>
          <div>ขนาด: {logoTransform.scale.toFixed(2)}</div>
          <input
            type="range"
            min={0.05}
            max={0.6}
            step={0.01}
            value={logoTransform.scale}
            disabled={!hasLogo}
            onChange={(e) => setLogoTransform((s) => ({ ...s, scale: Number(e.target.value) }))}
          />

          <div>X: {logoTransform.x.toFixed(2)}</div>
          <input
            type="range"
            min={-0.45}
            max={0.45}
            step={0.01}
            value={logoTransform.x}
            disabled={!hasLogo}
            onChange={(e) => setLogoTransform((s) => ({ ...s, x: Number(e.target.value) }))}
          />

          <div>Y: {logoTransform.y.toFixed(2)}</div>
          <input
            type="range"
            min={-0.45}
            max={0.45}
            step={0.01}
            value={logoTransform.y}
            disabled={!hasLogo}
            onChange={(e) => setLogoTransform((s) => ({ ...s, y: Number(e.target.value) }))}
          />

          <div>หมุน: {(logoTransform.rot * (180 / Math.PI)).toFixed(0)}°</div>
          <input
            type="range"
            min={-Math.PI}
            max={Math.PI}
            step={0.01}
            value={logoTransform.rot}
            disabled={!hasLogo}
            onChange={(e) => setLogoTransform((s) => ({ ...s, rot: Number(e.target.value) }))}
          />
        </div>

        <h3 style={{ marginTop: 18 }}>สี</h3>
        <ColorPicker label="ฝาบน" initialColor={customization.topColor} onColorChange={(c) => setCustomization((s) => ({ ...s, topColor: c }))} />
        <ColorPicker label="ฝาล่าง" initialColor={customization.bottomColor} onColorChange={(c) => setCustomization((s) => ({ ...s, bottomColor: c }))} />
        <ColorPicker label="สวิตช์" initialColor={customization.switchColor} onColorChange={(c) => setCustomization((s) => ({ ...s, switchColor: c }))} />

        <h3 style={{ marginTop: 18 }}>มุมมอง</h3>
        <LayoutPreview view={customization.view} onSetView={(v) => setCustomization((s) => ({ ...s, view: v }))} onDownload={() => {}} />

        <h3 style={{ marginTop: 18 }}>ลวดลาย (Pattern)</h3>
        <PatternPicker
          patternsForSelected={patterns[selectedPlugId] || []}
          uploadedExamples={[]}
          onSelect={(imgUrl: string) => setCustomization((s) => ({ ...s, patternUrl: imgUrl }))}
        />
      </div>
    </div>
  );
}
