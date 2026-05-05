// src/components/PlugCustomizer.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import plugTypes from "../data/plugTypes";
import { getPatternGroupsByType } from "../data/patterns";
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
  view: "front" | "angle" | "top";
}

export type LogoTransform = {
  x: number;
  y: number;
  scale: number;
  rot: number;
};

export type LogoItem = {
  id: string;
  url: string;
  transform: LogoTransform;
};

type StepId = "model" | "color" | "pattern" | "logo" | "view";
type OrbitNudgeDirection = "left" | "right" | "up" | "down";

/* =========================
   Defaults / Helpers
========================= */

const STEPS: { id: StepId; title: string; sub: string }[] = [
  { id: "model", title: "1) เลือกรุ่น", sub: "เลือกรุ่นปลั๊กที่ต้องการ" },
  { id: "color", title: "2) เลือกสี", sub: "ปรับสีฝาบน/ฝาล่าง" },
  { id: "pattern", title: "3) เลือกลาย", sub: "เลือกลวดลาย + เลื่อน/ซูม/หมุน" },
  { id: "logo", title: "4) ใส่โลโก้", sub: "อัปโหลด 3 ตำแหน่ง + ปรับแต่ง" },
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
      { label: "กรมท่า", value: "#1e266a" },
      { label: "ฟ้าพาสเทล", value: "#59c5c7" },
      { label: "เขียวพาสเทล", value: "#62c2a6" },
      { label: "เหลือง", value: "#ffc813" },
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

  "TYPE-5": {
    top: [
      { label: "ขาว", value: "#ffffff" },
      { label: "กรมท่า", value: "#1e266a" },
      { label: "ฟ้าพาสเทล", value: "#59c5c7" },
      { label: "เขียวพาสเทล", value: "#62c2a6" },
      { label: "เหลือง", value: "#ffc813" },
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


type ProductionMaskResult = {
  maskCanvas: HTMLCanvasElement;
  bbox: { x: number; y: number; width: number; height: number };
};

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function cropCanvasAlphaBounds(source: HTMLCanvasElement, alphaThreshold = 8, pad = 0) {
  const width = source.width;
  const height = source.height;
  const ctx = source.getContext("2d");
  if (!ctx) {
    return { canvas: source, x: 0, y: 0, width, height };
  }

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
    return { canvas: source, x: 0, y: 0, width, height };
  }

  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);

  const out = document.createElement("canvas");
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  const outCtx = out.getContext("2d");
  if (!outCtx) {
    return { canvas: source, x: 0, y: 0, width, height };
  }
  outCtx.drawImage(source, minX, minY, out.width, out.height, 0, 0, out.width, out.height);

  return { canvas: out, x: minX, y: minY, width: out.width, height: out.height };
}

function computeCanvasPrincipalAxisAngle(source: HTMLCanvasElement, alphaThreshold = 8) {
  const width = source.width;
  const height = source.height;
  const ctx = source.getContext("2d");
  if (!ctx) return null;

  const data = ctx.getImageData(0, 0, width, height).data;
  let count = 0;
  let sumX = 0;
  let sumY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] <= alphaThreshold) continue;
      count += 1;
      sumX += x;
      sumY += y;
    }
  }

  if (!count) return null;

  const meanX = sumX / count;
  const meanY = sumY / count;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] <= alphaThreshold) continue;
      const dx = x - meanX;
      const dy = y - meanY;
      sxx += dx * dx;
      syy += dy * dy;
      sxy += dx * dy;
    }
  }

  if (sxx === 0 && syy === 0) return null;
  return 0.5 * Math.atan2(2 * sxy, sxx - syy);
}

function rotateCanvasByAngle(source: HTMLCanvasElement, angleRad: number) {
  const width = source.width;
  const height = source.height;
  const cos = Math.abs(Math.cos(angleRad));
  const sin = Math.abs(Math.sin(angleRad));
  const outW = Math.max(1, Math.ceil(width * cos + height * sin));
  const outH = Math.max(1, Math.ceil(width * sin + height * cos));

  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const ctx = out.getContext("2d");
  if (!ctx) return source;

  ctx.clearRect(0, 0, outW, outH);
  ctx.translate(outW / 2, outH / 2);
  ctx.rotate(angleRad);
  ctx.drawImage(source, -width / 2, -height / 2);
  return out;
}

function straightenType2ProductionCanvas(source: HTMLCanvasElement) {
  const angle = computeCanvasPrincipalAxisAngle(source);
  if (angle == null) return source;

  let rotateBy = Math.PI / 2 - angle;
  while (rotateBy > Math.PI / 2) rotateBy -= Math.PI;
  while (rotateBy < -Math.PI / 2) rotateBy += Math.PI;

  const rotated = rotateCanvasByAngle(source, rotateBy);
  return cropCanvasAlphaBounds(rotated, 8, 0).canvas;
}

function buildManualType5Mask(img: HTMLImageElement): ProductionMaskResult | null {
  const cropped = cropTransparentBounds(img, 8);
  const width = cropped.width;
  const height = cropped.height;
  if (!width || !height) return null;

  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = width;
  maskCanvas.height = height;
  const ctx = maskCanvas.getContext("2d");
  if (!ctx) return null;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";

  // TYPE-5 ใช้ manual mask คงที่ เพื่อกันรอยแหว่งจากสวิตช์/ปุ่มด้านข้าง
  const outerX = Math.round(width * 0.03);
  const outerY = Math.round(height * 0.025);
  const outerW = Math.round(width * 0.94);
  const outerH = Math.round(height * 0.95);
  const radius = Math.round(Math.min(outerW * 0.16, outerH * 0.08));

  drawRoundedRectPath(ctx, outerX, outerY, outerW, outerH, radius);
  ctx.fill();

  return {
    maskCanvas,
    bbox: {
      x: outerX,
      y: outerY,
      width: outerW,
      height: outerH,
    },
  };
}

function buildManualType2Mask(img: HTMLImageElement): ProductionMaskResult | null {
  const cropped = cropTransparentBounds(img, 8);
  const width = cropped.width;
  const height = cropped.height;
  if (!width || !height) return null;

  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = width;
  maskCanvas.height = height;
  const ctx = maskCanvas.getContext("2d");
  if (!ctx) return null;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";

  // TYPE-2 ใช้ manual template แบบแคบและสูง
  // เพื่อให้ framing ของลายใกล้กับหน้าปลั๊กใน mockup มากขึ้น
  const outerW = Math.round(width * 0.36);
  const outerH = Math.round(height * 0.965);
  const outerX = Math.round((width - outerW) / 2);
  const outerY = Math.round(height * 0.018);
  const radius = Math.round(Math.min(outerW * 0.22, outerH * 0.055));

  drawRoundedRectPath(ctx, outerX, outerY, outerW, outerH, radius);
  ctx.fill();

  return {
    maskCanvas,
    bbox: {
      x: outerX,
      y: outerY,
      width: outerW,
      height: outerH,
    },
  };
}

