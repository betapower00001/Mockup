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

const ALLOWED_COLOR_OPTIONS = [
  { label: "ขาว", value: "#ffffff" },
  { label: "ดำ", value: "#111111" },
  { label: "เทาอ่อน", value: "#d9d9d9" },
  { label: "เทาเข้ม", value: "#7a7a7a" },
  { label: "ครีม", value: "#f3ead8" },
  { label: "เบจ", value: "#d6c2a1" },
  { label: "น้ำเงิน", value: "#1d4ed8" },
  { label: "กรม", value: "#1e293b" },
];

function normalizeHex(hex?: string) {
  if (!hex) return hex;
  const h = hex.trim();
  if (!h.startsWith("#")) return h;
  return h.length >= 7 ? h.slice(0, 7).toLowerCase() : h.toLowerCase();
}

function ensureAllowedColor(color: string, options: { label: string; value: string }[]) {
  const normalized = normalizeHex(color) ?? "";
  const found = options.find((o) => (normalizeHex(o.value) ?? "") === normalized);
  return found ? found.value : options[0].value;
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
  const TWO_PI = Math.PI * 2;
  let x = ((r % TWO_PI) + TWO_PI) % TWO_PI;
  if (x > Math.PI) x -= TWO_PI;
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
  const [dragPatternMode, setDragPatternMode] = useState(false);

  const [logoTransform, setLogoTransform] = useState<LogoTransform>(DEFAULT_LOGO_TRANSFORM);
  const [patternTransform, setPatternTransform] = useState<PatternTransform>(DEFAULT_PATTERN_TRANSFORM);

  const [patternRotation, setPatternRotation] = useState<number>(0);

  const [uploadedPatterns, setUploadedPatterns] = useState<string[]>([]);

  const plugConfig = useMemo(
    () => getPlugConfig(selectedPlugId, { modelPath: plug.modelPath }),
    [selectedPlugId, plug.modelPath]
  );

  const safeColors = useMemo(() => {
    const out: Partial<Record<ColorKey, string>> = {
      top: ensureAllowedColor(customization.topColor, ALLOWED_COLOR_OPTIONS),
      bottom: ensureAllowedColor(customization.bottomColor, ALLOWED_COLOR_OPTIONS),
    };

    if (selectedPlugId !== "TYPE-1" && selectedPlugId !== "TYPE-3") {
      out.switch = ensureAllowedColor(customization.switchColor, ALLOWED_COLOR_OPTIONS);
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
    setPatternRotation(0);
    setDragPatternMode(false);
  }

  function resetAll() {
    patchCustomization({
      patternUrl: "",
      logoUrl: undefined,
      topColor: ALLOWED_COLOR_OPTIONS[0].value,
      bottomColor: "#eaeaea",
      switchColor: ALLOWED_COLOR_OPTIONS[0].value,
    });
    setLogoTransform(DEFAULT_LOGO_TRANSFORM);
    setPatternTransform(DEFAULT_PATTERN_TRANSFORM);
    setPatternRotation(0);
    setDragLogoMode(false);
    setDragPatternMode(false);
  }

  function handleLogoSelect(url: string) {
    patchCustomization({ logoUrl: url });
    setStep("logo");
  }

  function handlePatternUpload(base64: string) {
    setUploadedPatterns((prev) => [base64, ...prev]);
    patchCustomization({ patternUrl: base64 });
    setPatternTransform(DEFAULT_PATTERN_TRANSFORM);
    setPatternRotation(0);
    setDragPatternMode(false);
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
    patchCustomization({
      patternUrl: "",
      logoUrl: undefined,
      topColor: ensureAllowedColor(customization.topColor, ALLOWED_COLOR_OPTIONS),
      bottomColor: ensureAllowedColor(customization.bottomColor, ALLOWED_COLOR_OPTIONS),
      switchColor: ensureAllowedColor(customization.switchColor, ALLOWED_COLOR_OPTIONS),
    });
    setLogoTransform(DEFAULT_LOGO_TRANSFORM);
    setPatternTransform(DEFAULT_PATTERN_TRANSFORM);
    setPatternRotation(0);
    setDragLogoMode(false);
    setDragPatternMode(false);
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
              options={ALLOWED_COLOR_OPTIONS}
              onColorChange={(c) => patchCustomization({ topColor: c })}
            />

            <div style={{ height: 10 }} />

            <ColorPicker
              label="ฝาล่าง"
              initialColor={customization.bottomColor}
              options={ALLOWED_COLOR_OPTIONS}
              onColorChange={(c) => patchCustomization({ bottomColor: c })}
            />

            {selectedPlugId !== "TYPE-1" && selectedPlugId !== "TYPE-3" && (
              <>
                <div style={{ height: 10 }} />
                <ColorPicker
                  label="สวิตช์"
                  initialColor={customization.switchColor}
                  options={ALLOWED_COLOR_OPTIONS}
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
            <button type="button" className="btn btnGhost" onClick={resetPattern} disabled={!hasPattern}>
              ล้างลาย
            </button>
          </div>

          <div className="divider" />

          <label className="row" style={{ gap: 8, marginTop: 10 }}>
            <input
              type="checkbox"
              checked={dragPatternMode}
              disabled={!hasPattern}
              onChange={(e) => setDragPatternMode(e.target.checked)}
            />
            <span className="label" style={{ opacity: hasPattern ? 1 : 0.55 }}>
              โหมดลากลาย (ลากบนโมเดลได้เลย)
            </span>
          </label>

          {/* ⭐️ ปรับลด maxHeight ตรงนี้ให้เหลือ 220px เพื่อประหยัดพื้นที่ */}
          <div className="patternScroll" style={{ maxHeight: 220, marginTop: 10 }}>
            <PatternPicker
              patternsForSelected={patterns[selectedPlugId] || []}
              uploadedExamples={uploadedPatterns}
              onSelect={(imgUrl: string) => {
                patchCustomization({ patternUrl: imgUrl });
                setPatternTransform(DEFAULT_PATTERN_TRANSFORM);
                setPatternRotation(0);
                setDragPatternMode(false);
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
                  <button type="button" className="miniBtn" disabled={!hasPattern} onClick={() => rotatePattern(-Math.PI / 2)} title="หมุนซ้าย 90°">
                    ↺90
                  </button>
                  <button type="button" className="miniBtn" disabled={!hasPattern} onClick={() => rotatePattern(+Math.PI / 2)} title="หมุนขวา 90°">
                    ↻90
                  </button>
                  <button type="button" className="miniBtn" disabled={!hasPattern} onClick={() => rotatePattern(-degToRad(5))} title="หมุนซ้าย 5°">
                    −5°
                  </button>
                  <button type="button" className="miniBtn" disabled={!hasPattern} onClick={() => rotatePattern(+degToRad(5))} title="หมุนขวา 5°">
                    +5°
                  </button>
                  <button type="button" className="miniBtnWide" disabled={!hasPattern} onClick={() => setPatternRotation(0)} title="รีเซ็ตการหมุน">
                    รีเซ็ตหมุน
                  </button>
                </div>

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
              <button type="button" className="btn btnGhost" disabled={!hasLogo} onClick={resetLogo}>
                รีเซ็ต
              </button>
            </div>
          </div>

          <div className="divider" />

          <label className="row" style={{ gap: 8 }}>
            <input type="checkbox" checked={dragLogoMode} disabled={!hasLogo} onChange={(e) => setDragLogoMode(e.target.checked)} />
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

    return (
      <div>
        <div className="label">มุมมอง</div>
        <div className="hint">เลือกมุมมองสำหรับโชว์/ดาวน์โหลด</div>
        <div style={{ marginTop: 10 }}>
          <LayoutPreview view={customization.view} onSetView={(v) => patchCustomization({ view: v })} onDownload={() => { }} />
        </div>

        <div className="divider" />

        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="row" style={{ gap: 8 }}>
            <StatusBadge active={hasPattern} activeText="มีลาย" inactiveText="ไม่มีลาย" />
            <StatusBadge active={hasLogo} activeText="มีโลโก้" inactiveText="ไม่มีโลโก้" />
          </div>
          <button type="button" className="btn btnDanger" onClick={resetAll}>
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
              <button type="button" className="btn btnDanger" onClick={resetAll}>
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
                  onPatternTransformChange={setPatternTransform}
                  patternRotation={patternRotation}
                  colors={safeColors}
                  logoTransform={logoTransform}
                  onLogoTransformChange={setLogoTransform}
                  dragLogoMode={dragLogoMode && hasLogo}
                  dragPatternMode={dragPatternMode && hasPattern}
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
                  <button type="button" className="btn btnGhost" onClick={resetLogo} disabled={!hasLogo}>
                    รีเซ็ตโลโก้
                  </button>
                </div>
                <button type="button" className="btn btnGhost" onClick={resetPattern} disabled={!hasPattern}>
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

            {/* ⭐️ ส่วนที่ปรับปรุง: เรียงซ้ายขวา (Stepper ซ้าย, Content ขวา) */}
            <div className="body config-layout">

              {/* ซ้าย: เมนูขั้นตอน 1-5 */}
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

              {/* เส้นคั่นกลาง */}
              <div className="config-divider" />

              {/* ขวา: พื้นที่แสดงตัวเลือกของแต่ละขั้นตอน */}
              <div className="config-content">
                <div style={{ flex: 1, overflowY: "auto", paddingRight: 6 }}>
                  {renderStepContent()}
                </div>

                {/* ปุ่ม ย้อนกลับ / ถัดไป ให้อยู่ติดขอบล่างเสมอ */}
                <div style={{ marginTop: 16 }}>
                  <div className="divider" style={{ margin: "0 0 12px 0" }} />
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <button type="button" className="btn btnGhost" onClick={goBack} disabled={currentStepIdx === 0}>
                      ← ย้อนกลับ
                    </button>
                    <button
                      type="button"
                      className={`btn ${currentStepIdx === STEPS.length - 1 ? "btnGhost" : "btnPrimary"}`}
                      onClick={goNext}
                      disabled={currentStepIdx === STEPS.length - 1}
                    >
                      ถัดไป →
                    </button>
                  </div>
                </div>
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
        background: active ? "rgba(59,130,246,.12)" : "rgba(15,23,42,.04)",
        color: active ? "#1d4ed8" : "#0f172a",
        borderColor: active ? "rgba(59,130,246,.25)" : "rgba(15,23,42,.10)",
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
  .pc-wrap{
    min-height: 100vh;
    padding: 14px;
    background:
      radial-gradient(900px 500px at 10% 0%, rgba(59,130,246,.22), transparent 60%),
      radial-gradient(900px 500px at 90% 10%, rgba(168,85,247,.16), transparent 55%),
      linear-gradient(180deg, #f7f9ff, #eef2ff 60%, #f8fafc);
  }

  /* ⭐️ ขยายหน้าจอให้กว้างขึ้น และให้พื้นที่ฝั่งขวาเยอะขึ้น */
  .pc-grid{
    max-width: 1440px; 
    margin: 0 auto;
    display: grid;
    gap: 16px;
    grid-template-columns: 1fr 1.4fr; /* Mockup ซ้าย 1 ส่วน : เครื่องมือขวา 1.4 ส่วน */
    align-items: start;
  }

  :root{ --mockH: 480px; }
  @media (max-height: 820px){ :root{ --mockH: 440px; } }
  @media (max-height: 740px){ :root{ --mockH: 400px; } }

  /* ⭐️ เลย์เอาต์ใหม่ของการ์ดตั้งค่า (ซ้าย:เมนูขีด, กลาง:เส้น, ขวา:เนื้อหา) */
  .config-layout {
    display: grid;
    grid-template-columns: 180px 1px 1fr;
    gap: 16px;
    min-height: var(--mockH); /* ให้สูงอย่างน้อยเท่ากับฝั่ง 3D Mockup */
  }

  /* เส้นคั่นแนวตั้ง */
  .config-divider {
    width: 1px;
    background: rgba(226,232,240,.9);
  }

  .config-content {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  @media (max-width: 1100px){
    .pc-grid{ grid-template-columns: 1fr; }
    .sticky{ position: static !important; }
    
    /* ถ้าย่อจอเล็กลงให้กลับไปเรียงบน-ล่างเหมือนเดิม */
    .config-layout { 
      grid-template-columns: 1fr; 
      min-height: auto; 
    }
    .config-divider { 
      width: 100%; 
      height: 1px; 
      margin: 4px 0; 
    }
  }

  .card{
    background: rgba(255,255,255,.94);
    border: 1px solid rgba(226,232,240,.9);
    border-radius: 18px;
    box-shadow: 0 14px 34px rgba(15,23,42,.10);
    backdrop-filter: blur(12px);
    overflow: hidden;
  }

  .head{
    padding: 10px 12px;
    border-bottom: 1px solid rgba(226,232,240,.9);
    display:flex;
    justify-content:space-between;
    align-items:center;
    background: linear-gradient(180deg, rgba(248,250,252,.85), rgba(255,255,255,.75));
  }

  .title{ margin:0; font-size:14px; font-weight: 900; color:#0f172a; letter-spacing:.2px; }
  .sub{ margin:0; font-size:12px; color:#334155; opacity: .9; }

  .body{ padding: 12px; }

  .mock{
    height: var(--mockH);
    border-radius: 14px;
    background: linear-gradient(180deg, #0b2447, #e8eefc);
    border: 1px solid rgba(226,232,240,.9);
    overflow: hidden;
  }

  .label{
    font-size:12.5px;
    font-weight: 900;
    color:#0f172a;
    letter-spacing: .2px;
    text-shadow: 0 1px 0 rgba(255,255,255,.55);
  }

  .hint{
    font-size:12px;
    margin-top:6px;
    color:#334155;
    opacity: 1;
  }

  .row{ display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
  .divider{ height:1px; background: rgba(226,232,240,.9); margin:10px 0; }
  .sticky{ position: sticky; top: 12px; }

  .btn{
    padding: 7px 12px;
    border-radius: 12px;
    border: 1px solid rgba(148,163,184,.40);
    background: rgba(15,23,42,.92);
    color: white;
    cursor: pointer;
    font-weight: 900;
    transition: transform .12s ease, box-shadow .18s ease, background .18s ease, border-color .18s ease;
    box-shadow: 0 10px 18px rgba(15,23,42,.10);
  }
  .btn:hover{
    transform: translateY(-1px);
    box-shadow: 0 14px 26px rgba(15,23,42,.14);
  }
  .btn:active{ transform: translateY(0px); box-shadow: 0 10px 18px rgba(15,23,42,.10); }

  .btnPrimary{
    border: 1px solid rgba(59,130,246,.55);
    background: linear-gradient(180deg, rgba(59,130,246,.98), rgba(37,99,235,.98));
    box-shadow: 0 14px 26px rgba(37,99,235,.24);
  }

  .btnGhost{
    background: rgba(255,255,255,.78);
    color: #0f172a;
    border: 1px solid rgba(148,163,184,.45);
    box-shadow: 0 10px 18px rgba(15,23,42,.06);
  }
  .btnGhost:hover{
    background: rgba(255,255,255,.92);
    border-color: rgba(100,116,139,.45);
  }

  .btnDanger{
    border: 1px solid rgba(239,68,68,.40);
    background: linear-gradient(180deg, rgba(239,68,68,.95), rgba(220,38,38,.95));
    box-shadow: 0 14px 26px rgba(220,38,38,.18);
  }

  .btn:disabled{ opacity:.5; cursor:not-allowed; transform:none; box-shadow:none; }

  .badge{
    padding: 6px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 900;
    border: 1px solid rgba(148,163,184,.35);
  }

  .badgeSoft{
    padding: 6px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 900;
    background: rgba(15,23,42,.04);
    color: #0f172a;
    border: 1px solid rgba(148,163,184,.22);
  }

  .stepper{ display: grid; gap: 8px; align-content: start; }

  .stepItem{
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 14px;
    border: 1px solid rgba(148,163,184,.28);
    background: rgba(255,255,255,.88);
    cursor: pointer;
    text-align: left;
    transition: transform .12s ease, box-shadow .18s ease, background .18s ease, border-color .18s ease;
  }
  .stepItem:hover{
    transform: translateY(-1px);
    box-shadow: 0 12px 22px rgba(15,23,42,.10);
    border-color: rgba(59,130,246,.35);
  }
  .stepActive{
    background: rgba(59,130,246,.10);
    border-color: rgba(59,130,246,.35);
  }
  .stepDone{
    border-color: rgba(34,197,94,.28);
    background: rgba(34,197,94,.06);
  }

  .stepDot{
    width: 26px;
    height: 26px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    font-weight: 900;
    font-size: 12px;
    border: 1px solid rgba(148,163,184,.30);
    color: #1d4ed8;
    background: rgba(255,255,255,.9);
  }

  .stepText{
    font-weight: 900;
    font-size: 12.5px;
    color: #0f172a;
  }

  /* ⭐️ ปรับพื้นที่แสดงลวดลาย */
  .patternScroll {
    overflow-y: auto;
    overflow-x: hidden;
    padding-right: 6px;
  }

  /* ⭐️ จัดเรียงกล่องรูปลายให้เป็น Grid แบบปรับจำนวนอัตโนมัติ (Auto-fill) ไม่ล็อก 3 คอลัมน์ */
  .pattern-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(70px, 1fr)); 
    gap: 10px;
    align-items: start;
  }

  /* ลบคำสั่ง .patternScroll button ออก เพื่อไม่ให้ไปบีบปุ่ม "อัปโหลด" และ "ล้างลาย" ให้พัง */

  .miniPad{
    display:grid;
    grid-template-columns: repeat(3, 34px);
    gap: 6px;
    justify-content: end;
  }

  .miniBtn{
    width:34px;
    height:34px;
    border-radius: 12px;
    border: 1px solid rgba(59,130,246,.35);
    background: linear-gradient(180deg, rgba(37,99,235,.92), rgba(29,78,216,.92));
    color: white;
    cursor:pointer;
    font-weight: 900;
    transition: transform .12s ease, box-shadow .18s ease;
    box-shadow: 0 10px 18px rgba(37,99,235,.18);
  }
  .miniBtn:hover{ transform: translateY(-1px); box-shadow: 0 14px 24px rgba(37,99,235,.22); }
  .miniBtn:disabled{ opacity:.5; cursor:not-allowed; transform:none; box-shadow:none; }

  .miniBtnWide{
    height:34px;
    border-radius: 12px;
    border: 1px solid rgba(59,130,246,.30);
    background: rgba(15,23,42,.92);
    color: white;
    cursor:pointer;
    font-weight: 900;
    padding: 0 12px;
    font-size: 12px;
    width: auto;
    transition: transform .12s ease, box-shadow .18s ease;
    box-shadow: 0 10px 18px rgba(15,23,42,.12);
  }
  .miniBtnWide:hover{ transform: translateY(-1px); box-shadow: 0 14px 24px rgba(15,23,42,.14); }
  .miniBtnWide:disabled{ opacity:.5; cursor:not-allowed; transform:none; box-shadow:none; }

  input[type="range"]{
    accent-color: #2563eb;
  }

`;