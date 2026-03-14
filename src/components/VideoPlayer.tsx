"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RotateCcw,
  Loader2,
  AlertCircle,
} from "lucide-react";

interface VideoPlayerProps {
  /** 海外サーバー上の動画URL (HLS m3u8 or MP4) */
  src: string;
  /** ポスター画像URL */
  poster?: string;
  /** 動画タイトル（アクセシビリティ用） */
  title?: string;
}

/**
 * VideoPlayer — HLS/MP4 対応の動画プレイヤー
 *
 * 設計方針:
 * - hls.js で HLS ストリームをネイティブに非対応のブラウザでも再生
 * - Safari は HLS をネイティブでサポートするため、直接 <video> の src に設定
 * - MP4 は直接再生
 * - crossOrigin="anonymous" で CORS 対応
 * - バッファリング/エラー状態を検知し、ユーザーフレンドリーなUIを表示
 */
export default function VideoPlayer({ src, poster, title }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const hideControlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState("0:00");
  const [duration, setDuration] = useState("0:00");
  const [showControls, setShowControls] = useState(true);
  const [volume, setVolume] = useState(1);

  // 時間表示フォーマッター
  const formatTime = (seconds: number): string => {
    if (isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // HLS / MP4 ストリームの初期化
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setHasError(false);
    setErrorMessage("");

    const isHls = src.includes(".m3u8");

    if (isHls && Hls.isSupported()) {
      // hls.js でストリームをアタッチ
      const hls = new Hls({
        // 海外サーバーからの配信を考慮した寛容なバッファ設定
        maxBufferLength: 30,
        maxMaxBufferLength: 120,
        startLevel: -1, // ABR（自動品質選択）を有効化
        xhrSetup: (xhr: XMLHttpRequest) => {
          // CORS 対応: withCredentials を無効に設定
          xhr.withCredentials = false;
        },
      });

      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setErrorMessage("ネットワークエラー: 動画サーバーに接続できません");
              // ネットワークエラー時は自動リカバリを試行
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              setErrorMessage("メディアエラー: 動画の復旧を試みています...");
              hls.recoverMediaError();
              break;
            default:
              setHasError(true);
              setErrorMessage("再生エラー: この動画は現在再生できません");
              hls.destroy();
              break;
          }
        }
      });

      hlsRef.current = hls;
    } else if (isHls && video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari: HLS をネイティブサポート
      video.src = src;
    } else {
      // MP4 直接再生
      video.src = src;
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src]);

  // 動画イベントリスナー
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      if (video.duration) {
        setProgress((video.currentTime / video.duration) * 100);
        setCurrentTime(formatTime(video.currentTime));
      }
    };

    const onLoadedMetadata = () => {
      setDuration(formatTime(video.duration));
    };

    const onWaiting = () => setIsBuffering(true);
    const onPlaying = () => {
      setIsBuffering(false);
      setIsPlaying(true);
    };
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
    };
  }, []);

  // コントロールの自動非表示
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current);
    }
    if (isPlaying) {
      hideControlsTimerRef.current = setTimeout(
        () => setShowControls(false),
        3000
      );
    }
  }, [isPlaying]);

  // =====================
  // Player Controls
  // =====================

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const val = parseFloat(e.target.value);
    video.volume = val;
    setVolume(val);
    if (val === 0) {
      setIsMuted(true);
      video.muted = true;
    } else if (isMuted) {
      setIsMuted(false);
      video.muted = false;
    }
  };

  const toggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      await container.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // プログレスバーのシーク操作
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    const bar = progressRef.current;
    if (!video || !bar) return;
    const rect = bar.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    video.currentTime = ratio * video.duration;
  };

  const retry = () => {
    setHasError(false);
    setErrorMessage("");
    const video = videoRef.current;
    if (video) {
      video.load();
      video.play().catch(() => {});
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full bg-black rounded-xl overflow-hidden group"
      style={{ aspectRatio: "16 / 9" }}
      onMouseMove={resetHideTimer}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* video 要素 — crossOrigin で CORS 対応 */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain cursor-pointer"
        crossOrigin="anonymous"
        poster={poster}
        playsInline
        preload="metadata"
        aria-label={title || "動画プレイヤー"}
        onClick={togglePlay}
      />

      {/* バッファリングインジケーター */}
      {isBuffering && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-10">
          <Loader2 className="w-12 h-12 text-primary-light animate-spin" />
        </div>
      )}

      {/* エラー表示 */}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20 gap-4">
          <AlertCircle className="w-16 h-16 text-accent" />
          <p className="text-white text-sm text-center max-w-xs">
            {errorMessage}
          </p>
          <button
            onClick={retry}
            className="flex items-center gap-2 px-4 py-2 bg-primary rounded-lg text-white text-sm hover:bg-primary-dark transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            再試行
          </button>
        </div>
      )}

      {/* 中央の再生ボタン（一時停止中のみ表示） */}
      {!isPlaying && !hasError && !isBuffering && (
        <div
          className="absolute inset-0 flex items-center justify-center z-10 cursor-pointer"
          onClick={togglePlay}
        >
          <div className="relative w-16 h-16 rounded-full bg-primary/80 flex items-center justify-center pulse-ring backdrop-blur-sm hover:bg-primary transition-colors">
            <Play className="w-7 h-7 text-white ml-1" />
          </div>
        </div>
      )}

      {/* コントロールバー */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-20 transition-all duration-300 ${
          showControls
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-2 pointer-events-none"
        }`}
      >
        {/* グラデーションオーバーレイ */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

        <div className="relative px-4 pb-3 pt-8">
          {/* プログレスバー */}
          <div
            ref={progressRef}
            className="w-full h-1.5 bg-white/20 rounded-full cursor-pointer mb-3 group/progress hover:h-2.5 transition-all"
            onClick={handleProgressClick}
          >
            <div
              className="h-full bg-gradient-to-r from-primary to-accent rounded-full relative"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-lg opacity-0 group-hover/progress:opacity-100 transition-opacity" />
            </div>
          </div>

          {/* コントロールボタン群 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={togglePlay}
                className="text-white hover:text-primary-light transition-colors"
                aria-label={isPlaying ? "一時停止" : "再生"}
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5" />
                )}
              </button>

              {/* 音量コントロール */}
              <div className="flex items-center gap-2 group/volume">
                <button
                  onClick={toggleMute}
                  className="text-white hover:text-primary-light transition-colors"
                  aria-label={isMuted ? "ミュート解除" : "ミュート"}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-5 h-5" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-0 group-hover/volume:w-20 transition-all duration-200 accent-primary cursor-pointer"
                />
              </div>

              {/* 時間表示 */}
              <span className="text-white/80 text-xs font-mono">
                {currentTime} / {duration}
              </span>
            </div>

            <button
              onClick={toggleFullscreen}
              className="text-white hover:text-primary-light transition-colors"
              aria-label={isFullscreen ? "フルスクリーン解除" : "フルスクリーン"}
            >
              {isFullscreen ? (
                <Minimize className="w-5 h-5" />
              ) : (
                <Maximize className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
