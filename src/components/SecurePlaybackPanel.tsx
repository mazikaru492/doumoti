"use client";

import { useEffect, useMemo, useState } from "react";
import VideoPlayer from "@/components/VideoPlayer";

type SubscriptionPlan = "normal" | "general" | "vip";

type EntitlementResponse = {
  video: {
    id: string;
    title: string;
    thumbnailUrl: string;
  };
  entitlement: {
    plan: SubscriptionPlan;
    adRequired: boolean;
    canAccessHighQuality: boolean;
    maxPreviewSeconds: number | null;
    playback:
      | {
          needsAdGrant: true;
          adSessionId: string;
        }
      | {
          needsAdGrant: false;
          defaultQuality: "sd" | "hd";
          sources: Partial<
            Record<"sd" | "hd", { url: string; expiresAt: number }>
          >;
        };
  };
};

interface SecurePlaybackPanelProps {
  videoId: string;
}

export default function SecurePlaybackPanel({
  videoId,
}: SecurePlaybackPanelProps) {
  const [data, setData] = useState<EntitlementResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [grantedSource, setGrantedSource] = useState<string | null>(null);
  const [selectedQuality, setSelectedQuality] = useState<"sd" | "hd">("sd");
  const [remainingAdSec, setRemainingAdSec] = useState(8);
  const [granting, setGranting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/video/${videoId}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error("動画の視聴権限取得に失敗しました");
        }

        const json = (await response.json()) as EntitlementResponse;
        if (cancelled) {
          return;
        }

        setData(json);

        if (!json.entitlement.playback.needsAdGrant) {
          setSelectedQuality(json.entitlement.playback.defaultQuality);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : "不明なエラーが発生しました",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [videoId]);

  useEffect(() => {
    if (!data || !data.entitlement.playback.needsAdGrant) {
      return;
    }
    if (remainingAdSec <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setRemainingAdSec((sec) => Math.max(0, sec - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [data, remainingAdSec]);

  const currentSource = useMemo(() => {
    if (!data) {
      return null;
    }

    if (grantedSource) {
      return grantedSource;
    }

    if (data.entitlement.playback.needsAdGrant) {
      return null;
    }

    return data.entitlement.playback.sources[selectedQuality]?.url ?? null;
  }, [data, grantedSource, selectedQuality]);

  const grantAdSession = async () => {
    if (!data || !data.entitlement.playback.needsAdGrant) {
      return;
    }

    setGranting(true);
    setError(null);

    try {
      const response = await fetch(`/api/video/${videoId}/ads/grant`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          adSessionId: data.entitlement.playback.adSessionId,
        }),
      });

      if (!response.ok) {
        throw new Error("広告検証に失敗しました。再度お試しください。");
      }

      const json = (await response.json()) as {
        source: {
          url: string;
          expiresAt: number;
        };
      };

      setGrantedSource(json.source.url);
    } catch (grantError) {
      setError(
        grantError instanceof Error
          ? grantError.message
          : "広告検証でエラーが発生しました",
      );
    } finally {
      setGranting(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-muted py-8">再生権限を確認中...</div>;
  }

  if (error) {
    return <div className="text-sm text-red-400 py-8">{error}</div>;
  }

  if (!data) {
    return (
      <div className="text-sm text-red-400 py-8">
        データ取得に失敗しました。
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="px-2 py-1 rounded-full border border-primary/40 text-primary-light bg-primary/10">
          Plan: {data.entitlement.plan.toUpperCase()}
        </span>
        {data.entitlement.maxPreviewSeconds && (
          <span className="px-2 py-1 rounded-full border border-yellow-500/50 text-yellow-300 bg-yellow-500/10">
            無料プランは {data.entitlement.maxPreviewSeconds} 秒トークン
          </span>
        )}
        {data.entitlement.canAccessHighQuality &&
          !data.entitlement.playback.needsAdGrant && (
            <div className="flex items-center gap-1">
              <button
                className={`px-2 py-1 rounded-md border ${
                  selectedQuality === "sd"
                    ? "border-primary/60 text-foreground"
                    : "border-border/60 text-muted"
                }`}
                onClick={() => setSelectedQuality("sd")}
                type="button"
              >
                SD
              </button>
              <button
                className={`px-2 py-1 rounded-md border ${
                  selectedQuality === "hd"
                    ? "border-primary/60 text-foreground"
                    : "border-border/60 text-muted"
                }`}
                onClick={() => setSelectedQuality("hd")}
                type="button"
              >
                HD
              </button>
            </div>
          )}
      </div>

      {data.entitlement.playback.needsAdGrant && !currentSource ? (
        <div className="rounded-xl border border-border/40 bg-surface p-4 sm:p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            Generalプラン広告
          </h3>
          <p className="text-xs text-muted leading-relaxed">
            再生トークンは広告検証API通過後に発行されます。広告視聴カウントダウン終了後に再生開始できます。
          </p>
          <div className="h-28 rounded-lg bg-gradient-to-r from-slate-700/80 to-slate-500/80 flex items-center justify-center text-white text-sm">
            Sponsored Ad{" "}
            {remainingAdSec > 0 ? `(${remainingAdSec}s)` : "(ready)"}
          </div>
          <button
            type="button"
            disabled={remainingAdSec > 0 || granting}
            onClick={grantAdSession}
            className="px-4 py-2 rounded-lg bg-primary text-white text-sm disabled:opacity-50"
          >
            {granting ? "検証中..." : "広告を完了して動画再生"}
          </button>
        </div>
      ) : currentSource ? (
        <VideoPlayer
          src={currentSource}
          poster={data.video.thumbnailUrl}
          title={data.video.title}
          previewLimitSeconds={data.entitlement.maxPreviewSeconds}
          onUpgradeClick={() => {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      ) : (
        <div className="text-sm text-muted py-8">
          再生可能なストリームが見つかりません。
        </div>
      )}
    </div>
  );
}
