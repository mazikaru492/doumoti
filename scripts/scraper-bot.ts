import path from "node:path";
import process from "node:process";
import axios from "axios";
import * as cheerio from "cheerio";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

type EngineMode = "auto" | "static" | "dynamic";
type Tier = "NORMAL" | "GENERAL" | "VIP";

type ScrapedVideo = {
  title: string;
  videoUrl: string;
  thumbnailUrl: string | null;
};

type SelectorConfig = {
  targetUrl: string;
  titleSelector: string;
  videoSelector: string;
  thumbnailSelector?: string;
  videoAttr: "href" | "src";
  thumbnailAttr: "href" | "src";
};

const REQUEST_TIMEOUT_MS = 15_000;
const MIN_DELAY_MS = 1_000;
const MAX_DELAY_MS = 2_000;
const DEFAULT_DURATION_SECONDS = 60;

const PLACEHOLDERS = new Set([
  "[TARGET_URL_HERE]",
  "[TITLE_SELECTOR_HERE]",
  "[VIDEO_URL_SELECTOR_HERE]",
  "[THUMBNAIL_SELECTOR_HERE]",
]);

function loadEnv(): void {
  dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
}

function parseEngineMode(): EngineMode {
  const arg = process.argv
    .find((entry) => entry.startsWith("--engine="))
    ?.split("=")[1]
    ?.trim()
    ?.toLowerCase();

  if (arg === "static" || arg === "dynamic" || arg === "auto") {
    return arg;
  }

  return "auto";
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false;
  }
  return fallback;
}

function parseSelectorConfig(): SelectorConfig {
  const targetUrl = process.env.SCRAPER_TARGET_URL ?? "[TARGET_URL_HERE]";
  const titleSelector =
    process.env.SCRAPER_TITLE_SELECTOR ?? "[TITLE_SELECTOR_HERE]";
  const videoSelector =
    process.env.SCRAPER_VIDEO_URL_SELECTOR ?? "[VIDEO_URL_SELECTOR_HERE]";
  const thumbnailSelector = process.env.SCRAPER_THUMBNAIL_SELECTOR;

  const videoAttrRaw = (process.env.SCRAPER_VIDEO_ATTR ?? "href")
    .trim()
    .toLowerCase();
  const thumbAttrRaw = (process.env.SCRAPER_THUMBNAIL_ATTR ?? "src")
    .trim()
    .toLowerCase();

  const videoAttr = videoAttrRaw === "src" ? "src" : "href";
  const thumbnailAttr = thumbAttrRaw === "href" ? "href" : "src";

  const requiredValues = [targetUrl, titleSelector, videoSelector];
  if (requiredValues.some((value) => PLACEHOLDERS.has(value))) {
    throw new Error(
      "Set SCRAPER_TARGET_URL, SCRAPER_TITLE_SELECTOR, and SCRAPER_VIDEO_URL_SELECTOR in .env.local before running.",
    );
  }

  return {
    targetUrl,
    titleSelector,
    videoSelector,
    thumbnailSelector:
      thumbnailSelector && !PLACEHOLDERS.has(thumbnailSelector)
        ? thumbnailSelector
        : undefined,
    videoAttr,
    thumbnailAttr,
  };
}

function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
    );
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function randomDelayMs(): number {
  return (
    Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)) + MIN_DELAY_MS
  );
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function toAbsoluteUrl(
  candidate: string | null | undefined,
  baseUrl: string,
): string | null {
  if (!candidate) {
    return null;
  }

  const trimmed = candidate.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return null;
  }
}

function cleanText(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\s+/g, " ").trim();
}

function chooseTier(index: number, randomize: boolean): Tier {
  if (!randomize) {
    return "NORMAL";
  }

  const tiers: Tier[] = ["NORMAL", "GENERAL", "VIP"];
  return tiers[index % tiers.length] ?? "NORMAL";
}

function parseCheerioRows(
  html: string,
  config: SelectorConfig,
): ScrapedVideo[] {
  const $ = cheerio.load(html);

  const titleNodes = $(config.titleSelector).toArray();
  const videoNodes = $(config.videoSelector).toArray();
  const thumbNodes = config.thumbnailSelector
    ? $(config.thumbnailSelector).toArray()
    : [];

  const maxLen = Math.max(
    titleNodes.length,
    videoNodes.length,
    thumbNodes.length,
  );
  const rows: ScrapedVideo[] = [];

  for (let i = 0; i < maxLen; i += 1) {
    const title = cleanText(titleNodes[i] ? $(titleNodes[i]).text() : "");
    const rawVideo = videoNodes[i]
      ? $(videoNodes[i]).attr(config.videoAttr)
      : undefined;

    const videoUrl = toAbsoluteUrl(rawVideo, config.targetUrl);
    if (!title || !videoUrl) {
      continue;
    }

    const rawThumb = thumbNodes[i]
      ? $(thumbNodes[i]).attr(config.thumbnailAttr)
      : undefined;
    const thumbnailUrl = toAbsoluteUrl(rawThumb, config.targetUrl);

    rows.push({
      title,
      videoUrl,
      thumbnailUrl,
    });
  }

  return rows;
}

async function scrapeStatic(config: SelectorConfig): Promise<ScrapedVideo[]> {
  const response = await axios.get(config.targetUrl, {
    timeout: REQUEST_TIMEOUT_MS,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; DoumotiScraperBot/1.0; +https://example.com/bot)",
      Accept: "text/html,application/xhtml+xml",
    },
    validateStatus: (status) => status >= 200 && status < 400,
  });

  return parseCheerioRows(response.data as string, config);
}

