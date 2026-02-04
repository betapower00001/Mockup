// src/components/useStickerTexture.ts
"use client";

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";

export type StickerParams = {
  x: number; // -0.5..0.5
  y: number; // -0.5..0.5
  scale: number; // 0.01..1
  rot: number; // radians
};

export function useStickerTexture(logoUrl?: string, params?: StickerParams) {
  const [tex, setTex] = useState<THREE.CanvasTexture | null>(null);

  const canvas = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 1024;
    return c;
  }, []);

  useEffect(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = (THREE as any).SRGBColorSpace ?? undefined;
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    t.anisotropy = 8;
    t.needsUpdate = true;
    (t as any).flipY = false;
    setTex(t);
    return () => t.dispose();
  }, [canvas]);

  useEffect(() => {
    if (!tex) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!logoUrl) {
      tex.needsUpdate = true;
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const p = params ?? { x: 0, y: 0, scale: 0.25, rot: 0 };

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      const px = cx + p.x * canvas.width;
      const py = cy - p.y * canvas.height;

      const base = Math.min(canvas.width, canvas.height);
      const box = Math.max(1, base * p.scale);

      const iw = Math.max(1, img.width);
      const ih = Math.max(1, img.height);

      const s = Math.min(box / iw, box / ih);
      const targetW = iw * s;
      const targetH = ih * s;

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(p.rot);
      ctx.drawImage(img, -targetW / 2, -targetH / 2, targetW, targetH);
      ctx.restore();

      tex.needsUpdate = true;
    };

    img.onerror = () => {
      tex.needsUpdate = true;
    };

    img.src = logoUrl;
  }, [logoUrl, params, tex, canvas]);

  return tex;
}
