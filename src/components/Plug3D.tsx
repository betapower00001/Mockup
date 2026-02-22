// src/components/Plug3D.tsx
"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls, useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";
import type { PlugModelConfig, ColorKey, UVProjection, UVSpace } from "../data/plugConfig";
import type { LogoTransform } from "./PlugCustomizer";
import FitToObject from "./FitToObject";
import { useStickerTexture } from "./useStickerTexture";

export type PatternTransform = {
  x: number; // 0..1
  y: number; // 0..1
  zoom: number; // 1.. (>=1 recommended)
};

type Plug3DProps = {
  config: PlugModelConfig;
  logoUrl?: string;
  patternUrl?: string;
  colors: Partial<Record<ColorKey, string>>;

  logoTransform?: LogoTransform;
  onLogoTransformChange?: (t: LogoTransform) => void;

  patternTransform?: PatternTransform;

  patternRotation?: number;
  patternBrightness?: number; // default 0.75
  patternOpacity?: number; // default 1
  patternFitMode?: "contain" | "cover";

  dragLogoMode?: boolean;

  renderMode?: boolean;
  onRenderReady?: (render: (opts?: { transparent?: boolean; filename?: string }) => void) => void;
};

// ----------------------------------------------------
// ✅ กันแอปพังจาก Environment preset โหลด HDR ไม่ได้
// ----------------------------------------------------
class EnvErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch() {}
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

// -------------------------
// Utils
// -------------------------
function normalizeHex(hex?: string): string | null {
  if (!hex) return null;
  const h = hex.trim();
  if (!h.startsWith("#")) return null;
  if (h.length === 9) return h.slice(0, 7);
  if (h.length === 4) {
    const r = h[1],
      g = h[2],
      b = h[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  if (h.length === 7) return h;
  return null;
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}

function averageColorFromImage(img: any, sample = 64) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const w = img?.width;
  const h = img?.height;
  if (!w || !h) return null;

  canvas.width = sample;
  canvas.height = sample;

  try {
    ctx.drawImage(img, 0, 0, sample, sample);
  } catch {
    return null;
  }

  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let r = 0,
    g = 0,
    b = 0,
    n = 0;

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 10) continue;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    n++;
  }

  if (!n) return null;
  r = Math.round(r / n);
  g = Math.round(g / n);
  b = Math.round(b / n);
  return { r, g, b };
}

function mixRgb(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }, t: number) {
  const u = 1 - t;
  return {
    r: Math.round(a.r * u + b.r * t),
    g: Math.round(a.g * u + b.g * t),
    b: Math.round(a.b * u + b.b * t),
  };
}

function applyColorsByTargets(
  scene: THREE.Object3D,
  colorTargets: PlugModelConfig["colorTargets"],
  colors: Partial<Record<ColorKey, string>>
) {
  const targetToKey = new Map<string, ColorKey>();
  (Object.keys(colorTargets) as ColorKey[]).forEach((key) => {
    const targets = colorTargets[key];
    if (!targets?.length) return;
    for (const t of targets) targetToKey.set(String(t).trim(), key);
  });

  const colorByKey = new Map<ColorKey, THREE.Color>();
  (Object.keys(colors) as ColorKey[]).forEach((k) => {
    const n = normalizeHex(colors[k]);
    if (n) colorByKey.set(k, new THREE.Color(n));
  });

  const clonedByUUID = new Map<string, THREE.Material>();

  scene.traverse((obj: any) => {
    if (!obj?.isMesh) return;

    const mesh = obj as THREE.Mesh;
    const meshName = (mesh.name || "").trim();
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

    const keyFromMesh = meshName ? targetToKey.get(meshName) : undefined;

    const newMats = mats.map((m: any) => {
      if (!m) return m;

      const matName = (m.name || "").trim();
      const keyFromMat = matName ? targetToKey.get(matName) : undefined;

      const key = keyFromMat ?? keyFromMesh;
      if (!key) return m;

      const col = colorByKey.get(key);
      if (!col) return m;

      const uuid = m.uuid;
      const cloned = clonedByUUID.get(uuid) ?? m.clone();
      clonedByUUID.set(uuid, cloned);

      if ((cloned as any).color) (cloned as any).color = col.clone();
      (cloned as any).needsUpdate = true;

      return cloned;
    });

    mesh.material = Array.isArray(mesh.material) ? newMats : newMats[0];
  });
}

function findMeshByName(scene: THREE.Object3D, name: string): THREE.Mesh | null {
  let found: THREE.Mesh | null = null;
  const want = (name || "").trim();
  scene.traverse((obj: any) => {
    if (!obj?.isMesh) return;
    const mesh = obj as THREE.Mesh;
    if ((mesh.name || "").trim() === want) found = mesh;
  });
  return found;
}

