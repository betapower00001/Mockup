// src/data/patterns.ts

export type PatternItem = {
  id: string;
  name: string;

  // ✅ PatternPicker ใช้โชว์ thumbnail
  preview: string;

  // ✅ ใช้แปะจริงบน 3D  (texture)
  img: string;
};

const patterns: Record<string, PatternItem[]> = {
  "TYPE-1": [
    {
      id: "t1-test1",
      name: "TYPE-1 Test 1",
      preview: "/patterns/TYPE-1/test1.png",
      img: "/patterns/TYPE-1/test1.png",
    },
    {
      id: "t1-test2",
      name: "TYPE-1 Test 2",
      preview: "/patterns/TYPE-1/test2.png",
      img: "/patterns/TYPE-1/test2.png",
    },
    {
      id: "t1-test3",
      name: "TYPE-1 Test 3",
      preview: "/patterns/TYPE-1/test3.png",
      img: "/patterns/TYPE-1/test3.png",
    },

  ],

  "TYPE-2": [
   {
       id: "t2-test1",
       name: "TYPE-2 Test 1",
       preview: "/patterns/TYPE-1/test2.png",
       img: "/patterns/TYPE-1/test2.png",
     },
  ],

  "TYPE-3": [
    // ใส่ลายของ TYPE-3
  ],

  "TYPE-4": [
    // ใส่ลายของ TYPE-4
  ],
};

export default patterns;
