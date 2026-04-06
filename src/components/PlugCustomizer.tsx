// src/components/PlugCustomizer.tsx
"use client";

import React, { useMemo, useRef, useState } from "react";
import plugTypes from "../data/plugTypes";
import patterns from "../data/patterns";
import Plug3D, { PatternTransform, type PlugRenderFn, type RenderViewName } from "./Plug3D";
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
  view: "front" | "angle";
}

export type LogoTransform = {
  x: number;
  y: number;
  scale: number;
  rot: number;
};

// ✅ เพิ่ม Type สำหรับเก็บข้อมูล 3 โลโก้
export type LogoItem = {
  id: string;
  url: string;
  transform: LogoTransform;
};

type StepId = "model" | "color" | "pattern" | "logo" | "view";

/* =========================
   Defaults / Helpers
========================= */

const STEPS: { id: StepId; title: string; sub: string }[] = [
  { id: "model", title: "1) เลือกรุ่น", sub: "เลือกรุ่นปลั๊กที่ต้องการ" },
  { id: "color", title: "2) เลือกสี", sub: "ปรับสีฝาบน/ฝาล่าง" },
  { id: "pattern", title: "3) เลือกลาย", sub: "เลือกลวดลาย + เลื่อน/ซูม/หมุน" },
  { id: "logo", title: "4) ใส่โลโก้", sub: "อัปโหลด 3 ตำแหน่ง + ปรับแต่ง" }, // อัปเดตข้อความ
  { id: "view", title: "5) มุมมอง", sub: "เลือกมุมมองสำหรับโชว์/ดาวน์โหลด" },
];

const DEFAULT_CUSTOMIZATION: CustomizationState = {
  topColor: "#ffffff",
  bottomColor: "#eaeaea",
  switchColor: "#ffffff",
  patternUrl: "",
  view: "angle",
};

const DEFAULT_LOGO_TRANSFORM: LogoTransform = {
  x: 0,
  y: 0,
  scale: 0.25,
  rot: 0,
};

// ✅ ค่าเริ่มต้นของโลโก้ทั้ง 3 ช่อง
const DEFAULT_LOGOS: LogoItem[] = [
  { id: "logo-1", url: "", transform: { ...DEFAULT_LOGO_TRANSFORM } },
  { id: "logo-2", url: "", transform: { ...DEFAULT_LOGO_TRANSFORM } },
  { id: "logo-3", url: "", transform: { ...DEFAULT_LOGO_TRANSFORM } },
];

const DEFAULT_PATTERN_TRANSFORM: PatternTransform = {
  x: 0.5,
  y: 0.5,
  zoom: 1,
};

type ColorOption = { label: string; value: string };

type ColorOptionsByPart = {
  top: ColorOption[];
  bottom: ColorOption[];
  switch?: ColorOption[];
};

const COMMON_COLORS: ColorOption[] = [
  { label: "ขาว", value: "#ffffff" },
  { label: "ดำ", value: "#111111" },
  { label: "เทาอ่อน", value: "#d9d9d9" },
  { label: "เทาเข้ม", value: "#7a7a7a" },
  { label: "ครีม", value: "#f3ead8" },
  { label: "เบจ", value: "#d6c2a1" },
  { label: "น้ำเงิน", value: "#1d4ed8" },
  { label: "กรม", value: "#1e293b" },
];

const TYPE4_COLORS: ColorOption[] = [
  { label: "ขาว", value: "#ffffff" },
  { label: "ฟ้าพาสเทล", value: "#c9ebfe" },
  { label: "ชมพูพลาสเทล", value: "#ffc2e1" },
  { label: "เหลืองพาสเทล", value: "#fffdc5" },
  { label: "ม่วงพลาสเทล", value: "#dca9ff" },
  { label: "เขียวพาสเทล", value: "#d7fbe5" },
];

