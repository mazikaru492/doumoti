import "server-only";

const FQDN_PATTERN =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

function normalizeHost(value: string): string {
  return value.trim().toLowerCase();
}

function assertHostFormat(host: string): void {
  if (!host) {
    throw new Error("ALLOWED_VIDEO_HOSTS contains an empty host");
  }

  if (host.includes("://") || host.includes("/") || host.includes(":")) {
    throw new Error(
      `ALLOWED_VIDEO_HOSTS must contain protocol-free FQDN only: ${host}`,
    );
  }

  if (!FQDN_PATTERN.test(host)) {
    throw new Error(`ALLOWED_VIDEO_HOSTS has invalid FQDN: ${host}`);
  }
}

export function getAllowedVideoHosts(): readonly string[] {
  const raw = process.env.ALLOWED_VIDEO_HOSTS;
  if (!raw) {
    throw new Error("Missing env var: ALLOWED_VIDEO_HOSTS");
  }

  const parsed = raw
    .split(",")
    .map(normalizeHost)
    .filter((host) => host.length > 0);

  if (parsed.length === 0) {
    throw new Error("ALLOWED_VIDEO_HOSTS is empty");
  }

  const unique = Array.from(new Set(parsed));
  for (const host of unique) {
    assertHostFormat(host);
  }

  return unique;
}

export function isAllowedVideoHostname(
  hostname: string,
  allowlist: readonly string[] = getAllowedVideoHosts(),
): boolean {
  const normalized = normalizeHost(hostname);
  return allowlist.includes(normalized);
}

export function validateVideoSourceUrl(
  rawUrl: string,
  options?: { allowHttp?: boolean; allowlist?: readonly string[] },
):
  | { ok: true; normalizedUrl: string; hostname: string }
  | { ok: false; reason: string } {
  if (!rawUrl || rawUrl.trim().length === 0) {
    return { ok: false, reason: "video_source_url is empty" };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "video_source_url is not a valid URL" };
  }

  const allowHttp = options?.allowHttp ?? false;
  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== "https:" && !(allowHttp && protocol === "http:")) {
    return { ok: false, reason: "video_source_url protocol is not allowed" };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname || hostname === "localhost" || hostname === "127.0.0.1") {
    return { ok: false, reason: "video_source_url hostname is not allowed" };
  }

  const allowlist = options?.allowlist ?? getAllowedVideoHosts();
  if (!isAllowedVideoHostname(hostname, allowlist)) {
    return {
      ok: false,
      reason: "video_source_url hostname is not in allowlist",
    };
  }

  return {
    ok: true,
    normalizedUrl: parsed.toString(),
    hostname,
  };
}
