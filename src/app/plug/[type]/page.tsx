import { notFound } from "next/navigation";
import plugTypes from "@/data/plugTypes";
import PlugCustomizer from "@/components/PlugCustomizer";

type PageProps = {
  params: Promise<{ type: string }>;
};

export default async function PlugMainCustomizerPage({ params }: PageProps) {
  const { type } = await params;

  const plug = plugTypes.find((p) => p.id === type);
  if (!plug) return notFound();

  return <PlugCustomizer plugId={type} />;
}