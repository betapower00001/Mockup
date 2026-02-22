// src/components/PlugCustomizer.tsx
"use client";

import React, { useMemo, useState } from "react";
import plugTypes from "../data/plugTypes";
import patterns from "../data/patterns";
import Plug3D, { PatternTransform } from "./Plug3D";
import ColorPicker from "./ColorPicker";
import PlugSelector from "./PlugSelector";
import PatternPicker from "./PatternPicker";
import LayoutPreview from "./LayoutPreview";
import LogoUploader from "./LogoUploader";
import { getPlugConfig, type ColorKey } from "../data/plugConfig";

/* =========================
   Types
========================= */

interface Props {
  plugId: string;
}

interface CustomizationState {
  topColor: string;
  bottomColor: string;
  switchColor: string;
  patternUrl: string; // "" = ไม่มีลาย
  logoUrl?: string;
  view: "front" | "angle";
}

export type LogoTransform = {
  x: number;
  y: number;
  scale: number;
  rot: number;
};

type StepId = "model" | "color" | "pattern" | "logo" | "view";

/* =========================
   Defaults / Helpers
========================= */

const STEPS: { id: StepId; title: string; sub: string }[] = [
  { id: "model", title: "1) เลือกรุ่น", sub: "เลือกรุ่นปลั๊กที่ต้องการ" },
  { id: "color", title: "2) เลือกสี", sub: "ปรับสีฝาบน/ฝาล่าง" },
  { id: "pattern", title: "3) เลือกลาย", sub: "เลือกลวดลาย + เลื่อน/ซูม/หมุน" },
  { id: "logo", title: "4) ใส่โลโก้", sub: "อัปโหลด + ปรับตำแหน่ง/ขนาด" },
  { id: "view", title: "5) มุมมอง", sub: "เลือกมุมมองสำหรับโชว์/ดาวน์โหลด" },
];

const DEFAULT_CUSTOMIZATION: CustomizationState = {
  topColor: "#ffffff",
  bottomColor: "#eaeaea",
  switchColor: "#ffffff",
  patternUrl: "",
  logoUrl: undefined,
  view: "angle",
};

const DEFAULT_LOGO_TRANSFORM: LogoTransform = {
  x: 0,
  y: 0,
  scale: 0.25,
  rot: 0,
};

const DEFAULT_PATTERN_TRANSFORM: PatternTransform = {
  x: 0.5,
  y: 0.5,
  zoom: 1,
};

