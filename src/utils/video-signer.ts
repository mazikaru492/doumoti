import crypto from "crypto";

const DEFAULT_PREVIEW_TTL_SECONDS = 60 * 5;

function getSigningSecret(): string {
  const secret = process.env.VIDEO_SIGNING_SECRET;
  if (!secret) {
    throw new Error("Missing env var: VIDEO_SIGNING_SECRET");
  }
  return secret;
}

function createPayload(params: {
  videoId: string;
  userId: string;
  expires: number;
}): string {
  return `${params.videoId}:${params.userId}:${params.expires}`;
}

function safeEqualHex(expectedHex: string, actualHex: string): boolean {
  const expected = Buffer.from(expectedHex, "hex");
  const actual = Buffer.from(actualHex, "hex");

  if (expected.length === 0 || actual.length === 0) {
    return false;
  }
  if (expected.length !== actual.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, actual);
}

function sign(payload: string): string {
  return crypto
    .createHmac("sha256", getSigningSecret())
    .update(payload)
    .digest("hex");
}

export function signVideoUrl(params: {
  videoId: string;
  userId: string;
  ttlSeconds?: number;
}): { expires: number; signature: string } {
  const nowSec = Math.floor(Date.now() / 1000);
  const ttl = params.ttlSeconds ?? DEFAULT_PREVIEW_TTL_SECONDS;
  const expires = nowSec + Math.max(1, ttl);

  const payload = createPayload({
    videoId: params.videoId,
    userId: params.userId,
    expires,
  });

  return {
    expires,
    signature: sign(payload),
  };
}

export function verifyVideoUrl(params: {
  videoId: string;
  userId: string;
  expiresRaw: string | null;
  signatureRaw: string | null;
}): { ok: true; expires: number } | { ok: false; reason: string } {
  const expiresRaw = params.expiresRaw;
  const signatureRaw = params.signatureRaw;

  if (!expiresRaw || !signatureRaw) {
    return { ok: false, reason: "missing-params" };
  }

  if (!/^\d{10}$/.test(expiresRaw)) {
    return { ok: false, reason: "invalid-expires" };
  }

  if (!/^[a-f0-9]{64}$/.test(signatureRaw)) {
    return { ok: false, reason: "invalid-signature-format" };
  }

  const expires = Number.parseInt(expiresRaw, 10);
  if (!Number.isFinite(expires)) {
    return { ok: false, reason: "invalid-expires" };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (expires < nowSec) {
    return { ok: false, reason: "expired" };
  }

  if (expires > nowSec + 60 * 10) {
    return { ok: false, reason: "expires-too-far" };
  }

  const expected = sign(
    createPayload({
      videoId: params.videoId,
      userId: params.userId,
      expires,
    }),
  );

  if (!safeEqualHex(expected, signatureRaw)) {
    return { ok: false, reason: "signature-mismatch" };
  }

  return { ok: true, expires };
}