function pickBestAxesFromBBox(mesh: THREE.Mesh): UVProjection {
  const geo = mesh.geometry as THREE.BufferGeometry;
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  if (!bb) return "XZ";

  const size = new THREE.Vector3();
  bb.getSize(size);

  const sx = Math.abs(size.x) || 1;
  const sy = Math.abs(size.y) || 1;
  const sz = Math.abs(size.z) || 1;

  const areaXY = sx * sy;
  const areaXZ = sx * sz;
  const areaYZ = sy * sz;

  if (areaXZ >= areaXY && areaXZ >= areaYZ) return "XZ";
  if (areaYZ >= areaXY && areaYZ >= areaXZ) return "YZ";
  return "XY";
}

function ensurePlanarUV(
  mesh: THREE.Mesh,
  axes?: UVProjection,
  flipU?: boolean,
  flipV?: boolean,
  force?: boolean,
  lockAxes?: boolean
) {
  const geo = mesh.geometry as THREE.BufferGeometry;
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  if (!pos) return;

  const existingUV = geo.getAttribute("uv") as THREE.BufferAttribute | undefined;
  if (!force && existingUV && existingUV.count === pos.count) return;

  const baseFlipU = true;

  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  if (!bb) return;

  const best = pickBestAxesFromBBox(mesh);
  let useAxes: UVProjection = axes || best;

  if (!lockAxes) {
    const size = new THREE.Vector3();
    bb.getSize(size);

    const sx = Math.abs(size.x) || 1;
    const sy = Math.abs(size.y) || 1;
    const sz = Math.abs(size.z) || 1;

    const du = useAxes === "XY" ? sx : useAxes === "XZ" ? sx : sy;
    const dv = useAxes === "XY" ? sy : useAxes === "XZ" ? sz : sz;

    const bdu = best === "XY" ? sx : best === "XZ" ? sx : sy;
    const bdv = best === "XY" ? sy : best === "XZ" ? sz : sz;

    const EPS = 1e-6;
    const aspect = du / Math.max(dv, EPS);
    const bestAspect = bdu / Math.max(bdv, EPS);

    const ASPECT_LIMIT = 20;
    const extreme = du < EPS || dv < EPS || aspect > ASPECT_LIMIT || aspect < 1 / ASPECT_LIMIT;
    const bestIsBetter = bestAspect <= ASPECT_LIMIT && bestAspect >= 1 / ASPECT_LIMIT;

    if (extreme && bestIsBetter) useAxes = best;
  }

  const uv = new Float32Array(pos.count * 2);

  const dx = (bb.max.x - bb.min.x) || 1;
  const dy = (bb.max.y - bb.min.y) || 1;
  const dz = (bb.max.z - bb.min.z) || 1;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    let u = 0,
      v = 0;

    if (useAxes === "XY") {
      u = (x - bb.min.x) / dx;
      v = (y - bb.min.y) / dy;
    } else if (useAxes === "XZ") {
      u = (x - bb.min.x) / dx;
      v = (z - bb.min.z) / dz;
    } else {
      u = (y - bb.min.y) / dy;
      v = (z - bb.min.z) / dz;
    }

    if (baseFlipU) u = 1 - u;
    if (flipU) u = 1 - u;
    if (flipV) v = 1 - v;

    uv[i * 2] = Math.min(1, Math.max(0, u));
    uv[i * 2 + 1] = Math.min(1, Math.max(0, v));
  }

  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  (geo.getAttribute("uv") as THREE.BufferAttribute).needsUpdate = true;
}

function getWorldAlignMatrixFromRef(scene: THREE.Object3D, refMeshName?: string) {
  if (!refMeshName) return null;
  const ref = findMeshByName(scene, refMeshName);
  if (!ref) return null;

  ref.updateWorldMatrix(true, false);

  const q = new THREE.Quaternion();
  ref.getWorldQuaternion(q);

  const m = new THREE.Matrix4().makeRotationFromQuaternion(q).invert();
  return m;
}

function transformBox3(box: THREE.Box3, m: THREE.Matrix4) {
  const pts = [
    new THREE.Vector3(box.min.x, box.min.y, box.min.z),
    new THREE.Vector3(box.min.x, box.min.y, box.max.z),
    new THREE.Vector3(box.min.x, box.max.y, box.min.z),
    new THREE.Vector3(box.min.x, box.max.y, box.max.z),
    new THREE.Vector3(box.max.x, box.min.y, box.min.z),
    new THREE.Vector3(box.max.x, box.min.y, box.max.z),
    new THREE.Vector3(box.max.x, box.max.y, box.min.z),
    new THREE.Vector3(box.max.x, box.max.y, box.max.z),
  ];

  const out = new THREE.Box3();
  for (const p of pts) out.expandByPoint(p.applyMatrix4(m));
  return out;
}

function getDuDvFromWorldBox(bb: THREE.Box3, axes: UVProjection) {
  const dx = Math.abs(bb.max.x - bb.min.x) || 1;
  const dy = Math.abs(bb.max.y - bb.min.y) || 1;
  const dz = Math.abs(bb.max.z - bb.min.z) || 1;

  if (axes === "XY") return { du: dx, dv: dy };
  if (axes === "XZ") return { du: dx, dv: dz };
  return { du: dy, dv: dz };
}

