import crypto from "crypto";

const SESSION_SECRET =
  process.env.SESSION_SECRET ?? "dev-only-session-secret-change-me";
const PLAYBACK_TOKEN_SECRET =
  process.env.PLAYBACK_TOKEN_SECRET ?? "dev-only-playback-secret-change-me";
const STRIPE_WEBHOOK_SECRET =
  process.env.STRIPE_WEBHOOK_SECRET ??
  "dev-only-stripe-webhook-secret-change-me";

function b64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function b64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(aBuf, bBuf);
}

interface SignedClaimsBase {
  exp: number;
  iat: number;
  purpose: string;
}

export function signClaims<T extends Record<string, unknown>>(
  claims: T,
  options: {
    ttlSeconds: number;
    secret: "session" | "playback";
    purpose: string;
  },
): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: SignedClaimsBase & T = {
    ...claims,
    iat: now,
    exp: now + options.ttlSeconds,
    purpose: options.purpose,
  };

  const payloadEncoded = b64UrlEncode(JSON.stringify(payload));
  const secret =
    options.secret === "session" ? SESSION_SECRET : PLAYBACK_TOKEN_SECRET;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(payloadEncoded)
    .digest("base64url");

  return `${payloadEncoded}.${signature}`;
}

export function verifyClaims<T extends Record<string, unknown>>(
  token: string,
  options: {
    secret: "session" | "playback";
    expectedPurpose: string;
  },
): (SignedClaimsBase & T) | null {
  const [payloadEncoded, signature] = token.split(".");
  if (!payloadEncoded || !signature) {
    return null;
  }

  const secret =
    options.secret === "session" ? SESSION_SECRET : PLAYBACK_TOKEN_SECRET;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payloadEncoded)
    .digest("base64url");

  if (!safeEqual(signature, expectedSignature)) {
    return null;
  }

  let parsed: SignedClaimsBase & T;
  try {
    parsed = JSON.parse(b64UrlDecode(payloadEncoded));
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (parsed.exp < now) {
    return null;
  }
  if (parsed.purpose !== options.expectedPurpose) {
    return null;
  }

  return parsed;
}

export function verifyStripeSignature(
  payload: string,
  stripeSignature: string,
): boolean {
  const parts = stripeSignature
    .split(",")
    .map((part) => part.trim())
    .reduce<Record<string, string>>((acc, part) => {
      const [key, value] = part.split("=");
      if (key && value) {
        acc[key] = value;
      }
      return acc;
    }, {});

  const timestamp = parts.t;
  const signature = parts.v1;

  if (!timestamp || !signature) {
    return false;
  }

  const signedPayload = `${timestamp}.${payload}`;
  const expected = crypto
    .createHmac("sha256", STRIPE_WEBHOOK_SECRET)
    .update(signedPayload)
    .digest("hex");

  return safeEqual(signature, expected);
}
