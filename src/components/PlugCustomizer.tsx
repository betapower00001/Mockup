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
import { getPlugConfig } from "../data/plugConfig";

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
  { id: "pattern", title: "3) เลือกลาย", sub: "เลือกลวดลาย + เลื่อน/ซูม" },
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

/* =========================
   Component
========================= */

export default function PlugCustomizer({ plugId }: Props) {
  /* ---------- Stepper ---------- */
  const [step, setStep] = useState<StepId>("model");

  /* ---------- Model selection ---------- */
  const [selectedPlugId, setSelectedPlugId] = useState<string>(plugId);
  const plug = plugTypes.find((p) => p.id === selectedPlugId)!;

  /* ---------- Customization state ---------- */
  const [customization, setCustomization] = useState<CustomizationState>(DEFAULT_CUSTOMIZATION);

  /* ---------- Logo controls ---------- */
  const [dragLogoMode, setDragLogoMode] = useState(false);
  const [logoTransform, setLogoTransform] = useState<LogoTransform>(DEFAULT_LOGO_TRANSFORM);

  /* ---------- Pattern controls ---------- */
  const [patternTransform, setPatternTransform] = useState<PatternTransform>(DEFAULT_PATTERN_TRANSFORM);
  const [uploadedPatterns, setUploadedPatterns] = useState<string[]>([]);

  /* ---------- Derived ---------- */
  const plugConfig = useMemo(
    () => getPlugConfig(selectedPlugId, { modelPath: plug.modelPath }),
    [selectedPlugId, plug.modelPath]
  );

  const hasLogo = !!customization.logoUrl;
  const hasPattern = !!customization.patternUrl && customization.patternUrl.trim() !== "";

  const currentStepIdx = stepIndex(step);

  /* =========================
     State helpers
  ========================= */

  function patchCustomization(patch: Partial<CustomizationState>) {
    setCustomization((s) => ({ ...s, ...patch }));
  }

  /* =========================
     Actions
  ========================= */

  function resetLogo() {
    patchCustomization({ logoUrl: undefined });
    setLogoTransform(DEFAULT_LOGO_TRANSFORM);
    setDragLogoMode(false);
  }

  function resetPattern() {
    patchCustomization({ patternUrl: "" });
    setPatternTransform(DEFAULT_PATTERN_TRANSFORM);
  }

  function resetAll() {
    patchCustomization({ patternUrl: "", logoUrl: undefined });
    setLogoTransform(DEFAULT_LOGO_TRANSFORM);
    setPatternTransform(DEFAULT_PATTERN_TRANSFORM);
    setDragLogoMode(false);
  }

  function handleLogoSelect(url: string) {
    patchCustomization({ logoUrl: url });
    // อยู่ step logo ต่อเลย (UX)
    setStep("logo");
  }

  function handlePatternUpload(base64: string) {
    setUploadedPatterns((prev) => [base64, ...prev]);
    patchCustomization({ patternUrl: base64 });
    setPatternTransform(DEFAULT_PATTERN_TRANSFORM);
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

    // เปลี่ยนรุ่นแล้วล้างค่า กันข้ามรุ่น
    patchCustomization({ patternUrl: "", logoUrl: undefined });
    setLogoTransform(DEFAULT_LOGO_TRANSFORM);
    setPatternTransform(DEFAULT_PATTERN_TRANSFORM);
    setDragLogoMode(false);
    setUploadedPatterns([]);

    // ส่งไป step สีทันที (flow)
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

  /* =========================
     UI render blocks (ทำให้อ่านง่าย)
  ========================= */

  function renderStepContent() {
    if (step === "model") {
      return (
        <div>
          <div className="label">เลือกโมเดล (รุ่น)</div>
          <div className="hint">เปลี่ยนรุ่นแล้วระบบจะล้างลาย/โลโก้ให้ เพื่อไม่ให้ข้ามรุ่น</div>
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
          <div className="hint">ปรับสีฝาบน/ฝาล่าง (และสีสวิตช์ถ้ามีในโมเดล)</div>

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
            <div style={{ height: 10 }} />
            <ColorPicker
              label="สวิตช์"
              initialColor={customization.switchColor}
              onColorChange={(c) => patchCustomization({ switchColor: c })}
            />
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
              <div className="hint">เลือก/อัปโหลดลาย แล้วเลื่อนตำแหน่ง + ซูม</div>
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
              }}
              onUpload={handlePatternUpload}
              onReset={resetPattern}
              disableReset={!hasPattern}
              thumbSize={70}
            />
          </div>

          <div className="divider" />

          <div style={{ opacity: hasPattern ? 1 : 0.45 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 170px", gap: 12 }}>
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
                  min={1}
                  max={4}
                  step={0.01}
                  value={patternTransform.zoom}
                  disabled={!hasPattern}
                  onChange={(v) => setPatternTransform((s) => ({ ...s, zoom: v }))}
                />
              </div>

              <div>
                <div className="label">เลื่อนละเอียด</div>
                <div className="miniPad" style={{ marginTop: 8 }}>
                  <div />
                  <button
                    type="button"
                    className="miniBtn"
                    disabled={!hasPattern}
                    onClick={() => nudgePattern(0, -0.02)}
                    title="ขึ้น"
                  >
                    ↑
                  </button>
                  <div />

                  <button
                    type="button"
                    className="miniBtn"
                    disabled={!hasPattern}
                    onClick={() => nudgePattern(-0.02, 0)}
                    title="ซ้าย"
                  >
                    ←
                  </button>

                  <button
                    type="button"
                    className="miniBtn"
                    disabled={!hasPattern}
                    onClick={() => setPatternTransform(DEFAULT_PATTERN_TRANSFORM)}
                    title="รีเซ็ต"
                  >
                    ⟲
                  </button>

                  <button
                    type="button"
                    className="miniBtn"
                    disabled={!hasPattern}
                    onClick={() => nudgePattern(0.02, 0)}
                    title="ขวา"
                  >
                    →
                  </button>

                  <div />
                  <button
                    type="button"
                    className="miniBtn"
                    disabled={!hasPattern}
                    onClick={() => nudgePattern(0, 0.02)}
                    title="ลง"
                  >
                    ↓
                  </button>
                  <div />
                </div>

                <button
                  type="button"
                  className="btn"
                  style={{ width: "100%", marginTop: 10 }}
                  disabled={!hasPattern}
                  onClick={() => setPatternTransform(DEFAULT_PATTERN_TRANSFORM)}
                >
                  รีเซ็ตตำแหน่งลาย
                </button>
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
              <div className="hint">อัปโหลดโลโก้ แล้วปรับตำแหน่ง/ขนาด/การหมุน</div>
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

    // step === "view"
    return (
      <div>
        <div className="label">มุมมอง</div>
        <div className="hint">เลือกมุมมอง (ตอนนี้ onDownload ยังเป็น placeholder ตามโค้ดเดิม)</div>

        <div style={{ marginTop: 10 }}>
          <LayoutPreview
            view={customization.view}
            onSetView={(v) => patchCustomization({ view: v })}
            onDownload={() => {}}
          />
        </div>

        <div className="divider" />

        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="row" style={{ gap: 8 }}>
            <StatusBadge active={hasPattern} activeText="มีลาย" inactiveText="ไม่มีลาย" />
            <StatusBadge active={hasLogo} activeText="มีโลโก้" inactiveText="ไม่มีโลโก้" />
          </div>

          <button type="button" className="btn" onClick={resetAll} title="รีเซ็ตทั้งหมด">
            รีเซ็ตทั้งหมด
          </button>
        </div>
      </div>
    );
  }

  /* =========================
     Render
  ========================= */

  return (
    <div className="pc-wrap">
      <style>{CSS}</style>

      <div className="pc-grid">
        {/* ================= LEFT: Preview ================= */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="card">
            <div className="head">
              <div>
                <h3 className="title">Mockup</h3>
                <p className="sub">ปรับความสูงตามจอโน๊ตบุ๊กอัตโนมัติ</p>
              </div>

              <div className="row" style={{ gap: 8 }}>
                <button type="button" className="btn" onClick={resetAll}>
                  รีเซ็ตทั้งหมด
                </button>
              </div>
            </div>

            <div className="body">
              <div className="mock">
                <Plug3D
                  key={plugConfig.modelPath}
                  config={plugConfig}
                  logoUrl={customization.logoUrl}
                  patternUrl={customization.patternUrl}
                  patternTransform={patternTransform}
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
                <p className="sub">ทำงานไว (ไม่ต้องสลับหน้า)</p>
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
                <div className="row">
                  <button type="button" className="btn" onClick={resetPattern} disabled={!hasPattern}>
                    ล้างลาย
                  </button>
                </div>
              </div>

              <div className="hint" style={{ marginTop: 8 }}>
                Tip: ถ้าจอเตี้ย ระบบจะลดความสูง Mockup ให้อัตโนมัติ
              </div>
            </div>
          </div>
        </div>

        {/* ================= RIGHT: Stepper ================= */}
        <div className="sticky">
          <div className="card">
            <div className="head">
              <div>
                <h3 className="title">ปรับแต่งทีละขั้น</h3>
                <p className="sub">Stepper ช่วยให้ไม่รก + ทำเสร็จไว</p>
              </div>
            </div>

            <div className="body">
              {/* Stepper header */}
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
                      title={s.sub}
                    >
                      <span className="stepDot">{done ? "✓" : idx + 1}</span>
                      <span className="stepText">{s.title}</span>
                    </button>
                  );
                })}
              </div>

              <div className="divider" />

              {/* Step content */}
              <div>{renderStepContent()}</div>

              <div className="divider" />

              {/* Navigation */}
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
                  ถัดไป →
                </button>
              </div>
            </div>
          </div>
        </div>
        {/* /RIGHT */}
      </div>
    </div>
  );
}