function pickBestAxesFromWorldBox(bb: THREE.Box3): UVProjection {
  const dx = Math.abs(bb.max.x - bb.min.x) || 1;
  const dy = Math.abs(bb.max.y - bb.min.y) || 1;
  const dz = Math.abs(bb.max.z - bb.min.z) || 1;

  const areaXY = dx * dy;
  const areaXZ = dx * dz;
  const areaYZ = dy * dz;

  if (areaXZ >= areaXY && areaXZ >= areaYZ) return "XZ";
  if (areaYZ >= areaXY && areaYZ >= areaXZ) return "YZ";
  return "XY";
}

function isExtremeAspect(du: number, dv: number) {
  const EPS = 1e-6;
  const a = du / Math.max(dv, EPS);
  const LIMIT = 20;
  return du < EPS || dv < EPS || a > LIMIT || a < 1 / LIMIT;
}

function ensureWorldPlanarUV(args: {
  mesh: THREE.Mesh;
  axes: UVProjection;
  worldBBox: THREE.Box3;
  force?: boolean;
  flipU?: boolean;
  flipV?: boolean;
  alignMatrix?: THREE.Matrix4 | null;
  lockAxes?: boolean;
}) {
  const { mesh, axes, worldBBox, force, flipU, flipV, alignMatrix, lockAxes } = args;

  const geo = mesh.geometry as THREE.BufferGeometry;
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  if (!pos) return;

  const existingUV = geo.getAttribute("uv") as THREE.BufferAttribute | undefined;
  if (!force && existingUV && existingUV.count === pos.count) return;

  mesh.updateWorldMatrix(true, false);

  const bb = alignMatrix ? transformBox3(worldBBox, alignMatrix) : worldBBox;

  let useAxes: UVProjection = axes;
  if (!lockAxes) {
    const best = pickBestAxesFromWorldBox(bb);
    const cur = getDuDvFromWorldBox(bb, useAxes);
    const bst = getDuDvFromWorldBox(bb, best);

    const curExtreme = isExtremeAspect(cur.du, cur.dv);
    const bestOk = !isExtremeAspect(bst.du, bst.dv);

    if (curExtreme && bestOk) useAxes = best;
  }

  const dx = (bb.max.x - bb.min.x) || 1;
  const dy = (bb.max.y - bb.min.y) || 1;
  const dz = (bb.max.z - bb.min.z) || 1;

  const vLocal = new THREE.Vector3();
  const vWorld = new THREE.Vector3();
  const vAligned = new THREE.Vector3();
  const uv = new Float32Array(pos.count * 2);

  const baseFlipU = true;

  for (let i = 0; i < pos.count; i++) {
    vLocal.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    vWorld.copy(vLocal).applyMatrix4(mesh.matrixWorld);

    if (alignMatrix) vAligned.copy(vWorld).applyMatrix4(alignMatrix);
    else vAligned.copy(vWorld);

    let u = 0,
      v = 0;

    if (useAxes === "XY") {
      u = (vAligned.x - bb.min.x) / dx;
      v = (vAligned.y - bb.min.y) / dy;
    } else if (useAxes === "XZ") {
      u = (vAligned.x - bb.min.x) / dx;
      v = (vAligned.z - bb.min.z) / dz;
    } else {
      u = (vAligned.y - bb.min.y) / dy;
      v = (vAligned.z - bb.min.z) / dz;
    }

    if (baseFlipU) u = 1 - u;
    if (flipU) u = 1 - u;
    if (flipV) v = 1 - v;

    uv[i * 2] = u;
    uv[i * 2 + 1] = v;
  }

  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  (geo.getAttribute("uv") as THREE.BufferAttribute).needsUpdate = true;
}

