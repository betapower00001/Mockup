import crypto from "node:crypto";
import { getMessengerMetaConfig } from "@/lib/messengerMetaConfig";

export type StatelessMessengerPayload = {
  v: 1;
  i: number; // issued-at unix seconds
  o: string; // order id
  m: number; // model number 1..5
  q: number; // quantity
  u: number; // unit price
  p: 0 | 1; // has pattern
  l: number; // logo count
  a: [string, string, string]; // pdf, production, top-right attachment ids
};

const PREFIX = "S1";
const SIGNATURE_LENGTH = 43; // SHA-256 HMAC in base64url without padding
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

function compactSerialize(payload: StatelessMessengerPayload) {
  return [
    payload.v,
    payload.i,
    payload.o,
    payload.m,
    payload.q,
    payload.u,
    payload.p,
    payload.l,
    payload.a[0],
    payload.a[1],
    payload.a[2],
  ].join("|");
}

function compactParse(raw: string): StatelessMessengerPayload | null {
  const parts = raw.split("|");
  if (parts.length !== 11) return null;
  const [v, i, o, m, q, u, p, l, pdf, production, topRight] = parts;
  const parsed: StatelessMessengerPayload = {
    v: Number(v) as 1,
    i: Number(i),
    o,
    m: Number(m),
    q: Number(q),
    u: Number(u),
    p: Number(p) as 0 | 1,
    l: Number(l),
    a: [pdf, production, topRight],
  };
  if (
    parsed.v !== 1 ||
    !/^PAC-[A-Za-z0-9-]+$/.test(parsed.o) ||
    !Number.isInteger(parsed.m) || parsed.m < 1 || parsed.m > 5 ||
    !Number.isInteger(parsed.q) || parsed.q < 12 || parsed.q > 1000 ||
    !Number.isFinite(parsed.u) || parsed.u <= 0 ||
    (parsed.p !== 0 && parsed.p !== 1) ||
    !Number.isInteger(parsed.l) || parsed.l < 0 || parsed.l > 3 ||
    parsed.a.some((id) => !id)
  ) {
    return null;
  }
  return parsed;
}

export function createMessengerReferralToken(payload: StatelessMessengerPayload) {
  const encodedPayload = Buffer.from(compactSerialize(payload), "utf8").toString("base64url");
  return `${PREFIX}${encodedPayload}${sign(encodedPayload)}`;
}

export function readMessengerReferralToken(token: string): StatelessMessengerPayload | null {
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

    const parsed = compactParse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
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
