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

  // ✅ เพิ่มมาใหม่
  onUpload: (base64: string) => void;
  onReset: () => void;
  disableReset?: boolean;
}

export default function PatternPicker({
  patternsForSelected,
  uploadedExamples,
  onSelect,
  onUpload,
  onReset,
  disableReset,
}: Props) {
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("กรุณาเลือกไฟล์รูปภาพ (PNG / JPG)");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        onUpload(result); // ✅ ส่ง Base64
      }
    };

    reader.onerror = () => {
      alert("อ่านไฟล์ไม่สำเร็จ");
    };

    reader.readAsDataURL(file);
    e.currentTarget.value = ""; // ✅ เลือกไฟล์เดิมซ้ำได้
  }

  return (
    <div>
      {/* ✅ แถบปุ่ม */}
      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <label
          style={{
            padding: "8px 12px",
            background: "#dddddd",
            borderRadius: 6,
            cursor: "pointer",
            border: "1px solid #cccccc",
            display: "inline-block",
          }}
        >
          อัปโหลดลาย
          <input type="file" accept="image/png,image/jpeg" hidden onChange={handleFile} />
        </label>

        <button
          type="button"
          style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #cccccc" }}
          onClick={onReset}
          disabled={!!disableReset}
          title={disableReset ? "ยังไม่มีลายให้รีเซ็ต" : "รีเซ็ตกลับลายพื้นฐาน"}
        >
          รีเซ็ตลาย
        </button>
      </div>

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
            title="คลิกเพื่อเลือกใช้ลายนี้"
          />
        ))}
      </div>
    </div>
  );
}
