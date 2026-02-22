// src/data/plugConfig.ts

export type ColorKey = "top" | "bottom" | "switch" | "body";
export type UVProjection = "XY" | "XZ" | "YZ";
export type UVSpace = "local" | "world";

export type DecalConfig = {
  meshName: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number | [number, number, number];

  uvProjection?: UVProjection;

  // flip UV (ใช้กับ local planar)
  flipU?: boolean;
  flipV?: boolean;

  forceUV?: boolean;
  lockAxes?: boolean;

  // local = แบบเดิม
  // world = โหมด world ต่อผืน
  uvSpace?: UVSpace;

  // ✅ สำหรับ "ลาย" บางชิ้น ไม่ต้องแปะลาย (เช่น TYPE-2 Top_Side)
  enablePattern?: boolean; // default = true

  // ✅ หมุนลาย (rad) ใช้กับ pattern overlay เท่านั้น
  patternRotation?: number; // เช่น -Math.PI/2 หรือ Math.PI/2

  // ✅ NEW: เปิดโหมด Triplanar (กันยืดทุกมุม) — ใช้กับ "ลาย" เท่านั้น
  useTriplanar?: boolean; // default = false

  // ✅ NEW: กัน “แกนเอียง/แกนไม่ตรง” โดยล็อคแกน world จาก ref mesh
  worldAlign?: boolean; // default = true
};

// ✅ ตัวเลือกสำหรับ TRIPLANAR (ใช้กับ "ลาย" เท่านั้น)
export type PatternTriplanarConfig = {
  scale?: number; // ความถี่ลาย (ยิ่งมากลายยิ่งถี่)
  blend?: number; // ความนุ่มรอยต่อ (ยิ่งมากยิ่งเนียน)
  seed?: number; // เผื่ออนาคต (ตอนนี้ยังไม่ใช้)
};

export type PlugModelConfig = {
  id: string;
  modelPath: string;

  colorTargets: Partial<Record<ColorKey, string[]>>;

  decal: DecalConfig;

  patternDecal?: DecalConfig;
  patternSideDecal?: DecalConfig;

  patternTriplanar?: PatternTriplanarConfig;

  patternWorldBBoxMeshes?: string[];
  patternWorldRefMesh?: string;
};

export const PLUG_CONFIGS: Record<string, PlugModelConfig> = {
  "TYPE-1": {
    id: "TYPE-1",
    modelPath: "/models/plug/Un1.glb",

    colorTargets: {
      top: ["mat_top", "mat_top_Front", "Top", "Top_Front"],
      bottom: ["mat_bottom", "Bottom"],
      switch: ["mat_swit", "Swit"],
    },

    decal: {
      meshName: "Top_Front",
      position: [0, 0, 0.002],
      rotation: [0, 0, 0],
      scale: [0.08, 0.08, 0.08],
      uvProjection: "XZ",
      flipU: false,
      flipV: true,
      uvSpace: "local",
    },

    patternDecal: {
      meshName: "Top_Front",
      position: [0, 0, 0.002],
      rotation: [0, 0, 0],
      scale: 0.35,
      uvProjection: "XZ",
      flipU: false,
      flipV: true,
      uvSpace: "local",
      useTriplanar: false,
    },
  },

  "TYPE-2": {
    id: "TYPE-2",
    modelPath: "/models/plug/Un2.glb",

    colorTargets: {
      top: ["mat_top", "mat_top_Front", "Top", "Top_Front", "Top_Side", "mat_top_Side"],
      bottom: ["mat_bottom", "Bottom"],
      switch: ["mat_swit", "Swit"],
    },

    patternWorldBBoxMeshes: ["Top_Front"],
    patternWorldRefMesh: "Top_Front",

    decal: {
      meshName: "Top_Front",
      position: [0, 0, 0.002],
      rotation: [0, 0, 0],
      scale: [0.08, 0.08, 0.08],
      uvProjection: "YZ",
      flipU: false,
      flipV: false,
      uvSpace: "local",
    },

    patternDecal: {
      meshName: "Top_Front",
      position: [0, 0, 0.002],
      rotation: [0, 0, 0],
      scale: 0.35,

      uvProjection: "YZ",
      flipU: false,
      flipV: false,
      forceUV: true,
      uvSpace: "world",

      useTriplanar: true,
      patternRotation: -Math.PI / 2,
      worldAlign: true,
    },

    patternSideDecal: {
      meshName: "Top_Side",
      position: [0, 0, 0.002],
      rotation: [0, 0, 0],
      scale: 0.35,

      uvProjection: "XY",
      flipU: true,
      flipV: false,

      forceUV: true,
      lockAxes: true,
      uvSpace: "world",

      enablePattern: false,
      worldAlign: true,
    },

    patternTriplanar: {
      scale: 2.5,
      blend: 6.0,
      seed: 1.0,
    },
  },

  // ==========================================================
  // ✅ TYPE-3 (FIX: แกนลายไม่เอียง + ไม่บีบยืด)
  // ==========================================================
  "TYPE-3": {
    id: "TYPE-3",
    modelPath: "/models/plug/Un3.glb",

    colorTargets: {
      top: ["Top_Front", "Top_Side", "mat_top_Front", "mat_top_Side"],
      bottom: ["Bottom", "mat_bottom"],
    },

    patternWorldBBoxMeshes: ["Top_Front"],
    patternWorldRefMesh: "Top_Front",

    decal: {
      meshName: "Top_Front",
      position: [0, 0, 0.002],
      rotation: [0, 0, 0],
      scale: [0.08, 0.08, 0.08],
      uvProjection: "XZ",
      flipU: false,
      flipV: true,
      uvSpace: "local",
    },

    patternDecal: {
      meshName: "Top_Front",
      position: [0, 0, 0.002],
      rotation: [0, 0, 0],
      scale: 0.35,

      uvProjection: "XZ",
      uvSpace: "world",
      forceUV: true,

      // ✅ FIX: ล็อคแกน world ไม่ให้ auto-swap (กัน skew ตอนหมุนองศาอื่น)
      lockAxes: true,

      flipU: false,
      flipV: true,

      // ✅ FIX: ไม่ใส่ rotation เริ่มต้นใน config (กัน double-rotation)
      // ให้หมุนด้วยปุ่ม UI เท่านั้น
      patternRotation: 0,

      enablePattern: true,
      worldAlign: true,
    },

    patternSideDecal: {
      meshName: "Top_Side",
      position: [0, 0, 0.002],
      rotation: [0, 0, 0],
      scale: 0.35,

      uvProjection: "XZ",
      flipU: true,
      flipV: false,

      uvSpace: "world",
      forceUV: true,

      // ✅ FIX: ล็อคแกนเช่นกัน
      lockAxes: true,

      enablePattern: false,
      worldAlign: true,
    },

    patternTriplanar: {
      scale: 2.5,
      blend: 6.0,
      seed: 1.0,
    },
  },
};

export function getPlugConfig(id: string, override?: { modelPath?: string }): PlugModelConfig {
  const base = PLUG_CONFIGS[id] ?? PLUG_CONFIGS["TYPE-1"];
  return {
    ...base,
    id,
    modelPath: override?.modelPath ?? base.modelPath,
  };
}