const COLOR_OPTIONS_BY_TYPE: Record<string, ColorOptionsByPart> = {
  "TYPE-1": {
    top: [
      { label: "ขาว", value: "#ffffff" },
      { label: "ดำ", value: "#111111" },
      { label: "เทาอ่อน", value: "#d9d9d9" },
      { label: "กรม", value: "#1e293b" },
      { label: "เบจ", value: "#d6c2a1" },
    ],
    bottom: [
      { label: "ขาว", value: "#ffffff" },
      { label: "ดำ", value: "#111111" },
      { label: "ส้ม", value: "#ec3b27" },
      { label: "แดง", value: "#ff000b" },
      { label: "กรมท่า", value: "#1e266a" },
      { label: "ฟ้าพาสเทล", value: "#59c5c7" },
      { label: "เขียวพาสเทล", value: "#62c2a6" },
      { label: "เหลือง", value: "#ffc813" },
      { label: "ชมพู", value: "#f37c8f" },
      { label: "ม่วงพาสเทล", value: "#9363a1" },
    ],
  },

  "TYPE-2": {
    top: [
      { label: "ขาว", value: "#ffffff" },
      { label: "ดำ", value: "#111111" },
      { label: "ครีม", value: "#f3ead8" },
      { label: "เบจ", value: "#d6c2a1" },
      { label: "น้ำเงิน", value: "#1d4ed8" },
    ],
    bottom: [
      { label: "ขาว", value: "#ffffff" },
      { label: "ดำ", value: "#111111" },
      { label: "ส้ม", value: "#ec3b27" },
      { label: "แดง", value: "#ff000b" },
      { label: "กรมท่า", value: "#1e266a" },
      { label: "ฟ้าพาสเทล", value: "#59c5c7" },
      { label: "เขียวพาสเทล", value: "#62c2a6" },
      { label: "เหลือง", value: "#ffc813" },
      { label: "ชมพู", value: "#f37c8f" },
      { label: "ม่วงพาสเทล", value: "#9363a1" },
    ],
    switch: [
      { label: "ขาว", value: "#ffffff" },
      { label: "กรมท่า", value: "#1e266a" },
      { label: "ฟ้าพาสเทล", value: "#59c5c7" },
      { label: "เขียวพาสเทล", value: "#62c2a6" },
      { label: "เหลือง", value: "#ffc813" },
    ],
  },

  "TYPE-3": {
    top: [
      { label: "ขาว", value: "#ffffff" },
      { label: "ดำ", value: "#111111" },
      { label: "เทาเข้ม", value: "#7a7a7a" },
      { label: "กรม", value: "#1e293b" },
    ],
    bottom: [
      { label: "ขาว", value: "#ffffff" },
      { label: "ดำ", value: "#111111" },
      { label: "ส้ม", value: "#ec3b27" },
      { label: "แดง", value: "#ff000b" },
      { label: "กรมท่า", value: "#1e266a" },
      { label: "ฟ้าพาสเทล", value: "#59c5c7" },
      { label: "เขียวพาสเทล", value: "#62c2a6" },
      { label: "เหลือง", value: "#ffc813" },
      { label: "ชมพู", value: "#f37c8f" },
      { label: "ม่วงพาสเทล", value: "#9363a1" },
    ],
  },

  "TYPE-4": {
    top: TYPE4_COLORS,
    bottom: TYPE4_COLORS,
  },
};

function getColorOptionsByType(typeId: string): ColorOptionsByPart {
  return (
    COLOR_OPTIONS_BY_TYPE[typeId] ?? {
      top: COMMON_COLORS,
      bottom: COMMON_COLORS,
      switch: COMMON_COLORS,
    }
  );
}

const A4_VIEWS: { key: RenderViewName; label: string }[] = [
  { key: "front", label: "ด้านหน้า" },
  { key: "angle", label: "มุมเอียง" },
  { key: "left", label: "ด้านซ้าย" },
  { key: "right", label: "ด้านขวา" },
  { key: "back", label: "ด้านหลัง" },
  { key: "top", label: "ด้านบน" },
];

function normalizeHex(hex?: string) {
  if (!hex) return hex;
  const h = hex.trim();
  if (!h.startsWith("#")) return h;
  return h.length >= 7 ? h.slice(0, 7).toLowerCase() : h.toLowerCase();
}

function getColorLabel(color: string, options: { label: string; value: string }[]) {
  const normalized = normalizeHex(color) ?? "";
  const found = options.find((o) => (normalizeHex(o.value) ?? "") === normalized);
  return found?.label ?? color;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("โหลดภาพไม่สำเร็จ"));
    img.src = src;
  });
}

