import crypto from "node:crypto";
import { NextResponse } from "next/server";
import {
  readMessengerReferralToken,
  type StatelessMessengerPayload,
} from "@/lib/messengerReferralToken";
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

async function callSendApi(psid: string, message: unknown) {
  const metaConfig = requireMessengerMetaConfig();

  const response = await fetch(`https://graph.facebook.com/${metaConfig.graphVersion}/me/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${metaConfig.pageAccessToken}`,
    },
    signal: AbortSignal.timeout(60_000),
    body: JSON.stringify({
      recipient: { id: psid },
      messaging_type: "RESPONSE",
      message,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Messenger Send API ${response.status}: ${body}`);
  }
}

function modelName(modelNumber: number) {
  return ({ 1: "Arthur", 2: "Wallace", 3: "Caesar", 4: "Mulan", 5: "Hector" } as Record<number, string>)[modelNumber] || `TYPE-${modelNumber}`;
}

function priceRange(quantity: number) {
  if (quantity <= 100) return "12-100 ชิ้น";
  if (quantity <= 300) return "101-300 ชิ้น";
  if (quantity <= 500) return "301-500 ชิ้น";
  return "501-1000 ชิ้น";
}

function orderText(order: StatelessMessengerPayload) {
  const total = order.q * order.u;
  return [
    "ขอบคุณที่ส่งแบบเข้ามาค่ะ",
    `Order ID: ${order.o}`,
    `รุ่น: TYPE-${order.m} ${modelName(order.m)}`,
    `จำนวน: ${order.q.toLocaleString("th-TH")} ชิ้น`,
    `ราคา/ชิ้น: ${order.u.toLocaleString("th-TH")} บาท`,
    `ราคารวม: ${total.toLocaleString("th-TH")} บาท`,
    `ช่วงราคา: ${priceRange(order.q)}`,
    `ลวดลาย: ${order.p ? "มีลาย" : "ไม่มีลาย"}`,
    `โลโก้: ${order.l} จุด`,
    "",
    "แนบให้แล้ว: PDF สรุปแบบ / ภาพมุมบนเอียงขวา / ไฟล์ผลิต",
    "รายละเอียดสีและตำแหน่งงานดูได้จาก PDF และภาพแนบ",
    "สามารถคุยรายละเอียดงานต่อในแชตนี้ได้เลยค่ะ",
  ].join("\n");
}

async function sendAttachment(psid: string, type: "image" | "file", attachmentId: string) {
  await callSendApi(psid, {
    attachment: {
      type,
      payload: { attachment_id: attachmentId },
    },
  });
}

async function sendStatelessPackage(psid: string, referralRef: string) {
  const order = readMessengerReferralToken(referralRef);
  if (!order) {
    await callSendApi(psid, {
      text: "ลิงก์ Mockup นี้หมดอายุหรือข้อมูลไม่ถูกต้อง กรุณากลับไปที่หน้า Mockup แล้วกดส่ง Messenger อีกครั้งค่ะ",
    });
    return;
  }

  const [pdfAttachmentId, productionAttachmentId, topRightAttachmentId] = order.a;

  await callSendApi(psid, { text: orderText(order) });
  await sendAttachment(psid, "image", topRightAttachmentId);
  await sendAttachment(psid, "image", productionAttachmentId);
  await sendAttachment(psid, "file", pdfAttachmentId);
}

function getReferralRef(event: any): string | null {
  const candidates = [
    event?.referral?.ref,
    event?.postback?.referral?.ref,
  ];
  const found = candidates.find(
    (value) => typeof value === "string" && value.startsWith("S1")
  );
  return found ?? null;
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
  if (!verifyMetaSignature(rawBody, request.headers.get("x-hub-signature-256"), metaConfig.appSecret)) {
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
        const psid = event?.sender?.id;
        const referralRef = getReferralRef(event);
        if (psid && referralRef) await sendStatelessPackage(psid, referralRef);
      }
    }
  } catch (error) {
    console.error("[messenger/webhook]", error);
    // Return 200 so Meta does not retry indefinitely; inspect server logs for details.
  }

  return NextResponse.json({ ok: true });
}
