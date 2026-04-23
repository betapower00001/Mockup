// src/data/patterns.ts

export type PatternItem = {
  id: string;
  name: string;
  preview: string;
  img: string;
};

export type PatternGroup = {
  id: string;
  label: string;
  items: PatternItem[];
};

const patternGroups: Record<string, PatternGroup[]> = {
  "TYPE-1": [
    {
      id: "basic",
      label: "การเมือง",
      items: [
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
      ],
    },
    {
      id: "special",
      label: "การศึกษา",
      items: [
        {
          id: "t1-test3",
          name: "TYPE-1 Test 3",
          preview: "/patterns/TYPE-1/test3.png",
          img: "/patterns/TYPE-1/test3.png",
        },
      ],
    },
    {
      id: "special-2",
      label: "ขนส่งยานยนต์",
      items: [
        {
          id: "t1-test3",
          name: "TYPE-1 Test 3",
          preview: "/patterns/TYPE-1/test3.png",
          img: "/patterns/TYPE-1/test3.png",
        },
      ],
    },
        {
      id: "special-3",
      label: "แฟชั่น",
      items: [
        {
          id: "t1-test3",
          name: "TYPE-1 Test 3",
          preview: "/patterns/TYPE-1/test3.png",
          img: "/patterns/TYPE-1/test3.png",
        },
      ],
    },
        {
      id: "special-4",
      label: "Thai seasonal",
      items: [
        {
          id: "t1-test3",
          name: "TYPE-1 Test 3",
          preview: "/patterns/TYPE-1/test3.png",
          img: "/patterns/TYPE-1/test3.png",
        },
      ],
    },
  ],

  "TYPE-2": [
    {
      id: "basic",
      label: "ลายพื้นฐาน",
      items: [
        {
          id: "t2-test1",
          name: "TYPE-2 Test 1",
          preview: "/patterns/TYPE-1/test2.png",
          img: "/patterns/TYPE-1/test2.png",
        },
      ],
    },
  ],

  "TYPE-3": [
    {
      id: "basic",
      label: "ลายพื้นฐาน",
      items: [
        {
          id: "t3-test1",
          name: "TYPE-3 Test 1",
          preview: "/patterns/TYPE-1/test2.png",
          img: "/patterns/TYPE-1/test2.png",
        },
      ],
    },
  ],

  "TYPE-4": [
    {
      id: "basic",
      label: "ลายพื้นฐาน",
      items: [
        {
          id: "t4-test1",
          name: "TYPE-4 Test 1",
          preview: "/patterns/TYPE-1/test2.png",
          img: "/patterns/TYPE-1/test2.png",
        },
      ],
    },
  ],

  "TYPE-5": [
    {
      id: "basic",
      label: "ลายพื้นฐาน",
      items: [
        {
          id: "t5-test1",
          name: "TYPE-5 Test 1",
          preview: "/patterns/TYPE-1/test2.png",
          img: "/patterns/TYPE-1/test2.png",
        },
      ],
    },
  ],
};

export function getPatternGroupsByType(typeId: string): PatternGroup[] {
  return patternGroups[typeId] || [];
}

export function getPatternsByType(typeId: string): PatternItem[] {
  return getPatternGroupsByType(typeId).flatMap((group) => group.items);
}

export default patternGroups;