/* =========================
   Small UI helpers
========================= */

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

/* =========================
   CSS
========================= */

const CSS = `
  .pc-wrap{
    min-height: 100vh;
    background:
      radial-gradient(1200px 500px at 20% 0%, rgba(90,140,255,.12), transparent 60%),
      linear-gradient(#f7f9fc, #cc0773);
    padding: 14px 14px;
  }

  .pc-grid{
    max-width: 1280px;
    margin: 0 auto;
    display: grid;
    gap: 12px;
    grid-template-columns: 1.62fr 1fr;
    align-items: start;
  }

  :root{
    --mockH: 480px;
  }
  @media (max-height: 820px){
    :root{ --mockH: 440px; }
  }
  @media (max-height: 740px){
    :root{ --mockH: 400px; }
  }

  @media (max-width: 1100px){
    .pc-grid{ grid-template-columns: 1fr; }
    .sticky{ position: static !important; }
  }

  .card{
    background: rgba(255,255,255,.86);
    border: 1px solid rgba(220,226,240,.95);
    border-radius: 16px;
    box-shadow: 0 10px 26px rgba(30,55,90,.10);
    backdrop-filter: blur(10px);
    overflow: hidden;
  }

  .head{
    padding: 10px 12px;
    border-bottom: 1px solid rgba(230,235,245,.9);
    display:flex;
    justify-content:space-between;
    align-items:center;
    gap:10px;
  }

  .title{
    margin:0;
    font-size:14px;
    font-weight: 900;
    letter-spacing:.2px;
  }

  .sub{
    margin:0;
    font-size:12px;
    opacity:.7;
  }

  .body{ padding: 12px; }

  .mock{
    height: var(--mockH);
    border-radius: 14px;
    background: linear-gradient(180deg, #003a81, #edf2fb);
    border: 1px solid rgba(220,226,240,.9);
    overflow: hidden;
  }

  .row{ display:flex; gap:10px; align-items:center; flex-wrap:wrap; }

  .btn{
    padding: 7px 12px;
    border-radius: 12px;
    border: 1px solid rgba(210,218,235,.9);
    background: rgba(0, 17, 53, 0.9);
    cursor: pointer;
    font-weight: 800;
    transition: all .18s ease;
    white-space: nowrap;
  }
  .btn:hover{ transform: translateY(-1px); box-shadow: 0 10px 20px rgba(30,55,90,.08); }
  .btn:disabled{ opacity:.45; cursor:not-allowed; transform:none; box-shadow:none; }

  .btnPrimary{
    border: 1px solid rgba(55,110,255,.45);
    background: linear-gradient(180deg, rgba(85,135,255,.95), rgba(70,110,245,.95));
    color:#fff;
    box-shadow: 0 10px 22px rgba(70,110,245,.22);
  }

  .badge{
    padding: 6px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 900;
    border: 1px solid rgba(210,218,235,.9);
    white-space: nowrap;
    user-select: none;
  }

  .badgeSoft{
    padding: 6px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 900;
    border: 1px solid rgba(210,218,235,.9);
    background: rgba(0,0,0,.03);
    color: #374766;
    user-select: none;
  }

  .divider{
    height:1px;
    background: rgba(230,235,245,.9);
    margin:10px 0;
  }

  .label{
    font-size:12.5px;
    font-weight:900;
    color:#263455;
  }

  .hint{
    font-size:12px;
    opacity:.7;
    margin-top:6px;
  }

  .sticky{ position: sticky; top: 12px; }

  /* Pattern scroll inside step */
  .patternScroll{
    overflow: auto;
    padding-right: 6px;
  }
  .patternScroll::-webkit-scrollbar{ width: 8px; }
  .patternScroll::-webkit-scrollbar-thumb{
    background: rgba(150,165,195,.45);
    border-radius: 999px;
  }

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
    border: 1px solid rgba(210,218,235,.9);
    background: rgba(0, 32, 136, 0.9);
    cursor:pointer;
    font-weight: 900;
    transition: all .18s ease;
  }
  .miniBtn:hover{ transform: translateY(-1px); box-shadow: 0 10px 20px rgba(30,55,90,.08); }
  .miniBtn:disabled{ opacity:.45; cursor:not-allowed; transform:none; box-shadow:none; }

  /* Stepper */
  .stepper{
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .stepItem{
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 10px;
    border-radius: 14px;
    border: 1px solid rgba(210,218,235,.9);
    background: rgba(255, 255, 255, 0.9);
    cursor: pointer;
    transition: all .18s ease;
    text-align: left;
  }
  .stepItem:hover{ transform: translateY(-1px); box-shadow: 0 10px 20px rgba(30,55,90,.08); }

  .stepActive{
    background: rgba(80,125,255,.12);
    border-color: rgba(55,110,255,.35);
  }

  .stepDone{
    background: rgba(0,0,0,.03);
  }

  .stepDot{
    width: 26px;
    height: 26px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    font-weight: 900;
    font-size: 12px;
    border: 1px solid rgba(210,218,235,.9);
    background: rgba(255,255,255,.95);
    color: #2d4be8;
    flex: 0 0 auto;
  }

  .stepText{
    font-weight: 900;
    font-size: 12.5px;
    color: #263455;
  }
`;