// ----------------------------------------------------------------------------------
function applyFitWithPanOnSurface(
  tex: THREE.Texture,
  texW: number,
  texH: number,
  surfaceU: number,
  surfaceV: number,
  pan?: PatternTransform,
  mode: "contain" | "cover" | "fixed" = "contain",
  minRepeat: number = 0,
  rotationRad: number = 0
) {
  const EPS = 1e-6;

  const tW = Math.max(EPS, Math.abs(texW));
  const tH = Math.max(EPS, Math.abs(texH));
  const sU = Math.max(EPS, Math.abs(surfaceU));
  const sV = Math.max(EPS, Math.abs(surfaceV));

  // 90° หรือ 270°
  const isRotated90 = Math.abs(Math.cos(rotationRad)) < 0.1;

  // ✅ “ภาพที่เห็น” หลังหมุน: สลับ W/H เพื่อคำนวณสัดส่วน
  const imgW = isRotated90 ? tH : tW;
  const imgH = isRotated90 ? tW : tH;

  const texAspect = imgW / imgH;
  const surfAspect = sU / sV;

  let repX = 1;
  let repY = 1;

  if (mode === "fixed") {
    repX = 1;
    repY = 1;
  } else if (mode === "cover") {
    if (surfAspect >= texAspect) {
      repY = 1;
      repX = surfAspect / texAspect;
    } else {
      repX = 1;
      repY = texAspect / surfAspect;
    }
  } else {
    // ✅ contain
    if (surfAspect >= texAspect) {
      repX = 1;
      repY = texAspect / surfAspect;
    } else {
      repY = 1;
      repX = surfAspect / texAspect;
    }
  }

  // Zoom
  const zoom = Math.max(0.01, pan?.zoom ?? 1);
  repX *= zoom;
  repY *= zoom;

  if (minRepeat > 0) {
    repX = Math.max(repX, minRepeat);
    repY = Math.max(repY, minRepeat);
  }

  // ✅ สำคัญมาก: เมื่อ texture ถูกหมุน 90° แกน U/V จะสลับกันในทางปฏิบัติ
  // ถ้าไม่สลับ repeat จะ “ดูยืด”
  if (isRotated90) {
    const tmp = repX;
    repX = repY;
    repY = tmp;
  }

  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repX, repY);

  // Pan offset
  const px = pan?.x ?? 0.5;
  const py = pan?.y ?? 0.5;

  let offsetX = 0;
  let offsetY = 0;

  if (isRotated90) {
    if (Math.sin(rotationRad) < 0) {
      // -90
      offsetX = (py - 0.5) * repX;
      offsetY = (0.5 - px) * repY;
    } else {
      // +90
      offsetX = (0.5 - py) * repX;
      offsetY = (px - 0.5) * repY;
    }
  } else {
    offsetX = (0.5 - px) * repX;
    offsetY = (py - 0.5) * repY;
  }

  tex.offset.set(offsetX, offsetY);
  tex.needsUpdate = true;
}

function computePatternWorldBBox(scene: THREE.Object3D, meshNames?: string[]) {
  scene.updateMatrixWorld(true);

  const box = new THREE.Box3();
  const tmp = new THREE.Box3();

  if (meshNames && meshNames.length > 0) {
    let any = false;
    for (const n of meshNames) {
      const m = findMeshByName(scene, n);
      if (!m) continue;
      m.updateWorldMatrix(true, false);
      tmp.setFromObject(m);
      box.union(tmp);
      any = true;
    }
    if (any) return box;
  }

  box.setFromObject(scene);
  return box;
}

function clearPatternOverlay(mesh: THREE.Mesh) {
  const old = mesh.getObjectByName("__PATTERN_OVERLAY__");
  if (old) old.parent?.remove(old);
}

