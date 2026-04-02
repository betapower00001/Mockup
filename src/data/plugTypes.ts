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
    name: "Hector",
    thumb: "/plugs/TYPE-2/T-2.png",
    modelPath: "/models/plug/Un2.glb",
  },
  {
    id: "TYPE-3",
    name: "Caesar",
    thumb: "/plugs/TYPE-3/T-3.png",
    modelPath: "/models/plug/Un3.glb",
  },
  {
    id: "TYPE-4",
    name: "Mulan",
    thumb: "/plugs/TYPE-4/T-4.png",
    modelPath: "/models/plug/Un4.glb",
  },
    {
    id: "TYPE-5",
    name: "Arthur",
    thumb: "/plugs/TYPE-5/thumb.png",
    modelPath: "/models/plug/Un4.glb",
  },
];

export default plugTypes;
