import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getMessengerMetaConfigStatus, requireMessengerMetaConfig } from "@/lib/messengerMetaConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

function verifyMetaSignature(rawBody: string, signature: string | null, appSecret: string) {
  if (!signature?.startsWith("sha256=")) return false;
  const expected = `sha256=${crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
  return safeEqual(signature, expected);
}

async function sendText(psid: string, text: string) {
  const metaConfig = requireMessengerMetaConfig();

  const response = await fetch(
    `https://graph.facebook.com/${metaConfig.graphVersion}/me/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${metaConfig.pageAccessToken}`,
      },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        recipient: { id: psid },
        messaging_type: "RESPONSE",
        message: { text },
      }),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Messenger Send API ${response.status}: ${body}`);
  }
}

export async function GET(request: Request) {
  const status = getMessengerMetaConfigStatus();
  if (!status.configured) {
    return NextResponse.json(
      { ok: false, error: `Meta Messenger ยังตั้งค่าไม่ครบ: ${status.missing.join(", ")}` },
      { status: 503 }
    );
  }

  const metaConfig = requireMessengerMetaConfig();
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === metaConfig.webhookVerifyToken && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  const status = getMessengerMetaConfigStatus();
  if (!status.configured) {
    return NextResponse.json(
      { ok: false, error: `Meta Messenger ยังตั้งค่าไม่ครบ: ${status.missing.join(", ")}` },
      { status: 503 }
    );
  }

  const metaConfig = requireMessengerMetaConfig();
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifyMetaSignature(rawBody, signature, metaConfig.appSecret)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Bad JSON", { status: 400 });
  }

  try {
    const entries = Array.isArray(body?.entry) ? body.entry : [];

    for (const entry of entries) {
      const messaging = Array.isArray(entry?.messaging) ? entry.messaging : [];

      for (const event of messaging) {
        const psid = typeof event?.sender?.id === "string" ? event.sender.id : "";
        const incomingText = typeof event?.message?.text === "string"
          ? event.message.text.trim()
          : "";
        const isEcho = Boolean(event?.message?.is_echo);

        if (!psid || isEcho || !incomingText) continue;

        console.log("[messenger/text-only] incoming", {
          psid: `${psid.slice(0, 6)}...`,
          text: incomingText,
        });

        // โหมดทดสอบข้อความอย่างเดียว: ไม่มีรูป ไม่มี PDF ไม่มี referral attachment
        if (incomingText.startsWith("เริ่มสั่งผลิต")) {
          await sendText(
            psid,
            [
              "✅ รับข้อความแล้วค่ะ",
              "ระบบ Messenger เชื่อมต่อสำเร็จ",
              "Webhook รับข้อความจากลูกค้าได้ และ Meta Send API ส่งข้อความกลับเข้าแชตได้แล้ว",
              "",
              "ตอนนี้กำลังทดสอบเฉพาะข้อความ ยังไม่มีรูปหรือ PDF",
              "ขั้นต่อไปเราจะเพิ่มข้อมูล Mockup / รุ่นสินค้า / จำนวน / ราคา แล้วค่อยเพิ่มรูปทีละไฟล์ค่ะ",
            ].join("\n")
          );
        }
      }
    }
  } catch (error) {
    console.error("[messenger/text-only] webhook error", error);
    // ตอบ 200 เพื่อไม่ให้ Meta retry ซ้ำแบบไม่สิ้นสุด ระหว่างทดสอบให้ดู Vercel Logs
  }

  return NextResponse.json({ ok: true, mode: "text-only-auto-reply" });
}