function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p)));
  return sorted[idx] ?? sorted[0] ?? 0;
}

function fillType5SwitchNotch(maskInfo: ProductionMaskResult): ProductionMaskResult {
  const { maskCanvas } = maskInfo;
  const width = maskCanvas.width;
  const height = maskCanvas.height;
  const ctx = maskCanvas.getContext("2d");
  if (!ctx) return maskInfo;

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  const rowLeft = new Array<number>(height).fill(-1);
  const rowRight = new Array<number>(height).fill(-1);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = data[(y * width + x) * 4 + 3];
      if (a <= 0) continue;
      if (rowLeft[y] < 0) rowLeft[y] = x;
      rowRight[y] = x;
    }
  }

  const bodyStart = Math.floor(height * 0.18);
  const bodyEnd = Math.ceil(height * 0.90);
  const bodyLefts = rowLeft.slice(bodyStart, bodyEnd + 1).filter(v => v >= 0);
  if (!bodyLefts.length) return maskInfo;

  // ใช้ค่า low percentile ของด้านซ้ายเป็นเส้นฐานของขอบหลัก
  const baseLeft = Math.round(percentile(bodyLefts, 0.18));
  const fixedLeft = [...rowLeft];

  // เก็บเฉพาะช่วงเว้าที่ลึกกว่าปกติ แล้วเติมกลับให้เต็ม
  for (let y = bodyStart; y <= bodyEnd; y++) {
    if (rowLeft[y] < 0 || rowRight[y] < 0) continue;

    const winVals: number[] = [];
    for (let yy = Math.max(bodyStart, y - 18); yy <= Math.min(bodyEnd, y + 18); yy++) {
      if (rowLeft[yy] >= 0) winVals.push(rowLeft[yy]);
    }
    const localBase = winVals.length ? Math.round(percentile(winVals, 0.2)) : baseLeft;
    const targetLeft = Math.min(baseLeft, localBase);

    // ถ้าแถวนี้เว้าเข้าไปด้านขวาชัดเจน ให้ดันกลับมาที่เส้นฐาน
    if (rowLeft[y] - targetLeft >= 4) {
      fixedLeft[y] = targetLeft;
    }
  }

  const outCanvas = document.createElement("canvas");
  outCanvas.width = width;
  outCanvas.height = height;
  const outCtx = outCanvas.getContext("2d");
  if (!outCtx) return maskInfo;
  const out = outCtx.createImageData(width, height);

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let hasPixel = false;

  for (let y = 0; y < height; y++) {
    if (fixedLeft[y] < 0 || rowRight[y] < 0) continue;
    const left = Math.max(0, Math.min(width - 1, fixedLeft[y]));
    const right = Math.max(0, Math.min(width - 1, rowRight[y]));
    for (let x = left; x <= right; x++) {
      const i = (y * width + x) * 4;
      out.data[i] = 255;
      out.data[i + 1] = 255;
      out.data[i + 2] = 255;
      out.data[i + 3] = 255;
      hasPixel = true;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (!hasPixel) return maskInfo;

  outCtx.putImageData(out, 0, 0);
  return {
    maskCanvas: outCanvas,
    bbox: {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    },
  };
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function normalizeProductionMaskEdges(
  maskInfo: ProductionMaskResult,
  options?: {
    radius?: number;
    threshold?: number;
    maxRun?: number;
    fixLeft?: boolean;
    fixRight?: boolean;
  }
): ProductionMaskResult {
  const { radius = 14, threshold = 6, maxRun = 36, fixLeft = true, fixRight = true } = options ?? {};
  const { maskCanvas } = maskInfo;
  const width = maskCanvas.width;
  const height = maskCanvas.height;
  const ctx = maskCanvas.getContext("2d");
  if (!ctx) return maskInfo;

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  const rowLeft = new Array<number>(height).fill(-1);
  const rowRight = new Array<number>(height).fill(-1);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = data[(y * width + x) * 4 + 3];
      if (a <= 0) continue;
      if (rowLeft[y] < 0) rowLeft[y] = x;
      rowRight[y] = x;
    }
  }

  const collect = (arr: number[], center: number) => {
    const out: number[] = [];
    for (let yy = Math.max(0, center - radius); yy <= Math.min(height - 1, center + radius); yy++) {
      if (arr[yy] >= 0) out.push(arr[yy]);
    }
    return out;
  };

  const targetLeft = [...rowLeft];
  const targetRight = [...rowRight];

  for (let y = 0; y < height; y++) {
    if (rowLeft[y] < 0 || rowRight[y] < 0) continue;
    const leftNeighbors = collect(rowLeft, y);
    const rightNeighbors = collect(rowRight, y);
    if (fixLeft && leftNeighbors.length) targetLeft[y] = Math.round(median(leftNeighbors));
    if (fixRight && rightNeighbors.length) targetRight[y] = Math.round(median(rightNeighbors));
  }

  const correctedLeft = [...rowLeft];
  const correctedRight = [...rowRight];

  const patchRuns = (side: 'left' | 'right') => {
    const current = side === 'left' ? rowLeft : rowRight;
    const target = side === 'left' ? targetLeft : targetRight;
    let y = 0;

    while (y < height) {
      if (current[y] < 0 || target[y] < 0) {
        y += 1;
        continue;
      }

      const diff = side === 'left' ? current[y] - target[y] : target[y] - current[y];
      if (diff <= threshold) {
        y += 1;
        continue;
      }

      const start = y;
      let end = y;
      while (end + 1 < height) {
        if (current[end + 1] < 0 || target[end + 1] < 0) break;
        const nextDiff = side === 'left' ? current[end + 1] - target[end + 1] : target[end + 1] - current[end + 1];
        if (nextDiff <= threshold) break;
        end += 1;
      }

      if (end - start + 1 <= maxRun) {
        for (let yy = start; yy <= end; yy++) {
          if (side === 'left') {
            correctedLeft[yy] = Math.min(current[yy], target[yy]);
          } else {
            correctedRight[yy] = Math.max(current[yy], target[yy]);
          }
        }
      }

      y = end + 1;
    }
  };

  if (fixLeft) patchRuns('left');
  if (fixRight) patchRuns('right');

  const outCanvas = document.createElement('canvas');
  outCanvas.width = width;
  outCanvas.height = height;
  const outCtx = outCanvas.getContext('2d');
  if (!outCtx) return maskInfo;
  const outImage = outCtx.createImageData(width, height);

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let hasPixels = false;

  for (let y = 0; y < height; y++) {
    if (correctedLeft[y] < 0 || correctedRight[y] < 0) continue;
    const left = Math.max(0, Math.min(width - 1, correctedLeft[y]));
    const right = Math.max(0, Math.min(width - 1, correctedRight[y]));
    for (let x = left; x <= right; x++) {
      const i = (y * width + x) * 4;
      outImage.data[i] = 255;
      outImage.data[i + 1] = 255;
      outImage.data[i + 2] = 255;
      outImage.data[i + 3] = 255;
      hasPixels = true;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (!hasPixels) return maskInfo;

  outCtx.putImageData(outImage, 0, 0);
  return {
    maskCanvas: outCanvas,
    bbox: {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    },
  };
}

function buildProductionEnvelopeMask(img: HTMLImageElement, alphaThreshold = 8): ProductionMaskResult | null {
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = img.naturalWidth || img.width;
  sourceCanvas.height = img.naturalHeight || img.height;

  const sourceCtx = sourceCanvas.getContext("2d");
  if (!sourceCtx) return null;

  sourceCtx.drawImage(img, 0, 0);
  const { width, height } = sourceCanvas;
  const imageData = sourceCtx.getImageData(0, 0, width, height);
  const rgba = imageData.data;

  const rowFill = new Uint8Array(width * height);
  const colFill = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    let minX = -1;
    let maxX = -1;
    for (let x = 0; x < width; x++) {
      const alpha = rgba[(y * width + x) * 4 + 3];
      if (alpha > alphaThreshold) {
        if (minX < 0) minX = x;
        maxX = x;
      }
    }
    if (minX >= 0 && maxX >= minX) {
      for (let x = minX; x <= maxX; x++) {
        rowFill[y * width + x] = 1;
      }
    }
  }

  for (let x = 0; x < width; x++) {
    let minY = -1;
    let maxY = -1;
    for (let y = 0; y < height; y++) {
      const alpha = rgba[(y * width + x) * 4 + 3];
      if (alpha > alphaThreshold) {
        if (minY < 0) minY = y;
        maxY = y;
      }
    }
    if (minY >= 0 && maxY >= minY) {
      for (let y = minY; y <= maxY; y++) {
        colFill[y * width + x] = 1;
      }
    }
  }

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = width;
  maskCanvas.height = height;
  const maskCtx = maskCanvas.getContext("2d");
  if (!maskCtx) return null;

  const maskImage = maskCtx.createImageData(width, height);
  let hasPixels = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const solid = rowFill[idx] && colFill[idx];
      if (!solid) continue;

      hasPixels = true;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;

      const di = idx * 4;
      maskImage.data[di] = 255;
      maskImage.data[di + 1] = 255;
      maskImage.data[di + 2] = 255;
      maskImage.data[di + 3] = 255;
    }
  }

  if (!hasPixels) return null;

  maskCtx.putImageData(maskImage, 0, 0);

  return {
    maskCanvas,
    bbox: {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    },
  };
}