function applyPatternToMesh(args: {
  targetMesh: THREE.Mesh;
  patternTex: THREE.Texture;
  isPatternEnabled: boolean;
  axes: UVProjection;
  pan?: PatternTransform;
  worldBBox?: THREE.Box3 | null;
  alignMatrix?: THREE.Matrix4 | null;
  patternBrightness?: number;
  patternOpacity?: number;
  rotationRad?: number;
  fitMode?: "contain" | "cover";
  minRepeat?: number;
  lockAxes?: boolean;
}) {
  const { targetMesh, patternTex, isPatternEnabled, axes, pan, worldBBox, alignMatrix } = args;

  clearPatternOverlay(targetMesh);
  if (!isPatternEnabled) return () => {};

  const p = pan ?? { x: 0.5, y: 0.5, zoom: 1 };
  const fitMode = args.fitMode ?? "contain";
  const minRepeat = args.minRepeat ?? 0;

  const tex = patternTex.clone();
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false;

  tex.center.set(0.5, 0.5);
  tex.rotation = args.rotationRad ?? 0;

  (tex as any).premultiplyAlpha = true;
  tex.needsUpdate = true;

  let removeLoadListener: (() => void) | null = null;
  let rafId: number | null = null;
  let stopped = false;
  let rafCount = 0;
  const RAF_MAX = 180;

  const getImgSize = () => {
    const img: any = (tex as any).image;
    const w = img?.width;
    const h = img?.height;
    if (w && h) return { w, h };
    return null;
  };

  const applyNow = (imgW: number, imgH: number) => {
    const baseW = imgW;
    const baseH = imgH;
    const rot = args.rotationRad ?? 0;

    if (worldBBox) {
      const bb = alignMatrix ? transformBox3(worldBBox, alignMatrix) : worldBBox;

      let activeAxes = axes;
      if (!args.lockAxes) {
        const best = pickBestAxesFromWorldBox(bb);
        const cur = getDuDvFromWorldBox(bb, activeAxes);
        const bst = getDuDvFromWorldBox(bb, best);
        if (isExtremeAspect(cur.du, cur.dv) && !isExtremeAspect(bst.du, bst.dv)) {
          activeAxes = best;
        }
      }

      const { du, dv } = getDuDvFromWorldBox(bb, activeAxes);
      applyFitWithPanOnSurface(tex, baseW, baseH, du, dv, p, fitMode, minRepeat, rot);
    } else {
      const geo = targetMesh.geometry as THREE.BufferGeometry;
      geo.computeBoundingBox();
      const bb = geo.boundingBox;
      if (bb) {
        const size = new THREE.Vector3();
        bb.getSize(size);
        const sx = Math.abs(size.x) || 1;
        const sy = Math.abs(size.y) || 1;
        const sz = Math.abs(size.z) || 1;

        let activeAxes = axes;
        if (!args.lockAxes) {
          const best = pickBestAxesFromBBox(targetMesh);
          const du = activeAxes === "XY" ? sx : activeAxes === "XZ" ? sx : sy;
          const dv = activeAxes === "XY" ? sy : activeAxes === "XZ" ? sz : sz;
          const bdu = best === "XY" ? sx : best === "XZ" ? sx : sy;
          const bdv = best === "XY" ? sy : best === "XZ" ? sz : sz;
          const aspect = du / Math.max(dv, 1e-6);
          const bestAspect = bdu / Math.max(bdv, 1e-6);
          if ((aspect > 20 || aspect < 1 / 20) && bestAspect <= 20 && bestAspect >= 1 / 20) {
            activeAxes = best;
          }
        }

        const surfaceU = activeAxes === "XY" ? sx : activeAxes === "XZ" ? sx : sy;
        const surfaceV = activeAxes === "XY" ? sy : activeAxes === "XZ" ? sz : sz;

        applyFitWithPanOnSurface(tex, baseW, baseH, surfaceU, surfaceV, p, fitMode, minRepeat, rot);
      }
    }

    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    stopped = true;
  };

  const tryApplyWhenReady = () => {
    if (stopped) return;
    const s = getImgSize();
    if (s) {
      applyNow(s.w, s.h);
      return;
    }
    rafCount++;
    if (rafCount > RAF_MAX) {
      stopped = true;
      return;
    }
    rafId = requestAnimationFrame(tryApplyWhenReady);
  };

  const first = getImgSize();
  if (first) {
    applyNow(first.w, first.h);
  } else {
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.repeat.set(1, 1);
    tex.offset.set(0, 0);
    tex.needsUpdate = true;

    const img: any = (tex as any).image;
    if (img && typeof img.addEventListener === "function") {
      const onLoad = () => {
        const s = getImgSize();
        if (s) applyNow(s.w, s.h);
      };
      img.addEventListener("load", onLoad, { once: true });
      removeLoadListener = () => {
        try {
          img.removeEventListener("load", onLoad);
        } catch {}
      };
    }
    tryApplyWhenReady();
  }

  const brightness = clamp01(args.patternBrightness ?? 0.75);
  const opacity = clamp01(args.patternOpacity ?? 1);

  const overlayMat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity,
    alphaTest: 0.01,
    depthTest: true,
    depthWrite: false,
  });

  (overlayMat as any).toneMapped = false;
  overlayMat.color = new THREE.Color(brightness, brightness, brightness);
  overlayMat.polygonOffset = true;
  overlayMat.polygonOffsetFactor = -2;
  overlayMat.polygonOffsetUnits = -2;

  const overlay = new THREE.Mesh(targetMesh.geometry, overlayMat) as THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
  overlay.name = "__PATTERN_OVERLAY__";
  overlay.renderOrder = 998;

  targetMesh.add(overlay);

  return () => {
    stopped = true;
    overlay.parent?.remove(overlay);
    try {
      if (rafId != null) cancelAnimationFrame(rafId);
      removeLoadListener?.();
      overlayMat.dispose();
      tex.dispose();
    } catch {}
  };
}

