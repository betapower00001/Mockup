// src/data/patterns.ts

export type PatternItem = {
  id: string;
  name: string;

  // ✅ PatternPicker ใช้โชว์ thumbnail
  preview: string;

  // ✅ ใช้แปะจริงบน 3D (texture)
  img: string;
};

const patterns: Record<string, PatternItem[]> = {
  universal: [
    {
      id: "line-black",
      name: "Line Black",
      preview: "/patterns/food/Test.png",
      img: "/patterns/food/Test.png",
    },
    {
      id: "carbon",
      name: "Carbon",
      preview: "/patterns/thumbs/carbon.png",
      img: "/patterns/textures/carbon.png",
    },
    {
      id: "dot",
      name: "Dot",
      preview: "/patterns/thumbs/dot.png",
      img: "/patterns/textures/dot.png",
    },
  ],

  thai: [
    {
      id: "line-gray",
      name: "Line Gray",
      preview: "/patterns/thumbs/line-gray.png",
      img: "/patterns/textures/line-gray.png",
    },
  ],
};

export default patterns;