function rotateCanvas180(source: HTMLCanvasElement) {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(Math.PI);
  ctx.drawImage(source, -source.width / 2, -source.height / 2);
  return canvas;
}

async function drawProductionPattern(args: {
  ctx: CanvasRenderingContext2D;
  patternSrc?: string;
  fillColor: string;
  x: number;
  y: number;
  width: number;
  height: number;
  transform: PatternTransform;
  rotation: number;
  offsetRotation?: number;
}) {
  const { ctx, patternSrc, fillColor, x, y, width, height, transform, rotation, offsetRotation = 0 } = args;

  ctx.save();
  ctx.fillStyle = fillColor;
  ctx.fillRect(x, y, width, height);
  ctx.restore();

  if (!patternSrc || !patternSrc.trim()) return;

  const img = await loadImage(patternSrc);
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;

  const zoom = Math.max(0.01, transform.zoom || 1);
  const coverScale = Math.max(width / iw, height / ih) / zoom;
  const rawOffsetX = (0.5 - transform.x) * width;
  const rawOffsetY = (0.5 - transform.y) * height;
  const cosOff = Math.cos(offsetRotation || 0);
  const sinOff = Math.sin(offsetRotation || 0);
  const offsetX = rawOffsetX * cosOff - rawOffsetY * sinOff;
  const offsetY = rawOffsetX * sinOff + rawOffsetY * cosOff;
  const repeat = ctx.createPattern(img, "repeat");
  if (!repeat) return;

  ctx.save();
  ctx.translate(x + width / 2 + offsetX, y + height / 2 + offsetY);
  ctx.rotate(rotation || 0);
  ctx.scale(coverScale, coverScale);
  ctx.translate(-iw / 2, -ih / 2);
  ctx.fillStyle = repeat;

  const spanW = Math.max(iw * 8, width / Math.max(coverScale, 0.001) + iw * 6);
  const spanH = Math.max(ih * 8, height / Math.max(coverScale, 0.001) + ih * 6);
  ctx.fillRect(-spanW, -spanH, spanW * 2, spanH * 2);
  ctx.restore();
}

async function drawProductionLogos(args: {
  ctx: CanvasRenderingContext2D;
  logos: LogoItem[];
  x: number;
  y: number;
  width: number;
  height: number;
  isFixedLogoType: boolean;
}) {
  const { ctx, logos, x, y, width, height, isFixedLogoType } = args;

  const visibleLogos = logos.filter((logo) => !!logo.url && logo.url.trim() !== "");
  for (const logo of visibleLogos) {
    const img = await loadImage(logo.url);
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) continue;

    const scale = Math.max(0.05, Number(logo.transform?.scale ?? 0.25));
    const baseSize = Math.min(width, height) * scale * 1.25;

    let drawW = baseSize;
    let drawH = baseSize;
    if (iw >= ih) {
      drawH = baseSize * (ih / iw);
    } else {
      drawW = baseSize * (iw / ih);
    }

    const px = Number(logo.transform?.x ?? 0);
    const py = Number(logo.transform?.y ?? 0);
    const rot = Number(logo.transform?.rot ?? 0);

    const centerX = x + width / 2 + px * width;
    const centerY = y + height / 2 + (isFixedLogoType ? py * height : -py * height);

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rot);
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
  }
}

