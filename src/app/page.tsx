// src/app/page.tsx
"use client";

import dynamic from "next/dynamic";
import plugTypes from "../data/plugTypes";

const PlugCustomizer = dynamic(
  () => import("../components/PlugCustomizer"),
  { ssr: false }
);

export default function HomePage() {
  const defaultPlug = plugTypes[0].id;
  return <PlugCustomizer plugId={defaultPlug} />;
}