async function scrapeDynamic(config: SelectorConfig): Promise<ScrapedVideo[]> {
  const puppeteerModule = await import("puppeteer");
  const browser = await puppeteerModule.default.launch({
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (compatible; DoumotiScraperBot/1.0; +https://example.com/bot)",
    );
    await page.goto(config.targetUrl, {
      waitUntil: "networkidle2",
      timeout: REQUEST_TIMEOUT_MS,
    });

    const rows = await page.evaluate(
      ({
        titleSelector,
        videoSelector,
        thumbnailSelector,
        videoAttr,
        thumbnailAttr,
        targetUrl,
      }) => {
        function abs(candidate: string | null | undefined): string | null {
          if (!candidate) {
            return null;
          }
          const trimmed = candidate.trim();
          if (!trimmed) {
            return null;
          }
          try {
            return new URL(trimmed, targetUrl).toString();
          } catch {
            return null;
          }
        }

        function text(node: Element | undefined): string {
          if (!node) {
            return "";
          }
          return (node.textContent ?? "").replace(/\s+/g, " ").trim();
        }

        const titleNodes = Array.from(document.querySelectorAll(titleSelector));
        const videoNodes = Array.from(document.querySelectorAll(videoSelector));
        const thumbNodes = thumbnailSelector
          ? Array.from(document.querySelectorAll(thumbnailSelector))
          : [];

        const maxLen = Math.max(
          titleNodes.length,
          videoNodes.length,
          thumbNodes.length,
        );
        const output: Array<{
          title: string;
          videoUrl: string;
          thumbnailUrl: string | null;
        }> = [];

        for (let i = 0; i < maxLen; i += 1) {
          const title = text(titleNodes[i]);
          const videoNode = videoNodes[i] as Element | undefined;
          const videoUrl = abs(videoNode?.getAttribute(videoAttr));

          if (!title || !videoUrl) {
            continue;
          }

          const thumbNode = thumbNodes[i] as Element | undefined;
          const thumbnailUrl = abs(thumbNode?.getAttribute(thumbnailAttr));

          output.push({ title, videoUrl, thumbnailUrl });
        }

        return output;
      },
      {
        titleSelector: config.titleSelector,
        videoSelector: config.videoSelector,
        thumbnailSelector: config.thumbnailSelector,
        videoAttr: config.videoAttr,
        thumbnailAttr: config.thumbnailAttr,
        targetUrl: config.targetUrl,
      },
    );

    return rows;
  } finally {
    await browser.close();
  }
}

async function scrapeWithBestEngine(
  config: SelectorConfig,
  mode: EngineMode,
): Promise<{ engineUsed: "static" | "dynamic"; rows: ScrapedVideo[] }> {
  if (mode === "static") {
    const rows = await scrapeStatic(config);
    return { engineUsed: "static", rows };
  }

  if (mode === "dynamic") {
    const rows = await scrapeDynamic(config);
    return { engineUsed: "dynamic", rows };
  }

  try {
    const rows = await scrapeStatic(config);
    if (rows.length > 0) {
      return { engineUsed: "static", rows };
    }
  } catch {
    // Fallback to dynamic scraper.
  }

  const dynamicRows = await scrapeDynamic(config);
  return { engineUsed: "dynamic", rows: dynamicRows };
}

function dedupeByVideoUrl(rows: ScrapedVideo[]): ScrapedVideo[] {
  const map = new Map<string, ScrapedVideo>();

  for (const row of rows) {
    if (!map.has(row.videoUrl)) {
      map.set(row.videoUrl, row);
    }
  }

  return Array.from(map.values());
}

async function run(): Promise<void> {
  loadEnv();

  const config = parseSelectorConfig();
  const mode = parseEngineMode();
  const randomizeTier = parseBoolean(process.env.SCRAPER_RANDOMIZE_TIER, false);

  console.log(`[scraper] target: ${config.targetUrl}`);
  console.log(`[scraper] mode: ${mode}`);

  const { engineUsed, rows } = await scrapeWithBestEngine(config, mode);
  await sleep(randomDelayMs());

  const cleaned = dedupeByVideoUrl(rows);
  if (cleaned.length === 0) {
    console.log("[scraper] no rows found. verify selectors.");
    return;
  }

  const nowIso = new Date().toISOString();
  const payload = cleaned.map((row, index) => ({
    title: row.title,
    description: `Imported by scraper at ${nowIso}`,
    thumbnail_url: row.thumbnailUrl ?? row.videoUrl,
    video_source_url: row.videoUrl,
    minimum_required_tier: chooseTier(index, randomizeTier),
    duration_seconds: DEFAULT_DURATION_SECONDS,
  }));

  const supabase = getSupabaseAdminClient();

  const upsertResult = await supabase.from("videos").upsert(payload, {
    onConflict: "video_source_url",
    ignoreDuplicates: true,
  });

  if (upsertResult.error) {
    console.warn(
      `[scraper] upsert failed (${upsertResult.error.message}). fallback to insert...`,
    );

    const insertResult = await supabase.from("videos").insert(payload);
    if (insertResult.error) {
      throw new Error(`DB insert failed: ${insertResult.error.message}`);
    }
  }

  console.log(`[scraper] engine used: ${engineUsed}`);
  console.log(`[scraper] extracted: ${rows.length}`);
  console.log(`[scraper] deduped: ${cleaned.length}`);
  console.log("[scraper] completed successfully");
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[scraper] failed: ${message}`);
  process.exitCode = 1;
});
