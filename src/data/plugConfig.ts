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

  // ✅ NEW: หมุนลาย (rad) ใช้กับ pattern overlay เท่านั้น
  // ใส่เฉพาะ patternDecal/patternSideDecal (ไม่ใส่ = ไม่กระทบของเดิม)
  patternRotation?: number; // เช่น -Math.PI/2 หรือ Math.PI/2
};

// ✅ ตัวเลือกสำหรับ TRIPLANAR (ใช้กับ "ลาย" เท่านั้น)
export type PatternTriplanarConfig = {
  scale?: number; // ความถี่ลาย
  blend?: number; // ความนุ่มการ blend
  seed?: number; // ความสุ่ม
};

export type PlugModelConfig = {
  id: string;
  modelPath: string;

  colorTargets: Partial<Record<ColorKey, string[]>>;

  // โลโก้
  decal: DecalConfig;

  // ลาย "หน้าหลัก"
  patternDecal?: DecalConfig;

  // ลาย "ด้านข้าง"
  patternSideDecal?: DecalConfig;

  // ปรับ triplanar ต่อรุ่น
  patternTriplanar?: PatternTriplanarConfig;

  // mesh ที่ใช้คำนวณ bbox สำหรับ “ผืนเดียว”
  patternWorldBBoxMeshes?: string[];

  // ✅ ให้ world UV “ตรง” ตามแนวชิ้นงาน (กันลายเอียง/ไหล)
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

    // ใช้คำนวณ bbox สำหรับ world cover ของ Top_Front
    patternWorldBBoxMeshes: ["Top_Front", "Top_Side"],

    // อ้างอิงแนวชิ้นงาน เพื่อกัน "ลายเอียง/ไหลลง"
    patternWorldRefMesh: "Top_Front",

    // โลโก้ (local)
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

    // ✅ ลายหน้า: ใช้ world + align (กันเอียง) + ใช้แกน XY (กันบีบ/ซูมเพี้ยน)
    // ✅ หมุนลาย -90° เพื่อให้ “ตรงทิศ” (จากที่มันตั้งเป็นแนวยาว)
    patternDecal: {
      meshName: "Top_Front",
      position: [0, 0, 0.002],
      rotation: [0, 0, 0],
      scale: 0.35,

      uvProjection: "YZ",   // ✅ แนะนำเริ่มจาก YZ
      flipU: false,
      flipV: false,

      forceUV: true,
      uvSpace: "world",

      patternRotation: -Math.PI / 2,
    },

    // Top_Side: ไม่แปะลายแล้ว (สีพื้นตามโทนเฉลี่ยของลาย คำนวณใน Plug3D)
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

      enablePattern: false, // ✅ ปิดการแปะลายด้านข้าง
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