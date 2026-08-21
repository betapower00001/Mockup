export type MetaRequiredKey =
  | "META_PAGE_ACCESS_TOKEN"
  | "META_APP_SECRET"
  | "META_WEBHOOK_VERIFY_TOKEN";

export type MessengerMetaConfig = {
  pageAccessToken: string;
  appSecret: string;
  webhookVerifyToken: string;
  graphVersion: string;
  referralMaxAgeSeconds: number;
};

const PLACEHOLDER_MARKERS = ["PASTE_", "CHOOSE_", "YOUR_", "REPLACE_", "XXXXXXXX"];

function clean(value: string | undefined) {
  return (value ?? "").trim();
}

function looksConfigured(value: string) {
  if (!value) return false;
  const upper = value.toUpperCase();
  return !PLACEHOLDER_MARKERS.some((marker) => upper.includes(marker));
}

function normalizeGraphVersion(value: string) {
  const cleaned = value.trim() || "v26.0";
  return cleaned.startsWith("v") ? cleaned : `v${cleaned}`;
}

function readMaxAgeSeconds(value: string) {
  const parsed = Number(value || 7200);
  if (!Number.isFinite(parsed)) return 7200;
  return Math.max(60, Math.floor(parsed));
}

export function getMessengerMetaConfig(): MessengerMetaConfig {
  return {
    pageAccessToken: clean(process.env.META_PAGE_ACCESS_TOKEN),
    appSecret: clean(process.env.META_APP_SECRET),
    webhookVerifyToken: clean(process.env.META_WEBHOOK_VERIFY_TOKEN),
    graphVersion: normalizeGraphVersion(clean(process.env.META_GRAPH_API_VERSION)),
    referralMaxAgeSeconds: readMaxAgeSeconds(clean(process.env.META_REFERRAL_MAX_AGE_SECONDS)),
  };
}

export function getMessengerMetaConfigStatus() {
  const config = getMessengerMetaConfig();
  const missing: MetaRequiredKey[] = [];

  if (!looksConfigured(config.pageAccessToken)) missing.push("META_PAGE_ACCESS_TOKEN");
  if (!looksConfigured(config.appSecret)) missing.push("META_APP_SECRET");
  if (!looksConfigured(config.webhookVerifyToken)) missing.push("META_WEBHOOK_VERIFY_TOKEN");

  return {
    configured: missing.length === 0,
    missing,
    graphVersion: config.graphVersion,
    referralMaxAgeSeconds: config.referralMaxAgeSeconds,
  };
}

export function requireMessengerMetaConfig() {
  const status = getMessengerMetaConfigStatus();
  if (!status.configured) {
    const error = new Error(`Meta Messenger ยังตั้งค่าไม่ครบ: ${status.missing.join(", ")}`);
    (error as Error & { code?: string; missing?: MetaRequiredKey[] }).code = "META_NOT_CONFIGURED";
    (error as Error & { code?: string; missing?: MetaRequiredKey[] }).missing = status.missing;
    throw error;
  }
  return getMessengerMetaConfig();
}
