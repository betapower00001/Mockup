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
  view: RenderViewName;
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

type CustomerInfo = {
  name: string;
  phone: string;
  company: string;
  lineOrEmail: string;
};

type ShippingInfo = {
  recipientName: string;
  phone: string;
  address: string;
  postalCode: string;
};

type PaymentMethod = "bank-transfer" | "invoice" | "contact-first";
type ContinuationChoice = "" | "order" | "messenger";

type PricingBreakdown = {
  unitPrice: number;
  totalPrice: number;
  currency: string;
  pricingReady: boolean;
  minQty: number;
  maxQty: number;
  message: string;
};

type PriceTier = {
  min: number;
  max: number;
  unitPrice: number;
};

type ProductionOrderSnapshot = {
  orderId: string;
  createdAt: string;
  designSignature: string;
  plugId: string;
  plugName: string;
  quantity: number;
  note: string;
  colors: Partial<Record<ColorKey, string>>;
  pattern: {
    url: string;
    transform: PatternTransform;
    rotation: number;
  };
  logos: LogoItem[];
  productionFileName: string;
  productionSize: { width: number; height: number };
  pricing: PricingBreakdown;
  contact: CustomerInfo;
  shipping: ShippingInfo;
  paymentMethod: PaymentMethod;
  flow: "direct-order";
};

type StepId = "model" | "color" | "pattern" | "logo" | "view" | "order";
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
  { id: "order", title: "6) ตรวจแบบ & สั่งผลิต", sub: "ตรวจข้อมูล ยืนยันแบบ และสร้างไฟล์ผลิต" },
];

const DEFAULT_CUSTOMIZATION: CustomizationState = {
  topColor: "#ffffff",
  bottomColor: "#eaeaea",
  switchColor: "#ffffff",
  patternUrl: "",
  view: "top",
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

const DEFAULT_CUSTOMER_INFO: CustomerInfo = {
  name: "",
  phone: "",
  company: "",
  lineOrEmail: "",
};

const DEFAULT_SHIPPING_INFO: ShippingInfo = {
  recipientName: "",
  phone: "",
  address: "",
  postalCode: "",
};

const FACEBOOK_PAGE_USERNAME = "adsawinthailand";
const FACEBOOK_PAGE_ID = "110219891504385";
const MESSENGER_REFERRAL_URL = `https://m.me/${FACEBOOK_PAGE_USERNAME}`;
const MESSENGER_DESKTOP_FALLBACK_URL = `https://www.facebook.com/messages/t/${FACEBOOK_PAGE_ID}`;

const PRICE_TIERS: Record<string, PriceTier[]> = {
  "TYPE-1": [
    { min: 12, max: 100, unitPrice: 389 },
    { min: 101, max: 300, unitPrice: 369 },
    { min: 301, max: 500, unitPrice: 359 },
    { min: 501, max: 1000, unitPrice: 349 },
  ],
  "TYPE-2": [
    { min: 12, max: 100, unitPrice: 419 },
    { min: 101, max: 300, unitPrice: 399 },
    { min: 301, max: 500, unitPrice: 389 },
    { min: 501, max: 1000, unitPrice: 379 },
  ],
  "TYPE-3": [
    { min: 12, max: 100, unitPrice: 279 },
    { min: 101, max: 300, unitPrice: 269 },
    { min: 301, max: 500, unitPrice: 259 },
    { min: 501, max: 1000, unitPrice: 249 },
  ],
  "TYPE-4": [
    { min: 12, max: 100, unitPrice: 219 },
    { min: 101, max: 300, unitPrice: 209 },
    { min: 301, max: 500, unitPrice: 199 },
    { min: 501, max: 1000, unitPrice: 189 },
  ],
  "TYPE-5": [
    { min: 12, max: 100, unitPrice: 349 },
    { min: 101, max: 300, unitPrice: 335 },
    { min: 301, max: 500, unitPrice: 325 },
    { min: 501, max: 1000, unitPrice: 315 },
  ],
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
      { label: "ส้ม", value: "#ec3b27" },
      { label: "แดง", value: "#ff000b" },
      { label: "กรมท่า", value: "#1e266a" },
      { label: "ฟ้าพาสเทล", value: "#59c5c7" },
      { label: "เขียวพาสเทล", value: "#62c2a6" },
      { label: "เหลือง", value: "#ffc813" },
      { label: "ชมพู", value: "#f37c8f" },
      { label: "ม่วงพาสเทล", value: "#9363a1" },
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
      { label: "ส้ม", value: "#ec3b27" },
      { label: "แดง", value: "#ff000b" },
      { label: "กรมท่า", value: "#1e266a" },
      { label: "ฟ้าพาสเทล", value: "#59c5c7" },
      { label: "เขียวพาสเทล", value: "#62c2a6" },
      { label: "เหลือง", value: "#ffc813" },
      { label: "ชมพู", value: "#f37c8f" },
      { label: "ม่วงพาสเทล", value: "#9363a1" },
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

  "TYPE-3": {
    top: [
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

const INLINE_PREVIEW_VIEWS: { key: RenderViewName; label: string }[] = [
  ...A4_VIEWS,
  { key: "topRight", label: "บนเอียงขวา" },
];

const VIEW_BUTTONS: {
  key: RenderViewName;
  label: string;
  icon: string;
  gradient: string;
  soft: string;
}[] = [
    {
      key: "top",
      label: "มุมบน",
      icon: "↟",
      gradient: "linear-gradient(135deg,#8b5cf6,#ec4899)",
      soft: "linear-gradient(135deg,#a855f7,#ec4899)",
    },
    {
      key: "front",
      label: "ด้านหน้า",
      icon: "↥",
      gradient: "linear-gradient(135deg,#f97316,#ef4444)",
      soft: "linear-gradient(135deg,#fb923c,#f87171)",
    },
    {
      key: "back",
      label: "ด้านหลัง",
      icon: "↧",
      gradient: "linear-gradient(135deg,#64748b,#334155)",
      soft: "linear-gradient(135deg,#94a3b8,#64748b)",
    },
    {
      key: "left",
      label: "ด้านซ้าย",
      icon: "↤",
      gradient: "linear-gradient(135deg,#22c55e,#14b8a6)",
      soft: "linear-gradient(135deg,#4ade80,#2dd4bf)",
    },
    {
      key: "right",
      label: "ด้านขวา",
      icon: "↦",
      gradient: "linear-gradient(135deg,#06b6d4,#6366f1)",
      soft: "linear-gradient(135deg,#22d3ee,#818cf8)",
    },
    {
      key: "bottom",
      label: "ด้านล่าง",
      icon: "↡",
      gradient: "linear-gradient(135deg,#7c3aed,#2563eb)",
      soft: "linear-gradient(135deg,#a78bfa,#60a5fa)",
    },
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

type MessengerPackageFiles = {
  orderId: string;
  pdfUrl: string;
  pdfFileName: string;
  productionUrl: string;
  productionFileName: string;
  topRightUrl: string;
  topRightFileName: string;
};

type MessengerUploadResponse = {
  ok: boolean;
  orderId?: string;
  referralRef?: string;
  error?: string;
  code?: string;
  missing?: string[];
};

type MessengerAttachmentUploadResponse = {
  ok: boolean;
  attachmentId?: string;
  error?: string;
  code?: string;
};

type MessengerConfigStatus = {
  ok: boolean;
  configured: boolean;
  missing: string[];
  graphVersion: string;
  referralMaxAgeSeconds: number;
  message?: string;
};

type MessengerPdfInput = {
  orderId: string;
  modelName: string;
  modelId: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  priceRange: string;
  topColor: string;
  bottomColor: string;
  switchColor?: string;
  patternText: string;
  logoText: string;
  topRightSrc: string;
  productionSrc: string;
};

function loadDataUrlImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("โหลดรูปสำหรับ PDF ไม่สำเร็จ"));
    img.src = src;
  });
}

function drawImageContain(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const dx = x + (width - drawWidth) / 2;
  const dy = y + (height - drawHeight) / 2;
  ctx.drawImage(image, dx, dy, drawWidth, drawHeight);
}

function canvasToJpegBytes(canvas: HTMLCanvasElement, quality = 0.86) {
  return new Promise<Uint8Array>((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          reject(new Error("สร้างหน้า PDF ไม่สำเร็จ"));
          return;
        }
        resolve(new Uint8Array(await blob.arrayBuffer()));
      },
      "image/jpeg",
      quality
    );
  });
}

function asciiBytes(value: string) {
  return new TextEncoder().encode(value);
}

