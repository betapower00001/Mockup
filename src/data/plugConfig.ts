// src/data/plugConfig.ts

export type ColorKey = "top" | "bottom" | "switch" | "body";

export type DecalConfig = {
  meshName: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number | [number, number, number];
};

export type PlugModelConfig = {
  id: string;
  modelPath: string;

  colorTargets: Partial<Record<ColorKey, string[]>>;

  // โลโก้
  decal: DecalConfig;

  // ลาย (pattern)
  patternDecal?: DecalConfig;
};

export const PLUG_CONFIGS: Record<string, PlugModelConfig> = {
  "TYPE-1": {
    id: "TYPE-1",
    modelPath: "/models/plug/Un1.glb",

    colorTargets: {
      top: [
        "mat_top",        // ฝาบนหลัก
        "mat_top_Front",  // หน้า Top ที่ติดโลโก้
        "Top",
        "Top_Front",
      ],
      bottom: ["mat_bottom", "Bottom"],
      switch: ["mat_swit", "Swit"],
    },


    // ✅ โลโก้ต้องเกาะ Top_Front เท่านั้น
    decal: {
      meshName: "Top_Front",
      position: [0, 0, 0.002],
      rotation: [0, 0, 0],
      scale: [0.08, 0.08, 0.08],
    },

    patternDecal: {
      meshName: "Top_Front",
      position: [0, 0, 0.002],
      rotation: [0, 0, 0],
      scale: 0.35,
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
