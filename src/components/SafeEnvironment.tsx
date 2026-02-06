// src/components/SafeEnvironment.tsx
"use client";

import React, { useEffect, useState } from "react";
import { Environment } from "@react-three/drei";

export default function SafeEnvironment({ intensity = 0.18 }: { intensity?: number }) {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    const onErr = (e: any) => {
      const msg = String(e?.reason?.message || e?.message || e || "");
      if (msg.includes("lebombo_1k.hdr") || msg.includes("Failed to fetch")) {
        setEnabled(false);
      }
    };
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onErr as any);
    return () => {
      window.removeEventListener("error", onErr);
      window.removeEventListener("unhandledrejection", onErr as any);
    };
  }, []);

  if (!enabled) return null;

  // ✅ ยังใช้ preset ได้ แต่ถ้าโหลดไม่ได้จะไม่ทำให้หน้า crash
  return <Environment preset="apartment" environmentIntensity={intensity} />;
}