import { NextResponse } from "next/server";
import { createMessengerTextReferralToken } from "@/lib/messengerTextReferralToken";
import { requireMessengerMetaConfig } from "@/lib/messengerMetaConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReferralRequest = {
  orderId?: string;
  modelId?: string;
  quantity?: number;
  unitPrice?: number;
};

export async function POST(request: Request) {
  try {
    requireMessengerMetaConfig();

    const body = (await request.json()) as ReferralRequest;
    const orderId = String(body.orderId || "").trim();
    const modelId = String(body.modelId || "").trim();
    const quantity = Number(body.quantity);
    const unitPrice = Number(body.unitPrice);

    if (!/^PAC-[A-Za-z0-9-]+$/.test(orderId)) {
      return NextResponse.json({ ok: false, error: "Invalid order id" }, { status: 400 });
    }
    if (!/^TYPE-[1-5]$/.test(modelId)) {
      return NextResponse.json({ ok: false, error: "Invalid model id" }, { status: 400 });
    }
    if (!Number.isInteger(quantity) || quantity < 12 || quantity > 1000) {
      return NextResponse.json({ ok: false, error: "Invalid quantity" }, { status: 400 });
    }
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid unit price" }, { status: 400 });
    }

    const referralRef = createMessengerTextReferralToken({
      v: 1,
      i: Math.floor(Date.now() / 1000),
      o: orderId,
      m: Number(modelId.replace("TYPE-", "")),
      q: quantity,
      u: unitPrice,
    });

    return NextResponse.json({ ok: true, orderId, referralRef });
  } catch (error) {
    console.error("[messenger/referral]", error);
    const typed = error as Error & { code?: string; missing?: string[] };
    const notConfigured = typed?.code === "META_NOT_CONFIGURED";
    return NextResponse.json(
      {
        ok: false,
        code: typed?.code || "MESSENGER_REFERRAL_ERROR",
        missing: typed?.missing || [],
        error: error instanceof Error ? error.message : "Unable to create Messenger referral",
      },
      { status: notConfigured ? 503 : 500 }
    );
  }
}
