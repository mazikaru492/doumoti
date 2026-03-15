import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

type Tier = "NORMAL" | "GENERAL" | "VIP";

type RawVideoRecord = {
  title?: string;
  video_source_url?: string;
  thumbnail_url?: string;
  description?: string;
  duration_seconds?: number;
  minimum_required_tier?: string;
};

type ImportVideoRecord = {
  title: string;
  video_source_url: string;
  thumbnail_url: string;
  description: string;
  duration_seconds: number;
  minimum_required_tier: Tier;
};

type RowFailure = {
  index: number;
  title?: string;
  video_source_url?: string;
  reason: string;
};

const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_DURATION_SECONDS = 60;
const DEFAULT_DESCRIPTION = "Imported via scripts/import-videos.ts";

function loadEnv(): void {
  dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
}

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function parseCliArg(prefix: string): string | null {
  const arg = process.argv.find((value) => value.startsWith(prefix));
  if (!arg) {
    return null;
  }
  return arg.slice(prefix.length).trim() || null;
}

function resolveInputFilePath(): string {
  const cliPath = parseCliArg("--file=");
  const envPath = process.env.IMPORT_JSON_PATH?.trim();
  const selected = cliPath ?? envPath ?? "scraped_data.json";
  return path.resolve(process.cwd(), selected);
}

function parseBatchSize(): number {
  const cliValue = parseCliArg("--batch=");
  const envValue = process.env.IMPORT_BATCH_SIZE?.trim();
  const raw = cliValue ?? envValue;

  if (!raw) {
    return DEFAULT_BATCH_SIZE;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_BATCH_SIZE;
  }

  return Math.min(parsed, 500);
}

function isTier(value: string | undefined): value is Tier {
  return value === "NORMAL" || value === "GENERAL" || value === "VIP";
}

function assignTier(index: number): Tier {
  const mode = process.env.IMPORT_TIER_MODE?.trim().toLowerCase() ?? "fixed";
  const fixedTierRaw = process.env.IMPORT_DEFAULT_TIER?.trim().toUpperCase();
  const fixedTier: Tier = isTier(fixedTierRaw) ? fixedTierRaw : "NORMAL";

  if (mode !== "random") {
    return fixedTier;
  }

  const tiers: Tier[] = ["NORMAL", "GENERAL", "VIP"];
  return tiers[index % tiers.length] ?? "NORMAL";
}

function normalizeUrl(raw: string | undefined): string | null {
  if (!raw) {
    return null;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function normalizeDuration(raw: number | undefined): number {
  if (!Number.isFinite(raw) || !raw || raw <= 0) {
    return DEFAULT_DURATION_SECONDS;
  }
  return Math.floor(raw);
}

function normalizeRecord(
  row: RawVideoRecord,
  index: number,
): { ok: true; value: ImportVideoRecord } | { ok: false; reason: string } {
  const title = row.title?.trim();
  if (!title) {
    return { ok: false, reason: "title is empty" };
  }

  const videoSourceUrl = normalizeUrl(row.video_source_url);
  if (!videoSourceUrl) {
    return { ok: false, reason: "video_source_url is invalid" };
  }

  const thumbnailUrl = normalizeUrl(row.thumbnail_url) ?? videoSourceUrl;

  const minimumRequiredTier = isTier(row.minimum_required_tier)
    ? row.minimum_required_tier
    : assignTier(index);

  const description = row.description?.trim() || DEFAULT_DESCRIPTION;

  return {
    ok: true,
    value: {
      title,
      video_source_url: videoSourceUrl,
      thumbnail_url: thumbnailUrl,
      description,
      duration_seconds: normalizeDuration(row.duration_seconds),
      minimum_required_tier: minimumRequiredTier,
    },
  };
}

function dedupeByVideoSourceUrl(
  rows: ImportVideoRecord[],
): ImportVideoRecord[] {
  const unique = new Map<string, ImportVideoRecord>();
  for (const row of rows) {
    if (!unique.has(row.video_source_url)) {
      unique.set(row.video_source_url, row);
    }
  }
  return Array.from(unique.values());
}

function chunkArray<T>(rows: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += chunkSize) {
    chunks.push(rows.slice(i, i + chunkSize));
  }
  return chunks;
}

function defaultSampleData(): RawVideoRecord[] {
  return [
    {
      title: "Sample Imported Video A",
      video_source_url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
      thumbnail_url: "https://picsum.photos/seed/import-a/640/360",
      description: "Fallback sample data: replace with scraped_data.json",
      duration_seconds: 120,
    },
    {
      title: "Sample Imported Video B",
      video_source_url:
        "https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8",
      thumbnail_url: "https://picsum.photos/seed/import-b/640/360",
      description: "Fallback sample data: replace with scraped_data.json",
      duration_seconds: 180,
    },
  ];
}

function loadRawData(): RawVideoRecord[] {
  const filePath = resolveInputFilePath();

  if (!fs.existsSync(filePath)) {
    console.warn(
      `[import-videos] Input file not found at ${filePath}. Using built-in sample data.`,
    );
    return defaultSampleData();
  }

  const fileBody = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(fileBody) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("Input JSON must be an array of objects");
  }

  return parsed as RawVideoRecord[];
}

