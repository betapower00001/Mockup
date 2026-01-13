import { notFound } from "next/navigation";
import plugTypes from "@/data/plugTypes";
import PlugCustomizer from "@/components/PlugCustomizer";

interface PageProps {
  params: { type?: string };
}

export default function PlugMainCustomizerPage({ params }: PageProps) {
  const { type } = params;

  if (!type) return notFound();

  const plug = plugTypes.find((p) => p.id === type);
  if (!plug) return notFound();

  return <PlugCustomizer plugId={type} />;
}
