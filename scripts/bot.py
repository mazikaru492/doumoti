import asyncio
import hashlib
import json
import logging
import mimetypes
import os
import re
import smtplib
import subprocess
import sys
from collections import deque
from email.mime.text import MIMEText
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional
from urllib.parse import parse_qs, urlparse

import aria2p
import bencodepy
from dotenv import load_dotenv
from supabase import Client, create_client


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("torrent-bot")


ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".mkv", ".avi", ".mov", ".webm"}
DEFAULT_MIN_VIDEO_SIZE_BYTES = 50 * 1024 * 1024


class SkipTask(Exception):
    """Raised when a task should be skipped for security or validation reasons."""


@dataclass
class TaskItem:
    magnet: Optional[str] = None
    torrent_file: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    thumbnail_url: Optional[str] = None
    minimum_required_tier: str = "NORMAL"
    duration_seconds: int = 60


@dataclass
class ParsedTorrentMeta:
    info_hash: Optional[str]
    name: Optional[str]


@dataclass
class GeneratedMetadata:
    title: str
    description: str


def load_env() -> None:
    load_dotenv(".env.local", override=False)


def required_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def optional_bool_env(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def create_supabase_admin_client() -> Client:
    url = required_env("NEXT_PUBLIC_SUPABASE_URL")
    key = required_env("SUPABASE_SERVICE_ROLE_KEY")
    return create_client(url, key)


def create_aria2_client() -> aria2p.API:
    host = os.getenv("ARIA2_RPC_HOST", "http://localhost")
    port = int(os.getenv("ARIA2_RPC_PORT", "6800"))
    secret = os.getenv("ARIA2_RPC_SECRET", "")
    timeout = float(os.getenv("ARIA2_RPC_TIMEOUT", "15"))

    client = aria2p.Client(host=host, port=port, secret=secret, timeout=timeout)
    return aria2p.API(client)


def parse_tasks_file(path_str: str) -> list[TaskItem]:
    path = Path(path_str)
    if not path.exists():
        raise FileNotFoundError(f"Task file not found: {path}")

    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise ValueError("Task file must contain a JSON array")

    tasks: list[TaskItem] = []
    for idx, row in enumerate(raw):
        if not isinstance(row, dict):
            raise ValueError(f"Task at index {idx} must be an object")

        task = TaskItem(
            magnet=row.get("magnet"),
            torrent_file=row.get("torrent_file"),
            title=row.get("title"),
            description=row.get("description"),
            thumbnail_url=row.get("thumbnail_url"),
            minimum_required_tier=(row.get("minimum_required_tier") or "NORMAL").upper(),
            duration_seconds=int(row.get("duration_seconds") or 60),
        )

        if not task.magnet and not task.torrent_file:
            raise ValueError(
                f"Task at index {idx} requires either magnet or torrent_file"
            )

        if task.minimum_required_tier not in {"NORMAL", "GENERAL", "VIP"}:
            raise ValueError(
                f"Task at index {idx} has invalid minimum_required_tier: {task.minimum_required_tier}"
            )

        if task.duration_seconds <= 0:
            raise ValueError(
                f"Task at index {idx} has invalid duration_seconds: {task.duration_seconds}"
            )

        tasks.append(task)

    return tasks


def extract_btih_from_magnet(magnet: str) -> ParsedTorrentMeta:
    parsed = urlparse(magnet)
    if parsed.scheme.lower() != "magnet":
        return ParsedTorrentMeta(info_hash=None, name=None)

    query = parse_qs(parsed.query)
    xt_values = query.get("xt", [])
    dn_values = query.get("dn", [])
    display_name = dn_values[0] if dn_values else None

    info_hash: Optional[str] = None
    for xt in xt_values:
        if xt.startswith("urn:btih:"):
            info_hash = xt.split("urn:btih:", 1)[1].strip().lower()
            break

    if info_hash and re.fullmatch(r"[a-f0-9]{40}", info_hash) is None:
        info_hash = None

    return ParsedTorrentMeta(info_hash=info_hash, name=display_name)


def parse_torrent_file_meta(torrent_file: str) -> ParsedTorrentMeta:
    torrent_path = Path(torrent_file)
    if not torrent_path.exists():
        raise FileNotFoundError(f"Torrent file not found: {torrent_file}")

    raw = torrent_path.read_bytes()
    decoded = bencodepy.decode(raw)

    info = decoded.get(b"info")
    if not isinstance(info, dict):
        return ParsedTorrentMeta(info_hash=None, name=torrent_path.stem)

    encoded_info = bencodepy.encode(info)
    info_hash = hashlib.sha1(encoded_info).hexdigest().lower()

    name_bytes = info.get(b"name")
    if isinstance(name_bytes, bytes):
        name = name_bytes.decode("utf-8", errors="replace")
    else:
        name = torrent_path.stem

    return ParsedTorrentMeta(info_hash=info_hash, name=name)


def infer_meta(task: TaskItem) -> ParsedTorrentMeta:
    if task.magnet:
        return extract_btih_from_magnet(task.magnet)
    if task.torrent_file:
        return parse_torrent_file_meta(task.torrent_file)
    return ParsedTorrentMeta(info_hash=None, name=None)


def normalize_name_for_lookup(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    sanitized = value.strip().lower()
    return sanitized or None


def already_registered(
    supabase: Client,
    info_hash: Optional[str],
    candidate_name: Optional[str],
) -> tuple[bool, str]:
    if info_hash:
        res = (
            supabase.table("videos")
            .select("id,title,info_hash")
            .eq("info_hash", info_hash)
            .limit(1)
            .execute()
        )
        if res.data:
            return True, f"matched info_hash={info_hash}"

    normalized_name = normalize_name_for_lookup(candidate_name)
    if normalized_name:
        # Fallback: conservative path/name check against video_source_url.
        res = (
            supabase.table("videos")
            .select("id,title,video_source_url")
            .ilike("video_source_url", f"%{normalized_name}%")
            .limit(1)
            .execute()
        )
        if res.data:
            return True, f"matched name fragment={normalized_name}"

    return False, ""


def add_to_aria2(api: aria2p.API, task: TaskItem, download_dir: str) -> aria2p.Download:
    options = {"dir": download_dir}

    if task.magnet:
        return api.add_magnet(task.magnet, options=options)

    if not task.torrent_file:
        raise RuntimeError("Task is missing both magnet and torrent_file")

    torrent_path = str(Path(task.torrent_file).resolve())
    return api.add_torrent(torrent_path, options=options)


async def wait_until_complete(
    api: aria2p.API,
    gid: str,
    poll_seconds: float,
    min_video_size_bytes: int,
) -> aria2p.Download:
    active_gid = gid
    selection_applied_for_gids: set[str] = set()
    while True:
        download = api.get_download(active_gid)

        followed_ids = list(getattr(download, "followed_by_ids", []) or [])
        if followed_ids:
            next_gid = str(followed_ids[0])
            if next_gid != active_gid:
                logger.info(
                    "Switching to followed download gid=%s (from gid=%s)",
                    next_gid,
                    active_gid,
                )
                active_gid = next_gid
                await asyncio.sleep(poll_seconds)
                continue

        if active_gid not in selection_applied_for_gids:
            files = collect_download_files(download)
            if files:
                selected_indices = choose_video_file_indices_for_aria2(
                    download,
                    min_size_bytes=min_video_size_bytes,
                )

                if not selected_indices:
                    logger.warning(
                        "No safe video files matched whitelist/size for gid=%s. Cancelling download.",
                        active_gid,
                    )
                    cancel_aria2_download(api, active_gid)
                    raise SkipTask(
                        "No allowed video file found in torrent (or all were below minimum size)."
                    )

                apply_aria2_select_file(api, active_gid, selected_indices)
                selection_applied_for_gids.add(active_gid)
                logger.info(
                    "Applied aria2 select-file for gid=%s (video files=%s)",
                    active_gid,
                    ",".join(selected_indices),
                )

        if download.is_complete:
            return download

        if download.has_failed:
            raise RuntimeError(
                f"Download failed gid={active_gid} error_code={download.error_code} msg={download.error_message}"
            )

        progress = float(download.progress or 0.0)
        logger.info(
            "Downloading gid=%s progress=%.2f%% speed=%s",
            active_gid,
            progress,
            download.download_speed_string(),
        )

        await asyncio.sleep(poll_seconds)


def sanitize_storage_filename(file_name: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]", "_", file_name)


def is_allowed_video_path(file_path: str) -> bool:
    suffix = Path(file_path).suffix.lower()
    return suffix in ALLOWED_VIDEO_EXTENSIONS


def is_suspiciously_small(size_bytes: int, min_size_bytes: int) -> bool:
    return size_bytes < min_size_bytes


def collect_download_files(download: aria2p.Download) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for idx, file_obj in enumerate(download.files, start=1):
        index_value = str(getattr(file_obj, "index", idx))
        path_value = str(getattr(file_obj, "path", "") or "")
        length_value = int(getattr(file_obj, "length", 0) or 0)
        result.append(
            {
                "index": index_value,
                "path": path_value,
                "length": length_value,
                "is_video": is_allowed_video_path(path_value),
            }
        )
    return result


def choose_video_file_indices_for_aria2(
    download: aria2p.Download,
    *,
    min_size_bytes: int,
) -> list[str]:
    candidates: list[str] = []
    for item in collect_download_files(download):
        if not item["is_video"]:
            continue

        length = int(item["length"])
        # Metadata length can be unknown (0) before full fetch; strict size gate is enforced after completion.
        if length > 0 and is_suspiciously_small(length, min_size_bytes):
            continue

        candidates.append(item["index"])

    return candidates


def apply_aria2_select_file(api: aria2p.API, gid: str, indices: list[str]) -> None:
    select_value = ",".join(indices)

    try:
        api.client.change_option(gid, {"select-file": select_value})
        return
    except Exception:  # noqa: BLE001
        pass

    # Fallback for aria2p variants.
    try:
        api.change_option(gid, {"select-file": select_value})
        return
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(f"Failed to apply select-file for gid={gid}: {exc}") from exc


def cancel_aria2_download(api: aria2p.API, gid: str) -> None:
    try:
        api.client.force_remove(gid)
    except Exception:  # noqa: BLE001
        logger.warning("Could not force-remove gid=%s", gid)

    try:
        api.client.remove_download_result(gid)
    except Exception:  # noqa: BLE001
        logger.warning("Could not remove download result gid=%s", gid)


def ensure_safe_video_file(path_value: str, min_size_bytes: int) -> None:
    path = Path(path_value)
    if not path.exists():
        raise RuntimeError(f"Downloaded file not found: {path}")

    if not is_allowed_video_path(str(path)):
        raise SkipTask(f"Primary file has disallowed extension: {path.name}")

    size_bytes = path.stat().st_size
    if is_suspiciously_small(size_bytes, min_size_bytes):
        raise SkipTask(
            f"Primary video is suspiciously small ({size_bytes} bytes < {min_size_bytes} bytes): {path.name}"
        )


def sanitize_video_with_ffmpeg(local_file_path: str) -> str:
    source = Path(local_file_path)
    if not source.exists():
        raise RuntimeError(f"File not found for ffmpeg sanitize: {local_file_path}")

    sanitized_path = source.with_suffix(".sanitized.mp4")

    cmd = [
        "ffmpeg",
        "-y",
        "-v",
        "error",
        "-i",
        str(source),
        "-map",
        "0:v:0",
        "-map",
        "0:a?",
        "-dn",
        "-sn",
        "-map_metadata",
        "-1",
        "-map_chapters",
        "-1",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "23",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-movflags",
        "+faststart",
        str(sanitized_path),
    ]

    try:
        subprocess.run(cmd, check=True, capture_output=True, text=True)
    except FileNotFoundError as exc:
        raise RuntimeError("ffmpeg command not found. Please install ffmpeg and ensure it is in PATH.") from exc
    except subprocess.CalledProcessError as exc:
        stderr = (exc.stderr or "").strip()
        raise RuntimeError(f"ffmpeg sanitize failed: {stderr}") from exc

    if not sanitized_path.exists() or sanitized_path.stat().st_size <= 0:
        raise RuntimeError(f"Sanitized file was not created correctly: {sanitized_path}")

    return str(sanitized_path)


def cleanup_local_files(*paths: Optional[str]) -> None:
    for path in paths:
        if not path:
            continue
        try:
            cleanup_local_file(path)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Failed to remove local file %s: %s", path, exc)


def resolve_public_url(value: Any) -> str:
    if isinstance(value, str):
        return value

    if isinstance(value, dict):
        candidates = [
            value.get("publicURL"),
            value.get("publicUrl"),
            value.get("public_url"),
            value.get("signedURL"),
        ]
        for candidate in candidates:
            if isinstance(candidate, str) and candidate:
                return candidate

    raise RuntimeError("Could not resolve public URL from storage response")


def upload_to_storage_and_get_public_url(
    supabase: Client,
    *,
    local_file_path: str,
    info_hash: Optional[str],
) -> tuple[str, str]:
    local_path = Path(local_file_path)
    if not local_path.exists():
        raise RuntimeError(f"Local file not found for upload: {local_file_path}")

    bucket = os.getenv("SUPABASE_STORAGE_BUCKET", "videos")
    safe_name = sanitize_storage_filename(local_path.name)
    key_prefix = info_hash or hashlib.sha1(local_path.name.encode("utf-8")).hexdigest()[:12]
    object_path = f"{key_prefix}/{safe_name}"

    content_type = mimetypes.guess_type(local_path.name)[0] or "application/octet-stream"
    with local_path.open("rb") as file_obj:
        supabase.storage.from_(bucket).upload(
            path=object_path,
            file=file_obj,
            file_options={"content-type": content_type, "upsert": "true"},
        )

    public_url = resolve_public_url(supabase.storage.from_(bucket).get_public_url(object_path))
    return public_url, object_path


def fallback_generated_metadata(filename: str) -> GeneratedMetadata:
    stem = Path(filename).stem
    normalized = re.sub(r"[_\-.]+", " ", stem).strip()
    title = normalized.title() if normalized else "Untitled Torrent Video"
    description = (
        f"{title} was automatically ingested from the BitTorrent pipeline and prepared for streaming delivery."
    )
    return GeneratedMetadata(title=title, description=description)


def parse_metadata_json(text: str) -> Optional[GeneratedMetadata]:
    text = text.strip()
    if not text:
        return None

    candidates = [text]
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        candidates.insert(0, match.group(0))

    for candidate in candidates:
        try:
            obj = json.loads(candidate)
        except json.JSONDecodeError:
            continue

        if not isinstance(obj, dict):
            continue

        title = str(obj.get("title", "")).strip()
        description = str(obj.get("description", "")).strip()
        if title and description:
            return GeneratedMetadata(title=title, description=description)

    return None


def generate_video_metadata(filename: str) -> GeneratedMetadata:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        logger.info("OPENAI_API_KEY is not set. Using fallback metadata for %s", filename)
        return fallback_generated_metadata(filename)

    try:
        from openai import OpenAI
    except Exception as exc:  # noqa: BLE001
        logger.warning("openai package not available (%s). Using fallback metadata.", exc)
        return fallback_generated_metadata(filename)

    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    prompt = (
        "以下のファイル名から、動画配信プラットフォームにふさわしい魅力的な"
        "『タイトル（title）』と『あらすじ（description）』を推測または創作し、"
        "必ずJSON形式で返してください。"
        f"ファイル名: {filename}"
    )

    try:
        client = OpenAI(api_key=api_key)
        response = client.responses.create(
            model=model,
            input=[
                {
                    "role": "system",
                    "content": "You are a metadata generator. Always return only valid JSON with keys title and description.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.7,
            max_output_tokens=220,
        )

        generated_text = getattr(response, "output_text", "") or ""
        parsed = parse_metadata_json(generated_text)
        if parsed:
            return parsed

        logger.warning("Failed to parse LLM JSON output. Using fallback metadata.")
        return fallback_generated_metadata(filename)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Metadata generation failed (%s). Using fallback metadata.", exc)
        return fallback_generated_metadata(filename)


def cleanup_local_file(local_file_path: str) -> None:
    target = Path(local_file_path)
    if not target.exists():
        return
    target.unlink()
    logger.info("Removed local file after successful cloud upload: %s", target)


def pick_primary_file(download: aria2p.Download) -> str:
    files = download.files
    if not files:
        raise RuntimeError(f"No files found for gid={download.gid}")

    # Pick the largest file as main content.
    biggest = max(files, key=lambda f: int(getattr(f, "length", 0) or 0))
    path_value = getattr(biggest, "path", None)
    if not path_value:
        raise RuntimeError(f"No file path found for gid={download.gid}")

    return str(path_value)


def upsert_video(
    supabase: Client,
    task: TaskItem,
    info_hash: Optional[str],
    source_url: str,
    generated_metadata: GeneratedMetadata,
) -> None:
    title = (task.title or generated_metadata.title or "Untitled Torrent Video").strip()
    if not title:
        title = "Untitled Torrent Video"

    description = (
        (task.description or generated_metadata.description).strip()
        or "Imported from research BitTorrent pipeline"
    )

    thumbnail = (task.thumbnail_url or "https://picsum.photos/seed/torrent-bot/640/360").strip()

    payload: dict[str, Any] = {
        "title": title,
        "description": description,
        "thumbnail_url": thumbnail,
        "video_source_url": source_url,
        "minimum_required_tier": task.minimum_required_tier,
        "duration_seconds": task.duration_seconds,
    }

    if info_hash:
        payload["info_hash"] = info_hash

    result = (
        supabase.table("videos")
        .upsert(payload, on_conflict="video_source_url")
        .execute()
    )

    if result.data is None and getattr(result, "error", None):
        raise RuntimeError(f"Supabase upsert failed: {result.error}")


async def acquire_rate_limit_slot(
    starts: deque[float],
    *,
    max_downloads: int,
    window_seconds: float,
) -> None:
    if max_downloads <= 0:
        return

    loop = asyncio.get_running_loop()

    while True:
        now = loop.time()

        while starts and (now - starts[0]) >= window_seconds:
            starts.popleft()

        if len(starts) < max_downloads:
            starts.append(now)
            return

        wait_seconds = max(window_seconds - (now - starts[0]), 0.1)
        logger.info(
            "Rate limit reached: %d downloads / %.0f sec. Waiting %.1f sec...",
            max_downloads,
            window_seconds,
            wait_seconds,
        )
        await asyncio.sleep(wait_seconds)


def send_notification_email(video_title: str) -> None:
    """Send an email notification after a video has been downloaded and registered.

    Requires SMTP_USER and SMTP_PASSWORD environment variables to be set.
    If they are not configured, the notification is silently skipped so that
    the core pipeline is never interrupted.
    """
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")

    if not smtp_user or not smtp_password:
        logger.info("SMTP_USER / SMTP_PASSWORD not set. Skipping email notification.")
        return

    to_address = "yukijkbvdn@gmail.com"
    subject = "新しい動画をダウンロードしました"
    body = (
        f"以下の動画のダウンロードとDB登録が完了しました。\n\n"
        f"タイトル: {video_title}\n"
    )

    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = smtp_user
    msg["To"] = to_address

    try:
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(smtp_user, smtp_password)
            server.sendmail(smtp_user, [to_address], msg.as_string())
        logger.info("Notification email sent for: %s", video_title)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to send notification email (%s). Continuing.", exc)


async def run() -> None:
    load_env()

    tasks_path = os.getenv("TORRENT_TASKS_JSON", "scripts/torrent_tasks.json")
    download_dir = os.getenv("TORRENT_DOWNLOAD_DIR", "downloads")
    cleanup_enabled = optional_bool_env("TORRENT_DELETE_LOCAL_AFTER_UPLOAD", True)

    poll_seconds = float(os.getenv("TORRENT_POLL_SECONDS", "5"))
    max_downloads_per_window = int(os.getenv("TORRENT_MAX_DOWNLOADS", "6"))
    rate_window_seconds = float(os.getenv("TORRENT_RATE_WINDOW_SECONDS", "1800"))
    min_video_size_bytes = int(
        os.getenv("TORRENT_MIN_VIDEO_SIZE_BYTES", str(DEFAULT_MIN_VIDEO_SIZE_BYTES))
    )

    tasks = parse_tasks_file(tasks_path)
    supabase = create_supabase_admin_client()
    aria2 = create_aria2_client()
    download_start_times: deque[float] = deque()

    logger.info("Loaded %d task(s)", len(tasks))
    logger.info(
        "Rate limit: max %d download starts per %.0f seconds",
        max_downloads_per_window,
        rate_window_seconds,
    )
    logger.info(
        "Security filter: extensions=%s, min_video_size=%d bytes",
        ",".join(sorted(ALLOWED_VIDEO_EXTENSIONS)),
        min_video_size_bytes,
    )

    imported = 0
    skipped = 0
    failed = 0

    for idx, task in enumerate(tasks, start=1):
        logger.info("Task %d/%d start", idx, len(tasks))
        local_file_path: Optional[str] = None
        sanitized_file_path: Optional[str] = None

        try:
            meta = infer_meta(task)

            exists, reason = already_registered(
                supabase=supabase,
                info_hash=meta.info_hash,
                candidate_name=meta.name,
            )
            if exists:
                skipped += 1
                logger.info("Skip: already registered (%s)", reason)
                continue

            await acquire_rate_limit_slot(
                download_start_times,
                max_downloads=max_downloads_per_window,
                window_seconds=rate_window_seconds,
            )

            download = add_to_aria2(aria2, task, download_dir)
            logger.info("Queued gid=%s", download.gid)

            completed = await wait_until_complete(
                api=aria2,
                gid=download.gid,
                poll_seconds=poll_seconds,
                min_video_size_bytes=min_video_size_bytes,
            )

            local_file_path = pick_primary_file(completed)
            ensure_safe_video_file(local_file_path, min_video_size_bytes)

            sanitized_file_path = sanitize_video_with_ffmpeg(local_file_path)

            source_url, object_path = upload_to_storage_and_get_public_url(
                supabase,
                local_file_path=sanitized_file_path,
                info_hash=meta.info_hash,
            )
            logger.info("Uploaded to storage path=%s", object_path)

            generated_metadata = generate_video_metadata(Path(local_file_path).name)

            upsert_video(
                supabase=supabase,
                task=task,
                info_hash=meta.info_hash,
                source_url=source_url,
                generated_metadata=generated_metadata,
            )

            # --- Email notification (added; does not affect core logic) ---
            notification_title = task.title or generated_metadata.title or "Untitled"
            send_notification_email(notification_title)
            # --------------------------------------------------------------

            imported += 1
            logger.info(
                "Imported gid=%s title=%s",
                completed.gid,
                task.title or generated_metadata.title,
            )

            # Security requirement: always remove both original and sanitized files after upload.
            cleanup_local_files(local_file_path, sanitized_file_path)
        except SkipTask as exc:
            skipped += 1
            logger.warning("Skip task for security policy: %s", exc)
            cleanup_local_files(local_file_path, sanitized_file_path)
        except Exception as exc:  # noqa: BLE001
            failed += 1
            logger.exception("Task failed: %s", exc)
            if cleanup_enabled:
                cleanup_local_files(local_file_path, sanitized_file_path)

    logger.info("Done: imported=%d skipped=%d failed=%d", imported, skipped, failed)

    if failed > 0:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(run())
