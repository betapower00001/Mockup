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
  zoom: number; // 1..
};

type Plug3DProps = {
  config: PlugModelConfig;
  logoUrl?: string;
  patternUrl?: string;
  colors: Partial<Record<ColorKey, string>>;

  logoTransform?: LogoTransform;
  onLogoTransformChange?: (t: LogoTransform) => void;

  patternTransform?: PatternTransform;

  dragLogoMode?: boolean;

  renderMode?: boolean;
  onRenderReady?: (render: (opts?: { transparent?: boolean; filename?: string }) => void) => void;
};

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

/**
 * เลือก plane ที่มีพื้นที่มากสุด: XY / XZ / YZ
 */
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

/**
 * ✅ Local planar UV (ของเดิม) + force/lockAxes
 */
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

// -------------------------
// ✅ WORLD PLANAR UV + COVER
// -------------------------
function getDuDvFromWorldBox(bb: THREE.Box3, axes: UVProjection) {
  const dx = Math.abs(bb.max.x - bb.min.x) || 1;
  const dy = Math.abs(bb.max.y - bb.min.y) || 1;
  const dz = Math.abs(bb.max.z - bb.min.z) || 1;

  if (axes === "XY") return { du: dx, dv: dy };
  if (axes === "XZ") return { du: dx, dv: dz };
  return { du: dy, dv: dz };
}

/**
 * ✅ สร้าง UV จาก world position เพื่อให้ “ต่อผืนเดียว” ระหว่างหลาย mesh
 */
