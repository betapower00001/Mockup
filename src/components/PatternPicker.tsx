// src/components/PatternPicker.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";

interface PatternItem {
  id: string;
  name: string;
  img: string;
  preview: string;
}

interface PatternGroup {
  id: string;
  label: string;
  items: PatternItem[];
}

interface Props {
  // ✅ ของเดิมยังใช้ได้
  patternsForSelected?: PatternItem[];

  // ✅ ของใหม่: ถ้าส่งมา จะใช้แท็บแยกหมวดจริง
  patternGroupsForSelected?: PatternGroup[];

  uploadedExamples: string[];
  onSelect: (imgUrl: string) => void;

  onUpload: (base64: string) => void;
  onReset: () => void;
  disableReset?: boolean;

  thumbSize?: number;
}

export default function PatternPicker({
  patternsForSelected = [],
  patternGroupsForSelected = [],
  uploadedExamples,
  onSelect,
  onUpload,
  onReset,
  disableReset,
  thumbSize = 70,
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
        onUpload(result);
      }
    };

    reader.onerror = () => {
      alert("อ่านไฟล์ไม่สำเร็จ");
    };

    reader.readAsDataURL(file);
    e.currentTarget.value = "";
  }

  // ✅ รองรับทั้งแบบเดิม และแบบ grouped
  const systemGroups = useMemo<PatternGroup[]>(() => {
    if (patternGroupsForSelected.length > 0) {
      return patternGroupsForSelected;
    }

    return [
      {
        id: "system",
        label: "ลายจากระบบ",
        items: patternsForSelected,
      },
    ];
  }, [patternGroupsForSelected, patternsForSelected]);

  // ✅ เพิ่มแท็บลายอัปโหลดแยกให้อัตโนมัติ
  const allGroups = useMemo<PatternGroup[]>(() => {
    const groups: PatternGroup[] = [...systemGroups];

    if (uploadedExamples.length > 0) {
      groups.push({
        id: "uploaded",
        label: "ลายที่คุณอัปโหลด",
        items: uploadedExamples.map((url, i) => ({
          id: `uploaded-${i}`,
          name: `Upload ${i + 1}`,
          img: url,
          preview: url,
        })),
      });
    }

    return groups;
  }, [systemGroups, uploadedExamples]);

  const [activeTab, setActiveTab] = useState<string>("");

  useEffect(() => {
    if (!allGroups.length) {
      setActiveTab("");
      return;
    }

    const exists = allGroups.some((g) => g.id === activeTab);
    if (!exists) {
      setActiveTab(allGroups[0].id);
    }
  }, [allGroups, activeTab]);

  const activeGroup = allGroups.find((g) => g.id === activeTab) || allGroups[0];
  const activeItems = activeGroup?.items ?? [];
  const hasMultipleTabs = allGroups.length > 1;

  // ✅ Auto column เต็มพื้นที่ก่อน แล้วค่อยขึ้นบรรทัดใหม่
  const gridStyle: React.CSSProperties = {
    display: "grid",
    gap: 10,
    gridTemplateColumns: `repeat(auto-fill, minmax(${thumbSize}px, ${thumbSize}px))`,
    justifyContent: "start",
  };

  const tileStyle: React.CSSProperties = {
    width: "100%",
    aspectRatio: "1 / 1",
    borderRadius: 12,
    border: "1px solid rgba(210,218,235,.9)",
    background: "rgba(255,255,255,.9)",
    overflow: "hidden",
    cursor: "pointer",
    position: "relative",
    transition: "transform .15s ease, box-shadow .15s ease, border-color .15s ease",
  };

  const imgStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  };

  const capStyle: React.CSSProperties = {
    position: "absolute",
    left: 4,
    right: 4,
    bottom: 4,
    fontSize: 9.5,
    fontWeight: 800,
    color: "rgba(20,30,60,.90)",
    background: "rgba(255,255,255,.85)",
    border: "1px solid rgba(210,218,235,.9)",
    borderRadius: 999,
    padding: "2px 6px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    pointerEvents: "none",
    textAlign: "center",
  };

  const sectionTitle: React.CSSProperties = {
    margin: "12px 0 8px",
    fontSize: 13,
    fontWeight: 900,
    opacity: 0.8,
  };

  // ✅ แท็บเลื่อนซ้ายขวาได้ ไม่ wrap หลายบรรทัด
  const tabsWrapStyle: React.CSSProperties = {
    display: "flex",
    gap: 8,
    flexWrap: "nowrap",
    overflowX: "auto",
    overflowY: "hidden",
    paddingBottom: 4,
    marginBottom: 12,
    scrollbarWidth: "thin",
  };

  function renderTile(item: PatternItem) {
    return (
      <div
        key={item.id}
        role="button"
        tabIndex={0}
        title={item.name}
        onClick={() => onSelect(item.img)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onSelect(item.img);
        }}
        style={tileStyle}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 6px 12px rgba(30,55,90,.12)";
          (e.currentTarget as HTMLDivElement).style.borderColor = "#3b82f6";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
          (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(210,218,235,.9)";
        }}
      >
        <img src={item.preview || item.img} alt={item.name} style={imgStyle} />
        <div style={capStyle}>{item.name}</div>
      </div>
    );
  }

  return (
    <div>
      {/* แถบปุ่มเดิม */}
      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 12,
          flexWrap: "wrap",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>
            เลือกลายด้านล่าง
          </span>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <label
            style={{
              padding: "6px 10px",
              background: "rgba(0, 179, 185, 0.95)",
              color: "#fff",
              borderRadius: 8,
              cursor: "pointer",
              border: "1px solid rgba(0, 150, 150, 0.9)",
              display: "inline-flex",
              alignItems: "center",
              fontSize: 12,
              fontWeight: 900,
              userSelect: "none",
              transition: "transform 0.1s ease",
            }}
            title="อัปโหลดลาย (PNG/JPG)"
            onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.02)")}
            onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            + อัปโหลดเอง
            <input type="file" accept="image/png,image/jpeg" hidden onChange={handleFile} />
          </label>

          <button
            type="button"
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid rgba(160, 0, 0, 0.9)",
              background: "rgba(200, 30, 30, 0.9)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 900,
              cursor: disableReset ? "not-allowed" : "pointer",
              opacity: disableReset ? 0.5 : 1,
            }}
            onClick={onReset}
            disabled={!!disableReset}
            title={disableReset ? "ยังไม่มีลายให้รีเซ็ต" : "ล้างลาย/รีเซ็ต"}
          >
            ล้างลาย
          </button>
        </div>
      </div>

      <div style={{ height: 1, background: "rgba(226,232,240,1)", margin: "0 0 12px 0" }} />

      {/* แท็บ */}
      {hasMultipleTabs && (
        <div style={tabsWrapStyle}>
          {allGroups.map((group) => {
            const isActive = group.id === activeGroup?.id;
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => setActiveTab(group.id)}
                style={{
                  padding: "7px 12px",
                  borderRadius: 999,
                  border: isActive
                    ? "1px solid rgba(37,99,235,.95)"
                    : "1px solid rgba(210,218,235,.95)",
                  background: isActive
                    ? "linear-gradient(180deg, rgba(59,130,246,.98), rgba(37,99,235,.98))"
                    : "rgba(255,255,255,.92)",
                  color: isActive ? "#fff" : "#334155",
                  fontSize: 12,
                  fontWeight: 900,
                  cursor: "pointer",
                  boxShadow: isActive ? "0 8px 16px rgba(37,99,235,.18)" : "none",
                  flex: "0 0 auto",
                  whiteSpace: "nowrap",
                }}
              >
                {group.label}
              </button>
            );
          })}
        </div>
      )}

      {!!activeGroup && <div style={sectionTitle}>{activeGroup.label}</div>}

      {activeItems.length === 0 ? (
        <div style={{ fontSize: 12, opacity: 0.65 }}>ไม่มีลวดลายในหมวดนี้</div>
      ) : (
        <div style={gridStyle}>{activeItems.map(renderTile)}</div>
      )}
    </div>
  );
}