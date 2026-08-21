import { NextResponse } from "next/server";
import {
  createMessengerReferralToken,
  type StatelessMessengerPayload,
} from "@/lib/messengerReferralToken";
import { requireMessengerMetaConfig } from "@/lib/messengerMetaConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

type PackageRequest = {
  metadata: IncomingMetadata;
  pdfAttachmentId: string;
  productionAttachmentId: string;
  topRightAttachmentId: string;
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

function validateAttachmentId(value: unknown, label: string) {
  if (typeof value !== "string" || !/^\d{5,40}$/.test(value)) {
    throw new Error(`Invalid ${label}`);
  }
  return value;
}

export async function POST(request: Request) {
  try {
    requireMessengerMetaConfig();

    const body = (await request.json()) as PackageRequest;
    validateMetadata(body.metadata);

    const pdfAttachmentId = validateAttachmentId(body.pdfAttachmentId, "pdfAttachmentId");
    const productionAttachmentId = validateAttachmentId(
      body.productionAttachmentId,
      "productionAttachmentId"
    );
    const topRightAttachmentId = validateAttachmentId(body.topRightAttachmentId, "topRightAttachmentId");

    const metadata = body.metadata;
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
