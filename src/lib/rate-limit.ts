import "server-only";

/**
 * シンプルなメモリベースのレート制限
 * 本番環境ではRedisなどの分散キャッシュを使用することを推奨
 */

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, RateLimitEntry>();

// 定期的に期限切れエントリをクリーンアップ
const CLEANUP_INTERVAL_MS = 60_000;
let cleanupTimer: NodeJS.Timeout | null = null;

function startCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt <= now) {
        store.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);
}

export type RateLimitConfig = {
  /** 識別子（IP、ユーザーID等） */
  identifier: string;
  /** 制限の種類（api, stream, auth等） */
  type: string;
  /** ウィンドウ内の最大リクエスト数 */
  maxRequests: number;
  /** ウィンドウサイズ（秒） */
  windowSeconds: number;
};

export type RateLimitResult = {
  success: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds?: number;
};

/**
 * レート制限をチェック
 */
export function checkRateLimit(config: RateLimitConfig): RateLimitResult {
  startCleanup();

  const key = `${config.type}:${config.identifier}`;
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;

  let entry = store.get(key);

  // 期限切れまたは新規の場合はリセット
  if (!entry || entry.resetAt <= now) {
    entry = {
      count: 0,
      resetAt: now + windowMs,
    };
  }

  // カウントをインクリメント
  entry.count += 1;
  store.set(key, entry);

  const remaining = Math.max(0, config.maxRequests - entry.count);
  const success = entry.count <= config.maxRequests;

  if (!success) {
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
    return {
      success: false,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfterSeconds,
    };
  }

  return {
    success: true,
    remaining,
    resetAt: entry.resetAt,
  };
}

/**
 * レート制限のプリセット設定
 */
export const RATE_LIMITS = {
  /** ストリーミングAPI: 1分あたり30リクエスト */
  STREAM: {
    maxRequests: 30,
    windowSeconds: 60,
    type: "stream",
  },
  /** 認証API: 5分あたり10リクエスト */
  AUTH: {
    maxRequests: 10,
    windowSeconds: 300,
    type: "auth",
  },
  /** 一般API: 1分あたり60リクエスト */
  API: {
    maxRequests: 60,
    windowSeconds: 60,
    type: "api",
  },
  /** Webhook: 1分あたり100リクエスト */
  WEBHOOK: {
    maxRequests: 100,
    windowSeconds: 60,
    type: "webhook",
  },
} as const;

/**
 * IPアドレスを取得するヘルパー
 */
export function getClientIP(request: Request): string {
  // Vercel/Cloudflare等のプロキシ経由の場合
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }

  const realIP = request.headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }

  return "unknown";
}
