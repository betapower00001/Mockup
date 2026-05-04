// src/components/Plug3D.tsx
"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Environment, OrbitControls, useGLTF, useTexture, Center } from "@react-three/drei";
import { suspend } from "suspend-react";
import * as THREE from "three";
import type { PlugModelConfig, ColorKey, UVProjection, UVSpace } from "../data/plugConfig";
import type { LogoTransform } from "./PlugCustomizer";
// ✅ เอา FitToObject ออกจากการ Import ก็ได้ครับ (หรือปล่อยไว้ถ้าใช้ที่อื่น)
// import FitToObject from "./FitToObject"; 
import { useStickerTexture } from "./useStickerTexture";

const cityEnv = import("@pmndrs/assets/hdri/city.exr").then((m) => m.default);

export type RenderViewName = "front" | "angle" | "left" | "right" | "back" | "top";

export type PlugRenderOptions = {
  transparent?: boolean;
  filename?: string;
  view?: RenderViewName;
  download?: boolean;
  productionArtwork?: boolean;
};

export type PlugRenderFn = (opts?: PlugRenderOptions) => Promise<string | null>;

export type PatternTransform = {
  x: number; // 0..1
  y: number; // 0..1
  zoom: number; // 1.. (>=1 recommended)
};

export type LogoItem = {
  id: string;
  url: string;
  transform: LogoTransform;
};

type OrbitNudgeDirection = "left" | "right" | "up" | "down" | null;

