import crypto from "node:crypto";
import { getMessengerMetaConfig } from "@/lib/messengerMetaConfig";

export type MessengerTextReferralPayload = {
  v: 1;
  i: number; // issued-at unix seconds
  o: string; // order id
  m: number; // model number 1..5
  q: number; // quantity
  u: number; // unit price
};

const PREFIX = "T1";
const SIGNATURE_LENGTH = 43; // SHA-256 HMAC, base64url without padding
const DEFAULT_MAX_AGE_SECONDS = 2 * 60 * 60;

function signingSecret() {
  const secret = getMessengerMetaConfig().appSecret;
  if (!secret) throw new Error("META_APP_SECRET is missing");
  return secret;
}

function sign(encodedPayload: string) {
  return crypto
    .createHmac("sha256", signingSecret())
    .update(`${PREFIX}${encodedPayload}`)
    .digest("base64url");
}

function serialize(payload: MessengerTextReferralPayload) {
  return [payload.v, payload.i, payload.o, payload.m, payload.q, payload.u].join("|");
}

function parse(raw: string): MessengerTextReferralPayload | null {
  const parts = raw.split("|");
  if (parts.length !== 6) return null;

  const [v, i, o, m, q, u] = parts;
  const payload: MessengerTextReferralPayload = {
    v: Number(v) as 1,
    i: Number(i),
    o,
    m: Number(m),
    q: Number(q),
    u: Number(u),
  };

  if (
    payload.v !== 1 ||
    !/^PAC-[A-Za-z0-9-]+$/.test(payload.o) ||
    !Number.isInteger(payload.m) || payload.m < 1 || payload.m > 5 ||
    !Number.isInteger(payload.q) || payload.q < 12 || payload.q > 1000 ||
    !Number.isFinite(payload.u) || payload.u <= 0
  ) {
    return null;
  }

  return payload;
}

export function createMessengerTextReferralToken(payload: MessengerTextReferralPayload) {
  const encodedPayload = Buffer.from(serialize(payload), "utf8").toString("base64url");
  return `${PREFIX}${encodedPayload}${sign(encodedPayload)}`;
}

export function readMessengerTextReferralToken(token: string): MessengerTextReferralPayload | null {
  try {
    if (!token.startsWith(PREFIX) || token.length <= PREFIX.length + SIGNATURE_LENGTH) return null;

    const signature = token.slice(-SIGNATURE_LENGTH);
    const encodedPayload = token.slice(PREFIX.length, -SIGNATURE_LENGTH);
    const expected = sign(encodedPayload);

    const actualBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (
      actualBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
    ) {
      return null;
    }

    const parsed = parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    if (!parsed) return null;

    const configuredMaxAge = getMessengerMetaConfig().referralMaxAgeSeconds;
    const maxAgeSeconds = Math.max(60, configuredMaxAge || DEFAULT_MAX_AGE_SECONDS);
    const age = Math.floor(Date.now() / 1000) - parsed.i;
    if (age < -300 || age > maxAgeSeconds) return null;

    return parsed;
  } catch {
    return null;
  }
}
