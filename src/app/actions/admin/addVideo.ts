"use server";

import "server-only";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";
import {
  getAllowedVideoHosts,
  validateVideoSourceUrl,
} from "@/utils/env-config";

type Tier = "NORMAL" | "GENERAL" | "VIP";

export type AddVideoInput = {
  title: string;
  description: string;
  thumbnailUrl: string;
  videoSourceUrl: string;
  minimumRequiredTier: Tier;
  durationSeconds: number;
};

export type AddVideoResult =
  | { ok: true; videoId: string }
  | { ok: false; code: string; message: string };

function parseAdminEmails(): readonly string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function isTier(value: string): value is Tier {
  return value === "NORMAL" || value === "GENERAL" || value === "VIP";
}

function hasBasicFieldValidation(input: AddVideoInput): AddVideoResult | null {
  if (!input.title.trim()) {
    return { ok: false, code: "INVALID_TITLE", message: "title is required" };
  }
  if (!input.description.trim()) {
    return {
      ok: false,
      code: "INVALID_DESCRIPTION",
      message: "description is required",
    };
  }
  if (!input.thumbnailUrl.trim()) {
    return {
      ok: false,
      code: "INVALID_THUMBNAIL_URL",
      message: "thumbnailUrl is required",
    };
  }
  if (!Number.isInteger(input.durationSeconds) || input.durationSeconds <= 0) {
    return {
      ok: false,
      code: "INVALID_DURATION",
      message: "durationSeconds must be a positive integer",
    };
  }
  if (!isTier(input.minimumRequiredTier)) {
    return {
      ok: false,
      code: "INVALID_TIER",
      message: "minimumRequiredTier must be NORMAL, GENERAL, or VIP",
    };
  }

  return null;
}

export async function addVideoAction(
  input: AddVideoInput,
): Promise<AddVideoResult> {
  const fieldError = hasBasicFieldValidation(input);
  if (fieldError) {
    return fieldError;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false,
      code: "UNAUTHORIZED",
      message: "You must be signed in.",
    };
  }

  // Mock admin check: keep privileged access constrained by ADMIN_EMAILS allowlist.
  const adminEmails = parseAdminEmails();
  const email = user.email?.toLowerCase() ?? "";
  if (!email || !adminEmails.includes(email)) {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: "Admin role required.",
    };
  }

  let allowedHosts: readonly string[];
  try {
    allowedHosts = getAllowedVideoHosts();
  } catch {
    return {
      ok: false,
      code: "SERVER_MISCONFIGURED_ALLOWLIST",
      message: "ALLOWED_VIDEO_HOSTS is invalid.",
    };
  }

  const isDev = process.env.NODE_ENV !== "production";
  const sourceUrlValidation = validateVideoSourceUrl(input.videoSourceUrl, {
    allowHttp: isDev,
    allowlist: allowedHosts,
  });

  if (!sourceUrlValidation.ok) {
    return {
      ok: false,
      code: "INVALID_VIDEO_SOURCE_URL",
      message: sourceUrlValidation.reason,
    };
  }

  const thumbnailUrlValidation = validateVideoSourceUrl(input.thumbnailUrl, {
    allowHttp: isDev,
    allowlist: allowedHosts,
  });

  if (!thumbnailUrlValidation.ok) {
    return {
      ok: false,
      code: "INVALID_THUMBNAIL_URL",
      message: thumbnailUrlValidation.reason,
    };
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("videos")
    .insert({
      title: input.title.trim(),
      description: input.description.trim(),
      thumbnail_url: thumbnailUrlValidation.normalizedUrl,
      video_source_url: sourceUrlValidation.normalizedUrl,
      minimum_required_tier: input.minimumRequiredTier,
      duration_seconds: input.durationSeconds,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data?.id) {
    return {
      ok: false,
      code: "DB_INSERT_FAILED",
      message: "Failed to insert video.",
    };
  }

  return {
    ok: true,
    videoId: data.id,
  };
}