type Plug3DProps = {
  config: PlugModelConfig;
  logos?: LogoItem[];
  activeLogoId?: string | null;
  onLogoTransformChange?: (id: string, t: LogoTransform) => void;
  patternUrl?: string;
  colors: Partial<Record<ColorKey, string>>;
  patternTransform?: PatternTransform;
  onPatternTransformChange?: (t: PatternTransform) => void;
  patternRotation?: number;
  patternBrightness?: number; // default 0.75
  patternOpacity?: number; // default 1
  patternFitMode?: "contain" | "cover";
  dragLogoMode?: boolean;
  dragPatternMode?: boolean;
  renderMode?: boolean;
  view?: "front" | "angle";
  onRenderReady?: (render: PlugRenderFn) => void;
  orbitNudgeDirection?: OrbitNudgeDirection;
  orbitNudgeTick?: number;
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
  componentDidCatch(error: any, info: any) {
    console.error("Environment failed:", error);
    console.error(info?.componentStack);
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

// -------------------------
// Utils
// -------------------------
type CameraPose = {
  position: THREE.Vector3;
  target: THREE.Vector3;
};

function getSceneCameraPose(object: THREE.Object3D, camera: THREE.PerspectiveCamera, view: RenderViewName, configId?: string): CameraPose {
  const box = new THREE.Box3().setFromObject(object);
  const center = new THREE.Vector3(0, 0, 0);
  const size = box.getSize(new THREE.Vector3());

  const safeMax = Math.max(size.x, size.y, size.z, 0.001);
  const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
  const fitDist = (safeMax * 0.75) / Math.max(Math.tan(halfFov), 0.01);

  // ✅ 2. ตั้งค่าระยะห่างแยกตามรุ่น (เลขยิ่งมาก กล้องยิ่งถอยออกไปไกล)
  let zoomMultiplier = 1.0; // ระยะเริ่มต้น

  if (configId === "TYPE-1") {
    zoomMultiplier = 1.8; // 👈 ปรับตรงนี้ให้ TYPE-1 ถอยไกลขึ้น (ลองเปลี่ยนเป็น 1.5, 2.0 ได้ตามชอบ)
  } else if (configId === "TYPE-2") {
    zoomMultiplier = 1.0; // TYPE อื่นๆ ก็ใส่เพิ่มดักไว้ได้ครับ
  }

  // ✅ 3. เอาตัวคูณไปคูณกับ fitDist
  const dist = Math.max(fitDist * zoomMultiplier, 0.1);

  const lift = Math.max(size.y * 0.1, safeMax * 0.03);
  const target = center.clone();
  let dir = new THREE.Vector3(0, 0.1, 1);

  switch (view) {
    case "front":
      dir = new THREE.Vector3(0, 0.06, 1);
      break;
    case "angle":
      dir = new THREE.Vector3(0.95, 0.34, 1.1);
      break;
    case "left":
      dir = new THREE.Vector3(-1, 0.14, 0);
      break;
    case "right":
      dir = new THREE.Vector3(1, 0.14, 0);
      break;
    case "back":
      dir = new THREE.Vector3(0, 0.08, -1);
      break;
    case "top":
      dir = new THREE.Vector3(0, 1.45, 0.001);
      break;
  }

  const position = center.clone().add(dir.normalize().multiplyScalar(dist));
  position.y += lift;

  return { position, target };
}

function getExportCameraPose(object: THREE.Object3D, camera: THREE.PerspectiveCamera, view: RenderViewName): CameraPose {
  const box = new THREE.Box3().setFromObject(object);
  const center = new THREE.Vector3(0, 0, 0);
  const size = box.getSize(new THREE.Vector3());

  const safeX = Math.max(size.x, 0.0001);
  const safeY = Math.max(size.y, 0.0001);
  const safeZ = Math.max(size.z, 0.0001);
  const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
  const fitHeight = (safeY * 0.72) / Math.max(Math.tan(halfFov), 0.01);
  const fitWidth = (safeX * 0.72) / Math.max(Math.tan(halfFov) * Math.max(camera.aspect, 0.5), 0.01);
  const fitDepth = safeZ * 1.2;
  const dist = Math.max(fitHeight, fitWidth, fitDepth, 0.1);
  const lift = Math.max(safeY * 0.08, 0.08);

  const target = center.clone();
  let dir = new THREE.Vector3(0, 0.08, 1);
  let mul = 1.0;

  switch (view) {
    case "front":
      dir = new THREE.Vector3(0, 0.08, 1);
      mul = 1.0;
      break;
    case "angle":
      dir = new THREE.Vector3(1.1, 0.58, 1.28);
      mul = 1.0;
      break;
    case "left":
      dir = new THREE.Vector3(-1, 0.18, 0.08);
      mul = 1.02;
      break;
    case "right":
      dir = new THREE.Vector3(1, 0.18, 0.08);
      mul = 1.02;
      break;
    case "back":
      dir = new THREE.Vector3(0, 0.1, -1);
      mul = 1.0;
      break;
    case "top":
      dir = new THREE.Vector3(0, 1.7, 0.04);
      mul = 1.02;
      break;
  }

  const position = center.clone().add(dir.normalize().multiplyScalar(dist * mul));
  position.y += lift;
  return { position, target };
}

function renderSceneToDataURL(args: {
  gl: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  width: number;
  height: number;
  transparent: boolean;
}) {
  const { gl, scene, camera, width, height, transparent } = args;

  const oldTarget = gl.getRenderTarget();
  const oldAutoClear = gl.autoClear;
  const oldClearColor = new THREE.Color();
  gl.getClearColor(oldClearColor);
  const oldClearAlpha = gl.getClearAlpha();

  const target = new THREE.WebGLRenderTarget(width, height, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    depthBuffer: true,
    stencilBuffer: false,
  });
  target.texture.colorSpace = THREE.SRGBColorSpace;

  const pixels = new Uint8Array(width * height * 4);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    target.dispose();
    return null;
  }

  try {
    gl.autoClear = true;
    gl.setRenderTarget(target);
    gl.setClearColor(0xffffff, transparent ? 0 : 1);
    gl.clear(true, true, true);
    gl.render(scene, camera);
    gl.readRenderTargetPixels(target, 0, 0, width, height, pixels);

    const imageData = ctx.createImageData(width, height);
    for (let y = 0; y < height; y++) {
      const srcY = height - 1 - y;
      const srcOffset = srcY * width * 4;
      const dstOffset = y * width * 4;
      imageData.data.set(pixels.subarray(srcOffset, srcOffset + width * 4), dstOffset);
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL("image/png");
  } finally {
    gl.setRenderTarget(oldTarget);
    gl.autoClear = oldAutoClear;
    gl.setClearColor(oldClearColor, oldClearAlpha);
    target.dispose();
  }
}

function applyCameraPose(camera: THREE.PerspectiveCamera, pose: CameraPose) {
  camera.position.copy(pose.position);
  camera.lookAt(pose.target);
  camera.updateProjectionMatrix();
}

function normalizeTargetNames(names?: string[]) {
  return new Set((names ?? []).map((name) => String(name || "").trim()).filter(Boolean));
}

function meshMatchesTargetNames(mesh: THREE.Mesh, targets: Set<string>) {
  const meshName = String(mesh.name || "").trim();
  if (meshName && targets.has(meshName)) return true;

  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return mats.some((mat: any) => {
    const matName = String(mat?.name || "").trim();
    return !!matName && targets.has(matName);
  });
}

function withProductionArtworkVisibility(scene: THREE.Object3D, config: PlugModelConfig) {
  const strictFrontOnly = config.id === "TYPE-3" || config.id === "TYPE-5";

  const keepTargets = strictFrontOnly
    ? new Set<string>()
    : normalizeTargetNames(config.colorTargets.top);

  const keepMeshNames = normalizeTargetNames(
    (
      strictFrontOnly
        ? [
            config.decal.meshName,
            config.patternDecal?.meshName,
            config.patternWorldRefMesh,
            ...(config.patternWorldBBoxMeshes ?? []),
          ]
        : [
            config.decal.meshName,
            config.patternDecal?.meshName,
            config.patternSideDecal?.meshName,
          ]
    ).filter(Boolean) as string[]
  );

  const saved: Array<{ mesh: THREE.Mesh; visible: boolean }> = [];

  scene.traverse((obj: any) => {
    if (!obj?.isMesh) return;
    const mesh = obj as THREE.Mesh;
    saved.push({ mesh, visible: mesh.visible });

    const shouldKeep = meshMatchesTargetNames(mesh, keepTargets) || meshMatchesTargetNames(mesh, keepMeshNames);
    mesh.visible = shouldKeep;
  });

  return () => {
    for (const item of saved) item.mesh.visible = item.visible;
  };
}

function waitNextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

function normalizeHex(hex?: string): string | null {
  if (!hex) return null;
  const h = hex.trim();
  if (!h.startsWith("#")) return null;
  if (h.length === 9) return h.slice(0, 7);
  if (h.length === 4) {
    const r = h[1], g = h[2], b = h[3];
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
  let r = 0, g = 0, b = 0, n = 0;

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

function isExtremeAspect(du: number, dv: number) {
  const EPS = 1e-6;
  const a = du / Math.max(dv, EPS);
  const LIMIT = 20;
  return du < EPS || dv < EPS || a > LIMIT || a < 1 / LIMIT;
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

    let u = 0, v = 0;

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

function ensurePlanarUVByNormal(mesh: THREE.Mesh, flipU?: boolean, flipV?: boolean, force?: boolean) {
  const geo = mesh.geometry as THREE.BufferGeometry;
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  if (!pos) return;

  const existingUV = geo.getAttribute("uv") as THREE.BufferAttribute | undefined;
  if (!force && existingUV && existingUV.count === pos.count) return;

  let nAttr = geo.getAttribute("normal") as THREE.BufferAttribute | undefined;
  if (!nAttr) {
    geo.computeVertexNormals();
    nAttr = geo.getAttribute("normal") as THREE.BufferAttribute | undefined;
  }
  if (!nAttr) return;

  const n = new THREE.Vector3();
  const tmpN = new THREE.Vector3();
  for (let i = 0; i < nAttr.count; i++) {
    tmpN.set(nAttr.getX(i), nAttr.getY(i), nAttr.getZ(i));
    if (tmpN.lengthSq() > 1e-12) n.add(tmpN);
  }
  if (n.lengthSq() < 1e-12) n.set(0, 0, 1);
  n.normalize();

  const up = Math.abs(n.y) < 0.99 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const t = new THREE.Vector3().crossVectors(up, n).normalize();
  const b = new THREE.Vector3().crossVectors(n, t).normalize();

  const tmpP = new THREE.Vector3();
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;

  for (let i = 0; i < pos.count; i++) {
    tmpP.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    const u = tmpP.dot(t);
    const v = tmpP.dot(b);
    if (u < minU) minU = u;
    if (u > maxU) maxU = u;
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
  }

  const du = maxU - minU || 1;
  const dv = maxV - minV || 1;

  const uv = new Float32Array(pos.count * 2);

  const baseFlipU = true;

  for (let i = 0; i < pos.count; i++) {
    tmpP.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    let u = (tmpP.dot(t) - minU) / du;
    let v = (tmpP.dot(b) - minV) / dv;

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

    let u = 0, v = 0;

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

function applyFitWithPanOnSurface(
  tex: THREE.Texture,
  texW: number,
  texH: number,
  surfaceU: number,
  surfaceV: number,
  pan?: PatternTransform,
  mode: "contain" | "cover" | "fixed" = "contain",
  minRepeat: number = 0,
  rotationRad: number = 0,
  stableRotate: boolean = false,
  clampEdges: boolean = false
) {
  const EPS = 1e-6;

  const tW = Math.max(EPS, Math.abs(texW));
  const tH = Math.max(EPS, Math.abs(texH));
  const sU = Math.max(EPS, Math.abs(surfaceU));
  const sV = Math.max(EPS, Math.abs(surfaceV));

  const px = pan?.x ?? 0.5;
  const py = pan?.y ?? 0.5;
  const zoom = Math.max(0.01, pan?.zoom ?? 1);

  const c = Math.abs(Math.cos(rotationRad));
  const s = Math.abs(Math.sin(rotationRad));
  const rotW = tW * c + tH * s;
  const rotH = tW * s + tH * c;

  let scale = 1;

  if (stableRotate) {
    const diag = Math.sqrt(sU * sU + sV * sV);
    scale = Math.max(diag / tW, diag / tH);
  } else {
    if (mode === "cover") {
      if (sU / sV > rotW / rotH) {
        scale = sU / rotW;
      } else {
        scale = sV / rotH;
      }
    } else {
      if (sU / sV > rotW / rotH) {
        scale = sV / rotH;
      } else {
        scale = sU / rotW;
      }
    }
  }

  scale /= zoom;

  if (minRepeat > 0) {
    const maxScaleX = sU / (rotW * minRepeat);
    const maxScaleY = sV / (rotH * minRepeat);
    scale = Math.min(scale, maxScaleX, maxScaleY);
  }

  tex.matrixAutoUpdate = false;
  tex.matrix
    .identity()
    .translate(-0.5, -0.5)
    .scale(sU, sV)
    .rotate(rotationRad)
    .scale(1 / (tW * scale), 1 / (tH * scale))
    .translate(0.5 - px, 0.5 - py)
    .translate(0.5, 0.5);

  tex.wrapS = tex.wrapT =
    clampEdges ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
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
  stableRotate?: boolean;
  clampEdges?: boolean;
}) {
  const { targetMesh, patternTex, isPatternEnabled, axes, pan, worldBBox, alignMatrix } = args;

  clearPatternOverlay(targetMesh);
  if (!isPatternEnabled) return () => { };

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
      applyFitWithPanOnSurface(
        tex,
        baseW,
        baseH,
        du,
        dv,
        p,
        fitMode,
        minRepeat,
        rot,
        !!args.stableRotate,
        !!args.clampEdges
      );
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

        applyFitWithPanOnSurface(
          tex,
          baseW,
          baseH,
          surfaceU,
          surfaceV,
          p,
          fitMode,
          minRepeat,
          rot,
          !!args.stableRotate,
          !!args.clampEdges
        );
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
        } catch { }
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
    } catch { }
  };
}

// ======================================================
// ✅ 3. Logo Layer Component 
// ======================================================
function LogoLayer({
  logoMesh,
  config,
  logo,
  index,
}: {
  logoMesh: THREE.Mesh;
  config: PlugModelConfig;
  logo: LogoItem;
  index: number;
}) {
  // ✅ แยก TYPE-2 ออกมา เพื่อแก้เฉพาะ TYPE-2 ไม่ให้กระทบ TYPE อื่น
  const isType2 = config.id === "TYPE-2";
  const isType3 = isType2 || config.id === "TYPE-3" || config.id === "TYPE-5";
  const isType4 = config.id === "TYPE-4";
  const isFixedLogoType = isType3 || isType4;

  const transformArgs = useMemo(() => {
    if (!logo.transform) return undefined;
    if (isFixedLogoType) {
      return { x: 0, y: 0, scale: 1, rot: 0 };
    }
    return {
      x: logo.transform.x,
      y: logo.transform.y,
      scale: Array.isArray(logo.transform.scale)
        ? logo.transform.scale[0]
        : logo.transform.scale,
      rot: logo.transform.rot,
    };
  }, [
    isFixedLogoType,
    isFixedLogoType ? 0 : logo.transform?.x,
    isFixedLogoType ? 0 : logo.transform?.y,
    isFixedLogoType ? 1 : logo.transform?.scale,
    isFixedLogoType ? 0 : logo.transform?.rot,
  ]);

  const stickerTex = useStickerTexture(logo.url, transformArgs);

  useEffect(() => {
    if (!logoMesh || !logo.url || !stickerTex) return;

    const overlayName = `__LOGO_OVERLAY_${logo.id}__`;
    const old = logoMesh.getObjectByName(overlayName);
    if (old) old.parent?.remove(old);

    const overlayMat = new THREE.MeshBasicMaterial({
      map: stickerTex,
      transparent: true,
      opacity: 1,
      alphaTest: 0.01,
      depthTest: true,
      depthWrite: false,
    });

    overlayMat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        `#include <map_fragment>`,
        `
        #include <map_fragment>
        #ifdef USE_MAP
          if (vMapUv.x < 0.001 || vMapUv.x > 0.999 || vMapUv.y < 0.001 || vMapUv.y > 0.999) {
              diffuseColor.a = 0.0; 
          }
        #endif
        `
      );
    };

    overlayMat.polygonOffset = true;
    overlayMat.polygonOffsetFactor = -2 - index;
    overlayMat.polygonOffsetUnits = -2 - index;

    const overlay = new THREE.Mesh(logoMesh.geometry, overlayMat);
    overlay.name = overlayName;
    overlay.renderOrder = 999 + index;

    logoMesh.add(overlay);

    return () => {
      overlay.parent?.remove(overlay);
      overlayMat.dispose();
    };
  }, [logoMesh, stickerTex, logo.id, logo.url, index]);

  const decalProj = config.decal.uvProjection;
  const decalRot = config.decal.rotation ? config.decal.rotation[2] : 0;

  useEffect(() => {
    if (!logoMesh || !stickerTex) return;

    if (isFixedLogoType) {
      let du = 1, dv = 1;
      logoMesh.geometry.computeBoundingBox();
      const s = new THREE.Vector3();
      logoMesh.geometry.boundingBox?.getSize(s);

      const proj: UVProjection = isType4 ? "XZ" : (decalProj || "XZ");
      if (proj === "XY") {
        du = s.x; dv = s.y;
      } else if (proj === "XZ") {
        du = s.x; dv = s.z;
      } else {
        du = s.y; dv = s.z;
      }

      du = Math.max(0.001, du);
      dv = Math.max(0.001, dv);

      const maxDim = Math.max(du, dv);

      // ✅ TYPE-2 เท่านั้น: ไม่ normalize ตาม bbox เพราะทำให้โลโก้/วงกลมยืดเป็นวงรี
      // TYPE อื่นยังใช้ logic เดิมทั้งหมด เพื่อไม่ให้กระทบตำแหน่ง/สัดส่วนที่ตั้งไว้แล้ว
      const normX = isType2 ? 1 : du / maxDim;
      const normY = isType2 ? 1 : dv / maxDim;

      const rotUI = logo.transform?.rot ?? 0;
      const totalRot = decalRot + rotUI;

      const px = logo.transform?.x ?? 0;
      const py = logo.transform?.y ?? 0;

      let uiScale = 1;
      if (logo.transform?.scale !== undefined) {
        uiScale = Array.isArray(logo.transform.scale) ? logo.transform.scale[0] : logo.transform.scale;
      }

      stickerTex.matrixAutoUpdate = false;
      stickerTex.matrix
        .identity()
        .translate(-0.5 - px, -0.5 - py)
        .scale(normX, normY)
        .rotate(totalRot)
        .scale(1 / uiScale, 1 / uiScale)
        .translate(0.5, 0.5);
    } else {
      stickerTex.matrixAutoUpdate = false;
      stickerTex.matrix.identity().translate(-0.5, -0.5).rotate(decalRot).translate(0.5, 0.5);
    }

  }, [logo.transform, stickerTex, logoMesh, isFixedLogoType, isType2, isType4, decalProj, decalRot]);

  return null;
}