function cropTransparentBounds(img: HTMLImageElement, alphaThreshold = 8) {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { canvas, x: 0, y: 0, width: canvas.width, height: canvas.height };
  }

  ctx.drawImage(img, 0, 0);
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] > alphaThreshold) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0 || maxY < 0) {
    return { canvas, x: 0, y: 0, width, height };
  }

  const pad = 20;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);

  return {
    canvas,
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
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

  // ✅ State สำหรับจัดการ 3 โลโก้
  const [logos, setLogos] = useState<LogoItem[]>(DEFAULT_LOGOS);
  const [activeLogoId, setActiveLogoId] = useState<string>("logo-1");
  const activeLogo = logos.find((l) => l.id === activeLogoId) || logos[0];

  const [patternTransform, setPatternTransform] = useState<PatternTransform>(DEFAULT_PATTERN_TRANSFORM);
  const [patternRotation, setPatternRotation] = useState<number>(0);

  const [uploadedPatterns, setUploadedPatterns] = useState<string[]>([]);

  const renderRef = useRef<PlugRenderFn | null>(null);

  const plugConfig = useMemo(
    () => getPlugConfig(selectedPlugId, { modelPath: plug.modelPath }),
    [selectedPlugId, plug.modelPath]
  );

  const currentColorOptions = useMemo(
    () => getColorOptionsByType(selectedPlugId),
    [selectedPlugId]
  );

  const safeColors = useMemo(() => {
    const top = ensureAllowedColor(customization.topColor, currentColorOptions.top);
    const bottom =
      selectedPlugId === "TYPE-4"
        ? top
        : ensureAllowedColor(customization.bottomColor, currentColorOptions.bottom);

    const out: Partial<Record<ColorKey, string>> = {
      top,
      bottom,
    };

    if (selectedPlugId !== "TYPE-1" && selectedPlugId !== "TYPE-3" && selectedPlugId !== "TYPE-4") {
      out.switch = ensureAllowedColor(
        customization.switchColor,
        currentColorOptions.switch ?? currentColorOptions.top
      );
    }

    return out;
  }, [
    selectedPlugId,
    customization.topColor,
    customization.bottomColor,
    customization.switchColor,
    currentColorOptions,
  ]);

  // ✅ เช็คว่ามีโลโก้อย่างน้อย 1 อันที่อัปโหลดไว้หรือไม่
  const hasLogo = logos.some((l) => l.url !== "");
  const hasPattern = !!customization.patternUrl && customization.patternUrl.trim() !== "";
  const currentStepIdx = stepIndex(step);

  function patchCustomization(patch: Partial<CustomizationState>) {
    setCustomization((s) => {
      const next = { ...s, ...patch };

      if (selectedPlugId === "TYPE-4") {
        const singleColor = patch.topColor ?? next.topColor ?? s.topColor;
        next.topColor = singleColor;
        next.bottomColor = singleColor;
      }

      return next;
    });
  }

  // ✅ รีเซ็ตโลโก้ทั้งหมด
  function resetLogo() {
    setLogos(DEFAULT_LOGOS);
    setDragLogoMode(false);
  }

  function resetPattern() {
    patchCustomization({ patternUrl: "" });
    setPatternTransform(DEFAULT_PATTERN_TRANSFORM);
    setPatternRotation(0);
    setDragPatternMode(false);
  }

  function resetAll() {
    const baseColor = currentColorOptions.top[0]?.value ?? "#ffffff";

    patchCustomization({
      patternUrl: "",
      topColor: baseColor,
      bottomColor: selectedPlugId === "TYPE-4" ? baseColor : "#eaeaea",
      switchColor: (currentColorOptions.switch ?? currentColorOptions.top)[0]?.value ?? "#ffffff",
    });

    setLogos(DEFAULT_LOGOS);
    setPatternTransform(DEFAULT_PATTERN_TRANSFORM);
    setPatternRotation(0);
    setDragLogoMode(false);
    setDragPatternMode(false);
  }

  // ✅ จัดการเมื่อเลือกไฟล์โลโก้
  function handleLogoSelect(id: string, url: string) {
    setLogos((prev) => prev.map((l) => (l.id === id ? { ...l, url } : l)));
    setActiveLogoId(id);
    setStep("logo");
  }

  // ✅ จัดการเมื่อลบโลโก้
  function handleLogoRemove(id: string) {
    setLogos((prev) => prev.map((l) => (l.id === id ? { ...l, url: "" } : l)));
  }

  // ✅ จัดการเปลี่ยนแปลง Scale, Rotation, X, Y ของโลโก้ตัวที่กำลังเลือก
  function handleLogoTransformChange(id: string, newTransform: LogoTransform) {
    setLogos((prev) => prev.map((l) => (l.id === id ? { ...l, transform: newTransform } : l)));
  }

  async function downloadA4Sheet() {
    const render = renderRef.current;
    if (!render) return;

    const captures = await Promise.all(
      A4_VIEWS.map(async (item) => ({
        label: item.label,
        src: await render({
          transparent: true,
          view: item.key,
          download: false,
          filename: `plug-${selectedPlugId}-${item.key}.png`,
        }),
      }))
    );

    const validCaptures = captures.filter((item): item is { label: string; src: string } => typeof item.src === "string" && item.src.length > 0);
    if (!validCaptures.length) return;

    const images = await Promise.all(validCaptures.map((item) => loadImage(item.src)));
    const croppedImages = images.map((img) => cropTransparentBounds(img));

    const canvas = document.createElement("canvas");
    canvas.width = 2480;
    canvas.height = 3508;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#111827";
    ctx.font = "bold 76px sans-serif";
    ctx.fillText("Plug Mockup A4 Preview", 140, 150);

    ctx.fillStyle = "#4b5563";
    ctx.font = "34px sans-serif";
    ctx.fillText(`รุ่น: ${plug.name ?? selectedPlugId}`, 140, 220);
    ctx.fillText(
      selectedPlugId === "TYPE-4"
        ? `สีตัวปลั๊ก: ${getColorLabel(
          safeColors.top ?? customization.topColor,
          currentColorOptions.top
        )}`
        : `สีบน: ${getColorLabel(
          safeColors.top ?? customization.topColor,
          currentColorOptions.top
        )}   สีล่าง: ${getColorLabel(
          safeColors.bottom ?? customization.bottomColor,
          currentColorOptions.bottom
        )}`,
      140,
      270
    );
    ctx.fillText(`ลาย: ${hasPattern ? "มีลาย" : "ไม่มีลาย"}   โลโก้: ${hasLogo ? "มีโลโก้" : "ไม่มีโลโก้"}`, 140, 320);

    const pageW = canvas.width;
    const marginX = 120;
    const topY = 390;
    const gapX = 60;
    const gapY = 54;
    const cols = 2;
    const cardW = (pageW - marginX * 2 - gapX) / cols;
    const cardH = 900;
    const globalMaxW = Math.max(...croppedImages.map((c) => c.width), 1);
    const globalMaxH = Math.max(...croppedImages.map((c) => c.height), 1);

    validCaptures.forEach((item, idx) => {
      const cropped = croppedImages[idx];
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x = marginX + col * (cardW + gapX);
      const y = topY + row * (cardH + gapY);

      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#d1d5db";
      ctx.lineWidth = 3;
      ctx.fillRect(x, y, cardW, cardH);
      ctx.strokeRect(x, y, cardW, cardH);

      ctx.fillStyle = "#111827";
      ctx.font = "bold 36px sans-serif";
      ctx.fillText(item.label, x + 28, y + 56);

      const innerPadX = 18;
      const innerTop = 82;
      const innerW = cardW - innerPadX * 2;
      const innerH = cardH - innerTop - 18;

      const sharedScale = Math.min((innerW * 0.88) / globalMaxW, (innerH * 0.88) / globalMaxH);
      const drawW = cropped.width * sharedScale;
      const drawH = cropped.height * sharedScale;
      const drawX = x + (cardW - drawW) / 2;
      const drawY = y + innerTop + (innerH - drawH) / 2;

      ctx.drawImage(
        cropped.canvas,
        cropped.x,
        cropped.y,
        cropped.width,
        cropped.height,
        drawX,
        drawY,
        drawW,
        drawH
      );
    });

    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `plug-${selectedPlugId}-A4-preview.png`;
    link.click();
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
    const nextOptions = getColorOptionsByType(id);

    setSelectedPlugId(id);

    setCustomization((s) => {
      const nextTop = ensureAllowedColor(s.topColor, nextOptions.top);

      return {
        ...s,
        patternUrl: "",
        topColor: nextTop,
        bottomColor:
          id === "TYPE-4"
            ? nextTop
            : ensureAllowedColor(s.bottomColor, nextOptions.bottom),
        switchColor: ensureAllowedColor(
          s.switchColor,
          nextOptions.switch ?? nextOptions.top
        ),
      };
    });

    setLogos(DEFAULT_LOGOS);
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
            {/* ✅ ถ้าเป็น TYPE-4 ให้เปลี่ยนชื่อ Label เป็น "สีตัวปลั๊ก" */}
            <ColorPicker
              label={selectedPlugId === "TYPE-4" ? "สีตัวปลั๊ก" : "ฝาบน"}
              initialColor={customization.topColor}
              options={currentColorOptions.top}
              onColorChange={(c) => patchCustomization({ topColor: c })}
            />

            {/* ✅ ซ่อนฝาล่าง ถ้าเป็น TYPE-4 */}
            {selectedPlugId !== "TYPE-4" && (
              <>
                <div style={{ height: 10 }} />
                <ColorPicker
                  label="ฝาล่าง"
                  initialColor={customization.bottomColor}
                  options={currentColorOptions.bottom}
                  onColorChange={(c) => patchCustomization({ bottomColor: c })}
                />
              </>
            )}

            {/* ✅ ซ่อนสวิตช์ ถ้าเป็น TYPE-1, 3, 4 */}
            {selectedPlugId !== "TYPE-1" && selectedPlugId !== "TYPE-3" && selectedPlugId !== "TYPE-4" && (
              <>
                <div style={{ height: 10 }} />
                <ColorPicker
                  label="สวิตช์"
                  initialColor={customization.switchColor}
                  options={currentColorOptions.switch ?? currentColorOptions.top}
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

    // ✅ UI ฝั่งโลโก้แบบ 3 อัน
    if (step === "logo") {
      return (
        <div>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <div className="label">โลโก้ (อัปโหลดได้สูงสุด 3 ตำแหน่ง)</div>
              <div className="hint">คลิกที่กรอบเพื่อแก้ไขโลโก้นั้นๆ</div>
            </div>
            <button type="button" className="btn btnGhost" disabled={!hasLogo} onClick={resetLogo}>
              ล้างโลโก้ทั้งหมด
            </button>
          </div>

          <div className="divider" />

          {/* กล่องอัปโหลด 3 ช่อง */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {logos.map((logo, index) => {
              const isActive = activeLogoId === logo.id;
              return (
                <div
                  key={logo.id}
                  onClick={() => setActiveLogoId(logo.id)}
                  style={{
                    border: isActive ? "2px solid #3b82f6" : "2px solid transparent",
                    padding: "10px",
                    borderRadius: "8px",
                    background: isActive ? "rgba(59,130,246,0.05)" : "transparent",
                    transition: "all 0.2s",
                    cursor: "pointer"
                  }}
                >
                  <LogoUploader
                    id={logo.id}
                    label={`โลโก้ ${index + 1}`}
                    currentUrl={logo.url}
                    onSelect={handleLogoSelect}
                    onRemove={handleLogoRemove}
                  />
                </div>
              );
            })}
          </div>

          <div className="divider" />

          <label className="row" style={{ gap: 8 }}>
            <input
              type="checkbox"
              checked={dragLogoMode}
              disabled={!activeLogo.url}
              onChange={(e) => setDragLogoMode(e.target.checked)}
            />
            <span className="label" style={{ opacity: activeLogo.url ? 1 : 0.55 }}>
              โหมดลากโลโก้ (สำหรับ {`โลโก้ ${logos.findIndex((l) => l.id === activeLogoId) + 1}`})
            </span>
          </label>

          <div style={{ marginTop: 10, opacity: activeLogo.url ? 1 : 0.5 }}>
            <Slider
              label={`ขนาด: ${activeLogo.transform.scale.toFixed(2)}`}
              min={0.05}
              max={0.6}
              step={0.01}
              value={activeLogo.transform.scale}
              disabled={!activeLogo.url}
              onChange={(v) => handleLogoTransformChange(activeLogo.id, { ...activeLogo.transform, scale: v })}
            />
            <div style={{ height: 10 }} />
            <Slider
              label={`X: ${activeLogo.transform.x.toFixed(2)}`}
              min={-0.45}
              max={0.45}
              step={0.01}
              value={activeLogo.transform.x}
              disabled={!activeLogo.url}
              onChange={(v) => handleLogoTransformChange(activeLogo.id, { ...activeLogo.transform, x: v })}
            />
            <div style={{ height: 10 }} />
            <Slider
              label={`Y: ${activeLogo.transform.y.toFixed(2)}`}
              min={-0.45}
              max={0.45}
              step={0.01}
              value={activeLogo.transform.y}
              disabled={!activeLogo.url}
              onChange={(v) => handleLogoTransformChange(activeLogo.id, { ...activeLogo.transform, y: v })}
            />
            <div style={{ height: 10 }} />
            <Slider
              label={`หมุน: ${(activeLogo.transform.rot * (180 / Math.PI)).toFixed(0)}°`}
              min={-Math.PI}
              max={Math.PI}
              step={0.01}
              value={activeLogo.transform.rot}
              disabled={!activeLogo.url}
              onChange={(v) => handleLogoTransformChange(activeLogo.id, { ...activeLogo.transform, rot: v })}
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
          <LayoutPreview
            view={customization.view}
            onSetView={(v) => patchCustomization({ view: v })}
            onDownload={() => {
              void renderRef.current?.({
                transparent: true,
                filename: `plug-${selectedPlugId}-${customization.view}.png`,
                view: customization.view,
              });
            }}
            onDownloadA4={() => {
              void downloadA4Sheet();
            }}
          />        </div>

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
                  logos={logos}
                  activeLogoId={activeLogoId}
                  onLogoTransformChange={handleLogoTransformChange}
                  patternUrl={customization.patternUrl}
                  patternTransform={patternTransform}
                  onPatternTransformChange={setPatternTransform}
                  patternRotation={patternRotation}
                  colors={safeColors}
                  dragLogoMode={dragLogoMode && activeLogo.url !== ""}
                  dragPatternMode={dragPatternMode && hasPattern}
                  view={customization.view}
                  onRenderReady={(render) => {
                    renderRef.current = render;
                  }}
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
                  {/* ทางลัดโลโก้ จะเปลี่ยนเป็นปุ่มไปที่หน้าแก้ไขโลโก้แทนเพื่อลดความสับสน */}
                  <button type="button" className="btn btnGhost" onClick={() => setStep("logo")}>
                    ⚙️ ปรับแต่งโลโก้ (3 จุด)
                  </button>
                  <button type="button" className="btn btnGhost" onClick={resetLogo} disabled={!hasLogo}>
                    ล้างโลโก้ทั้งหมด
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

            <div className="body config-layout">
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

              <div className="config-divider" />

              <div className="config-content">
                <div style={{ flex: 1, overflowY: "auto", paddingRight: 6 }}>
                  {renderStepContent()}
                </div>

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

  .pc-grid{
    max-width: 1440px; 
    margin: 0 auto;
    display: grid;
    gap: 16px;
    grid-template-columns: 1fr 1.4fr;
    align-items: start;
  }

  :root{ --mockH: 480px; }
  @media (max-height: 820px){ :root{ --mockH: 440px; } }
  @media (max-height: 740px){ :root{ --mockH: 400px; } }

  .config-layout {
    display: grid;
    grid-template-columns: 180px 1px 1fr;
    gap: 16px;
    min-height: var(--mockH);
  }

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

  .patternScroll {
    overflow-y: auto;
    overflow-x: hidden;
    padding-right: 6px;
  }

  .pattern-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(70px, 1fr)); 
    gap: 10px;
    align-items: start;
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