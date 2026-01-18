// src/components/PatternPicker.tsx
"use client";

interface PatternItem {
  id: string;
  name: string;
  img: string;
  preview: string;
}

interface Props {
  patternsForSelected: PatternItem[];
  uploadedExamples: string[];
  onSelect: (imgUrl: string) => void;
}

export default function PatternPicker({
  patternsForSelected,
  uploadedExamples,
  onSelect,
}: Props) {
  return (
    <div>
      <h3>เลือกลายพื้นฐาน</h3>
      <div className="grid grid-cols-3 gap-2">
        {patternsForSelected.map((p) => (
          <img
            key={p.id}
            src={p.preview || p.img}
            alt={p.name}
            title={p.name}
            onClick={() => onSelect(p.img)}
            className="w-full cursor-pointer border"
          />
        ))}
      </div>

      <h3 className="mt-4">ลายที่อัปโหลดเอง</h3>
      <div className="grid grid-cols-3 gap-2">
        {uploadedExamples.map((url, i) => (
          <img
            key={i}
            src={url}
            alt={`upload-${i}`}
            onClick={() => onSelect(url)}
            className="w-full cursor-pointer border"
          />
        ))}
      </div>
    </div>
  );
}