function concatByteArrays(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function createImageOnlyPdf(pages: { jpeg: Uint8Array; width: number; height: number }[]) {
  const pageWidth = 595;
  const pageHeight = 842;
  const objectBodies: Uint8Array[] = [];

  const pageObjectNumbers: number[] = [];
  const imageObjectNumbers: number[] = [];
  const contentObjectNumbers: number[] = [];

  let nextObject = 3;
  pages.forEach(() => {
    pageObjectNumbers.push(nextObject++);
    imageObjectNumbers.push(nextObject++);
    contentObjectNumbers.push(nextObject++);
  });

  objectBodies[0] = asciiBytes("<< /Type /Catalog /Pages 2 0 R >>");
  objectBodies[1] = asciiBytes(
    `<< /Type /Pages /Count ${pages.length} /Kids [${pageObjectNumbers.map((n) => `${n} 0 R`).join(" ")}] >>`
  );

  pages.forEach((page, index) => {
    const pageObject = pageObjectNumbers[index];
    const imageObject = imageObjectNumbers[index];
    const contentObject = contentObjectNumbers[index];
    const imageName = `Im${index + 1}`;

    objectBodies[pageObject - 1] = asciiBytes(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /${imageName} ${imageObject} 0 R >> >> /Contents ${contentObject} 0 R >>`
    );

    const imageHeader = asciiBytes(
      `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`
    );
    const imageFooter = asciiBytes("\nendstream");
    objectBodies[imageObject - 1] = concatByteArrays([imageHeader, page.jpeg, imageFooter]);

    const content = asciiBytes(`q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/${imageName} Do\nQ\n`);
    objectBodies[contentObject - 1] = concatByteArrays([
      asciiBytes(`<< /Length ${content.length} >>\nstream\n`),
      content,
      asciiBytes("endstream"),
    ]);
  });

  const header = asciiBytes("%PDF-1.4\n");
  const chunks: Uint8Array[] = [header];
  const offsets: number[] = [0];
  let byteOffset = header.length;

  objectBodies.forEach((body, index) => {
    const objectNumber = index + 1;
    const wrapped = concatByteArrays([
      asciiBytes(`${objectNumber} 0 obj\n`),
      body,
      asciiBytes("\nendobj\n"),
    ]);
    offsets[objectNumber] = byteOffset;
    chunks.push(wrapped);
    byteOffset += wrapped.length;
  });

  const xrefOffset = byteOffset;
  let xref = `xref\n0 ${objectBodies.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objectBodies.length; i += 1) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${objectBodies.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  chunks.push(asciiBytes(xref));

  return new Blob([concatByteArrays(chunks)], { type: "application/pdf" });
}

async function createMessengerPdfBlob(input: MessengerPdfInput) {
  const [topRightImage, productionImage] = await Promise.all([
    loadDataUrlImage(input.topRightSrc),
    loadDataUrlImage(input.productionSrc),
  ]);

  const width = 1240;
  const height = 1754;
  const margin = 78;

  const page1 = document.createElement("canvas");
  page1.width = width;
  page1.height = height;
  const ctx1 = page1.getContext("2d");
  if (!ctx1) throw new Error("สร้าง Canvas สำหรับ PDF ไม่สำเร็จ");

  ctx1.fillStyle = "#ffffff";
  ctx1.fillRect(0, 0, width, height);
  ctx1.fillStyle = "#0f172a";
  ctx1.font = "700 46px Arial, Tahoma, sans-serif";
  ctx1.fillText("ADS AWIN PLUG - MOCKUP ORDER", margin, 92);
  ctx1.font = "700 30px Arial, Tahoma, sans-serif";
  ctx1.fillText(`Order ID: ${input.orderId}`, margin, 144);

  ctx1.fillStyle = "#f8fafc";
  ctx1.fillRect(margin, 184, width - margin * 2, 365);
  ctx1.strokeStyle = "#e2e8f0";
  ctx1.strokeRect(margin, 184, width - margin * 2, 365);

  const rows = [
    ["รุ่นสินค้า", `${input.modelName} (${input.modelId})`],
    ["จำนวน", `${input.quantity.toLocaleString("th-TH")} ชิ้น`],
    ["ช่วงราคา", input.priceRange],
    ["ราคาต่อชิ้น", input.unitPrice],
    ["ราคารวม", input.totalPrice],
    ["สี", `บน ${input.topColor} / ล่าง ${input.bottomColor}${input.switchColor ? ` / สวิตช์ ${input.switchColor}` : ""}`],
    ["ลวดลาย / โลโก้", `${input.patternText} / ${input.logoText}`],
  ];

  rows.forEach(([label, value], index) => {
    const y = 226 + index * 46;
    ctx1.fillStyle = "#64748b";
    ctx1.font = "700 23px Arial, Tahoma, sans-serif";
    ctx1.fillText(label, margin + 28, y);
    ctx1.fillStyle = "#0f172a";
    ctx1.font = "600 23px Arial, Tahoma, sans-serif";
    ctx1.fillText(value, margin + 280, y);
  });

  ctx1.fillStyle = "#0f172a";
  ctx1.font = "700 30px Arial, Tahoma, sans-serif";
  ctx1.fillText("มุมบนเอียงขวา", margin, 612);
  ctx1.fillStyle = "#f8fafc";
  ctx1.fillRect(margin, 644, width - margin * 2, 900);
  drawImageContain(ctx1, topRightImage, margin + 20, 664, width - margin * 2 - 40, 860);

  ctx1.fillStyle = "#64748b";
  ctx1.font = "500 20px Arial, Tahoma, sans-serif";
  ctx1.fillText("สร้างจากระบบ Mockup - ใช้ตรวจสอบแบบก่อนผลิต", margin, height - 72);

  const page2 = document.createElement("canvas");
  page2.width = width;
  page2.height = height;
  const ctx2 = page2.getContext("2d");
  if (!ctx2) throw new Error("สร้าง Canvas สำหรับ PDF ไม่สำเร็จ");

  ctx2.fillStyle = "#ffffff";
  ctx2.fillRect(0, 0, width, height);
  ctx2.fillStyle = "#0f172a";
  ctx2.font = "700 46px Arial, Tahoma, sans-serif";
  ctx2.fillText("PRODUCTION FILE", margin, 92);
  ctx2.font = "700 28px Arial, Tahoma, sans-serif";
  ctx2.fillText(`Order ID: ${input.orderId}`, margin, 142);
  ctx2.fillStyle = "#f8fafc";
  ctx2.fillRect(margin, 190, width - margin * 2, 1410);
  drawImageContain(ctx2, productionImage, margin + 30, 220, width - margin * 2 - 60, 1350);
  ctx2.fillStyle = "#64748b";
  ctx2.font = "500 20px Arial, Tahoma, sans-serif";
  ctx2.fillText("ไฟล์สำหรับอ้างอิงการผลิต - กรุณาตรวจสอบ Order ID ให้ตรงกัน", margin, height - 72);

  const [jpeg1, jpeg2] = await Promise.all([canvasToJpegBytes(page1), canvasToJpegBytes(page2)]);
  return createImageOnlyPdf([
    { jpeg: jpeg1, width, height },
    { jpeg: jpeg2, width, height },
  ]);
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
  const [mobileAccordionOpen, setMobileAccordionOpen] = useState(true);
  const [viewPreviewMap, setViewPreviewMap] = useState<Partial<Record<RenderViewName, string>>>({});
  const [viewPreviewLoading, setViewPreviewLoading] = useState(false);

  const [productionReady, setProductionReady] = useState(false);
  const [productionOrderPreview, setProductionOrderPreview] = useState("");
  const [productionOrderPreviewLoading, setProductionOrderPreviewLoading] = useState(false);
  const [orderQuantity, setOrderQuantity] = useState("12");
  const [orderNote, setOrderNote] = useState("");
  const [orderConfirmed, setOrderConfirmed] = useState(false);
  const [orderBusy, setOrderBusy] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [orderSnapshot, setOrderSnapshot] = useState<ProductionOrderSnapshot | null>(null);
  const [continuationChoice, setContinuationChoice] = useState<ContinuationChoice>("");
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>(DEFAULT_CUSTOMER_INFO);
  const [shippingInfo, setShippingInfo] = useState<ShippingInfo>(DEFAULT_SHIPPING_INFO);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("contact-first");
  const [messengerCopied, setMessengerCopied] = useState(false);
  const [messengerPackageBusy, setMessengerPackageBusy] = useState(false);
  const [messengerPackageStatus, setMessengerPackageStatus] = useState("");
  const [messengerPackageFiles, setMessengerPackageFiles] = useState<MessengerPackageFiles | null>(null);
  const [messengerTopRightPreview, setMessengerTopRightPreview] = useState("");
  const [messengerTopRightPreviewLoading, setMessengerTopRightPreviewLoading] = useState(false);
  const [messengerTopRightPreviewError, setMessengerTopRightPreviewError] = useState("");
  const messengerTopRightSignatureRef = useRef("");
  const messengerTopRightLoadingRef = useRef(false);

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
  const productionRenderRef = useRef<PlugRenderFn | null>(null);

  const plugConfig = useMemo(
    () => getPlugConfig(selectedPlugId, { modelPath: plug.modelPath }),
    [selectedPlugId, plug.modelPath]
  );

  const productionPlugConfig = useMemo(
    () =>
      getPlugConfig(selectedPlugId, {
        modelPath: plug.productionModelPath ?? plug.modelPath,
      }),
    [selectedPlugId, plug.modelPath, plug.productionModelPath]
  );

  const currentColorOptions = useMemo(
    () => getColorOptionsByType(selectedPlugId),
    [selectedPlugId]
  );

  const safeColors = useMemo(() => {
    const top = ensureAllowedColor(customization.topColor, currentColorOptions.top);
    const bottom = ensureAllowedColor(customization.bottomColor, currentColorOptions.bottom);

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
  const parsedOrderQuantity = Math.max(0, Math.floor(Number(orderQuantity) || 0));
  const logoCount = logos.filter((logo) => !!logo.url).length;

  const pricing = useMemo<PricingBreakdown>(() => {
    const tiers = PRICE_TIERS[selectedPlugId] ?? [];
    const tier = tiers.find((item) => parsedOrderQuantity >= item.min && parsedOrderQuantity <= item.max);

    if (parsedOrderQuantity < 12) {
      return { unitPrice: 0, totalPrice: 0, currency: "THB", pricingReady: false, minQty: 12, maxQty: 1000, message: "ขั้นต่ำในการสั่งผลิต 12 ชิ้น" };
    }

    if (parsedOrderQuantity > 1000) {
      return { unitPrice: 0, totalPrice: 0, currency: "THB", pricingReady: false, minQty: 12, maxQty: 1000, message: "จำนวนมากกว่า 1,000 ชิ้น กรุณาติดต่อเพื่อขอราคา" };
    }

    if (!tier) {
      return { unitPrice: 0, totalPrice: 0, currency: "THB", pricingReady: false, minQty: 12, maxQty: 1000, message: "ไม่พบช่วงราคาสำหรับจำนวนนี้" };
    }

    return {
      unitPrice: tier.unitPrice,
      totalPrice: tier.unitPrice * parsedOrderQuantity,
      currency: "THB",
      pricingReady: true,
      minQty: tier.min,
      maxQty: tier.max,
      message: `ช่วงราคา ${tier.min}-${tier.max} ชิ้น`,
    };
  }, [selectedPlugId, parsedOrderQuantity]);

  const orderDesignSignature = useMemo(
    () =>
      JSON.stringify({
        selectedPlugId,
        topColor: safeColors.top ?? customization.topColor,
        bottomColor: safeColors.bottom ?? customization.bottomColor,
        switchColor: safeColors.switch ?? customization.switchColor,
        patternUrl: customization.patternUrl,
        patternTransform,
        patternRotation,
        logos,
      }),
    [
      selectedPlugId,
      safeColors,
      customization.topColor,
      customization.bottomColor,
      customization.switchColor,
      customization.patternUrl,
      patternTransform,
      patternRotation,
      logos,
    ]
  );

  const showQuickBottom = true;
  const showQuickSwitch =
    selectedPlugId !== "TYPE-1" &&
    selectedPlugId !== "TYPE-3" &&
    selectedPlugId !== "TYPE-4";

  const quickColorCount = 1 + (showQuickBottom ? 1 : 0) + (showQuickSwitch ? 1 : 0);

  useEffect(() => {
    if (!orderSnapshot) return;

    const currentNote = orderNote.trim();
    const contactChanged = JSON.stringify(orderSnapshot.contact) !== JSON.stringify(customerInfo);
    const shippingChanged = JSON.stringify(orderSnapshot.shipping) !== JSON.stringify(shippingInfo);
    const pricingChanged = orderSnapshot.pricing.totalPrice !== pricing.totalPrice || orderSnapshot.pricing.unitPrice !== pricing.unitPrice;

    if (
      orderSnapshot.designSignature !== orderDesignSignature ||
      orderSnapshot.quantity !== parsedOrderQuantity ||
      orderSnapshot.note !== currentNote ||
      orderSnapshot.paymentMethod !== paymentMethod ||
      contactChanged ||
      shippingChanged ||
      pricingChanged
    ) {
      setOrderSnapshot(null);
      setOrderConfirmed(false);
    }
  }, [
    orderSnapshot,
    orderDesignSignature,
    parsedOrderQuantity,
    orderNote,
    customerInfo,
    shippingInfo,
    paymentMethod,
    pricing.totalPrice,
    pricing.unitPrice,
  ]);

  useEffect(() => {
    if (step !== "order") return;

    const timer = window.setTimeout(() => {
      void refreshProductionOrderPreview();
    }, 140);

    return () => window.clearTimeout(timer);
  }, [step, orderDesignSignature, productionReady]);

  // TEXT-ONLY TEST MODE:
  // ปิดการเตรียมภาพมุมบนเอียงขวาอัตโนมัติชั่วคราว
  // เพื่อทดสอบ Messenger text + Webhook + Send API โดยไม่แตะ WebGL/PNG/PDF
  useEffect(() => {
    if (step !== "order") return;
    setMessengerTopRightPreviewError("");
  }, [step, orderDesignSignature]);

  function downloadDataUrl(src: string, filename: string) {
    if (!src) return;
    const link = document.createElement("a");
    link.href = src;
    link.download = filename;
    link.click();
  }

  function createOrderId() {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, "0");
    const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const timePart = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const randomPart = String(Math.floor(Math.random() * 1000)).padStart(3, "0");
    return `PAC-${datePart}-${timePart}-${randomPart}`;
  }

  function formatPrice(value: number) {
    return new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(value);
  }

  function updateCustomerInfo<K extends keyof CustomerInfo>(key: K, value: CustomerInfo[K]) {
    setCustomerInfo((prev) => ({ ...prev, [key]: value }));
  }

  function updateShippingInfo<K extends keyof ShippingInfo>(key: K, value: ShippingInfo[K]) {
    setShippingInfo((prev) => ({ ...prev, [key]: value }));
  }

  function buildMessengerSummary(orderId?: string) {
    const fileNote = orderId
      ? [
          "",
          `Order ID: ${orderId}`,
          "ระบบจะส่งรายละเอียด + PDF + มุมบนเอียงขวา + ไฟล์ผลิตเข้าห้องแชตอัตโนมัติ",
          "ระบบนี้ไม่เก็บ Order หรือไฟล์ไว้ในฐานข้อมูลของเว็บ",
        ]
      : [];

    return [
      "สนใจสั่งผลิตสินค้า",
      `Mockup: ${plug.name ?? selectedPlugId}`,
      `รุ่นสินค้า: ${selectedPlugId}`,
      `จำนวน: ${parsedOrderQuantity || 0} ชิ้น`,
      `ราคา/ชิ้น: ${pricing.pricingReady ? formatPrice(pricing.unitPrice) : pricing.message}`,
      `ราคารวม: ${pricing.pricingReady ? formatPrice(pricing.totalPrice) : pricing.message}`,
      ...fileNote,
    ].join("\n");
  }

  const messengerSummaryText = buildMessengerSummary(messengerPackageFiles?.orderId);

  async function copyMessengerSummary(text = messengerSummaryText) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error("Clipboard API unavailable");
      }
      setMessengerCopied(true);
      window.setTimeout(() => setMessengerCopied(false), 1800);
    } catch {
      // fallback สำหรับ browser/mobile บางรุ่นที่ไม่อนุญาต Clipboard หลัง async render
      try {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
        setMessengerCopied(true);
        window.setTimeout(() => setMessengerCopied(false), 1800);
      } catch {
        setOrderError("คัดลอกข้อความสำหรับ Messenger ไม่สำเร็จ กรุณาคัดลอกข้อความจากกล่องสรุปด้วยตนเอง");
      }
    }
  }

  function dataUrlToBlob(src: string) {
    const [meta, encoded] = src.split(",", 2);
    if (!meta || !encoded) throw new Error("รูปที่สร้างไม่ใช่ Data URL ที่ถูกต้อง");
    const mime = /data:([^;]+)/.exec(meta)?.[1] || "application/octet-stream";
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  async function canvasToPngBlob(canvas: HTMLCanvasElement) {
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("สร้าง PNG สำหรับ Messenger ไม่สำเร็จ"));
          return;
        }
        resolve(blob);
      }, "image/png");
    });
  }

  async function preparePngForMessenger(src: string, maxBytes = 3_200_000) {
    let blob = dataUrlToBlob(src);
    if (blob.type === "image/png" && blob.size <= maxBytes) return blob;

    const image = await loadDataUrlImage(src);
    const originalWidth = image.naturalWidth || image.width;
    const originalHeight = image.naturalHeight || image.height;
    let scale = Math.min(1, 1600 / Math.max(originalWidth, originalHeight));

    for (let attempt = 0; attempt < 7; attempt += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(720, Math.round(originalWidth * scale));
      canvas.height = Math.max(720, Math.round(originalHeight * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("สร้าง Canvas สำหรับ PNG ไม่สำเร็จ");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      blob = await canvasToPngBlob(canvas);
      if (blob.size <= maxBytes) return blob;
      scale *= 0.82;
    }

    if (blob.size > maxBytes) {
      throw new Error(`PNG มีขนาดใหญ่เกินไป (${(blob.size / 1024 / 1024).toFixed(2)} MB) กรุณาลดความละเอียดแล้วลองใหม่`);
    }
    return blob;
  }

  async function uploadMessengerAttachment(
    blob: Blob,
    filename: string,
    type: "image" | "file"
  ) {
    const formData = new FormData();
    formData.set("type", type);
    formData.set("file", blob, filename);

    const response = await fetchWithTimeout(
      "/api/messenger/attachment",
      { method: "POST", body: formData },
      45_000
    );
    const result = (await response.json()) as MessengerAttachmentUploadResponse;
    if (!response.ok || !result.ok || !result.attachmentId) {
      throw new Error(result.error || `อัปโหลด ${filename} เข้า Meta ไม่สำเร็จ`);
    }
    return result.attachmentId;
  }

  function openMessenger(referralRef?: string, popup?: Window | null) {
    const referral = encodeURIComponent(referralRef || `mockup-${selectedPlugId}`);

    // Stateless flow: ref contains a signed, short-lived payload + Meta attachment IDs.
    // Webhook verifies the signature and sends the package without reading any database.
    const url = `${MESSENGER_REFERRAL_URL}?ref=${referral}`;

    if (popup && !popup.closed) {
      popup.location.replace(url);
      return;
    }

    window.location.href = url;
  }

  function openFacebookSessionFallback() {
    window.open(MESSENGER_DESKTOP_FALLBACK_URL, "_blank", "noopener,noreferrer");
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 3000);
  }

  function escapePopupHtml(value: string) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function updateMessengerPopup(
    popup: Window | null,
    title: string,
    detail = "",
    isError = false
  ) {
    if (!popup || popup.closed) return;
    const accent = isError ? "#b91c1c" : "#0f172a";
    const panel = isError ? "#fef2f2" : "#f8fafc";
    const border = isError ? "#fecaca" : "#e2e8f0";
    const safeTitle = escapePopupHtml(title);
    const safeDetail = escapePopupHtml(detail);
    popup.document.title = title;
    popup.document.body.innerHTML = `
      <main style="font-family:Arial,sans-serif;max-width:720px;margin:60px auto;padding:24px;color:#0f172a">
        <div style="border:1px solid ${border};background:${panel};border-radius:16px;padding:22px">
          <div style="font-size:18px;font-weight:800;color:${accent};margin-bottom:10px">${safeTitle}</div>
          ${safeDetail ? `<div style="font-size:14px;line-height:1.65;white-space:pre-wrap;color:#475569">${safeDetail}</div>` : ""}
          ${isError ? '<button onclick="window.close()" style="margin-top:18px;border:0;border-radius:10px;padding:10px 16px;background:#0f172a;color:#fff;font-weight:700;cursor:pointer">ปิดหน้าต่าง</button>' : ""}
        </div>
      </main>`;
  }

  async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 60_000) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      window.clearTimeout(timer);
    }
  }

  async function renderWithTimeout(
    renderPromise: Promise<string | null | undefined>,
    timeoutMs: number,
    timeoutMessage: string
  ) {
    let timer = 0;
    try {
      return await Promise.race([
        renderPromise,
        new Promise<never>((_, reject) => {
          timer = window.setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
        }),
      ]);
    } finally {
      if (timer) window.clearTimeout(timer);
    }
  }

  async function readMessengerConfigStatus() {
    const response = await fetchWithTimeout(
      "/api/messenger/status",
      { method: "GET", cache: "no-store" },
      10_000
    );
    const result = (await response.json()) as MessengerConfigStatus;
    if (!response.ok || !result.ok) {
      throw new Error(result.message || "ตรวจสอบการตั้งค่า Meta Messenger ไม่สำเร็จ");
    }
    return result;
  }

  async function createMessengerPackageAndOpen() {
    if (parsedOrderQuantity < 12) {
      setOrderError("ขั้นต่ำในการสั่งผลิต 12 ชิ้น");
      return;
    }
    if (parsedOrderQuantity > 1000) {
      setOrderError("จำนวนมากกว่า 1,000 ชิ้น กรุณาติดต่อเพื่อขอราคา");
      return;
    }
    if (!pricing.pricingReady) {
      setOrderError(pricing.message || "ไม่สามารถคำนวณราคาได้");
      return;
    }

    // TEXT-ONLY TEST MODE
    // ยังไม่สร้าง/อัปโหลด PNG หรือ PDF เพื่อแยกทดสอบ Messenger API ก่อน
    setMessengerPackageBusy(true);
    setOrderError("");
    setMessengerPackageStatus("กำลังเปิดแชต Adsawin Thailand สำหรับทดสอบข้อความ...");

    try {
      const configStatus = await readMessengerConfigStatus();
      if (!configStatus.configured) {
        const missingText = configStatus.missing.join(", ");
        throw new Error(`ยังเชื่อม Meta Messenger ไม่ครบ\nขาด: ${missingText}`);
      }

      // คัดลอกคำทดสอบไว้ให้ paste ได้ทันที
      try {
        await copyMessengerSummary("ทดสอบ");
      } catch {
        // ไม่ให้ clipboard failure ขวางการเปิดแชต
      }

      setMessengerPackageStatus(
        "เปิดแชตแล้ว • กรุณาพิมพ์หรือวางคำว่า “ทดสอบ” แล้วกดส่ง 1 ครั้ง"
      );

      // ใช้ Facebook Messages โดยตรง เพื่อใช้ session Facebook ที่ล็อกอินอยู่แล้ว
      window.open(MESSENGER_DESKTOP_FALLBACK_URL, "_blank", "noopener,noreferrer");
    } catch (error) {
      const message = error instanceof Error
        ? (error.name === "AbortError" ? "ตรวจสอบ Meta Messenger ใช้เวลานานเกินไป กรุณาลองใหม่" : error.message)
        : "เปิด Messenger ไม่สำเร็จ";
      setMessengerPackageStatus("");
      setOrderError(message);
    } finally {
      setMessengerPackageBusy(false);
    }
  }

  function validateDirectOrderForm() {
    if (parsedOrderQuantity < 12) return "ขั้นต่ำในการสั่งผลิต 12 ชิ้น";
    if (parsedOrderQuantity > 1000) return "จำนวนมากกว่า 1,000 ชิ้น กรุณาติดต่อเพื่อขอราคา";
    if (!pricing.pricingReady) return pricing.message || "ไม่สามารถคำนวณราคาได้";
    if (!customerInfo.name.trim()) return "กรุณากรอกชื่อผู้ติดต่อ";
    if (!customerInfo.phone.trim()) return "กรุณากรอกเบอร์โทรผู้ติดต่อ";
    if (!customerInfo.lineOrEmail.trim()) return "กรุณากรอก Messenger หรือ Email สำหรับติดต่อกลับ";
    if (!shippingInfo.recipientName.trim()) return "กรุณากรอกชื่อผู้รับ";
    if (!shippingInfo.phone.trim()) return "กรุณากรอกเบอร์โทรผู้รับ";
    if (!shippingInfo.address.trim()) return "กรุณากรอกที่อยู่จัดส่ง";
    if (!shippingInfo.postalCode.trim()) return "กรุณากรอกรหัสไปรษณีย์";
    if (!orderConfirmed) return "กรุณาติ๊กยืนยันข้อมูลก่อนสั่งผลิต";
    return "";
  }

  async function refreshMessengerTopRightPreview() {
    if (messengerTopRightLoadingRef.current) return;

    const currentSignature = orderDesignSignature;
    if (
      messengerTopRightPreview &&
      messengerTopRightSignatureRef.current === currentSignature
    ) {
      return;
    }

    // ถ้า Step 5 มีภาพมุมบนเอียงขวาของดีไซน์ปัจจุบันอยู่แล้ว ใช้ภาพนั้นทันที
    // เพื่อไม่ต้อง Render ซ้ำแม้แต่ตอนเข้า Step 6
    if (!messengerTopRightSignatureRef.current && viewPreviewMap.topRight) {
      setMessengerTopRightPreview(viewPreviewMap.topRight);
      messengerTopRightSignatureRef.current = currentSignature;
      setMessengerTopRightPreviewError("");
      return;
    }

    const render = renderRef.current;
    if (!render) {
      setMessengerTopRightPreview("");
      setMessengerTopRightPreviewError("โมเดล Mockup ยังไม่พร้อมสำหรับภาพมุมบนเอียงขวา");
      return;
    }

    messengerTopRightLoadingRef.current = true;
    setMessengerTopRightPreviewLoading(true);
    setMessengerTopRightPreviewError("");

    try {
      // สร้างล่วงหน้าใน Step 6 เพื่อให้ปุ่ม Messenger ทำหน้าที่ส่งอย่างเดียว
      // 1000x1000 เพียงพอสำหรับแชตและ PDF และเบากว่า render 1400/1800 ขณะกดส่ง
      const src = await renderWithTimeout(
        render({
          transparent: false,
          view: "topRight",
          download: false,
          width: 1000,
          height: 1000,
          filename: `plug-${selectedPlugId}-top-right-messenger-preview.png`,
        }),
        30_000,
        "เตรียมภาพมุมบนเอียงขวาใช้เวลานานเกิน 30 วินาที กรุณากดรีเฟรชอีกครั้ง"
      );

      if (!src) {
        setMessengerTopRightPreview("");
        setMessengerTopRightPreviewError("เตรียมภาพมุมบนเอียงขวาไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
        return;
      }

      setMessengerTopRightPreview(src);
      messengerTopRightSignatureRef.current = currentSignature;
      setViewPreviewMap((prev) => ({ ...prev, topRight: src }));
    } catch (error) {
      setMessengerTopRightPreview("");
      setMessengerTopRightPreviewError(
        error instanceof Error ? error.message : "เตรียมภาพมุมบนเอียงขวาไม่สำเร็จ"
      );
    } finally {
      messengerTopRightLoadingRef.current = false;
      setMessengerTopRightPreviewLoading(false);
    }
  }

  async function refreshProductionOrderPreview() {
    const render = productionRenderRef.current;
    if (!render) {
      setProductionReady(false);
      setProductionOrderPreview("");
      setOrderError("โมเดลไฟล์ผลิตยังไม่พร้อม กรุณารอให้จอไฟล์ผลิตโหลดเสร็จแล้วลองอีกครั้ง");
      return;
    }

    setProductionOrderPreviewLoading(true);
    setOrderError("");

    try {
      const src = await render({
        transparent: true,
        view: "top",
        download: false,
        width: 1600,
        height: 1600,
        filename: `plug-${selectedPlugId}-production-preview.png`,
      });

      if (!src) {
        setProductionOrderPreview("");
        setOrderError("สร้างตัวอย่างไฟล์ผลิตไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
        return;
      }

      setProductionReady(true);
      setProductionOrderPreview(src);
    } finally {
      setProductionOrderPreviewLoading(false);
    }
  }

  async function confirmProductionOrder() {
    const validationMessage = validateDirectOrderForm();
    if (validationMessage) {
      setOrderError(validationMessage);
      return;
    }

    const render = productionRenderRef.current;
    if (!render) {
      setProductionReady(false);
      setOrderError("ยังไม่สามารถสร้างไฟล์ผลิตได้ เพราะโมเดล Production ยังไม่พร้อม");
      return;
    }

    setOrderBusy(true);
    setOrderError("");

    try {
      const orderId = createOrderId();
      const productionFileName = `${orderId}-${selectedPlugId}-production.png`;
      const productionSrc = await render({
        transparent: true,
        view: "top",
        download: false,
        width: 3000,
        height: 3000,
        filename: productionFileName,
      });

      if (!productionSrc) {
        setOrderError("สร้างไฟล์ผลิตไม่สำเร็จ ระบบจะไม่ยืนยันแบบจนกว่าจะสร้างไฟล์ได้สำเร็จ");
        return;
      }

      const snapshot: ProductionOrderSnapshot = {
        orderId,
        createdAt: new Date().toISOString(),
        designSignature: orderDesignSignature,
        plugId: selectedPlugId,
        plugName: plug.name ?? selectedPlugId,
        quantity: parsedOrderQuantity,
        note: orderNote.trim(),
        colors: { ...safeColors },
        pattern: {
          url: customization.patternUrl,
          transform: { ...patternTransform },
          rotation: patternRotation,
        },
        logos: logos.map((logo) => ({
          ...logo,
          transform: { ...logo.transform },
        })),
        productionFileName,
        productionSize: { width: 3000, height: 3000 },
        pricing: { ...pricing },
        contact: { ...customerInfo },
        shipping: { ...shippingInfo },
        paymentMethod,
        flow: "direct-order",
      };

      setOrderSnapshot(snapshot);
      setProductionOrderPreview(productionSrc);
      downloadDataUrl(productionSrc, productionFileName);
    } finally {
      setOrderBusy(false);
    }
  }

  function downloadOrderSnapshot() {
    if (!orderSnapshot) return;

    const blob = new Blob([JSON.stringify(orderSnapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${orderSnapshot.orderId}-order.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function patchCustomization(patch: Partial<CustomizationState>) {
    setCustomization((s) => {
      const next = { ...s, ...patch };
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
      bottomColor: currentColorOptions.bottom[0]?.value ?? "#eaeaea",
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
        const src = viewPreviewMap[item.key] ?? await buildInlinePreview(item.key);

        return {
          label: item.label,
          src,
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
      `สีบน: ${getColorLabel(
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

  async function downloadViewImage(view: RenderViewName, filename?: string) {
    const render = renderRef.current;
    if (!render) return;

    // ดาวน์โหลดเป็น PNG พื้นหลังโปร่ง แต่ใช้มุมเดียวกับภาพตัวอย่างด้านล่าง
    // ห้ามหมุน top เพิ่ม ไม่อย่างนั้นไฟล์ที่ดาวน์โหลดจะกลับหัวไม่ตรง preview
    const src = await render({
      transparent: true,
      view,
      download: false,
      filename: filename ?? `plug-${selectedPlugId}-${view}.png`,
    });

    if (!src) return;

    const link = document.createElement("a");
    link.href = src;
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
    return src;
  }

  async function refreshInlinePreviews() {
    const render = renderRef.current;
    if (!render) return;

    setViewPreviewLoading(true);

    try {
      const pairs = await Promise.all(
        INLINE_PREVIEW_VIEWS.map(async (item) => [item.key, await buildInlinePreview(item.key)] as const)
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
    // TYPE-1, TYPE-2, TYPE-3, TYPE-4 และ TYPE-5: ดาวน์โหลดจากจอเล็ก “ไฟล์ผลิต” โดยตรง
    // ใช้วิธีเดียวกับปุ่มโหลดภาพมุมบน แต่เปลี่ยนต้นทางเป็น productionRenderRef
    // ไม่อิงจอใหญ่ ไม่สร้างลาย/โลโก้ซ้ำ และไม่ผ่านระบบ Canvas ทำไฟล์ผลิตเดิม
    if (
      selectedPlugId === "TYPE-1" ||
      selectedPlugId === "TYPE-2" ||
      selectedPlugId === "TYPE-3" ||
      selectedPlugId === "TYPE-4" ||
      selectedPlugId === "TYPE-5"
    ) {
      const render = productionRenderRef.current;
      if (!render) return;

      const src = await render({
        transparent: true,
        view: "top",
        download: false,
        width: 3000,
        height: 3000,
        filename: `plug-${selectedPlugId}-production-top.png`,
      });

      if (!src) return;

      const link = document.createElement("a");
      link.href = src;
      link.download = `plug-${selectedPlugId}-production-top.png`;
      link.click();
      return;
    }

    // TYPE อื่นคงระบบไฟล์ผลิตเดิมไว้ ไม่แก้ส่วนที่ไม่เกี่ยวข้อง
    const render = productionRenderRef.current ?? renderRef.current;
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
        bottomColor: ensureAllowedColor(s.bottomColor, nextOptions.bottom),
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
    productionRenderRef.current = null;
    setProductionReady(false);
    setProductionOrderPreview("");
    setMessengerTopRightPreview("");
    setMessengerTopRightPreviewLoading(false);
    setMessengerTopRightPreviewError("");
    messengerTopRightSignatureRef.current = "";
    messengerTopRightLoadingRef.current = false;
    setOrderSnapshot(null);
    setOrderConfirmed(false);
    setOrderError("");
    // ไม่เด้งไปขั้นตอนอื่นอัตโนมัติ ให้ลูกค้ากดถัดไปเอง
  }

  function scrollToMobileStep(stepId: StepId) {
    if (!isMobileLayout || typeof window === "undefined") return;

    const run = () => {
      const el = document.getElementById(`mobile-step-item-${stepId}`);
      if (!el) return;

      const stickyPreview = document.querySelector<HTMLElement>(".left-panel");
      const stickyHeight = stickyPreview?.getBoundingClientRect().height ?? 0;
      const safeGap = 14;
      const targetY = Math.max(
        0,
        el.getBoundingClientRect().top + window.scrollY - stickyHeight - safeGap
      );

      window.scrollTo({
        top: targetY,
        behavior: "smooth",
      });
    };

    // เรียก 2 จังหวะ: หลัง React render และหลัง panel ขยาย เพื่อไม่ให้หัวข้อเด้งไปซ่อนใต้กล่อง Preview/Status บนมือถือ
    window.requestAnimationFrame(() => {
      run();
      window.setTimeout(run, 220);
    });
  }

  function clearDragModes() {
    setDragLogoMode(false);
    setDragPatternMode(false);
  }

  function changeStep(nextStep: StepId) {
    if (nextStep !== step) {
      clearDragModes();
    }

    setStep(nextStep);
  }

  function goNext() {
    const next = STEPS[currentStepIdx + 1]?.id;
    if (next) {
      changeStep(next);
      if (isMobileLayout) {
        setMobileAccordionOpen(true);
        scrollToMobileStep(next);
      }
    }
  }

  function goBack() {
    const prev = STEPS[currentStepIdx - 1]?.id;
    if (prev) {
      changeStep(prev);
      if (isMobileLayout) {
        setMobileAccordionOpen(true);
        scrollToMobileStep(prev);
      }
    }
  }

  function handleStepButtonClick(stepId: StepId) {
    const isSameStep = stepId === step;

    if (isMobileLayout) {
      if (isSameStep) {
        setMobileAccordionOpen(!mobileAccordionOpen);
      } else {
        changeStep(stepId);
        setMobileAccordionOpen(true);
      }

      scrollToMobileStep(stepId);
      return;
    }

    changeStep(stepId);
  }

  function renderStepNavButtons() {
    return (
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
            {currentStepIdx === STEPS.length - 2 ? "ตรวจแบบ & สั่งผลิต →" : "ถัดไป →"}
          </button>
        </div>
      </div>
    );
  }

  function renderViewButtonSelector(extraClass = "") {
    return (
      <div
        className={`viewUnderPreview ${extraClass}`.trim()}
        aria-label="ปุ่มเลือกมุมมอง"
      >
        <div className="viewUnderPreviewHead">
          <div>
            <div className="viewUnderTitle">มุมมอง</div>
          </div>
          <span className="viewUnderCurrent">
            {VIEW_BUTTONS.find((item) => item.key === customization.view)?.label ?? "มุมปัจจุบัน"}
          </span>
        </div>

        <div className="viewUnderGrid">
          {VIEW_BUTTONS.map((item) => {
            const active = customization.view === item.key;

            return (
              <button
                key={item.key}
                type="button"
                className={`viewUnderBtn${active ? " active" : ""}`}
                style={{
                  background: active ? item.gradient : item.soft,
                }}
                onClick={() => patchCustomization({ view: item.key })}
                title={`เลือก${item.label}`}
              >
                <span className="viewUnderIcon">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
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
              options={currentColorOptions.top}
              onColorChange={(c) => patchCustomization({ topColor: c })}
              allowCustom
            />

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
              checked={step === "pattern" && dragPatternMode}
              disabled={!hasPattern}
              onChange={(e) => {
                const checked = e.target.checked;
                setDragPatternMode(checked);
                if (checked) setDragLogoMode(false);
              }}
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
              checked={step === "logo" && dragLogoMode}
              disabled={!activeLogo.url}
              onChange={(e) => {
                const checked = e.target.checked;
                setDragLogoMode(checked);
                if (checked) setDragPatternMode(false);
              }}
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

    if (step === "order") {
      const topLabel = getColorLabel(
        safeColors.top ?? customization.topColor,
        currentColorOptions.top
      );
      const bottomLabel = getColorLabel(
        safeColors.bottom ?? customization.bottomColor,
        currentColorOptions.bottom
      );
      const switchLabel = showQuickSwitch
        ? getColorLabel(
            safeColors.switch ?? customization.switchColor,
            currentColorOptions.switch ?? currentColorOptions.top
          )
        : "-";

      return (
        <div className="orderStep">
          <div className="orderFlowIntro">
            <div>
              <div className="label">ขั้นตอนสุดท้ายหลัง Mockup เสร็จ</div>
              <div className="hint">Flow นี้ทำตามภาพตัวอย่าง: เลือกจำนวน → คำนวณราคา → เลือกว่าจะสั่งผลิตเลยหรือคุยต่อใน Facebook Messenger</div>
            </div>
            <span className={`orderReadyBadge ${productionReady ? "ready" : "waiting"}`}>
              {productionReady ? "Production พร้อม" : "กำลังรอ Production"}
            </span>
          </div>

          <div className="orderPreviewCard">
            <div className="orderPreviewTitle">Mockup / Production Preview</div>
            <div className="orderPreviewStage">
              {productionOrderPreview ? (
                <img src={productionOrderPreview} alt="Production preview" className="orderPreviewImage" />
              ) : (
                <div className="orderPreviewEmpty">
                  {productionOrderPreviewLoading ? "กำลังสร้างตัวอย่างไฟล์ผลิต..." : "ยังไม่มีตัวอย่างไฟล์ผลิต"}
                </div>
              )}
            </div>
            <div className="orderPreviewActions">
              <button
                type="button"
                className="btn btnGhost"
                onClick={() => void refreshProductionOrderPreview()}
                disabled={productionOrderPreviewLoading}
              >
                {productionOrderPreviewLoading ? "กำลังสร้าง..." : "รีเฟรชตัวอย่างไฟล์ผลิต"}
              </button>
            </div>
          </div>

          <div className="orderSummaryGrid">
            <div className="orderSummaryItem"><span>รุ่น</span><strong>{plug.name ?? selectedPlugId}</strong><small>{selectedPlugId}</small></div>
            <div className="orderSummaryItem"><span>สีฝาบน</span><strong>{topLabel}</strong><small>{safeColors.top ?? customization.topColor}</small></div>
            <div className="orderSummaryItem"><span>สีฝาล่าง</span><strong>{bottomLabel}</strong><small>{safeColors.bottom ?? customization.bottomColor}</small></div>
            {showQuickSwitch && (
              <div className="orderSummaryItem"><span>สีสวิตช์</span><strong>{switchLabel}</strong><small>{safeColors.switch ?? customization.switchColor}</small></div>
            )}
            <div className="orderSummaryItem"><span>ลวดลาย</span><strong>{hasPattern ? "มีลาย" : "ไม่มีลาย"}</strong><small>{hasPattern ? `Zoom ${patternTransform.zoom.toFixed(2)} • ${rotationDeg}°` : "สีพื้น"}</small></div>
            <div className="orderSummaryItem"><span>โลโก้</span><strong>{logoCount} จุด</strong><small>{logoCount ? "ใช้ตำแหน่งจาก Mockup" : "ไม่มีโลโก้"}</small></div>
          </div>

          <div className="orderFlowCard">
            <div className="orderFlowStepTitle">1) เลือกจำนวน</div>
            <div className="orderQuantityRow">
              <label className="orderField orderFieldCompact">
                <span className="label">จำนวนผลิต</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={orderQuantity}
                  onChange={(e) => setOrderQuantity(e.target.value)}
                  className="orderInput"
                  inputMode="numeric"
                />
              </label>
              <div className="orderMiniHint">จำนวนนี้จะถูกใช้ทั้งในระบบคำนวณราคา, Messenger และคำสั่งผลิต</div>
            </div>
          </div>

          <div className="orderFlowCard">
            <div className="orderFlowStepTitle">2) ระบบคำนวณราคา</div>
            <div className="priceGrid">
              <div className="priceItem"><span>จำนวน</span><strong>{parsedOrderQuantity || 0} ชิ้น</strong></div>
              <div className="priceItem"><span>ช่วงราคา</span><strong>{pricing.pricingReady ? `${pricing.minQty}-${pricing.maxQty} ชิ้น` : "-"}</strong></div>
              <div className="priceItem"><span>ราคาต่อชิ้น</span><strong>{pricing.pricingReady ? formatPrice(pricing.unitPrice) : "-"}</strong></div>
              <div className="priceItem priceItemTotal"><span>ราคารวม</span><strong>{pricing.pricingReady ? formatPrice(pricing.totalPrice) : pricing.message}</strong></div>
            </div>
            <div className="hint" style={{ marginTop: 8 }}>
              ระบบเลือกราคาต่อชิ้นอัตโนมัติตามรุ่นและจำนวนสั่งผลิต • ขั้นต่ำ 12 ชิ้น • มากกว่า 1,000 ชิ้นให้ติดต่อขอราคา
            </div>
          </div>

          <div className="orderFlowCard">
            <div className="orderFlowStepTitle">3) ต้องการทำต่อ?</div>
            <div className="branchGrid">
              <button
                type="button"
                className={`branchCard ${continuationChoice === "order" ? "active" : ""}`}
                onClick={() => setContinuationChoice("order")}
              >
                <strong>สั่งผลิตเลย</strong>
                <span>กรอกข้อมูล → ชำระเงิน → ยืนยันสั่งผลิต</span>
              </button>
              <button
                type="button"
                className={`branchCard ${continuationChoice === "messenger" ? "active" : ""}`}
                onClick={() => setContinuationChoice("messenger")}
              >
                <strong>คุย Messenger</strong>
                <span>เปิด Facebook Messenger พร้อมข้อมูล Mockup / รุ่นสินค้า / จำนวน / ราคา</span>
              </button>
            </div>
          </div>

          {continuationChoice === "messenger" && (
            <div className="orderFlowCard messengerFlowCard">
              <div className="orderFlowStepTitle">คุย Facebook Messenger</div>
              <div className="messengerSummaryBox">
                <div className="messengerSummaryTitle">ข้อมูลสำหรับส่งใน Messenger</div>
                <pre className="messengerSummaryText">{messengerSummaryText}</pre>
              </div>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <button type="button" className="btn btnGhost" onClick={() => void copyMessengerSummary()}>
                  {messengerCopied ? "คัดลอกแล้ว ✓" : "คัดลอกข้อความ"}
                </button>
                <button
                  type="button"
                  className="btn btnPrimary"
                  disabled={
                    messengerPackageBusy ||
                    !pricing.pricingReady
                  }
                  onClick={() => void createMessengerPackageAndOpen()}
                >
                  {messengerPackageBusy ? "กำลังส่งข้อมูล..." : "ส่งรายละเอียดไป Messenger"}
                </button>
              </div>

              <div className="hint" style={{ marginTop: 8 }}>
                โหมดทดสอบข้อความอย่างเดียว: รอบนี้ระบบจะไม่สร้างหรืออัปโหลด PNG / PDF
                หลังเปิดแชต ให้พิมพ์คำว่า “ทดสอบ” แล้วกดส่ง 1 ครั้ง
              </div>

              {messengerPackageStatus && (
                <div className="messengerPackageStatus">{messengerPackageStatus}</div>
              )}

              {messengerPackageFiles && (
                <div className="messengerFileGrid">
                  <button type="button" className="btn btnGhost" onClick={() => downloadDataUrl(messengerPackageFiles.productionUrl, messengerPackageFiles.productionFileName)}>
                    ดาวน์โหลดไฟล์ผลิต
                  </button>
                  <button type="button" className="btn btnGhost" onClick={() => downloadDataUrl(messengerPackageFiles.topRightUrl, messengerPackageFiles.topRightFileName)}>
                    ดาวน์โหลดมุมบนเอียงขวา
                  </button>
                  <a className="btn btnGhost" href={messengerPackageFiles.pdfUrl} download={messengerPackageFiles.pdfFileName}>
                    ดาวน์โหลด PDF
                  </a>
                </div>
              )}

              <div className="hint" style={{ marginTop: 8 }}>
                Facebook Page: <strong>Adsawin Thailand</strong> • ระบบไม่ใช้ฐานข้อมูลและไม่เก็บไฟล์บนเว็บ เมื่อกดส่ง ระบบจะอัปโหลด PDF + ไฟล์ผลิต + ภาพมุมบนเอียงขวาเข้า Meta โดยตรง แล้วเปิด Messenger ด้วย ref แบบเซ็นลายเซ็น Webhook จะส่งข้อความ + รูป 2 รูป + PDF เข้าห้องแชต จากนั้นจบขั้นตอนและคุยงานต่อใน Messenger ได้เลย
              </div>
              <button type="button" className="btn btnGhost" style={{ marginTop: 8 }} onClick={openFacebookSessionFallback}>
                เปิด Facebook Messages ด้วยบัญชีที่ล็อกอินอยู่ (สำรอง)
              </button>
              <div className="hint" style={{ marginTop: 6 }}>
                ปุ่มสำรองด้านบนช่วยกรณี m.me ขอ Login ใหม่บนคอม แต่เป็นเพียงการเปิดแชต จึงจะไม่ส่งชุดไฟล์อัตโนมัติ
              </div>
            </div>
          )}

          {continuationChoice === "order" && (
            <div className="directOrderFlow">
              <div className="orderFlowCard">
                <div className="orderFlowStepTitle">4) กรอกข้อมูล</div>
                <label className="orderField orderFieldWide">
                  <span className="label">หมายเหตุถึงฝ่ายผลิต</span>
                  <textarea
                    value={orderNote}
                    onChange={(e) => setOrderNote(e.target.value)}
                    className="orderTextarea"
                    placeholder="เช่น ตรวจตำแหน่งโลโก้ก่อนขึ้นงานจริง / สีตามตัวอย่างที่ยืนยัน"
                    rows={3}
                  />
                </label>
              </div>

              <div className="orderFlowCard">
                <div className="orderFlowStepTitle">5) ข้อมูลผู้สั่ง</div>
                <div className="formGridTwo">
                  <label className="orderField">
                    <span className="label">ชื่อผู้ติดต่อ</span>
                    <input className="orderInput" value={customerInfo.name} onChange={(e) => updateCustomerInfo("name", e.target.value)} />
                  </label>
                  <label className="orderField">
                    <span className="label">เบอร์โทร</span>
                    <input className="orderInput" value={customerInfo.phone} onChange={(e) => updateCustomerInfo("phone", e.target.value)} />
                  </label>
                  <label className="orderField">
                    <span className="label">บริษัท</span>
                    <input className="orderInput" value={customerInfo.company} onChange={(e) => updateCustomerInfo("company", e.target.value)} />
                  </label>
                  <label className="orderField">
                    <span className="label">Messenger / Email</span>
                    <input className="orderInput" value={customerInfo.lineOrEmail} onChange={(e) => updateCustomerInfo("lineOrEmail", e.target.value)} />
                  </label>
                </div>
              </div>

              <div className="orderFlowCard">
                <div className="orderFlowStepTitle">6) ข้อมูลจัดส่ง</div>
                <div className="formGridTwo">
                  <label className="orderField">
                    <span className="label">ชื่อผู้รับ</span>
                    <input className="orderInput" value={shippingInfo.recipientName} onChange={(e) => updateShippingInfo("recipientName", e.target.value)} />
                  </label>
                  <label className="orderField">
                    <span className="label">เบอร์โทร</span>
                    <input className="orderInput" value={shippingInfo.phone} onChange={(e) => updateShippingInfo("phone", e.target.value)} />
                  </label>
                  <label className="orderField orderFieldWide">
                    <span className="label">ที่อยู่</span>
                    <textarea className="orderTextarea" value={shippingInfo.address} onChange={(e) => updateShippingInfo("address", e.target.value)} rows={3} />
                  </label>
                  <label className="orderField">
                    <span className="label">รหัสไปรษณีย์</span>
                    <input className="orderInput" value={shippingInfo.postalCode} onChange={(e) => updateShippingInfo("postalCode", e.target.value)} />
                  </label>
                </div>
              </div>

              <div className="orderFlowCard">
                <div className="orderFlowStepTitle">7) ชำระเงิน</div>
                <div className="paymentList">
                  <label className={`paymentCard ${paymentMethod === "contact-first" ? "active" : ""}`}>
                    <input type="radio" name="paymentMethod" checked={paymentMethod === "contact-first"} onChange={() => setPaymentMethod("contact-first")} />
                    <div><strong>ให้ทีมงานติดต่อกลับก่อน</strong><span>เหมาะกับการยืนยันราคา/ยอดโอนกับแอดมินก่อน</span></div>
                  </label>
                  <label className={`paymentCard ${paymentMethod === "bank-transfer" ? "active" : ""}`}>
                    <input type="radio" name="paymentMethod" checked={paymentMethod === "bank-transfer"} onChange={() => setPaymentMethod("bank-transfer")} />
                    <div><strong>โอนเงิน</strong><span>แนบข้อมูลชำระเงินหรือส่งสลิปภายหลังผ่านแอดมิน</span></div>
                  </label>
                  <label className={`paymentCard ${paymentMethod === "invoice" ? "active" : ""}`}>
                    <input type="radio" name="paymentMethod" checked={paymentMethod === "invoice"} onChange={() => setPaymentMethod("invoice")} />
                    <div><strong>ออกใบเสนอราคา / Invoice</strong><span>สำหรับลูกค้าองค์กรหรือบริษัท</span></div>
                  </label>
                </div>
              </div>

              <div className="orderFlowCard">
                <div className="orderFlowStepTitle">8) ยืนยันสั่งผลิต</div>
                <label className="orderConfirmBox">
                  <input
                    type="checkbox"
                    checked={orderConfirmed}
                    onChange={(e) => setOrderConfirmed(e.target.checked)}
                  />
                  <span>ฉันตรวจสอบ Mockup, รุ่นสินค้า, จำนวน, ราคา, ข้อมูลผู้สั่ง, ที่อยู่จัดส่ง และพร้อมยืนยันสั่งผลิตเรียบร้อยแล้ว</span>
                </label>

                {parsedOrderQuantity < 12 && (
                  <div className="orderError">ขั้นต่ำในการสั่งผลิต 12 ชิ้น</div>
                )}
                {parsedOrderQuantity > 1000 && (
                  <div className="orderError">จำนวนมากกว่า 1,000 ชิ้น กรุณาติดต่อเพื่อขอราคา</div>
                )}
                {orderError && <div className="orderError">{orderError}</div>}

                {!orderSnapshot ? (
                  <button
                    type="button"
                    className="btn btnPrimary orderSubmitBtn"
                    disabled={orderBusy || !productionReady || !pricing.pricingReady}
                    onClick={() => void confirmProductionOrder()}
                  >
                    {orderBusy ? "กำลังสร้างไฟล์ผลิต..." : "🏭 ยืนยันสั่งผลิต"}
                  </button>
                ) : (
                  <div className="orderSuccess">
                    <div className="orderSuccessTop">
                      <div>
                        <div className="orderSuccessTitle">✓ ORDER สำเร็จ</div>
                        <div className="orderSuccessId">Order ID: {orderSnapshot.orderId}</div>
                      </div>
                      <span className="orderReadyBadge ready">ยืนยันแล้ว</span>
                    </div>
                    <div className="orderSuccessMeta">
                      ไฟล์ผลิต: {orderSnapshot.productionFileName} • {orderSnapshot.productionSize.width}×{orderSnapshot.productionSize.height}px
                    </div>
                    <div className="orderSuccessMeta">
                      ยอดสั่งผลิต: {formatPrice(orderSnapshot.pricing.totalPrice)} • วิธีชำระเงิน: {paymentMethod === "bank-transfer" ? "โอนเงิน" : paymentMethod === "invoice" ? "Invoice" : "ให้ทีมงานติดต่อกลับก่อน"}
                    </div>
                    <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="btn btnPrimary"
                        onClick={() => downloadDataUrl(productionOrderPreview, orderSnapshot.productionFileName)}
                        disabled={!productionOrderPreview}
                      >
                        ดาวน์โหลดไฟล์ผลิตอีกครั้ง
                      </button>
                      <button type="button" className="btn btnGhost" onClick={downloadOrderSnapshot}>
                        ดาวน์โหลดข้อมูลใบงาน JSON
                      </button>
                    </div>
                    <div className="trackProductionBox">
                      <div className="trackProductionTitle">9) ติดตามการผลิต</div>
                      <div className="trackProductionText">ใช้ Order ID นี้เพื่อติดตามสถานะการผลิตกับทีมงาน: <strong>{orderSnapshot.orderId}</strong></div>
                    </div>
                    <div className="orderSuccessHint">หากกลับไปแก้สี ลาย โลโก้ จำนวน ราคา หรือข้อมูลติดต่อ ระบบจะยกเลิก Snapshot นี้และต้องยืนยันใหม่</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div>
        {!isMobileLayout && (
          <>
            <div className="label">มุมมอง</div>
            <div className="hint">เลือกมุมมองสำหรับโชว์/ดาวน์โหลด</div>
          </>
        )}

        <div style={{ marginTop: isMobileLayout ? 0 : 10 }}>
          <LayoutPreview
            view={customization.view}
            onSetView={(v) => patchCustomization({ view: v })}
            onDownload={() => {
              void downloadViewImage(
                customization.view,
                `plug-${selectedPlugId}-${customization.view}.png`
              );
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
            {INLINE_PREVIEW_VIEWS.map((item) => {
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
                  dragLogoMode={step === "logo" && dragLogoMode && activeLogo.url !== ""}
                  dragPatternMode={step === "pattern" && dragPatternMode && hasPattern}
                  view={customization.view}
                  orbitNudgeDirection={orbitNudgeDirection}
                  orbitNudgeTick={orbitNudgeTick}
                  onRenderReady={(render) => {
                    renderRef.current = render;
                  }}
                />

                <div className="productionPreviewInset" aria-label="โมเดลสำหรับ Export ส่งผลิต">
                  <div className="productionPreviewHead">
                    <span>ไฟล์ผลิต</span>
                    <span className="productionPreviewDot" aria-hidden="true" />
                  </div>
                  <div className="productionPreviewCanvas">
                    <Plug3D
                      key={productionPlugConfig.modelPath}
                      config={productionPlugConfig}
                      logos={logos}
                      activeLogoId={activeLogoId}
                      patternUrl={customization.patternUrl}
                      patternTransform={patternTransform}
                      patternRotation={patternRotation}
                      colors={safeColors}
                      view="top"
                      renderMode
                      onRenderReady={(render) => {
                        productionRenderRef.current = render;
                        setProductionReady(true);
                      }}
                    />
                  </div>
                </div>

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

              {/* ✅ จอใหญ่ยังโชว์ปุ่มมุมมองใต้ภาพ 3D / จอเล็กให้ปุ่มเด้งไปต่อท้าย Accordion หมวด 5) มุมมอง */}
              {!isMobileLayout && renderViewButtonSelector()}

              <div className="row" style={{ marginTop: 10, justifyContent: "space-between" }}>
                <div className="row">
                  <span className="badgeSoft">รุ่น: {plug.name ?? selectedPlugId}</span>
                  <span className="badgeSoft">Step: {currentStepIdx + 1}/{STEPS.length}</span>
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
                    <button type="button" className="btn btnGhost" onClick={() => changeStep("logo")}>
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
                      {plug.name ?? selectedPlugId} • {showQuickSwitch ? "3 ส่วน" : "2 ส่วน"}
                    </span>
                  </div>

                  <div
                    className={`qa-colorGrid ${quickColorCount === 1 ? "single" : ""} ${quickColorCount === 2 ? "double" : ""} ${quickColorCount === 3 ? "triple" : ""}`}
                  >
                    {renderQuickColorCard({
                      label: "ฝาบน",
                      sub: "ส่วนบนของตัวปลั๊ก",
                      value: customization.topColor,
                      fallback: currentColorOptions.top[0]?.value ?? "#ffffff",
                      onChange: (color) => patchCustomization({ topColor: color }),
                      onReset: () =>
                        patchCustomization({
                          topColor: currentColorOptions.top[0]?.value ?? "#ffffff",
                        }),
                      title: "เลือกสีฝาบน",
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
                        sub: "ปรับสีสวิตช์แยกตามรุ่นที่รองรับ",
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
                  const accordionOpen = active && mobileAccordionOpen;

                  return (
                    <div
                      key={s.id}
                      id={isMobileLayout ? `mobile-step-item-${s.id}` : undefined}
                      className={`stepAccordionItem ${accordionOpen ? "accordionOpen" : ""}`}
                    >
                      <button
                        type="button"
                        className={`stepItem ${active ? "stepActive" : ""} ${done ? "stepDone" : ""}`}
                        onClick={() => handleStepButtonClick(s.id)}
                        aria-expanded={isMobileLayout ? accordionOpen : undefined}
                        aria-controls={isMobileLayout ? `mobile-step-panel-${s.id}` : undefined}
                      >
                        <span className="stepDot">{done ? "✓" : idx + 1}</span>
                        <span className="stepText">
                          <span>{s.title}</span>
                          <small>{s.sub}</small>
                        </span>
                        {isMobileLayout && (
                          <span className="stepChevron" aria-hidden="true">
                            {accordionOpen ? "⌃" : "⌄"}
                          </span>
                        )}
                      </button>

                      {isMobileLayout && s.id === "view" && (
                        <div className="mobileViewAppendSlot">
                          {renderViewButtonSelector("mobileViewAccordionSelector")}
                        </div>
                      )}

                      {isMobileLayout && active && (
                        <div
                          id={`mobile-step-panel-${s.id}`}
                          className={`mobileStepPanel ${accordionOpen ? "open" : "closed"}`}
                        >
                          <div className="mobileStepPanelInner">
                            {renderStepContent()}
                            {renderStepNavButtons()}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {!isMobileLayout && (
                <>
                  <div className="config-divider" />

                  <div className="config-content">
                    <div style={{ flex: 1, overflowY: "auto", paddingRight: 6 }}>
                      {renderStepContent()}
                    </div>

                    {renderStepNavButtons()}
                  </div>
                </>
              )}
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
  height: auto;
  min-height: 100vh;
  overflow: auto;
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
  height: auto;
  min-height: 0;
  overflow: visible;
  padding-right: 4px;
}

.left-card-top{
  display: flex;
  flex-direction: column;
  flex: 0 0 auto;
  min-height: 0;
}

.mock{
  flex: 0 0 auto;
  width: 100%;
  height: clamp(300px, 42vh, 470px);
  min-height: 300px;
  max-height: 470px;
  border-radius: 24px;
  background: linear-gradient(180deg, #dff7ff, #fff4fb 48%, #f4fff2);
  border: 1px solid rgba(255,255,255,.72);
  overflow: hidden;
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

.stepAccordionItem{
  display:grid;
  gap:8px;
}

.stepItem{
  display: flex;
  align-items: center;
  gap: 10px;
  width:100%;
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
  flex:1;
  min-width:0;
  display:grid;
  gap:2px;
  font-weight: 900;
  font-size: 12.5px;
  color: #0f172a;
}

.stepText small{
  display:none;
  font-size:11px;
  line-height:1.25;
  font-weight:800;
  color:#64748b;
}

.stepChevron{
  display:none;
}

.mobileStepPanel{
  display:none;
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

.viewUnderPreview{
  /* ✅ ขยับแถบปุ่มมุมมองใต้ภาพ 3D ให้ขึ้นใกล้กรอบพรีวิวมากขึ้น */
  margin-top:2px;
  padding:9px 10px;
  border-radius:20px;
  background:rgba(255,255,255,.80);
  border:1px solid rgba(226,232,240,.92);
  box-shadow:0 10px 24px rgba(15,23,42,.08);
  backdrop-filter:blur(12px);
  -webkit-backdrop-filter:blur(12px);
}

.viewUnderPreviewHead{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  margin-bottom:6px;
}

.viewUnderTitle{
  font-size:13px;
  font-weight:950;
  color:#334155;
  line-height:1.2;
}

.viewUnderHint{
  margin-top:2px;
  font-size:11px;
  font-weight:750;
  color:#64748b;
}

.viewUnderCurrent{
  flex:0 0 auto;
  padding:5px 9px;
  border-radius:999px;
  background:#eef2ff;
  color:#4338ca;
  font-size:11px;
  font-weight:950;
  white-space:nowrap;
}

.viewUnderGrid{
  display:grid;
  grid-template-columns:repeat(3, minmax(0, 1fr));
  gap:7px;
}

.viewUnderBtn{
  min-height:40px;
  border:1px solid rgba(255,255,255,.65);
  border-radius:16px;
  color:#ffffff;
  cursor:pointer;
  font-size:12px;
  font-weight:950;
  line-height:1.15;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:6px;
  box-shadow:0 8px 18px rgba(15,23,42,.11);
  transition:transform .12s ease, box-shadow .16s ease, filter .16s ease;
  -webkit-tap-highlight-color:transparent;
}

.viewUnderBtn.active{
  border:2px solid rgba(255,255,255,.95);
  box-shadow:0 12px 26px rgba(15,23,42,.18);
}

.viewUnderBtn:hover{
  filter:saturate(1.05) brightness(1.02);
  box-shadow:0 12px 24px rgba(15,23,42,.16);
}

.viewUnderBtn:active{
  transform:scale(.97);
}

.viewUnderIcon{
  display:inline-grid;
  place-items:center;
  min-width:16px;
}

.mockWithOverlay{
  position:relative;
}

.orderStep{
  display:flex;
  flex-direction:column;
  gap:14px;
}
.orderFlowIntro,
.orderStepHead{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:12px;
}
.orderReadyBadge{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  min-height:28px;
  padding:5px 10px;
  border-radius:999px;
  font-size:12px;
  font-weight:800;
  white-space:nowrap;
}
.orderReadyBadge.ready{
  color:#166534;
  background:#dcfce7;
  border:1px solid #bbf7d0;
}
.orderReadyBadge.waiting{
  color:#92400e;
  background:#fef3c7;
  border:1px solid #fde68a;
}
.orderPreviewCard,
.orderFlowCard{
  border:1px solid #dbe3ee;
  border-radius:16px;
  overflow:hidden;
  background:#fff;
}
.orderFlowCard{
  padding:14px;
}
.orderFlowStepTitle{
  font-size:14px;
  font-weight:900;
  color:#0f172a;
  margin-bottom:10px;
}
.orderPreviewTitle{
  padding:10px 12px;
  font-size:13px;
  font-weight:800;
  color:#334155;
  background:#f8fafc;
  border-bottom:1px solid #e5e7eb;
}
.orderPreviewStage{
  min-height:220px;
  display:flex;
  align-items:center;
  justify-content:center;
  padding:12px;
  background:linear-gradient(135deg,#f8fafc,#eef2f7);
}
.orderPreviewImage{
  display:block;
  width:100%;
  max-height:320px;
  object-fit:contain;
}
.orderPreviewEmpty{
  min-height:190px;
  display:flex;
  align-items:center;
  justify-content:center;
  text-align:center;
  color:#64748b;
  font-size:13px;
}
.orderPreviewActions{
  display:flex;
  justify-content:flex-end;
  padding:10px 12px;
  border-top:1px solid #e5e7eb;
}
.orderSummaryGrid{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:10px;
}
.orderSummaryItem{
  padding:11px 12px;
  border:1px solid #e2e8f0;
  border-radius:12px;
  background:#fff;
}
.orderSummaryItem span,
.orderSummaryItem strong,
.orderSummaryItem small{
  display:block;
}
.orderSummaryItem span{
  color:#64748b;
  font-size:11px;
  font-weight:700;
}
.orderSummaryItem strong{
  margin-top:3px;
  color:#0f172a;
  font-size:14px;
}
.orderSummaryItem small{
  margin-top:2px;
  color:#94a3b8;
  font-size:11px;
}
.orderQuantityRow{
  display:grid;
  grid-template-columns:minmax(180px, 260px) minmax(0,1fr);
  gap:12px;
  align-items:end;
}
.orderMiniHint{
  min-height:42px;
  display:flex;
  align-items:center;
  color:#64748b;
  font-size:12px;
  line-height:1.45;
}
.priceGrid{
  display:grid;
  grid-template-columns:repeat(4,minmax(0,1fr));
  gap:10px;
}
.priceItem{
  padding:12px;
  border:1px solid #e2e8f0;
  border-radius:12px;
  background:#f8fafc;
}
.priceItem span,
.priceItem strong{
  display:block;
}
.priceItem span{
  color:#64748b;
  font-size:11px;
  font-weight:700;
}
.priceItem strong{
  margin-top:4px;
  color:#0f172a;
  font-size:14px;
}
.priceItemTotal{
  background:#ecfeff;
  border-color:#a5f3fc;
}
.branchGrid{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:12px;
}
.branchCard{
  text-align:left;
  border:1px solid #dbe3ee;
  border-radius:14px;
  background:#fff;
  padding:14px;
  display:flex;
  flex-direction:column;
  gap:6px;
  cursor:pointer;
  transition:all .18s ease;
}
.branchCard strong{
  font-size:14px;
  color:#0f172a;
}
.branchCard span{
  font-size:12px;
  color:#64748b;
  line-height:1.5;
}
.branchCard.active{
  border-color:#3b82f6;
  background:rgba(59,130,246,.06);
  box-shadow:0 0 0 3px rgba(59,130,246,.08);
}
.messengerFlowCard{
  background:#f8fafc;
}
.messengerSummaryBox{
  border:1px dashed #cbd5e1;
  border-radius:12px;
  background:#fff;
  padding:12px;
  margin-bottom:10px;
}
.messengerSummaryTitle{
  font-size:12px;
  font-weight:800;
  color:#334155;
  margin-bottom:8px;
}
.messengerSummaryText{
  margin:0;
  white-space:pre-wrap;
  word-break:break-word;
  color:#0f172a;
  font-size:13px;
  line-height:1.6;
  font-family:inherit;
}
.messengerPackageStatus{
  margin-top:10px;
  padding:10px 12px;
  border-radius:12px;
  border:1px solid #bfdbfe;
  background:#eff6ff;
  color:#1e40af;
  font-size:12px;
  font-weight:800;
  line-height:1.45;
}
.messengerFileGrid{
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:8px;
  margin-top:10px;
}
.messengerFileGrid .btn{
  text-decoration:none;
  justify-content:center;
  text-align:center;
}

.directOrderFlow{
  display:flex;
  flex-direction:column;
  gap:14px;
}
.formGridTwo{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:12px;
}
.orderField{
  display:flex;
  flex-direction:column;
  gap:7px;
}
.orderFieldCompact{
  max-width:220px;
}
.orderFieldWide{
  grid-column:1 / -1;
}
.orderInput,
.orderTextarea{
  width:100%;
  box-sizing:border-box;
  border:1px solid #cbd5e1;
  border-radius:12px;
  background:#fff;
  color:#0f172a;
  font:inherit;
  outline:none;
}
.orderInput{
  height:42px;
  padding:0 12px;
}
.orderTextarea{
  min-height:82px;
  padding:10px 12px;
  resize:vertical;
}
.orderInput:focus,
.orderTextarea:focus{
  border-color:#94a3b8;
  box-shadow:0 0 0 3px rgba(148,163,184,.16);
}
.paymentList{
  display:grid;
  gap:10px;
}
.paymentCard{
  display:grid;
  grid-template-columns:18px minmax(0,1fr);
  gap:10px;
  align-items:flex-start;
  padding:12px;
  border:1px solid #dbe3ee;
  border-radius:12px;
  background:#fff;
  cursor:pointer;
}
.paymentCard.active{
  border-color:#3b82f6;
  background:rgba(59,130,246,.05);
}
.paymentCard strong,
.paymentCard span{
  display:block;
}
.paymentCard strong{
  color:#0f172a;
  font-size:13px;
}
.paymentCard span{
  margin-top:3px;
  color:#64748b;
  font-size:12px;
  line-height:1.45;
}
.orderConfirmBox{
  display:flex;
  align-items:flex-start;
  gap:9px;
  padding:12px;
  border:1px solid #cbd5e1;
  border-radius:12px;
  background:#f8fafc;
  color:#334155;
  font-size:13px;
  line-height:1.45;
}
.orderConfirmBox input{
  margin-top:2px;
  width:17px;
  height:17px;
  flex:0 0 auto;
}
.orderError{
  margin-top:10px;
  padding:10px 12px;
  border-radius:10px;
  border:1px solid #fecaca;
  background:#fef2f2;
  color:#b91c1c;
  font-size:12px;
  font-weight:700;
}
.orderSubmitBtn{
  width:100%;
  min-height:44px;
  margin-top:12px;
}
.orderSuccess{
  padding:14px;
  border:1px solid #bbf7d0;
  border-radius:14px;
  background:#f0fdf4;
  margin-top:12px;
}
.orderSuccessTop{
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  gap:10px;
}
.orderSuccessTitle{
  color:#166534;
  font-weight:900;
  font-size:14px;
}
.orderSuccessId{
  margin-top:3px;
  color:#14532d;
  font-size:12px;
  font-weight:700;
  word-break:break-all;
}
.orderSuccessMeta{
  margin-top:9px;
  color:#3f6212;
  font-size:12px;
  word-break:break-word;
}
.trackProductionBox{
  margin-top:12px;
  padding:12px;
  border-radius:12px;
  border:1px dashed #86efac;
  background:#ffffff;
}
.trackProductionTitle{
  color:#166534;
  font-size:13px;
  font-weight:900;
}
.trackProductionText{
  margin-top:6px;
  color:#14532d;
  font-size:12px;
  line-height:1.5;
}
.orderSuccessHint{
  margin-top:10px;
  color:#4d7c0f;
  font-size:11px;
  line-height:1.45;
}

.productionPreviewInset{
  position:absolute;
  top:12px;
  right:12px;
  z-index:18;
  width:clamp(132px, 24%, 190px);
  aspect-ratio:1 / 1;
  display:flex;
  flex-direction:column;
  overflow:hidden;
  border-radius:18px;
  border:1px solid rgba(255,255,255,.92);
  background:rgba(255,255,255,.9);
  box-shadow:0 16px 34px rgba(15,23,42,.2);
  backdrop-filter:blur(10px);
  pointer-events:none;
}

.productionPreviewHead{
  height:30px;
  flex:0 0 30px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  padding:0 10px;
  color:#0f172a;
  font-size:11px;
  font-weight:900;
  letter-spacing:.02em;
  background:rgba(255,255,255,.94);
  border-bottom:1px solid rgba(226,232,240,.9);
}

.productionPreviewDot{
  width:8px;
  height:8px;
  border-radius:999px;
  background:#22c55e;
  box-shadow:0 0 0 3px rgba(34,197,94,.16);
}

.productionPreviewCanvas{
  flex:1;
  min-height:0;
  background:linear-gradient(180deg,#eef6ff,#ffffff);
}

.productionPreviewCanvas canvas{
  display:block;
  width:100% !important;
  height:100% !important;
}

.mobileOrbitOverlay,
.mobileOrbitBar{
  display:none;
}

input[type="range"]{
  accent-color: #ec4899;
}


/* ✅ DESKTOP COMPACT: ให้ Mockup + แถบมุมมอง + Quick Actions เห็นครบ ไม่โดนตัด/ไม่หาย */

@media (min-width: 769px){
  .pc-wrap{
    height:auto;
    min-height:100vh;
    overflow:auto;
  }
  .pc-grid{
    min-height:0;
    align-items:start;
  }

  .left-panel{
    height:auto;
    min-height:0;
    overflow:visible;
  }

  .left-card-top{
    flex:0 0 auto;
    min-height:0;
  }

  .left-card-top > .body{
    display:flex;
    flex-direction:column;
    min-height:0;
    overflow:visible;
  }

  .mock{
    flex:0 0 auto;
    height:clamp(280px, 40vh, 450px);
    min-height:280px;
    max-height:450px;
  }

  .viewUnderPreview{
    margin-top:8px;
    padding:8px 10px;
    border-radius:18px;
    overflow:visible;
  }

  .viewUnderPreviewHead{
    margin-bottom:6px;
  }

  .viewUnderGrid{
    grid-template-columns:repeat(6, minmax(0, 1fr));
    gap:7px;
  }

  .viewUnderBtn{
    min-height:38px;
    border-radius:15px;
    font-size:12px;
    padding:6px 8px;
  }

  .quickActionsCard .head{
    padding:9px 12px;
  }

  .quickActionsCard .body{
    padding:10px 12px;
  }

  .qa-stack{
    gap:10px;
  }

  .qa-toolbar,
  .qa-toolbarGroup{
    gap:8px;
  }

  .qa-colorSection{
    gap:8px;
  }

  .qa-sectionHead{
    align-items:center;
    gap:10px;
  }

  .qa-sectionHead .hint{
    margin-top:2px !important;
    line-height:1.25;
  }

  .qa-colorGrid{
    gap:10px;
  }

  .qa-colorGrid.double{
    grid-template-columns:repeat(2, minmax(0, 1fr));
  }

  .qa-colorGrid.triple{
    grid-template-columns:repeat(3, minmax(0, 1fr));
  }

  .qa-colorCard{
    padding:10px;
    border-radius:18px;
  }

  .qa-colorTop{
    gap:8px;
  }

  .qa-colorTitle{
    font-size:12.5px;
  }

  .qa-colorSub{
    margin-top:2px;
    font-size:11px;
    line-height:1.25;
  }

  .qa-colorBadge{
    padding:5px 8px;
    font-size:10.5px;
  }

  .qa-colorRow{
    margin-top:9px;
    gap:8px;
    flex-wrap:nowrap;
  }

  .qa-colorPickerGroup{
    gap:8px;
    flex-wrap:nowrap;
  }

  .qa-colorInputWrap{
    width:44px;
    height:44px;
    border-radius:14px;
  }

  .qa-colorPreview{
    inset:5px;
    border-radius:10px;
  }

  .qa-colorMetaLabel{
    font-size:10.5px;
  }

  .qa-colorMetaValue{
    font-size:12px;
  }

  .qa-smallBtn{
    min-width:72px;
    padding:6px 10px;
  }

  .divider{
    margin:8px 0;
  }
}

@media (min-width: 769px) and (max-width: 980px){
  .qa-colorGrid.triple{
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 981px) and (max-width: 1380px){
  .qa-colorGrid.triple{
    grid-template-columns: repeat(3, minmax(0, 1fr));
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
    height:clamp(280px, 34vw, 390px);
    min-height:280px;
    max-height:390px;
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



/* ✅ FIX: จอกลาง/จอใหญ่ที่ยังเข้า breakpoint 1180px
   ป้องกันแถบมุมมองด้านล่างโดน card ที่สูงคงที่ตัดหาย */
@media (min-width: 769px) and (max-width: 1180px){
  .left-panel{
    height:auto;
    overflow:visible;
  }

  .left-card-top{
    flex:0 0 auto;
    min-height:0;
  }

  .left-card-top > .body{
    flex:0 0 auto !important;
    min-height:0;
    overflow:visible;
  }

  .mock{
    flex:0 0 auto;
    height:clamp(270px, 34vw, 390px);
    min-height:270px;
    max-height:390px;
  }

  .viewUnderPreview{
    flex:0 0 auto;
    margin-top:10px;
    overflow:visible;
  }

  .viewUnderGrid{
    grid-template-columns:repeat(6, minmax(0, 1fr));
  }

  .viewUnderBtn{
    min-height:42px;
  }
}



@media (min-width: 769px) and (max-width: 1180px){
  .viewUnderGrid{
    grid-template-columns:repeat(6, minmax(0, 1fr));
  }

  .viewUnderBtn{
    min-height:36px;
    font-size:11.5px;
    padding:5px 6px;
  }

  .quickActionsCard{
    overflow:visible;
  }

  .qa-colorGrid.double,
  .qa-colorGrid.triple{
    grid-template-columns:repeat(2, minmax(0, 1fr));
  }

  .qa-colorCard{
    padding:9px;
  }
}

@media (min-width: 1181px) and (max-height: 820px){
  .mock{
    height:clamp(260px, 36vh, 360px);
    min-height:260px;
    max-height:360px;
  }

  .viewUnderPreview{
    padding:7px 10px;
  }

  .viewUnderBtn{
    min-height:34px;
  }

  .quickActionsCard .body{
    padding:9px 12px;
  }

  .qa-colorCard{
    padding:9px;
  }

  .qa-colorInputWrap{
    width:40px;
    height:40px;
  }
}

@media (max-width: 768px){

  .orderFlowIntro,
  .orderStepHead,
  .orderSuccessTop{
    flex-direction:column;
  }
  .orderSummaryGrid,
  .priceGrid,
  .branchGrid,
  .formGridTwo,
  .messengerFileGrid{
    grid-template-columns:1fr;
  }
  .orderQuantityRow{
    grid-template-columns:1fr;
  }
  .orderPreviewStage{
    min-height:180px;
  }
  .pc-wrap{
    height:auto;
    min-height:100vh;
    min-height:100svh;
    overflow:visible;
    padding:8px;
    box-sizing:border-box;
    -webkit-overflow-scrolling:touch;
  }

  .pc-grid{
    gap:10px;
    grid-template-columns:1fr;
    min-height:0;
    max-width:100%;
    align-items:start;
  }

  .left-panel{
    position:sticky;
    top:0;
    z-index:80;
    align-self:start;
    height:auto;
    overflow:visible;
    padding-right:0;
    gap:10px;
    background:rgba(255,255,255,.68);
    backdrop-filter:blur(12px);
    -webkit-backdrop-filter:blur(12px);
    border-radius:24px;
  }

  .right-panel{
    position:relative;
    z-index:1;
    height:auto;
    overflow:visible;
    padding-right:0;
    gap:10px;
    min-height:0;
  }

  .config-card{
    flex:none;
  }

  .config-layout{
    display:block;
  }

  .stepper{
    display:grid;
    gap:9px;
  }

  .stepAccordionItem{
    gap:0;
    border-radius:20px;
    /* scroll จริงคุมด้วย JS เพราะมี Preview ด้านบนเป็น sticky บนมือถือ */
    scroll-margin-top:calc(var(--mobile-sticky-offset, 0px) + 14px);
  }

  .stepAccordionItem.accordionOpen{
    background:linear-gradient(180deg, rgba(255,255,255,.92), rgba(248,250,252,.88));
    box-shadow:0 14px 30px rgba(15,23,42,.10);
  }

  .stepItem{
    min-height:54px;
    padding:10px 11px;
    border-radius:18px;
    -webkit-tap-highlight-color:transparent;
  }

  .stepItem:hover{
    transform:none;
  }

  .stepText{
    font-size:13px;
  }

  .stepText small{
    display:block;
  }

  .stepChevron{
    display:grid;
    place-items:center;
    width:28px;
    height:28px;
    border-radius:999px;
    background:rgba(255,255,255,.78);
    color:#334155;
    font-size:17px;
    font-weight:900;
    box-shadow:inset 0 0 0 1px rgba(148,163,184,.18);
    flex:0 0 auto;
  }

  .mobileStepPanel{
    display:block;
    overflow:hidden;
    transition:max-height .26s ease, opacity .2s ease, transform .2s ease;
  }

  .mobileStepPanel.open{
    /* เปิด Accordion แล้วให้โชว์รายละเอียดเต็มทั้งหมด ไม่ตัดกลางทาง */
    max-height:99999px;
    opacity:1;
    transform:translateY(0);
  }

  .mobileStepPanel.closed{
    max-height:0;
    opacity:0;
    transform:translateY(-6px);
    pointer-events:none;
  }

  .mobileStepPanelInner{
    margin-top:8px;
    padding:12px;
    border-radius:20px;
    background:rgba(255,255,255,.88);
    border:1px solid rgba(226,232,240,.9);
    /* ให้ความสูงตามเนื้อหาจริง แล้วเลื่อนทั้งหน้าแทน ไม่เลื่อนในกล่องเล็ก */
    max-height:none;
    overflow:visible;
  }



  .mobileViewAppendSlot{
    margin:8px 0 4px;
    padding:0 2px;
  }

  .mobileViewAccordionSelector{
    margin-top: 8px;
    margin-bottom: 12px;
    border-radius: 18px;
  }

  .mobileStepPanelInner::-webkit-scrollbar{
    width:6px;
  }

  .mobileStepPanelInner::-webkit-scrollbar-track{
    background:transparent;
  }

  .mobileStepPanelInner::-webkit-scrollbar-thumb{
    background:linear-gradient(180deg, #ff7ab6, #22d3ee);
    border-radius:999px;
  }

  .left-card-top{
    flex:none;
    min-height:0;
    margin-bottom:0;
    box-shadow:0 12px 28px rgba(15,23,42,.12);
  }

  .card{
    border-radius:24px;
  }

  .head{
    padding:9px 10px;
  }

  .body{
    padding:10px;
  }

  .quickActionsCard{
    display:none;
  }

  .mock{
    flex:none;
    width:100%;
    height:clamp(260px, 44svh, 340px);
    min-height:260px;
    max-height:340px;
    border-radius:22px;
  }

  .mockWithOverlay{
    position:relative;
    padding-bottom:72px;
  }

  .mockWithOverlay canvas{
    display:block;
    width:100% !important;
    height:100% !important;
  }

  .productionPreviewInset{
    top:8px;
    right:8px;
    width:108px;
    border-radius:14px;
  }

  .productionPreviewHead{
    height:24px;
    flex-basis:24px;
    padding:0 7px;
    font-size:9px;
  }

  .productionPreviewDot{
    width:6px;
    height:6px;
  }

  .mobileOrbitBar{
    position:absolute;
    left:50%;
    bottom:10px;
    transform:translateX(-50%);
    transform-origin:center bottom;
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

@media (max-width: 640px){
  .viewUnderPreview{
    margin-top:0;
    padding:8px 9px;
    border-radius:18px;
  }

  .viewUnderPreviewHead{
    align-items:flex-start;
    margin-bottom:7px;
  }

  .viewUnderGrid{
    grid-template-columns:repeat(2, minmax(0, 1fr));
    gap:7px;
  }

  .viewUnderBtn{
    min-height:38px;
    border-radius:14px;
    font-size:11px;
  }
}

@media (max-width: 390px) and (max-height: 740px){
  .pc-wrap{
    padding:6px;
    min-height:100vh;
    min-height:100svh;
    overflow:visible;
  }

  .pc-grid{
    gap:8px;
  }

  .left-panel{
    top:0;
    gap:8px;
    border-radius:22px;
  }

  .left-card-top{
    box-shadow:0 10px 24px rgba(15,23,42,.12);
  }

  .head{
    padding:8px 9px;
  }

  .title{
    font-size:13px;
  }

  .sub{
    font-size:11px;
  }

  .body{
    padding:8px;
  }

  .mock{
    height:250px;
    min-height:250px;
    max-height:250px;
    border-radius:20px;
  }

  .mockWithOverlay{
    padding-bottom:64px;
  }

  .mobileOrbitBar{
    bottom:8px;
    transform:translateX(-50%) scale(.9);
    transform-origin:center bottom;
  }

  .orbitPad{
    gap:5px;
    padding:6px 8px;
  }

  .orbitPadHint{
    font-size:10px;
  }

  .orbitPadGrid{
    gap:5px;
  }

  .orbitArrow{
    width:34px;
    height:34px;
    font-size:19px;
  }

  .orbitArrow span{
    font-size:19px;
  }

  .badge,
  .badgeSoft{
    padding:5px 8px;
    font-size:11px;
  }

  .row{
    gap:6px;
  }
}


/* ✅ PC ONLY: sticky ทั้งแถบด้านซ้าย ไม่เปลี่ยนส่วนอื่น */
@media (min-width: 1181px){
  .pc-wrap{
    height:100vh !important;
    overflow-y:auto !important;
    overflow-x:hidden !important;
  }

  .pc-grid{
    align-items:start !important;
    overflow:visible !important;
  }

  .left-panel{
    position:sticky !important;
    top:16px !important;
    z-index:120 !important;
    align-self:start !important;

    /* ให้ซีกซ้ายค้างอยู่ และถ้าเนื้อหาสูงกว่าจอให้เลื่อนภายในเอง */
    height:auto !important;
    max-height:calc(100vh - 32px) !important;
    overflow-y:auto !important;
    overflow-x:hidden !important;
  }
}

/* ✅ PC ONLY: ปรับ padding-top เฉพาะซีกขวา */
@media (min-width: 1181px){
  .right-panel{
    padding-top: 15px !important;
  }
}

`;