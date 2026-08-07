// src/data/plugTypes.ts

export interface PlugType {
  id: string;                   // ใช้เป็น key หลัก (ตรงกับ patterns / plugConfig)
  name: string;                 // ชื่อแสดงใน UI
  thumb?: string;               // thumbnail ใน PlugSelector
  modelPath: string;            // GLB สำหรับจอ Mockup หลัก
  productionModelPath?: string; // GLB แยกสำหรับจอเล็ก + Export ส่งผลิต
}

export const plugTypes: PlugType[] = [
  {
    id: "TYPE-1",
    name: "Arthur",
    thumb: "/plugs/TYPE-1/T-1.png",
    modelPath: "/models/plug/Un1.glb",
    productionModelPath: "/models/plug/production/Un1-production.glb",
  },
  {
    id: "TYPE-5",
    name: "Hector",
    thumb: "/plugs/TYPE-5/T-5.png",
    modelPath: "/models/plug/Un5.glb",
    productionModelPath: "/models/plug/production/Un5-production.glb",
  },
  {
    id: "TYPE-2",
    name: "Wallace",
    thumb: "/plugs/TYPE-2/T-2.png",
    modelPath: "/models/plug/Un2.glb",
    productionModelPath: "/models/plug/production/Un2-production.glb",
  },
  {
    id: "TYPE-3",
    name: "Caesar",
    thumb: "/plugs/TYPE-3/T-3.png",
    modelPath: "/models/plug/Un3.glb",
    productionModelPath: "/models/plug/production/Un3-production.glb",
  },
  {
    id: "TYPE-4",
    name: "Mulan",
    thumb: "/plugs/TYPE-4/T-4.png",
    modelPath: "/models/plug/Un4.glb",
    productionModelPath: "/models/plug/production/Un4-production.glb",
  },
];

export default plugTypes;