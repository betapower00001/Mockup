import { NextResponse } from "next/server";
import { requireMessengerMetaConfig } from "@/lib/messengerMetaConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 3_800_000;

type AttachmentType = "image" | "file";

function validateUpload(file: File, type: AttachmentType) {
  if (!file.size) throw new Error("ไฟล์ว่าง ไม่สามารถอัปโหลดได้");
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`ไฟล์ ${file.name || "attachment"} ใหญ่เกิน ${(MAX_FILE_BYTES / 1024 / 1024).toFixed(1)} MB`);
  }

  if (type === "image" && file.type !== "image/png") {
    throw new Error(`ไฟล์ภาพต้องเป็น PNG เท่านั้น (ได้รับ ${file.type || "unknown"})`);
  }
  if (type === "file" && file.type !== "application/pdf") {
    throw new Error(`ไฟล์เอกสารต้องเป็น PDF เท่านั้น (ได้รับ ${file.type || "unknown"})`);
  }
}

async function uploadMetaAttachment(file: File, type: AttachmentType) {
  const metaConfig = requireMessengerMetaConfig();
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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  const startedAt = Date.now();

  try {
    const url = new URL(`https://graph.facebook.com/${metaConfig.graphVersion}/me/message_attachments`);
    url.searchParams.set("access_token", metaConfig.pageAccessToken);

    const response = await fetch(url, {
      method: "POST",
      body: form,
      signal: controller.signal,
      cache: "no-store",
    });

    const raw = await response.text();
    let body: any = null;
    try {
      body = JSON.parse(raw);
    } catch {
      // keep raw text for the error below
    }

    if (!response.ok || !body?.attachment_id) {
      throw new Error(
        `Meta Attachment Upload ${response.status}: ${body?.error?.message || raw || "Unknown error"}`
      );
    }

    return {
      attachmentId: String(body.attachment_id),
      elapsedMs: Date.now() - startedAt,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Meta ใช้เวลารับไฟล์เกิน 30 วินาที กรุณาลองใหม่อีกครั้ง");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: Request) {
  try {
    requireMessengerMetaConfig();

    const form = await request.formData();
    const typeRaw = form.get("type");
    const file = form.get("file");

    if (typeRaw !== "image" && typeRaw !== "file") {
      return NextResponse.json({ ok: false, error: "type must be image or file" }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "file is required" }, { status: 400 });
    }

    validateUpload(file, typeRaw);
    const result = await uploadMetaAttachment(file, typeRaw);

    return NextResponse.json({
      ok: true,
      attachmentId: result.attachmentId,
      name: file.name,
      bytes: file.size,
      elapsedMs: result.elapsedMs,
    });
  } catch (error) {
    console.error("[messenger/attachment]", error);
    const typed = error as Error & { code?: string; missing?: string[] };
    const notConfigured = typed?.code === "META_NOT_CONFIGURED";
    return NextResponse.json(
      {
        ok: false,
        code: typed?.code || "MESSENGER_ATTACHMENT_ERROR",
        missing: typed?.missing || [],
        error: error instanceof Error ? error.message : "Unable to upload Messenger attachment",
      },
      { status: notConfigured ? 503 : 500 }
    );
  }
}
