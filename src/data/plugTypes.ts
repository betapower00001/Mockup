// src/data/plugTypes.ts

export interface PlugType {
  id: string;        // ใช้เป็น key หลัก (ตรงกับ patterns / plugConfig)
  name: string;      // ชื่อแสดงใน UI
  thumb?: string;    // thumbnail ใน PlugSelector
  modelPath: string; // path ไปไฟล์ GLB (public)
}

export const plugTypes: PlugType[] = [
  {
    id: "TYPE-1",
    name: "Wallace",
    thumb: "/plugs/TYPE-1/T-1.png",
    modelPath: "/models/plug/Un1.glb",
  },
  {
    id: "TYPE-2",
    name: "Arthur",
    thumb: "/plugs/TYPE-2/thumb.png",
    modelPath: "/models/plug/Un2.glb",
  },
  {
    id: "TYPE-3",
    name: "EU",
    thumb: "/plugs/TYPE-3/thumb.png",
    modelPath: "/models/plug/Un3.glb",
  },
  {
    id: "TYPE-4",
    name: "US / UK",
    thumb: "/plugs/TYPE-4/thumb.png",
    modelPath: "/models/plug/Un4.glb",
  },
    {
    id: "TYPE-5",
    name: "US / UK",
    thumb: "/plugs/TYPE-5/thumb.png",
    modelPath: "/models/plug/Un4.glb",
  },
];

export default plugTypes;
