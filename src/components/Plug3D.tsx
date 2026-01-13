// src/components/Plug3D.tsx
"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { PlugModelConfig, ColorKey } from "../data/plugConfig";
import type { LogoTransform } from "./PlugCustomizer";
import FitToObject from "./FitToObject";
import { useStickerTexture } from "./useStickerTexture";

type Plug3DProps = {
  config: PlugModelConfig;
  logoUrl?: string;
  patternUrl?: string;
  colors: Partial<Record<ColorKey, string>>;
  logoTransform?: LogoTransform;
  onLogoTransformChange?: (t: LogoTransform) => void;
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
    const r = h[1], g = h[2], b = h[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  if (h.length === 7) return h;
  return null;
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

      if (cloned.color) cloned.color = col.clone();
      cloned.needsUpdate = true;

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
 * ✅ AutoUV (Planar) แบบโค้ดล้วน
 * - สร้าง uv ให้ geometry (ใช้แกน X/Y)
 * - ทำให้ raycaster ให้ e.uv ได้
 */
function ensurePlanarUV(mesh: THREE.Mesh) {
  const geo = mesh.geometry as THREE.BufferGeometry;
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  if (!pos) return;

  const existingUV = geo.getAttribute("uv") as THREE.BufferAttribute | undefined;
  if (existingUV && existingUV.count === pos.count) return;

  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  if (!bb) return;

  const size = new THREE.Vector3();
  bb.getSize(size);

  // ✅ เลือกแกนฉายอัตโนมัติ:
  // - หาแกนที่ "บางสุด" (มีความหนาน้อยสุด) แล้ว "ไม่ใช้" แกนนั้นเป็นระนาบ UV
  //   เช่น ถ้า Y บางสุด → ใช้ XZ
  const abs = (n: number) => Math.abs(n);
  const sx = abs(size.x) || 1;
  const sy = abs(size.y) || 1;
  const sz = abs(size.z) || 1;

  type Axes = "XY" | "XZ" | "YZ";
  let axes: Axes = "XZ"; // default

  const minAxis = Math.min(sx, sy, sz);
  if (minAxis === sy) axes = "XZ";
  else if (minAxis === sx) axes = "YZ";
  else axes = "XY";

  // ✅ สร้าง UV 0..1 จาก bbox ในระนาบที่เลือก
  const uv = new Float32Array(pos.count * 2);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    let u = 0, v = 0;

    if (axes === "XY") {
      const dx = (bb.max.x - bb.min.x) || 1;
      const dy = (bb.max.y - bb.min.y) || 1;
      u = (x - bb.min.x) / dx;
      v = (y - bb.min.y) / dy;
    } else if (axes === "XZ") {
      const dx = (bb.max.x - bb.min.x) || 1;
      const dz = (bb.max.z - bb.min.z) || 1;
      u = (x - bb.min.x) / dx;
      v = (z - bb.min.z) / dz;
    } else { // YZ
      const dy = (bb.max.y - bb.min.y) || 1;
      const dz = (bb.max.z - bb.min.z) || 1;
      u = (y - bb.min.y) / dy;
      v = (z - bb.min.z) / dz;
    }

    // clamp กันหลุด
    u = Math.min(1, Math.max(0, u));
    v = Math.min(1, Math.max(0, v));

    uv[i * 2] = 1 - u;   // ✅ flip U (แก้กลับกระจก)
    uv[i * 2 + 1] = v;


  }

  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  (geo.getAttribute("uv") as THREE.BufferAttribute).needsUpdate = true;

  console.log("[AutoUV] axes:", axes, "size:", { x: sx, y: sy, z: sz });
}


function PlugScene({
  config,
  logoUrl,
  colors,
  logoTransform,
  onLogoTransformChange,
  dragLogoMode,
  onRenderReady,
  glRef,
  cameraRef,
}: {
  config: PlugModelConfig;
  logoUrl?: string;
  colors: Partial<Record<ColorKey, string>>;
  logoTransform?: LogoTransform;
  onLogoTransformChange?: (t: LogoTransform) => void;
  dragLogoMode?: boolean;
  onRenderReady?: Plug3DProps["onRenderReady"];
  glRef: React.MutableRefObject<THREE.WebGLRenderer | null>;
  cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>;
}) {
  const { scene } = useGLTF(config.modelPath);

  const [logoMesh, setLogoMesh] = useState<THREE.Mesh | null>(null);

  // ✅ หา mesh + AutoUV ให้มัน
  useEffect(() => {
    const m = findMeshByName(scene, config.decal.meshName);
    console.log("[Plug3D] meshName:", config.decal.meshName, "found:", !!m, "model:", config.modelPath);

    if (m) {
      ensurePlanarUV(m);
      const uvAttr = (m.geometry as THREE.BufferGeometry).getAttribute("uv");
      console.log("[Plug3D] uv exists:", !!uvAttr, "uv count:", uvAttr?.count);
    }
    setLogoMesh(m);
  }, [scene, config.decal.meshName, config.modelPath]);

  // ✅ Sticker texture (วาดโลโก้ลง canvas)
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

  // ✅ apply สี
  useEffect(() => {
    applyColorsByTargets(scene, config.colorTargets, colors);
  }, [scene, config.colorTargets, colors]);

  // ✅ Overlay mesh (กันพื้นยุบ)
  useEffect(() => {
    if (!logoMesh) return;

    const old = logoMesh.getObjectByName("__LOGO_OVERLAY__");
    if (old) old.parent?.remove(old);

    if (!logoUrl || !stickerTex) return;

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

  // ✅ Render download callback
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

  // ✅ Drag logo ด้วย e.uv (ตอนนี้ไม่ undefined แล้ว เพราะมี AutoUV)
  const draggingRef = useRef(false);

  const onPointerDown = (e: any) => {
    if (!dragLogoMode || !logoUrl || !logoMesh || !logoTransform || !onLogoTransformChange) return;

    // ✅ ให้โดนเฉพาะชิ้นที่ตั้งใจติดโลโก้
    if (e?.object !== logoMesh) return;

    e.stopPropagation();
    draggingRef.current = true;

    if (e.uv) {
      onLogoTransformChange({
        ...logoTransform,
        x: e.uv.x - 0.5,
        y: 0.5 - e.uv.y,
      });
    } else {
      console.log("[Drag] uv still undefined (check UV exists)");
    }
  };

  const onPointerMove = (e: any) => {
    if (!dragLogoMode || !draggingRef.current || !logoUrl || !logoMesh || !logoTransform || !onLogoTransformChange) return;
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
  colors,
  logoTransform,
  onLogoTransformChange,
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
          colors={colors}
          logoTransform={logoTransform}
          onLogoTransformChange={onLogoTransformChange}
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