// ======================================================
// Scene
// ======================================================
function PlugScene({
  config,
  logoUrl,
  patternUrl,
  colors,
  logoTransform,
  onLogoTransformChange,
  patternTransform,
  patternRotation,
  patternBrightness,
  patternOpacity,
  patternFitMode,
  dragLogoMode,
  onRenderReady,
  glRef,
  cameraRef,
}: {
  config: PlugModelConfig;
  logoUrl?: string;
  patternUrl?: string;
  colors: Partial<Record<ColorKey, string>>;
  logoTransform?: LogoTransform;
  onLogoTransformChange?: (t: LogoTransform) => void;
  patternTransform?: PatternTransform;
  patternRotation?: number;
  patternBrightness?: number;
  patternOpacity?: number;
  patternFitMode?: "contain" | "cover";
  dragLogoMode?: boolean;
  onRenderReady?: Plug3DProps["onRenderReady"];
  glRef: React.MutableRefObject<THREE.WebGLRenderer | null>;
  cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>;
}) {
  const { scene } = useGLTF(config.modelPath);

  const [logoMesh, setLogoMesh] = useState<THREE.Mesh | null>(null);
  const [patternMesh, setPatternMesh] = useState<THREE.Mesh | null>(null);
  const [patternSideMesh, setPatternSideMesh] = useState<THREE.Mesh | null>(null);

  const wantsWorld = config.patternDecal?.uvSpace === "world" || config.patternSideDecal?.uvSpace === "world";

  const patternWorldBBox = useMemo(() => {
    if (!wantsWorld) return null;
    return computePatternWorldBBox(scene, config.patternWorldBBoxMeshes);
  }, [scene, wantsWorld, (config.patternWorldBBoxMeshes || []).join("|")]);

  const patternWorldAlign = useMemo(() => {
    if (!wantsWorld) return null;
    return getWorldAlignMatrixFromRef(scene, config.patternWorldRefMesh);
  }, [scene, wantsWorld, config.patternWorldRefMesh]);

  useEffect(() => {
    const m = findMeshByName(scene, config.decal.meshName);
    if (m) {
      ensurePlanarUV(
        m,
        config.decal.uvProjection,
        config.decal.flipU,
        config.decal.flipV,
        config.decal.forceUV,
        config.decal.lockAxes
      );
    }
    setLogoMesh(m);
  }, [
    scene,
    config.decal.meshName,
    config.decal.uvProjection,
    config.decal.flipU,
    config.decal.flipV,
    config.decal.forceUV,
    config.decal.lockAxes,
  ]);

  useEffect(() => {
    const meshName = config.patternDecal?.meshName ?? config.decal.meshName;
    const pm = findMeshByName(scene, meshName);

    if (pm && config.patternDecal) {
      const axes = (config.patternDecal.uvProjection ?? config.decal.uvProjection ?? "XZ") as UVProjection;
      const fu = config.patternDecal.flipU ?? config.decal.flipU;
      const fv = config.patternDecal.flipV ?? config.decal.flipV;
      const space: UVSpace = config.patternDecal.uvSpace ?? "local";

      if (space === "world" && patternWorldBBox) {
        ensureWorldPlanarUV({
          mesh: pm,
          axes,
          worldBBox: patternWorldBBox,
          force: true,
          flipU: fu,
          flipV: fv,
          alignMatrix: patternWorldAlign,
          lockAxes: config.patternDecal.lockAxes,
        });
      } else {
        ensurePlanarUV(pm, axes, fu, fv, config.patternDecal.forceUV ?? false, config.patternDecal.lockAxes);
      }
    }
    setPatternMesh(pm);
  }, [
    scene,
    config.decal.meshName,
    config.decal.uvProjection,
    config.decal.flipU,
    config.decal.flipV,
    config.patternDecal?.meshName,
    config.patternDecal?.uvProjection,
    config.patternDecal?.flipU,
    config.patternDecal?.flipV,
    config.patternDecal?.forceUV,
    config.patternDecal?.lockAxes,
    config.patternDecal?.uvSpace,
    patternWorldBBox,
    patternWorldAlign,
  ]);

  useEffect(() => {
    const sideName = config.patternSideDecal?.meshName;
    const sm = sideName ? findMeshByName(scene, sideName) : null;

    if (sm && config.patternSideDecal) {
      const axes = (config.patternSideDecal.uvProjection ??
        config.patternDecal?.uvProjection ??
        config.decal.uvProjection ??
        "XZ") as UVProjection;
      const fu = config.patternSideDecal.flipU ?? config.patternDecal?.flipU ?? config.decal.flipU;
      const fv = config.patternSideDecal.flipV ?? config.patternDecal?.flipV ?? config.decal.flipV;
      const space: UVSpace = config.patternSideDecal.uvSpace ?? "local";

      if (space === "world" && patternWorldBBox) {
        ensureWorldPlanarUV({
          mesh: sm,
          axes,
          worldBBox: patternWorldBBox,
          force: true,
          flipU: fu,
          flipV: fv,
          alignMatrix: patternWorldAlign,
          lockAxes: config.patternSideDecal.lockAxes,
        });
      } else {
        ensurePlanarUV(sm, axes, fu, fv, config.patternSideDecal.forceUV ?? false, config.patternSideDecal.lockAxes);
      }
    }
    setPatternSideMesh(sm);
  }, [
    scene,
    config.patternSideDecal?.meshName,
    config.patternSideDecal?.uvProjection,
    config.patternSideDecal?.flipU,
    config.patternSideDecal?.flipV,
    config.patternSideDecal?.forceUV,
    config.patternSideDecal?.lockAxes,
    config.patternSideDecal?.uvSpace,
    config.patternDecal?.uvProjection,
    config.patternDecal?.flipU,
    config.patternDecal?.flipV,
    config.decal.uvProjection,
    config.decal.flipU,
    config.decal.flipV,
    patternWorldBBox,
    patternWorldAlign,
  ]);

  const stickerTex = useStickerTexture(
    logoUrl,
    logoTransform
      ? {
          x: logoTransform.x,
          y: logoTransform.y,
          scale: Array.isArray(logoTransform.scale) ? logoTransform.scale[0] : (logoTransform.scale as any),
          rot: logoTransform.rot,
        }
      : undefined
  );

  const FALLBACK_TRANSPARENT_PNG =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+Q3n8AAAAASUVORK5CYII=";

  const isPatternEnabled = !!patternUrl && patternUrl.trim() !== "";
  const texUrl = isPatternEnabled ? (patternUrl as string) : FALLBACK_TRANSPARENT_PNG;
  const patternTex = useTexture(texUrl);

  useEffect(() => {
    applyColorsByTargets(scene, config.colorTargets, colors);
  }, [scene, config.colorTargets, colors]);

  // apply pattern main
  useEffect(() => {
    const targetMesh = patternMesh ?? logoMesh;
    if (!targetMesh) return;

    const axes = (config.patternDecal?.uvProjection ?? config.decal.uvProjection ?? "XZ") as UVProjection;
    const pan = patternTransform ?? { x: 0.5, y: 0.5, zoom: 1 };
    const wantsWorldMain = config.patternDecal?.uvSpace === "world";

    const rot =
      (patternRotation !== undefined ? patternRotation : undefined) ??
      (config.patternDecal as any)?.patternRotation ??
      0;

    // ✅ FIX: main ต้องใช้ contain เป็น default (ไม่บังคับ cover)
    const fitMode = patternFitMode ?? "contain";
    const minRepeat = 0;

    return applyPatternToMesh({
      targetMesh,
      patternTex,
      isPatternEnabled,
      axes,
      pan,
      worldBBox: wantsWorldMain ? patternWorldBBox : null,
      alignMatrix: wantsWorldMain ? patternWorldAlign : null,
      patternBrightness,
      patternOpacity,
      rotationRad: rot,
      fitMode,
      minRepeat,
      lockAxes: config.patternDecal?.lockAxes,
    });
  }, [
    logoMesh,
    patternMesh,
    isPatternEnabled,
    patternTex,
    patternTransform?.x,
    patternTransform?.y,
    patternTransform?.zoom,
    patternRotation,
    patternBrightness,
    patternOpacity,
    patternFitMode,
    config.id,
    config.decal.uvProjection,
    config.patternDecal?.uvProjection,
    config.patternDecal?.uvSpace,
    (config.patternDecal as any)?.patternRotation,
    patternWorldBBox,
    patternWorldAlign,
    config.patternDecal?.lockAxes,
  ]);

  // apply pattern side
  useEffect(() => {
    if (!patternSideMesh) return;

    const enabled = config.patternSideDecal?.enablePattern ?? true;
    if (!enabled) {
      clearPatternOverlay(patternSideMesh);
      return;
    }

    const axes = (config.patternSideDecal?.uvProjection ??
      config.patternDecal?.uvProjection ??
      config.decal.uvProjection ??
      "XZ") as UVProjection;
    const pan = patternTransform ?? { x: 0.5, y: 0.5, zoom: 1 };
    const wantsWorldSide = config.patternSideDecal?.uvSpace === "world";

    const rot =
      (patternRotation !== undefined ? patternRotation : undefined) ??
      (config.patternSideDecal as any)?.patternRotation ??
      (config.patternDecal as any)?.patternRotation ??
      0;
    const fitMode = patternFitMode ?? "contain";

    return applyPatternToMesh({
      targetMesh: patternSideMesh,
      patternTex,
      isPatternEnabled,
      axes,
      pan,
      worldBBox: wantsWorldSide ? patternWorldBBox : null,
      alignMatrix: wantsWorldSide ? patternWorldAlign : null,
      patternBrightness,
      patternOpacity,
      rotationRad: rot,
      fitMode,
      lockAxes: config.patternSideDecal?.lockAxes,
    });
  }, [
    patternSideMesh,
    isPatternEnabled,
    patternTex,
    patternTransform?.x,
    patternTransform?.y,
    patternTransform?.zoom,
    patternRotation,
    patternBrightness,
    patternOpacity,
    patternFitMode,
    config.patternSideDecal?.uvProjection,
    config.patternSideDecal?.uvSpace,
    config.patternSideDecal?.enablePattern,
    (config.patternSideDecal as any)?.patternRotation,
    (config.patternDecal as any)?.patternRotation,
    config.patternDecal?.uvProjection,
    config.decal.uvProjection,
    patternWorldBBox,
    patternWorldAlign,
    config.patternSideDecal?.lockAxes,
  ]);

  useEffect(() => {
    if (!patternSideMesh) return;

    const enabled = config.patternSideDecal?.enablePattern ?? true;
    if (enabled) return;
    if (!isPatternEnabled) return;

    const img: any = (patternTex as any)?.image;
    const avg = averageColorFromImage(img);
    if (!avg) return;

    const toned = mixRgb(avg, { r: 255, g: 255, b: 255 }, 0.25);

    const mats = Array.isArray(patternSideMesh.material) ? patternSideMesh.material : [patternSideMesh.material];
    const cloned = mats.map((m: any) => (m?.clone ? m.clone() : m));

    cloned.forEach((m: any) => {
      if (m?.color) m.color = new THREE.Color(`rgb(${toned.r},${toned.g},${toned.b})`);
      if ("map" in m) m.map = null;
      m.needsUpdate = true;
    });

    patternSideMesh.material = Array.isArray(patternSideMesh.material) ? cloned : cloned[0];

    return () => {
      cloned.forEach((m: any) => {
        try {
          m?.dispose?.();
        } catch {}
      });
    };
  }, [patternSideMesh, config.id, config.patternSideDecal?.enablePattern, isPatternEnabled, patternTex]);

  useEffect(() => {
    if (!logoMesh) return;

    const old = logoMesh.getObjectByName("__LOGO_OVERLAY__");
    if (old) old.parent?.remove(old);

    if (!logoUrl || !stickerTex) return;

    stickerTex.flipY = false;
    stickerTex.needsUpdate = true;

    const overlayMat = new THREE.MeshBasicMaterial({
      map: stickerTex,
      transparent: true,
      opacity: 1,
      alphaTest: 0.01,
      depthTest: true,
      depthWrite: false,
    });

    overlayMat.polygonOffset = true;
    overlayMat.polygonOffsetFactor = -2;
    overlayMat.polygonOffsetUnits = -2;

    const overlay = new THREE.Mesh(logoMesh.geometry, overlayMat);
    overlay.name = "__LOGO_OVERLAY__";
    overlay.renderOrder = 999;

    logoMesh.add(overlay);

    return () => {
      overlay.parent?.remove(overlay);
      overlayMat.dispose();
    };
  }, [logoMesh, stickerTex, logoUrl]);

  useEffect(() => {
    if (!onRenderReady) return;

    onRenderReady((opts) => {
      const gl = glRef.current;
      const camera = cameraRef.current;
      if (!gl || !camera) return;

      const transparent = opts?.transparent ?? false;
      const filename = opts?.filename ?? "render.png";

      const oldClearColor = new THREE.Color();
      gl.getClearColor(oldClearColor);
      const oldClearAlpha = gl.getClearAlpha();

      gl.setClearColor(0xf5f5f7, transparent ? 0 : 1);
      gl.render(scene as any, camera);

      const dataURL = gl.domElement.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataURL;
      a.download = filename;
      a.click();

      gl.setClearColor(oldClearColor, oldClearAlpha);
    });
  }, [onRenderReady, glRef, cameraRef, scene]);

  const draggingRef = useRef(false);

  const onPointerDown = (e: any) => {
    if (!dragLogoMode || !logoUrl || !logoMesh || !logoTransform || !onLogoTransformChange) return;
    if (e?.object !== logoMesh) return;

    e.stopPropagation();
    draggingRef.current = true;

    if (e.uv) {
      onLogoTransformChange({
        ...logoTransform,
        x: e.uv.x - 0.5,
        y: 0.5 - e.uv.y,
      });
    }
  };

  const onPointerMove = (e: any) => {
    if (!dragLogoMode || !draggingRef.current || !logoUrl || !logoMesh || !logoTransform || !onLogoTransformChange)
      return;
    if (e?.object !== logoMesh) return;

    e.stopPropagation();

    if (e.uv) {
      onLogoTransformChange({
        ...logoTransform,
        x: e.uv.x - 0.5,
        y: 0.5 - e.uv.y,
      });
    }
  };

  const onPointerUp = () => {
    draggingRef.current = false;
  };

  return (
    <>
      <group onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
        <primitive object={scene} />
      </group>
      <FitToObject object={scene} padding={1.25} />
    </>
  );
}