function ensureAllowedColor(color: string, options: { label: string; value: string }[]) {
  const normalized = normalizeHex(color) ?? "";
  if (normalized.startsWith("#")) return normalized;
  return options[0]?.value ?? "#ffffff";
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

  const [logos, setLogos] = useState<LogoItem[]>(DEFAULT_LOGOS);
  const [activeLogoId, setActiveLogoId] = useState<string>("logo-1");
  const activeLogo = logos.find((l) => l.id === activeLogoId) || logos[0];

  const [patternTransform, setPatternTransform] = useState<PatternTransform>(DEFAULT_PATTERN_TRANSFORM);
  const [patternRotation, setPatternRotation] = useState<number>(0);

  const [uploadedPatterns, setUploadedPatterns] = useState<string[]>([]);
  const [orbitNudgeTick, setOrbitNudgeTick] = useState(0);
  const [orbitNudgeDirection, setOrbitNudgeDirection] = useState<OrbitNudgeDirection | null>(null);
  const [isMobileLayout, setIsMobileLayout] = useState(false);
  const [viewPreviewMap, setViewPreviewMap] = useState<Partial<Record<RenderViewName, string>>>({});
  const [viewPreviewLoading, setViewPreviewLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mq = window.matchMedia("(max-width: 768px)");
    const apply = () => setIsMobileLayout(mq.matches);

    apply();

    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }

    mq.addListener(apply);
    return () => mq.removeListener(apply);
  }, []);

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

  const hasLogo = logos.some((l) => l.url !== "");
  const hasPattern = !!customization.patternUrl && customization.patternUrl.trim() !== "";
  const currentStepIdx = stepIndex(step);

  const showQuickBottom = selectedPlugId !== "TYPE-4";
  const showQuickSwitch =
    selectedPlugId !== "TYPE-1" &&
    selectedPlugId !== "TYPE-3" &&
    selectedPlugId !== "TYPE-4";

  const quickColorCount = 1 + (showQuickBottom ? 1 : 0) + (showQuickSwitch ? 1 : 0);

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

  function handleLogoSelect(id: string, url: string) {
    setLogos((prev) => prev.map((l) => (l.id === id ? { ...l, url } : l)));
    setActiveLogoId(id);
    // ไม่เด้งไปขั้นตอนโลโก้อัตโนมัติ ให้ลูกค้ากดถัดไปเอง
  }

  function handleLogoRemove(id: string) {
    setLogos((prev) => prev.map((l) => (l.id === id ? { ...l, url: "" } : l)));
  }

  function handleLogoTransformChange(id: string, newTransform: LogoTransform) {
    setLogos((prev) => prev.map((l) => (l.id === id ? { ...l, transform: newTransform } : l)));
  }

  function renderQuickColorCard(args: {
    label: string;
    sub: string;
    value: string;
    fallback: string;
    onChange: (color: string) => void;
    onReset: () => void;
    title: string;
  }) {
    const hex = normalizeHex(args.value) ?? args.fallback;

    return (
      <div className="qa-colorCard">
        <div className="qa-colorTop">
          <div>
            <div className="qa-colorTitle">{args.label}</div>
            <div className="qa-colorSub">{args.sub}</div>
          </div>

          <span className="qa-colorBadge">{hex.toUpperCase()}</span>
        </div>

        <div className="qa-colorRow">
          <div className="qa-colorPickerGroup">
            <label className="qa-colorInputWrap" title={args.title}>
              <input
                type="color"
                className="qa-colorInput"
                value={hex}
                onChange={(e) => args.onChange(e.target.value)}
              />
              <span className="qa-colorPreview" style={{ background: hex }} />
            </label>

            <div className="qa-colorMeta">
              <span className="qa-colorMetaLabel">สีปัจจุบัน</span>
              <span className="qa-colorMetaValue">{hex.toUpperCase()}</span>
            </div>
          </div>

          <button type="button" className="btn btnGhost qa-smallBtn" onClick={args.onReset}>
            รีเซ็ต
          </button>
        </div>
      </div>
    );
  }

  async function downloadA4Sheet() {
    const render = renderRef.current;
    if (!render) return;

    const captures = await Promise.all(
      A4_VIEWS.map(async (item) => {
        const rawSrc = await render({
          transparent: true,
          view: item.key,
          download: false,
          filename: `plug-${selectedPlugId}-${item.key}.png`,
        });

        const finalSrc = rawSrc
          ? item.key === "top"
            ? await rotateImage180DataUrl(rawSrc)
            : rawSrc
          : null;

        return {
          label: item.label,
          src: finalSrc,
        };
      })
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

  async function rotateImage180DataUrl(src: string) {
    const img = await loadImage(src);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(Math.PI);
    ctx.drawImage(
      img,
      -(img.naturalWidth || img.width) / 2,
      -(img.naturalHeight || img.height) / 2,
      img.naturalWidth || img.width,
      img.naturalHeight || img.height
    );

    return canvas.toDataURL("image/png");
  }

  async function downloadViewImage(view: RenderViewName, filename?: string) {
    const render = renderRef.current;
    if (!render) return;

    const src = await render({
      transparent: true,
      view,
      download: false,
      filename: filename ?? `plug-${selectedPlugId}-${view}.png`,
    });

    if (!src) return;

    const finalSrc = view === "top" ? await rotateImage180DataUrl(src) : src;
    if (!finalSrc) return;

    const link = document.createElement("a");
    link.href = finalSrc;
    link.download = filename ?? `plug-${selectedPlugId}-${view}.png`;
    link.click();
  }

  async function buildInlinePreview(view: RenderViewName) {
    const render = renderRef.current;
    if (!render) return null;

    const src = await render({
      transparent: false,
      view,
      download: false,
      filename: `plug-${selectedPlugId}-${view}-preview.png`,
    });

    if (!src) return null;
    return view === "top" ? await rotateImage180DataUrl(src) : src;
  }

  async function refreshInlinePreviews() {
    const render = renderRef.current;
    if (!render) return;

    setViewPreviewLoading(true);

    try {
      const pairs = await Promise.all(
        A4_VIEWS.map(async (item) => [item.key, await buildInlinePreview(item.key)] as const)
      );

      const next: Partial<Record<RenderViewName, string>> = {};
      for (const [key, src] of pairs) {
        if (src) next[key] = src;
      }
      setViewPreviewMap(next);
    } finally {
      setViewPreviewLoading(false);
    }
  }

  useEffect(() => {
    if (step !== "view") return;

    const timer = window.setTimeout(() => {
      void refreshInlinePreviews();
    }, 120);

    return () => window.clearTimeout(timer);
  }, [
    step,
    selectedPlugId,
    customization.patternUrl,
    customization.topColor,
    customization.bottomColor,
    customization.switchColor,
    patternTransform.x,
    patternTransform.y,
    patternTransform.zoom,
    patternRotation,
    logos,
  ]);

  async function downloadProductionSampleTop() {
    const render = renderRef.current;
    if (!render) return;

    const rawSrc = await render({
      transparent: true,
      view: "top",
      download: false,
      productionArtwork: selectedPlugId === "TYPE-3" || selectedPlugId === "TYPE-5",
      filename: `plug-${selectedPlugId}-production-shape-mask.png`,
    });

    if (!rawSrc) return;

    const maskSourceImg = await loadImage(rawSrc);
    const maskInfo =
      selectedPlugId === "TYPE-5"
        ? buildManualType5Mask(maskSourceImg)
        : selectedPlugId === "TYPE-2"
          ? buildManualType2Mask(maskSourceImg)
          : buildProductionEnvelopeMask(maskSourceImg);
    if (!maskInfo) return;

    const { bbox, maskCanvas } = maskInfo;
    const pad = 60;
    const artworkCanvas = document.createElement("canvas");
    artworkCanvas.width = bbox.width + pad * 2;
    artworkCanvas.height = bbox.height + pad * 2;

    const artworkCtx = artworkCanvas.getContext("2d");
    if (!artworkCtx) return;

    const areaX = pad;
    const areaY = pad;
    const areaW = bbox.width;
    const areaH = bbox.height;
    const fillColor = safeColors.top ?? customization.topColor ?? "#ffffff";

    const baseProductionRotation =
      selectedPlugId === "TYPE-2"
        ? (((plugConfig.patternDecal as any)?.patternRotation as number | undefined) ?? 0)
        : 0;

    // TYPE-2 แบบ manual template: ใช้ rotation จาก UI ตรง ๆ
    // ไม่บวก base ของโมเดลซ้ำ เพราะทำให้ลายคลาดจาก mockup จริง
    const productionPatternRotation =
      selectedPlugId === "TYPE-2"
        ? patternRotation
        : patternRotation;

    await drawProductionPattern({
      ctx: artworkCtx,
      patternSrc: customization.patternUrl,
      fillColor,
      x: areaX,
      y: areaY,
      width: areaW,
      height: areaH,
      transform: patternTransform,
      rotation: productionPatternRotation,
      offsetRotation: 0,
    });

    await drawProductionLogos({
      ctx: artworkCtx,
      logos,
      x: areaX,
      y: areaY,
      width: areaW,
      height: areaH,
      isFixedLogoType:
        selectedPlugId === "TYPE-3" ||
        selectedPlugId === "TYPE-4" ||
        selectedPlugId === "TYPE-5",
    });

    const localMaskCanvas = document.createElement("canvas");
    localMaskCanvas.width = artworkCanvas.width;
    localMaskCanvas.height = artworkCanvas.height;
    const localMaskCtx = localMaskCanvas.getContext("2d");
    if (!localMaskCtx) return;

    localMaskCtx.drawImage(
      maskCanvas,
      bbox.x,
      bbox.y,
      bbox.width,
      bbox.height,
      areaX,
      areaY,
      areaW,
      areaH
    );

    artworkCtx.globalCompositeOperation = "destination-in";
    artworkCtx.drawImage(localMaskCanvas, 0, 0);
    artworkCtx.globalCompositeOperation = "source-over";

    const finalCanvas = document.createElement("canvas");
    finalCanvas.width = artworkCanvas.width;
    finalCanvas.height = artworkCanvas.height;

    const finalCtx = finalCanvas.getContext("2d");
    if (!finalCtx) return;

    finalCtx.clearRect(0, 0, finalCanvas.width, finalCanvas.height);
    finalCtx.drawImage(artworkCanvas, 0, 0);

    const exportCanvas = finalCanvas;

    const link = document.createElement("a");
    link.href = exportCanvas.toDataURL("image/png");
    link.download = `plug-${selectedPlugId}-production-artwork-transparent.png`;
    link.click();
  }

  function handlePatternUpload(base64: string) {
    setUploadedPatterns((prev) => [base64, ...prev]);
    patchCustomization({ patternUrl: base64 });
    setPatternTransform(DEFAULT_PATTERN_TRANSFORM);
    setPatternRotation(0);
    setDragPatternMode(false);
    // ไม่เด้งไปขั้นตอนลายอัตโนมัติ ให้ลูกค้ากดถัดไปเอง
  }

  function nudgePattern(dx: number, dy: number) {
    setPatternTransform((s) => ({
      ...s,
      x: clamp(s.x + dx, 0, 1),
      y: clamp(s.y + dy, 0, 1),
    }));
  }

  function nudgeOrbit(direction: OrbitNudgeDirection) {
    setOrbitNudgeDirection(direction);
    setOrbitNudgeTick((n) => n + 1);
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
    // ไม่เด้งไปขั้นตอนอื่นอัตโนมัติ ให้ลูกค้ากดถัดไปเอง
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
              label={selectedPlugId === "TYPE-4" ? "สีตัวปลั๊ก" : "ฝาบน"}
              initialColor={customization.topColor}
              options={currentColorOptions.top}
              onColorChange={(c) => patchCustomization({ topColor: c })}
              allowCustom
            />

            {selectedPlugId !== "TYPE-4" && (
              <>
                <div style={{ height: 10 }} />
                <ColorPicker
                  label="ฝาล่าง"
                  initialColor={customization.bottomColor}
                  options={currentColorOptions.bottom}
                  onColorChange={(c) => patchCustomization({ bottomColor: c })}
                  allowCustom
                />
              </>
            )}

            {selectedPlugId !== "TYPE-1" && selectedPlugId !== "TYPE-3" && selectedPlugId !== "TYPE-4" && (
              <>
                <div style={{ height: 10 }} />
                <ColorPicker
                  label="สวิตช์"
                  initialColor={customization.switchColor}
                  options={currentColorOptions.switch ?? currentColorOptions.top}
                  onColorChange={(c) => patchCustomization({ switchColor: c })}
                  allowCustom
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
              patternGroupsForSelected={getPatternGroupsByType(selectedPlugId)}
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
                    รีเซ็ต
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
              <div className="label">โลโก้ (อัปโหลดได้สูงสุด 3 ตำแหน่ง)</div>
              <div className="hint">คลิกที่กรอบเพื่อแก้ไขโลโก้นั้นๆ</div>
            </div>
            <button type="button" className="btn btnGhost" disabled={!hasLogo} onClick={resetLogo}>
              ล้างโลโก้ทั้งหมด
            </button>
          </div>

          <div className="divider" />

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
            onDownloadTop={() => {
              void downloadViewImage("top", `plug-${selectedPlugId}-top.png`);
            }}
            onDownloadProductionSample={() => {
              void downloadProductionSampleTop();
            }}
            onDownloadA4={() => {
              void downloadA4Sheet();
            }}
            onDownloadView={(view) => {
              void downloadViewImage(view, `plug-${selectedPlugId}-${view}.png`);
            }}
          />
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

        <div
          style={{
            marginTop: 14,
            border: "1px solid #e5e7eb",
            borderRadius: 14,
            background: "#f8fafc",
            padding: 12,
          }}
        >
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <div className="label">ตัวอย่างมุมต่าง ๆ</div>
              <div className="hint">โชว์ภาพในพื้นที่ด้านล่างก่อนดาวน์โหลด</div>
            </div>
            <button type="button" className="btn btnGhost" onClick={() => void refreshInlinePreviews()} disabled={viewPreviewLoading}>
              {viewPreviewLoading ? "กำลังสร้าง..." : "รีเฟรชตัวอย่าง"}
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: 12,
            }}
          >
            {A4_VIEWS.map((item) => {
              const src = viewPreviewMap[item.key];
              return (
                <div
                  key={item.key}
                  style={{
                    border: "1px solid #dbe3ee",
                    borderRadius: 12,
                    background: "#ffffff",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      padding: "8px 10px",
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#334155",
                      borderBottom: "1px solid #eef2f7",
                    }}
                  >
                    {item.label}
                  </div>

                  <div
                    style={{
                      aspectRatio: "1 / 1",
                      background: "#f8fafc",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 8,
                    }}
                  >
                    {src ? (
                      <img
                        src={src}
                        alt={item.label}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                          display: "block",
                        }}
                      />
                    ) : (
                      <div style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", lineHeight: 1.5 }}>
                        {viewPreviewLoading ? "กำลังสร้างภาพตัวอย่าง..." : "ยังไม่มีภาพตัวอย่าง"}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // ปรับปรุงส่วน UI Layout และ DOM Structure ตรงนี้
  // ============================================
  return (
    <div className="pc-wrap">
      <style>{CSS}</style>

      <div className="pc-grid">

        {/* === ฝั่งซ้าย: Mockup และ Quick Actions === */}
        <div className="left-panel">
          <div className="card left-card-top">
            <div className="head">
              <div>
                <h3 className="title">Mockup</h3>
                <p className="sub">แสดงตัวอย่างสินค้า 3D</p>
              </div>
              <button type="button" className="btn btnDanger" onClick={resetAll}>
                รีเซ็ตทั้งหมด
              </button>
            </div>

            <div className="body" style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              <div className="mock mockWithOverlay">
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
                  orbitNudgeDirection={orbitNudgeDirection}
                  orbitNudgeTick={orbitNudgeTick}
                  onRenderReady={(render) => {
                    renderRef.current = render;
                  }}
                />
                {isMobileLayout && (
                  <div className="mobileOrbitBar" aria-label="ปุ่มหมุน 3D บนมือถือ">
                    <div className="orbitPad">
                      <div className="orbitPadHint">หมุน 3D</div>

                      <div className="orbitPadGrid">
                        <div />
                        <button
                          type="button"
                          className="orbitArrow"
                          onClick={() => nudgeOrbit("up")}
                          title="หมุนขึ้น"
                          aria-label="หมุนขึ้น"
                        >
                          <span>⌃</span>
                        </button>
                        <div />

                        <button
                          type="button"
                          className="orbitArrow"
                          onClick={() => nudgeOrbit("left")}
                          title="หมุนซ้าย"
                          aria-label="หมุนซ้าย"
                        >
                          <span>‹</span>
                        </button>

                        <div className="orbitPadCenter" aria-hidden="true">
                          <span className="orbitPadDot" />
                        </div>

                        <button
                          type="button"
                          className="orbitArrow"
                          onClick={() => nudgeOrbit("right")}
                          title="หมุนขวา"
                          aria-label="หมุนขวา"
                        >
                          <span>›</span>
                        </button>

                        <div />
                        <button
                          type="button"
                          className="orbitArrow"
                          onClick={() => nudgeOrbit("down")}
                          title="หมุนลง"
                          aria-label="หมุนลง"
                        >
                          <span>⌄</span>
                        </button>
                        <div />
                      </div>
                    </div>
                  </div>
                )}
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

          <div className="card quickActionsCard">
            <div className="head">
              <div>
                <h3 className="title">Quick Actions</h3>
                <p className="sub">ทางลัดการปรับแต่ง + สีด่วนตามประเภทปลั๊ก</p>
              </div>
            </div>

            <div className="body">
              <div className="qa-stack">
                <div className="qa-toolbar">
                  <div className="qa-toolbarGroup">
                    <button type="button" className="btn btnGhost" onClick={() => setStep("logo")}>
                      ⚙️ ปรับแต่งโลโก้ (3 จุด)
                    </button>
                    <button type="button" className="btn btnGhost" onClick={resetLogo} disabled={!hasLogo}>
                      ล้างโลโก้ทั้งหมด
                    </button>
                  </div>

                  <div className="qa-toolbarGroup">
                    <button type="button" className="btn btnGhost" onClick={resetPattern} disabled={!hasPattern}>
                      ล้างลาย
                    </button>
                  </div>
                </div>

                <div className="divider" style={{ margin: "2px 0" }} />

                <div className="qa-colorSection">
                  <div className="qa-sectionHead">
                    <div>
                      <div className="label">สีอิสระแบบด่วน</div>
                      <div className="hint" style={{ marginTop: 4 }}>
                        คงการเลือกสีอิสระในหน้า “เลือกสี” ไว้เหมือนเดิม และเพิ่มโซนนี้สำหรับปรับเร็วบนจอคอม
                      </div>
                    </div>

                    <span className="badgeSoft">
                      {plug.name ?? selectedPlugId} • {selectedPlugId === "TYPE-4" ? "สีเดียวทั้งชิ้น" : showQuickSwitch ? "3 ส่วน" : "2 ส่วน"}
                    </span>
                  </div>

                  <div
                    className={`qa-colorGrid ${quickColorCount === 1 ? "single" : ""} ${quickColorCount === 2 ? "double" : ""} ${quickColorCount === 3 ? "triple" : ""}`}
                  >
                    {renderQuickColorCard({
                      label: selectedPlugId === "TYPE-4" ? "สีตัวปลั๊ก" : "ฝาบน",
                      sub: selectedPlugId === "TYPE-4"
                        ? "รุ่นนี้ใช้สีเดียวทั้งชิ้น เปลี่ยนตรงนี้แล้วจะอัปเดตทั้งบนและล่าง"
                        : "ส่วนบนของตัวปลั๊ก",
                      value: customization.topColor,
                      fallback: currentColorOptions.top[0]?.value ?? "#ffffff",
                      onChange: (color) => patchCustomization({ topColor: color }),
                      onReset: () =>
                        patchCustomization({
                          topColor: currentColorOptions.top[0]?.value ?? "#ffffff",
                        }),
                      title: selectedPlugId === "TYPE-4" ? "เลือกสีตัวปลั๊ก" : "เลือกสีฝาบน",
                    })}

                    {showQuickBottom &&
                      renderQuickColorCard({
                        label: "ฝาล่าง",
                        sub: "ส่วนล่างของตัวปลั๊ก",
                        value: customization.bottomColor,
                        fallback: currentColorOptions.bottom[0]?.value ?? "#eaeaea",
                        onChange: (color) => patchCustomization({ bottomColor: color }),
                        onReset: () =>
                          patchCustomization({
                            bottomColor: currentColorOptions.bottom[0]?.value ?? "#eaeaea",
                          }),
                        title: "เลือกสีฝาล่าง",
                      })}

                    {showQuickSwitch &&
                      renderQuickColorCard({
                        label: "สวิตช์",
                        sub: "ปรับสีสวิตช์แยกได้สำหรับรุ่นที่รองรับ",
                        value: customization.switchColor,
                        fallback: (currentColorOptions.switch ?? currentColorOptions.top)[0]?.value ?? "#ffffff",
                        onChange: (color) => patchCustomization({ switchColor: color }),
                        onReset: () =>
                          patchCustomization({
                            switchColor: (currentColorOptions.switch ?? currentColorOptions.top)[0]?.value ?? "#ffffff",
                          }),
                        title: "เลือกสีสวิตช์",
                      })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* === ฝั่งขวา: Steps และเครื่องมือปรับแต่งแบบ Scroll === */}
        <div className="right-panel">
          <div className="card config-card">
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

// ============================================
// ปรับปรุงส่วน CSS สำหรับ Desktop Web App View
// ============================================
const CSS = `
.pc-wrap{
  height: 100vh;
  overflow: hidden;
  padding: 16px;
  box-sizing: border-box;
  background:
    radial-gradient(circle at 8% 8%, rgba(255,122,182,.42), transparent 0%),
    radial-gradient(circle at 92% 10%, rgba(34,211,238,.36), transparent 0%),
    radial-gradient(circle at 50% 95%, rgba(187,247,208,.34), transparent 0%),
    linear-gradient(rgba(255,255,255,.18), rgba(255, 255, 255, 0.02)),
    url("/BG-1.jpg");
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  display: flex;
  flex-direction: column;
}

.pc-grid{
  flex: 1;
  max-width: 1600px;
  width: 100%;
  margin: 0 auto;
  display: grid;
  gap: 16px;
  grid-template-columns: minmax(500px, 1.2fr) minmax(400px, 1fr);
  min-height: 0;
}

.left-panel{
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  overflow-y: auto;
  padding-right: 4px;
}

.left-card-top{
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 480px;
}

.mock{
  flex: 1;
  width: 100%;
  border-radius: 24px;
  background: linear-gradient(180deg, #dff7ff, #fff4fb 48%, #f4fff2);
  border: 1px solid rgba(255,255,255,.72);
  overflow: hidden;
  min-height: 350px;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.72);
}

.right-panel{
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.config-card{
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.config-layout{
  display: grid;
  grid-template-columns: 160px 1px 1fr;
  gap: 16px;
  flex: 1;
  min-height: 0;
}

.config-divider{
  width: 1px;
  background: rgba(226,232,240,.9);
}

.config-content{
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.left-panel::-webkit-scrollbar,
.config-content > div::-webkit-scrollbar,
.patternScroll::-webkit-scrollbar{
  width: 6px;
}

.left-panel::-webkit-scrollbar-track,
.config-content > div::-webkit-scrollbar-track,
.patternScroll::-webkit-scrollbar-track{
  background: transparent;
}

.left-panel::-webkit-scrollbar-thumb,
.config-content > div::-webkit-scrollbar-thumb,
.patternScroll::-webkit-scrollbar-thumb{
  background: linear-gradient(180deg, #ff7ab6, #22d3ee);
  border-radius: 999px;
}

.left-panel::-webkit-scrollbar-thumb:hover,
.config-content > div::-webkit-scrollbar-thumb:hover,
.patternScroll::-webkit-scrollbar-thumb:hover{
  background: linear-gradient(180deg, #ec4899, #0ea5e9);
}

.card{
  background: rgba(255,255,255,.86);
  border: 1px solid rgba(255,255,255,.72);
  border-radius: 26px;
  box-shadow: 0 20px 50px rgba(15,23,42,.14);
  backdrop-filter: blur(18px);
  overflow: hidden;
}

.head{
  padding: 10px 12px;
  border-bottom: 1px solid rgba(226,232,240,.9);
  display:flex;
  justify-content:space-between;
  align-items:center;
  background: linear-gradient(135deg, rgba(255,255,255,.92), rgba(239,246,255,.78));
}

.title{
  margin:0;
  font-size:14px;
  font-weight: 900;
  color:#0f172a;
  letter-spacing:.2px;
}

.sub{
  margin:0;
  font-size:12px;
  color:#334155;
  opacity: .9;
}

.body{
  padding: 12px;
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

.row{
  display:flex;
  gap:10px;
  align-items:center;
  flex-wrap:wrap;
}

.divider{
  height:1px;
  background: rgba(226,232,240,.9);
  margin:10px 0;
}

.btn{
  padding: 7px 12px;
  border-radius: 999px;
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

.btn:active{
  transform: translateY(0px);
  box-shadow: 0 10px 18px rgba(15,23,42,.10);
}

.btnPrimary{
  border: 0;
  background: linear-gradient(135deg, #ff7ab6, #8b5cf6 52%, #22d3ee);
  box-shadow: 0 14px 30px rgba(139,92,246,.26);
}

.btnGhost{
  background: rgba(255,255,255,.76);
  color: #0f172a;
  border: 1px solid rgba(148,163,184,.28);
  box-shadow: 0 10px 18px rgba(15,23,42,.06);
}

.btnGhost:hover{
  background: rgba(255,255,255,.92);
  border-color: rgba(100,116,139,.45);
}

.btnDanger{
  border: 0;
  background: linear-gradient(135deg, #fb7185, #fb923c);
  box-shadow: 0 14px 26px rgba(220,38,38,.18);
}

.btn:disabled{
  opacity:.5;
  cursor:not-allowed;
  transform:none;
  box-shadow:none;
}

.badge,
.badgeSoft{
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 900;
  background: linear-gradient(135deg, rgba(255,122,182,.16), rgba(34,211,238,.16));
  color: #334155;
  border: 1px solid rgba(236,72,153,.20);
}

.stepper{
  display: grid;
  gap: 8px;
  align-content: start;
}

.stepItem{
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 18px;
  border: 1px solid rgba(148,163,184,.22);
  background: rgba(255,255,255,.76);
  cursor: pointer;
  text-align: left;
  transition: transform .12s ease, box-shadow .18s ease, background .18s ease, border-color .18s ease;
}

.stepItem:hover{
  transform: translateY(-1px);
  box-shadow: 0 12px 22px rgba(15,23,42,.10);
  border-color: rgba(236,72,153,.34);
}

.stepActive{
  background: linear-gradient(135deg, rgba(255,122,182,.20), rgba(34,211,238,.18));
  border-color: rgba(236,72,153,.34);
  box-shadow: 0 12px 26px rgba(236,72,153,.14);
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
  border: 0;
  color: #ffffff;
  background: linear-gradient(135deg, #ff7ab6, #22d3ee);
}

.stepText{
  font-weight: 900;
  font-size: 12.5px;
  color: #0f172a;
}

.patternScroll{
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 6px;
}

.pattern-grid{
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
  gap: 10px;
  align-items: start;
}

.miniPad{
  display:grid;
  grid-template-columns: repeat(3, 42px);
  gap: 8px;
  justify-content: center;
  align-items: center;
  padding: 12px;
  border-radius: 22px;
  background: linear-gradient(180deg, rgba(255,255,255,.88), rgba(248,250,252,.78));
  border: 1px solid rgba(148,163,184,.20);
  box-shadow: 0 12px 28px rgba(15,23,42,.08);
}

.miniBtn,
.miniBtnWide{
  min-height: 36px;
  border: none;
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  line-height: 1;
  font-weight: 900;
  cursor: pointer;
  color: #ffffff;
  background: linear-gradient(135deg,#22d3ee,#3b82f6);
  box-shadow: 0 8px 18px rgba(37,99,235,.18);
  transition: transform .16s ease, box-shadow .16s ease, opacity .16s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  white-space: nowrap;
  box-sizing: border-box;
}

.miniBtn{
  width: 42px;
  min-width: 42px;
  padding-left: 0;
  padding-right: 0;
}

.miniBtnWide{
  min-width: 88px;
  padding-left: 14px;
  padding-right: 14px;
  background: linear-gradient(135deg,#8b5cf6,#ec4899);
}

.miniBtn:hover:not(:disabled),
.miniBtnWide:hover:not(:disabled){
  transform: translateY(-1px);
  box-shadow: 0 12px 24px rgba(37,99,235,.22);
}

.miniBtn:disabled,
.miniBtnWide:disabled{
  opacity: .45;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.qa-stack{
  display:flex;
  flex-direction:column;
  gap:14px;
}

.qa-toolbar{
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:12px;
  flex-wrap:wrap;
}

.qa-toolbarGroup{
  display:flex;
  align-items:center;
  gap:10px;
  flex-wrap:wrap;
}

.qa-colorSection{
  display:flex;
  flex-direction:column;
  gap:12px;
}

.qa-sectionHead{
  display:flex;
  justify-content:space-between;
  align-items:flex-end;
  gap:12px;
  flex-wrap:wrap;
}

.qa-colorGrid{
  display:grid;
  gap:12px;
  align-items:stretch;
}

.qa-colorGrid.single{
  grid-template-columns: minmax(0, 1fr);
}

.qa-colorGrid.double{
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.qa-colorGrid.triple{
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.qa-colorCard{
  min-width:0;
  padding:14px;
  border-radius:22px;
  border:1px solid rgba(148,163,184,.20);
  background: linear-gradient(180deg, rgba(255,255,255,.88), rgba(248,250,252,.78));
  box-shadow: 0 12px 28px rgba(15,23,42,.08);
}

.qa-colorTop{
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  gap:12px;
}

.qa-colorTitle{
  font-size:13px;
  font-weight:900;
  color:#0f172a;
  letter-spacing:.2px;
}

.qa-colorSub{
  margin-top:4px;
  font-size:12px;
  color:#475569;
  line-height:1.45;
}

.qa-colorBadge{
  padding:6px 10px;
  border-radius:999px;
  font-size:11px;
  font-weight:900;
  letter-spacing:.4px;
  color:#334155;
  background: linear-gradient(135deg, rgba(255,122,182,.16), rgba(34,211,238,.16));
  border:1px solid rgba(236,72,153,.20);
  white-space:nowrap;
}

.qa-colorRow{
  margin-top:14px;
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:12px;
  flex-wrap:wrap;
}

.qa-colorPickerGroup{
  display:flex;
  align-items:center;
  gap:12px;
  flex-wrap:wrap;
  min-width:0;
}

.qa-colorInputWrap{
  position:relative;
  width:56px;
  height:56px;
  border-radius:16px;
  overflow:hidden;
  background:#ffffff;
  border:1px solid rgba(148,163,184,.26);
  box-shadow:
    inset 0 0 0 1px rgba(255,255,255,.65),
    0 10px 18px rgba(15,23,42,.08);
  cursor:pointer;
  flex-shrink:0;
}

.qa-colorInput{
  position:absolute;
  inset:0;
  width:100%;
  height:100%;
  opacity:0;
  cursor:pointer;
}

.qa-colorPreview{
  position:absolute;
  inset:6px;
  border-radius:12px;
  border:1px solid rgba(15,23,42,.12);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.45);
}

.qa-colorMeta{
  display:flex;
  flex-direction:column;
  gap:3px;
  min-width:0;
}

.qa-colorMetaLabel{
  font-size:11px;
  font-weight:700;
  color:#64748b;
}

.qa-colorMetaValue{
  font-size:13px;
  font-weight:900;
  color:#0f172a;
  letter-spacing:.3px;
  word-break:break-all;
}

.qa-smallBtn{
  min-width:88px;
}

.mockWithOverlay{
  position:relative;
}

.mobileOrbitOverlay,
.mobileOrbitBar{
  display:none;
}

input[type="range"]{
  accent-color: #ec4899;
}

@media (max-width: 1380px){
  .qa-colorGrid.triple{
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 1180px){
  .pc-wrap{
    height: auto;
    min-height: 100vh;
    overflow: auto;
  }

  .pc-grid{
    grid-template-columns: 1fr;
    height: auto;
  }

  .left-panel,
  .right-panel{
    height: auto;
    overflow: visible;
    padding-right: 0;
  }

  .config-layout{
    grid-template-columns: 1fr;
    min-height: auto;
  }

  .config-divider{
    width: 100%;
    height: 1px;
    margin: 8px 0;
  }

  .mock{
    min-height: 400px;
  }
}

@media (max-width: 820px){
  .qa-colorGrid.double,
  .qa-colorGrid.triple{
    grid-template-columns: 1fr;
  }

  .qa-toolbar{
    align-items:stretch;
  }

  .qa-toolbarGroup{
    width:100%;
  }

  .qa-toolbarGroup .btn{
    flex:1;
    justify-content:center;
  }
}

@media (max-width: 768px){
  .quickActionsCard{
    display:none;
  }

  .mockWithOverlay{
    padding-bottom:76px;
  }

  .mobileOrbitBar{
    position:absolute;
    left:50%;
    bottom:10px;
    transform:translateX(-50%);
    z-index:20;
    display:flex;
    justify-content:center;
    pointer-events:none;
    width:100%;
  }

  .orbitPad{
    pointer-events:auto;
    display:flex;
    align-items:center;
    gap:8px;
    padding:8px 10px;
    border-radius:999px;
    background:rgba(255,255,255,.78);
    border:1px solid rgba(255,255,255,.8);
    box-shadow:0 10px 24px rgba(15,23,42,.14);
    backdrop-filter:blur(12px);
    -webkit-backdrop-filter:blur(12px);
  }

  .orbitPadHint{
    font-size:11px;
    font-weight:900;
    color:#64748b;
    white-space:nowrap;
    user-select:none;
  }

  .orbitPadGrid{
    display:flex;
    align-items:center;
    gap:6px;
  }

  .orbitPadGrid > div:not(.orbitPadCenter){
    display:none;
  }

  .orbitPadCenter{
    width:8px;
    height:8px;
    border-radius:999px;
    background:#94a3b8;
    flex:0 0 auto;
  }

  .orbitPadDot{
    display:none;
  }

  .orbitArrow{
    width:38px;
    height:38px;
    border:none;
    border-radius:999px;
    background:#ffffff;
    color:#334155;
    display:grid;
    place-items:center;
    cursor:pointer;
    user-select:none;
    -webkit-tap-highlight-color:transparent;
    box-shadow:0 6px 14px rgba(15,23,42,.12);
    transition:transform .12s ease, box-shadow .18s ease, background .18s ease, color .18s ease;
    font-size:22px;
    font-weight:900;
  }

  .orbitArrow span{
    font-size:22px;
    line-height:1;
    font-weight:900;
    transform:translateY(-1px);
  }

  .orbitArrow:active{
    transform:scale(.94);
    background:rgba(239,246,255,.96);
    color:#1d4ed8;
    box-shadow:0 10px 18px rgba(37,99,235,.16);
  }
}
`;