// ======================================================
// Scene
// ======================================================
function PlugScene({
  config,
  logos,
  activeLogoId,
  onLogoTransformChange,
  patternUrl,
  colors,
  patternTransform,
  onPatternTransformChange,
  patternRotation,
  patternBrightness,
  patternOpacity,
  patternFitMode,
  dragLogoMode,
  dragPatternMode,
  view,
  onRenderReady,
  glRef,
  cameraRef,
  // ✅ รับค่า prevViewRef จากตัวแม่
  prevViewRef,
}: {
  config: PlugModelConfig;
  logos?: LogoItem[];
  activeLogoId?: string | null;
  onLogoTransformChange?: (id: string, t: LogoTransform) => void;
  patternUrl?: string;
  colors: Partial<Record<ColorKey, string>>;
  patternTransform?: PatternTransform;
  onPatternTransformChange?: (t: PatternTransform) => void;
  patternRotation?: number;
  patternBrightness?: number;
  patternOpacity?: number;
  patternFitMode?: "contain" | "cover";
  dragLogoMode?: boolean;
  dragPatternMode?: boolean;
  view?: Plug3DProps["view"];
  onRenderReady?: Plug3DProps["onRenderReady"];
  glRef: React.MutableRefObject<THREE.WebGLRenderer | null>;
  cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>;
  // ✅ ประกาศ Type ของ prevViewRef
  prevViewRef: React.MutableRefObject<string | null>;
}) {
  const { scene } = useGLTF(config.modelPath) as any;
  const rootScene = useThree((state: any) => state.scene) as THREE.Scene;

  // ✅ ดึงระบบควบคุมกล้องมาใช้งาน
  const controls = useThree((state: any) => state.controls);

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

  const isFixedType = config.id === "TYPE-2" || config.id === "TYPE-3" || config.id === "TYPE-4";

  const fixedWorldAxes = useMemo<UVProjection | null>(() => {
    if (!isFixedType) return null;
    if (!patternWorldBBox) return null;
    const bb = patternWorldAlign ? transformBox3(patternWorldBBox, patternWorldAlign) : patternWorldBBox;
    return pickBestAxesFromWorldBox(bb);
  }, [isFixedType, patternWorldBBox, patternWorldAlign]);

  useEffect(() => {
    const m = findMeshByName(scene, config.decal.meshName);

    if (m) {
      // ✅ TYPE-2 เท่านั้นที่เพิ่มเข้ามา: ใช้ UV by normal เพื่อกันโลโก้บิด/ยืดบนผิวที่เอียง
      // TYPE-3 / TYPE-5 ใช้ของเดิมเหมือนเดิม
      if (config.id === "TYPE-2" || config.id === "TYPE-3" || config.id === "TYPE-5") {
        ensurePlanarUVByNormal(m, config.decal.flipU, config.decal.flipV, true);
      } else if (config.id === "TYPE-4") {
        ensurePlanarUV(
          m,
          "XZ",
          config.decal.flipU,
          config.decal.flipV,
          true,
          true
        );
      } else {
        ensurePlanarUV(
          m,
          config.decal.uvProjection,
          config.decal.flipU,
          config.decal.flipV,
          config.decal.forceUV,
          config.decal.lockAxes
        );
      }
    }

    setLogoMesh(m);
  }, [
    scene,
    config.id,
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
      let axes = (config.patternDecal.uvProjection ?? config.decal.uvProjection ?? "XZ") as UVProjection;
      const fu = config.patternDecal.flipU ?? config.decal.flipU;
      const fv = config.patternDecal.flipV ?? config.decal.flipV;
      const space: UVSpace = config.patternDecal.uvSpace ?? "local";

      if (space === "world" && patternWorldBBox) {
        if (isFixedType && fixedWorldAxes) axes = fixedWorldAxes;

        ensureWorldPlanarUV({
          mesh: pm,
          axes,
          worldBBox: patternWorldBBox,
          force: true,
          flipU: fu,
          flipV: fv,
          alignMatrix: patternWorldAlign,
          lockAxes: isFixedType ? true : config.patternDecal.lockAxes,
        });
      } else {
        ensurePlanarUV(pm, axes, fu, fv, config.patternDecal.forceUV ?? false, config.patternDecal.lockAxes);
      }
    }
    setPatternMesh(pm);
  }, [
    scene,
    isFixedType,
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
    fixedWorldAxes,
  ]);

  useEffect(() => {
    const sideName = config.patternSideDecal?.meshName;
    const sm = sideName ? findMeshByName(scene, sideName) : null;

    if (sm && config.patternSideDecal) {
      let axes = (config.patternSideDecal.uvProjection ??
        config.patternDecal?.uvProjection ??
        config.decal.uvProjection ??
        "XZ") as UVProjection;

      const fu = config.patternSideDecal.flipU ?? config.patternDecal?.flipU ?? config.decal.flipU;
      const fv = config.patternSideDecal.flipV ?? config.patternDecal?.flipV ?? config.decal.flipV;
      const space: UVSpace = config.patternSideDecal.uvSpace ?? "local";

      if (space === "world" && patternWorldBBox) {
        if (isFixedType && fixedWorldAxes) axes = fixedWorldAxes;

        ensureWorldPlanarUV({
          mesh: sm,
          axes,
          worldBBox: patternWorldBBox,
          force: true,
          flipU: fu,
          flipV: fv,
          alignMatrix: patternWorldAlign,
          lockAxes: isFixedType ? true : config.patternSideDecal.lockAxes,
        });
      } else {
        ensurePlanarUV(sm, axes, fu, fv, config.patternSideDecal.forceUV ?? false, config.patternSideDecal.lockAxes);
      }
    }

    setPatternSideMesh(sm);
  }, [
    scene,
    isFixedType,
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
    fixedWorldAxes,
  ]);

  const FALLBACK_TRANSPARENT_PNG =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+Q3n8AAAAASUVORK5CYII=";

  const isPatternEnabled = !!patternUrl && patternUrl.trim() !== "";
  const texUrl = isPatternEnabled ? (patternUrl as string) : FALLBACK_TRANSPARENT_PNG;
  const patternTex = useTexture(texUrl) as THREE.Texture;

  useEffect(() => {
    applyColorsByTargets(scene, config.colorTargets, colors);
  }, [scene, config.colorTargets, colors]);

  // apply pattern main
  useEffect(() => {
    const targetMesh = patternMesh ?? logoMesh;
    if (!targetMesh) return;

    let axes = (config.patternDecal?.uvProjection ?? config.decal.uvProjection ?? "XZ") as UVProjection;

    const basePan = patternTransform ?? { x: 0.5, y: 0.5, zoom: 1 };
    const pan =
      config.id === "TYPE-3"
        ? {
          ...basePan,
          y: Math.max(0, Math.min(1, basePan.y + 0.035)),
        }
        : config.id === "TYPE-5"
          ? {
            ...basePan,
            y: Math.max(0, Math.min(1, basePan.y + 0.01)),
          }
          : config.id === "TYPE-2"
            ? {
              ...basePan,
              ...basePan,
              y: Math.max(0, Math.min(1, basePan.y + 0.20)),
              zoom: Math.max(0.01, basePan.zoom * 1.50),
            }
            : basePan;
    const wantsWorldMain = config.patternDecal?.uvSpace === "world";

    const rot =
      (patternRotation !== undefined ? patternRotation : undefined) ??
      (config.patternDecal as any)?.patternRotation ??
      0;

    const fitMode =
      config.id === "TYPE-5"
        ? "cover"
        : (patternFitMode ?? "contain");

    const minRepeat = 0;

    if (wantsWorldMain && patternWorldBBox && isFixedType && fixedWorldAxes) {
      axes = fixedWorldAxes;
    }

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
      lockAxes: isFixedType ? true : config.patternDecal?.lockAxes,
      // ✅ TYPE-5 ไม่เข้า fixed axes แต่เปิด stableRotate เพื่อตัดอาการซูมเข้า-ออกตอนหมุน
      stableRotate: config.id === "TYPE-5" ? true : isFixedType,
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
    isFixedType,
    config.decal.uvProjection,
    config.patternDecal?.uvProjection,
    config.patternDecal?.uvSpace,
    (config.patternDecal as any)?.patternRotation,
    patternWorldBBox,
    patternWorldAlign,
    config.patternDecal?.lockAxes,
    fixedWorldAxes,
  ]);

  // apply pattern side
  useEffect(() => {
    const sideCfg = config.patternSideDecal;
    if (!patternSideMesh) return;
    if (!sideCfg) return;

    const enabled = sideCfg.enablePattern ?? true;
    if (!enabled) {
      clearPatternOverlay(patternSideMesh);
      return;
    }

    let axes = (sideCfg.uvProjection ?? config.patternDecal?.uvProjection ?? config.decal.uvProjection ?? "XZ") as UVProjection;

    const pan = patternTransform ?? { x: 0.5, y: 0.5, zoom: 1 };
    const wantsWorldSide = sideCfg.uvSpace === "world";

    const rot =
      (patternRotation !== undefined ? patternRotation : undefined) ??
      (sideCfg as any)?.patternRotation ??
      (config.patternDecal as any)?.patternRotation ??
      0;

    const fitMode =
      config.id === "TYPE-5"
        ? ((sideCfg as any)?.fitMode ?? (config.patternDecal as any)?.fitMode ?? "cover")
        : (patternFitMode ?? "contain");

    if (wantsWorldSide && patternWorldBBox && isFixedType && fixedWorldAxes) {
      axes = fixedWorldAxes;
    }

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
      lockAxes: isFixedType ? true : sideCfg.lockAxes,
      stableRotate: isFixedType,
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
    isFixedType,
    config.patternSideDecal,
    config.patternDecal?.uvProjection,
    (config.patternDecal as any)?.patternRotation,
    patternWorldBBox,
    patternWorldAlign,
    fixedWorldAxes,
  ]);

  const ENABLE_PATTERN_SIDE_TINT = false;

  // side enabled=false -> tint material
  useEffect(() => {
    if (!ENABLE_PATTERN_SIDE_TINT) return;
    if (!patternSideMesh) return;

    const enabled = config.patternSideDecal?.enablePattern ?? true;
    if (enabled) return;
    if (!isPatternEnabled) return;

    const img: any = (patternTex as any)?.image;
    const avg = averageColorFromImage(img);
    if (!avg) return;

    const toned = mixRgb(avg, { r: 255, g: 255, b: 255 }, 0.25);

    const mats = Array.isArray(patternSideMesh.material)
      ? patternSideMesh.material
      : [patternSideMesh.material];

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
        } catch { }
      });
    };
  }, [patternSideMesh, config.patternSideDecal?.enablePattern, isPatternEnabled, patternTex]);

  const prevConfigIdRef = useRef<string | null>(null);
  // ✅ กล้องที่ทำงานประสานกับตัวแม่ (ไม่เด้งตอนโหลดลาย)
  useEffect(() => {
    const camera = cameraRef.current;
    if (!camera) return;

    const currentView = view ?? "angle";
    const isModelChanged = prevConfigIdRef.current !== config.id; // เช็คว่าเปลี่ยนรุ่นปลั๊กหรือไม่

    // ถ้ามุมมองเดิม "และ" ไม่ได้เปลี่ยนรุ่นปลั๊ก (แปลว่าแค่อัปโหลดรูปลวดลาย) -> ไม่ต้องจัดกล้องใหม่
    if (!isModelChanged && prevViewRef.current === currentView) return;

    // อัปเดตค่าความจำล่าสุด
    prevViewRef.current = currentView;
    prevConfigIdRef.current = config.id;

    // ✅ ใช้ 0,0,0 เสมอ เพราะเรามี <Center> ช่วยดึงโมเดลมาตรงกลางแล้ว
    const pose = getSceneCameraPose(scene, camera, currentView);
    applyCameraPose(camera, pose);

    // อัปเดตเป้าหมายการหมุน
    if (controls) {
      controls.target.copy(pose.target);
      controls.update();
    }
  }, [scene, cameraRef, view, prevViewRef, controls, config.id]);

  // render
  useEffect(() => {
    if (!onRenderReady) return;

    onRenderReady(async (opts?: PlugRenderOptions) => {
      const gl = glRef.current;
      const liveCamera = cameraRef.current;
      if (!gl || !liveCamera) return null;

      const transparent = opts?.transparent ?? false;
      const filename = opts?.filename ?? "render.png";
      const shouldDownload = opts?.download ?? true;
      const productionArtwork = opts?.productionArtwork ?? false;

      const exportWidth = shouldDownload ? 2200 : 1800;
      const exportHeight = shouldDownload ? 2200 : 1800;

      const exportCamera = liveCamera.clone() as THREE.PerspectiveCamera;
      exportCamera.aspect = exportWidth / exportHeight;
      exportCamera.near = liveCamera.near;
      exportCamera.far = liveCamera.far;
      exportCamera.zoom = liveCamera.zoom;
      exportCamera.up.copy(liveCamera.up);

      const pose = getExportCameraPose(scene, exportCamera, opts?.view ?? "angle");
      applyCameraPose(exportCamera, pose);
      exportCamera.updateMatrixWorld(true);
      await waitNextFrame();

      const restoreVisibility = productionArtwork
        ? withProductionArtworkVisibility(scene, config)
        : null;

      try {
        const dataURL = renderSceneToDataURL({
          gl,
          scene: rootScene,
          camera: exportCamera,
          width: exportWidth,
          height: exportHeight,
          transparent,
        });

        if (!dataURL) return null;

        if (shouldDownload) {
          const a = document.createElement("a");
          a.href = dataURL;
          a.download = filename;
          a.click();
        }

        return dataURL;
      } finally {
        restoreVisibility?.();
      }
    });
  }, [onRenderReady, glRef, cameraRef, scene, rootScene, config]);

  const draggingRef = useRef(false);
  const draggingPatternRef = useRef(false);
  const patternDragStartRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const activeLogo = logos?.find((l) => l.id === activeLogoId);

  const onPointerDown = (e: any) => {
    if (!dragLogoMode || !activeLogo || !logoMesh || !onLogoTransformChange) return;
    if (e?.object !== logoMesh) return;

    e.stopPropagation();
    draggingRef.current = true;

    if (e.uv) {
      const isFixedLogoType =
        config.id === "TYPE-2" ||
        config.id === "TYPE-3" ||
        config.id === "TYPE-4" ||
        config.id === "TYPE-5";
      onLogoTransformChange(activeLogo.id, {
        ...activeLogo.transform,
        x: e.uv.x - 0.5,
        y: isFixedLogoType ? e.uv.y - 0.5 : 0.5 - e.uv.y,
      });
    }
  };

  const onPointerMove = (e: any) => {
    if (!dragLogoMode || !draggingRef.current || !activeLogo || !logoMesh || !onLogoTransformChange) return;
    if (e?.object !== logoMesh) return;

    e.stopPropagation();

    if (e.uv) {
      const isFixedLogoType =
        config.id === "TYPE-2" ||
        config.id === "TYPE-3" ||
        config.id === "TYPE-4" ||
        config.id === "TYPE-5";

      onLogoTransformChange(activeLogo.id, {
        ...activeLogo.transform,
        x: e.uv.x - 0.5,
        y: isFixedLogoType ? e.uv.y - 0.5 : 0.5 - e.uv.y,
      });
    }
  };

  const onPointerUp = () => {
    draggingRef.current = false;
  };

  const activePatternMesh = patternMesh ?? logoMesh;
  const DRAG_SENSITIVITY = 2.5;

  const onPatternPointerDown = (e: any) => {
    if (!dragPatternMode || !isPatternEnabled || !activePatternMesh || !patternTransform || !onPatternTransformChange) return;
    if (e?.object !== activePatternMesh) return;

    e.stopPropagation();
    draggingPatternRef.current = true;

    if (e.uv) {
      patternDragStartRef.current = {
        x: e.uv.x,
        y: e.uv.y,
        px: patternTransform.x,
        py: patternTransform.y,
      };
    }
  };

  const onPatternPointerMove = (e: any) => {
    if (
      !dragPatternMode ||
      !draggingPatternRef.current ||
      !isPatternEnabled ||
      !activePatternMesh ||
      !patternTransform ||
      !onPatternTransformChange ||
      !patternDragStartRef.current
    ) {
      return;
    }

    if (e?.object !== activePatternMesh) return;

    e.stopPropagation();

    if (e.uv) {
      const start = patternDragStartRef.current;
      if (!start) return;

      const angle = patternRotation || 0;
      const currentZoom = patternTransform.zoom > 0 ? patternTransform.zoom : 1;

      const du = (e.uv.x - start.x) / currentZoom;
      const dv = (e.uv.y - start.y) / currentZoom;

      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      const dx = (du * cosA + dv * sinA) * DRAG_SENSITIVITY;
      const dy = (-du * sinA + dv * cosA) * DRAG_SENSITIVITY;

      onPatternTransformChange({
        ...patternTransform,
        x: Math.min(1, Math.max(0, start.px + dx)),
        y: Math.min(1, Math.max(0, start.py + dy)),
      });
    }
  };

  const onPatternPointerUp = () => {
    draggingPatternRef.current = false;
    patternDragStartRef.current = null;
  };

  return (
    <>
      <group
        onPointerDown={(e) => {
          onPointerDown(e);
          onPatternPointerDown(e);
        }}
        onPointerMove={(e) => {
          onPointerMove(e);
          onPatternPointerMove(e);
        }}
        onPointerUp={() => {
          onPointerUp();
          onPatternPointerUp();
        }}
        onPointerOut={() => {
          onPointerUp();
          onPatternPointerUp();
        }}
      >
        {/* ✅ 1. เพิ่มบรรทัดนี้ครอบไว้ */}
        <Center>
          <primitive object={scene} />

          {logoMesh && logos?.map((logo, index) => (
            logo.url ? (
              <LogoLayer
                key={logo.id}
                logoMesh={logoMesh}
                config={config}
                logo={logo}
                index={index}
              />
            ) : null
          ))}
        </Center>
        {/* ✅ 2. ปิด Tag ตรงนี้ */}

      </group>

      {/* ✅ ถอด <FitToObject /> ออก เพื่อไม่ให้มันไปแย่งดึงกล้องกับฟังก์ชันที่เซ็ตไว้ */}
    </>
  );
}