function normalizeHex(hex?: string) {
  if (!hex) return hex;
  const h = hex.trim();
  if (!h.startsWith("#")) return h;
  return h.length >= 7 ? h.slice(0, 7) : h;
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function stepIndex(id: StepId) {
  return STEPS.findIndex((s) => s.id === id);
}

function radToDeg(r: number) {
  return (r * 180) / Math.PI;
}
function degToRad(d: number) {
  return (d * Math.PI) / 180;
}
function normalizeRad(r: number) {
  // ให้อยู่ในช่วง (-PI..PI] เพื่อไม่ให้ค่าบวม
  const TWO_PI = Math.PI * 2;
  let x = ((r % TWO_PI) + TWO_PI) % TWO_PI; // 0..2PI
  if (x > Math.PI) x -= TWO_PI; // -PI..PI
  return x;
}

/* =========================
   Component
========================= */

export default function PlugCustomizer({ plugId }: Props) {
  const [step, setStep] = useState<StepId>("model");
  const [selectedPlugId, setSelectedPlugId] = useState<string>(plugId);

  const plug = plugTypes.find((p) => p.id === selectedPlugId)!;

  const [customization, setCustomization] = useState<CustomizationState>(DEFAULT_CUSTOMIZATION);
  const [dragLogoMode, setDragLogoMode] = useState(false);

  const [logoTransform, setLogoTransform] = useState<LogoTransform>(DEFAULT_LOGO_TRANSFORM);
  const [patternTransform, setPatternTransform] = useState<PatternTransform>(DEFAULT_PATTERN_TRANSFORM);

  // ✅ NEW: หมุนลาย (rad)
  const [patternRotation, setPatternRotation] = useState<number>(0);

  const [uploadedPatterns, setUploadedPatterns] = useState<string[]>([]);

  const plugConfig = useMemo(
    () => getPlugConfig(selectedPlugId, { modelPath: plug.modelPath }),
    [selectedPlugId, plug.modelPath]
  );

  // ✅ FIX (ไม่กระทบส่วนอื่น):
  // ส่ง switchColor เฉพาะรุ่นที่มีสวิตช์จริง (ไม่ใช่ TYPE-1)
  const safeColors = useMemo(() => {
    const out: Partial<Record<ColorKey, string>> = {
      top: normalizeHex(customization.topColor) ?? "",
      bottom: normalizeHex(customization.bottomColor) ?? "",
    };

    if (selectedPlugId !== "TYPE-1") {
      out.switch = normalizeHex(customization.switchColor) ?? "";
    }

    return out;
  }, [selectedPlugId, customization.topColor, customization.bottomColor, customization.switchColor]);

  const hasLogo = !!customization.logoUrl;
  const hasPattern = !!customization.patternUrl && customization.patternUrl.trim() !== "";
  const currentStepIdx = stepIndex(step);

  function patchCustomization(patch: Partial<CustomizationState>) {
    setCustomization((s) => ({ ...s, ...patch }));
  }

  function resetLogo() {
    patchCustomization({ logoUrl: undefined });
    setLogoTransform(DEFAULT_LOGO_TRANSFORM);
    setDragLogoMode(false);
  }

  function resetPattern() {
    patchCustomization({ patternUrl: "" });
    setPatternTransform(DEFAULT_PATTERN_TRANSFORM);
    setPatternRotation(0); // ✅ ADD
  }

  function resetAll() {
    patchCustomization({ patternUrl: "", logoUrl: undefined });
    setLogoTransform(DEFAULT_LOGO_TRANSFORM);
    setPatternTransform(DEFAULT_PATTERN_TRANSFORM);
    setPatternRotation(0); // ✅ ADD
    setDragLogoMode(false);
  }

  function handleLogoSelect(url: string) {
    patchCustomization({ logoUrl: url });
    setStep("logo");
  }

  function handlePatternUpload(base64: string) {
    setUploadedPatterns((prev) => [base64, ...prev]);
    patchCustomization({ patternUrl: base64 });
    setPatternTransform(DEFAULT_PATTERN_TRANSFORM);
    setPatternRotation(0); // ✅ ADD
    setStep("pattern");
  }

  function nudgePattern(dx: number, dy: number) {
    setPatternTransform((s) => ({
      ...s,
      x: clamp(s.x + dx, 0, 1),
      y: clamp(s.y + dy, 0, 1),
    }));
  }

  function handleChangeModel(id: string) {
    setSelectedPlugId(id);
    patchCustomization({ patternUrl: "", logoUrl: undefined });
    setLogoTransform(DEFAULT_LOGO_TRANSFORM);
    setPatternTransform(DEFAULT_PATTERN_TRANSFORM);
    setPatternRotation(0); // ✅ ADD
    setDragLogoMode(false);
    setUploadedPatterns([]);
    setStep("color");
  }

  function goNext() {
    const next = STEPS[currentStepIdx + 1]?.id;
    if (next) setStep(next);
  }

  function goBack() {
    const prev = STEPS[currentStepIdx - 1]?.id;
    if (prev) setStep(prev);
  }

  // ✅ UI helpers for pattern rotation
  function rotatePattern(deltaRad: number) {
    setPatternRotation((r) => normalizeRad(r + deltaRad));
  }
  function setRotationDeg(deg: number) {
    setPatternRotation(normalizeRad(degToRad(deg)));
  }
  const rotationDeg = Math.round(radToDeg(patternRotation));

  function renderStepContent() {
    if (step === "model") {
      return (
        <div>
          <div className="label">เลือกโมเดล (รุ่น)</div>
          <div className="hint">เปลี่ยนรุ่นแล้วระบบจะล้างลาย/โลโก้ให้</div>
          <div style={{ marginTop: 10 }}>
            <PlugSelector items={plugTypes} selected={selectedPlugId} onSelect={handleChangeModel} />
          </div>
        </div>
      );
    }

    if (step === "color") {
      return (
        <div>
          <div className="label">สี</div>
          <div className="hint">ปรับสีส่วนประกอบหลักของชิ้นงาน</div>

          <div style={{ marginTop: 10 }}>
            <ColorPicker
              label="ฝาบน"
              initialColor={customization.topColor}
              onColorChange={(c) => patchCustomization({ topColor: c })}
            />
            <div style={{ height: 10 }} />
            <ColorPicker
              label="ฝาล่าง"
              initialColor={customization.bottomColor}
              onColorChange={(c) => patchCustomization({ bottomColor: c })}
            />

            {/* ✅ ซ่อนสวิตช์สำหรับ TYPE-1 */}
            {selectedPlugId !== "TYPE-1" && (
              <>
                <div style={{ height: 10 }} />
                <ColorPicker
                  label="สวิตช์"
                  initialColor={customization.switchColor}
                  onColorChange={(c) => patchCustomization({ switchColor: c })}
                />
              </>
            )}
          </div>
        </div>
      );
    }

    if (step === "pattern") {
      return (
        <div>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <div className="label">ลวดลาย (Pattern)</div>
              <div className="hint">เลือก/อัปโหลดลาย แล้วเลื่อนตำแหน่ง + ซูม + หมุน</div>
            </div>
            <button type="button" className="btn" onClick={resetPattern} disabled={!hasPattern}>
              ล้างลาย
            </button>
          </div>

          <div className="divider" />

          <div className="patternScroll" style={{ maxHeight: 320 }}>
            <PatternPicker
              patternsForSelected={patterns[selectedPlugId] || []}
              uploadedExamples={uploadedPatterns}
              onSelect={(imgUrl: string) => {
                patchCustomization({ patternUrl: imgUrl });
                setPatternTransform(DEFAULT_PATTERN_TRANSFORM);
                setPatternRotation(0);
              }}
              onUpload={handlePatternUpload}
              onReset={resetPattern}
              disableReset={!hasPattern}
              thumbSize={70}
            />
          </div>

          <div className="divider" />

          <div style={{ opacity: hasPattern ? 1 : 0.45 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: 12 }}>
              {/* LEFT: sliders */}
              <div>
                <Slider
                  label={`X: ${patternTransform.x.toFixed(2)}`}
                  min={0}
                  max={1}
                  step={0.01}
                  value={patternTransform.x}
                  disabled={!hasPattern}
                  onChange={(v) => setPatternTransform((s) => ({ ...s, x: v }))}
                />
                <div style={{ height: 10 }} />
                <Slider
                  label={`Y: ${patternTransform.y.toFixed(2)}`}
                  min={0}
                  max={1}
                  step={0.01}
                  value={patternTransform.y}
                  disabled={!hasPattern}
                  onChange={(v) => setPatternTransform((s) => ({ ...s, y: v }))}
                />
                <div style={{ height: 10 }} />
                <Slider
                  label={`Zoom: ${patternTransform.zoom.toFixed(2)}`}
                  min={0.1}
                  max={10}
                  step={0.01}
                  value={patternTransform.zoom}
                  disabled={!hasPattern}
                  onChange={(v) => setPatternTransform((s) => ({ ...s, zoom: v }))}
                />

                {/* ✅ Quick controls row: Zoom + Rotate */}
                <div className="row" style={{ marginTop: 10, gap: 8 }}>
                  <button
                    type="button"
                    className="miniBtnWide"
                    disabled={!hasPattern}
                    onClick={() => setPatternTransform((s) => ({ ...s, zoom: clamp(s.zoom - 0.1, 0.1, 10) }))}
                    title="ลายใหญ่ขึ้น"
                  >
                    − ขยายลาย
                  </button>
                  <button
                    type="button"
                    className="miniBtnWide"
                    disabled={!hasPattern}
                    onClick={() => setPatternTransform((s) => ({ ...s, zoom: clamp(s.zoom + 0.1, 0.1, 10) }))}
                    title="ลายถี่ขึ้น"
                  >
                    + เพิ่มลายซ้ำ
                  </button>
                </div>

                {/* ✅ Rotate controls (ใช้งานสะดวก) */}
                <div className="divider" style={{ margin: "12px 0" }} />
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <div>
                    <div className="label">หมุนลาย</div>
                    <div className="hint" style={{ marginTop: 4 }}>
                      หมุน 90° หรือปรับละเอียด
                    </div>
                  </div>
                  <span className="badgeSoft" style={{ fontSize: 12 }}>
                    {rotationDeg}°
                  </span>
                </div>

                <div className="row" style={{ marginTop: 8, gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="miniBtn"
                    disabled={!hasPattern}
                    onClick={() => rotatePattern(-Math.PI / 2)}
                    title="หมุนซ้าย 90°"
                  >
                    ↺90
                  </button>
                  <button
                    type="button"
                    className="miniBtn"
                    disabled={!hasPattern}
                    onClick={() => rotatePattern(+Math.PI / 2)}
                    title="หมุนขวา 90°"
                  >
                    ↻90
                  </button>
                  <button
                    type="button"
                    className="miniBtn"
                    disabled={!hasPattern}
                    onClick={() => rotatePattern(-degToRad(5))}
                    title="หมุนซ้าย 5°"
                  >
                    −5°
                  </button>
                  <button
                    type="button"
                    className="miniBtn"
                    disabled={!hasPattern}
                    onClick={() => rotatePattern(+degToRad(5))}
                    title="หมุนขวา 5°"
                  >
                    +5°
                  </button>
                  <button
                    type="button"
                    className="miniBtnWide"
                    disabled={!hasPattern}
                    onClick={() => setPatternRotation(0)}
                    title="รีเซ็ตการหมุน"
                  >
                    รีเซ็ตหมุน
                  </button>
                </div>

                {/* ✅ Rotation slider */}
                <div style={{ marginTop: 10 }}>
                  <Slider
                    label={`องศา: ${rotationDeg}°`}
                    min={-180}
                    max={180}
                    step={1}
                    value={rotationDeg}
                    disabled={!hasPattern}
                    onChange={(v) => setRotationDeg(v)}
                  />
                </div>
              </div>

              {/* RIGHT: nudge pad */}
              <div>
                <div className="label">เลื่อนละเอียด</div>
                <div className="miniPad" style={{ marginTop: 8 }}>
                  <div />
                  <button type="button" className="miniBtn" disabled={!hasPattern} onClick={() => nudgePattern(0, -0.02)}>
                    ↑
                  </button>
                  <div />
                  <button type="button" className="miniBtn" disabled={!hasPattern} onClick={() => nudgePattern(-0.02, 0)}>
                    ←
                  </button>
                  <button
                    type="button"
                    className="miniBtn"
                    disabled={!hasPattern}
                    onClick={() => {
                      setPatternTransform(DEFAULT_PATTERN_TRANSFORM);
                      setPatternRotation(0);
                    }}
                    title="รีเซ็ตตำแหน่ง/ซูม/หมุน"
                  >
                    ⟲
                  </button>
                  <button type="button" className="miniBtn" disabled={!hasPattern} onClick={() => nudgePattern(0.02, 0)}>
                    →
                  </button>
                  <div />
                  <button type="button" className="miniBtn" disabled={!hasPattern} onClick={() => nudgePattern(0, 0.02)}>
                    ↓
                  </button>
                  <div />
                </div>

                <div className="divider" />

                <div className="hint" style={{ marginTop: 8 }}>
                  ทิป: ถ้า “ลายหันผิดทิศ” ให้กด ↺90 หรือ ↻90 ก่อน แล้วค่อยเลื่อน/ซูม
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (step === "logo") {
      return (
        <div>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <div className="label">โลโก้</div>
              <div className="hint">อัปโหลดและจัดวางโลโก้</div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <LogoUploader onSelect={handleLogoSelect} />
              <button type="button" className="btn" disabled={!hasLogo} onClick={resetLogo}>
                รีเซ็ต
              </button>
            </div>
          </div>

          <div className="divider" />

          <label className="row" style={{ gap: 8 }}>
            <input
              type="checkbox"
              checked={dragLogoMode}
              disabled={!hasLogo}
              onChange={(e) => setDragLogoMode(e.target.checked)}
            />
            <span className="label" style={{ opacity: hasLogo ? 1 : 0.55 }}>
              โหมดลากโลโก้
            </span>
          </label>

          <div style={{ marginTop: 10, opacity: hasLogo ? 1 : 0.5 }}>
            <Slider
              label={`ขนาด: ${logoTransform.scale.toFixed(2)}`}
              min={0.05}
              max={0.6}
              step={0.01}
              value={logoTransform.scale}
              disabled={!hasLogo}
              onChange={(v) => setLogoTransform((s) => ({ ...s, scale: v }))}
            />
            <div style={{ height: 10 }} />
            <Slider
              label={`X: ${logoTransform.x.toFixed(2)}`}
              min={-0.45}
              max={0.45}
              step={0.01}
              value={logoTransform.x}
              disabled={!hasLogo}
              onChange={(v) => setLogoTransform((s) => ({ ...s, x: v }))}
            />
            <div style={{ height: 10 }} />
            <Slider
              label={`Y: ${logoTransform.y.toFixed(2)}`}
              min={-0.45}
              max={0.45}
              step={0.01}
              value={logoTransform.y}
              disabled={!hasLogo}
              onChange={(v) => setLogoTransform((s) => ({ ...s, y: v }))}
            />
            <div style={{ height: 10 }} />
            <Slider
              label={`หมุน: ${(logoTransform.rot * (180 / Math.PI)).toFixed(0)}°`}
              min={-Math.PI}
              max={Math.PI}
              step={0.01}
              value={logoTransform.rot}
              disabled={!hasLogo}
              onChange={(v) => setLogoTransform((s) => ({ ...s, rot: v }))}
            />
          </div>
        </div>
      );
    }

    // view step
    return (
      <div>
        <div className="label">มุมมอง</div>
        <div className="hint">เลือกมุมมองสำหรับโชว์/ดาวน์โหลด</div>
        <div style={{ marginTop: 10 }}>
          <LayoutPreview view={customization.view} onSetView={(v) => patchCustomization({ view: v })} onDownload={() => {}} />
        </div>
        <div className="divider" />
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="row" style={{ gap: 8 }}>
            <StatusBadge active={hasPattern} activeText="มีลาย" inactiveText="ไม่มีลาย" />
            <StatusBadge active={hasLogo} activeText="มีโลโก้" inactiveText="ไม่มีโลโก้" />
          </div>
          <button type="button" className="btn" onClick={resetAll}>
            รีเซ็ตทั้งหมด
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pc-wrap">
      <style>{CSS}</style>

      <div className="pc-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="card">
            <div className="head">
              <div>
                <h3 className="title">Mockup</h3>
                <p className="sub">แสดงตัวอย่างสินค้า 3D</p>
              </div>
              <button type="button" className="btn" onClick={resetAll}>
                รีเซ็ตทั้งหมด
              </button>
            </div>

            <div className="body">
              <div className="mock">
                <Plug3D
                  key={plugConfig.modelPath}
                  config={plugConfig}
                  logoUrl={customization.logoUrl}
                  patternUrl={customization.patternUrl}
                  patternTransform={patternTransform}
                  // ✅ NEW: ส่งมุมหมุนลาย
                  patternRotation={patternRotation}
                  // ✅ FIX: ส่ง colors แบบปลอดภัย (TYPE-1 จะไม่โดน switch)
                  colors={safeColors}
                  logoTransform={logoTransform}
                  onLogoTransformChange={setLogoTransform}
                  dragLogoMode={dragLogoMode && hasLogo}
                />
              </div>

              <div className="row" style={{ marginTop: 10, justifyContent: "space-between" }}>
                <div className="row">
                  <span className="badgeSoft">รุ่น: {plug.name ?? selectedPlugId}</span>
                  <span className="badgeSoft">Step: {currentStepIdx + 1}/5</span>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <StatusBadge active={hasPattern} activeText="มีลาย" inactiveText="ไม่มีลาย" />
                  <StatusBadge active={hasLogo} activeText="มีโลโก้" inactiveText="ไม่มีโลโก้" />
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="head">
              <div>
                <h3 className="title">Quick Actions</h3>
                <p className="sub">ทางลัดการปรับแต่ง</p>
              </div>
            </div>
            <div className="body">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div className="row">
                  <LogoUploader onSelect={handleLogoSelect} />
                  <button type="button" className="btn" onClick={resetLogo} disabled={!hasLogo}>
                    รีเซ็ตโลโก้
                  </button>
                </div>
                <button type="button" className="btn" onClick={resetPattern} disabled={!hasPattern}>
                  ล้างลาย
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="sticky">
          <div className="card">
            <div className="head">
              <div>
                <h3 className="title">ขั้นตอนการปรับแต่ง</h3>
                <p className="sub">ทำตามลำดับเพื่อความสวยงาม</p>
              </div>
            </div>

            <div className="body">
              <div className="stepper">
                {STEPS.map((s, idx) => {
                  const active = s.id === step;
                  const done = idx < currentStepIdx;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={`stepItem ${active ? "stepActive" : ""} ${done ? "stepDone" : ""}`}
                      onClick={() => setStep(s.id)}
                    >
                      <span className="stepDot">{done ? "✓" : idx + 1}</span>
                      <span className="stepText">{s.title}</span>
                    </button>
                  );
                })}
              </div>

              <div className="divider" />

              <div>{renderStepContent()}</div>

              <div className="divider" />

              <div className="row" style={{ justifyContent: "space-between" }}>
                <button type="button" className="btn" onClick={goBack} disabled={currentStepIdx === 0}>
                  ← ย้อนกลับ
                </button>
                <button
                  type="button"
                  className={`btn ${currentStepIdx === STEPS.length - 1 ? "" : "btnPrimary"}`}
                  onClick={goNext}
                  disabled={currentStepIdx === STEPS.length - 1}
                >
                  ถัดไป →{" "}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({
  active,
  activeText,
  inactiveText,
}: {
  active: boolean;
  activeText: string;
  inactiveText: string;
}) {
  return (
    <span
      className="badge"
      style={{
        background: active ? "rgba(80,125,255,.12)" : "rgba(0,0,0,.04)",
        color: active ? "#2d4be8" : "#374766",
      }}
    >
      {active ? activeText : inactiveText}
    </span>
  );
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  disabled,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="label">{label}</div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%" }}
      />
    </div>
  );
}

const CSS = `
  .pc-wrap{ min-height: 100vh; background: radial-gradient(1200px 500px at 20% 0%, rgba(90,140,255,.12), transparent 60%), linear-gradient(#f7f9fc, #cc0773); padding: 14px; }
  .pc-grid{ max-width: 1280px; margin: 0 auto; display: grid; gap: 12px; grid-template-columns: 1.62fr 1fr; align-items: start; }
  :root{ --mockH: 480px; }
  @media (max-height: 820px){ :root{ --mockH: 440px; } }
  @media (max-height: 740px){ :root{ --mockH: 400px; } }
  @media (max-width: 1100px){ .pc-grid{ grid-template-columns: 1fr; } .sticky{ position: static !important; } }
  .card{ background: rgba(255,255,255,.86); border: 1px solid rgba(220,226,240,.95); border-radius: 16px; box-shadow: 0 10px 26px rgba(30,55,90,.1); backdrop-filter: blur(10px); overflow: hidden; }
  .head{ padding: 10px 12px; border-bottom: 1px solid rgba(230,235,245,.9); display:flex; justify-content:space-between; align-items:center; }
  .title{ margin:0; font-size:14px; font-weight: 900; }
  .sub{ margin:0; font-size:12px; opacity:.7; }
  .body{ padding: 12px; }
  .mock{ height: var(--mockH); border-radius: 14px; background: linear-gradient(180deg, #003a81, #edf2fb); border: 1px solid rgba(220,226,240,.9); overflow: hidden; }
  .row{ display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
  .btn{ padding: 7px 12px; border-radius: 12px; border: 1px solid rgba(210,218,235,.9); background: rgba(0, 17, 53, 0.9); color: white; cursor: pointer; font-weight: 800; transition: all .18s ease; }
  .btnPrimary{ border: 1px solid rgba(55,110,255,.45); background: linear-gradient(180deg, rgba(85,135,255,.95), rgba(70,110,245,.95)); box-shadow: 0 10px 22px rgba(70,110,245,.22); }
  .btn:disabled{ opacity:.45; cursor:not-allowed; }
  .badge{ padding: 6px 10px; border-radius: 999px; font-size: 12px; font-weight: 900; border: 1px solid rgba(210,218,235,.9); }
  .badgeSoft{ padding: 6px 10px; border-radius: 999px; font-size: 12px; font-weight: 900; background: rgba(0,0,0,.03); color: #374766; }
  .divider{ height:1px; background: rgba(230,235,245,.9); margin:10px 0; }
  .label{ font-size:12.5px; font-weight:900; color:#263455; }
  .hint{ font-size:12px; opacity:.7; margin-top:6px; }
  .sticky{ position: sticky; top: 12px; }
  .patternScroll{ overflow: auto; padding-right: 6px; }
  .miniPad{ display:grid; grid-template-columns: repeat(3, 34px); gap: 6px; justify-content: end; }
  .miniBtn{ width:34px; height:34px; border-radius: 12px; border: 1px solid rgba(210,218,235,.9); background: rgba(0, 32, 136, 0.9); color: white; cursor:pointer; font-weight: 900; }
  .miniBtnWide{ height:34px; border-radius: 12px; border: 1px solid rgba(210,218,235,.9); background: rgba(0, 32, 136, 0.9); color: white; cursor:pointer; font-weight: 900; padding: 0 12px; font-size: 12px; width: auto; }
  .stepper{ display: grid; gap: 8px; }
  .stepItem{ display: flex; align-items: center; gap: 10px; padding: 10px; border-radius: 14px; border: 1px solid rgba(210,218,235,.9); background: white; cursor: pointer; text-align: left; }
  .stepActive{ background: rgba(80,125,255,.12); border-color: rgba(55,110,255,.35); }
  .stepDot{ width: 26px; height: 26px; border-radius: 999px; display: grid; place-items: center; font-weight: 900; font-size: 12px; border: 1px solid rgba(210,218,235,.9); color: #2d4be8; }
  .stepText{ font-weight: 900; font-size: 12.5px; color: #263455; }
`;