async function upsertBatch(
  batch: ImportVideoRecord[],
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const supabase = getSupabaseAdminClient();

  const { error } = await supabase.from("videos").upsert(batch, {
    onConflict: "video_source_url",
    ignoreDuplicates: false,
  });

  if (error) {
    return { ok: false, reason: error.message };
  }

  return { ok: true };
}

async function upsertOne(
  row: ImportVideoRecord,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const supabase = getSupabaseAdminClient();

  const { error } = await supabase.from("videos").upsert(row, {
    onConflict: "video_source_url",
    ignoreDuplicates: false,
  });

  if (error) {
    return { ok: false, reason: error.message };
  }

  return { ok: true };
}

async function run(): Promise<void> {
  loadEnv();

  const batchSize = parseBatchSize();
  const raw = loadRawData();

  const normalizedRows: ImportVideoRecord[] = [];
  const failures: RowFailure[] = [];

  raw.forEach((row, index) => {
    const result = normalizeRecord(row, index);
    if (!result.ok) {
      failures.push({
        index,
        title: row.title,
        video_source_url: row.video_source_url,
        reason: result.reason,
      });
      return;
    }
    normalizedRows.push(result.value);
  });

  const dedupedRows = dedupeByVideoSourceUrl(normalizedRows);
  const batches = chunkArray(dedupedRows, batchSize);

  let successCount = 0;
  let batchFailCount = 0;

  console.log(`[import-videos] Raw rows: ${raw.length}`);
  console.log(`[import-videos] Valid rows: ${normalizedRows.length}`);
  console.log(`[import-videos] Deduped rows: ${dedupedRows.length}`);
  console.log(`[import-videos] Batch size: ${batchSize}`);

  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i] ?? [];
    if (batch.length === 0) {
      continue;
    }

    const result = await upsertBatch(batch);
    if (result.ok) {
      successCount += batch.length;
      console.log(
        `[import-videos] Batch ${i + 1}/${batches.length} success (${batch.length} rows)`,
      );
      continue;
    }

    batchFailCount += 1;
    console.warn(
      `[import-videos] Batch ${i + 1}/${batches.length} failed (${result.reason}). Falling back to row-by-row...`,
    );

    for (const row of batch) {
      const single = await upsertOne(row);
      if (single.ok) {
        successCount += 1;
      } else {
        failures.push({
          index: -1,
          title: row.title,
          video_source_url: row.video_source_url,
          reason: single.reason,
        });
      }
    }
  }

  const failedCount = failures.length;
  console.log("[import-videos] ===== Summary =====");
  console.log(`[import-videos] Success: ${successCount}`);
  console.log(`[import-videos] Failed: ${failedCount}`);
  console.log(`[import-videos] Failed batches: ${batchFailCount}`);

  if (failures.length > 0) {
    console.log("[import-videos] Failure details:");
    for (const failure of failures.slice(0, 30)) {
      console.log(
        `  - index=${failure.index} title=${failure.title ?? "(none)"} url=${failure.video_source_url ?? "(none)"} reason=${failure.reason}`,
      );
    }

    if (failures.length > 30) {
      console.log(`  ... and ${failures.length - 30} more failures.`);
    }
  }

  if (failedCount > 0) {
    process.exitCode = 1;
  }
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[import-videos] Fatal: ${message}`);
  process.exitCode = 1;
});