function ensureWorldPlanarUV(args: {
  mesh: THREE.Mesh;
  axes: UVProjection;
  worldBBox: THREE.Box3;
  force?: boolean;
  flipU?: boolean;
  flipV?: boolean;
}) {
  const { mesh, axes, worldBBox, force, flipU, flipV } = args;

  const geo = mesh.geometry as THREE.BufferGeometry;
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  if (!pos) return;

  const existingUV = geo.getAttribute("uv") as THREE.BufferAttribute | undefined;
  if (!force && existingUV && existingUV.count === pos.count) return;

  mesh.updateWorldMatrix(true, false);

  const dx = (worldBBox.max.x - worldBBox.min.x) || 1;
  const dy = (worldBBox.max.y - worldBBox.min.y) || 1;
  const dz = (worldBBox.max.z - worldBBox.min.z) || 1;

  const vLocal = new THREE.Vector3();
  const vWorld = new THREE.Vector3();
  const uv = new Float32Array(pos.count * 2);

  const baseFlipU = true; // ให้ทิศเหมือนของเดิม

  for (let i = 0; i < pos.count; i++) {
    vLocal.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    vWorld.copy(vLocal).applyMatrix4(mesh.matrixWorld);

    let u = 0,
      v = 0;

    if (axes === "XY") {
      u = (vWorld.x - worldBBox.min.x) / dx;
      v = (vWorld.y - worldBBox.min.y) / dy;
    } else if (axes === "XZ") {
      u = (vWorld.x - worldBBox.min.x) / dx;
      v = (vWorld.z - worldBBox.min.z) / dz;
    } else {
      u = (vWorld.y - worldBBox.min.y) / dy;
      v = (vWorld.z - worldBBox.min.z) / dz;
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

/**
 * ✅ cover + pan/zoom โดยอิง “surface size” (worldBBox เดียวกัน → ต่อผืนเดียว)
 */
function applyCoverWithPanOnSurface(
  tex: THREE.Texture,
  texW: number,
  texH: number,
  surfaceU: number,
  surfaceV: number,
  pan?: PatternTransform
) {
  const EPS = 1e-6;
  const texAspect = texW / texH;
  const surfAspect = surfaceU / Math.max(surfaceV, EPS);

  let repX = 1;
  let repY = 1;

  // cover: ไม่ยืด แต่ crop ได้
  if (surfAspect > texAspect) {
    repX = 1;
    repY = texAspect / surfAspect;
  } else {
    repY = 1;
    repX = surfAspect / texAspect;
  }

  const zoom = Math.max(1, pan?.zoom ?? 1);
  repX /= zoom;
  repY /= zoom;

  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(repX, repY);

  const rangeX = Math.max(0, 1 - repX);
  const rangeY = Math.max(0, 1 - repY);

  const px = clamp01(pan?.x ?? 0.5);
  const py = clamp01(pan?.y ?? 0.5);

  tex.offset.set(rangeX * px, rangeY * (1 - py));
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

// --------------------------------------
// ✅ apply pattern to a mesh
// - worldBBox => world-planar cover (ต่อผืนเดียว)
// - no worldBBox => local cover (ต่อชิ้น)
// --------------------------------------
function applyPatternToMesh(args: {
  targetMesh: THREE.Mesh;
  patternTex: THREE.Texture;
  isPatternEnabled: boolean;
  axes: UVProjection;
  pan?: PatternTransform;
  worldBBox?: THREE.Box3 | null;
}) {
  const { targetMesh, patternTex, isPatternEnabled, axes, pan, worldBBox } = args;

  const mats = Array.isArray(targetMesh.material) ? targetMesh.material : [targetMesh.material];

  if (!isPatternEnabled) {
    mats.forEach((m: any) => {
      if (!m) return;
      if ("map" in m) {
        m.map = null;
        m.needsUpdate = true;
      }
    });
    return () => {};
  }

  const p = pan ?? { x: 0.5, y: 0.5, zoom: 1 };

  // ✅ WORLD-PLANAR COVER (ต่อผืนเดียว)
  if (worldBBox) {
    const tex = patternTex.clone();
    tex.colorSpace = THREE.SRGBColorSpace;
    (tex as any).flipY = false;
    tex.needsUpdate = true;

    const img: any = (tex as any).image;
    const w = img?.width;
    const h = img?.height;

    if (w && h) {
      const { du, dv } = getDuDvFromWorldBox(worldBBox, axes);
      applyCoverWithPanOnSurface(tex, w, h, du, dv, p);
    } else {
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.repeat.set(1, 1);
      tex.offset.set(0, 0);
      tex.needsUpdate = true;
    }

    mats.forEach((m: any) => {
      if (!m) return;
      m.map = tex;
      m.needsUpdate = true;
    });

    return () => {
      try {
        tex.dispose();
      } catch {}
    };
  }

  // ✅ LOCAL COVER (ต่อชิ้น แบบเดิม)
  const tex = patternTex.clone();
  tex.colorSpace = THREE.SRGBColorSpace;
  (tex as any).flipY = false;
  tex.needsUpdate = true;

  const img: any = (tex as any).image;
  const w = img?.width;
  const h = img?.height;

  if (w && h) {
    const geo = targetMesh.geometry as THREE.BufferGeometry;
    geo.computeBoundingBox();
    const bb = geo.boundingBox;

    if (bb) {
      const size = new THREE.Vector3();
      bb.getSize(size);

      const sx = Math.abs(size.x) || 1;
      const sy = Math.abs(size.y) || 1;
      const sz = Math.abs(size.z) || 1;

      const surfaceU = axes === "XY" ? sx : axes === "XZ" ? sx : sy;
      const surfaceV = axes === "XY" ? sy : axes === "XZ" ? sz : sz;

      applyCoverWithPanOnSurface(tex, w, h, surfaceU, surfaceV, p);
    }
  } else {
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.repeat.set(1, 1);
    tex.offset.set(0, 0);
    tex.needsUpdate = true;
  }

  mats.forEach((m: any) => {
    if (!m) return;
    if (
      m instanceof THREE.MeshStandardMaterial ||
      m instanceof THREE.MeshPhysicalMaterial ||
      m instanceof THREE.MeshPhongMaterial ||
      m instanceof THREE.MeshLambertMaterial
    ) {
      m.map = tex;
      m.needsUpdate = true;
    } else {
      // เผื่อ material แปลกจาก GLB
      (m as any).map = tex;
      (m as any).needsUpdate = true;
    }
  });

  return () => {
    try {
      tex.dispose();
    } catch {}
  };
}

function PlugScene({
  config,
  logoUrl,
  patternUrl,
  colors,
  logoTransform,
  onLogoTransformChange,
  patternTransform,
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
  dragLogoMode?: boolean;
  onRenderReady?: Plug3DProps["onRenderReady"];
  glRef: React.MutableRefObject<THREE.WebGLRenderer | null>;
  cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>;
}) {
  const { scene } = useGLTF(config.modelPath);

  const [logoMesh, setLogoMesh] = useState<THREE.Mesh | null>(null);
  const [patternMesh, setPatternMesh] = useState<THREE.Mesh | null>(null);
  const [patternSideMesh, setPatternSideMesh] = useState<THREE.Mesh | null>(null);

  // ✅ world bbox สำหรับ “ต่อผืนเดียว”
  const patternWorldBBox = useMemo(() => {
    const wantsWorld =
      config.patternDecal?.uvSpace === "world" || config.patternSideDecal?.uvSpace === "world";
    if (!wantsWorld) return null;

    return computePatternWorldBBox(scene, config.patternWorldBBoxMeshes);
  }, [
    scene,
    config.modelPath,
    config.patternDecal?.uvSpace,
    config.patternSideDecal?.uvSpace,
    (config.patternWorldBBoxMeshes || []).join("|"),
  ]);

  // โลโก้ (Front) — local UV
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
    config.modelPath,
    config.decal.meshName,
    config.decal.uvProjection,
    config.decal.flipU,
    config.decal.flipV,
    config.decal.forceUV,
    config.decal.lockAxes,
  ]);

  // ลายหน้า (Front pattern) — ถ้า world จะสร้าง world-planar UV
  useEffect(() => {
    const meshName = config.patternDecal?.meshName ?? config.decal.meshName;
    const pm = findMeshByName(scene, meshName);

    if (pm && config.patternDecal) {
      const axes = (config.patternDecal.uvProjection ?? config.decal.uvProjection ?? "XZ") as UVProjection;
      const fu = config.patternDecal.flipU ?? config.decal.flipU;
      const fv = config.patternDecal.flipV ?? config.decal.flipV;
      const force = config.patternDecal.forceUV ?? false;
      const space: UVSpace = config.patternDecal.uvSpace ?? "local";

      if (space === "world" && patternWorldBBox) {
        ensureWorldPlanarUV({
          mesh: pm,
          axes,
          worldBBox: patternWorldBBox,
          force: true,
          flipU: fu,
          flipV: fv,
        });
      } else {
        ensurePlanarUV(pm, axes, fu, fv, force, config.patternDecal.lockAxes);
      }
    }

    setPatternMesh(pm);
  }, [
    scene,
    config.modelPath,
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
  ]);

  // ลายด้านข้าง (Top_Side) — ถ้า world จะสร้าง world-planar UV
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
        });
      } else {
        ensurePlanarUV(
          sm,
          axes,
          fu,
          fv,
          config.patternSideDecal.forceUV ?? false,
          config.patternSideDecal.lockAxes
        );
      }
    }

    setPatternSideMesh(sm);
  }, [
    scene,
    config.modelPath,
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
  ]);

  const stickerTex = useStickerTexture(
    logoUrl,
    logoTransform
      ? {
          x: logoTransform.x,
          y: logoTransform.y,
          scale: Array.isArray(logoTransform.scale) ? logoTransform.scale[0] : logoTransform.scale,
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

  // ✅ ลายหน้า
  useEffect(() => {
    const targetMesh = patternMesh ?? logoMesh;
    if (!targetMesh) return;

    const axes = (config.patternDecal?.uvProjection ?? config.decal.uvProjection ?? "XZ") as UVProjection;
    const pan = patternTransform ?? { x: 0.5, y: 0.5, zoom: 1 };
    const wantsWorld = config.patternDecal?.uvSpace === "world";

    const cleanup = applyPatternToMesh({
      targetMesh,
      patternTex,
      isPatternEnabled,
      axes,
      pan,
      worldBBox: wantsWorld ? patternWorldBBox : null,
    });

    return cleanup;
  }, [
    logoMesh,
    patternMesh,
    isPatternEnabled,
    patternTex,
    patternTransform?.x,
    patternTransform?.y,
    patternTransform?.zoom,
    config.decal.uvProjection,
    config.patternDecal?.uvProjection,
    config.patternDecal?.uvSpace,
    patternWorldBBox,
  ]);

  // ✅ ลายด้านข้าง — ใช้ bbox เดียวกัน → ต่อผืนเดียวกับ Top_Front
  useEffect(() => {
    if (!patternSideMesh) return;

    const axes =
      (config.patternSideDecal?.uvProjection ??
        config.patternDecal?.uvProjection ??
        config.decal.uvProjection ??
        "XZ") as UVProjection;

    const pan = patternTransform ?? { x: 0.5, y: 0.5, zoom: 1 };
    const wantsWorld = config.patternSideDecal?.uvSpace === "world";

    const cleanup = applyPatternToMesh({
      targetMesh: patternSideMesh,
      patternTex,
      isPatternEnabled,
      axes,
      pan,
      worldBBox: wantsWorld ? patternWorldBBox : null,
    });

    return cleanup;
  }, [
    patternSideMesh,
    isPatternEnabled,
    patternTex,
    patternTransform?.x,
    patternTransform?.y,
    patternTransform?.zoom,
    config.patternSideDecal?.uvProjection,
    config.patternSideDecal?.uvSpace,
    config.patternDecal?.uvProjection,
    config.decal.uvProjection,
    patternWorldBBox,
  ]);

  // โลโก้ overlay
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

  // render export
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

  // drag logo
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
    if (
      !dragLogoMode ||
      !draggingRef.current ||
      !logoUrl ||
      !logoMesh ||
      !logoTransform ||
      !onLogoTransformChange
    )
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
          dragLogoMode={dragLogoMode}
          onRenderReady={onRenderReady}
          glRef={glRef}
          cameraRef={cameraRef}
        />
        <Environment preset="apartment" environmentIntensity={0.18} />
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
