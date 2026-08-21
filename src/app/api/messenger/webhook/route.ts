import crypto from "node:crypto";
import { NextResponse } from "next/server";
import {
  readMessengerTextReferralToken,
  type MessengerTextReferralPayload,
} from "@/lib/messengerTextReferralToken";
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

function modelName(modelNumber: number) {
  return ({
    1: "Arthur",
    2: "Wallace",
    3: "Caesar",
    4: "Mulan",
    5: "Hector",
  } as Record<number, string>)[modelNumber] || `TYPE-${modelNumber}`;
}

function formatBaht(value: number) {
  return `฿${Math.round(value).toLocaleString("en-US")}`;
}

function orderText(order: MessengerTextReferralPayload) {
  const total = order.q * order.u;
  return [
    "สนใจสั่งผลิตสินค้า",
    `Mockup: ${modelName(order.m)}`,
    `รุ่นสินค้า: TYPE-${order.m}`,
    `จำนวน: ${order.q.toLocaleString("th-TH")} ชิ้น`,
    `ราคา/ชิ้น: ${formatBaht(order.u)}`,
    `ราคารวม: ${formatBaht(total)}`,
    "",
    `Order ID: ${order.o}`,
    "สามารถคุยรายละเอียดงานต่อในแชตนี้ได้เลยค่ะ",
  ].join("\n");
}

function getReferralRef(event: any): string | null {
  const candidates = [event?.referral?.ref, event?.postback?.referral?.ref];
  const found = candidates.find(
    (value) => typeof value === "string" && value.startsWith("T1")
  );
  return found ?? null;
}

// ลดโอกาสส่งซ้ำจาก webhook retry ใน instance เดียวกัน โดยไม่ใช้ฐานข้อมูล
const recentlySent = new Map<string, number>();
function shouldSend(psid: string, referralRef: string) {
  const now = Date.now();
  for (const [key, expiresAt] of recentlySent) {
    if (expiresAt <= now) recentlySent.delete(key);
  }
  const key = `${psid}:${referralRef}`;
  if (recentlySent.has(key)) return false;
  recentlySent.set(key, now + 5 * 60_000);
  return true;
}

async function handleReferral(psid: string, referralRef: string) {
  const order = readMessengerTextReferralToken(referralRef);
  if (!order) {
    await sendText(
      psid,
      "ลิงก์ Mockup นี้หมดอายุหรือข้อมูลไม่ถูกต้อง กรุณากลับไปที่หน้า Mockup แล้วกดส่ง Messenger อีกครั้งค่ะ"
    );
    return;
  }
  if (!shouldSend(psid, referralRef)) return;
  await sendText(psid, orderText(order));
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
        const referralRef = getReferralRef(event);
        if (!psid || !referralRef) continue;

        console.log("[messenger/referral] received", {
          psid: `${psid.slice(0, 6)}...`,
          source: event?.referral?.source || event?.postback?.referral?.source || "unknown",
          type: event?.referral?.type || event?.postback?.referral?.type || "unknown",
        });

        await handleReferral(psid, referralRef);
      }
    }
  } catch (error) {
    console.error("[messenger/referral] webhook error", error);
    // ตอบ 200 เพื่อไม่ให้ Meta retry ซ้ำแบบไม่สิ้นสุด; ตรวจ Vercel Logs หากมีปัญหา
  }

  return NextResponse.json({ ok: true, mode: "one-click-text-referral" });
}
