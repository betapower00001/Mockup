import { NextResponse } from "next/server";
import {
  createMessengerReferralToken,
  type StatelessMessengerPayload,
} from "@/lib/messengerReferralToken";
import { requireMessengerMetaConfig, type MessengerMetaConfig } from "@/lib/messengerMetaConfig";

export const runtime = "nodejs";

type IncomingMetadata = {
  orderId: string;
  modelId: string;
  modelName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  priceRange: string;
  topColor: string;
  bottomColor: string;
  switchColor?: string;
  patternText: string;
  logoText: string;
  hasPattern: boolean;
  logoCount: number;
};

function validateMetadata(value: IncomingMetadata) {
  if (!/^PAC-[A-Za-z0-9-]+$/.test(value.orderId || "")) throw new Error("Invalid order id");
  if (!/^TYPE-[1-5]$/.test(value.modelId || "")) throw new Error("Invalid model id");
  if (!Number.isFinite(value.quantity) || value.quantity < 12 || value.quantity > 1000) {
    throw new Error("Invalid quantity");
  }
  if (!Number.isFinite(value.unitPrice) || value.unitPrice <= 0) throw new Error("Invalid unit price");
  if (!Number.isFinite(value.totalPrice) || value.totalPrice <= 0) throw new Error("Invalid total price");
}

async function uploadMetaAttachment(
  file: File,
  type: "image" | "file",
  metaConfig: MessengerMetaConfig
) {
  const form = new FormData();
  form.set(
    "message",
    JSON.stringify({
      attachment: {
        type,
        payload: { is_reusable: true },
      },
    })
  );
  form.set("filedata", file, file.name || (type === "file" ? "order.pdf" : "image.png"));

  const response = await fetch(
    `https://graph.facebook.com/${metaConfig.graphVersion}/me/message_attachments`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${metaConfig.pageAccessToken}` },
      body: form,
      signal: AbortSignal.timeout(60_000),
    }
  );

  const raw = await response.text();
  let body: any = null;
  try {
    body = JSON.parse(raw);
  } catch {
    // Keep raw response for a useful error below.
  }

  if (!response.ok || !body?.attachment_id) {
    throw new Error(
      `Meta Attachment Upload ${response.status}: ${body?.error?.message || raw || "Unknown error"}`
    );
  }
  return String(body.attachment_id);
}

export async function POST(request: Request) {
  try {
    // ตรวจ environment ก่อนอ่านไฟล์ขนาดใหญ่ เพื่อไม่ให้ผู้ใช้รอนานเมื่อยังไม่ได้ตั้งค่า Meta
    const metaConfig = requireMessengerMetaConfig();

    const form = await request.formData();
    const metadataRaw = form.get("metadata");
    const pdf = form.get("pdf");
    const production = form.get("production");
    const topRight = form.get("topRight");

    if (typeof metadataRaw !== "string") {
      return NextResponse.json({ ok: false, error: "metadata is required" }, { status: 400 });
    }
    if (!(pdf instanceof File) || !(production instanceof File) || !(topRight instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "pdf, production and topRight files are required" },
        { status: 400 }
      );
    }

    const metadata = JSON.parse(metadataRaw) as IncomingMetadata;
    validateMetadata(metadata);

    // No database / local file storage: assets are uploaded straight to Meta.
    const [pdfAttachmentId, productionAttachmentId, topRightAttachmentId] = await Promise.all([
      uploadMetaAttachment(pdf, "file", metaConfig),
      uploadMetaAttachment(production, "image", metaConfig),
      uploadMetaAttachment(topRight, "image", metaConfig),
    ]);

    const payload: StatelessMessengerPayload = {
      v: 1,
      i: Math.floor(Date.now() / 1000),
      o: metadata.orderId,
      m: Number(metadata.modelId.replace("TYPE-", "")),
      q: metadata.quantity,
      u: metadata.unitPrice,
      p: metadata.hasPattern ? 1 : 0,
      l: Math.max(0, Math.min(3, Math.floor(metadata.logoCount || 0))),
      a: [pdfAttachmentId, productionAttachmentId, topRightAttachmentId],
    };

    const referralRef = createMessengerReferralToken(payload);

    return NextResponse.json({
      ok: true,
      orderId: metadata.orderId,
      referralRef,
    });
  } catch (error) {
    console.error("[messenger/package]", error);
    const typed = error as Error & { code?: string; missing?: string[] };
    const notConfigured = typed?.code === "META_NOT_CONFIGURED";
    return NextResponse.json(
      {
        ok: false,
        code: typed?.code || "MESSENGER_PACKAGE_ERROR",
        missing: typed?.missing || [],
        error: error instanceof Error ? error.message : "Unable to create Messenger package",
      },
      { status: notConfigured ? 503 : 500 }
    );
  }
}
