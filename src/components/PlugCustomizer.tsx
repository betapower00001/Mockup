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
  patternUrl: string; // ✅ ว่าง = ไม่มีลาย
  logoUrl?: string;
  view: "front" | "angle";
}

export type LogoTransform = {
  x: number;
  y: number;
  scale: number;
  rot: number;
};

const DEFAULT_LOGO_TRANSFORM: LogoTransform = {
  x: 0,
  y: 0,
  scale: 0.25,
  rot: 0,
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

  // ✅ สำคัญ: เปิดหน้าแรก "ไม่มีลาย"
  const initialPattern = "";

  const [customization, setCustomization] = useState<CustomizationState>({
    topColor: "#ffffff",
    bottomColor: "#eaeaea",
    switchColor: "#ffffff",
    patternUrl: initialPattern, // ✅ ว่าง
    logoUrl: undefined,
    view: "angle",
  });

  const [dragLogoMode, setDragLogoMode] = useState(false);

  const [logoTransform, setLogoTransform] = useState<LogoTransform>(
    DEFAULT_LOGO_TRANSFORM
  );

  // ✅ เก็บ “ลายที่อัปโหลดเอง”
  const [uploadedPatterns, setUploadedPatterns] = useState<string[]>([]);

  const plugConfig = useMemo(
    () => getPlugConfig(selectedPlugId, { modelPath: plug.modelPath }),
    [selectedPlugId, plug.modelPath]
  );

  function handleLogoSelect(url: string) {
    setCustomization((s) => ({ ...s, logoUrl: url }));
  }

  function resetLogo() {
    setCustomization((s) => ({ ...s, logoUrl: undefined }));
    setLogoTransform(DEFAULT_LOGO_TRANSFORM);
    setDragLogoMode(false);
  }

  const hasLogo = !!customization.logoUrl;

  // ✅ อัปโหลด “ลวดลาย” (Base64) แล้วเลือกใช้งานทันที
  function handlePatternUpload(base64: string) {
    setUploadedPatterns((prev) => [base64, ...prev]);
    setCustomization((s) => ({ ...s, patternUrl: base64 }));
  }

  // ✅ รีเซ็ตลาย: กลับเป็น "ไม่มีลาย"
  function resetPattern() {
    setCustomization((s) => ({ ...s, patternUrl: "" }));
  }

  // ✅ มีลายอยู่ไหม (trim กันช่องว่าง)
  const hasPattern = !!customization.patternUrl && customization.patternUrl.trim() !== "";

  return (
    <div
      style={{
        display: "flex",
        gap: 20,
        padding: 20,
        maxWidth: 1400,
        margin: "0 auto",
      }}
    >
      {/* LEFT */}
      <div style={{ flex: 2, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ height: 520, background: "#f2f6fb", borderRadius: 12, padding: 10 }}>
          <Plug3D
            key={plugConfig.modelPath}
            config={plugConfig}
            logoUrl={customization.logoUrl}
            patternUrl={customization.patternUrl} // ✅ ว่าง = ไม่มีลาย
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

          <button
            type="button"
            style={{ padding: "8px 14px", borderRadius: 8 }}
            onClick={resetLogo}
            disabled={!hasLogo}
            title={!hasLogo ? "ยังไม่มีโลโก้" : "ลบโลโก้และรีเซ็ตตำแหน่ง"}
          >
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

            // ✅ เปลี่ยนรุ่นแล้ว "ไม่มีลาย" (ไม่ติดลายแรก)
            setCustomization((s) => ({ ...s, patternUrl: "", logoUrl: undefined }));

            setLogoTransform(DEFAULT_LOGO_TRANSFORM);
            setDragLogoMode(false);

            // ✅ เปลี่ยนรุ่นแล้วไม่ให้ลายอัปโหลดข้ามรุ่น
            setUploadedPatterns([]);
          }}
        />

        <h3 style={{ marginTop: 18 }}>โลโก้ (Sticker + AutoUV)</h3>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={dragLogoMode}
            disabled={!hasLogo}
            onChange={(e) => setDragLogoMode(e.target.checked)}
          />
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
            onChange={(e) =>
              setLogoTransform((s) => ({ ...s, scale: Number(e.target.value) }))
            }
          />

          <div>X: {logoTransform.x.toFixed(2)}</div>
          <input
            type="range"
            min={-0.45}
            max={0.45}
            step={0.01}
            value={logoTransform.x}
            disabled={!hasLogo}
            onChange={(e) =>
              setLogoTransform((s) => ({ ...s, x: Number(e.target.value) }))
            }
          />

          <div>Y: {logoTransform.y.toFixed(2)}</div>
          <input
            type="range"
            min={-0.45}
            max={0.45}
            step={0.01}
            value={logoTransform.y}
            disabled={!hasLogo}
            onChange={(e) =>
              setLogoTransform((s) => ({ ...s, y: Number(e.target.value) }))
            }
          />

          <div>หมุน: {(logoTransform.rot * (180 / Math.PI)).toFixed(0)}°</div>
          <input
            type="range"
            min={-Math.PI}
            max={Math.PI}
            step={0.01}
            value={logoTransform.rot}
            disabled={!hasLogo}
            onChange={(e) =>
              setLogoTransform((s) => ({ ...s, rot: Number(e.target.value) }))
            }
          />
        </div>

        <h3 style={{ marginTop: 18 }}>สี</h3>
        <ColorPicker
          label="ฝาบน"
          initialColor={customization.topColor}
          onColorChange={(c) => setCustomization((s) => ({ ...s, topColor: c }))}
        />
        <ColorPicker
          label="ฝาล่าง"
          initialColor={customization.bottomColor}
          onColorChange={(c) => setCustomization((s) => ({ ...s, bottomColor: c }))}
        />
        <ColorPicker
          label="สวิตช์"
          initialColor={customization.switchColor}
          onColorChange={(c) => setCustomization((s) => ({ ...s, switchColor: c }))}
        />

        <h3 style={{ marginTop: 18 }}>มุมมอง</h3>
        <LayoutPreview
          view={customization.view}
          onSetView={(v) => setCustomization((s) => ({ ...s, view: v }))}
          onDownload={() => {}}
        />

        <h3 style={{ marginTop: 18 }}>ลวดลาย (Pattern)</h3>
        <PatternPicker
          patternsForSelected={patterns[selectedPlugId] || []}
          uploadedExamples={uploadedPatterns}
          onSelect={(imgUrl: string) =>
            setCustomization((s) => ({ ...s, patternUrl: imgUrl }))
          }
          onUpload={handlePatternUpload}
          onReset={resetPattern}
          disableReset={!hasPattern}
        />
      </div>
    </div>
  );
}
