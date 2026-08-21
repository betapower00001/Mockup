import { NextResponse } from "next/server";
import { getMessengerMetaConfigStatus } from "@/lib/messengerMetaConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const status = getMessengerMetaConfigStatus();
  return NextResponse.json(
    {
      ok: true,
      ...status,
      message: status.configured
        ? "Meta Messenger พร้อมใช้งาน"
        : `ยังตั้งค่า Meta ไม่ครบ: ${status.missing.join(", ")}`,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