export default function Plug3D({
  config,
  logoUrl,
  patternUrl,
  colors,
  logoTransform,
  onLogoTransformChange,
  patternTransform,
  patternRotation,
  patternBrightness = 0.75,
  patternOpacity = 1,
  patternFitMode = "contain",
  dragLogoMode = false,
  renderMode = false,
  onRenderReady,
}: Plug3DProps) {
  const glRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<any>(null);

  const cameraPos = useMemo(() => [0, 0.1, 3] as [number, number, number], []);
  const lockControls = dragLogoMode || renderMode;

  return (
    <Canvas
      gl={{ preserveDrawingBuffer: true, antialias: true, alpha: true }}
      camera={{ position: cameraPos, fov: 45 }}
      style={{ background: "#f5f5f7" }}
      onCreated={({ gl, camera }) => {
        glRef.current = gl;
        cameraRef.current = camera as THREE.PerspectiveCamera;
      }}
    >
      <ambientLight intensity={0.18} />
      <directionalLight position={[4, 6, 4]} intensity={0.32} />
      <directionalLight position={[-4, 2, 1]} intensity={0.14} />
      <directionalLight position={[0, 3, -4]} intensity={0.18} />

      <Suspense fallback={null}>
        <PlugScene
          config={config}
          logoUrl={logoUrl}
          patternUrl={patternUrl}
          colors={colors}
          logoTransform={logoTransform}
          onLogoTransformChange={onLogoTransformChange}
          patternTransform={patternTransform}
          patternRotation={patternRotation}
          patternBrightness={patternBrightness}
          patternOpacity={patternOpacity}
          patternFitMode={patternFitMode}
          dragLogoMode={dragLogoMode}
          onRenderReady={onRenderReady}
          glRef={glRef}
          cameraRef={cameraRef}
        />

        <EnvErrorBoundary>
          <Environment preset="apartment" environmentIntensity={0.18} />
        </EnvErrorBoundary>
      </Suspense>

      <OrbitControls makeDefault ref={controlsRef} enablePan={!lockControls} enableZoom={!lockControls} enableRotate={!lockControls} />
    </Canvas>
  );
}