export default function Plug3D({
  config,
  logos,
  activeLogoId,
  onLogoTransformChange,
  patternUrl,
  colors,
  patternTransform,
  onPatternTransformChange,
  patternRotation,
  patternBrightness = 0.75,
  patternOpacity = 1,
  patternFitMode = "contain",
  dragLogoMode = false,
  dragPatternMode = false,
  renderMode = false,
  view = "angle",
  onRenderReady,
  orbitNudgeDirection = null,
  orbitNudgeTick = 0,
}: Plug3DProps) {
  const glRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<any>(null);

  // ✅ ตัวจำค่ากล้องอยู่ที่นี่แล้ว จะไม่โดนรีเฟรชหายไปไหน
  const prevViewRef = useRef<string | null>(null);

  const cameraPos = useMemo(() => [0, 0.1, 3] as [number, number, number], []);
  const lockControls = dragLogoMode || dragPatternMode || renderMode;

  useEffect(() => {
    if (!orbitNudgeDirection || orbitNudgeTick === 0) return;

    const controls = controlsRef.current;
    const camera = cameraRef.current;
    if (!controls || !camera) return;

    const target = controls.target as THREE.Vector3;
    const offset = new THREE.Vector3().copy(camera.position).sub(target);
    const spherical = new THREE.Spherical().setFromVector3(offset);

    const AZ_STEP = 0.22;
    const POLAR_STEP = 0.16;
    const MIN_POLAR = 0.35;
    const MAX_POLAR = Math.PI - 0.35;

    if (orbitNudgeDirection === "left") spherical.theta -= AZ_STEP;
    if (orbitNudgeDirection === "right") spherical.theta += AZ_STEP;
    if (orbitNudgeDirection === "up") spherical.phi = Math.max(MIN_POLAR, spherical.phi - POLAR_STEP);
    if (orbitNudgeDirection === "down") spherical.phi = Math.min(MAX_POLAR, spherical.phi + POLAR_STEP);

    offset.setFromSpherical(spherical);
    camera.position.copy(target).add(offset);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    controls.update();
  }, [orbitNudgeDirection, orbitNudgeTick]);

  return (
    <Canvas
      gl={{ preserveDrawingBuffer: true, antialias: true, alpha: true }}
      camera={{ position: cameraPos, fov: 45 }}
      style={{
        background: "linear-gradient(180deg, #e0eaff 0%, #ffffff 100%)",
      }}
      onCreated={({ gl, camera }) => {
        glRef.current = gl;
        cameraRef.current = camera as THREE.PerspectiveCamera;
      }}
    >
      <ambientLight intensity={0.36} />
      <hemisphereLight intensity={0.28} groundColor="#ffffff" />
      <directionalLight position={[4, 6, 4]} intensity={0.32} />
      <directionalLight position={[-4, 2, 1]} intensity={0.14} />
      <directionalLight position={[0, 3, -4]} intensity={0.18} />
      <directionalLight position={[0, -3, 2]} intensity={0.12} />

      <Suspense fallback={null}>
        <PlugScene
          config={config}
          logos={logos}
          activeLogoId={activeLogoId}
          onLogoTransformChange={onLogoTransformChange}
          patternUrl={patternUrl}
          colors={colors}
          patternTransform={patternTransform}
          onPatternTransformChange={onPatternTransformChange}
          patternRotation={patternRotation}
          patternBrightness={patternBrightness}
          patternOpacity={patternOpacity}
          patternFitMode={patternFitMode}
          dragLogoMode={dragLogoMode}
          dragPatternMode={dragPatternMode}
          view={view}
          onRenderReady={onRenderReady}
          glRef={glRef}
          cameraRef={cameraRef}
          // ✅ ส่งข้อมูลไปยัง PlugScene
          prevViewRef={prevViewRef}
        />

        <EnvErrorBoundary>
          <Environment
            files={suspend(cityEnv) as string}
            environmentIntensity={0.35}
          />
        </EnvErrorBoundary>

      </Suspense>

      <OrbitControls
        makeDefault
        ref={controlsRef}
        enablePan={!lockControls}
        enableZoom={!lockControls}
        enableRotate={!lockControls}
      />
    </Canvas>
  );
}
